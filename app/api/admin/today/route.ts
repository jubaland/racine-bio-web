import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { hasPerm, canAccessAdmin } from '../../../../lib/permissions';
import { monitored } from '../../../../lib/monitor';

// Admin › tableau de bord du jour : ce qu'il y a à traiter maintenant, module par module.
// Chaque utilisateur ne voit que les éléments des modules auxquels il a accès.
// GET → { items: [{ key, module, count, amount?, level }], today: { orders, revenue }, low_threshold }
//   level : 'urgent' (à faire maintenant) | 'todo' (à traiter) | 'info' (à surveiller)

type Item = { key: string; module: string; count: number; amount?: number; level: 'urgent' | 'todo' | 'info' };

const count = async (table: string, f: (q: any) => any) => {
  const { count: n, error } = await f(supabaseAdmin.from(table).select('id', { count: 'exact', head: true }));
  if (error) throw new Error(`${table} : ${error.message}`);
  return n || 0;
};

async function GET_(request: Request) {
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '').trim();
  if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });
  const meta = user.user_metadata;
  if (!canAccessAdmin(meta)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  const can = (m: string) => hasPerm(meta, m, 'view');

  const { data: st } = await supabaseAdmin.from('app_settings').select('value_num').eq('key', 'stock.low_threshold').maybeSingle();
  const low = st?.value_num != null ? Number(st.value_num) : null;

  const items: Item[] = [];
  const add = (key: string, module: string, level: Item['level'], n: number, amount?: number) => { if (n > 0) items.push({ key, module, count: n, level, ...(amount != null ? { amount } : {}) }); };
  const jobs: Promise<void>[] = [];
  const run = (fn: () => Promise<void>) => jobs.push(fn());

  if (can('orders')) {
    run(async () => add('orders_pending', 'orders', 'urgent', await count('orders', q => q.eq('status', 'pending'))));
    run(async () => add('orders_processing', 'orders', 'todo', await count('orders', q => q.eq('status', 'processing'))));
    run(async () => add('orders_shipping', 'orders', 'info', await count('orders', q => q.eq('status', 'shipping'))));
    run(async () => add('cancel_requests', 'orders', 'urgent', await count('order_cancel_requests', q => q.eq('status', 'pending'))));
    run(async () => add('change_requests', 'orders', 'urgent', await count('order_change_requests', q => q.eq('status', 'pending'))));
  }
  if (can('refunds')) run(async () => {
    const { data } = await supabaseAdmin.from('order_refunds').select('amount').eq('status', 'pending');
    add('refunds', 'refunds', 'todo', (data || []).length, (data || []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0));
  });
  if (can('wallets')) run(async () => {
    const { data } = await supabaseAdmin.from('deposit_requests').select('amount').eq('status', 'pending');
    add('deposits', 'wallets', 'urgent', (data || []).length, (data || []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0));
  });
  if (can('merchants')) {
    run(async () => add('merchant_payments', 'merchants', 'urgent', await count('merchant_subscriptions', q => q.eq('status', 'pending_payment'))));
    run(async () => add('merchant_products', 'merchants', 'todo', await count('products', q => q.eq('status', 'pending_review'))));
    run(async () => add('merchant_requests', 'merchants', 'todo', await count('producer_requests', q => q.eq('status', 'pending'))));
    run(async () => {
      const { unsettledLines } = await import('../../../../lib/merchant-settlement');
      const lines = await unsettledLines();
      add('merchant_payouts', 'merchants', 'todo', new Set(lines.map(l => l.owner_id)).size, lines.reduce((s, l) => s + l.net, 0));
    });
  }
  if (can('companies')) {
    run(async () => add('company_requests', 'companies', 'todo', await count('companies', q => q.eq('status', 'pending'))));
    run(async () => {
      const { data } = await supabaseAdmin.from('company_deposit_requests').select('amount').eq('status', 'pending');
      add('company_deposits', 'companies', 'urgent', (data || []).length, (data || []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0));
    });
  }
  if (can('products')) {
    // Produits Hornafresh publiés, hors paniers composés (leur disponibilité dépend de leurs composants)
    run(async () => add('stock_out', 'products', 'todo', await count('products', q => q.eq('status', 'published').is('owner_id', null).eq('is_bundle', false).lte('stock_qty', 0))));
    if (low != null) run(async () => add('stock_low', 'products', 'info', await count('products', q => q.eq('status', 'published').is('owner_id', null).eq('is_bundle', false).gt('stock_qty', 0).lte('stock_qty', low))));
  }
  if (can('monitoring')) run(async () => add('errors', 'monitoring', 'urgent', await count('error_logs', q => q.is('resolved_at', null))));

  let today: { orders: number; revenue: number } | null = null;
  if (can('orders')) run(async () => {
    // Journée de Djibouti (UTC+3)
    const now = new Date(Date.now() + 3 * 3600 * 1000);
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 3 * 3600 * 1000).toISOString();
    const { data } = await supabaseAdmin.from('orders').select('total, status').gte('created_at', start);
    const kept = (data || []).filter((o: any) => o.status !== 'cancelled');
    today = { orders: kept.length, revenue: kept.reduce((s: number, o: any) => s + Number(o.total || 0), 0) };
  });

  await Promise.all(jobs);
  const order = { urgent: 0, todo: 1, info: 2 };
  items.sort((a, b) => order[a.level] - order[b.level] || b.count - a.count);
  return NextResponse.json({ items, today, low_threshold: low, generated_at: new Date().toISOString() });
}

export const GET = monitored('/api/admin/today', GET_);
