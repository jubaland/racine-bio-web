import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requirePerm } from '../../../../lib/admin-auth';
import { loyaltyStats, saveLoyaltySettings, remindCard } from '../../../../lib/loyalty';
import { monitored } from '../../../../lib/monitor';

// Admin › Fidélité — GET : réglages + indicateurs + dernières récompenses ; POST : réglages.
async function GET_(request: Request) {
  const auth = await requirePerm(request, 'loyalty', 'view');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const stats = await loyaltyStats();
  const ids = [...new Set([...stats.rewards.slice(0, 50).map((r: any) => r.user_id), ...stats.cards.slice(0, 200).map(c => c.user_id)])];
  const names: Record<string, string> = {};
  const phones: Record<string, string | null> = {};
  await Promise.all(ids.map(async (id) => { const { data: u } = await supabaseAdmin.auth.admin.getUserById(id); names[id] = u?.user?.user_metadata?.full_name || u?.user?.email || '—'; phones[id] = u?.user?.user_metadata?.phone || null; }));
  return NextResponse.json({
    ...stats,
    rewards: stats.rewards.slice(0, 50).map((r: any) => ({ ...r, customer: names[r.user_id] || '—' })),
    cards: stats.cards.slice(0, 200).map(c => ({ ...c, customer: names[c.user_id] || '—', phone: phones[c.user_id] })),
  });
}

async function POST_(request: Request) {
  const auth = await requirePerm(request, 'loyalty', 'edit');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  let b: any = {};
  try { b = await request.json(); } catch { /* ignore */ }
  // Relance d'un client : « plus que N commandes avant la récompense »
  if (b.action === 'remind') {
    if (!b.user_id) return NextResponse.json({ error: 'user_required' }, { status: 400 });
    return NextResponse.json({ ok: true, ...(await remindCard(String(b.user_id))) });
  }
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
