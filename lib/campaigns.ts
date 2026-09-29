import { supabaseAdmin } from './supabase-admin';
import { allocate, progress, type CampaignStatus } from './campaign-math';
import { adjustCompanyWallet } from './company';

// ── Achats groupés à l'import : opérations serveur ───────────────────────────
// Hornafresh achète et revend : le client paie Hornafresh à la réservation, Hornafresh paie le producteur.
// Un remboursement va toujours sur la cagnotte (du client ou de sa société), jamais par virement.

export const fdj = (v: number) => `${Math.round(Number(v)).toLocaleString('fr-FR')} Fdj`;
const now = () => new Date().toISOString();

/** Champs publics d'une campagne : jamais la fiche de coût (prix du producteur, frais, marge). */
export const PUBLIC_FIELDS = 'id, title, description, image_url, translations, unit_label, unit_weight_kg, price_djf, min_units, max_units, max_units_per_client, closes_at, eta_date, audience, allow_delivery, allow_pickup, pickup_place, delivery_fee, status, received_units, ordered_units, supplier_id';

/** Unités réservées par campagne : payées (comptent pour le seuil) et en attente de paiement. */
export async function unitsByCampaign(ids: number[]): Promise<Record<number, { paid: number; pending: number; buyers: number }>> {
  const out: Record<number, { paid: number; pending: number; buyers: number }> = {};
  for (const id of ids) out[id] = { paid: 0, pending: 0, buyers: 0 };
  if (!ids.length) return out;
  const seen: Record<number, Set<string>> = {};
  for (let from = 0; ; from += 1000) {
    const { data } = await supabaseAdmin.from('campaign_orders').select('campaign_id, user_id, company_id, units, status')
      .in('campaign_id', ids).in('status', ['paid', 'pending_payment', 'delivered']).order('id').range(from, from + 999);
    for (const o of data || []) {
      const r = out[o.campaign_id]; if (!r) continue;
      if (o.status === 'pending_payment') r.pending += o.units; else { r.paid += o.units; (seen[o.campaign_id] ||= new Set()).add(o.company_id ? `c${o.company_id}` : o.user_id); }
    }
    if (!data || data.length < 1000) break;
  }
  for (const id of ids) out[id].buyers = seen[id]?.size || 0;
  return out;
}

async function notify(userId: string, title: string, body: string, campaignId: number, i18n: { key: string; params?: Record<string, any> }) {
  try { const { notifyUser } = await import('./notify'); await notifyUser(userId, { title, body, url: `/achats-groupes/${campaignId}`, i18n }); }
  catch (e) { console.error('[campaigns] notify:', e); }
}

/** Rembourse une réservation (tout ou partie) sur la cagnotte d'origine. Idempotent par montant restant. */
export async function refundOrder(o: any, amount: number, note: string): Promise<{ ok: boolean; error?: string }> {
  const left = Math.max(0, Number(o.amount) - Number(o.refunded || 0));
  const value = Math.min(Math.round(amount), left);
  if (value <= 0) return { ok: true };
  // Verrou : la ligne ne passe à « remboursé de X » que si personne ne l'a fait entre-temps
  const { data: locked } = await supabaseAdmin.from('campaign_orders').update({ refunded: Number(o.refunded || 0) + value, updated_at: now() })
    .eq('id', o.id).eq('refunded', o.refunded || 0).select('id');
  if (!locked?.length) return { ok: false, error: 'already_refunded' };
  if (o.company_id) {
    const r = await adjustCompanyWallet(o.company_id, value, 'refund', { userId: o.user_id, note });
    if (!r.ok) { await supabaseAdmin.from('campaign_orders').update({ refunded: o.refunded || 0 }).eq('id', o.id); return { ok: false, error: r.error }; }
  } else {
    const { error } = await supabaseAdmin.rpc('wallet_adjust', { p_user: o.user_id, p_amount: value, p_type: 'refund', p_order: null, p_note: note });
    if (error) { await supabaseAdmin.from('campaign_orders').update({ refunded: o.refunded || 0 }).eq('id', o.id); return { ok: false, error: error.message }; }
  }
  return { ok: true };
}

