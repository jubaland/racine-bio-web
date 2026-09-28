import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-admin';
import { commissionSettings } from '../../../lib/merchant-formula';

// Offre marchande publique (page « Devenir marchand ») : plans d'abonnement proposés et formule
// commission (proposée ou non, taux général). Tout vient des réglages admin › Marchands › Plans.
export const dynamic = 'force-dynamic';

export async function GET() {
  const [{ data: plans }, commission] = await Promise.all([
    supabaseAdmin.from('merchant_plans').select('id, name, price_fdj, duration_days').eq('is_active', true).order('price_fdj'),
    commissionSettings(),
  ]);
  return NextResponse.json({
    plans: plans || [],
    commission: { available: commission.enabled, rate: commission.enabled ? commission.rate : null },
  });
}
