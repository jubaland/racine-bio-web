import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-admin';
import { userFromRequest, membershipOf, requireCompany, companyBalance, minTopupFor, notifyCompany, fdj, ROLE_LABEL, type CompanyRole } from '../../../lib/company';
import { toIntlPhone } from '../../../lib/whatsapp';
import { nextDeliveryDate } from '../../../lib/subscription-schedule';
import { monitored } from '../../../lib/monitor';

// Espace entreprise — GET : tout l'état utile à la page ; POST { action, … } : une action.
// Écritures par service role après contrôle du rôle (gérant / acheteur / comptable).

const ROLES: CompanyRole[] = ['manager', 'buyer', 'accountant'];
const bad = (error: string, status = 400, extra: any = {}) => NextResponse.json({ error, ...extra }, { status });
const clean = (v: any, max = 200) => String(v ?? '').trim().slice(0, max);

async function GET_(request: Request) {
  const user = await userFromRequest(request);
  if (!user) return bad('unauthorized', 401);
  const m = await membershipOf(user.id);

  if (!m) {
    // Pas encore membre : invitations reçues (par e-mail) et, le cas échéant, réglage de recharge
    const { data: invites } = await supabaseAdmin.from('company_invites').select('id, role, created_at, companies(id, name, status)')
      .eq('status', 'pending').ilike('email', user.email || '∅');
    return NextResponse.json({ membership: null, invites: (invites || []).filter((i: any) => i.companies?.status === 'active') });
  }

  const cid = m.company_id;
  const canSeeMoney = m.role !== 'buyer';
  const [balance, { data: sites }, { data: members }, { data: invites }, { data: deposits }, { data: tx }, { data: requests }, { data: subs }, { data: subItems }] = await Promise.all([
    companyBalance(cid),
    supabaseAdmin.from('company_sites').select('*').eq('company_id', cid).order('is_default', { ascending: false }).order('created_at'),
    supabaseAdmin.from('company_members').select('user_id, role, email, full_name, created_at').eq('company_id', cid).order('created_at'),
    m.role === 'manager' ? supabaseAdmin.from('company_invites').select('id, email, role, created_at').eq('company_id', cid).eq('status', 'pending') : Promise.resolve({ data: [] as any[] }),
    canSeeMoney ? supabaseAdmin.from('company_deposit_requests').select('*').eq('company_id', cid).order('created_at', { ascending: false }).limit(30) : Promise.resolve({ data: [] as any[] }),
    canSeeMoney ? supabaseAdmin.from('company_wallet_transactions').select('*').eq('company_id', cid).order('created_at', { ascending: false }).limit(200) : Promise.resolve({ data: [] as any[] }),
    supabaseAdmin.from('company_order_requests').select('*').eq('company_id', cid).order('created_at', { ascending: false }).limit(50),
    supabaseAdmin.from('company_subscriptions').select('*').eq('company_id', cid),
    supabaseAdmin.from('company_subscription_items').select('frequency, product_id, quantity').eq('company_id', cid),
  ]);

  let oq = supabaseAdmin.from('orders')
    .select('id, user_id, total, delivery_fee, status, payment_method, address, customer_name, created_at, company_site_id, order_items ( id, product_id, quantity, price, product_name, product_unit, bundle_contents )')
    .eq('company_id', cid).order('created_at', { ascending: false }).limit(200);
  if (m.role === 'buyer') oq = oq.eq('user_id', user.id);
  const { data: orders } = await oq;

  const nameOf: Record<string, string> = Object.fromEntries((members || []).map((x: any) => [x.user_id, x.full_name || x.email || '—']));
  const today = new Date().toISOString().slice(0, 10);
  return NextResponse.json({
    membership: { role: m.role, user_id: user.id },
    company: m.company,
    balance, min_topup: await minTopupFor(m.company),
    sites: sites || [], members: members || [], invites: invites || [],
    deposits: deposits || [], transactions: tx || [],
    requests: (requests || []).filter((r: any) => m.role !== 'buyer' || r.user_id === user.id).map((r: any) => ({ ...r, buyer_name: nameOf[r.user_id] || '—' })),
    orders: (orders || []).map((o: any) => ({ ...o, buyer_name: nameOf[o.user_id] || '—' })),
    subscriptions: (subs || []).map((s: any) => ({ ...s, next_delivery: s.active && !s.paused ? nextDeliveryDate(s, today) : null, items: (subItems || []).filter((i: any) => i.frequency === s.frequency) })),
  });
}

