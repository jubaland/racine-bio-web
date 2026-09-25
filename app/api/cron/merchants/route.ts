import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { notifyUser } from '../../../../lib/notify';
import { sendMerchantEmail } from '../../../../lib/emails';
import { sendPushToAdmin } from '../../../../lib/push';

// Cron quotidien — abonnements marchands (voir vercel.json).
//  1. Abonnements échus  → statut `expired` + notification/e-mail au marchand (sauf renouvellement déjà enchaîné)
//  2. Rappels J-7 et J-1 → notification/e-mail au marchand (une seule fois chacun : colonnes reminder_*_sent_at)
//  3. Paiements déclarés non traités depuis ≥ 3 jours → alerte admin (une seule fois : stale_alerted_at)
//  4. Résumé admin (cloche + push) uniquement s'il s'est passé quelque chose
//  6. Paniers anti-gaspi expirés (products.bundle_ends_at dépassé) → archivés (ils sont déjà
//     invisibles et non commandables dès l'échéance : ceci n'est que de la tenue du catalogue)
// Idempotent : relancer le cron le même jour ne renvoie rien en double.
// `?dry=1` : calcule et renvoie le plan sans rien écrire ni envoyer.
//
// NB : la visibilité des produits ne dépend PAS de ce cron — merchant_is_active() (SQL) compare
// déjà ends_at à la date du jour. Le cron ne fait que la tenue des statuts et les notifications.