/** Annule toutes les réservations d'une campagne et rembourse celles qui étaient payées. */
export async function refundAll(campaign: any, reason: 'failed' | 'cancelled', note?: string | null) {
  const { data: orders } = await supabaseAdmin.from('campaign_orders').select('*').eq('campaign_id', campaign.id).in('status', ['paid', 'pending_payment']);
  const report = { refunded: 0, amount: 0, cancelled: 0, errors: [] as string[] };
  for (const o of orders || []) {
    if (o.status === 'pending_payment') {
      await supabaseAdmin.from('campaign_orders').update({ status: 'cancelled', updated_at: now() }).eq('id', o.id).eq('status', 'pending_payment');
      report.cancelled++;
    } else {
      const due = Number(o.amount) - Number(o.refunded || 0);
      const r = await refundOrder(o, due, `Achat groupé « ${campaign.title} » ${reason === 'failed' ? 'non déclenché' : 'annulé'}`);
      if (!r.ok) { report.errors.push(`réservation ${o.id} : ${r.error}`); continue; }
      await supabaseAdmin.from('campaign_orders').update({ status: 'refunded', final_units: 0, updated_at: now() }).eq('id', o.id);
      report.refunded++; report.amount += due;
    }
    await notify(o.user_id,
      reason === 'failed' ? '↩️ Achat groupé non déclenché' : '↩️ Achat groupé annulé',
      reason === 'failed'
        ? `« ${campaign.title} » n'a pas atteint la quantité minimale.${o.status === 'paid' ? ` ${fdj(Number(o.amount))} ont été recrédités sur votre cagnotte.` : ''}`
        : `« ${campaign.title} » est annulé${note ? ` : ${note}` : ''}.${o.status === 'paid' ? ` ${fdj(Number(o.amount))} ont été recrédités sur votre cagnotte.` : ''}`,
      campaign.id,
      { key: `g.${reason}${o.status === 'paid' ? '_refund' : ''}`, params: { title: campaign.title, amount: fdj(Number(o.amount)), note: note ? ` : ${note}` : '' } });
  }
  return report;
}

/**
 * Clôture d'une campagne ouverte : seuil atteint → « closed » (à commander au producteur) ;
 * sinon « failed » et remboursement de tous. `force` : clôture avant la date limite (décision admin).
 */
export async function closeCampaign(id: number, opts: { force?: boolean } = {}) {
  const { data: c } = await supabaseAdmin.from('campaigns').select('*').eq('id', id).maybeSingle();
  if (!c) return { ok: false as const, error: 'not_found' };
  if (c.status !== 'open') return { ok: false as const, error: 'not_open' };
  if (!opts.force && new Date(c.closes_at).getTime() > Date.now()) return { ok: false as const, error: 'not_due' };
  const u = (await unitsByCampaign([id]))[id];
  const reached = u.paid >= c.min_units;
  const to: CampaignStatus = reached ? 'closed' : 'failed';
  // Verrou d'état : une seule clôture, même si le cron et l'admin agissent en même temps
  const { data: moved } = await supabaseAdmin.from('campaigns').update({ status: to, closed_at: now(), ordered_units: reached ? u.paid : null, updated_at: now() })
    .eq('id', id).eq('status', 'open').select('id');
  if (!moved?.length) return { ok: false as const, error: 'not_open' };
  if (!reached) return { ok: true as const, status: to, units: u.paid, refunds: await refundAll(c, 'failed') };

  // Seuil atteint : les réservations jamais payées sont retirées, les clients payés sont prévenus
  await supabaseAdmin.from('campaign_orders').update({ status: 'cancelled', updated_at: now() }).eq('campaign_id', id).eq('status', 'pending_payment');
  const { data: paid } = await supabaseAdmin.from('campaign_orders').select('user_id').eq('campaign_id', id).eq('status', 'paid');
  for (const uid of new Set((paid || []).map((o: any) => o.user_id))) {
    await notify(uid as string, '🎉 Achat groupé déclenché', `« ${c.title} » a atteint sa quantité minimale : la commande part chez le producteur.`, id,
      { key: 'g.triggered', params: { title: c.title } });
  }
  try { const { sendPushToAdmin } = await import('./push'); await sendPushToAdmin({ title: '🌍 Achat groupé à commander', body: `${c.title} — ${u.paid} ${c.unit_label} réservé(s)`, url: '/admin' }); } catch { /* ignore */ }
  return { ok: true as const, status: to, units: u.paid };
}

