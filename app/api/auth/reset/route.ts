import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { sendPasswordReset } from '../../../../lib/emails';

// Réinitialisation de mot de passe : génère le lien côté serveur et envoie un
// e-mail localisé (Resend) dans la langue de l'utilisateur.
// Réponse toujours générique (anti-énumération des comptes).
export async function POST(request: Request) {
  try {
    const { email, lang, origin } = await request.json();
    const addr = String(email || '').trim().toLowerCase();
    if (!addr) return NextResponse.json({ ok: true });

    const base = String(origin || 'https://hornafresh.com').replace(/\/$/, '');
    const redirectTo = `${base}/reset-password`;

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: addr,
      options: { redirectTo },
    });

    const link = (data as any)?.properties?.action_link;
    if (error || !link) {
      // Compte inexistant ou autre — on ne révèle rien
      return NextResponse.json({ ok: true });
    }

    try { await sendPasswordReset(addr, link, String(lang || 'fr')); }
    catch (e) { console.error('[reset] email error:', e); }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: true });
  }
}
