import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase-admin';
import { requirePerm } from '../../../../../lib/admin-auth';
import { roleOf } from '../../../../../lib/permissions';
import { executeCancellation } from '../../../../../lib/order-cancel';
import { notifyUser } from '../../../../../lib/notify';

// POST { request_id, action: 'approve' | 'reject' } — validation ADMIN uniquement.
export async function POST(request: Request) {
  const auth = await requirePerm(request, 'orders', 'edit');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  // Seul un administrateur peut valider une annulation (pas un gestionnaire).
  if (roleOf(auth.user?.user_metadata) !== 'admin') {
    return NextResponse.json({ error: 'admin_only' }, { status: 403 });
  }

  let request_id: any, action: any;
  try { ({ request_id, action } = await request.json()); } catch { /* ignore */ }
  if (!request_id || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });
  }

  const { data: req } = await supabaseAdmin
    .from('order_cancel_requests').select('*').eq('id', request_id).maybeSingle();
  if (!req) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 });
  if (req.status !== 'pending') return NextResponse.json({ error: 'already_resolved' }, { status: 409 });

  const shortId = String(req.order_id).slice(0, 8).toUpperCase();

  if (action === 'approve') {
    const r = await executeCancellation(req.order_id); // marque aussi la demande 'approved'
    if (!r.ok) return NextResponse.json({ error: r.error || 'Erreur' }, { status: 400 });
    if (req.requested_by) {
      try {
        await notifyUser(req.requested_by, {
          title: `✅ Annulation validée — #${shortId}`,
          body: 'Votre demande d\'annulation a été validée. La commande est annulée et le remboursement traité.',
          url: '/admin',
        });
      } catch { /* ignore */ }
    }
    return NextResponse.json({ ok: true, status: 'approved' });
  }

  // Refus
  await supabaseAdmin.from('order_cancel_requests')
    .update({ status: 'rejected', resolved_at: new Date().toISOString() })
    .eq('id', request_id).eq('status', 'pending');
  if (req.requested_by) {
    try {
      await notifyUser(req.requested_by, {
        title: `🚫 Annulation refusée — #${shortId}`,
        body: 'Votre demande d\'annulation n\'a pas été validée. La commande reste active.',
        url: '/admin',
      });
    } catch { /* ignore */ }
  }
  return NextResponse.json({ ok: true, status: 'rejected' });
}
