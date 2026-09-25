import { NextResponse } from 'next/server';
import { requireMerchant } from '../../../../lib/producer-auth';
import { unsettledLines, payoutHistory } from '../../../../lib/merchant-settlement';

// Espace marchand — « Mes reversements » : lignes livrées en attente de reversement + historique
export async function GET(request: Request) {
  const auth = await requireMerchant(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const [lines, payouts] = await Promise.all([unsettledLines(auth.user.id), payoutHistory(auth.user.id)]);
  return NextResponse.json({
    due: lines.reduce((s, l) => s + l.total, 0),
    lines: lines.map(({ owner_id, shop, ...l }) => l),
    payouts,
    total_paid: payouts.reduce((s: number, p: any) => s + Number(p.amount), 0),
  });
}