/** Clôture toutes les campagnes ouvertes dont la date limite est passée (cron, et à la lecture publique). */
export async function closeDueCampaigns() {
  const { data } = await supabaseAdmin.from('campaigns').select('id').eq('status', 'open').lte('closes_at', now());
  const out: any[] = [];
  for (const c of data || []) out.push({ id: c.id, ...(await closeCampaign(c.id)) });
  return out;
}

/**
 * Réception contrôlée : quantité reçue < quantité réservée → répartition au prorata et remboursement
 * de la différence. Passe la campagne à « arrived ».
 */
export async function receiveCampaign(id: number, received: number) {
  const { data: c } = await supabaseAdmin.from('campaigns').select('*').eq('id', id).maybeSingle();
  if (!c) return { ok: false as const, error: 'not_found' };
  if (!['ordered', 'in_transit'].includes(c.status)) return { ok: false as const, error: 'wrong_status' };
  if (!Number.isInteger(received) || received < 0) return { ok: false as const, error: 'invalid_units' };
  const { data: orders } = await supabaseAdmin.from('campaign_orders').select('*').eq('campaign_id', id).eq('status', 'paid').order('created_at');
  const list = orders || [];
  const total = list.reduce((s: number, o: any) => s + o.units, 0);
  const { data: moved } = await supabaseAdmin.from('campaigns').update({ status: 'arrived', received_units: received, updated_at: now() })
    .eq('id', id).in('status', ['ordered', 'in_transit']).select('id');
  if (!moved?.length) return { ok: false as const, error: 'wrong_status' };

  const share = allocate(list.map((o: any) => ({ id: o.id, units: o.units, created_at: o.created_at })), received);
  const report = { reserved: total, received, reduced: 0, refunded_amount: 0, errors: [] as string[] };
  for (const o of list) {
    const got = share[o.id] ?? 0;
    await supabaseAdmin.from('campaign_orders').update({ final_units: got, updated_at: now() }).eq('id', o.id);
    if (got < o.units) {
      // Articles manquants remboursés ; plus rien de livré → frais de livraison remboursés aussi
      const back = (o.units - got) * Number(o.unit_price) + (got === 0 ? Number(o.delivery_fee || 0) : 0);
      const r = await refundOrder(o, back, `Achat groupé « ${c.title} » : ${o.units - got} ${c.unit_label} manquant(s) à l'arrivée`);
      if (!r.ok) report.errors.push(`réservation ${o.id} : ${r.error}`);
      else { report.reduced++; report.refunded_amount += back; }
      if (got === 0) await supabaseAdmin.from('campaign_orders').update({ status: 'refunded' }).eq('id', o.id);
      await notify(o.user_id, '⚠️ Achat groupé : quantité réduite',
        `« ${c.title} » : ${got} ${c.unit_label} sur ${o.units} sont arrivés. ${fdj(back)} ont été recrédités sur votre cagnotte.`, id,
        { key: 'g.reduced', params: { title: c.title, got, units: o.units, unit: c.unit_label, amount: fdj(back) } });
    } else {
      await notify(o.user_id, '📦 Achat groupé arrivé', `« ${c.title} » est arrivé à Djibouti. Nous préparons la distribution.`, id, { key: 'g.arrived', params: { title: c.title } });
    }
  }
  return { ok: true as const, ...report };
}

/** Campagne enrichie pour l'affichage public. */
export function publicView(c: any, u: { paid: number; pending: number; buyers: number }) {
  return { ...c, progress: progress(u.paid, c.min_units, c.max_units), pending_units: u.pending, buyers: u.buyers, taken_units: u.paid + u.pending };
}
