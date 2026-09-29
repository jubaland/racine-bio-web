import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { supabaseAdmin } from '../../../lib/supabase-admin';
import { monitored } from '../../../lib/monitor';
import { userFromRequest, membershipOf, adjustCompanyWallet } from '../../../lib/company';
import { cleanLang } from '../../../lib/i18n-server';
import { PUBLIC_FIELDS, unitsByCampaign, publicView, closeDueCampaigns, refundOrder, fdj } from '../../../lib/campaigns';
import { WAAFI_MERCHANT_NUMBER, WAAFI_ACCOUNT_HOLDER } from '../../../lib/payments';

// Achats groupés — côté client.
// GET            → campagnes visibles (ouvertes et en cours), avancement, et mes réservations si connecté
// GET ?id=…      → une campagne ; ?g=<code> : membres du groupe (prénoms et quantités)
// POST { action }
//   reserve      { campaign_id, units, delivery_mode, payment_method, reference?, address?, phone?, group?, for_company? }
//   cancel       { order_id }   tant que la campagne est ouverte : remboursement sur la cagnotte
//   new_group    { campaign_id } → code d'invitation à partager
// La fiche de coût (prix du producteur, frais, marge) n'est jamais renvoyée ici.

const VISIBLE = ['open', 'closed', 'ordered', 'in_transit', 'arrived', 'distributing'];
const firstName = (s: string | null | undefined) => (s || '').trim().split(/\s+/)[0] || 'Client';
const bad = (error: string, status = 400, extra: Record<string, unknown> = {}) => NextResponse.json({ error, ...extra }, { status });

async function GET_(request: Request) {
  const q = new URL(request.url).searchParams;
  const user = await userFromRequest(request);
  try { await closeDueCampaigns(); } catch (e) { console.error('[campaigns] clôture :', e); }   // les dates limites sont respectées à l'heure

  const id = Number(q.get('id')) || null;
  let query = supabaseAdmin.from('campaigns').select(`${PUBLIC_FIELDS}, suppliers(name, country, region)`);
  query = id ? query.eq('id', id).neq('status', 'draft') : query.in('status', VISIBLE).order('closes_at', { ascending: true });
  const { data, error } = await query;
  if (error) return bad(error.message, 500);
  const list = data || [];
  if (id && !list.length) return bad('not_found', 404);

  const membership = user ? await membershipOf(user.id) : null;
  const isPro = !!membership && membership.company?.status === 'active';
  const units = await unitsByCampaign(list.map((c: any) => c.id));
  const campaigns = list.map((c: any) => {
    const v = publicView(c, units[c.id]);
    return { ...v, supplier: c.suppliers ? { name: c.suppliers.name, country: c.suppliers.country, region: c.suppliers.region } : null, suppliers: undefined, supplier_id: undefined,
      available_units: c.max_units != null ? Math.max(0, c.max_units - v.taken_units) : null,
      can_reserve: c.status === 'open' && new Date(c.closes_at).getTime() > Date.now() && (c.audience === 'all' || isPro) };
  });

  let mine: any[] = [];
  if (user) {
    const { data: orders } = await supabaseAdmin.from('campaign_orders').select('id, campaign_id, company_id, group_code, units, final_units, unit_price, delivery_mode, delivery_fee, amount, refunded, payment_method, payment_reference, status, created_at, campaigns(title, unit_label, status, eta_date, translations)')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(100);
    mine = (orders || []).filter((o: any) => !id || o.campaign_id === id);
  }

  let group: any = null;
  const code = (q.get('g') || '').trim().slice(0, 24);
  if (id && code) {
    const { data: members } = await supabaseAdmin.from('campaign_orders').select('customer_name, units, status, created_at').eq('campaign_id', id).eq('group_code', code).in('status', ['paid', 'pending_payment', 'delivered']).order('created_at');
    group = { code, members: (members || []).map((m: any) => ({ name: firstName(m.customer_name), units: m.units, paid: m.status !== 'pending_payment' })), units: (members || []).reduce((s: number, m: any) => s + m.units, 0) };
  }

  return NextResponse.json({
    campaigns, campaign: id ? campaigns[0] : undefined, mine, group,
    me: user ? { pro: isPro, company: isPro ? { id: membership!.company_id, name: membership!.company?.name, role: membership!.role } : null } : null,
    payment: { waafi_number: WAAFI_MERCHANT_NUMBER, waafi_holder: WAAFI_ACCOUNT_HOLDER },
  });
}

