import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requirePerm } from '../../../../lib/admin-auth';
import { monitored } from '../../../../lib/monitor';
import { unitCost, marginOf, suggestedPrice, supplierDue, NEXT_STATUS, type CampaignStatus } from '../../../../lib/campaign-math';
import { unitsByCampaign, closeCampaign, refundAll, receiveCampaign, fdj } from '../../../../lib/campaigns';

// Admin › Achats groupés
// GET            → producteurs, campagnes (avancement, coût, marge), réglages, paiements Waafi à confirmer
// GET ?id=…      → une campagne : réservations, paiements au producteur, bilan
// POST { action } : save_supplier | save_campaign | open | close_now | cancel | set_status | receive |
//   deliver | confirm_payment | reject_payment | pay_supplier | delete_supplier_payment | save_settings
const CURRENCIES = ['USD', 'DJF', 'ETB', 'SOS', 'SLS'];
const SETTINGS = ['loss_pct', 'margin_pct', 'supplier_deposit_pct'] as const;     // valeurs proposées par défaut, facultatives
const bad = (error: string, status = 400, extra: Record<string, unknown> = {}) => NextResponse.json({ error, ...extra }, { status });
const str = (v: unknown, n: number) => { const s = String(v ?? '').trim().slice(0, n); return s || null; };
const now = () => new Date().toISOString();

async function settings() {
  const { data } = await supabaseAdmin.from('app_settings').select('key, value_num').like('key', 'campaign.%');
  const v: Record<string, number | null> = Object.fromEntries((data || []).map((r: any) => [r.key.replace('campaign.', ''), r.value_num != null ? Number(r.value_num) : null]));
  return Object.fromEntries(SETTINGS.map(k => [k, v[k] ?? null])) as Record<typeof SETTINGS[number], number | null>;
}

/** Bilan d'une campagne : encaissé, remboursé, dû et payé au producteur, marge prévue. */
function summary(c: any, orders: any[], payments: any[]) {
  const live = orders.filter(o => ['paid', 'delivered'].includes(o.status));
  const units = live.reduce((s, o) => s + (o.final_units ?? o.units), 0);
  const collected = orders.filter(o => ['paid', 'delivered', 'refunded'].includes(o.status)).reduce((s, o) => s + Number(o.amount), 0);
  const refunded = orders.reduce((s, o) => s + Number(o.refunded || 0), 0);
  const basis = c.received_units ?? c.ordered_units ?? units;
  const dueCur = supplierDue(c.supplier_unit_price, basis);
  const paidCur = payments.reduce((s, p) => s + Number(p.amount_currency), 0);
  const paidDjf = payments.reduce((s, p) => s + Number(p.amount_djf), 0);
  const cost = unitCost(c);
  return {
    units, buyers: new Set(live.map(o => o.company_id ? `c${o.company_id}` : o.user_id)).size,
    collected, refunded, net_sales: collected - refunded,
    supplier: { basis_units: basis, due_currency: dueCur, paid_currency: Math.round(paidCur * 100) / 100, balance_currency: Math.round((dueCur - paidCur) * 100) / 100, paid_djf: paidDjf, currency: c.currency,
      deposit_currency: c.supplier_deposit_pct != null ? Math.round(dueCur * Number(c.supplier_deposit_pct)) / 100 : null },
    expected_margin: units * (Number(c.price_djf) - cost.cost),
  };
}

