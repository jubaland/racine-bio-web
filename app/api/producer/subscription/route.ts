import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { roleOf } from '../../../../lib/permissions';
import { notifyUser } from '../../../../lib/notify';
import { WAAFI_MERCHANT_NUMBER, WAAFI_ACCOUNT_HOLDER } from '../../../../lib/payments';

// Espace marchand — « Mon abonnement »
// Le marchand ne fait que DÉCLARER un paiement (ligne pending_payment) ; l'activation
// reste une décision admin (confirm_payment dans /api/admin/merchants). Aucune activation ici.

const today = () => new Date().toISOString().slice(0, 10);

async function merchantFromRequest(request: Request) {
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '').trim();
  if (!token) return { error: 'Non authentifié', status: 401 } as const;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return { error: 'Token invalide', status: 401 } as const;
  if (roleOf(user.user_metadata) !== 'producer') {
    // Tolérance : adhésion approuvée sans rôle posé (ancien flux)
    const { data: req } = await supabaseAdmin.from('producer_requests').select('id').eq('email', user.email).eq('status', 'approved').maybeSingle();
    if (!req) return { error: 'Réservé aux marchands', status: 403 } as const;
  }
  return { user } as const;
}

async function overview(userId: string) {
  const [{ data: subs }, { data: plans }, { data: profile }] = await Promise.all([
    supabaseAdmin.from('merchant_subscriptions').select('*, merchant_plans(name, duration_days)').eq('user_id', userId).order('created_at', { ascending: false }),
    supabaseAdmin.from('merchant_plans').select('*').eq('is_active', true).order('price_fdj'),
    supabaseAdmin.from('merchant_profiles').select('shop_name').eq('user_id', userId).maybeSingle(),
  ]);
  const t = today();
  const list = subs || [];
  const active = list.find((s: any) => s.status === 'active' && s.ends_at >= t) || null;
  const pending = list.find((s: any) => s.status === 'pending_payment') || null;
  const last = list[0] || null;
  // « expiré » seulement s'il y a eu une vraie période (active/échue) ; une déclaration retirée/refusée ne compte pas
  const hadPeriod = list.some((s: any) => s.status === 'active' || s.status === 'expired');
  const state = active ? 'active' : pending ? 'pending' : last?.status === 'suspended' ? 'suspended' : hadPeriod ? 'expired' : 'none';
  const days_left = active ? Math.ceil((new Date(active.ends_at + 'T00:00:00Z').getTime() - new Date(t + 'T00:00:00Z').getTime()) / 86400000) : null;
  return {
    state, active, pending, days_left, shop_name: profile?.shop_name || null,
    history: list.map((s: any) => ({ ...s, plan_name: s.merchant_plans?.name || null, merchant_plans: undefined })),
    plans: plans || [],
    payment: { waafi_number: WAAFI_MERCHANT_NUMBER, waafi_holder: WAAFI_ACCOUNT_HOLDER },
  };
}

export async function GET(request: Request) {
  const m = await merchantFromRequest(request);
  if ('error' in m) return NextResponse.json({ error: m.error }, { status: m.status });
  return NextResponse.json(await overview(m.user.id));
}

export async function POST(request: Request) {
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
      await notifyUser(user.id, { title: '💳 Paiement déclaré', body: `Votre paiement de ${amt} Fdj (${plan.name}) est en attente de confirmation par Hornafresh.`, url: '/producer/subscription' });
    } catch { /* ignore */ }

    return NextResponse.json({ ok: true, ...(await overview(user.id)) });
  } catch (e: any) {
    console.error('[producer/subscription]', e);
    return NextResponse.json({ error: e.message || 'Erreur' }, { status: 500 });
  }
}
