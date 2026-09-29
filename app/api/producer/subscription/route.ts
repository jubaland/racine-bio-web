import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requireMerchant } from '../../../../lib/producer-auth';
import { notifyUser } from '../../../../lib/notify';
import { WAAFI_MERCHANT_NUMBER, WAAFI_ACCOUNT_HOLDER } from '../../../../lib/payments';
import { merchantState, formulasOf, commissionSettings, switchToCommission } from '../../../../lib/merchant-formula';
import { monitored } from '../../../../lib/monitor';

// Espace marchand — « Ma formule » (abonnement ou commission)
// Le marchand ne fait que DÉCLARER un paiement (ligne pending_payment) ; l'activation
// reste une décision admin (confirm_payment dans /api/admin/merchants). Aucune activation ici.

const today = () => new Date().toISOString().slice(0, 10);

async function merchantFromRequest(request: Request) {
  const a = await requireMerchant(request);
  return a.ok ? ({ user: a.user } as const) : ({ error: a.error, status: a.status } as const);
}

async function overview(userId: string) {
  const [{ data: subs }, { data: plans }, { data: profile }, formulas, commission] = await Promise.all([
    supabaseAdmin.from('merchant_subscriptions').select('*, merchant_plans(name, duration_days)').eq('user_id', userId).order('created_at', { ascending: false }),
    supabaseAdmin.from('merchant_plans').select('*').eq('is_active', true).order('price_fdj'),
    supabaseAdmin.from('merchant_profiles').select('shop_name').eq('user_id', userId).maybeSingle(),
    formulasOf([userId]),
    commissionSettings(),
  ]);
  const list = subs || [];
  const f = formulas[userId] || null;
  // Règle unique d'état (lib/merchant-formula) : abonnement payé en cours, sinon formule commission
  const ms = merchantState(list, f, today());
  const named = (s: any) => s ? { ...s, plan_name: s.merchant_plans?.name || null, merchant_plans: undefined } : null;
  const { state, days_left, kind } = ms;
  const active = named(ms.active), pending = named(ms.pending);
  // Taux qui s'applique (ou s'appliquerait) à CE marchand : taux particulier, sinon taux général
  const myRate = f?.commission_rate ?? commission.rate;
  return {
    state, active, pending, days_left, shop_name: profile?.shop_name || null,
    formula: { kind, chosen: f?.kind || 'subscription', status: f?.status || 'active', pending_kind: f?.pending_kind || null, since: f?.since || null },
    commission: { available: commission.enabled && myRate != null, rate: myRate },
    history: list.map((s: any) => ({ ...s, plan_name: s.merchant_plans?.name || null, merchant_plans: undefined })),
    plans: plans || [],
    payment: { waafi_number: WAAFI_MERCHANT_NUMBER, waafi_holder: WAAFI_ACCOUNT_HOLDER },
  };
}

async function GET_(request: Request) {
  const m = await merchantFromRequest(request);
  if ('error' in m) return NextResponse.json({ error: m.error }, { status: m.status });
  return NextResponse.json(await overview(m.user.id));
}

