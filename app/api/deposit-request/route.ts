import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-admin';
import { sendDepositRequestAlert } from '../../../lib/emails';

// Le client crée une demande de recharge (validée ensuite par l'admin).
export async function POST(request: Request) {
  try {
    const token = (request.headers.get('authorization') || '').replace('Bearer ', '').trim();
    if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

    const { amount, reference } = await request.json();
    const amt = Number(amount);
    if (!amt || amt <= 0) return NextResponse.json({ error: 'Montant invalide.' }, { status: 400 });

    const { data: req, error } = await supabaseAdmin
      .from('deposit_requests')
      .insert({ user_id: user.id, amount: amt, reference: (reference || '').toString().trim() || null })
      .select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // Notifier l'admin (email + push) — AWAITÉ (serverless : le code après return ne s'exécute pas)
    try { await sendDepositRequestAlert(req, { name: user.user_metadata?.full_name, email: user.email }); }
    catch (e) { console.error('[deposit] email error:', e); }
    try {
      const { sendPushToAdmin } = await import('../../../lib/push');
      await sendPushToAdmin({
        title: '💰 Demande de recharge',
        body: `${user.user_metadata?.full_name || user.email} — ${amt.toLocaleString('fr-FR')} Fdj`,
        url: '/admin',
      });
    } catch (e) { console.error('[deposit] push error:', e); }

    return NextResponse.json({ ok: true, request: req });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erreur serveur' }, { status: 500 });
  }
}
