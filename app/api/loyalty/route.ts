import { NextResponse } from 'next/server';
import { userFromRequest } from '../../../lib/company';
import { loyaltyCard } from '../../../lib/loyalty';
import { monitored } from '../../../lib/monitor';

// Carte de fidélité du client connecté.
async function GET_(request: Request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json(await loyaltyCard(user.id));
}

// Surveillance : exceptions et réponses 5xx enregistrées (lib/monitor.ts)
export const GET = monitored('/api/loyalty', GET_);
