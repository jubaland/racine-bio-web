import { NextResponse } from 'next/server';
import { requirePerm } from '../../../../../lib/admin-auth';
import { roleOf } from '../../../../../lib/permissions';
import { applyItemChange } from '../../../../../lib/order-edit';
import { monitored } from '../../../../../lib/monitor';

// POST { order_id, item_id, new_quantity?, reason? } — modification directe d'une ligne par
// l'admin ou un gestionnaire : retrait (new_quantity 0/absent), réduction ou augmentation,
// quel que soit le statut de la commande (sauf annulée). Garde-fous dans lib/order-edit.ts :
// motif obligatoire après expédition, journal order_edits, alerte admin si gestionnaire.
async function POST_(request: Request) {
  const auth = await requirePerm(request, 'orders', 'edit');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let order_id: any, item_id: any, new_quantity: any, reason: any;
  try { ({ order_id, item_id, new_quantity, reason } = await request.json()); } catch { /* ignore */ }
  if (!order_id || !item_id) return NextResponse.json({ error: 'order_id et item_id requis' }, { status: 400 });

  const role = roleOf(auth.user?.user_metadata);
  const r = await applyItemChange(order_id, item_id, new_quantity ?? null, {
    anyStatus: true,
    reason,
    actor: { id: auth.user?.id ?? null, name: auth.user?.user_metadata?.full_name || auth.user?.email || null, role: role === 'admin' ? 'admin' : 'manager' },
  });
  if (!r.ok) return NextResponse.json({ error: r.error, available: r.available }, { status: r.status });
  return NextResponse.json(r);
}

// Surveillance : exceptions et réponses 5xx enregistrées (lib/monitor.ts)
export const POST = monitored('/api/admin/orders/remove-item', POST_);
