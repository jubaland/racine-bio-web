import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';

// Après le dépôt d'une demande d'adhésion marchand : alerte admin (cloche + push) + accusé au demandeur.
// Le dépôt lui-même est fait par le client (RLS : e-mail du jeton). Cette route ne fait que notifier.
export async function POST(request: Request) {
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '').trim();
  if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

  const { data: req } = await supabaseAdmin.from('producer_requests').select('id, farm_name, full_name, phone, status, created_at')
    .eq('email', user.email).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!req || req.status !== 'pending') return NextResponse.json({ ok: false });
  // Anti-doublon : on ne notifie que si la demande vient d'être créée (< 2 min)
  if (Date.now() - new Date(req.created_at).getTime() > 120000) return NextResponse.json({ ok: false });

  try {
    const { sendPushToAdmin } = await import('../../../../lib/push');
    await sendPushToAdmin({ title: '🏪 Nouvelle demande d\'adhésion marchand', body: `${req.farm_name} — ${req.full_name || user.email}${req.phone ? ` · 📞 ${req.phone}` : ''}`, url: '/admin' });
  } catch { /* ignore */ }
  try {
    const { notifyUser } = await import('../../../../lib/notify');
    await notifyUser(user.id, { title: '📝 Demande d\'adhésion reçue', body: `Votre demande pour « ${req.farm_name} » est en cours d'examen. Réponse sous 48 h.`, url: '/become-producer' });
  } catch { /* ignore */ }
  return NextResponse.json({ ok: true });
}
