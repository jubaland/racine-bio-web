'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { supabase } from '../../lib/supabase';
import { useCan } from '../../context/AdminPermsContext';

type Plan = { id: number; name: string; price_fdj: number; duration_days: number; is_active: boolean };
type Sub = { id: number; user_id: string; plan_id: number | null; amount: number; starts_at: string | null; ends_at: string | null; status: string; payment_method: string | null; payment_reference: string | null; created_at: string; merchant?: { id: string; name: string; email: string | null } };
type Merchant = {
  id: string; email: string; name: string; phone: string | null; farm_name: string | null; created_at: string;
  state: 'active' | 'pending_payment' | 'suspended' | 'expired' | 'none';
  active: Sub | null; pending: Sub | null; last: Sub | null;
  products: { total: number; published: number; pending: number };
};
type PendingProduct = { id: number; name: string; price: number; unit: string; image_url: string | null; created_at: string; merchant: { id: string; name: string } };
type Req = { id: string; email: string; farm_name: string; full_name: string | null; region: string | null; products_description: string | null; created_at: string };
type Data = { merchants: Merchant[]; pending_payments: Sub[]; pending_products: PendingProduct[]; plans: Plan[]; requests: Req[] };

const fdj = (n: number) => `${Math.round(Number(n)).toLocaleString('fr-FR')} Fdj`;
const dateFr = (d: string | null) => d ? new Date(d.length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export default function AdminMerchants() {
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;
  const { can } = useCan();
  const canEdit = can('merchants', 'edit');

  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<'todo' | 'merchants' | 'plans'>('todo');
  const [grantFor, setGrantFor] = useState<Merchant | null>(null);
  const [grantPlan, setGrantPlan] = useState<number | null>(null);
  const [grantMethod, setGrantMethod] = useState('cash');
  const [grantRef, setGrantRef] = useState('');
  const [planForm, setPlanForm] = useState<Partial<Plan> | null>(null);

  const token = async () => {
    let { data: { session } } = await supabase.auth.getSession();
    if (!session || (session.expires_at && session.expires_at * 1000 < Date.now() + 60000)) session = (await supabase.auth.refreshSession()).data.session;
    return session?.access_token;
  };
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/merchants', { headers: { Authorization: `Bearer ${await token()}` } });
      const j = await res.json();
      if (res.ok) setData(j);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const act = async (payload: any, key: string, confirmMsg?: string) => {
    if (confirmMsg && !confirm(confirmMsg)) return false;
    setBusy(key);
    try {
      const res = await fetch('/api/admin/merchants', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` }, body: JSON.stringify(payload) });
      const j = await res.json();
      if (!res.ok) { alert('⚠️ ' + (j.error || 'Erreur')); return false; }
      await fetchAll();
      return true;
    } catch (e: any) { alert('⚠️ ' + e.message); return false; }
    finally { setBusy(null); }
  };

  const STATE: Record<Merchant['state'], { label: string; cls: string }> = {
    active:          { label: t('mer.state_active', 'Actif'),            cls: 'bg-green-100 text-green-700' },
    pending_payment: { label: t('mer.state_pending', 'Paiement à confirmer'), cls: 'bg-amber-100 text-amber-800' },
    suspended:       { label: t('mer.state_suspended', 'Suspendu'),      cls: 'bg-red-100 text-red-600' },
    expired:         { label: t('mer.state_expired', 'Expiré'),          cls: 'bg-gray-100 text-gray-600' },
    none:            { label: t('mer.state_none', 'Sans abonnement'),    cls: 'bg-gray-100 text-gray-500' },
  };

  const todoCount = (data?.pending_payments.length || 0) + (data?.pending_products.length || 0) + (data?.requests.length || 0);

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <h2 className="text-xl font-bold text-[#2d6410]">🏪 {t('admin.nav_merchants', 'Marchands')}</h2>
        <div className="flex gap-1.5 bg-white border border-[#d2e095] rounded-full p-1">
          {([['todo', `✋ ${t('mer.tab_todo', 'À traiter')}${todoCount ? ` (${todoCount})` : ''}`], ['merchants', `🧑‍🌾 ${t('mer.tab_merchants', 'Marchands')}${data ? ` (${data.merchants.length})` : ''}`], ['plans', `📋 ${t('mer.tab_plans', 'Plans')}`]] as [typeof tab, string][]).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${tab === id ? 'bg-[#526500] text-white' : 'text-[#526500] hover:bg-[#ecf4d5]'}`}>{label}</button>
          ))}
        </div>
      </div>

      {loading || !data ? <p className="text-center text-gray-400 py-16">⏳</p> : (
        <>
          {/* ── À traiter ── */}
          {tab === 'todo' && (
            <div className="space-y-6">
              <section>
                <h3 className="font-bold text-amber-800 mb-2">💳 {t('mer.payments_title', 'Paiements à confirmer')} ({data.pending_payments.length})</h3>
                {data.pending_payments.length === 0 ? <p className="text-sm text-gray-400 bg-white rounded-xl border border-[#e3eebf] px-4 py-4">{t('mer.payments_empty', 'Aucun paiement en attente.')}</p> : data.pending_payments.map(s => (
                  <div key={s.id} className="bg-white rounded-xl border border-amber-200 px-4 py-3 flex flex-wrap items-center gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{s.merchant?.name} <span className="text-[11px] font-normal text-gray-400">{s.merchant?.email}</span></p>
                      <p className="text-xs text-gray-500">{fdj(s.amount)} · {s.payment_method || '—'}{s.payment_reference ? ` · réf. ${s.payment_reference}` : ''} · {dateFr(s.created_at)}</p>
                    </div>
                    {canEdit && <div className="flex gap-2">
                      <button disabled={busy === 'p' + s.id} onClick={() => act({ action: 'confirm_payment', subscription_id: s.id }, 'p' + s.id, t('mer.confirm_pay', 'Confirmer le paiement et activer l\'abonnement ?'))} className="text-xs font-semibold bg-[#a8c800] text-white rounded-lg px-3 py-1.5 hover:bg-[#7d9800] disabled:opacity-50">✅ {t('mer.confirm', 'Confirmer')}</button>
                      <button disabled={busy === 'p' + s.id} onClick={() => { const note = prompt(t('mer.reject_note', 'Motif (optionnel) :')) ?? null; if (note !== null) act({ action: 'reject_payment', subscription_id: s.id, note }, 'p' + s.id); }} className="text-xs font-semibold border border-red-200 text-red-500 rounded-lg px-3 py-1.5 hover:bg-red-50 disabled:opacity-50">✖ {t('mer.reject', 'Refuser')}</button>
                    </div>}
                  </div>
                ))}
              </section>

              <section>
                <h3 className="font-bold text-[#526500] mb-2">🥬 {t('mer.products_title', 'Produits à valider')} ({data.pending_products.length})</h3>
                {data.pending_products.length === 0 ? <p className="text-sm text-gray-400 bg-white rounded-xl border border-[#e3eebf] px-4 py-4">{t('mer.products_empty', 'Aucun produit en attente de validation.')}</p> : data.pending_products.map(p => (
                  <div key={p.id} className="bg-white rounded-xl border border-[#d2e095] px-4 py-3 flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#ecf4d5] flex-none">{p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center opacity-30">📷</div>}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{p.name} <span className="text-xs font-normal text-gray-500">— {fdj(p.price)} {p.unit}</span></p>
                      <p className="text-xs text-gray-400">🏪 {p.merchant.name} · {dateFr(p.created_at)}</p>
                    </div>
                    {canEdit && <div className="flex gap-2 flex-none">
                      <button disabled={busy === 'pr' + p.id} onClick={() => act({ action: 'approve_product', product_id: p.id }, 'pr' + p.id)} className="text-xs font-semibold bg-[#a8c800] text-white rounded-lg px-3 py-1.5 hover:bg-[#7d9800] disabled:opacity-50">✅ {t('mer.approve', 'Valider')}</button>
                      <button disabled={busy === 'pr' + p.id} onClick={() => { const note = prompt(t('mer.reject_product_note', 'Motif du refus (communiqué au marchand) :')); if (note !== null) act({ action: 'reject_product', product_id: p.id, note }, 'pr' + p.id); }} className="text-xs font-semibold border border-red-200 text-red-500 rounded-lg px-3 py-1.5 hover:bg-red-50 disabled:opacity-50">✖ {t('mer.reject', 'Refuser')}</button>
                    </div>}
                  </div>
                ))}
              </section>

              <section>
                <h3 className="font-bold text-[#526500] mb-2">📨 {t('mer.requests_title', 'Demandes d\'adhésion')} ({data.requests.length})</h3>
                {data.requests.length === 0 ? <p className="text-sm text-gray-400 bg-white rounded-xl border border-[#e3eebf] px-4 py-4">{t('mer.requests_empty', 'Aucune demande en attente.')}</p> : data.requests.map(r => (
                  <div key={r.id} className="bg-white rounded-xl border border-[#d2e095] px-4 py-3 flex flex-wrap items-center gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{r.farm_name} <span className="text-xs font-normal text-gray-500">— {r.full_name || r.email}</span></p>
                      <p className="text-xs text-gray-400">{r.email}{r.region ? ` · ${r.region}` : ''} · {dateFr(r.created_at)}</p>
                      {r.products_description && <p className="text-xs text-gray-500 mt-1">{r.products_description}</p>}
                    </div>
                    {canEdit && <div className="flex gap-2">
                      <button disabled={busy === 'r' + r.id} onClick={() => act({ action: 'approve_request', request_id: r.id }, 'r' + r.id, t('mer.approve_req', 'Accepter cette adhésion ? Le compte deviendra marchand.'))} className="text-xs font-semibold bg-[#a8c800] text-white rounded-lg px-3 py-1.5 hover:bg-[#7d9800] disabled:opacity-50">✅ {t('mer.accept', 'Accepter')}</button>
                      <button disabled={busy === 'r' + r.id} onClick={() => act({ action: 'reject_request', request_id: r.id }, 'r' + r.id, t('mer.reject_req', 'Refuser cette adhésion ?'))} className="text-xs font-semibold border border-red-200 text-red-500 rounded-lg px-3 py-1.5 hover:bg-red-50 disabled:opacity-50">✖ {t('mer.reject', 'Refuser')}</button>
                    </div>}
                  </div>
                ))}
              </section>
            </div>
          )}

          {/* ── Marchands ── */}
          {tab === 'merchants' && (
            data.merchants.length === 0 ? (
              <p className="text-sm text-gray-400 bg-white rounded-xl border border-[#e3eebf] px-4 py-6 text-center">{t('mer.none', 'Aucun marchand. Un compte devient marchand via une demande d\'adhésion acceptée, ou en lui donnant le rôle « Producteur » dans Utilisateurs.')}</p>
            ) : (
              <div className="space-y-2">
                {data.merchants.map(m => {
                  const st = STATE[m.state];
                  return (
                    <div key={m.id} className="bg-white rounded-2xl border-2 border-[#d2e095] px-4 py-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-800">
                            {m.farm_name ? `🏪 ${m.farm_name} — ` : ''}{m.name}
                            {canEdit && (
                              <button
                                type="button"
                                title={t('mer.shop_name', 'Enseigne')}
                                disabled={busy === 'sn' + m.id}
                                onClick={() => {
                                  const v = prompt(`${t('mer.shop_name', 'Enseigne')} (${t('mer.shop_name_ph', 'Ex : Boutique Zak')})`, m.farm_name || '');
                                  if (v !== null && v.trim() && v.trim() !== m.farm_name) act({ action: 'set_shop_name', user_id: m.id, shop_name: v.trim() }, 'sn' + m.id);
                                }}
                                className="ml-1 text-xs text-gray-400 hover:text-[#7d9800] disabled:opacity-50"
                              >✏️</button>
                            )}
                            <span className={`ml-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                          </p>
                          <p className="text-xs text-gray-500">{m.email}{m.phone ? ` · 📞 ${m.phone}` : ''} · {t('mer.products', 'produits')} : {m.products.published} {t('mer.published', 'publiés')}{m.products.pending ? `, ${m.products.pending} ${t('mer.to_review', 'à valider')}` : ''}</p>
                          {m.active && <p className="text-xs text-green-700 mt-0.5">✅ {t('mer.active_until', 'Actif jusqu\'au')} {dateFr(m.active.ends_at)} · {fdj(m.active.amount)}</p>}
                          {!m.active && m.last && <p className="text-xs text-gray-400 mt-0.5">{t('mer.last', 'Dernier')} : {m.last.status} · {dateFr(m.last.ends_at)}</p>}
                        </div>
                        {canEdit && (
                          <div className="flex flex-wrap gap-1.5">
                            <button onClick={() => { setGrantFor(m); setGrantPlan(data.plans.find(p => p.is_active)?.id ?? null); setGrantMethod('cash'); setGrantRef(''); }} className="text-xs font-semibold bg-[#526500] text-white rounded-lg px-3 py-1.5 hover:bg-[#3a4800]">💳 {m.active ? t('mer.renew', 'Renouveler') : t('mer.activate', 'Activer')}</button>
                            {m.active && <button disabled={busy === 'x' + m.id} onClick={() => act({ action: 'extend', user_id: m.id, days: 7 }, 'x' + m.id)} className="text-xs font-semibold border border-[#d2e095] text-[#526500] rounded-lg px-3 py-1.5 hover:bg-[#ecf4d5]">+7 j</button>}
                            {m.active && <button disabled={busy === 's' + m.id} onClick={() => { const note = prompt(t('mer.suspend_note', 'Motif de suspension (communiqué au marchand) :')); if (note !== null) act({ action: 'suspend', user_id: m.id, note }, 's' + m.id); }} className="text-xs font-semibold border border-red-200 text-red-500 rounded-lg px-3 py-1.5 hover:bg-red-50">⏸ {t('mer.suspend', 'Suspendre')}</button>}
                            {m.state === 'suspended' && <button disabled={busy === 's' + m.id} onClick={() => act({ action: 'reactivate', user_id: m.id }, 's' + m.id)} className="text-xs font-semibold bg-[#a8c800] text-white rounded-lg px-3 py-1.5 hover:bg-[#7d9800]">▶ {t('mer.reactivate', 'Réactiver')}</button>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* ── Plans ── */}
          {tab === 'plans' && (
            <div className="space-y-2">
              {data.plans.map(p => (
                <div key={p.id} className="bg-white rounded-xl border border-[#d2e095] px-4 py-3 flex flex-wrap items-center gap-3">
                  <div className="flex-1"><p className="font-semibold text-gray-800">{p.name} {!p.is_active && <span className="text-[11px] text-gray-400">({t('mer.plan_inactive', 'inactif')})</span>}</p><p className="text-xs text-gray-500">{fdj(p.price_fdj)} · {p.duration_days} {t('mer.days', 'jours')}</p></div>
                  {canEdit && <button onClick={() => setPlanForm(p)} className="text-xs font-semibold border border-[#d2e095] text-[#526500] rounded-lg px-3 py-1.5 hover:bg-[#ecf4d5]">✏️ {t('admin.edit', 'Modifier')}</button>}
                </div>
              ))}
              {canEdit && <button onClick={() => setPlanForm({ name: '', price_fdj: 5000, duration_days: 30, is_active: true })} className="text-xs font-semibold bg-[#a8c800] text-white rounded-lg px-4 py-2 hover:bg-[#7d9800]">➕ {t('mer.new_plan', 'Nouveau plan')}</button>}
            </div>
          )}
        </>
      )}

      {/* Modal : activer / renouveler */}
      {grantFor && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setGrantFor(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-[#2d6410] mb-1">💳 {t('mer.grant_title', 'Activer l\'abonnement')}</h3>
            <p className="text-xs text-gray-500 mb-4">{grantFor.name} — {t('mer.grant_hint', 'à utiliser quand le paiement a été reçu (espèces ou Waafi vérifié). La période démarre après l\'abonnement en cours s\'il y en a un.')}</p>
            <label className="block text-xs font-semibold text-gray-600 mb-1">{t('mer.plan', 'Plan')}</label>
            <select value={grantPlan ?? ''} onChange={e => setGrantPlan(Number(e.target.value))} className="w-full border border-[#d2e095] rounded-xl px-3 py-2 text-sm mb-3 bg-white">
              {data?.plans.filter(p => p.is_active).map(p => <option key={p.id} value={p.id}>{p.name} — {fdj(p.price_fdj)} / {p.duration_days} j</option>)}
            </select>
            <label className="block text-xs font-semibold text-gray-600 mb-1">{t('mer.method', 'Moyen de paiement')}</label>
            <select value={grantMethod} onChange={e => setGrantMethod(e.target.value)} className="w-full border border-[#d2e095] rounded-xl px-3 py-2 text-sm mb-3 bg-white">
              <option value="cash">💵 Espèces</option><option value="waafi">📱 Waafi</option><option value="other">Autre</option>
            </select>
            <input value={grantRef} onChange={e => setGrantRef(e.target.value)} placeholder={t('mer.ref_ph', 'Ex : réf. Waafi 123456 (optionnel)')} className="w-full border border-[#d2e095] rounded-xl px-3 py-2 text-sm mb-4" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setGrantFor(null)} className="text-sm px-4 py-2 rounded-xl border border-gray-200 text-gray-600">{t('admin.cancel', 'Annuler')}</button>
              <button disabled={!grantPlan || busy === 'g'} onClick={async () => { if (await act({ action: 'grant', user_id: grantFor.id, plan_id: grantPlan, payment_method: grantMethod, reference: grantRef }, 'g')) setGrantFor(null); }} className="text-sm font-semibold px-4 py-2 rounded-xl bg-[#a8c800] text-white hover:bg-[#7d9800] disabled:opacity-50">✅ {t('mer.activate', 'Activer')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal : plan */}
      {planForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setPlanForm(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-[#2d6410]">📋 {planForm.id ? t('admin.edit', 'Modifier') : t('mer.new_plan', 'Nouveau plan')}</h3>
            <input value={planForm.name || ''} onChange={e => setPlanForm({ ...planForm, name: e.target.value })} placeholder={t('mer.plan_name_ph', 'Ex : Mensuel')} className="w-full border border-[#d2e095] rounded-xl px-3 py-2 text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-gray-600">{t('mer.price', 'Prix (Fdj)')}<input type="number" value={planForm.price_fdj ?? ''} onChange={e => setPlanForm({ ...planForm, price_fdj: Number(e.target.value) })} className="w-full border border-[#d2e095] rounded-xl px-3 py-2 text-sm mt-1" /></label>
              <label className="text-xs text-gray-600">{t('mer.duration', 'Durée (jours)')}<input type="number" value={planForm.duration_days ?? ''} onChange={e => setPlanForm({ ...planForm, duration_days: Number(e.target.value) })} className="w-full border border-[#d2e095] rounded-xl px-3 py-2 text-sm mt-1" /></label>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={planForm.is_active !== false} onChange={e => setPlanForm({ ...planForm, is_active: e.target.checked })} className="accent-[#a8c800]" /> {t('mer.plan_active', 'Plan proposé aux marchands')}</label>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setPlanForm(null)} className="text-sm px-4 py-2 rounded-xl border border-gray-200 text-gray-600">{t('admin.cancel', 'Annuler')}</button>
              <button disabled={busy === 'plan'} onClick={async () => { if (await act({ action: 'save_plan', ...planForm }, 'plan')) setPlanForm(null); }} className="text-sm font-semibold px-4 py-2 rounded-xl bg-[#a8c800] text-white hover:bg-[#7d9800] disabled:opacity-50">💾 {t('admin.save', 'Enregistrer')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
