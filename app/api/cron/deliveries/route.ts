import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { sendPrepSlipToPreparers, sendOrderConfirmation, sendSubscriptionPaused } from '../../../../lib/emails';

// Génération automatique des livraisons d'abonnement.
// Appelé chaque jour par Vercel Cron (voir vercel.json).
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
    .select('user_id, delivery_day, last_delivery')
    .eq('active', true).eq('paused', false).eq('delivery_day', dow);

  const due = (subs || []).filter(s => s.last_delivery !== todayStr);
  const results: any[] = [];
  for (const s of due) {
    try { results.push({ user: s.user_id, ...(await processOne(s.user_id, todayStr)) }); }
    catch (e: any) { results.push({ user: s.user_id, error: e.message }); }
  }
  return NextResponse.json({ date: todayStr, dow, due: due.length, results });
}

async function processOne(userId: string, todayStr: string) {
  const { data: items } = await supabaseAdmin
    .from('subscription_items').select('product_id, quantity').eq('user_id', userId);
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

  const total = lines.reduce((s, l) => s + Number(l.p.price) * l.qty, 0);

  // Solde
  const { data: w } = await supabaseAdmin.from('wallets').select('balance').eq('user_id', userId).maybeSingle();
  const balance = Number(w?.balance) || 0;

  // Contact (adresse par défaut, sinon métadonnées)
  const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
  const md = userData?.user?.user_metadata || {};
  const email = userData?.user?.email || null;

  if (balance < total) {
    await supabaseAdmin.from('subscriptions').update({ paused: true, updated_at: new Date().toISOString() }).eq('user_id', userId);
    try { if (email) await sendSubscriptionPaused(email, total, balance); } catch {}
    try {
      const { sendPushToUser } = await import('../../../../lib/push');
      await sendPushToUser(userId, { title: '⏸️ Cagnotte à recharger', body: 'Votre livraison hebdomadaire est en pause (solde insuffisant).', url: '/abonnement' });
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

  // Commande (prépayée via cagnotte, livraison offerte)
  const { data: order, error: orderErr } = await supabaseAdmin.from('orders').insert({
    user_id: userId, total, delivery_fee: 0, delivery_option_name: 'Abonnement',
    special_instructions: 'Commande automatique (abonnement hebdomadaire)',
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
    p_user: userId, p_amount: -total, p_type: 'debit', p_order: order.id, p_note: 'Livraison hebdomadaire (abonnement)',
  });

  await supabaseAdmin.from('subscriptions').update({ last_delivery: todayStr, updated_at: new Date().toISOString() }).eq('user_id', userId);

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
    await sendPushToUser(userId, { title: '📦 Livraison hebdomadaire', body: `Commande #${String(order.id)} en préparation — ${Number(total).toLocaleString('fr-FR')} Fdj`, url: '/profile' });
  } catch {}

  return { ordered: order.id, total };
}