async function POST_(request: Request) {
  let body: any = {};
  try { body = await request.json(); } catch { /* ignore */ }
  const action = String(body.action || '');
  const user = await userFromRequest(request);
  if (!user) return bad('unauthorized', 401);

  // ── Actions ouvertes à un utilisateur sans société ────────────────────────
  if (action === 'request') {
    if (await membershipOf(user.id)) return bad('already_member', 409);
    const name = clean(body.name, 120), address = clean(body.address, 300), contact = clean(body.contact_name || user.user_metadata?.full_name, 120);
    const phone = toIntlPhone(body.phone);
    if (!name || !address || !phone || !contact) return bad('missing_fields');
    const { data: company, error } = await supabaseAdmin.from('companies').insert({
      name, activity: clean(body.activity, 80) || null, tax_id: clean(body.tax_id, 60) || null,
      phone, email: clean(body.email || user.email, 160) || null, address, created_by: user.id, status: 'pending',
    }).select().single();
    if (error) return bad(error.message);
    await supabaseAdmin.from('company_members').insert({ company_id: company.id, user_id: user.id, role: 'manager', email: user.email, full_name: contact });
    await supabaseAdmin.from('company_sites').insert({ company_id: company.id, label: 'Siège', recipient_name: contact, phone: phone.startsWith('253') ? phone.slice(3) : phone, address, is_default: true });
    try {
      const { sendPushToAdmin } = await import('../../../lib/push');
      const { notifyUser } = await import('../../../lib/notify');
      await sendPushToAdmin({ title: '🏢 Nouvelle demande de compte entreprise', body: `${name}${body.activity ? ` (${clean(body.activity, 80)})` : ''} — ${contact}`, url: '/admin' });
      await notifyUser(user.id, { title: '📝 Demande de compte entreprise reçue', body: `Nous étudions la demande de « ${name} » et revenons vers vous rapidement.`, url: '/entreprise', i18n: { key: 'c.request_received', params: { name } } });
    } catch (e) { console.error('[company] request notify:', e); }
    return NextResponse.json({ ok: true, company });
  }

  if (action === 'accept_invite' || action === 'decline_invite') {
    const { data: inv } = await supabaseAdmin.from('company_invites').select('*, companies(id, name, status)').eq('id', body.invite_id).maybeSingle();
    if (!inv || inv.status !== 'pending' || String(inv.email).toLowerCase() !== String(user.email || '').toLowerCase()) return bad('invite_not_found', 404);
    if (action === 'decline_invite') { await supabaseAdmin.from('company_invites').update({ status: 'cancelled' }).eq('id', inv.id); return NextResponse.json({ ok: true }); }
    if (await membershipOf(user.id)) return bad('already_member', 409);
    const { error } = await supabaseAdmin.from('company_members').insert({ company_id: inv.company_id, user_id: user.id, role: inv.role, email: user.email, full_name: user.user_metadata?.full_name || null });
    if (error) return bad(error.message);
    await supabaseAdmin.from('company_invites').update({ status: 'accepted' }).eq('id', inv.id);
    await notifyCompany(inv.company_id, ['manager'], { title: '👤 Nouveau membre', body: `${user.user_metadata?.full_name || user.email} a rejoint ${(inv as any).companies?.name} (${ROLE_LABEL[inv.role as CompanyRole]}).`,
      i18n: { key: 'c.new_member', params: { who: String(user.user_metadata?.full_name || user.email), company: (inv as any).companies?.name, role: { key: `c.role_${inv.role}`, fr: ROLE_LABEL[inv.role as CompanyRole] } } } });
    return NextResponse.json({ ok: true });
  }

  // ── Actions des membres ───────────────────────────────────────────────────
  const managerOnly = ['update_company', 'invite', 'cancel_invite', 'set_role', 'remove_member', 'save_site', 'delete_site', 'deposit', 'cancel_deposit', 'decide_request', 'save_subscription'];
  const guard = await requireCompany(request, managerOnly.includes(action) ? ['manager'] : action === 'order_request' || action === 'cancel_request' ? ['manager', 'buyer'] : ROLES);
  if (!guard.ok) return bad(guard.error, guard.status);
  const { membership: m } = guard;
  const cid = m.company_id;

  switch (action) {
    case 'update_company': {
      const patch: any = {};
      if ('approval_threshold' in body) {
        const v = body.approval_threshold === '' || body.approval_threshold == null ? null : Number(body.approval_threshold);
        if (v != null && (isNaN(v) || v < 0)) return bad('threshold_invalid');
        patch.approval_threshold = v;
      }
      for (const k of ['activity', 'tax_id', 'email', 'address'] as const) if (k in body) patch[k] = clean(body[k], 300) || null;
      if ('phone' in body) { const p = toIntlPhone(body.phone); if (!p) return bad('phone_invalid'); patch.phone = p; }
      if (!Object.keys(patch).length) return bad('nothing_to_update');
      const { error } = await supabaseAdmin.from('companies').update(patch).eq('id', cid);
      return error ? bad(error.message) : NextResponse.json({ ok: true });
    }

    case 'invite': {
      const email = clean(body.email, 160).toLowerCase(), role = body.role as CompanyRole;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !ROLES.includes(role)) return bad('invite_invalid');
      const { data: already } = await supabaseAdmin.from('company_members').select('user_id').eq('company_id', cid).ilike('email', email).maybeSingle();
      if (already) return bad('already_member', 409);
      const { error } = await supabaseAdmin.from('company_invites').insert({ company_id: cid, email, role, invited_by: guard.user.id });
      if (error) return bad(/duplicate|unique/i.test(error.message) ? 'already_invited' : error.message, 409);
      try {
        const { sendMerchantEmail } = await import('../../../lib/emails');
        await sendMerchantEmail(email, `Invitation à rejoindre ${m.company.name} sur Hornafresh`, `🏢 ${m.company.name} vous invite`,
          `Vous êtes invité(e) à rejoindre le compte entreprise « ${m.company.name} » sur Hornafresh en tant que ${ROLE_LABEL[role]}. Connectez-vous (ou créez un compte) avec cette adresse e-mail, puis ouvrez « Mon entreprise » pour accepter : https://www.hornafresh.com/entreprise`);
      } catch (e) { console.error('[company] invite email:', e); }
      return NextResponse.json({ ok: true });
    }
    case 'cancel_invite': {
      await supabaseAdmin.from('company_invites').update({ status: 'cancelled' }).eq('id', body.invite_id).eq('company_id', cid).eq('status', 'pending');
      return NextResponse.json({ ok: true });
    }
    case 'set_role':
    case 'remove_member': {
      const target = String(body.user_id || '');
      const { data: mem } = await supabaseAdmin.from('company_members').select('user_id, role').eq('company_id', cid);
      const tm = (mem || []).find((x: any) => x.user_id === target);
      if (!tm) return bad('member_not_found', 404);
      const managers = (mem || []).filter((x: any) => x.role === 'manager').length;
      const losesManager = tm.role === 'manager' && (action === 'remove_member' || body.role !== 'manager');
      if (losesManager && managers <= 1) return bad('last_manager', 409);   // une société garde toujours un gérant
      if (action === 'remove_member') await supabaseAdmin.from('company_members').delete().eq('company_id', cid).eq('user_id', target);
      else { if (!ROLES.includes(body.role)) return bad('role_invalid'); await supabaseAdmin.from('company_members').update({ role: body.role }).eq('company_id', cid).eq('user_id', target); }
      return NextResponse.json({ ok: true });
    }
    case 'leave': {
      const { data: mem } = await supabaseAdmin.from('company_members').select('user_id, role').eq('company_id', cid);
      if (m.role === 'manager' && (mem || []).filter((x: any) => x.role === 'manager').length <= 1) return bad('last_manager', 409);
      await supabaseAdmin.from('company_members').delete().eq('company_id', cid).eq('user_id', guard.user.id);
      return NextResponse.json({ ok: true });
    }

    case 'save_site': {
      const row = { label: clean(body.label, 60), recipient_name: clean(body.recipient_name, 120), address: clean(body.address, 300), phone: String(body.phone || '').replace(/\D/g, '').slice(-8) };
      if (!row.label || !row.recipient_name || !row.address || row.phone.length !== 8) return bad('site_invalid');
      if (body.is_default) await supabaseAdmin.from('company_sites').update({ is_default: false }).eq('company_id', cid);
      const q = body.id
        ? supabaseAdmin.from('company_sites').update({ ...row, ...(body.is_default ? { is_default: true } : {}) }).eq('id', body.id).eq('company_id', cid)
        : supabaseAdmin.from('company_sites').insert({ ...row, company_id: cid, is_default: !!body.is_default });
      const { error } = await q;
      return error ? bad(error.message) : NextResponse.json({ ok: true });
    }
    case 'delete_site': {
      const { count } = await supabaseAdmin.from('company_sites').select('id', { count: 'exact', head: true }).eq('company_id', cid);
      if ((count || 0) <= 1) return bad('last_site', 409);
      await supabaseAdmin.from('company_sites').delete().eq('id', body.id).eq('company_id', cid);
      return NextResponse.json({ ok: true });
    }

    case 'deposit': {
      const amount = Math.round(Number(body.amount));
      const method = ['waafi', 'cash', 'transfer', 'cheque'].includes(body.method) ? body.method : 'waafi';
      const min = await minTopupFor(m.company);
      if (!amount || amount <= 0) return bad('amount_invalid');
      if (amount < min) return bad('below_min_topup', 400, { min_topup: min });
      const { data: reqRow, error } = await supabaseAdmin.from('company_deposit_requests')
        .insert({ company_id: cid, user_id: guard.user.id, amount, method, reference: clean(body.reference, 80) || null }).select().single();
      if (error) return bad(error.message);
      try {
        const { sendPushToAdmin } = await import('../../../lib/push');
        await sendPushToAdmin({ title: '🏢 Recharge entreprise à valider', body: `${m.company.name} — ${fdj(amount)} (${method}${reqRow.reference ? `, réf. ${reqRow.reference}` : ''})`, url: '/admin' });
      } catch (e) { console.error('[company] deposit notify:', e); }
      return NextResponse.json({ ok: true, request: reqRow });
    }
    case 'cancel_deposit': {
      await supabaseAdmin.from('company_deposit_requests').delete().eq('id', body.id).eq('company_id', cid).eq('status', 'pending');
      return NextResponse.json({ ok: true });
    }

    // Acheteur au-delà du seuil : le panier devient une demande à valider (rien n'est réservé ni débité)
    case 'order_request': {
      const items = Array.isArray(body.items) ? body.items : [];
      if (!items.length) return bad('empty_order');
      const { data: site } = await supabaseAdmin.from('company_sites').select('id').eq('id', body.site_id).eq('company_id', cid).maybeSingle();
      if (!site) return bad('site_required');
      const total = items.reduce((s: number, i: any) => s + Number(i.price) * Number(i.quantity), 0) + (Number(body.delivery?.fee) || 0);
      const { data: row, error } = await supabaseAdmin.from('company_order_requests').insert({
        company_id: cid, user_id: guard.user.id, site_id: site.id, total,
        items: items.map((i: any) => ({ product_id: i.product_id, quantity: Number(i.quantity), price: Number(i.price), product_name: i.product_name ?? null, product_image_url: i.product_image_url ?? null, product_unit: i.product_unit ?? null, product_farm: i.product_farm ?? null })),
        delivery: { fee: Number(body.delivery?.fee) || 0, option_name: body.delivery?.option_name ?? null, special_instructions: clean(body.delivery?.special_instructions, 500) || null },
      }).select().single();
      if (error) return bad(error.message);
      await notifyCompany(cid, ['manager'], { title: `🧾 Commande à valider — ${fdj(total)}`, body: `${guard.user.user_metadata?.full_name || guard.user.email} demande une commande de ${items.length} article(s) pour ${m.company.name}.`,
        i18n: { key: 'c.order_to_validate', params: { total: fdj(total), who: String(guard.user.user_metadata?.full_name || guard.user.email), n: items.length, company: m.company.name } } });
      return NextResponse.json({ ok: true, request: row });
    }
    case 'cancel_request': {
      let q = supabaseAdmin.from('company_order_requests').update({ status: 'cancelled', decided_at: new Date().toISOString() }).eq('id', body.id).eq('company_id', cid).eq('status', 'awaiting');
      if (m.role === 'buyer') q = q.eq('user_id', guard.user.id);
      await q;
      return NextResponse.json({ ok: true });
    }
    case 'decide_request': {
      const { data: row } = await supabaseAdmin.from('company_order_requests').select('*').eq('id', body.id).eq('company_id', cid).maybeSingle();
      if (!row || row.status !== 'awaiting') return bad('request_not_awaiting', 409);
      const { notifyUser } = await import('../../../lib/notify');
      if (body.decision === 'reject') {
        await supabaseAdmin.from('company_order_requests').update({ status: 'rejected', decided_by: guard.user.id, decided_at: new Date().toISOString(), decision_note: clean(body.note, 300) || null }).eq('id', row.id);
        try { await notifyUser(row.user_id, { title: '❌ Commande refusée par le gérant', body: `Votre demande de ${fdj(row.total)} n'a pas été validée${body.note ? ` : ${clean(body.note, 200)}` : ''}.`, url: '/entreprise', i18n: { key: 'c.order_rejected', params: { total: fdj(row.total), note: body.note ? ` : ${clean(body.note, 200)}` : '' } } }); } catch { /* ignore */ }
        return NextResponse.json({ ok: true });
      }
      // Validation : la vraie commande est créée par l'API commande (prix serveur, stock, débit atomique)
      const { POST: createOrder } = await import('../orders/route');
      const res = await createOrder(new Request(new URL('/api/orders', request.url), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: request.headers.get('authorization') || '' },
        body: JSON.stringify({ order: { payment_method: 'company_wallet' }, items: row.items, company: { request_id: row.id } }),
      }));
      const j = await res.json();
      if (!res.ok) return bad(j.error || 'order_failed', res.status, j);
      try { await notifyUser(row.user_id, { title: '✅ Commande validée par le gérant', body: `Votre commande #${j.order?.id} (${fdj(j.order?.total)}) est confirmée.`, url: '/entreprise', i18n: { key: 'c.order_validated', params: { id: j.order?.id, total: fdj(j.order?.total) } } }); } catch { /* ignore */ }
      return NextResponse.json({ ok: true, order: j.order });
    }

    case 'save_subscription': {
      const frequency = String(body.frequency);
      if (!['weekly', 'fortnightly', 'monthly'].includes(frequency)) return bad('frequency_invalid');
      const items = (Array.isArray(body.items) ? body.items : []).map((i: any) => ({ product_id: Number(i.product_id), quantity: Number(i.quantity) })).filter((i: any) => i.product_id && i.quantity > 0);
      const active = !!body.active;
      if (active && !items.length) return bad('empty_order');
      const { data: site } = await supabaseAdmin.from('company_sites').select('id').eq('id', body.site_id).eq('company_id', cid).maybeSingle();
      if (active && !site) return bad('site_required');
      const day = Number(body.delivery_day);
      if (!(day >= 0 && day <= 6)) return bad('day_invalid');
      const { error } = await supabaseAdmin.from('company_subscriptions').upsert({
        company_id: cid, frequency, site_id: site?.id ?? null, delivery_day: day, active, paused: false, paused_reason: null,
        updated_by: guard.user.id, updated_at: new Date().toISOString(),
      }, { onConflict: 'company_id,frequency' });
      if (error) return bad(error.message);
      await supabaseAdmin.from('company_subscription_items').delete().eq('company_id', cid).eq('frequency', frequency);
      if (items.length) await supabaseAdmin.from('company_subscription_items').insert(items.map((i: any) => ({ ...i, company_id: cid, frequency })));
      return NextResponse.json({ ok: true });
    }
  }
  return bad('action_invalid');
}

// Surveillance : exceptions et réponses 5xx enregistrées (lib/monitor.ts)
export const GET = monitored('/api/company', GET_);
export const POST = monitored('/api/company', POST_);
