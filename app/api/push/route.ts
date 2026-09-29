import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-admin';
import { cleanLang } from '../../../lib/i18n-server';
import { monitored } from '../../../lib/monitor';

// GET ?endpoint= — l'abonnement est-il connu du serveur ? (auto-réparation côté client :
// un abonnement gardé par le navigateur mais absent ici a été expiré/supprimé → à renouveler)
async function GET_(request: Request) {
  const endpoint = new URL(request.url).searchParams.get('endpoint');
  if (!endpoint) return NextResponse.json({ registered: false });
  const { data } = await supabaseAdmin
    .from('push_subscriptions').select('endpoint').eq('endpoint', endpoint).maybeSingle();
  return NextResponse.json({ registered: !!data });
}

// POST — enregistre ou supprime un abonnement push
async function POST_(request: Request) {
  try {
    const { subscription, action, lang } = await request.json();

    // Récupérer l'utilisateur depuis le JWT
    const auth = request.headers.get('Authorization');
    const token = auth?.replace('Bearer ', '');
    let userId: string | null = null;
    let isAdmin = false;

    if (token) {
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      if (user) {
        userId = user.id;
        isAdmin = user.user_metadata?.is_admin === true;
      }
    }

    if (action === 'unsubscribe') {
      await supabaseAdmin
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', subscription.endpoint);
      return NextResponse.json({ ok: true });
    }

    // Upsert l'abonnement
    await supabaseAdmin
      .from('push_subscriptions')
      .upsert({
        endpoint:  subscription.endpoint,
        p256dh:    subscription.keys.p256dh,
        auth:      subscription.keys.auth,
        user_id:   userId,
        is_admin:  isAdmin,
        ...(cleanLang(lang) ? { lang: cleanLang(lang) } : {}),   // langue de l'appareil, si le navigateur l'envoie
      }, { onConflict: 'endpoint' });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Surveillance : exceptions et réponses 5xx enregistrées (lib/monitor.ts)
export const GET = monitored('/api/push', GET_);
export const POST = monitored('/api/push', POST_);
