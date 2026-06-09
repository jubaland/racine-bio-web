import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requirePerm } from '../../../../lib/admin-auth';

// Projection des livraisons d'abonnement des 7 prochains jours (sans créer de commandes).
// Rejoue la logique du cron : jour de livraison + fréquence + validité.

function daysBetween(fromStr: string, toStr: string): number {
  const a = new Date(fromStr + 'T00:00:00Z').getTime();
  const b = new Date(toStr + 'T00:00:00Z').getTime();
  return Math.round((b - a) / 86400000);
}

function isDue(frequency: string, lastDelivery: string | null, dayStr: string): boolean {
  if (!lastDelivery) return true;
  if (frequency === 'weekly') return true;
  if (frequency === 'fortnightly') return daysBetween(lastDelivery, dayStr) >= 14;
  if (frequency === 'monthly') {
    const last = new Date(lastDelivery + 'T00:00:00Z');
    const day = new Date(dayStr + 'T00:00:00Z');
    return last.getUTCFullYear() !== day.getUTCFullYear() || last.getUTCMonth() !== day.getUTCMonth();
  }
  return false;
}

export async function GET(request: Request) {
  const auth = await requirePerm(request, 'forecast', 'view');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  // Abonnements éligibles (actifs, non suspendus)
  const { data: subs, error } = await supabaseAdmin
    .from('subscriptions')
    .select('user_id, frequency, delivery_day, last_delivery, valid_until, delivery_fee')
    .eq('active', true).eq('paused', false);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const { data: items } = await supabaseAdmin
    .from('subscription_items').select('user_id, frequency, product_id, quantity');

  const productIds = [...new Set((items || []).map((i: any) => i.product_id))];
  const { data: prods } = productIds.length
    ? await supabaseAdmin.from('products').select('id, name, unit, price, stock_qty, status').in('id', productIds)
    : { data: [] as any[] };
  const pmap: Record<number, any> = Object.fromEntries((prods || []).map((p: any) => [p.id, p]));

  const { data: wallets } = await supabaseAdmin.from('wallets').select('user_id, balance');
  const balanceMap: Record<string, number> = {};
  (wallets || []).forEach((w: any) => { balanceMap[w.user_id] = Number(w.balance) || 0; });

  const userIds = [...new Set((subs || []).map((s: any) => s.user_id))];
  const info: Record<string, { name: string | null; email: string | null }> = {};
  await Promise.all(userIds.map(async (id) => {
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(id);
    info[id] = { name: u?.user?.user_metadata?.full_name ?? null, email: u?.user?.email ?? null };
  }));

  // Panier livrable par (user, frequency) — produits publiés uniquement (comme le cron)
  const basketByKey: Record<string, { product_id: number; name: string; unit: string; price: number; quantity: number }[]> = {};
  (items || []).forEach((it: any) => {
    const p = pmap[it.product_id];
    if (!p || p.status !== 'published') return;
    const key = `${it.user_id}|${it.frequency}`;
    (basketByKey[key] ||= []).push({
      product_id: it.product_id, name: p.name, unit: p.unit ?? '', price: Number(p.price) || 0, quantity: Number(it.quantity),
    });
  });

  // Fenêtre 7 jours glissants (UTC, comme le cron)
  const now = new Date();
  const days: { date: string; dow: number; deliveries: any[] }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() + i);
    days.push({ date: d.toISOString().slice(0, 10), dow: d.getUTCDay(), deliveries: [] });
  }

  // Agrégat hebdo par produit
  const agg: Record<number, { product_id: number; name: string; unit: string; quantity: number; stock: number }> = {};

  for (const s of (subs || [])) {
    const key = `${s.user_id}|${s.frequency}`;
    const basket = basketByKey[key] || [];
    if (!basket.length) continue;

    // Un abonnement ne peut tomber qu'une fois dans une fenêtre de 7 jours (un seul jour = son delivery_day)
    const slot = days.find(day => day.dow === s.delivery_day);
    if (!slot) continue;
    if (s.valid_until && slot.date > s.valid_until) continue;       // expiré ce jour-là
    if (!isDue(s.frequency, s.last_delivery, slot.date)) continue;  // pas dû selon la fréquence

    const itemsTotal = basket.reduce((sum, b) => sum + b.price * b.quantity, 0);
    slot.deliveries.push({
      user_id: s.user_id,
      name: info[s.user_id]?.name ?? null,
      email: info[s.user_id]?.email ?? null,
      frequency: s.frequency,
      items: basket,
      itemsTotal,
      rawFee: Number(s.delivery_fee) || 0,
      balance: balanceMap[s.user_id] ?? 0,
    });

    // Agrégat (on prévoit les quantités demandées, non plafonnées au stock)
    for (const b of basket) {
      const a = (agg[b.product_id] ||= { product_id: b.product_id, name: b.name, unit: b.unit, quantity: 0, stock: Number(pmap[b.product_id]?.stock_qty) || 0 });
      a.quantity += b.quantity;
    }
  }

  // Frais de transport : une seule fois par client et par jour (comme le cron).
  for (const day of days) {
    const maxFeeByUser: Record<string, number> = {};
    for (const d of day.deliveries) maxFeeByUser[d.user_id] = Math.max(maxFeeByUser[d.user_id] || 0, d.rawFee);
    const charged = new Set<string>();
    for (const d of day.deliveries) {
      const appliedFee = charged.has(d.user_id) ? 0 : (maxFeeByUser[d.user_id] || 0);
      if (appliedFee > 0) charged.add(d.user_id);
      d.fee = appliedFee;
      d.total = d.itemsTotal + appliedFee;
      d.insufficient = d.total > d.balance;
      delete d.itemsTotal; delete d.rawFee;
    }
  }

  const aggregate = Object.values(agg)
    .map(a => ({ ...a, shortfall: Math.max(0, a.quantity - a.stock) }))
    .sort((x, y) => y.quantity - x.quantity);

  const totalDeliveries = days.reduce((n, d) => n + d.deliveries.length, 0);

  return NextResponse.json({ from: days[0].date, to: days[6].date, totalDeliveries, days, aggregate });
}