const STALE_DAYS = 3;
const addDays = (d: string, n: number) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const fmt = (d: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

type Sub = { id: number; user_id: string; status: string; starts_at: string | null; ends_at: string | null; amount: number; payment_method: string | null; payment_reference: string | null; created_at: string; reminder_7_sent_at: string | null; reminder_1_sent_at: string | null; expired_notified_at: string | null; stale_alerted_at: string | null };

export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const dry = new URL(request.url).searchParams.get('dry') === '1';
  const today = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('merchant_subscriptions')
    .select('id, user_id, status, starts_at, ends_at, amount, payment_method, payment_reference, created_at, reminder_7_sent_at, reminder_1_sent_at, expired_notified_at, stale_alerted_at')
    .in('status', ['active', 'pending_payment']);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const subs = (data || []) as Sub[];

  // Un marchand a-t-il une période active qui couvre l'après (renouvellement déjà enchaîné) ?
  const hasFollowUp = (s: Sub) => subs.some(o => o.user_id === s.user_id && o.id !== s.id && o.status === 'active' && (o.ends_at || '') > (s.ends_at || ''));
  const hasPendingRenewal = (s: Sub) => subs.some(o => o.user_id === s.user_id && o.id !== s.id && o.status === 'pending_payment');

  const plan = {
    expire:     subs.filter(s => s.status === 'active' && s.ends_at && s.ends_at < today),
    remind7:    subs.filter(s => s.status === 'active' && s.ends_at === addDays(today, 7) && !s.reminder_7_sent_at && !hasFollowUp(s) && !hasPendingRenewal(s)),
    remind1:    subs.filter(s => s.status === 'active' && s.ends_at === addDays(today, 1) && !s.reminder_1_sent_at && !hasFollowUp(s) && !hasPendingRenewal(s)),
    stale:      subs.filter(s => s.status === 'pending_payment' && !s.stale_alerted_at && s.created_at.slice(0, 10) <= addDays(today, -STALE_DAYS)),
  };

  // Enseignes + e-mails (une seule lecture pour tous les marchands concernés)
  const userIds = [...new Set([...plan.expire, ...plan.remind7, ...plan.remind1, ...plan.stale].map(s => s.user_id))];
  const shops: Record<string, string> = {};
  const emails: Record<string, string | null> = {};
  if (userIds.length) {
    const { data: profiles } = await supabaseAdmin.from('merchant_profiles').select('user_id, shop_name').in('user_id', userIds);
    (profiles || []).forEach((p: any) => { shops[p.user_id] = p.shop_name; });
    for (const id of userIds) {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(id);
      emails[id] = u?.user?.email || null;
      if (!shops[id]) shops[id] = u?.user?.user_metadata?.full_name || u?.user?.email || 'Marchand';
    }
  }
  const label = (s: Sub) => shops[s.user_id] || s.user_id.slice(0, 8);

  // 5. Récapitulatifs quotidiens (marchands en mode e-mail « daily ») — calculés aussi en mode à blanc
  const { buildDigests, digestHasContent } = await import('../../../../lib/merchant-digest');
  const digests = await buildDigests();
  const report = {
    date: today, dry,
    digests: digests.map(d => ({ shop: d.shop, email: d.email ? d.email.replace(/^(..)[^@]*/, '$1***') : null, since: d.since, new_orders: d.new_orders.length, delivered: d.delivered, cancelled: d.cancelled, low_stock: d.low_stock.length, due: d.due, will_send: digestHasContent(d) && !!d.email })),
    expired: plan.expire.map(s => ({ id: s.id, shop: label(s), ends_at: s.ends_at, silent: hasFollowUp(s) })),
    reminded_7: plan.remind7.map(s => ({ id: s.id, shop: label(s), ends_at: s.ends_at })),
    reminded_1: plan.remind1.map(s => ({ id: s.id, shop: label(s), ends_at: s.ends_at })),
    stale_payments: plan.stale.map(s => ({ id: s.id, shop: label(s), amount: s.amount, since: s.created_at.slice(0, 10) })),
    expired_bundles: [] as { id: number; name: string }[],
    errors: [] as string[],
  };
  const { data: expiredBundles } = await supabaseAdmin.from('products').select('id, name')
    .eq('is_bundle', true).eq('status', 'published').not('bundle_ends_at', 'is', null).lt('bundle_ends_at', nowIso);
  report.expired_bundles = (expiredBundles || []).map((b: any) => ({ id: b.id, name: b.name }));
  if (dry) return NextResponse.json(report);

  const merchantNotify = async (s: Sub, title: string, text: string, subject: string) => {
    try { await notifyUser(s.user_id, { title, body: text, url: '/producer/subscription' }); } catch (e: any) { report.errors.push(`notify ${s.id}: ${e.message}`); }
    const to = emails[s.user_id];
    if (to) { try { await sendMerchantEmail(to, subject, title, text); } catch (e: any) { report.errors.push(`email ${s.id}: ${e.message}`); } }
  };

  // 1. Expirations
  for (const s of plan.expire) {
    const { error: e } = await supabaseAdmin.from('merchant_subscriptions').update({ status: 'expired', expired_notified_at: nowIso }).eq('id', s.id).eq('status', 'active');
    if (e) { report.errors.push(`expire ${s.id}: ${e.message}`); continue; }
    if (hasFollowUp(s)) continue; // renouvellement déjà actif : bascule silencieuse
    await merchantNotify(s, '🔒 Abonnement expiré',
      `Votre abonnement Hornafresh a pris fin le ${fmt(s.ends_at)}. Vos produits ne sont plus visibles sur le site. Renouvelez-le depuis « Mon abonnement » pour les réafficher.`,
      'Votre abonnement Hornafresh a expiré');
  }

  // 2. Rappels
  for (const s of plan.remind7) {
    const { error: e } = await supabaseAdmin.from('merchant_subscriptions').update({ reminder_7_sent_at: nowIso }).eq('id', s.id).is('reminder_7_sent_at', null);
    if (e) { report.errors.push(`remind7 ${s.id}: ${e.message}`); continue; }
    await merchantNotify(s, '⏳ Abonnement : 7 jours restants',
      `Votre abonnement Hornafresh expire le ${fmt(s.ends_at)}. Renouvelez-le dès maintenant depuis « Mon abonnement » : la nouvelle période s'enchaînera sans interruption.`,
      'Votre abonnement Hornafresh expire dans 7 jours');
  }
  for (const s of plan.remind1) {
    const { error: e } = await supabaseAdmin.from('merchant_subscriptions').update({ reminder_1_sent_at: nowIso }).eq('id', s.id).is('reminder_1_sent_at', null);
    if (e) { report.errors.push(`remind1 ${s.id}: ${e.message}`); continue; }
    await merchantNotify(s, '⚠️ Abonnement : dernier jour demain',
      `Votre abonnement Hornafresh expire demain (${fmt(s.ends_at)}). Sans renouvellement, vos produits seront masqués du site après cette date.`,
      'Votre abonnement Hornafresh expire demain');
  }

  // 3. Paiements déclarés non traités
  for (const s of plan.stale) {
    const { error: e } = await supabaseAdmin.from('merchant_subscriptions').update({ stale_alerted_at: nowIso }).eq('id', s.id).is('stale_alerted_at', null);
    if (e) report.errors.push(`stale ${s.id}: ${e.message}`);
  }

  // 5. Envoi des récapitulatifs (une fois : digest_sent_at avance même sans contenu, pour borner la période)
  for (const d of digests) {
    try {
      if (digestHasContent(d) && d.email) {
        const { sendMerchantDigest } = await import('../../../../lib/emails');
        await sendMerchantDigest(d.email, d);
      }
      await supabaseAdmin.from('merchant_profiles').update({ digest_sent_at: nowIso }).eq('user_id', d.user_id);
    } catch (e: any) { report.errors.push(`digest ${d.shop}: ${e.message}`); }
  }

  // 6. Paniers anti-gaspi expirés → archivés
  for (const b of report.expired_bundles) {
    const { error: e } = await supabaseAdmin.from('products').update({ status: 'archived' }).eq('id', b.id).eq('status', 'published');
    if (e) report.errors.push(`bundle ${b.id}: ${e.message}`);
  }

  // 4. Résumé admin
  const lines: string[] = [];
  if (report.expired_bundles.length) lines.push(`${report.expired_bundles.length} panier(s) anti-gaspi archivé(s) : ${report.expired_bundles.map(b => b.name).join(', ')}`);
  const loud = report.expired.filter(x => !x.silent);
  if (loud.length) lines.push(`${loud.length} abonnement(s) expiré(s) : ${loud.map(x => x.shop).join(', ')}`);
  if (report.reminded_7.length) lines.push(`J-7 : ${report.reminded_7.map(x => x.shop).join(', ')}`);
  if (report.reminded_1.length) lines.push(`J-1 : ${report.reminded_1.map(x => x.shop).join(', ')}`);
  if (report.stale_payments.length) lines.push(`${report.stale_payments.length} paiement(s) déclaré(s) à confirmer depuis ≥ ${STALE_DAYS} j : ${report.stale_payments.map(x => `${x.shop} (${Number(x.amount).toLocaleString('fr-FR')} Fdj)`).join(', ')}`);
  if (report.errors.length) lines.push(`⚠️ ${report.errors.length} erreur(s)`);
  if (lines.length) {
    try { await sendPushToAdmin({ title: '🏪 Marchands — point du jour', body: lines.join(' · '), url: '/admin' }); }
    catch (e: any) { report.errors.push(`admin push: ${e.message}`); }
  }

  return NextResponse.json(report);
}
