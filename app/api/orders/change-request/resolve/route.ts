import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase-admin';
import { requirePerm } from '../../../../../lib/admin-auth';
import { applyItemChange } from '../../../../../lib/order-edit';
import { notifyUser } from '../../../../../lib/notify';
import { monitored } from '../../../../../lib/monitor';

// POST { request_id, action: 'approve' | 'reject' } — l'admin valide/refuse une demande.
async function POST_(request: Request) {
  const auth = await requirePerm(request, 'orders', 'edit');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let request_id: any, action: any;
  try { ({ request_id, action } = await request.json()); } catch { /* ignore */ }
  if (!request_id || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });
  }

  const { data: req } = await supabaseAdmin
    .from('order_change_requests').select('*').eq('id', request_id).maybeSingle();
  if (!req) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 });
  if (req.status !== 'pending') return NextResponse.json({ error: 'already_resolved' }, { status: 409 });

  const shortId = String(req.order_id).slice(0, 8).toUpperCase();
  const name = req.product_name || 'article';

  if (action === 'approve') {
    // Exécute la modification réelle (stock, total, remboursement, notif, bordereau)
    const r = await applyItemChange(req.order_id, req.item_id, req.new_quantity);
    if (!r.ok) {
      // Échec (commande verrouillée, dernier article…) : on laisse la demande en attente
      return NextResponse.json({ error: r.error }, { status: r.status });
    }
    await supabaseAdmin.from('order_change_requests')
      .update({ status: 'approved', resolved_at: new Date().toISOString() })
      .eq('id', request_id);
    // applyItemChange a déjà notifié le client du détail + remboursement
    return NextResponse.json(r);
  }

  // Refus
  await supabaseAdmin.from('order_change_requests')
    .update({ status: 'rejected', resolved_at: new Date().toISOString() })
    .eq('id', request_id);
  if (req.user_id) {
    try {
      await notifyUser(req.user_id, {
        title: `🧾 Demande refusée — Commande #${shortId}`,
        body: `Votre demande concernant « ${name} » n'a pas été acceptée. Contactez-nous pour en savoir plus.`,
        url: '/profile',
        i18n: { key: 'change.rejected', params: { id: shortId, name } },
      });
    } catch { /* ignore */ }
  }
  return NextResponse.json({ ok: true });
}

// Surveillance : exceptions et réponses 5xx enregistrées (lib/monitor.ts)
export const POST = monitored('/api/orders/change-request/resolve', POST_);
