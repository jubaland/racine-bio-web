import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requirePerm } from '../../../../lib/admin-auth';
import { notifyUser } from '../../../../lib/notify';
import { sendMerchantEmail } from '../../../../lib/emails';
import { roleOf } from '../../../../lib/permissions';
import { merchantState, formulasOf, commissionSettings, saveCommissionSettings, effectiveRate, switchToCommission, switchToSubscription, merchantDelays, saveMerchantDelays, MERCHANT_DELAY_KEYS, MERCHANT_DELAY_MAX } from '../../../../lib/merchant-formula';
import { notifyWithEmail } from '../../../../lib/notify';
import type { I18n } from '../../../../lib/i18n-server';
import { monitored } from '../../../../lib/monitor';

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d: string, n: number) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const fmt = (d: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

async function allUsers() {
  const users: any[] = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) break;
    users.push(...(data?.users || []));
    if ((data?.users || []).length < 1000) break;
  }
  return users;
}
const nameOf = (u: any) => u?.user_metadata?.full_name || u?.email || '—';

// ── GET : vue d'ensemble ──────────────────────────────────────────────────
async function GET_(request: Request) {
  const auth = await requirePerm(request, 'merchants', 'view');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const [users, { data: subs }, { data: plans }, { data: prods }, { data: reqs }, { data: profiles }] = await Promise.all([
    allUsers(),
    supabaseAdmin.from('merchant_subscriptions').select('*').order('created_at', { ascending: false }),
    supabaseAdmin.from('merchant_plans').select('*').order('id'),
    supabaseAdmin.from('products').select('id, name, price, old_price, unit, image_url, status, owner_id, review_note, created_at, description, category, product_type, origin_country, region, stock_qty, is_local').not('owner_id', 'is', null),
    supabaseAdmin.from('producer_requests').select('*').order('created_at', { ascending: false }),
    supabaseAdmin.from('merchant_profiles').select('user_id, shop_name'),
  ]);
  const commission = await commissionSettings();
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));
  const shopMap: Record<string, string> = Object.fromEntries((profiles || []).map((m: any) => [m.user_id, m.shop_name]));
  const merchants = users.filter(u => roleOf(u.user_metadata) === 'producer');
  const t = today();
  const formulas = await formulasOf(merchants.map(u => u.id));

  const view = merchants.map(u => {
    const mine = (subs || []).filter((s: any) => s.user_id === u.id);
    const f = formulas[u.id] || null;
    const ms = merchantState(mine, f, t);           // règle unique (abonnement + formule commission)
    const { active, pending, last } = ms;
    const req = (reqs || []).find((r: any) => r.email?.toLowerCase() === u.email?.toLowerCase() && r.status === 'approved');
    const mp = (prods || []).filter((p: any) => p.owner_id === u.id);
    const state = ms.state === 'pending' ? 'pending_payment' : ms.state;
    return {
      id: u.id, email: u.email, name: nameOf(u), phone: u.user_metadata?.phone || null,
      farm_name: shopMap[u.id] || req?.farm_name || null, created_at: u.created_at,
      state, active, pending, last,
      // Formule en vigueur (un abonnement payé en cours prime), taux appliqué, taux particulier, changement demandé
      formula: { kind: ms.kind, chosen: f?.kind || 'subscription', rate: ms.kind === 'commission' ? effectiveRate(f, commission.rate) : 0, custom_rate: f?.commission_rate ?? null, pending_kind: f?.pending_kind || null, status: f?.status || 'active', since: f?.since || null },
      products: { total: mp.length, published: mp.filter((p: any) => p.status === 'published').length, pending: mp.filter((p: any) => p.status === 'pending_review').length },
    };
  });

  const withMerchant = (s: any) => ({ ...s, merchant: { id: s.user_id, name: nameOf(userMap[s.user_id]), email: userMap[s.user_id]?.email || null } });
  return NextResponse.json({
    merchants: view,
    pending_payments: (subs || []).filter((s: any) => s.status === 'pending_payment').map(withMerchant),
    pending_products: (prods || []).filter((p: any) => p.status === 'pending_review')
      .map((p: any) => ({ ...p, merchant: { id: p.owner_id, name: shopMap[p.owner_id] ? `${shopMap[p.owner_id]} — ${nameOf(userMap[p.owner_id])}` : nameOf(userMap[p.owner_id]) } })),
    plans: plans || [],
    commission,                                   // { enabled, rate } — réglage général de la formule commission
    delays: await merchantDelays(),               // rappels, alerte paiement, prolongation rapide (jours ; null = désactivé)
    requests: (reqs || []).filter((r: any) => r.status === 'pending'),
  });
}

