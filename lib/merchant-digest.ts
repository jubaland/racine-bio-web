import { supabaseAdmin } from './supabase-admin';
import { unsettledLines } from './merchant-settlement';

// Récapitulatif quotidien marchand : commandes reçues depuis le dernier envoi (ou 24 h), livraisons,
// annulations, stock bas, montant à reverser, abonnement. Envoyé par le cron marchands aux marchands
// en mode e-mail « daily » ; les autres reçoivent un e-mail à chaque commande (orders POST).

export type Digest = {
  user_id: string; email: string | null; shop: string; email_mode: string; since: string;
  new_orders: { id: number; status: string; customer: string; created_at: string; lines: string[]; amount: number }[];
  delivered: number; cancelled: number; amount_new: number;
  low_stock: { name: string; stock: number; unit: string }[];
  due: number; sub_days_left: number | null;
};

const firstName = (full: string | null) => (full || '').trim().split(/\s+/)[0] || 'Client';

export async function buildDigests(now = new Date()): Promise<Digest[]> {
  const { data: profiles } = await supabaseAdmin.from('merchant_profiles').select('user_id, shop_name, email_mode, digest_sent_at').eq('email_mode', 'daily');
  if (!profiles || !profiles.length) return [];
  const ownerIds = profiles.map((p: any) => p.user_id);
  const today = now.toISOString().slice(0, 10);
  const [{ data: prods }, { data: subs }] = await Promise.all([
    supabaseAdmin.from('products').select('id, name, unit, stock_qty, owner_id, status').in('owner_id', ownerIds),
    supabaseAdmin.from('merchant_subscriptions').select('user_id, ends_at').in('user_id', ownerIds).eq('status', 'active').gte('ends_at', today),
  ]);
  const prodByOwner: Record<string, any[]> = {};
  (prods || []).forEach((p: any) => (prodByOwner[p.owner_id] ||= []).push(p));
  const pmap: Record<number, any> = Object.fromEntries((prods || []).map((p: any) => [p.id, p]));
  const subEnd: Record<string, string> = {};
  (subs || []).forEach((s: any) => { if (!subEnd[s.user_id] || s.ends_at > subEnd[s.user_id]) subEnd[s.user_id] = s.ends_at; });

  const out: Digest[] = [];
  for (const pr of profiles as any[]) {
    const mine = prodByOwner[pr.user_id] || [];
    const since = pr.digest_sent_at ? new Date(Math.max(new Date(pr.digest_sent_at).getTime(), now.getTime() - 7 * 86400000)) : new Date(now.getTime() - 86400000);
    let new_orders: Digest['new_orders'] = [], delivered = 0, cancelled = 0, amount_new = 0;
    if (mine.length) {
      const { data: items } = await supabaseAdmin.from('order_items').select('order_id, product_id, quantity, price').in('product_id', mine.map((p: any) => p.id));
      const byOrder: Record<string, any[]> = {};
      (items || []).forEach((i: any) => (byOrder[i.order_id] ||= []).push(i));
      const ids = Object.keys(byOrder);
      if (ids.length) {
        const { data: orders } = await supabaseAdmin.from('orders').select('id, status, created_at, customer_name').in('id', ids).gte('created_at', since.toISOString()).order('created_at', { ascending: false });
        for (const o of orders || []) {
          const its = byOrder[o.id] || [];
          const amount = its.reduce((s: number, i: any) => s + Number(i.price) * i.quantity, 0);
          new_orders.push({ id: o.id, status: o.status, customer: firstName(o.customer_name), created_at: o.created_at, lines: its.map((i: any) => `${i.quantity} ${pmap[i.product_id]?.unit || ''} ${pmap[i.product_id]?.name || ''}`.replace(/\s+/g, ' ').trim()), amount });
          if (o.status === 'delivered') delivered++;
          if (o.status === 'cancelled') cancelled++; else amount_new += amount;
        }
      }
    }
    const low_stock = mine.filter((p: any) => p.status === 'published' && (p.stock_qty ?? 0) <= 5).map((p: any) => ({ name: p.name, stock: p.stock_qty ?? 0, unit: p.unit || '' }));
    const dueLines = await unsettledLines(pr.user_id);
    const due = dueLines.reduce((s, l) => s + l.total, 0);
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(pr.user_id);
    const end = subEnd[pr.user_id];
    const sub_days_left = end ? Math.ceil((new Date(end + 'T00:00:00Z').getTime() - new Date(today + 'T00:00:00Z').getTime()) / 86400000) : null;
    out.push({ user_id: pr.user_id, email: u?.user?.email || null, shop: pr.shop_name, email_mode: pr.email_mode, since: since.toISOString(), new_orders, delivered, cancelled, amount_new, low_stock, due, sub_days_left });
  }
  return out;
}

// Un récapitulatif n'est envoyé que s'il y a quelque chose à dire
export const digestHasContent = (d: Digest) => d.new_orders.length > 0 || d.low_stock.length > 0;
