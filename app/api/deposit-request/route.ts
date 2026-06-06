import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../../lib/supabase-admin';
import { sendDepositRequestAlert } from '../../../lib/emails';

// Le client crée une demande de recharge (validée ensuite par l'admin).
export async function POST(request: Request) {
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '').trim();
  if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const supaUser = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data: { user }, error: authErr } = await supaUser.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

  const { amount, reference } = await request.json();
  const amt = Number(amount);
  if (!amt || amt <= 0) return NextResponse.json({ error: 'Montant invalide.' }, { status: 400 });

  const { data: req, error } = await supabaseAdmin
    .from('deposit_requests')
    .insert({ user_id: user.id, amount: amt, reference: (reference || '').toString().trim() || null })
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Notifier l'admin (email + push) — fire and forget
  (async () => {
    try { await sendDepositRequestAlert(req, { name: user.user_metadata?.full_name, email: user.email }); } catch {}
    try {
      const { sendPushToAdmin } = await import('../../../lib/push');
      await sendPushToAdmin({
        title: '💰 Demande de recharge',
        body: `${user.user_metadata?.full_name || user.email} — ${amt.toLocaleString('fr-FR')} Fdj`,
        url: '/admin',
      });
    } catch {}
  })();

  return NextResponse.json({ ok: true, request: req });
}
