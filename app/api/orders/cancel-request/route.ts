import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requirePerm } from '../../../../lib/admin-auth';

// Demandes d'annulation de commande — validées par un administrateur (/cancel-request/resolve).
// Émetteurs : un gestionnaire (via PATCH /api/orders) ou le CLIENT lui-même (POST ici).

const userFromToken = async (request: Request) => {
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '').trim();
  if (!token) return null;
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  return user || null;
};

// GET — admin / gestionnaire Commandes : demandes en attente.  GET ?mine=1 — client : ses demandes en attente.
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get('mine') === '1') {
    const user = await userFromToken(request);
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const { data } = await supabaseAdmin
      .from('order_cancel_requests').select('id, order_id, status, created_at')
      .eq('requested_by', user.id).eq('status', 'pending');
    return NextResponse.json({ requests: data || [] });
  }

  const auth = await requirePerm(request, 'orders', 'view');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data: reqs, error } = await supabaseAdmin
    .from('order_cancel_requests')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const orderIds = [...new Set((reqs || []).map((r: any) => r.order_id))];
  let orderMap: Record<string, any> = {};
  if (orderIds.length) {
    const { data: ords } = await supabaseAdmin
      .from('orders').select('id, customer_name, status, total, payment_method, user_id').in('id', orderIds);
    orderMap = Object.fromEntries((ords || []).map((o: any) => [o.id, o]));
  }
  const requests = (reqs || []).map((r: any) => {
    const order = orderMap[r.order_id] || null;
    return { ...r, order, by_customer: !!order && !!r.requested_by && order.user_id === r.requested_by };
  });
  return NextResponse.json({ requests });
}

// POST { order_id } — le CLIENT demande l'annulation complète de sa commande (validation admin).
export async function POST(request: Request) {
  const user = await userFromToken(request);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  let order_id: any;
  try { ({ order_id } = await request.json()); } catch { /* ignore */ }
  if (!order_id) return NextResponse.json({ error: 'order_id requis' }, { status: 400 });

  const { data: order } = await supabaseAdmin
    .from('orders').select('id, user_id, status, total, customer_name').eq('id', order_id).maybeSingle();
  if (!order || order.user_id !== user.id) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  // Annulable tant que la commande n'est pas partie (même règle que les modifications d'articles)
  if (!['pending', 'processing'].includes(order.status)) return NextResponse.json({ error: 'order_locked' }, { status: 409 });

  const { data: dup } = await supabaseAdmin
    .from('order_cancel_requests').select('id').eq('order_id', order_id).eq('status', 'pending').maybeSingle();
  if (dup) return NextResponse.json({ error: 'already_requested' }, { status: 409 });

  const { error } = await supabaseAdmin.from('order_cancel_requests').insert({
    order_id,
    requested_by: user.id,
    requested_by_name: user.user_metadata?.full_name || order.customer_name || user.email || null,
    status: 'pending',
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Alerte admin (cloche + push) — jamais bloquante
  try {
    const { sendPushToAdmin } = await import('../../../../lib/push');
    await sendPushToAdmin({
      title: '🛑 Demande d\'annulation (client)',
      body: `Commande #${String(order_id)} — ${order.customer_name || ''} — ${Number(order.total).toLocaleString('fr-FR')} Fdj — à valider`,
      url: '/admin',
    });
  } catch { /* ignore */ }
  return NextResponse.json({ ok: true, pending_validation: true });
}
