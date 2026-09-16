import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-admin';

// GET ?endpoint= — l'abonnement est-il connu du serveur ? (auto-réparation côté client :
// un abonnement gardé par le navigateur mais absent ici a été expiré/supprimé → à renouveler)
export async function GET(request: Request) {
  const endpoint = new URL(request.url).searchParams.get('endpoint');
  if (!endpoint) return NextResponse.json({ registered: false });
  const { data } = await supabaseAdmin
    .from('push_subscriptions').select('endpoint').eq('endpoint', endpoint).maybeSingle();
  return NextResponse.json({ registered: !!data });
}

// POST — enregistre ou supprime un abonnement push
export async function POST(request: Request) {
  try {
    const { subscription, action } = await request.json();

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
      }, { onConflict: 'endpoint' });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
