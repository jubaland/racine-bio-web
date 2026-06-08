import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { sendPrepSlipToPreparers, sendOrderConfirmation, sendSubscriptionPaused, sendSubscriptionExpired } from '../../../../lib/emails';

// Génération automatique des livraisons d'abonnement.
// Appelé chaque jour par Vercel Cron (voir vercel.json).

const FREQ_LABEL: Record<string, string> = {
  weekly:      'hebdomadaire',
  fortnightly: 'toutes les deux semaines',
  monthly:     'mensuelle',
};

// Nombre de jours entiers entre deux dates au format YYYY-MM-DD
function daysBetween(fromStr: string, toStr: string): number {
  const a = new Date(fromStr + 'T00:00:00Z').getTime();
  const b = new Date(toStr + 'T00:00:00Z').getTime();
  return Math.round((b - a) / 86400000);
}

// Une livraison est-elle due aujourd'hui selon la fréquence ?
// (on est déjà le bon jour de la semaine ; today != last_delivery est garanti par l'appelant)
function isDue(frequency: string, lastDelivery: string | null, todayStr: string): boolean {
  if (!lastDelivery) return true;
  if (frequency === 'weekly') return true; // une fois par semaine sur ce jour
  if (frequency === 'fortnightly') return daysBetween(lastDelivery, todayStr) >= 14;
  if (frequency === 'monthly') {
    const last = new Date(lastDelivery + 'T00:00:00Z');
    const today = new Date(todayStr + 'T00:00:00Z');
    return last.getUTCFullYear() !== today.getUTCFullYear() || last.getUTCMonth() !== today.getUTCMonth();
  }
  return false;
}

export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const dow = now.getUTCDay();            // 0=dim … 6=sam
  const todayStr = now.toISOString().slice(0, 10);

  const { data: subs } = await supabaseAdmin
    .from('subscriptions')
    .select('user_id, frequency, delivery_day, last_delivery, valid_until, delivery_fee')
    .eq('active', true).eq('paused', false).eq('delivery_day', dow);

  const results: any[] = [];

  // 1. Filtrer expirations + livraisons réellement dues aujourd'hui
  const due: any[] = [];
  for (const s of (subs || [])) {
    if (s.last_delivery === todayStr) continue; // déjà livré aujourd'hui

    // Expiration : pause + notification, pas de livraison
    if (s.valid_until && todayStr > s.valid_until) {
      try { await expireOne(s.user_id, s.frequency); } catch (e: any) { /* noop */ }
      results.push({ user: s.user_id, frequency: s.frequency, expired: true });
      continue;
    }

    if (!isDue(s.frequency, s.last_delivery, todayStr)) continue;
    due.push(s);
  }

  // 2. Frais de transport : UNE SEULE FOIS par client et par jour (un seul trajet).
  //    Si plusieurs livraisons d'un même client tombent le même jour (ex. hebdo +
  //    quinzaine), on applique le frais le plus élevé une fois, 0 sur les autres.
  const maxFeeByUser: Record<string, number> = {};
  for (const s of due) {
    maxFeeByUser[s.user_id] = Math.max(maxFeeByUser[s.user_id] || 0, Number(s.delivery_fee) || 0);
  }
  const feeCharged = new Set<string>();

  // 3. Traiter les livraisons
  for (const s of due) {
    const feeToTry = feeCharged.has(s.user_id) ? 0 : (maxFeeByUser[s.user_id] || 0);
    try {
      const res: any = await processOne(s.user_id, s.frequency, todayStr, feeToTry);
      // Le frais n'est marqué "prélevé" que si une commande a réellement été créée
      if (feeToTry > 0 && res?.ordered) feeCharged.add(s.user_id);
      results.push({ user: s.user_id, frequency: s.frequency, ...res });
    } catch (e: any) {
      results.push({ user: s.user_id, frequency: s.frequency, error: e.message });
    }
  }
  return NextResponse.json({ date: todayStr, dow, due: due.length, results });
}

async function expireOne(userId: string, frequency: string) {
  await supabaseAdmin.from('subscriptions')
    .update({ paused: true, updated_at: new Date().toISOString() })
    .eq('user_id', userId).eq('frequency', frequency);
  const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
  const email = userData?.user?.email || null;
  const label = FREQ_LABEL[frequency] || frequency;
  try { if (email) await sendSubscriptionExpired(email, label); } catch {}
  try {
    const { sendPushToUser } = await import('../../../../lib/push');
    await sendPushToUser(userId, { title: '⏳ Abonnement à renouveler', body: `Votre commande modèle ${label} est arrivée à échéance.`, url: '/abonnement' });
  } catch {}
}

