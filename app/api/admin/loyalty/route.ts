import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requirePerm } from '../../../../lib/admin-auth';
import { loyaltyStats, saveLoyaltySettings } from '../../../../lib/loyalty';
import { monitored } from '../../../../lib/monitor';

// Admin › Fidélité — GET : réglages + indicateurs + dernières récompenses ; POST : réglages.
async function GET_(request: Request) {
  const auth = await requirePerm(request, 'loyalty', 'view');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const stats = await loyaltyStats();
  const ids = [...new Set(stats.rewards.map((r: any) => r.user_id))].slice(0, 50);
  const names: Record<string, string> = {};
  await Promise.all(ids.map(async (id) => { const { data: u } = await supabaseAdmin.auth.admin.getUserById(id); names[id] = u?.user?.user_metadata?.full_name || u?.user?.email || '—'; }));
  return NextResponse.json({ ...stats, rewards: stats.rewards.slice(0, 50).map((r: any) => ({ ...r, customer: names[r.user_id] || '—' })) });
}

async function POST_(request: Request) {
  const auth = await requirePerm(request, 'loyalty', 'edit');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  let b: any = {};
  try { b = await request.json(); } catch { /* ignore */ }
  const num = (v: any) => (v === '' || v == null ? NaN : Number(v));
  const patch: any = {};
  if ('enabled' in b) patch.enabled = !!b.enabled;
  if ('orders_required' in b) { const n = Math.round(num(b.orders_required)); if (!(n >= 1 && n <= 100)) return NextResponse.json({ error: 'orders_required_invalid' }, { status: 400 }); patch.orders_required = n; }
  if ('reward_amount' in b) { const n = Math.round(num(b.reward_amount)); if (!(n >= 0 && n <= 1000000)) return NextResponse.json({ error: 'reward_amount_invalid' }, { status: 400 }); patch.reward_amount = n; }
  if ('min_order' in b) { const n = Math.round(num(b.min_order)); if (!(n >= 0 && n <= 1000000)) return NextResponse.json({ error: 'min_order_invalid' }, { status: 400 }); patch.min_order = n; }
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'rien à modifier' }, { status: 400 });
  await saveLoyaltySettings(patch);
  return NextResponse.json({ ok: true, ...(await loyaltyStats()).settings });
}

// Surveillance : exceptions et réponses 5xx enregistrées (lib/monitor.ts)
export const GET = monitored('/api/admin/loyalty', GET_);
export const POST = monitored('/api/admin/loyalty', POST_);
