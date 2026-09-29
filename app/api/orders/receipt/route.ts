import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { buildReceiptPdf } from '../../../../lib/pdf';
import { monitored } from '../../../../lib/monitor';

// Reçu PDF d'une commande — réservé au propriétaire (vérif. via JWT).
async function GET_(request: Request) {
  const id = new URL(request.url).searchParams.get('id');
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '').trim();
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 });
  if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', id)
    .single();
  if (!order) return NextResponse.json({ error: 'introuvable' }, { status: 404 });
  if (order.user_id !== user.id) return NextResponse.json({ error: 'interdit' }, { status: 403 });

  const pdf = await buildReceiptPdf(order, order.order_items || []);
  const shortId = String(order.id).slice(0, 8).toUpperCase();
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="recu-${shortId}.pdf"`,
    },
  });
}

// Surveillance : exceptions et réponses 5xx enregistrées (lib/monitor.ts)
export const GET = monitored('/api/orders/receipt', GET_);