async function processOne(userId: string, frequency: string, todayStr: string, fee: number = 0) {
  const label = FREQ_LABEL[frequency] || frequency;
  const { data: items } = await supabaseAdmin
    .from('subscription_items').select('product_id, quantity').eq('user_id', userId).eq('frequency', frequency);
  if (!items || !items.length) return { skipped: 'no_items' };

  const ids = items.map((i: any) => i.product_id);
  const { data: prods } = await supabaseAdmin
    .from('products').select('id, name, price, unit, image_url, farm, stock_qty, status').in('id', ids);
  const pmap: Record<number, any> = Object.fromEntries((prods || []).map((p: any) => [p.id, p]));

  // Lignes livrables (produit publié, quantité plafonnée au stock)
  const lines: { p: any; qty: number }[] = [];
  for (const it of items) {
    const p = pmap[it.product_id];
    if (!p || p.status !== 'published') continue;
    const q = Math.min(Number(it.quantity), Number(p.stock_qty) || 0);
    if (q > 0) lines.push({ p, qty: q });
  }
  if (!lines.length) return { skipped: 'out_of_stock' };

  const itemsTotal = lines.reduce((s, l) => s + Number(l.p.price) * l.qty, 0);
  const total = itemsTotal + (Number(fee) || 0);   // articles + frais de transport personnalisés

  // Solde
  const { data: w } = await supabaseAdmin.from('wallets').select('balance').eq('user_id', userId).maybeSingle();
  const balance = Number(w?.balance) || 0;

  // Contact (adresse par défaut, sinon métadonnées)
  const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
  const md = userData?.user?.user_metadata || {};
  const email = userData?.user?.email || null;

  if (balance < total) {
    await supabaseAdmin.from('subscriptions').update({ paused: true, updated_at: new Date().toISOString() })
      .eq('user_id', userId).eq('frequency', frequency);
    try { if (email) await sendSubscriptionPaused(email, total, balance); } catch {}
    try {
      const { sendPushToUser } = await import('../../../../lib/push');
      await sendPushToUser(userId, { title: '⏸️ Cagnotte à recharger', body: `Votre livraison ${label} est en pause (solde insuffisant).`, url: '/abonnement' });
    } catch {}
    return { paused: 'low_balance', needed: total, balance };
  }

  const { data: addrs } = await supabaseAdmin
    .from('addresses').select('recipient_name, phone, address').eq('user_id', userId)
    .order('is_default', { ascending: false }).limit(1);
  const addr = addrs?.[0];
  const customer_name = addr?.recipient_name || md.full_name || '';
  const phone = addr?.phone || md.phone || '';
  const address = addr?.address || md.address || '';

  // Commande (prépayée via cagnotte ; frais de transport personnalisés éventuels)
  const { data: order, error: orderErr } = await supabaseAdmin.from('orders').insert({
    user_id: userId, total, delivery_fee: Number(fee) || 0, delivery_option_name: `Abonnement (${label})`,
    special_instructions: `Commande automatique (abonnement ${label})`,
    status: 'processing', payment_method: 'wallet',
    phone, address, customer_name, email,
  }).select().single();
  if (orderErr || !order) return { error: orderErr?.message || 'order_failed' };

  await supabaseAdmin.from('order_items').insert(lines.map(l => ({
    order_id: order.id, product_id: l.p.id, quantity: l.qty, price: l.p.price,
    product_name: l.p.name, product_image_url: l.p.image_url, product_unit: l.p.unit, product_farm: l.p.farm,
  })));

  await Promise.all(lines.map(l =>
    supabaseAdmin.from('products').update({ stock_qty: Math.max(0, Number(l.p.stock_qty) - l.qty) }).eq('id', l.p.id)));

  await supabaseAdmin.rpc('wallet_adjust', {
    p_user: userId, p_amount: -total, p_type: 'debit', p_order: order.id, p_note: `Livraison ${label} (abonnement)`,
  });

  await supabaseAdmin.from('subscriptions').update({ last_delivery: todayStr, updated_at: new Date().toISOString() })
    .eq('user_id', userId).eq('frequency', frequency);

  // Emails : bordereau préparateurs + confirmation client
  const emailItems = lines.map(l => ({
    product_id: l.p.id, quantity: l.qty, price: l.p.price,
    product_name: l.p.name, product_unit: l.p.unit, product_farm: l.p.farm,
  }));
  try {
    const { data: preparers } = await supabaseAdmin.from('preparers').select('email').eq('is_active', true);
    const prepEmails = (preparers || []).map((p: any) => p.email).filter(Boolean);
    if (prepEmails.length) await sendPrepSlipToPreparers(order, emailItems, prepEmails);
    if (email) await sendOrderConfirmation(order, emailItems, email);
  } catch {}

  // Push livraison
  try {
    const { sendPushToUser } = await import('../../../../lib/push');
    await sendPushToUser(userId, { title: `📦 Livraison ${label}`, body: `Commande #${String(order.id)} en préparation — ${Number(total).toLocaleString('fr-FR')} Fdj`, url: '/profile' });
  } catch {}

  return { ordered: order.id, total };
}
