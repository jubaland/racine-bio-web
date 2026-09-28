import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { notifyUser } from '../../../../lib/notify';
import { sendMerchantEmail } from '../../../../lib/emails';
import { sendPushToAdmin } from '../../../../lib/push';

// Cron quotidien — abonnements marchands (voir vercel.json).
//  1. Abonnements échus  → statut `expired` + notification/e-mail au marchand (sauf renouvellement déjà enchaîné)
//  2. Premier et dernier rappel avant l'échéance → notification/e-mail au marchand (une seule fois chacun :
//     colonnes reminder_7_sent_at = premier rappel, reminder_1_sent_at = dernier rappel)
//  3. Paiements déclarés non traités depuis un certain nombre de jours → alerte admin (une fois : stale_alerted_at)
//  Les délais viennent des réglages (admin › Marchands › Plans) ; un délai non défini désactive l'étape.
//  4. Résumé admin (cloche + push) uniquement s'il s'est passé quelque chose
//  6. Paniers anti-gaspi expirés (products.bundle_ends_at dépassé) → archivés (ils sont déjà
//     invisibles et non commandables dès l'échéance : ceci n'est que de la tenue du catalogue)
// Idempotent : relancer le cron le même jour ne renvoie rien en double.
// `?dry=1` : calcule et renvoie le plan sans rien écrire ni envoyer.
// `?user=<uuid>` : restreint aux abonnements d'un marchand, sans récapitulatifs, paniers ni résumé admin (tests).
//
// Formule commission : à l'échéance d'un abonnement, un marchand qui a choisi la commission
// (bascule programmée ou formule déjà posée) y passe sans interruption ; pas de rappel de renouvellement.
//
// NB : la visibilité des produits ne dépend PAS de ce cron — merchant_is_active() (SQL) compare
// déjà ends_at à la date du jour. Le cron ne fait que la tenue des statuts et les notifications.

