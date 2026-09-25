'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useLanguage } from '../../../context/LanguageContext';
import ProducerLayout from '../../../components/producer/ProducerLayout';

type Plan = { id: number; name: string; price_fdj: number; duration_days: number };
type Sub = { id: number; plan_name: string | null; amount: number; starts_at: string | null; ends_at: string | null; status: string; payment_method: string | null; payment_reference: string | null; notes: string | null; created_at: string };
type Data = {
  state: 'active' | 'pending' | 'suspended' | 'expired' | 'none';
  active: Sub | null; pending: Sub | null; days_left: number | null; shop_name: string | null;
  history: Sub[]; plans: Plan[]; payment: { waafi_number: string; waafi_holder: string };
};

const fdj = (n: number) => `${Math.round(Number(n)).toLocaleString('fr-FR')} Fdj`;
const dateFr = (d: string | null) => d ? new Date(d.length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

function SubscriptionContent() {
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [planId, setPlanId] = useState<number | null>(null);
  const [method, setMethod] = useState<'waafi' | 'cash'>('waafi');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const token = async () => {
    let { data: { session } } = await supabase.auth.getSession();
    if (!session || (session.expires_at && session.expires_at * 1000 < Date.now() + 60000)) session = (await supabase.auth.refreshSession()).data.session;
    return session?.access_token;
  };
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/producer/subscription', { headers: { Authorization: `Bearer ${await token()}` } });
      const j = await res.json();
      if (res.ok) { setData(j); if (!planId && j.plans?.length) setPlanId(j.plans[0].id); }
    } catch { /* ignore */ }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { load(); }, [load]);

  const post = async (payload: any) => {
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/producer/subscription', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` }, body: JSON.stringify(payload) });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error === 'reference_required' ? t('producer.sub_ref_required', 'Indiquez la référence de votre transaction Waafi.')
          : j.error === 'pending_exists' ? t('producer.sub_pending_exists', 'Une déclaration est déjà en attente de confirmation.')
          : (j.error || 'Erreur'));
        return false;
      }
      setData(j);
      return true;
    } catch (e: any) { setError(e.message); return false; }
    finally { setBusy(false); }
  };

  const declare = async () => {
    if (!planId) return;
    if (!confirm(t('producer.sub_declare_confirm', 'Confirmez-vous avoir effectué ce paiement ? Hornafresh vérifiera puis activera votre abonnement.'))) return;
    const ok = await post({ plan_id: planId, payment_method: method, reference });
    if (ok) { setReference(''); setDone(true); setTimeout(() => window.location.reload(), 1200); }
  };
  const cancelPending = async () => {
    if (!data?.pending) return;
    if (!confirm(t('producer.sub_cancel_confirm', 'Retirer cette déclaration de paiement ?'))) return;
    const ok = await post({ action: 'cancel', subscription_id: data.pending.id });
    if (ok) setTimeout(() => window.location.reload(), 600);
  };

  if (loading || !data) {
    return <div className="flex items-center justify-center h-48"><p className="text-gray-400">{t('producer.loading', 'Chargement...')}</p></div>;
  }

  const plan = data.plans.find(p => p.id === planId) || data.plans[0] || null;
  const STATUS: Record<string, { label: string; cls: string }> = {
    active:          { label: t('mer.state_active', 'Actif'),               cls: 'bg-green-100 text-green-700' },
    pending_payment: { label: t('mer.state_pending', 'À confirmer'),        cls: 'bg-amber-100 text-amber-700' },
    expired:         { label: t('mer.state_expired', 'Expiré'),             cls: 'bg-gray-100 text-gray-500' },
    suspended:       { label: t('mer.state_suspended', 'Suspendu'),         cls: 'bg-red-100 text-red-600' },
    cancelled:       { label: t('producer.sub_status_cancelled', 'Retirée'), cls: 'bg-gray-100 text-gray-500' },
    rejected:        { label: t('producer.sub_status_rejected', 'Refusé'),   cls: 'bg-red-100 text-red-600' },
  };
  const sInfo = (s: Sub) => {
    // Une période « active » déjà échue s'affiche comme expirée
    const key = s.status === 'active' && s.ends_at && s.ends_at < new Date().toISOString().slice(0, 10) ? 'expired' : s.status;
    return STATUS[key] || { label: key, cls: 'bg-gray-100 text-gray-500' };
  };

  const hero = data.state === 'active'
    ? { emoji: '✅', cls: 'from-green-50 to-white border-green-200', title: `${t('producer.sub_active', 'Abonnement actif jusqu\'au')} ${dateFr(data.active!.ends_at)}`,
        sub: `${data.days_left} ${t('producer.sub_days_left', 'jour(s) restant(s)')}${data.active?.plan_name ? ` · ${data.active.plan_name}` : ''}` }
    : data.state === 'pending'
    ? { emoji: '⏳', cls: 'from-amber-50 to-white border-amber-200', title: t('producer.sub_pending', 'Paiement en attente de confirmation par Hornafresh.'),
        sub: `${fdj(data.pending!.amount)} · ${data.pending!.payment_method === 'cash' ? t('producer.sub_method_cash', 'Espèces') : 'Waafi'}${data.pending!.payment_reference ? ` · ${t('producer.sub_ref', 'Réf.')} ${data.pending!.payment_reference}` : ''} · ${dateFr(data.pending!.created_at)}` }
    : data.state === 'suspended'
    ? { emoji: '⏸️', cls: 'from-red-50 to-white border-red-200', title: t('producer.sub_suspended_title', 'Abonnement suspendu'), sub: t('producer.sub_suspended_hint', 'Contactez Hornafresh au 77 43 26 15 pour le réactiver.') }
    : data.state === 'expired'
    ? { emoji: '🔒', cls: 'from-red-50 to-white border-red-200', title: t('producer.sub_expired_title', 'Abonnement expiré'), sub: t('producer.sub_expired_hint', 'Vos produits ne sont plus visibles. Renouvelez ci-dessous.') }
    : { emoji: '🔒', cls: 'from-red-50 to-white border-red-200', title: t('producer.sub_none_title', 'Aucun abonnement actif'), sub: t('producer.sub_none_hint', 'Activez votre abonnement ci-dessous pour rendre vos produits visibles sur Hornafresh.') };

  const canDeclare = data.state !== 'pending' && data.state !== 'suspended' && plan;
  const isRenewal = data.state === 'active';

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">💳 {t('producer.nav_subscription', 'Mon abonnement')}</h1>

      {/* État */}
      <div className={`bg-gradient-to-br ${hero.cls} border rounded-2xl p-5 md:p-6 mb-6 flex items-start gap-4`}>
        <span className="text-4xl flex-none">{hero.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-800 text-lg leading-tight">{hero.title}</p>
          <p className="text-sm text-gray-500 mt-1">{hero.sub}</p>
          {data.state === 'pending' && (
            <button onClick={cancelPending} disabled={busy} className="mt-3 text-xs text-gray-400 hover:text-red-500 underline disabled:opacity-50">
              {t('producer.sub_cancel_request', 'Retirer ma déclaration')}
            </button>
          )}
        </div>
      </div>

      {/* Paiement */}
      {canDeclare && (
        <div className="bg-white rounded-2xl border border-[#d2e095] p-5 md:p-6 mb-6">
          <h2 className="font-bold text-[#526500] mb-1">
            {isRenewal ? `🔄 ${t('producer.sub_renew_title', 'Renouveler mon abonnement')}` : `🚀 ${t('producer.sub_activate_title', 'Activer mon abonnement')}`}
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            {isRenewal
              ? `${t('producer.sub_renew_desc', 'La nouvelle période commencera le lendemain de la fin de votre abonnement actuel, soit le')} ${dateFr(addOne(data.active!.ends_at))}.`
              : t('producer.sub_activate_desc', 'Réglez le montant, puis déclarez votre paiement : Hornafresh le vérifie et active votre abonnement.')}
          </p>

          {data.plans.length > 1 && (
            <div className="grid sm:grid-cols-2 gap-2 mb-4">
              {data.plans.map(p => (
                <button key={p.id} type="button" onClick={() => setPlanId(p.id)}
                  className={`text-left rounded-xl border-2 px-4 py-3 transition ${planId === p.id ? 'border-[#a8c800] bg-[#f6f9e6]' : 'border-[#e3eebf] hover:border-[#a8c800]'}`}>
                  <p className="font-semibold text-gray-800">{p.name}</p>
                  <p className="text-sm text-[#526500] font-bold">{fdj(p.price_fdj)} <span className="text-xs font-normal text-gray-400">/ {p.duration_days} {t('producer.sub_days', 'jours')}</span></p>
                </button>
              ))}
            </div>
          )}

          {plan && (
            <div className="flex items-center justify-between bg-[#f6f9e6] rounded-xl px-4 py-3 mb-4">
              <span className="text-sm text-gray-700">{plan.name} · {plan.duration_days} {t('producer.sub_days', 'jours')}</span>
              <span className="text-lg font-bold text-[#526500]">{fdj(plan.price_fdj)}</span>
            </div>
          )}

          <div className="flex gap-2 mb-4">
            {([['waafi', '📱 Waafi'], ['cash', `💵 ${t('producer.sub_method_cash', 'Espèces')}`]] as const).map(([m, label]) => (
              <button key={m} type="button" onClick={() => setMethod(m)}
                className={`flex-1 rounded-xl border-2 px-3 py-2 text-sm font-medium transition ${method === m ? 'border-[#a8c800] bg-[#f6f9e6] text-[#526500]' : 'border-[#e3eebf] text-gray-500 hover:border-[#a8c800]'}`}>
                {label}
              </button>
            ))}
          </div>

          {method === 'waafi' ? (
            <div className="rounded-2xl overflow-hidden border border-[#a8c800] mb-4">
              <div className="bg-[#526500] px-5 py-2.5 flex items-center gap-3">
                <span className="text-xl">📱</span><span className="text-white font-bold tracking-wide">WAAFI</span>
              </div>
              <div className="bg-[#f0f8e8] px-5 py-4">
                <p className="text-sm text-gray-600 mb-3">{t('producer.sub_waafi_instructions', 'Envoyez le montant au numéro Waafi Hornafresh ci-dessous, puis saisissez la référence de la transaction.')}</p>
                <div className="bg-white rounded-xl p-3 border border-[#d2e095] text-center mb-3">
                  <p className="text-xs text-gray-400 mb-1">{t('checkout.waafi_merchant_label', 'Numéro Waafi marchand')}</p>
                  <p className="text-3xl font-bold text-[#526500] tracking-widest">{data.payment.waafi_number}</p>
                  <p className="text-xs text-gray-400 mt-1">{data.payment.waafi_holder}</p>
                </div>
                <input value={reference} onChange={e => setReference(e.target.value)} maxLength={80}
                  placeholder={t('producer.sub_ref_ph', 'Ex : référence de transaction Waafi')}
                  className="w-full border border-[#d2e095] rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:border-[#a8c800]" />
              </div>
            </div>
          ) : (
            <div className="bg-[#faf7e8] border border-[#d2e095] rounded-2xl px-5 py-4 mb-4">
              <p className="text-sm text-gray-600">{t('producer.sub_cash_instructions', 'Remettez le montant en espèces à l\'équipe Hornafresh (77 43 26 15). Vous pouvez indiquer une note ci-dessous (date, personne).')}</p>
              <input value={reference} onChange={e => setReference(e.target.value)} maxLength={80}
                placeholder={t('producer.sub_note_ph', 'Ex : remis le 24/09 à Salah')}
                className="w-full border border-[#d2e095] rounded-xl px-4 py-2.5 text-sm bg-white mt-3 focus:outline-none focus:border-[#a8c800]" />
            </div>
          )}

          {error && <p className="text-sm text-red-500 mb-3">⚠️ {error}</p>}
          {done && <p className="text-sm text-green-700 mb-3">✅ {t('producer.sub_declared', 'Déclaration envoyée. Hornafresh confirmera votre paiement rapidement.')}</p>}

          <button onClick={declare} disabled={busy || done}
            className="w-full sm:w-auto bg-[#a8c800] text-white font-semibold rounded-full px-6 py-3 hover:bg-[#7d9800] transition disabled:opacity-50">
            {busy ? '…' : `✅ ${t('producer.sub_declare_btn', 'J\'ai payé — envoyer ma déclaration')}`}
          </button>
          <p className="text-xs text-gray-400 mt-3">{t('producer.sub_declare_note', 'Votre abonnement est activé après vérification du paiement par Hornafresh. Vous serez notifié.')}</p>
        </div>
      )}

      {/* Historique */}
      <div className="bg-white rounded-2xl border border-[#d2e095] p-5 md:p-6">
        <h2 className="font-bold text-gray-800 mb-3">📋 {t('producer.sub_history', 'Historique')}</h2>
        {data.history.length === 0 ? (
          <p className="text-sm text-gray-400">{t('producer.sub_history_empty', 'Aucun abonnement pour le moment.')}</p>
        ) : (
          <><div className="md:hidden space-y-2">
            {data.history.map(s => { const i = sInfo(s); return (
              <div key={s.id} className="bg-[#faf7e8] rounded-xl px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-800">{s.plan_name || '—'} · {fdj(s.amount)}</p>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${i.cls}`}>{i.label}</span>
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">{dateFr(s.created_at)}{s.starts_at ? ` · ${dateFr(s.starts_at)} → ${dateFr(s.ends_at)}` : ''} · {s.payment_method === 'cash' ? t('producer.sub_method_cash', 'Espèces') : s.payment_method === 'waafi' ? 'Waafi' : (s.payment_method || '—')}{s.payment_reference ? ` · ${s.payment_reference}` : ''}</p>
                {s.status === 'rejected' && s.notes ? <p className="text-[11px] text-red-500 mt-0.5">{s.notes}</p> : null}
              </div>
            ); })}
          </div>
          <div className="hidden md:block overflow-x-auto -mx-2">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b border-[#e3eebf]">
                  <th className="px-2 py-2 font-medium">{t('producer.sub_col_date', 'Date')}</th>
                  <th className="px-2 py-2 font-medium">{t('producer.sub_col_plan', 'Plan')}</th>
                  <th className="px-2 py-2 font-medium">{t('producer.sub_col_period', 'Période')}</th>
                  <th className="px-2 py-2 font-medium text-right">{t('producer.sub_col_amount', 'Montant')}</th>
                  <th className="px-2 py-2 font-medium">{t('producer.sub_col_method', 'Mode')}</th>
                  <th className="px-2 py-2 font-medium">{t('producer.sub_col_status', 'Statut')}</th>
                </tr>
              </thead>
              <tbody>
                {data.history.map(s => { const i = sInfo(s); return (
                  <tr key={s.id} className="border-b border-[#f0f4dc] last:border-0">
                    <td className="px-2 py-2.5 text-gray-600 whitespace-nowrap">{dateFr(s.created_at)}</td>
                    <td className="px-2 py-2.5 text-gray-800">{s.plan_name || '—'}</td>
                    <td className="px-2 py-2.5 text-gray-600 whitespace-nowrap">{s.starts_at ? `${dateFr(s.starts_at)} → ${dateFr(s.ends_at)}` : '—'}</td>
                    <td className="px-2 py-2.5 text-right font-semibold text-[#526500] whitespace-nowrap">{fdj(s.amount)}</td>
                    <td className="px-2 py-2.5 text-gray-600">{s.payment_method === 'cash' ? t('producer.sub_method_cash', 'Espèces') : s.payment_method === 'waafi' ? 'Waafi' : (s.payment_method || '—')}{s.payment_reference ? <span className="text-xs text-gray-400"> · {s.payment_reference}</span> : null}</td>
                    <td className="px-2 py-2.5"><span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${i.cls}`}>{i.label}</span>{s.status === 'rejected' && s.notes ? <p className="text-xs text-red-500 mt-1">{s.notes}</p> : null}</td>
                  </tr>
                ); })}
              </tbody>
            </table>
          </div></>
        )}
      </div>
    </div>
  );
}

const addOne = (d: string | null) => { if (!d) return null; const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); };

export default function ProducerSubscriptionPage() {
  return (
    <ProducerLayout>
      {() => <SubscriptionContent />}
    </ProducerLayout>
  );
}
