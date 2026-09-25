import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requirePerm } from '../../../../lib/admin-auth';
import { notifyUser } from '../../../../lib/notify';
import { sendMerchantEmail } from '../../../../lib/emails';
import { roleOf } from '../../../../lib/permissions';

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
export async function GET(request: Request) {
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
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));
  const shopMap: Record<string, string> = Object.fromEntries((profiles || []).map((m: any) => [m.user_id, m.shop_name]));
  const merchants = users.filter(u => roleOf(u.user_metadata) === 'producer');
  const t = today();

  const view = merchants.map(u => {
    const mine = (subs || []).filter((s: any) => s.user_id === u.id);
    const active = mine.find((s: any) => s.status === 'active' && s.ends_at >= t) || null;
    const pending = mine.find((s: any) => s.status === 'pending_payment') || null;
    const last = mine[0] || null;
    const req = (reqs || []).find((r: any) => r.email?.toLowerCase() === u.email?.toLowerCase() && r.status === 'approved');
    const mp = (prods || []).filter((p: any) => p.owner_id === u.id);
    const hadPeriod = mine.some((s: any) => s.status === 'active' || s.status === 'expired');
    const state = active ? 'active' : pending ? 'pending_payment' : last?.status === 'suspended' ? 'suspended' : hadPeriod ? 'expired' : 'none';
    return {
      id: u.id, email: u.email, name: nameOf(u), phone: u.user_metadata?.phone || null,
      farm_name: shopMap[u.id] || req?.farm_name || null, created_at: u.created_at,
      state, active, pending, last,
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
    requests: (reqs || []).filter((r: any) => r.status === 'pending'),
  });
}