// ── POST : actions ────────────────────────────────────────────────────────
async function POST_(request: Request) {
  let body: any = {};
  try { body = await request.json(); } catch { /* ignore */ }
  const { action } = body;
  // Les adhésions sont aussi gérables avec le droit « Demandes producteurs »
  const modules = (action === 'approve_request' || action === 'reject_request') ? ['merchants', 'requests'] : ['merchants'];
  const auth = await requirePerm(request, modules, 'edit');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // Période : commence après l'abonnement actif éventuel, sinon aujourd'hui
  async function periodFor(userId: string, durationDays: number) {
    const { data: cur } = await supabaseAdmin.from('merchant_subscriptions').select('ends_at')
      .eq('user_id', userId).eq('status', 'active').gte('ends_at', today()).order('ends_at', { ascending: false }).limit(1).maybeSingle();
    const starts_at = cur?.ends_at ? addDays(cur.ends_at, 1) : today();
    return { starts_at, ends_at: addDays(starts_at, durationDays - 1) };
  }
  // url : page ouverte au clic sur la notification (abonnement par défaut ; produits / tableau de bord selon le cas)
  // i18n : modèle traduit du message (srv.m.*) ; le marchand le reçoit dans la langue de son compte
  async function notifyMerchant(userId: string, title: string, text: string, emailSubject?: string, url: string = '/producer/subscription', i18n?: I18n) {
    try { await notifyWithEmail(userId, { title, body: text, url, subject: emailSubject || null, i18n }); } catch { /* ignore */ }
  }
  const noteP = (note: string | null | undefined) => (note ? ` : ${note}` : '');

  // Enseigne : source unique (merchant_profiles) + instantané `farm` sur les fiches du marchand
  async function setShopName(userId: string, shopName: string) {
    const { error } = await supabaseAdmin.from('merchant_profiles')
      .upsert({ user_id: userId, shop_name: shopName, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) throw error;
    await supabaseAdmin.from('products').update({ farm: shopName }).eq('owner_id', userId);
  }

  try {
    // Enseigne affichée sur les cartes (« 🏪 Boutique Zak »)
    if (action === 'set_shop_name') {
      const { user_id, shop_name } = body;
      const name = String(shop_name || '').trim().slice(0, 60);
      if (!user_id || name.length < 2) return NextResponse.json({ error: 'Enseigne invalide (2 caractères minimum)' }, { status: 400 });
      await setShopName(user_id, name);
      return NextResponse.json({ ok: true });
    }

    // Activation directe (paiement reçu hors ligne : espèces / Waafi vérifié)
    if (action === 'grant') {
      const { user_id, plan_id, payment_method, reference } = body;
      const { data: plan } = await supabaseAdmin.from('merchant_plans').select('*').eq('id', plan_id).maybeSingle();
      if (!plan) return NextResponse.json({ error: 'Plan introuvable' }, { status: 400 });
      const p = await periodFor(user_id, plan.duration_days);
      const { error } = await supabaseAdmin.from('merchant_subscriptions').insert({
        user_id, plan_id: plan.id, amount: plan.price_fdj, status: 'active', starts_at: p.starts_at, ends_at: p.ends_at,
        payment_method: payment_method || 'cash', payment_reference: reference || null, paid_at: new Date().toISOString(), confirmed_by: auth.user.id,
      });
      if (error) throw error;
      await switchToSubscription(user_id);          // une période payée remet le marchand en formule abonnement
      await notifyMerchant(user_id, '✅ Abonnement activé', `Votre abonnement « ${plan.name} » est actif du ${fmt(p.starts_at)} au ${fmt(p.ends_at)}. Vos produits validés sont visibles sur Hornafresh.`, 'Votre abonnement Hornafresh est actif', undefined,
        { key: 'm.sub_activated_plan', params: { plan: plan.name, from: { date: p.starts_at }, to: { date: p.ends_at } } });
      return NextResponse.json({ ok: true, ...p });
    }

    // Confirmation d'un paiement déclaré par le marchand
    if (action === 'confirm_payment' || action === 'reject_payment') {
      const { subscription_id, note } = body;
      const { data: sub } = await supabaseAdmin.from('merchant_subscriptions').select('*, merchant_plans(*)').eq('id', subscription_id).maybeSingle();
      if (!sub || sub.status !== 'pending_payment') return NextResponse.json({ error: 'already_resolved' }, { status: 409 });
      if (action === 'reject_payment') {
        await supabaseAdmin.from('merchant_subscriptions').update({ status: 'rejected', notes: note || null }).eq('id', subscription_id);
        await notifyMerchant(sub.user_id, '❌ Paiement non confirmé', `Nous n'avons pas pu confirmer votre paiement${note ? ` : ${note}` : ''}. Contactez-nous au 77 09 21 46.`, 'Hornafresh — paiement non confirmé', undefined, { key: 'm.payment_rejected', params: { note: noteP(note) } });
        return NextResponse.json({ ok: true });
      }
      const duration = Number(sub.merchant_plans?.duration_days);
      if (!(duration >= 1)) return NextResponse.json({ error: 'plan_duration_missing' }, { status: 400 });
      const p = await periodFor(sub.user_id, duration);
      await supabaseAdmin.from('merchant_subscriptions').update({ status: 'active', starts_at: p.starts_at, ends_at: p.ends_at, paid_at: new Date().toISOString(), confirmed_by: auth.user.id, notes: note || null }).eq('id', subscription_id);
      await switchToSubscription(sub.user_id);      // une période payée remet le marchand en formule abonnement
      await notifyMerchant(sub.user_id, '✅ Abonnement activé', `Paiement confirmé. Votre abonnement est actif du ${fmt(p.starts_at)} au ${fmt(p.ends_at)}.`, 'Votre abonnement Hornafresh est actif', undefined,
        { key: 'm.sub_activated', params: { from: { date: p.starts_at }, to: { date: p.ends_at } } });
      return NextResponse.json({ ok: true, ...p });
    }

    if (action === 'suspend' || action === 'reactivate') {
      const { user_id, note } = body;
      const from = action === 'suspend' ? 'active' : 'suspended';
      const to = action === 'suspend' ? 'suspended' : 'active';
      const { data: rows } = await supabaseAdmin.from('merchant_subscriptions').update({ status: to, notes: note || null })
        .eq('user_id', user_id).eq('status', from).gte('ends_at', today()).select('id');
      if (!rows?.length) {
        // Marchand en formule commission : la suspension porte sur la formule
        const { data: frows } = await supabaseAdmin.from('merchant_formulas').update({ status: to, note: note || null, updated_at: new Date().toISOString() })
          .eq('user_id', user_id).eq('kind', 'commission').eq('status', from).select('user_id');
        if (!frows?.length) return NextResponse.json({ error: 'nothing_to_change' }, { status: 409 });
        await notifyMerchant(user_id,
          action === 'suspend' ? '⏸️ Boutique suspendue' : '▶️ Boutique réactivée',
          action === 'suspend' ? `Votre boutique est suspendue${note ? ` : ${note}` : ''}. Vos produits ne sont plus visibles. Contactez-nous au 77 09 21 46.` : 'Votre boutique est de nouveau active : vos produits validés sont visibles.',
          action === 'suspend' ? 'Hornafresh — boutique suspendue' : 'Hornafresh — boutique réactivée', undefined,
          { key: action === 'suspend' ? 'm.shop_suspended' : 'm.shop_reactivated', params: { note: noteP(note) } });
        return NextResponse.json({ ok: true });
      }
      await notifyMerchant(user_id,
        action === 'suspend' ? '⏸️ Abonnement suspendu' : '▶️ Abonnement réactivé',
        action === 'suspend' ? `Votre abonnement est suspendu${note ? ` : ${note}` : ''}. Vos produits ne sont plus visibles. Contactez-nous au 77 09 21 46.` : 'Votre abonnement est de nouveau actif : vos produits validés sont visibles.',
        action === 'suspend' ? 'Hornafresh — abonnement suspendu' : 'Hornafresh — abonnement réactivé', undefined,
        { key: action === 'suspend' ? 'm.sub_suspended' : 'm.sub_reactivated', params: { note: noteP(note) } });
      return NextResponse.json({ ok: true });
    }

    if (action === 'extend') {
      const { user_id, days } = body;
      // Durée demandée, sinon celle du réglage « prolongation rapide » ; aucune valeur par défaut
      const wanted = days != null && days !== '' ? Number(days) : (await merchantDelays()).extend_days;
      const n = Math.round(Number(wanted));
      if (!(n >= 1 && n <= MERCHANT_DELAY_MAX)) return NextResponse.json({ error: 'Durée de prolongation non définie' }, { status: 400 });
      const { data: cur } = await supabaseAdmin.from('merchant_subscriptions').select('id, ends_at')
        .eq('user_id', user_id).eq('status', 'active').gte('ends_at', today()).order('ends_at', { ascending: false }).limit(1).maybeSingle();
      if (!cur) return NextResponse.json({ error: 'no_active' }, { status: 409 });
      const ends_at = addDays(cur.ends_at, n);
      await supabaseAdmin.from('merchant_subscriptions').update({ ends_at }).eq('id', cur.id);
      await notifyMerchant(user_id, '🎁 Abonnement prolongé', `Votre abonnement est prolongé de ${n} jour(s), jusqu'au ${fmt(ends_at)}.`, undefined, undefined,
        { key: 'm.sub_extended', params: { n, to: { date: ends_at } } });
      return NextResponse.json({ ok: true, ends_at });
    }

    // Modération des produits
    if (action === 'approve_product' || action === 'reject_product') {
      const { product_id, note } = body;
      const { data: prod } = await supabaseAdmin.from('products').select('id, name, owner_id, status').eq('id', product_id).maybeSingle();
      if (!prod) return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });
      const approve = action === 'approve_product';
      await supabaseAdmin.from('products').update({
        status: approve ? 'published' : 'rejected', review_note: approve ? null : (note || null), reviewed_at: new Date().toISOString(),
      }).eq('id', product_id);
      // Validation : les langues encore vides reprennent le nom traduit d'un produit homonyme du catalogue
      let translated = 0;
      if (approve) {
        try { const { applySuggestions } = await import('../../../../lib/product-translations'); const r = await applySuggestions({ id: prod.id, name: prod.name }); if (r.ok) translated = r.saved; }
        catch (e) { console.error('[merchants] traductions produit:', e); }
      }
      if (prod.owner_id) await notifyMerchant(prod.owner_id,
        approve ? `✅ Produit validé : ${prod.name}` : `❌ Produit refusé : ${prod.name}`,
        approve ? 'Votre produit est publié sur Hornafresh (visible tant que votre formule est active).' : `Motif : ${note || 'non précisé'}. Modifiez-le pour le soumettre à nouveau.`,
        undefined, '/producer/products',
        { key: approve ? 'm.product_approved' : 'm.product_rejected', params: { name: prod.name, note: note ? String(note) : { key: 'm.note_none', fr: 'non précisé' } } });
      return NextResponse.json({ ok: true, translated });
    }

    // Plans
    if (action === 'save_plan') {
      const { id, name, price_fdj, duration_days, is_active } = body;
      // Aucune valeur par défaut : prix et durée sont saisis par l'admin
      const price = Number(price_fdj), duration = Math.round(Number(duration_days));
      if (price_fdj === '' || price_fdj == null || isNaN(price) || price < 0) return NextResponse.json({ error: 'Prix requis' }, { status: 400 });
      if (!(duration >= 1)) return NextResponse.json({ error: 'Durée requise (en jours)' }, { status: 400 });
      const row = { name: String(name || '').trim(), price_fdj: price, duration_days: duration, is_active: is_active !== false };
      if (!row.name) return NextResponse.json({ error: 'Nom requis' }, { status: 400 });
      const { error } = id
        ? await supabaseAdmin.from('merchant_plans').update(row).eq('id', id)
        : await supabaseAdmin.from('merchant_plans').insert(row);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    // Délais : rappels avant échéance, alerte paiement déclaré, prolongation rapide (vide = désactivé)
    if (action === 'save_delays') {
      const patch: Record<string, number | null> = {};
      for (const k of MERCHANT_DELAY_KEYS) {
        if (!(k in body)) continue;
        const raw = body[k];
        if (raw === '' || raw == null) { patch[k] = null; continue; }
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 1 || n > MERCHANT_DELAY_MAX) return NextResponse.json({ error: `Valeur invalide (nombre entier de jours, de 1 à ${MERCHANT_DELAY_MAX})`, field: k }, { status: 400 });
        patch[k] = n;
      }
      const next = { ...(await merchantDelays()), ...patch };
      if (next.reminder_first_days != null && next.reminder_last_days != null && next.reminder_last_days >= next.reminder_first_days)
        return NextResponse.json({ error: 'Le dernier rappel doit être plus proche de l\'échéance que le premier', field: 'reminder_last_days' }, { status: 400 });
      await saveMerchantDelays(patch);
      return NextResponse.json({ ok: true, delays: await merchantDelays() });
    }

    // Formule commission : réglage général (proposée ou non, taux en %)
    if (action === 'save_commission') {
      const patch: { enabled?: boolean; rate?: number } = {};
      if ('enabled' in body) patch.enabled = !!body.enabled;
      if ('rate' in body) {
        const r = Number(body.rate);
        if (body.rate === '' || body.rate == null || isNaN(r) || r < 0 || r > 100) return NextResponse.json({ error: 'Taux invalide (0 à 100)' }, { status: 400 });
        patch.rate = Math.round(r * 100) / 100;
      }
      await saveCommissionSettings(patch);
      return NextResponse.json({ ok: true, commission: await commissionSettings() });
    }

    // Taux particulier d'un marchand (vide = taux général). S'applique aux prochaines commandes.
    if (action === 'set_commission_rate') {
      const { user_id } = body;
      const raw = body.rate;
      const rate = raw === '' || raw == null ? null : Number(raw);
      if (!user_id || (rate != null && (isNaN(rate) || rate < 0 || rate > 100))) return NextResponse.json({ error: 'Taux invalide (0 à 100)' }, { status: 400 });
      const { data: existing } = await supabaseAdmin.from('merchant_formulas').select('user_id').eq('user_id', user_id).maybeSingle();
      const { error } = existing
        ? await supabaseAdmin.from('merchant_formulas').update({ commission_rate: rate, updated_at: new Date().toISOString() }).eq('user_id', user_id)
        : await supabaseAdmin.from('merchant_formulas').insert({ user_id, kind: 'subscription', commission_rate: rate });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    // Formule d'un marchand décidée par l'admin (immédiat)
    if (action === 'set_formula') {
      const { user_id, kind } = body;
      if (!user_id || !['subscription', 'commission'].includes(kind)) return NextResponse.json({ error: 'Formule invalide' }, { status: 400 });
      if (kind === 'commission') {
        const r = await switchToCommission(user_id, { force: true, note: 'Décision Hornafresh' });
        if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
        await notifyMerchant(user_id, '🤝 Formule commission activée', `Vous êtes en formule commission : ${r.rate} % retenus sur vos ventes livrées, rien à payer d'avance. Vos produits validés sont visibles.`, 'Hornafresh — formule commission', undefined, { key: 'm.com_activated', params: { rate: r.rate } });
        return NextResponse.json({ ok: true, rate: r.rate });
      }
      await switchToSubscription(user_id);
      await notifyMerchant(user_id, '💳 Formule abonnement', 'Vous êtes en formule abonnement : vos produits sont visibles pendant les périodes réglées. Activez une période depuis « Ma formule ».', 'Hornafresh — formule abonnement', undefined, { key: 'm.formula_sub' });
      return NextResponse.json({ ok: true });
    }

    // Adhésions : approuver = statut + rôle marchand sur le compte
    if (action === 'approve_request' || action === 'reject_request') {
      const { request_id, note } = body;
      const { data: req } = await supabaseAdmin.from('producer_requests').select('*').eq('id', request_id).maybeSingle();
      if (!req) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 });
      if (req.status !== 'pending') return NextResponse.json({ error: 'already_resolved' }, { status: 409 });
      const approve = action === 'approve_request';
      await supabaseAdmin.from('producer_requests').update({
        status: approve ? 'approved' : 'rejected', admin_note: note ? String(note).slice(0, 300) : null, resolved_at: new Date().toISOString(),
      }).eq('id', request_id);
      // Compte rattaché : par user_id (nouveau flux) sinon par e-mail (anciennes demandes)
      const user = req.user_id
        ? (await supabaseAdmin.auth.admin.getUserById(req.user_id)).data?.user || null
        : (await allUsers()).find(u => u.email?.toLowerCase() === req.email?.toLowerCase()) || null;
      if (user) {
        if (approve) {
          await supabaseAdmin.auth.admin.updateUserById(user.id, { user_metadata: { ...(user.user_metadata || {}), role: 'producer', ...(req.phone && !user.user_metadata?.phone ? { phone: req.phone } : {}) } });
          // Enseigne initiale = enseigne déclarée (modifiable ensuite dans le module Marchands)
          const { data: existing } = await supabaseAdmin.from('merchant_profiles').select('user_id').eq('user_id', user.id).maybeSingle();
          if (!existing) await setShopName(user.id, (req.farm_name || '').trim() || `Boutique ${nameOf(user)}`);
          await notifyMerchant(user.id, '🎉 Adhésion acceptée',
            `Bienvenue chez Hornafresh, ${req.farm_name} ! Prochaines étapes : 1) choisissez votre formule, abonnement ou commission (Ma formule), 2) ajoutez vos produits (validés par Hornafresh), 3) recevez vos commandes et vos reversements.`,
            'Bienvenue chez Hornafresh — votre espace marchand', '/producer/subscription', { key: 'm.join_accepted', params: { shop: req.farm_name } });
        } else {
          await notifyMerchant(user.id, 'Adhésion non retenue',
            `Votre demande pour « ${req.farm_name} » n'a pas été retenue pour le moment.${note ? ` Motif : ${note}.` : ''} Vous pouvez déposer une nouvelle demande ou nous appeler au 77 09 21 46.`,
            'Hornafresh — votre demande d\'adhésion', '/become-producer',
            { key: 'm.join_rejected', params: { shop: req.farm_name, reason: note ? { key: 'm.reason', params: { note: String(note) }, fr: ` Motif : ${note}.` } : null } });
        }
      }
      return NextResponse.json({ ok: true, user_found: !!user });
    }

    return NextResponse.json({ error: 'action inconnue' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Erreur' }, { status: 500 });
  }
}

// Surveillance : exceptions et réponses 5xx enregistrées (lib/monitor.ts)
export const GET = monitored('/api/admin/merchants', GET_);
export const POST = monitored('/api/admin/merchants', POST_);
