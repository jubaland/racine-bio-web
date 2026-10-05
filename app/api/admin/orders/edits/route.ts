import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase-admin';
import { requirePerm } from '../../../../../lib/admin-auth';
import { roleOf } from '../../../../../lib/permissions';
import { monitored } from '../../../../../lib/monitor';

// GET — journal des commandes modifiées (traçabilité) : qui, quoi, quand, pourquoi, à quel statut.
// Réservé aux administrateurs : c'est l'outil de contrôle des modifications faites par les gestionnaires.
async function GET_(request: Request) {
  const auth = await requirePerm(request, 'orders', 'view');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (roleOf(auth.user?.user_metadata) !== 'admin') return NextResponse.json({ error: 'admin_only' }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from('order_edits')
    .select('id, order_id, product_name, product_unit, from_qty, to_qty, price, amount, refund_method, reason, by_name, by_role, order_status, created_at, orders ( customer_name, status, payment_method )')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ edits: data || [] });
}

// Surveillance : exceptions et réponses 5xx enregistrées (lib/monitor.ts)
export const GET = monitored('/api/admin/orders/edits', GET_);