// ── POST : actions ────────────────────────────────────────────────────────
export async function POST(request: Request) {
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
  async function notifyMerchant(userId: string, title: string, text: string, emailSubject?: string, url: string = '/producer/subscription') {
    try { await notifyUser(userId, { title, body: text, url }); } catch { /* ignore */ }
    if (emailSubject) {
      try {
        const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (data?.user?.email) await sendMerchantEmail(data.user.email, emailSubject, title, text);
      } catch { /* ignore */ }
    }
  }

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
      await notifyMerchant(user_id, '✅ Abonnement activé', `Votre abonnement « ${plan.name} » est actif du ${fmt(p.starts_at)} au ${fmt(p.ends_at)}. Vos produits validés sont visibles sur Hornafresh.`, 'Votre abonnement Hornafresh est actif');
      return NextResponse.json({ ok: true, ...p });
    }

    // Confirmation d'un paiement déclaré par le marchand
    if (action === 'confirm_payment' || action === 'reject_payment') {
      const { subscription_id, note } = body;
      const { data: sub } = await supabaseAdmin.from('merchant_subscriptions').select('*, merchant_plans(*)').eq('id', subscription_id).maybeSingle();
      if (!sub || sub.status !== 'pending_payment') return NextResponse.json({ error: 'already_resolved' }, { status: 409 });
      if (action === 'reject_payment') {
        await supabaseAdmin.from('merchant_subscriptions').update({ status: 'rejected', notes: note || null }).eq('id', subscription_id);
        await notifyMerchant(sub.user_id, '❌ Paiement non confirmé', `Nous n'avons pas pu confirmer votre paiement${note ? ` : ${note}` : ''}. Contactez-nous au 77 43 26 15.`, 'Hornafresh — paiement non confirmé');
        return NextResponse.json({ ok: true });
      }
      const duration = sub.merchant_plans?.duration_days || 30;
      const p = await periodFor(sub.user_id, duration);
      await supabaseAdmin.from('merchant_subscriptions').update({ status: 'active', starts_at: p.starts_at, ends_at: p.ends_at, paid_at: new Date().toISOString(), confirmed_by: auth.user.id, notes: note || null }).eq('id', subscription_id);
      await notifyMerchant(sub.user_id, '✅ Abonnement activé', `Paiement confirmé. Votre abonnement est actif du ${fmt(p.starts_at)} au ${fmt(p.ends_at)}.`, 'Votre abonnement Hornafresh est actif');
      return NextResponse.json({ ok: true, ...p });
    }

    if (action === 'suspend' || action === 'reactivate') {
      const { user_id, note } = body;
      const from = action === 'suspend' ? 'active' : 'suspended';
      const to = action === 'suspend' ? 'suspended' : 'active';
      const { data: rows } = await supabaseAdmin.from('merchant_subscriptions').update({ status: to, notes: note || null })
        .eq('user_id', user_id).eq('status', from).gte('ends_at', today()).select('id');
      if (!rows?.length) return NextResponse.json({ error: 'nothing_to_change' }, { status: 409 });
      await notifyMerchant(user_id,
        action === 'suspend' ? '⏸️ Abonnement suspendu' : '▶️ Abonnement réactivé',
        action === 'suspend' ? `Votre abonnement est suspendu${note ? ` : ${note}` : ''}. Vos produits ne sont plus visibles. Contactez-nous au 77 43 26 15.` : 'Votre abonnement est de nouveau actif : vos produits validés sont visibles.',
        action === 'suspend' ? 'Hornafresh — abonnement suspendu' : 'Hornafresh — abonnement réactivé');
      return NextResponse.json({ ok: true });
    }

    if (action === 'extend') {
      const { user_id, days } = body;
      const n = Math.max(1, Math.min(365, Number(days) || 7));
      const { data: cur } = await supabaseAdmin.from('merchant_subscriptions').select('id, ends_at')
        .eq('user_id', user_id).eq('status', 'active').gte('ends_at', today()).order('ends_at', { ascending: false }).limit(1).maybeSingle();
      if (!cur) return NextResponse.json({ error: 'no_active' }, { status: 409 });
      const ends_at = addDays(cur.ends_at, n);
      await supabaseAdmin.from('merchant_subscriptions').update({ ends_at }).eq('id', cur.id);
      await notifyMerchant(user_id, '🎁 Abonnement prolongé', `Votre abonnement est prolongé de ${n} jour(s), jusqu'au ${fmt(ends_at)}.`);
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
      if (prod.owner_id) await notifyMerchant(prod.owner_id,
        approve ? `✅ Produit validé : ${prod.name}` : `❌ Produit refusé : ${prod.name}`,
        approve ? 'Votre produit est publié sur Hornafresh (visible si votre abonnement est actif).' : `Motif : ${note || 'non précisé'}. Modifiez-le pour le soumettre à nouveau.`,
        undefined, '/producer/products');
      return NextResponse.json({ ok: true });
    }

    // Plans
    if (action === 'save_plan') {
      const { id, name, price_fdj, duration_days, is_active } = body;
      const row = { name: String(name || '').trim(), price_fdj: Number(price_fdj) || 0, duration_days: Math.max(1, Number(duration_days) || 30), is_active: is_active !== false };
      if (!row.name) return NextResponse.json({ error: 'Nom requis' }, { status: 400 });
      const { error } = id
        ? await supabaseAdmin.from('merchant_plans').update(row).eq('id', id)
        : await supabaseAdmin.from('merchant_plans').insert(row);
      if (error) throw error;
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
            `Bienvenue chez Hornafresh, ${req.farm_name} ! Prochaines étapes : 1) activez votre abonnement (Mon abonnement), 2) ajoutez vos produits (validés par Hornafresh), 3) recevez vos commandes et vos reversements.`,
            'Bienvenue chez Hornafresh — votre espace marchand', '/producer/subscription');
        } else {
          await notifyMerchant(user.id, 'Adhésion non retenue',
            `Votre demande pour « ${req.farm_name} » n'a pas été retenue pour le moment.${note ? ` Motif : ${note}.` : ''} Vous pouvez déposer une nouvelle demande ou nous appeler au 77 43 26 15.`,
            'Hornafresh — votre demande d\'adhésion', '/become-producer');
        }
      }
      return NextResponse.json({ ok: true, user_found: !!user });
    }

    return NextResponse.json({ error: 'action inconnue' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Erreur' }, { status: 500 });
  }
}