async function GET_(request: Request) {
  const auth = await requirePerm(request, 'campaigns', 'view');
  if (!auth.ok) return bad(auth.error, auth.status);
  const id = Number(new URL(request.url).searchParams.get('id')) || null;

  if (id) {
    const [{ data: c }, { data: orders }, { data: payments }] = await Promise.all([
      supabaseAdmin.from('campaigns').select('*, suppliers(*)').eq('id', id).maybeSingle(),
      supabaseAdmin.from('campaign_orders').select('*').eq('campaign_id', id).order('created_at'),
      supabaseAdmin.from('campaign_supplier_payments').select('*').eq('campaign_id', id).order('paid_at'),
    ]);
    if (!c) return bad('not_found', 404);
    return NextResponse.json({ campaign: { ...c, cost: unitCost(c), margin: marginOf(c, c.price_djf) }, orders: orders || [], payments: payments || [], summary: summary(c, orders || [], payments || []), next: NEXT_STATUS[c.status as CampaignStatus] || [] });
  }

  const [{ data: suppliers }, { data: campaigns }, { data: pending }, s] = await Promise.all([
    supabaseAdmin.from('suppliers').select('*').order('name'),
    supabaseAdmin.from('campaigns').select('*, suppliers(name, country)').order('created_at', { ascending: false }).limit(200),
    supabaseAdmin.from('campaign_orders').select('id, campaign_id, customer_name, units, amount, payment_reference, created_at, campaigns(title, unit_label)').eq('status', 'pending_payment').eq('payment_method', 'waafi').order('created_at'),
    settings(),
  ]);
  const units = await unitsByCampaign((campaigns || []).map((c: any) => c.id));
  return NextResponse.json({
    suppliers: suppliers || [],
    campaigns: (campaigns || []).map((c: any) => ({ ...c, cost: unitCost(c), margin: marginOf(c, c.price_djf), units: units[c.id], next: NEXT_STATUS[c.status as CampaignStatus] || [] })),
    pending_payments: pending || [], settings: s, currencies: CURRENCIES,
  });
}

/** Lit et contrôle un nombre ; `required` : vide refusé. Renvoie [valeur, erreur]. */
function num(body: any, key: string, opts: { required?: boolean; min?: number; max?: number; int?: boolean; above?: number } = {}): [number | null, string | null] {
  const raw = body[key];
  if (raw === '' || raw == null) return opts.required ? [null, key] : [null, null];
  const v = Number(raw);
  if (!Number.isFinite(v) || (opts.int && !Number.isInteger(v)) || (opts.min != null && v < opts.min) || (opts.max != null && v > opts.max) || (opts.above != null && v <= opts.above)) return [null, key];
  return [v, null];
}

