import { monitored } from '../../../lib/monitor';
import { verifyUnsubscribeToken } from '../../../lib/unsubscribe';
import { unsubscribeMarketing } from '../../../lib/notify';
import { mailer } from '../../../lib/i18n-server';

// GET ?t=<jeton>[&lang=…] — lien « Ne plus recevoir les annonces » des e-mails d'annonce.
// Un clic suffit : la préférence « Offres et promotions » du compte passe à non. Les e-mails de
// commande continuent. Page de confirmation dans la langue du client.
const page = (title: string, text: string, lang: string, ok: boolean) => `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;background:#faf7e8;font-family:Arial,sans-serif;"><div style="max-width:480px;margin:48px auto;background:#fff;border:1px solid #d2e095;border-radius:24px;padding:32px;text-align:center;">
<p style="font-size:40px;margin:0 0 8px;">${ok ? '✅' : '⚠️'}</p><h1 style="font-size:20px;color:#1f2937;margin:0 0 12px;">${title}</h1><p style="color:#4b5563;font-size:15px;line-height:1.6;margin:0 0 24px;">${text}</p>
<a href="https://www.hornafresh.com/" style="display:inline-block;background:#a8c800;color:#fff;text-decoration:none;padding:12px 26px;border-radius:9999px;font-weight:bold;">Hornafresh</a></div></body></html>`;

async function GET_(request: Request) {
  const q = new URL(request.url).searchParams;
  const lang = q.get('lang') || 'fr';
  const M = await mailer(lang); const m = M.m;
  const userId = verifyUnsubscribeToken(q.get('t'));
  const headers = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' };
  if (!userId) return new Response(page(m('unsub_bad_title', 'Lien invalide'), m('unsub_bad_text', 'Ce lien de désabonnement n\'est pas valide. Vous pouvez gérer vos préférences dans votre profil, rubrique Réglages.'), M.lang, false), { status: 400, headers });
  const done = await unsubscribeMarketing(userId);
  if (!done) return new Response(page(m('unsub_bad_title', 'Lien invalide'), m('unsub_bad_text', 'Ce lien de désabonnement n\'est pas valide. Vous pouvez gérer vos préférences dans votre profil, rubrique Réglages.'), M.lang, false), { status: 404, headers });
  return new Response(page(m('unsub_ok_title', 'Vous ne recevrez plus les annonces'), m('unsub_ok_text', 'C\'est noté. Vous continuerez à recevoir les e-mails concernant vos commandes. Pour réactiver les annonces, ouvrez votre profil, rubrique Réglages, puis Notifications.'), M.lang, true), { headers });
}

export const GET = monitored('/api/unsubscribe', GET_);
