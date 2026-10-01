import { NextResponse } from 'next/server';
import { requirePerm } from '../../../../lib/admin-auth';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { cleanLang, localize, type I18n } from '../../../../lib/i18n-server';
import * as E from '../../../../lib/emails';
import { monitored } from '../../../../lib/monitor';

// Aperçu des e-mails dans une langue, avec des données d'exemple. RIEN n'est envoyé.
//   GET ?kind=<type>&lang=<fr|en|zh|am|so>[&format=html]
//   kind : order | status_processing | status_shipping | status_delivered | status_cancelled | topup |
//          paused | remind_missing | remind_empty | resumed | expired | digest | merchant:<clé srv.m.* ou srv.c.*>
//   format=html : renvoie la page de l'e-mail (à ouvrir dans le navigateur) ; sinon JSON { subject, html }.

const ORDER = {
  id: 1234, created_at: '2026-09-28T09:30:00Z', total: 3500, delivery_fee: 500, delivery_option_name: 'Standard',
  payment_method: 'waafi', customer_name: 'Amina Example', phone: '77 00 00 00', address: 'Quartier 7, Djibouti', special_instructions: null,
};
const ITEMS = [
  { product_id: 1, product_name: 'Tomate', product_unit: ' / kg', price: 200, quantity: 5 },
  { product_id: 2, product_name: 'Orange', product_unit: ' / kg', price: 400, quantity: 5 },
];
const MERCHANT_PARAMS = {
  plan: 'Mensuel', from: { date: '2026-10-01' }, to: { date: '2026-10-30' }, date: { date: '2026-10-30' }, n: 7, rate: 10, note: '', name: 'Tomate',
  shop: 'Boutique Exemple', id: 1234, lines: '5 kg Tomate, 2 kg Orange', amount: '5 000 Fdj', total: '5 000 Fdj', balance: '12 000 Fdj', missing: '2 000 Fdj',
  company: 'Société Exemple', who: 'Amina', site: 'Siège', rating: 5, comment: '', label: { key: 'freq.weekly', fr: 'hebdomadaire' },
};

async function GET_(request: Request) {
  const auth = await requirePerm(request, ['emails', 'announcements', 'merchants', 'orders'], 'view');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const q = new URL(request.url).searchParams;
  if (q.get('list')) {
    // Catalogue : e-mails clients (fixes) + messages marchands et entreprise qui ont un objet d'e-mail
    const { data } = await supabaseAdmin.from('ui_translations').select('key').eq('language_code', 'en').or('key.like.srv.m.%.subject,key.like.srv.c.%.subject').order('key');
    const msgs = (data || []).map((r: any) => r.key.replace(/^srv\./, '').replace(/\.subject$/, ''));
    return NextResponse.json({ kinds: [
      ...['announcement', 'order', 'status_processing', 'status_shipping', 'status_delivered', 'status_cancelled', 'topup', 'paused', 'remind_missing', 'remind_empty', 'resumed', 'expired'].map(id => ({ id, group: 'customer' })),
      { id: 'digest', group: 'merchant' },
      ...msgs.map((k: string) => ({ id: `merchant:${k}`, group: k.startsWith('c.') ? 'company' : 'merchant' })),
    ] });
  }
  const lang = cleanLang(q.get('lang')) || 'fr';
  const kind = q.get('kind') || 'order';
  const to = 'apercu@example.com';
  const label = { key: 'freq.weekly', fr: 'hebdomadaire' };

  const run = async () => {
    if (kind === 'order') return E.sendOrderConfirmation(ORDER, ITEMS, to, lang);
    if (kind === 'announcement') return E.sendAnnouncementEmail(to, { title: '🍊 Oranges bio : nouvel arrivage !', body: 'Fraîchement récoltées, elles sont de retour en rayon. Commandez dès maintenant, quantité limitée.', url: '/product/15', unsubscribeUrl: 'https://www.hornafresh.com/api/unsubscribe?t=exemple' }, lang);
    if (kind.startsWith('status_')) return E.sendStatusUpdate({ ...ORDER, status: kind.slice(7) }, to, lang);
    if (kind === 'topup') return E.sendDepositApproved(to, 5000, 12000, lang);
    if (kind === 'paused') return E.sendSubscriptionPaused(to, 3500, 1500, lang);
    if (kind === 'remind_missing' || kind === 'remind_empty') return E.sendSubscriptionReminder(to,
      { label: 'hebdomadaire', dateStr: 'mardi 29 septembre', total: 3500, balance: 1500, missing: 2000, stockNote: 'Indisponible(s) demain, omis : Papaye.', empty: kind === 'remind_empty' },
      { lang, labelParam: label, dateIso: '2026-09-29', noteParam: { key: 'restock.note_omitted', params: { list: 'Papaye' }, fr: 'Indisponible(s) demain, omis : Papaye.' } });
    if (kind === 'resumed') return E.sendSubscriptionResumed(to, 'hebdomadaire', 'mardi 29 septembre', 3500, { lang, labelParam: label, dateIso: '2026-09-29' });
    if (kind === 'expired') return E.sendSubscriptionExpired(to, 'hebdomadaire', { lang, labelParam: label });
    if (kind === 'digest') return E.sendMerchantDigest(to, {
      shop: 'Boutique Exemple', new_orders: [{ id: 1234, status: 'processing', customer: 'Amina', lines: ['5 kg Tomate'], amount: 1000 }],
      delivered: 1, cancelled: 0, amount_new: 1000, low_stock: [{ name: 'Orange', stock: 0, unit: 'kg' }, { name: 'Tomate', stock: 3, unit: 'kg' }], due: 900, sub_days_left: null, commission_rate: 10,
    }, lang);
    if (kind.startsWith('merchant:')) {
      const i18n: I18n = { key: kind.slice(9), params: MERCHANT_PARAMS };
      const fr = { title: `[${i18n.key}]`, body: '(texte français fourni par le code au moment de l\'envoi)', subject: `[${i18n.key}]` };
      const t = await localize(i18n, lang, fr);
      return E.sendMerchantEmail(to, t.subject || fr.subject, t.title, t.body || '', lang);
    }
    throw new Error('kind inconnu');
  };

  try {
    const mails = await E.previewEmails(run);
    if (!mails.length) return NextResponse.json({ error: 'aucun e-mail produit' }, { status: 400 });
    const m = mails[0];
    if (q.get('format') === 'html') return new NextResponse(m.html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    return NextResponse.json({ kind, lang, subject: m.subject, html: m.html, sent: false });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

// Surveillance : exceptions et réponses 5xx enregistrées (lib/monitor.ts)
export const GET = monitored('/api/admin/email-preview', GET_);