async function POST_(request: Request) {
  const auth = await requirePerm(request, 'campaigns', 'edit');
  if (!auth.ok) return bad(auth.error, auth.status);
  let body: any = {};
  try { body = await request.json(); } catch { /* ignore */ }
  const { action } = body;

  if (action === 'save_settings') {
    const rows: any[] = [];
    for (const k of SETTINGS) {
      if (!(k in body)) continue;
      const [v, e] = num(body, k, { min: 0, max: k === 'supplier_deposit_pct' ? 100 : 99 });
      if (e) return bad('invalid_value', 400, { field: k });
      rows.push({ key: `campaign.${k}`, value_num: v, updated_at: now() });
    }
    if (rows.length) await supabaseAdmin.from('app_settings').upsert(rows, { onConflict: 'key' });
    return NextResponse.json({ ok: true, settings: await settings() });
  }

  if (action === 'save_supplier') {
    const name = str(body.name, 120);
    if (!name) return bad('name_required', 400, { field: 'name' });
    if (!['SO', 'ET', 'DJ', 'OTHER'].includes(body.country)) return bad('invalid_value', 400, { field: 'country' });
    if (!CURRENCIES.includes(body.currency)) return bad('invalid_value', 400, { field: 'currency' });
    const row = { name, country: body.country, region: str(body.region, 120), contact_name: str(body.contact_name, 120), phone: str(body.phone, 40), whatsapp: str(body.whatsapp, 40),
      currency: body.currency, payment_channel: str(body.payment_channel, 120), notes: str(body.notes, 1000), is_active: body.is_active !== false, updated_at: now() };
    const { data, error } = body.id ? await supabaseAdmin.from('suppliers').update(row).eq('id', Number(body.id)).select().single() : await supabaseAdmin.from('suppliers').insert(row).select().single();
    if (error) return bad(error.message, 500);
    return NextResponse.json({ ok: true, supplier: data });
  }

  if (action === 'save_campaign') {
    const id = body.id ? Number(body.id) : null;
    const { data: cur } = id ? await supabaseAdmin.from('campaigns').select('*').eq('id', id).maybeSingle() : { data: null as any };
    if (id && !cur) return bad('not_found', 404);
    const title = str(body.title, 160), unit = str(body.unit_label, 80);
    if (!title) return bad('required', 400, { field: 'title' });
    if (!unit) return bad('required', 400, { field: 'unit_label' });
    const { data: sup } = await supabaseAdmin.from('suppliers').select('id, currency').eq('id', Number(body.supplier_id)).maybeSingle();
    if (!sup) return bad('required', 400, { field: 'supplier_id' });
    const v: Record<string, number | null> = {};
    for (const [k, o] of [
      ['supplier_unit_price', { required: true, min: 0 }], ['exchange_rate', { required: true, above: 0 }], ['price_djf', { required: true, above: 0 }],
      ['min_units', { required: true, min: 1, int: true }], ['max_units', { min: 1, int: true }], ['max_units_per_client', { min: 1, int: true }],
      ['transport_per_unit', { min: 0 }], ['customs_per_unit', { min: 0 }], ['other_per_unit', { min: 0 }], ['loss_pct', { min: 0, max: 99 }],
      ['delivery_fee', { min: 0 }], ['unit_weight_kg', { above: 0 }], ['supplier_deposit_pct', { min: 0, max: 100 }],
    ] as [string, any][]) {
      const [val, e] = num(body, k, o);
      if (e) return bad(o.required && (body[k] === '' || body[k] == null) ? 'required' : 'invalid_value', 400, { field: k });
      v[k] = val;
    }
    if (v.max_units != null && v.max_units < v.min_units!) return bad('max_below_min', 400, { field: 'max_units' });
    const closes = body.closes_at ? new Date(body.closes_at) : null;
    if (!closes || isNaN(closes.getTime())) return bad('required', 400, { field: 'closes_at' });
    // Une date limite déjà passée rendrait la campagne impossible à ouvrir
    if (closes.getTime() <= Date.now()) return bad('closes_in_past', 400, { field: 'closes_at' });
    const eta = body.eta_date && /^\d{4}-\d{2}-\d{2}$/.test(body.eta_date) ? body.eta_date : null;
    if (eta && eta < closes.toISOString().slice(0, 10)) return bad('eta_before_close', 400, { field: 'eta_date' });
    const allowDelivery = body.allow_delivery !== false, allowPickup = body.allow_pickup !== false;
    if (!allowDelivery && !allowPickup) return bad('distribution_required', 400, { field: 'allow_delivery' });
    if (allowPickup && !str(body.pickup_place, 200)) return bad('required', 400, { field: 'pickup_place' });

    // Une fois des clients engagés, le prix et l'unité de vente ne changent plus
    if (cur && cur.status !== 'draft') {
      const taken = (await unitsByCampaign([cur.id]))[cur.id];
      if (taken.paid + taken.pending > 0 && (Number(cur.price_djf) !== v.price_djf || cur.unit_label !== unit)) return bad('locked_after_orders', 409, { field: 'price_djf' });
      if (v.max_units != null && v.max_units < taken.paid + taken.pending) return bad('max_below_reserved', 409, { field: 'max_units' });
    }
    const tr: Record<string, any> = {};
    for (const l of ['en', 'zh', 'am', 'so']) {
      const t = body.translations?.[l]; const tt = str(t?.title, 160);
      if (tt) { tr[l] = { title: tt, description: str(t?.description, 2000), unit_label: str(t?.unit_label, 80) }; if (l === 'so') tr.aa = tr[l]; }
    }
    const row: any = {
      supplier_id: sup.id, title, description: str(body.description, 2000), image_url: str(body.image_url, 500), translations: Object.keys(tr).length ? tr : null,
      unit_label: unit, unit_weight_kg: v.unit_weight_kg, currency: sup.currency, supplier_unit_price: v.supplier_unit_price, exchange_rate: v.exchange_rate,
      transport_per_unit: v.transport_per_unit ?? 0, customs_per_unit: v.customs_per_unit ?? 0, other_per_unit: v.other_per_unit ?? 0, loss_pct: v.loss_pct ?? 0, price_djf: v.price_djf,
      min_units: v.min_units, max_units: v.max_units, max_units_per_client: v.max_units_per_client, closes_at: closes.toISOString(), eta_date: eta,
      audience: body.audience === 'pro' ? 'pro' : 'all', allow_delivery: allowDelivery, allow_pickup: allowPickup, pickup_place: str(body.pickup_place, 200),
      delivery_fee: v.delivery_fee ?? 0, supplier_deposit_pct: v.supplier_deposit_pct, updated_at: now(),
    };
    const { data, error } = id ? await supabaseAdmin.from('campaigns').update(row).eq('id', id).select().single()
      : await supabaseAdmin.from('campaigns').insert({ ...row, created_by: auth.user.id }).select().single();
    if (error) return bad(error.message, 500);
    return NextResponse.json({ ok: true, campaign: { ...data, cost: unitCost(data), margin: marginOf(data, data.price_djf) } });
  }

  if (action === 'suggest_price') {
    return NextResponse.json({ ok: true, cost: unitCost(body), suggested: suggestedPrice(body, body.margin_pct), margin: body.price_djf ? marginOf(body, body.price_djf) : null });
  }

  // ── Actions sur une campagne ──
  if (['open', 'close_now', 'cancel', 'set_status', 'receive', 'pay_supplier'].includes(action)) {
    const id = Number(body.id);
    const { data: c } = await supabaseAdmin.from('campaigns').select('*').eq('id', id).maybeSingle();
    if (!c) return bad('not_found', 404);

    if (action === 'open') {
      if (c.status !== 'draft') return bad('wrong_status', 409);
      if (new Date(c.closes_at).getTime() <= Date.now()) return bad('closes_in_past', 400, { field: 'closes_at' });
      await supabaseAdmin.from('campaigns').update({ status: 'open', updated_at: now() }).eq('id', id).eq('status', 'draft');
      return NextResponse.json({ ok: true, status: 'open' });
    }
    if (action === 'close_now') {
      const r = await closeCampaign(id, { force: true });
      return r.ok ? NextResponse.json(r) : bad(r.error, 409);
    }
    if (action === 'cancel') {
      if (!NEXT_STATUS[c.status as CampaignStatus]?.includes('cancelled')) return bad('wrong_status', 409);
      const note = str(body.note, 300);
      const { data: moved } = await supabaseAdmin.from('campaigns').update({ status: 'cancelled', status_note: note, updated_at: now() }).eq('id', id).eq('status', c.status).select('id');
      if (!moved?.length) return bad('wrong_status', 409);
      return NextResponse.json({ ok: true, status: 'cancelled', refunds: await refundAll(c, 'cancelled', note) });
    }
    if (action === 'set_status') {
      const to = body.status as CampaignStatus;
      // Les étapes à conséquences (ouverture, clôture, réception, annulation) ont leur propre action
      if (!['ordered', 'in_transit', 'distributing', 'done'].includes(to) || !NEXT_STATUS[c.status as CampaignStatus]?.includes(to)) return bad('wrong_status', 409);
      if (to === 'done') {
        const { count } = await supabaseAdmin.from('campaign_orders').select('id', { count: 'exact', head: true }).eq('campaign_id', id).eq('status', 'paid');
        if (count) return bad('orders_not_delivered', 409, { remaining: count });
      }
      const { data: moved } = await supabaseAdmin.from('campaigns').update({ status: to, updated_at: now() }).eq('id', id).eq('status', c.status).select('id');
      if (!moved?.length) return bad('wrong_status', 409);
      if (to === 'in_transit' || to === 'distributing') {
        const { data: paid } = await supabaseAdmin.from('campaign_orders').select('user_id, delivery_mode').eq('campaign_id', id).eq('status', 'paid');
        const { notifyUser } = await import('../../../../lib/notify');
        for (const uid of new Set((paid || []).map((o: any) => o.user_id))) {
          try {
            await notifyUser(uid as string, to === 'in_transit'
              ? { title: '🚚 Achat groupé en route', body: `« ${c.title} » est parti de chez le producteur.${c.eta_date ? ` Arrivée prévue le ${new Date(c.eta_date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}.` : ''}`, url: `/achats-groupes/${id}`, i18n: { key: c.eta_date ? 'g.transit_eta' : 'g.transit', params: { title: c.title, date: c.eta_date ? { date: c.eta_date } : null } } }
              : { title: '📦 Achat groupé : distribution', body: `« ${c.title} » est prêt. ${c.pickup_place ? `Retrait : ${c.pickup_place}. ` : ''}Les livraisons sont en cours.`, url: `/achats-groupes/${id}`, i18n: { key: 'g.distributing', params: { title: c.title, place: c.pickup_place || '' } } });
          } catch { /* ignore */ }
        }
      }
      return NextResponse.json({ ok: true, status: to });
    }
    if (action === 'receive') {
      const [units, e] = num(body, 'received_units', { required: true, min: 0, int: true });
      if (e) return bad('invalid_units', 400, { field: 'received_units' });
      const r = await receiveCampaign(id, units!);
      return r.ok ? NextResponse.json(r) : bad(r.error, 409);
    }
    if (action === 'pay_supplier') {
      const [amount, e1] = num(body, 'amount_currency', { required: true, above: 0 });
      const [rate, e2] = num(body, 'exchange_rate', { required: true, above: 0 });
      if (e1 || e2) return bad('invalid_value', 400, { field: e1 || e2 });
      if (!['deposit', 'balance', 'other'].includes(body.kind)) return bad('invalid_value', 400, { field: 'kind' });
      if (!['closed', 'ordered', 'in_transit', 'arrived', 'distributing', 'done'].includes(c.status)) return bad('wrong_status', 409);
      const { data, error } = await supabaseAdmin.from('campaign_supplier_payments').insert({
        campaign_id: id, kind: body.kind, amount_currency: amount, currency: c.currency, exchange_rate: rate, amount_djf: Math.round(amount! * rate!),
        method: str(body.method, 60), reference: str(body.reference, 120), note: str(body.note, 300), created_by: auth.user.id,
      }).select().single();
      if (error) return bad(error.message, 500);
      return NextResponse.json({ ok: true, payment: data });
    }
  }

  if (action === 'delete_supplier_payment') {
    const { data } = await supabaseAdmin.from('campaign_supplier_payments').delete().eq('id', Number(body.payment_id)).select('id');
    return data?.length ? NextResponse.json({ ok: true }) : bad('not_found', 404);
  }

  // ── Actions sur une réservation ──
  if (['confirm_payment', 'reject_payment', 'deliver'].includes(action)) {
    const { data: o } = await supabaseAdmin.from('campaign_orders').select('*, campaigns(id, title, unit_label, status)').eq('id', Number(body.order_id)).maybeSingle();
    if (!o) return bad('not_found', 404);
    const c: any = (o as any).campaigns;
    const { notifyUser } = await import('../../../../lib/notify');
    if (action === 'deliver') {
      if (o.status !== 'paid' || !['arrived', 'distributing'].includes(c.status)) return bad('wrong_status', 409);
      await supabaseAdmin.from('campaign_orders').update({ status: 'delivered', delivered_at: now(), updated_at: now() }).eq('id', o.id).eq('status', 'paid');
      try { await notifyUser(o.user_id, { title: '✅ Achat groupé remis', body: `« ${c.title} » : ${o.final_units ?? o.units} ${c.unit_label} vous ont été remis. Merci !`, url: `/achats-groupes/${c.id}`, i18n: { key: 'g.delivered', params: { title: c.title, units: o.final_units ?? o.units, unit: c.unit_label } } }); } catch { /* ignore */ }
      return NextResponse.json({ ok: true });
    }
    if (o.status !== 'pending_payment') return bad('already_resolved', 409);
    if (action === 'confirm_payment') {
      if (c.status !== 'open') return bad('campaign_closed', 409);
      const { data: moved } = await supabaseAdmin.from('campaign_orders').update({ status: 'paid', updated_at: now() }).eq('id', o.id).eq('status', 'pending_payment').select('id');
      if (!moved?.length) return bad('already_resolved', 409);
      try { await notifyUser(o.user_id, { title: '✅ Paiement confirmé', body: `Votre réservation de ${o.units} ${c.unit_label} pour « ${c.title} » est confirmée.`, url: `/achats-groupes/${c.id}`, i18n: { key: 'g.payment_confirmed', params: { title: c.title, units: o.units, unit: c.unit_label } } }); } catch { /* ignore */ }
      return NextResponse.json({ ok: true });
    }
    const note = str(body.note, 300);
    await supabaseAdmin.from('campaign_orders').update({ status: 'cancelled', note, updated_at: now() }).eq('id', o.id).eq('status', 'pending_payment');
    try { await notifyUser(o.user_id, { title: '❌ Paiement non confirmé', body: `Nous n'avons pas pu confirmer votre paiement pour « ${c.title} »${note ? ` : ${note}` : ''}. Votre réservation est annulée.`, url: `/achats-groupes/${c.id}`, i18n: { key: 'g.payment_rejected', params: { title: c.title, note: note ? ` : ${note}` : '' } } }); } catch { /* ignore */ }
    return NextResponse.json({ ok: true });
  }

  return bad('invalid_action');
}

export const GET = monitored('/api/admin/campaigns', GET_);
export const POST = monitored('/api/admin/campaigns', POST_);
