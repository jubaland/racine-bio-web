'use client';

import { useState, useEffect, useCallback } from 'react';
import { ask, askText } from '../Dialog';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../context/LanguageContext';
import { useCan } from '../../context/AdminPermsContext';

// Admin › Entreprises : demandes d'ouverture, recharges à valider, sociétés (solde, membres,
// recharge minimale, suspension), réglage global de la recharge minimale.

type Member = { user_id: string; role: string; email: string | null; full_name: string | null };
type Company = { id: number; name: string; activity: string | null; tax_id: string | null; phone: string | null; email: string | null; address: string | null; status: string; min_topup: number | null; approval_threshold: number | null; admin_note: string | null; created_at: string; balance: number; members: Member[]; orders_count: number; revenue: number };
type Deposit = { id: number; company_id: number; company_name: string; amount: number; method: string; reference: string | null; status: string; note: string | null; created_at: string };

const fdj = (n: number) => `${Math.round(Number(n)).toLocaleString('fr-FR')} Fdj`;
const dateFr = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

export default function AdminCompanies() {
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;
  const { can } = useCan();
  const canEdit = can('companies', 'edit');
  const [tab, setTab] = useState<'todo' | 'companies' | 'settings'>('todo');
  const [data, setData] = useState<{ companies: Company[]; deposits: Deposit[]; min_topup: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [globalMin, setGlobalMin] = useState('');
  const [adjust, setAdjust] = useState<{ id: number; amount: string; note: string } | null>(null);

  const ROLE: Record<string, string> = { manager: t('co.role_manager', 'Gérant'), buyer: t('co.role_buyer', 'Acheteur'), accountant: t('co.role_accountant', 'Comptable') };
  const METHOD: Record<string, string> = { waafi: '📱 Waafi', cash: `💵 ${t('co.m_cash', 'Espèces')}`, transfer: `🏦 ${t('co.m_transfer', 'Virement')}`, cheque: `🧾 ${t('co.m_cheque', 'Chèque')}` };
  const STATUS: Record<string, [string, string]> = {
    pending: [t('co.st_pending', 'À valider'), 'bg-amber-100 text-amber-700'], active: [t('co.st_active', 'Active'), 'bg-green-100 text-green-700'],
    suspended: [t('co.st_suspended', 'Suspendue'), 'bg-orange-100 text-[#f97316]'], rejected: [t('co.st_rejected', 'Refusée'), 'bg-gray-100 text-gray-500'],
  };

  const tokenOf = async () => {
    let { data: { session } } = await supabase.auth.getSession();
    if (!session || (session.expires_at && session.expires_at * 1000 < Date.now() + 60000)) session = (await supabase.auth.refreshSession()).data.session;
    return session?.access_token;
  };
  const load = useCallback(async () => {
    const res = await fetch('/api/admin/companies', { headers: { Authorization: `Bearer ${await tokenOf()}` } });
    const j = await res.json();
    if (res.ok) { setData(j); setGlobalMin(String(j.min_topup)); } else setError(j.error || 'Erreur');
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (body: any, confirmMsg?: string) => {
    if (confirmMsg && !(await ask({ text: confirmMsg }))) return;
    setBusy(true); setError('');
    const res = await fetch('/api/admin/companies', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await tokenOf()}` }, body: JSON.stringify(body) });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) { setError(j.error || 'Erreur'); return false; }
    await load(); return true;
  };
  const askNote = async (label: string) => (await askText({ text: label })) ?? undefined;

  if (!data) return <div className="flex items-center justify-center h-48"><p className="text-gray-400">{error || t('admin.loading', 'Chargement...')}</p></div>;

  const pendingCompanies = data.companies.filter(c => c.status === 'pending');
  const pendingDeposits = data.deposits.filter(d => d.status === 'pending');
  const others = data.companies.filter(c => c.status !== 'pending');
  const todo = pendingCompanies.length + pendingDeposits.length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">🏢 {t('admin.nav_companies', 'Entreprises')}</h1>
        <div className="flex flex-wrap gap-1 bg-white border border-[#d2e095] rounded-2xl sm:rounded-full p-1">
          {([['todo', `✋ ${t('mer.todo', 'À traiter')}${todo ? ` (${todo})` : ''}`], ['companies', `🏢 ${t('co.tab_companies', 'Sociétés')} (${others.length})`], ['settings', `⚙️ ${t('co.tab_settings', 'Réglages')}`]] as const).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${tab === id ? 'bg-[#526500] text-white' : 'text-[#526500] hover:bg-[#ecf4d5]'}`}>{label}</button>
          ))}
        </div>
      </div>
      {error && <div className="bg-orange-50 text-[#f97316] text-sm px-4 py-3 rounded-xl mb-4">⚠️ {error}</div>}

      {tab === 'todo' && (
        <div className="space-y-6">
          <section>
            <h2 className="font-semibold text-gray-800 mb-3">📝 {t('co.requests', 'Demandes d\'ouverture')} ({pendingCompanies.length})</h2>
            {pendingCompanies.length === 0 ? <p className="text-sm text-gray-400 bg-white rounded-2xl border border-[#d2e095] p-5">{t('co.requests_empty', 'Aucune demande en attente.')}</p> : (
              <div className="grid gap-3">{pendingCompanies.map(c => (
                <div key={c.id} className="bg-white rounded-2xl border-2 border-amber-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 basis-full sm:basis-0 flex-1">
                      <p className="font-semibold text-gray-800">{c.name}{c.activity ? <span className="text-sm font-normal text-gray-500"> · {c.activity}</span> : null}</p>
                      <p className="text-xs text-gray-500 mt-0.5">👤 {c.members[0]?.full_name || '—'} · {c.members[0]?.email || c.email || '—'} · 📞 {c.phone || '—'}</p>
                      <p className="text-xs text-gray-500">📍 {c.address || '—'}{c.tax_id ? ` · ${t('co.tax_id', 'N° d\'identification')} : ${c.tax_id}` : ''}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{t('co.requested_on', 'Demande du')} {dateFr(c.created_at)}</p>
                    </div>
                    {canEdit && (
                      <div className="flex flex-wrap gap-2">
                        <button disabled={busy} onClick={() => act({ action: 'approve', company_id: c.id }, `${t('co.confirm_approve', 'Ouvrir le compte entreprise de')} « ${c.name} » ?`)} className="bg-[#526500] text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-[#3f4f00] disabled:opacity-50">✅ {t('co.approve', 'Accepter')}</button>
                        <button disabled={busy} onClick={async () => { const n = await askNote(t('co.reject_reason', 'Motif du refus (envoyé au demandeur) :')); if (n !== undefined) act({ action: 'reject', company_id: c.id, note: n }); }} className="border border-orange-200 text-[#f97316] text-xs font-semibold px-4 py-2 rounded-xl hover:bg-orange-50 disabled:opacity-50">{t('co.reject', 'Refuser')}</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}</div>
            )}
          </section>

          <section>
            <h2 className="font-semibold text-gray-800 mb-3">💰 {t('co.deposits', 'Recharges à valider')} ({pendingDeposits.length})</h2>
            {pendingDeposits.length === 0 ? <p className="text-sm text-gray-400 bg-white rounded-2xl border border-[#d2e095] p-5">{t('co.deposits_empty', 'Aucune recharge en attente.')}</p> : (
              <div className="grid gap-3">{pendingDeposits.map(d => (
                <div key={d.id} className="bg-white rounded-2xl border-2 border-amber-200 p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800">{d.company_name} — <span className="text-[#526500]">{fdj(d.amount)}</span></p>
                    <p className="text-xs text-gray-500">{METHOD[d.method] || d.method}{d.reference ? ` · ${t('producer.sub_ref', 'Réf.')} ${d.reference}` : ''} · {dateFr(d.created_at)}</p>
                  </div>
                  {canEdit && (
                    <div className="flex flex-wrap gap-2">
                      <button disabled={busy} onClick={() => act({ action: 'confirm_deposit', id: d.id }, `${t('co.confirm_deposit', 'Confirmer la réception de')} ${fdj(d.amount)} (${d.company_name}) ?`)} className="bg-[#526500] text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-[#3f4f00] disabled:opacity-50">✅ {t('co.deposit_ok', 'Paiement reçu')}</button>
                      <button disabled={busy} onClick={async () => { const n = await askNote(t('co.reject_reason', 'Motif du refus (envoyé au demandeur) :')); if (n !== undefined) act({ action: 'reject_deposit', id: d.id, note: n }); }} className="border border-orange-200 text-[#f97316] text-xs font-semibold px-4 py-2 rounded-xl hover:bg-orange-50 disabled:opacity-50">{t('co.reject', 'Refuser')}</button>
                    </div>
                  )}
                </div>
              ))}</div>
            )}
          </section>
        </div>
      )}

      {tab === 'companies' && (
        others.length === 0 ? <p className="text-sm text-gray-400 bg-white rounded-2xl border border-[#d2e095] p-8 text-center">{t('co.none', 'Aucune société pour le moment.')}</p> : (
          <div className="grid gap-3">{others.map(c => {
            const [label, cls] = STATUS[c.status] || [c.status, 'bg-gray-100 text-gray-500'];
            return (
              <div key={c.id} className="bg-white rounded-2xl border border-[#d2e095] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 basis-full sm:basis-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-gray-800">{c.name}</p>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
                      {c.activity && <span className="text-xs text-gray-500">{c.activity}</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">📞 {c.phone || '—'} · 📍 {c.address || '—'}</p>
                    <p className="text-xs text-gray-500">{c.members.map(m => `${m.full_name || m.email || '—'} (${ROLE[m.role] || m.role})`).join(' · ')}</p>
                    <p className="text-xs text-gray-400 mt-1">{c.orders_count} {t('co.orders', 'commande(s)')} · {fdj(c.revenue)} · {t('co.min_topup', 'recharge minimale')} : {c.min_topup != null ? fdj(c.min_topup) : `${fdj(data.min_topup)} (${t('co.global', 'réglage général')})`}{c.approval_threshold != null ? ` · ${t('co.threshold', 'validation au-delà de')} ${fdj(c.approval_threshold)}` : ''}</p>
                    {c.admin_note && <p className="text-xs text-[#f97316] mt-1">📝 {c.admin_note}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-gray-400 uppercase tracking-wide">{t('co.balance', 'Solde')}</p>
                    <p className="text-xl font-bold text-[#526500]">{fdj(c.balance)}</p>
                  </div>
                </div>
                {canEdit && (
                  <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-[#f0f4dc]">
                    <button disabled={busy} onClick={() => setAdjust({ id: c.id, amount: '', note: '' })} className="text-xs font-semibold border border-[#d2e095] text-[#526500] rounded-lg px-3 py-1.5 hover:bg-[#ecf4d5]">💰 {t('co.adjust', 'Créditer / débiter')}</button>
                    <button disabled={busy} onClick={async () => { const v = await askText({ text: t('co.min_prompt', 'Recharge minimale pour cette société (Fdj). Vide = réglage général :'), initial: c.min_topup != null ? String(c.min_topup) : '' }); if (v !== null) act({ action: 'set_company_min', company_id: c.id, value: v.trim() }); }} className="text-xs font-semibold border border-[#d2e095] text-[#526500] rounded-lg px-3 py-1.5 hover:bg-[#ecf4d5]">⚙️ {t('co.min_topup_btn', 'Recharge minimale')}</button>
                    {c.status === 'active'
                      ? <button disabled={busy} onClick={async () => { const n = await askNote(t('co.suspend_reason', 'Motif de la suspension (envoyé au gérant) :')); if (n !== undefined) act({ action: 'suspend', company_id: c.id, note: n }); }} className="text-xs font-semibold border border-orange-200 text-[#f97316] rounded-lg px-3 py-1.5 hover:bg-orange-50">⏸️ {t('co.suspend', 'Suspendre')}</button>
                      : <button disabled={busy} onClick={() => act({ action: 'reactivate', company_id: c.id })} className="text-xs font-semibold bg-[#526500] text-white rounded-lg px-3 py-1.5 hover:bg-[#3f4f00]">▶️ {c.status === 'rejected' ? t('co.approve', 'Accepter') : t('co.reactivate', 'Réactiver')}</button>}
                  </div>
                )}
                {adjust?.id === c.id && (
                  <div className="mt-3 bg-[#faf7e8] rounded-xl p-3 flex flex-col sm:flex-row gap-2">
                    <input type="number" value={adjust.amount} onChange={e => setAdjust({ ...adjust, amount: e.target.value })} placeholder={t('co.adjust_ph', 'Ex : 10000 (crédit) ou -2000 (débit)')} className="flex-1 border border-[#d2e095] rounded-lg px-3 py-2 text-sm bg-white" />
                    <input value={adjust.note} onChange={e => setAdjust({ ...adjust, note: e.target.value })} placeholder={t('co.adjust_note', 'Ex : recharge espèces au comptoir')} className="flex-1 border border-[#d2e095] rounded-lg px-3 py-2 text-sm bg-white" />
                    <button disabled={busy || !adjust.amount} onClick={async () => { if (await act({ action: 'adjust_wallet', company_id: c.id, amount: adjust.amount, note: adjust.note })) setAdjust(null); }} className="px-4 py-2 bg-[#a8c800] text-white rounded-lg text-sm font-semibold disabled:opacity-50">{t('co.apply', 'Appliquer')}</button>
                    <button onClick={() => setAdjust(null)} className="px-3 py-2 text-sm text-gray-500">{t('admin.cancel', 'Annuler')}</button>
                  </div>
                )}
              </div>
            );
          })}</div>
        )
      )}

      {tab === 'settings' && (
        <div className="bg-white rounded-2xl border border-[#d2e095] p-5 md:p-6 max-w-xl">
          <h2 className="font-semibold text-gray-800 mb-1">💰 {t('co.global_min_title', 'Recharge minimale des sociétés')}</h2>
          <p className="text-xs text-gray-400 mb-3">{t('co.global_min_hint', 'Montant minimal d\'une recharge de cagnotte société. Il s\'applique à toutes les sociétés, sauf celles qui ont leur propre minimum (onglet Sociétés). 0 = aucun minimum.')}</p>
          <div className="flex gap-2">
            <input type="number" min="0" value={globalMin} onChange={e => setGlobalMin(e.target.value)} disabled={!canEdit} className="flex-1 border border-[#d2e095] rounded-xl px-4 py-2.5 text-sm bg-[#faf7e8]" placeholder="Ex : 5000" />
            {canEdit && <button disabled={busy} onClick={() => act({ action: 'set_global_min', value: globalMin })} className="px-4 py-2.5 bg-[#a8c800] text-white rounded-xl text-sm font-semibold hover:bg-[#7d9800] disabled:opacity-50">{t('producer.wa_save', 'Enregistrer')}</button>}
          </div>
          <p className="text-xs text-gray-500 mt-2">{t('co.global_min_current', 'Valeur actuelle')} : <strong>{fdj(data.min_topup)}</strong></p>
        </div>
      )}
    </div>
  );
}