async function POST_(request: Request) {
  const user = await userFromRequest(request);
  if (!user) return bad('unauthorized', 401);
  let body: any = {};
  try { body = await request.json(); } catch { /* ignore */ }
  const { action } = body;

  if (action === 'new_group') {
    const { data: c } = await supabaseAdmin.from('campaigns').select('id, status').eq('id', Number(body.campaign_id)).maybeSingle();
    if (!c || c.status !== 'open') return bad('closed', 409);
    return NextResponse.json({ ok: true, code: randomBytes(5).toString('hex') });
  }

  if (action === 'reserve') {
    const campaignId = Number(body.campaign_id), units = Number(body.units);
    if (!campaignId || !Number.isInteger(units) || units < 1) return bad('invalid_units');
    const { data: c } = await supabaseAdmin.from('campaigns').select('*').eq('id', campaignId).maybeSingle();
    if (!c || c.status === 'draft') return bad('not_found', 404);

    const method = body.payment_method;
    if (!['wallet', 'waafi', 'company_wallet'].includes(method)) return bad('invalid_payment');
    const membership = await membershipOf(user.id);
    const isPro = !!membership && membership.company?.status === 'active';
    const forCompany = method === 'company_wallet';
    if (forCompany && (!isPro || !['manager', 'buyer'].includes(membership!.role))) return bad('company_forbidden', 403);
    if (c.audience === 'pro' && !isPro) return bad('pro_only', 403);

    const mode = body.delivery_mode;
    const group = body.group ? String(body.group).trim().slice(0, 24) : null;
    if (!['delivery', 'pickup', 'group'].includes(mode)) return bad('invalid_delivery');
    if (mode === 'delivery' && !c.allow_delivery) return bad('delivery_unavailable');
    if (mode === 'pickup' && !c.allow_pickup) return bad('pickup_unavailable');
    if (mode === 'group') {
      // Livré avec le groupe : il faut un groupe dont un membre s'est déjà fait livrer ou retire sur place
      if (!group) return bad('group_required');
      const { data: host } = await supabaseAdmin.from('campaign_orders').select('id').eq('campaign_id', campaignId).eq('group_code', group).in('delivery_mode', ['delivery', 'pickup']).in('status', ['paid', 'pending_payment']).limit(1);
      if (!host?.length) return bad('group_not_found', 404);
    }
    const address = String(body.address || '').trim().slice(0, 300);
    const phone = String(body.phone || user.user_metadata?.phone || '').trim().slice(0, 40);
    if (mode === 'delivery' && !address) return bad('address_required');
    if (!phone) return bad('phone_required');
    const reference = String(body.reference || '').trim().slice(0, 80);
    if (method === 'waafi' && reference.length < 4) return bad('reference_required');
    const fee = mode === 'delivery' ? Number(c.delivery_fee) || 0 : 0;
    const name = forCompany ? `${membership!.company?.name} — ${user.user_metadata?.full_name || user.email}` : (user.user_metadata?.full_name || user.email || '');

    const { data: res, error } = await supabaseAdmin.rpc('campaign_reserve', {
      p_campaign: campaignId, p_user: user.id, p_company: forCompany ? membership!.company_id : null, p_units: units,
      p_delivery_mode: mode, p_delivery_fee: fee, p_payment_method: method, p_payment_reference: reference || null, p_group: group,
      p_name: name, p_phone: phone, p_address: address || null, p_lang: cleanLang(body.lang),
    });
    if (error) return bad(error.message, 500);
    const r = res as any;
    if (!r.ok) return bad(r.error, r.error === 'not_found' ? 404 : 409, { available: r.available });

    const note = `Achat groupé « ${c.title} » : ${units} ${c.unit_label}`;
    if (method === 'waafi') {
      // Paiement déclaré : la réservation compte dans la capacité, et dans le seuil une fois confirmée par Hornafresh
      try { const { sendPushToAdmin } = await import('../../../lib/push'); await sendPushToAdmin({ title: '🌍 Achat groupé : paiement à confirmer', body: `${name} · ${c.title} · ${fdj(r.amount)} · réf. ${reference}`, url: '/admin' }); } catch { /* ignore */ }
      return NextResponse.json({ ok: true, order_id: r.order_id, amount: r.amount, status: 'pending_payment' });
    }
    // Paiement par cagnotte : débit refusé si le solde est insuffisant, réservation alors retirée
    let paid = false, reason = 'payment_failed';
    if (forCompany) {
      const d = await adjustCompanyWallet(membership!.company_id, -Number(r.amount), 'debit', { userId: user.id, note });
      paid = d.ok; if (!d.ok) reason = d.error === 'insufficient' ? 'insufficient' : (d.error || reason);
    } else {
      const { error: e } = await supabaseAdmin.rpc('wallet_debit_strict', { p_user: user.id, p_amount: Number(r.amount), p_note: note });
      paid = !e; if (e) reason = /insufficient/.test(e.message) ? 'insufficient' : e.message;
    }
    if (!paid) {
      await supabaseAdmin.from('campaign_orders').delete().eq('id', r.order_id).eq('status', 'pending_payment');
      return bad(reason, reason === 'insufficient' ? 402 : 500, { amount: r.amount });
    }
    await supabaseAdmin.from('campaign_orders').update({ status: 'paid', updated_at: new Date().toISOString() }).eq('id', r.order_id);
    try {
      const { notifyUser } = await import('../../../lib/notify');
      await notifyUser(user.id, { title: '✅ Réservation enregistrée', body: `${units} ${c.unit_label} · « ${c.title} » · ${fdj(r.amount)}. Vous serez prévenu quand la quantité minimale sera atteinte.`, url: `/achats-groupes/${campaignId}`,
        i18n: { key: 'g.reserved', params: { units, unit: c.unit_label, title: c.title, amount: fdj(r.amount) } } });
    } catch { /* ignore */ }
    return NextResponse.json({ ok: true, order_id: r.order_id, amount: r.amount, status: 'paid' });
  }

  if (action === 'cancel') {
    const { data: o } = await supabaseAdmin.from('campaign_orders').select('*, campaigns(id, title, status, closes_at)').eq('id', Number(body.order_id)).eq('user_id', user.id).maybeSingle();
    if (!o) return bad('not_found', 404);
    const c: any = (o as any).campaigns;
    // Une fois la campagne clôturée, la marchandise est commandée : plus d'annulation par le client
    if (c.status !== 'open' || new Date(c.closes_at).getTime() <= Date.now()) return bad('too_late', 409);
    if (!['paid', 'pending_payment'].includes(o.status)) return bad('already_resolved', 409);
    const { data: moved } = await supabaseAdmin.from('campaign_orders').update({ status: o.status === 'paid' ? 'refunded' : 'cancelled', final_units: 0, updated_at: new Date().toISOString() })
      .eq('id', o.id).eq('status', o.status).select('id');
    if (!moved?.length) return bad('already_resolved', 409);
    if (o.status === 'paid') {
      const r = await refundOrder(o, Number(o.amount), `Achat groupé « ${c.title} » : réservation annulée`);
      if (!r.ok) { await supabaseAdmin.from('campaign_orders').update({ status: 'paid', final_units: null }).eq('id', o.id); return bad(r.error || 'refund_failed', 500); }
    }
    return NextResponse.json({ ok: true, refunded: o.status === 'paid' ? Number(o.amount) : 0 });
  }

  return bad('invalid_action');
}

export const GET = monitored('/api/campaigns', GET_);
export const POST = monitored('/api/campaigns', POST_);
