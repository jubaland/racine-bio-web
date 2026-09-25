import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase-admin';
import { requirePerm } from '../../../../../lib/admin-auth';
import { unsettledLines, createPayout, payoutHistory } from '../../../../../lib/merchant-settlement';

// Reversements aux marchands (Phase 2) — module admin « Marchands → Reversements »
//   GET                  → { merchants: [{ id, shop, due, lines, oldest }], payouts: [...] }
//   GET ?user_id=<uuid>  → { lines (dues), payouts } pour un marchand
//   POST { user_id, method, reference?, note? } → reversement de toutes les lignes dues du marchand

export async function GET(request: Request) {
  const auth = await requirePerm(request, 'merchants', 'view');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const userId = new URL(request.url).searchParams.get('user_id');

  if (userId) {
    const [lines, payouts] = await Promise.all([unsettledLines(userId), payoutHistory(userId)]);
    return NextResponse.json({ lines, due: lines.reduce((s, l) => s + l.total, 0), payouts });
  }

  const [lines, payouts, { data: profiles }] = await Promise.all([unsettledLines(), payoutHistory(), supabaseAdmin.from('merchant_profiles').select('user_id, shop_name')]);
  const shops: Record<string, string> = Object.fromEntries((profiles || []).map((m: any) => [m.user_id, m.shop_name]));
  const byMerchant: Record<string, { id: string; shop: string; due: number; lines: number; oldest: string | null }> = {};
  for (const l of lines) {
    const m = byMerchant[l.owner_id] ||= { id: l.owner_id, shop: l.shop, due: 0, lines: 0, oldest: null };
    m.due += l.total; m.lines += 1;
    if (!m.oldest || l.order_date < m.oldest) m.oldest = l.order_date;
  }
  // Marchands déjà reversés mais sans dû en ce moment : présents avec due 0 (historique)
  for (const p of payouts) if (!byMerchant[p.user_id]) byMerchant[p.user_id] = { id: p.user_id, shop: shops[p.user_id] || 'Marchand', due: 0, lines: 0, oldest: null };
  return NextResponse.json({
    merchants: Object.values(byMerchant).sort((a, b) => b.due - a.due),
    payouts: payouts.map((p: any) => ({ ...p, shop: shops[p.user_id] || 'Marchand' })),
    total_due: lines.reduce((s, l) => s + l.total, 0),
  });
}

export async function POST(request: Request) {
  const auth = await requirePerm(request, 'merchants', 'edit');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  let body: any = {};
  try { body = await request.json(); } catch { /* ignore */ }
  const { user_id, method, reference, note } = body;
  if (!user_id) return NextResponse.json({ error: 'user_id requis' }, { status: 400 });
  if (method === 'waafi' && !String(reference || '').trim()) return NextResponse.json({ error: 'reference_required' }, { status: 400 });
  const r = await createPayout(user_id, { method: method || 'waafi', reference: String(reference || '').trim().slice(0, 80) || null, note: String(note || '').trim().slice(0, 300) || null, created_by: auth.user.id });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error === 'nothing_due' ? 409 : 500 });
  return NextResponse.json({ ok: true, payout: r.payout });
}