async function POST_(request: Request) {
  const m = await merchantFromRequest(request);
  if ('error' in m) return NextResponse.json({ error: m.error }, { status: m.status });
  const user = m.user;
  let body: any = {};
  try { body = await request.json(); } catch { /* ignore */ }

  try {
    // Le marchand retire sa déclaration tant qu'elle n'est pas traitée
    if (body.action === 'cancel') {
      const { data: sub } = await supabaseAdmin.from('merchant_subscriptions').select('id, status').eq('id', body.subscription_id).eq('user_id', user.id).maybeSingle();
      if (!sub || sub.status !== 'pending_payment') return NextResponse.json({ error: 'already_resolved' }, { status: 409 });
      await supabaseAdmin.from('merchant_subscriptions').update({ status: 'cancelled', notes: 'Retirée par le marchand' }).eq('id', sub.id);
      return NextResponse.json({ ok: true, ...(await overview(user.id)) });
    }

    // Choix de formule par le marchand
    if (body.action === 'choose_formula') {
      const kind = body.kind;
      if (!['subscription', 'commission'].includes(kind)) return NextResponse.json({ error: 'invalid_formula' }, { status: 400 });
      const [{ data: subs }, formulas] = await Promise.all([
        supabaseAdmin.from('merchant_subscriptions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        formulasOf([user.id]),
      ]);
      const f = formulas[user.id] || null;
      const ms = merchantState(subs || [], f, today());
      if (ms.state === 'suspended') return NextResponse.json({ error: 'suspended' }, { status: 409 });

      if (kind === 'commission') {
        const settings = await commissionSettings();
        if (!settings.enabled) return NextResponse.json({ error: 'commission_unavailable' }, { status: 409 });
        if (ms.pending) return NextResponse.json({ error: 'pending_exists' }, { status: 409 });
        if (f?.kind === 'commission') return NextResponse.json({ error: 'already_chosen' }, { status: 409 });
        if (ms.active) {
          // Abonnement payé en cours : la bascule prend effet à son échéance (cron marchands)
          const now = new Date().toISOString();
          const { error } = f
            ? await supabaseAdmin.from('merchant_formulas').update({ pending_kind: 'commission', updated_at: now }).eq('user_id', user.id)
            : await supabaseAdmin.from('merchant_formulas').insert({ user_id: user.id, kind: 'subscription', pending_kind: 'commission' });
          if (error) throw error;
          try { await notifyUser(user.id, { title: '🤝 Formule commission programmée', body: 'Votre passage à la formule commission prendra effet à la fin de votre abonnement en cours. Vos produits restent visibles sans interruption.', url: '/producer/subscription', i18n: { key: 'm.com_scheduled' } }); } catch { /* ignore */ }
        } else {
          const r = await switchToCommission(user.id, { note: 'Choix du marchand' });
          if (!r.ok) return NextResponse.json({ error: r.error }, { status: 409 });
          try { await notifyUser(user.id, { title: '🤝 Formule commission activée', body: `Vous êtes en formule commission : ${r.rate} % retenus sur vos ventes livrées, rien à payer d'avance. Vos produits validés sont visibles.`, url: '/producer/subscription', i18n: { key: 'm.com_activated', params: { rate: r.rate } } }); } catch { /* ignore */ }
          try {
            const { sendPushToAdmin } = await import('../../../../lib/push');
            const { data: profile } = await supabaseAdmin.from('merchant_profiles').select('shop_name').eq('user_id', user.id).maybeSingle();
            await sendPushToAdmin({ title: '🤝 Marchand en formule commission', body: `${profile?.shop_name || user.email || 'Marchand'} · ${r.rate} %`, url: '/admin' });
          } catch (e) { console.error('[producer/subscription] push admin:', e); }
        }
        return NextResponse.json({ ok: true, ...(await overview(user.id)) });
      }

      // kind === 'subscription' : annule une bascule programmée. Quitter la commission se fait en
      // réglant une période d'abonnement (déclaration ci-dessous, activée par Hornafresh).
      if (f?.pending_kind) {
        await supabaseAdmin.from('merchant_formulas').update({ pending_kind: null, updated_at: new Date().toISOString() }).eq('user_id', user.id);
        return NextResponse.json({ ok: true, ...(await overview(user.id)) });
      }
      return NextResponse.json({ error: 'nothing_to_change' }, { status: 409 });
    }

    // Déclaration de paiement
    const { plan_id, payment_method, reference } = body;
    const method = payment_method === 'cash' ? 'cash' : 'waafi';
    const ref = String(reference || '').trim().slice(0, 80);
    if (method === 'waafi' && ref.length < 4) return NextResponse.json({ error: 'reference_required' }, { status: 400 });

    const { data: plan } = await supabaseAdmin.from('merchant_plans').select('*').eq('id', plan_id).eq('is_active', true).maybeSingle();
    if (!plan) return NextResponse.json({ error: 'Plan introuvable' }, { status: 400 });

    const { data: dup } = await supabaseAdmin.from('merchant_subscriptions').select('id').eq('user_id', user.id).eq('status', 'pending_payment').limit(1);
    if (dup && dup.length) return NextResponse.json({ error: 'pending_exists' }, { status: 409 });

    const { error } = await supabaseAdmin.from('merchant_subscriptions').insert({
      user_id: user.id, plan_id: plan.id, amount: plan.price_fdj, status: 'pending_payment',
      payment_method: method, payment_reference: ref || null,
    });
    if (error) throw error;

    // Alerte admin (cloche + push + e-mail) et accusé au marchand — jamais bloquants
    const { data: profile } = await supabaseAdmin.from('merchant_profiles').select('shop_name').eq('user_id', user.id).maybeSingle();
    const shop = profile?.shop_name || user.user_metadata?.full_name || user.email || 'Marchand';
    const amt = Number(plan.price_fdj).toLocaleString('fr-FR');
    try {
      const { sendPushToAdmin } = await import('../../../../lib/push');
      await sendPushToAdmin({ title: '💳 Abonnement marchand à confirmer', body: `${shop} · ${plan.name} · ${amt} Fdj · ${method === 'cash' ? 'espèces' : 'Waafi'}${ref ? ` · réf. ${ref}` : ''}`, url: '/admin' });
    } catch (e) { console.error('[producer/subscription] push admin:', e); }
    try {
      const { sendMerchantPaymentAlert } = await import('../../../../lib/emails');
      await sendMerchantPaymentAlert({ shop, email: user.email || null, plan: plan.name, amount: plan.price_fdj, method, reference: ref || null });
    } catch (e) { console.error('[producer/subscription] email admin:', e); }
    try {
      await notifyUser(user.id, { title: '💳 Paiement déclaré', body: `Votre paiement de ${amt} Fdj (${plan.name}) est en attente de confirmation par Hornafresh.`, url: '/producer/subscription', i18n: { key: 'm.payment_declared', params: { amount: `${amt} Fdj`, plan: plan.name } } });
    } catch { /* ignore */ }

    return NextResponse.json({ ok: true, ...(await overview(user.id)) });
  } catch (e: any) {
    console.error('[producer/subscription]', e);
    return NextResponse.json({ error: e.message || 'Erreur' }, { status: 500 });
  }
}

// Surveillance : exceptions et réponses 5xx enregistrées (lib/monitor.ts)
export const GET = monitored('/api/producer/subscription', GET_);
export const POST = monitored('/api/producer/subscription', POST_);
