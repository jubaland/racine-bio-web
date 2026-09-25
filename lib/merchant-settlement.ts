import { supabaseAdmin } from './supabase-admin';

// Relevés et reversements marchands (Phase 2).
// Ligne due = article d'une commande LIVRÉE, produit appartenant à un marchand, non encore reversé.
// Montant dû = prix × quantité (100 % au marchand ; livraison = Hornafresh).

export type SettlementLine = {
  item_id: number; order_id: number; order_date: string; customer: string;
  product_id: number; name: string; unit: string; quantity: number; price: number; total: number;
  owner_id: string; shop: string;
};

const firstName = (full: string | null) => (full || '').trim().split(/\s+/)[0] || 'Client';

// Lignes livrées non reversées (tous marchands, ou un seul)
export async function unsettledLines(userId?: string): Promise<SettlementLine[]> {
  let pq = supabaseAdmin.from('products').select('id, name, unit, owner_id').not('owner_id', 'is', null);
  if (userId) pq = pq.eq('owner_id', userId);
  const { data: prods } = await pq;
  if (!prods || !prods.length) return [];
  const pmap: Record<number, any> = Object.fromEntries(prods.map((p: any) => [p.id, p]));
  const ownerIds = [...new Set(prods.map((p: any) => p.owner_id))];
  const { data: profiles } = await supabaseAdmin.from('merchant_profiles').select('user_id, shop_name').in('user_id', ownerIds);
  const shop: Record<string, string> = Object.fromEntries((profiles || []).map((m: any) => [m.user_id, m.shop_name]));

  const { data: items } = await supabaseAdmin
    .from('order_items').select('id, order_id, product_id, quantity, price')
    .in('product_id', prods.map((p: any) => p.id)).is('payout_id', null);
  if (!items || !items.length) return [];
  const orderIds = [...new Set(items.map((i: any) => i.order_id))];
  const orders: any[] = [];
  for (let i = 0; i < orderIds.length; i += 300) {
    const { data } = await supabaseAdmin.from('orders').select('id, status, created_at, customer_name')
      .in('id', orderIds.slice(i, i + 300)).eq('status', 'delivered');
    if (data) orders.push(...data);
  }
  const omap: Record<string, any> = Object.fromEntries(orders.map((o: any) => [o.id, o]));
  return items
    .filter((i: any) => omap[i.order_id])
    .map((i: any) => {
      const p = pmap[i.product_id]; const o = omap[i.order_id];
      return {
        item_id: i.id, order_id: i.order_id, order_date: o.created_at, customer: firstName(o.customer_name),
        product_id: i.product_id, name: p.name, unit: p.unit || '', quantity: i.quantity, price: Number(i.price),
        total: Number(i.price) * i.quantity, owner_id: p.owner_id, shop: shop[p.owner_id] || 'Marchand',
      };
    })
    .sort((a, b) => (a.order_date < b.order_date ? 1 : -1));
}

// Crée un reversement pour TOUTES les lignes dues d'un marchand (état au moment de l'appel)
export async function createPayout(userId: string, opts: { method: string; reference?: string | null; note?: string | null; created_by?: string | null }) {
  const lines = await unsettledLines(userId);
  if (!lines.length) return { ok: false as const, error: 'nothing_due' };
  const amount = lines.reduce((s, l) => s + l.total, 0);
  const dates = lines.map(l => l.order_date.slice(0, 10)).sort();
  const { data: payout, error } = await supabaseAdmin.from('merchant_payouts').insert({
    user_id: userId, amount, lines_count: lines.length,
    method: ['waafi', 'cash', 'other'].includes(opts.method) ? opts.method : 'other',
    reference: opts.reference || null, note: opts.note || null,
    period_from: dates[0], period_to: dates[dates.length - 1], created_by: opts.created_by || null,
  }).select().single();
  if (error || !payout) return { ok: false as const, error: error?.message || 'insert_failed' };

  // Marquage des lignes (uniquement celles encore non reversées : garde contre un double clic)
  const { data: marked } = await supabaseAdmin.from('order_items').update({ payout_id: payout.id })
    .in('id', lines.map(l => l.item_id)).is('payout_id', null).select('id');
  const n = (marked || []).length;
  if (n !== lines.length) {
    // Écart (course) : on recale le montant sur les lignes effectivement marquées
    const kept = new Set((marked || []).map((m: any) => m.id));
    const amt = lines.filter(l => kept.has(l.item_id)).reduce((s, l) => s + l.total, 0);
    await supabaseAdmin.from('merchant_payouts').update({ amount: amt, lines_count: n }).eq('id', payout.id);
    payout.amount = amt; payout.lines_count = n;
  }

  // Marchand prévenu : cloche + push + e-mail
  const methodLabel = payout.method === 'cash' ? 'en espèces' : payout.method === 'waafi' ? 'par Waafi' : '';
  const text = `Hornafresh vous a reversé ${Number(payout.amount).toLocaleString('fr-FR')} Fdj ${methodLabel}${payout.reference ? ` (réf. ${payout.reference})` : ''} pour ${payout.lines_count} article(s) livré(s). Le détail est dans « Mes reversements ».`;
  try {
    const { notifyUser } = await import('./notify');
    await notifyUser(userId, { title: '💸 Reversement effectué', body: text, url: '/producer/statement' });
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (u?.user?.email) {
      const { sendMerchantEmail } = await import('./emails');
      await sendMerchantEmail(u.user.email, `Reversement de ${Number(payout.amount).toLocaleString('fr-FR')} Fdj — Hornafresh`, '💸 Reversement effectué', text);
    }
  } catch (e) { console.error('[payout] notify failed:', e); }
  return { ok: true as const, payout };
}

// Historique des reversements (tous ou un marchand) avec enseigne
export async function payoutHistory(userId?: string) {
  let q = supabaseAdmin.from('merchant_payouts').select('*').order('paid_at', { ascending: false });
  if (userId) q = q.eq('user_id', userId);
  const { data } = await q;
  return data || [];
}
