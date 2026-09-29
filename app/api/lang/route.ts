import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-admin';
import { cleanLang } from '../../../lib/i18n-server';
import { monitored } from '../../../lib/monitor';

// POST { lang, endpoint? } — enregistre la langue choisie par le client :
//   • sur son compte s'il est connecté (user_prefs) → cloche et notifications ;
//   • sur son appareil s'il est abonné aux notifications push (push_subscriptions.lang).
// Appelé par le navigateur au changement de langue et à la connexion. Sans effet pour un visiteur
// anonyme sans abonnement push.
async function POST_(request: Request) {
  try {
    const { lang, endpoint } = await request.json();
    const l = cleanLang(lang);
    if (!l) return NextResponse.json({ error: 'invalid_lang' }, { status: 400 });

    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    let userId: string | null = null;
    if (token) {
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      userId = user?.id || null;
    }

    if (userId) {
      const { error } = await supabaseAdmin.from('user_prefs').upsert({ user_id: userId, lang: l, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    let device = false;
    if (endpoint && typeof endpoint === 'string') {
      // L'adresse de l'abonnement est un secret connu du seul appareil : elle suffit à l'identifier
      const { data } = await supabaseAdmin.from('push_subscriptions').update({ lang: l }).eq('endpoint', endpoint).select('id');
      device = !!data?.length;
    }
    return NextResponse.json({ ok: true, lang: l, account: !!userId, device });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Surveillance : exceptions et réponses 5xx enregistrées (lib/monitor.ts)
export const POST = monitored('/api/lang', POST_);
