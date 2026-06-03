import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-admin';
import { createClient } from '@supabase/supabase-js';

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
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data: { user } } = await supabase.auth.getUser(token);
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
