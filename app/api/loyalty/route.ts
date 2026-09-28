import { NextResponse } from 'next/server';
import { userFromRequest } from '../../../lib/company';
import { loyaltyCard } from '../../../lib/loyalty';

// Carte de fidélité du client connecté.
export async function GET(request: Request) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json(await loyaltyCard(user.id));
}
