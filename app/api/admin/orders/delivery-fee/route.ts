import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase-admin';
import { requirePerm } from '../../../../../lib/admin-auth';
import { roleOf } from '../../../../../lib/permissions';
import { applyDeliveryFeeChange } from '../../../../../lib/order-edit';
import { monitored } from '../../../../../lib/monitor';

// POST { order_id, fee?, option_id?, reason? } — modification des frais de livraison d'une commande
// par l'admin ou un gestionnaire. option_id : applique le tarif et le nom d'une option réelle ;
// fee : montant libre (0 = offerte). Garde-fous et journal dans lib/order-edit.ts.
async function POST_(request: Request) {
  const auth = await requirePerm(request, 'orders', 'edit');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let order_id: any, fee: any, option_id: any, reason: any;
  try { ({ order_id, fee, option_id, reason } = await request.json()); } catch { /* ignore */ }
  if (!order_id) return NextResponse.json({ error: 'order_id requis' }, { status: 400 });

  let optionName: string | null = null;
  if (option_id != null && option_id !== '') {
    const { data: opt } = await supabaseAdmin.from('delivery_options').select('name, price').eq('id', Number(option_id)).eq('is_active', true).maybeSingle();
    if (!opt) return NextResponse.json({ error: 'delivery_option_invalid' }, { status: 400 });
    optionName = opt.name;
    fee = Number(opt.price);
  }
  const newFee = Number(fee);
  if (!Number.isFinite(newFee)) return NextResponse.json({ error: 'fee_invalid' }, { status: 400 });

  const role = roleOf(auth.user?.user_metadata);
  const r = await applyDeliveryFeeChange(order_id, Math.round(newFee), {
    reason, optionName,
    actor: { id: auth.user?.id ?? null, name: auth.user?.user_metadata?.full_name || auth.user?.email || null, role: role === 'admin' ? 'admin' : 'manager' },
  });
  if (!r.ok) return NextResponse.json({ error: r.error, available: r.available }, { status: r.status });
  return NextResponse.json(r);
}

// Surveillance : exceptions et réponses 5xx enregistrées (lib/monitor.ts)
export const POST = monitored('/api/admin/orders/delivery-fee', POST_);