const addDays = (d: string, n: number) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const fmt = (d: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

type Sub = { id: number; user_id: string; status: string; starts_at: string | null; ends_at: string | null; amount: number; payment_method: string | null; payment_reference: string | null; created_at: string; reminder_7_sent_at: string | null; reminder_1_sent_at: string | null; expired_notified_at: string | null; stale_alerted_at: string | null };

export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const params = new URL(request.url).searchParams;
  const dry = params.get('dry') === '1';
  const onlyUser = params.get('user') || null;
  const today = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();

  let query = supabaseAdmin
    .from('merchant_subscriptions')
    .select('id, user_id, status, starts_at, ends_at, amount, payment_method, payment_reference, created_at, reminder_7_sent_at, reminder_1_sent_at, expired_notified_at, stale_alerted_at')
    .in('status', ['active', 'pending_payment']);
  if (onlyUser) query = query.eq('user_id', onlyUser);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const subs = (data || []) as Sub[];

  // Un marchand a-t-il une période active qui couvre l'après (renouvellement déjà enchaîné) ?
  const hasFollowUp = (s: Sub) => subs.some(o => o.user_id === s.user_id && o.id !== s.id && o.status === 'active' && (o.ends_at || '') > (s.ends_at || ''));
  const hasPendingRenewal = (s: Sub) => subs.some(o => o.user_id === s.user_id && o.id !== s.id && o.status === 'pending_payment');

  const { merchantDelays } = await import('../../../../lib/merchant-formula');
  const delays = await merchantDelays();
  const FIRST = delays.reminder_first_days, LAST = delays.reminder_last_days, STALE_DAYS = delays.stale_payment_days;

  // Marchands qui passent (ou sont déjà) en formule commission à l'échéance de leur abonnement
  const { formulasOf, switchToCommission } = await import('../../../../lib/merchant-formula');
  const formulas = await formulasOf(subs.map(s => s.user_id));
  const toCommission = (s: Sub) => { const f = formulas[s.user_id]; return !!f && (f.pending_kind === 'commission' || f.kind === 'commission'); };

  const plan = {
    expire:     subs.filter(s => s.status === 'active' && s.ends_at && s.ends_at < today),
    remind7:    FIRST == null ? [] : subs.filter(s => s.status === 'active' && s.ends_at === addDays(today, FIRST) && !s.reminder_7_sent_at && !hasFollowUp(s) && !hasPendingRenewal(s) && !toCommission(s)),
    remind1:    LAST == null ? [] : subs.filter(s => s.status === 'active' && s.ends_at === addDays(today, LAST) && !s.reminder_1_sent_at && !hasFollowUp(s) && !hasPendingRenewal(s) && !toCommission(s)),
    stale:      STALE_DAYS == null ? [] : subs.filter(s => s.status === 'pending_payment' && !s.stale_alerted_at && s.created_at.slice(0, 10) <= addDays(today, -STALE_DAYS)),
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
  const digests = onlyUser ? [] : await buildDigests();
  const report = {
    date: today, dry, delays,
    digests: digests.map(d => ({ shop: d.shop, email: d.email ? d.email.replace(/^(..)[^@]*/, '$1***') : null, since: d.since, new_orders: d.new_orders.length, delivered: d.delivered, cancelled: d.cancelled, low_stock: d.low_stock.length, due: d.due, will_send: digestHasContent(d) && !!d.email })),
    expired: plan.expire.map(s => ({ id: s.id, shop: label(s), ends_at: s.ends_at, silent: hasFollowUp(s), to_commission: !hasFollowUp(s) && toCommission(s) })),
    reminded_first: plan.remind7.map(s => ({ id: s.id, shop: label(s), ends_at: s.ends_at })),
    reminded_last: plan.remind1.map(s => ({ id: s.id, shop: label(s), ends_at: s.ends_at })),
    stale_payments: plan.stale.map(s => ({ id: s.id, shop: label(s), amount: s.amount, since: s.created_at.slice(0, 10) })),
    expired_bundles: [] as { id: number; name: string }[],
    errors: [] as string[],
  };
  const { data: expiredBundles } = onlyUser ? { data: [] as any[] } : await supabaseAdmin.from('products').select('id, name')
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
    if (toCommission(s)) {
      // Passage à la commission sans interruption (le choix a été fait pendant l'abonnement)
      const r = await switchToCommission(s.user_id, { force: true, note: "Bascule à l'échéance de l'abonnement" });
      if (r.ok) {
        await merchantNotify(s, '🤝 Formule commission activée',
          `Votre abonnement a pris fin le ${fmt(s.ends_at)} : vous êtes maintenant en formule commission (${r.rate} % retenus sur vos ventes livrées, rien à payer d'avance). Vos produits restent visibles.`,
          'Hornafresh — vous passez en formule commission');
        continue;
      }
      report.errors.push(`commission ${s.id}: ${r.error}`);
    }
    await merchantNotify(s, '🔒 Abonnement expiré',
      `Votre abonnement Hornafresh a pris fin le ${fmt(s.ends_at)}. Vos produits ne sont plus visibles sur le site. Renouvelez-le ou changez de formule depuis « Ma formule » pour les réafficher.`,
      'Votre abonnement Hornafresh a expiré');
  }

  // 2. Rappels
  for (const s of plan.remind7) {
    const { error: e } = await supabaseAdmin.from('merchant_subscriptions').update({ reminder_7_sent_at: nowIso }).eq('id', s.id).is('reminder_7_sent_at', null);
    if (e) { report.errors.push(`remind7 ${s.id}: ${e.message}`); continue; }
    await merchantNotify(s, `⏳ Abonnement : ${FIRST} jour(s) restant(s)`,
      `Votre abonnement Hornafresh expire le ${fmt(s.ends_at)}. Renouvelez-le dès maintenant depuis « Ma formule » : la nouvelle période s'enchaînera sans interruption.`,
      `Votre abonnement Hornafresh expire dans ${FIRST} jour(s)`);
  }
  for (const s of plan.remind1) {
    const { error: e } = await supabaseAdmin.from('merchant_subscriptions').update({ reminder_1_sent_at: nowIso }).eq('id', s.id).is('reminder_1_sent_at', null);
    if (e) { report.errors.push(`remind1 ${s.id}: ${e.message}`); continue; }
    await merchantNotify(s, `⚠️ Abonnement : plus que ${LAST} jour(s)`,
      `Votre abonnement Hornafresh expire le ${fmt(s.ends_at)}, dans ${LAST} jour(s). Sans renouvellement, vos produits seront masqués du site après cette date.`,
      `Votre abonnement Hornafresh expire dans ${LAST} jour(s)`);
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
  const loud = report.expired.filter(x => !x.silent && !x.to_commission);
  const switched = report.expired.filter(x => x.to_commission);
  if (switched.length) lines.push(`${switched.length} marchand(s) passé(s) en commission : ${switched.map(x => x.shop).join(', ')}`);
  if (loud.length) lines.push(`${loud.length} abonnement(s) expiré(s) : ${loud.map(x => x.shop).join(', ')}`);
  if (report.reminded_first.length) lines.push(`J-${FIRST} : ${report.reminded_first.map(x => x.shop).join(', ')}`);
  if (report.reminded_last.length) lines.push(`J-${LAST} : ${report.reminded_last.map(x => x.shop).join(', ')}`);
  if (report.stale_payments.length) lines.push(`${report.stale_payments.length} paiement(s) déclaré(s) à confirmer depuis ≥ ${STALE_DAYS} j : ${report.stale_payments.map(x => `${x.shop} (${Number(x.amount).toLocaleString('fr-FR')} Fdj)`).join(', ')}`);
  if (report.errors.length) lines.push(`⚠️ ${report.errors.length} erreur(s)`);
  if (lines.length && !onlyUser) {
    try { await sendPushToAdmin({ title: '🏪 Marchands — point du jour', body: lines.join(' · '), url: '/admin' }); }
    catch (e: any) { report.errors.push(`admin push: ${e.message}`); }
  }

  return NextResponse.json(report);
}
