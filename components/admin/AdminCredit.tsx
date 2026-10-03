'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useCan } from '../../context/AdminPermsContext';
import { supabase } from '../../lib/supabase';
import { inputClass, selectClass } from './Modal';

// Admin › Crédit clients (« carnet ») : comptes, encours, retards, paiements reçus, réglages.

type Account = {
  account: { id: number; holder_type: 'user' | 'company'; credit_limit: number; term: 'month_end' | 'days'; term_days: number | null; status: 'active' | 'suspended'; auto_suspended: boolean; suspended_reason: string | null; note: string | null; created_at: string };
  holder: { name: string; email: string | null };
  outstanding: number; overdue: number; overdue_since: string | null; available: number; next_due: string | null; next_due_amount: number;
  open: { id: number; order_id: number | null; created_at: string; due_at: string; amount: number; paid_amount: number; remaining: number }[];
};
type Entry = { id: number; type: string; amount: number; order_id: number | null; due_at: string | null; paid_amount: number; method: string | null; note: string | null; created_at: string };
type Settings = { enabled: boolean; remind_before_days: number; overdue_remind_days: number; suspend_after_days: number; default_limit: number | null; default_term: 'month_end' | 'days'; default_term_days: number };
type Data = { settings: Settings; accounts: Account[]; totals: { outstanding: number; overdue: number }; companies: { id: number; name: string }[] };

const fdj = (n: number) => `${Math.round(Number(n) || 0).toLocaleString('fr-FR')} Fdj`;
const EMPTY_NEW = { holder_type: 'user', email: '', company_id: '', credit_limit: '', term: 'month_end', term_days: '30', note: '' };

export default function AdminCredit() {
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;
  const { can } = useCan();
  const canEdit = can('credit', 'edit');
  const [data, setData] = useState<Data | null>(null);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState<'accounts' | 'settings'>('accounts');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [creating, setCreating] = useState(false);
  const [nw, setNw] = useState({ ...EMPTY_NEW });
  const [editId, setEditId] = useState<number | null>(null);
  const [edit, setEdit] = useState({ credit_limit: '', term: 'month_end', term_days: '30', note: '' });
  const [payId, setPayId] = useState<number | null>(null);
  const [pay, setPay] = useState({ amount: '', method: 'cash', note: '' });
  const [ledger, setLedger] = useState<{ id: number; entries: Entry[] } | null>(null);
  const [st, setSt] = useState({ enabled: true, remind_before_days: '3', overdue_remind_days: '7', suspend_after_days: '15', default_limit: '', default_term: 'month_end', default_term_days: '30' });

  const headers = async () => {
    let { data: { session } } = await supabase.auth.getSession();
    if (!session || (session.expires_at && session.expires_at * 1000 < Date.now() + 60000)) session = (await supabase.auth.refreshSession()).data.session;
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` };
  };
  const apply = (j: Data) => {
    setData(j);
    const s = j.settings;
    setSt({ enabled: s.enabled, remind_before_days: String(s.remind_before_days), overdue_remind_days: String(s.overdue_remind_days), suspend_after_days: String(s.suspend_after_days), default_limit: s.default_limit != null ? String(s.default_limit) : '', default_term: s.default_term, default_term_days: String(s.default_term_days) });
  };
  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/credit', { headers: await headers() });
      const j = await res.json();
      if (res.ok) { apply(j); setLoadError(''); } else setLoadError(j.error || 'Erreur');
    } catch (e: any) { setLoadError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const ERR: Record<string, string> = {
    limit_invalid: t('cr.e_limit', 'Indiquez un plafond en Fdj (entier positif).'),
    term_days_invalid: t('cr.e_term', 'Indiquez le nombre de jours de l\'échéance.'),
    user_not_found: t('cr.e_user', 'Aucun compte client avec cette adresse e-mail.'),
    company_not_found: t('cr.e_company', 'Société introuvable.'),
    already_exists: t('cr.e_exists', 'Ce client a déjà une ligne de crédit.'),
    amount_invalid: t('cr.e_amount', 'Montant invalide.'),
    has_balance: t('cr.e_balance', 'Impossible de supprimer : il reste un encours. Suspendez le compte.'),
    has_history: t('cr.e_history', 'Impossible de supprimer : le compte a un historique. Suspendez-le.'),
    number_invalid: t('cr.e_number', 'Les délais doivent être des nombres entiers positifs.'),
  };
  const post = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true); setMsg('');
    try {
      const res = await fetch('/api/admin/credit', { method: 'POST', headers: await headers(), body: JSON.stringify(body) });
      const j = await res.json();
      if (!res.ok) { setMsg('⚠️ ' + (ERR[j.error] || j.error || 'Erreur')); return null; }
      apply(j); setMsg('✅ ' + ok); return j;
    } catch (e: any) { setMsg('⚠️ ' + e.message); return null; } finally { setBusy(false); }
  };
  const openLedger = async (id: number) => {
    if (ledger?.id === id) { setLedger(null); return; }
    const res = await fetch(`/api/admin/credit?entries=${id}`, { headers: await headers() });
    const j = await res.json();
    if (res.ok) setLedger({ id, entries: j.entries || [] });
  };

  const dateFr = (d: string) => new Date(d.length === 10 ? d + 'T00:00:00Z' : d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: d.length === 10 ? 'UTC' : undefined });
  const termLabel = (a: Account['account']) => a.term === 'days' ? `${a.term_days} ${t('cr.days', 'jours')}` : t('cr.month_end', 'fin de mois');
  const stateOf = (a: Account): [string, string] => a.account.status !== 'active' ? [t('cr.st_suspended', 'Suspendu'), 'bg-red-100 text-red-700'] : a.overdue > 0 ? [t('cr.st_overdue', 'En retard'), 'bg-orange-100 text-orange-700'] : [t('cr.st_active', 'Actif'), 'bg-green-100 text-green-700'];
  const label = 'block text-xs font-semibold text-gray-600 mb-1';
  const hint = 'text-[11px] text-gray-400 mt-1';
  const TYPE: Record<string, string> = { charge: t('cr.e_charge', 'Commande'), payment: t('cr.e_payment', 'Paiement'), refund: t('cr.e_refund', 'Avoir'), adjustment: t('cr.e_adjust', 'Ajustement') };

  if (loadError) return <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 text-sm text-[#b45309]">⚠️ {t('pc.load_error', 'Chargement impossible')} : {loadError} <button onClick={load} className="underline ml-2">{t('admin.retry', 'Réessayer')}</button></div>;
  if (!data) return <div className="flex items-center justify-center h-48"><p className="text-gray-400">{t('admin.loading', 'Chargement...')}</p></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-800">💳 {t('admin.nav_credit', 'Crédit clients')}</h1>
        <div className="flex flex-wrap gap-1 bg-white border border-[#d2e095] rounded-2xl sm:rounded-full p-1">
          {([['accounts', `📒 ${t('cr.tab_accounts', 'Comptes')}`], ['settings', `⚙️ ${t('cr.tab_settings', 'Réglages')}`]] as const).map(([id, l]) => (
            <button key={id} onClick={() => setTab(id)} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${tab === id ? 'bg-[#526500] text-white' : 'text-[#526500] hover:bg-[#ecf4d5]'}`}>{l}</button>
          ))}
        </div>
      </div>

      {/* Indicateurs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[[t('cr.k_outstanding', 'Encours total'), fdj(data.totals.outstanding), 'text-[#526500]'], [t('cr.k_overdue', 'En retard'), fdj(data.totals.overdue), data.totals.overdue > 0 ? 'text-[#f97316]' : 'text-gray-700'],
          [t('cr.k_accounts', 'Comptes actifs'), String(data.accounts.filter(a => a.account.status === 'active').length), 'text-gray-700'], [t('cr.k_suspended', 'Suspendus'), String(data.accounts.filter(a => a.account.status !== 'active').length), 'text-gray-700']].map(([l, v, c]) => (
          <div key={l} className="bg-white rounded-2xl border border-[#d2e095] p-3"><p className="text-[11px] text-gray-500">{l}</p><p className={`text-lg font-bold ${c}`}>{v}</p></div>
        ))}
      </div>

      {tab === 'settings' ? (
        <div className="bg-white rounded-2xl border border-[#d2e095] p-5 space-y-4">
          <p className="text-xs text-gray-500">{t('cr.settings_desc', 'Rien n\'est en dur : tous les délais se règlent ici. Le crédit n\'est accordé qu\'aux clients que vous activez un par un.')}</p>
          <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={st.enabled} disabled={!canEdit} onChange={e => setSt(s => ({ ...s, enabled: e.target.checked }))} className="accent-[#a8c800]" /> {t('cr.s_enabled', 'Crédit activé sur le site (désactiver bloque toute nouvelle commande à crédit)')}</label>
          <div className="grid sm:grid-cols-3 gap-4">
            {([['remind_before_days', t('cr.s_before', 'Rappel avant l\'échéance (jours)'), t('cr.s_before_hint', 'Ex : 3 → rappel 3 jours avant.')],
              ['overdue_remind_days', t('cr.s_overdue', 'Relance après l\'échéance (jours)'), t('cr.s_overdue_hint', 'Ex : 7 → relance 7 jours après l\'échéance.')],
              ['suspend_after_days', t('cr.s_suspend', 'Suspension automatique après (jours de retard)'), t('cr.s_suspend_hint', 'Ex : 15. Réactivation automatique au règlement.')]] as const).map(([k, l, h]) => (
              <div key={k}>
                <label className={label} htmlFor={`cr-${k}`}>{l}</label>
                <input id={`cr-${k}`} type="number" inputMode="numeric" min={0} step={1} value={st[k]} disabled={!canEdit} onChange={e => setSt(s => ({ ...s, [k]: e.target.value }))} className={inputClass} />
                <p className={hint}>{h}</p>
              </div>
            ))}
            <div>
              <label className={label} htmlFor="cr-default_term">{t('cr.s_term', 'Échéance proposée par défaut')}</label>
              <select id="cr-default_term" value={st.default_term} disabled={!canEdit} onChange={e => setSt(s => ({ ...s, default_term: e.target.value as 'month_end' | 'days' }))} className={selectClass}>
                <option value="month_end">{t('cr.month_end', 'fin de mois')}</option>
                <option value="days">{t('cr.term_days_opt', 'N jours après la commande')}</option>
              </select>
            </div>
            <div>
              <label className={label} htmlFor="cr-default_term_days">{t('cr.s_term_days', 'Nombre de jours (si « N jours »)')}</label>
              <input id="cr-default_term_days" type="number" inputMode="numeric" min={1} step={1} value={st.default_term_days} disabled={!canEdit} onChange={e => setSt(s => ({ ...s, default_term_days: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className={label} htmlFor="cr-default_limit">{t('cr.s_limit', 'Plafond proposé par défaut (Fdj)')}</label>
              <input id="cr-default_limit" type="number" inputMode="numeric" min={0} step={1} value={st.default_limit} disabled={!canEdit} onChange={e => setSt(s => ({ ...s, default_limit: e.target.value }))} placeholder={t('cr.s_limit_ph', 'Ex : 20000 (vide = à saisir à chaque fois)')} className={inputClass} />
            </div>
          </div>
          {canEdit && <button disabled={busy} onClick={() => post({ action: 'save_settings', ...st }, t('cr.settings_saved', 'Réglages enregistrés.'))} className="bg-[#a8c800] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#7d9800] disabled:opacity-50">💾 {t('admin.save', 'Enregistrer')}</button>}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs text-gray-500">{t('cr.desc', 'Le client règle en fin de mois (ou sous N jours). Relevé envoyé à l\'échéance, rappels et suspension automatiques en cas de retard.')}</p>
            {canEdit && !creating && <button onClick={() => { setCreating(true); setNw({ ...EMPTY_NEW, credit_limit: data.settings.default_limit != null ? String(data.settings.default_limit) : '', term: data.settings.default_term, term_days: String(data.settings.default_term_days) }); setMsg(''); }} className="bg-[#a8c800] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#7d9800]">+ {t('cr.new', 'Activer un crédit')}</button>}
          </div>

          {creating && (
            <form onSubmit={async e => { e.preventDefault(); const j = await post({ action: 'create', ...nw }, t('cr.created', 'Crédit activé, client prévenu.')); if (j) setCreating(false); }} className="bg-white rounded-2xl border-2 border-[#d2e095] p-5 space-y-4">
              <h3 className="font-bold text-gray-800">{t('cr.new', 'Activer un crédit')}</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className={label} htmlFor="cr-holder">{t('cr.f_holder', 'Titulaire')}</label>
                  <select id="cr-holder" value={nw.holder_type} onChange={e => setNw(n => ({ ...n, holder_type: e.target.value }))} className={selectClass}>
                    <option value="user">{t('cr.h_user', 'Un client (compte personnel)')}</option>
                    <option value="company">{t('cr.h_company', 'Une société (compte entreprise)')}</option>
                  </select>
                </div>
                {nw.holder_type === 'company' ? (
                  <div>
                    <label className={label} htmlFor="cr-company">{t('cr.f_company', 'Société')}</label>
                    <select id="cr-company" value={nw.company_id} required onChange={e => setNw(n => ({ ...n, company_id: e.target.value }))} className={selectClass}>
                      <option value="">{t('cr.f_company_ph', 'Choisir…')}</option>
                      {data.companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className={label} htmlFor="cr-email">{t('cr.f_email', 'E-mail du compte client')}</label>
                    <input id="cr-email" type="email" required value={nw.email} onChange={e => setNw(n => ({ ...n, email: e.target.value }))} placeholder={t('cr.f_email_ph', 'Ex : client@exemple.com')} className={inputClass} />
                  </div>
                )}
                <div>
                  <label className={label} htmlFor="cr-limit">{t('cr.f_limit', 'Plafond (Fdj)')} *</label>
                  <input id="cr-limit" type="number" inputMode="numeric" min={1} step={1} required value={nw.credit_limit} onChange={e => setNw(n => ({ ...n, credit_limit: e.target.value }))} placeholder={t('cr.f_limit_ph', 'Ex : 20000')} className={inputClass} />
                  <p className={hint}>{t('cr.f_limit_hint', 'Encours maximal autorisé, commandes en attente comprises.')}</p>
                </div>
                <div>
                  <label className={label} htmlFor="cr-term">{t('cr.f_term', 'Échéance')}</label>
                  <div className="flex gap-2">
                    <select id="cr-term" value={nw.term} onChange={e => setNw(n => ({ ...n, term: e.target.value }))} className={selectClass}>
                      <option value="month_end">{t('cr.month_end', 'fin de mois')}</option>
                      <option value="days">{t('cr.term_days_opt', 'N jours après la commande')}</option>
                    </select>
                    {nw.term === 'days' && <input type="number" inputMode="numeric" min={1} step={1} value={nw.term_days} onChange={e => setNw(n => ({ ...n, term_days: e.target.value }))} aria-label={t('cr.days', 'jours')} className={`${inputClass} w-24`} />}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className={label} htmlFor="cr-note">{t('cr.f_note', 'Note interne')}</label>
                  <input id="cr-note" value={nw.note} maxLength={300} onChange={e => setNw(n => ({ ...n, note: e.target.value }))} placeholder={t('cr.f_note_ph', 'Ex : restaurant, client depuis 2024')} className={inputClass} />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={busy} className="bg-[#a8c800] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#7d9800] disabled:opacity-50">{busy ? '⏳' : t('cr.activate', 'Activer')}</button>
                <button type="button" onClick={() => setCreating(false)} className="px-5 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50">{t('admin.cancel', 'Annuler')}</button>
              </div>
            </form>
          )}

          {data.accounts.length === 0 && !creating ? (
            <div className="bg-white rounded-2xl p-10 text-center border border-[#d2e095]"><p className="text-4xl mb-3 opacity-20">💳</p><p className="text-gray-400 text-sm">{t('cr.empty', 'Aucun client à crédit pour le moment.')}</p></div>
          ) : (
            <div className="grid gap-3">
              {data.accounts.map(a => {
                const [s, cls] = stateOf(a);
                const id = a.account.id;
                return (
                  <div key={id} className="bg-white rounded-2xl border border-[#d2e095] p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 flex-wrap"><span className="font-bold text-gray-800">{a.account.holder_type === 'company' ? '🏢' : '👤'} {a.holder.name}</span><span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${cls}`}>{s}</span></p>
                        {a.holder.email && <p className="text-xs text-gray-400">{a.holder.email}</p>}
                        <p className="text-xs text-gray-500 mt-1">{t('cr.limit', 'Plafond')} {fdj(a.account.credit_limit)} · {t('cr.term', 'échéance')} {termLabel(a.account)}{a.account.note ? ` · ${a.account.note}` : ''}</p>
                        {a.account.status !== 'active' && a.account.suspended_reason && <p className="text-xs text-red-600 mt-0.5">🛑 {a.account.suspended_reason}</p>}
                      </div>
                      <div className="text-right text-xs text-gray-600 shrink-0">
                        <p className="text-base font-bold text-[#526500]">{fdj(Math.max(0, a.outstanding))} <span className="text-[11px] font-normal text-gray-500">{t('cr.due', 'dû')}</span></p>
                        {a.overdue > 0 && a.overdue_since && <p className="text-[#f97316] font-semibold">⚠️ {fdj(a.overdue)} {t('cr.late_since', 'en retard depuis le')} {dateFr(a.overdue_since)}</p>}
                        {a.next_due && a.next_due_amount > 0 && <p>🗓️ {fdj(a.next_due_amount)} {t('cr.by', 'avant le')} {dateFr(a.next_due)}</p>}
                        <p className="text-gray-400">{t('cr.available', 'disponible')} {fdj(a.available)}</p>
                      </div>
                    </div>

                    {canEdit && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        <button disabled={busy} onClick={() => { setPayId(payId === id ? null : id); setPay({ amount: '', method: 'cash', note: '' }); setEditId(null); setMsg(''); }} className="text-xs font-semibold bg-[#a8c800] text-white rounded-lg px-3 py-1.5 hover:bg-[#7d9800]">💵 {t('cr.pay', 'Enregistrer un paiement')}</button>
                        <button disabled={busy} onClick={() => { setEditId(editId === id ? null : id); setEdit({ credit_limit: String(a.account.credit_limit), term: a.account.term, term_days: String(a.account.term_days || 30), note: a.account.note || '' }); setPayId(null); setMsg(''); }} className="text-xs font-semibold border border-[#d2e095] text-[#526500] rounded-lg px-3 py-1.5 hover:bg-[#ecf4d5]">✏️ {t('admin.edit', 'Modifier')}</button>
                        {a.account.status === 'active'
                          ? <button disabled={busy} onClick={() => { const reason = prompt(t('cr.suspend_prompt', 'Motif de la suspension (communiqué au client, optionnel) :')); if (reason !== null) post({ action: 'suspend', id, reason }, t('cr.suspended', 'Crédit suspendu.')); }} className="text-xs font-semibold border border-orange-200 text-[#f97316] rounded-lg px-3 py-1.5 hover:bg-orange-50">⏸ {t('cr.suspend', 'Suspendre')}</button>
                          : <button disabled={busy} onClick={() => post({ action: 'reactivate', id }, t('cr.reactivated', 'Crédit réactivé.'))} className="text-xs font-semibold border border-green-200 text-green-700 rounded-lg px-3 py-1.5 hover:bg-green-50">▶️ {t('cr.reactivate', 'Réactiver')}</button>}
                        <button disabled={busy} onClick={() => openLedger(id)} className="text-xs font-semibold border border-gray-200 text-gray-600 rounded-lg px-3 py-1.5 hover:bg-gray-50">📜 {t('cr.ledger', 'Journal')}</button>
                        {a.outstanding === 0 && a.open.length === 0 && <button disabled={busy} onClick={() => { if (confirm(t('cr.delete_confirm', 'Supprimer cette ligne de crédit ?'))) post({ action: 'delete', id }, t('cr.deleted', 'Ligne de crédit supprimée.')); }} className="text-xs font-semibold border border-orange-200 text-[#f97316] rounded-lg px-3 py-1.5 hover:bg-orange-50">🗑 {t('admin.delete', 'Supprimer')}</button>}
                      </div>
                    )}

                    {payId === id && (
                      <form onSubmit={async e => { e.preventDefault(); const j = await post({ action: 'pay', id, ...pay }, t('cr.paid', 'Paiement enregistré, client prévenu.')); if (j) setPayId(null); }} className="mt-3 border border-[#d2e095] rounded-xl p-3 bg-[#f8fdf0] flex flex-wrap gap-2 items-end">
                        <label className="text-xs font-semibold text-gray-600">{t('cr.p_amount', 'Montant reçu (Fdj)')}<input type="number" inputMode="numeric" min={1} step={1} required value={pay.amount} onChange={e => setPay(p => ({ ...p, amount: e.target.value }))} placeholder={t('cr.p_amount_ph', 'Ex : 5000')} className={`${inputClass} mt-1 w-40 block`} /></label>
                        <label className="text-xs font-semibold text-gray-600">{t('cr.p_method', 'Moyen')}<select value={pay.method} onChange={e => setPay(p => ({ ...p, method: e.target.value }))} className={`${selectClass} mt-1 block w-auto`}><option value="cash">{t('cr.m_cash', 'Espèces')}</option><option value="waafi">Waafi</option><option value="dmoney">D-Money</option><option value="other">{t('cr.m_other', 'Autre')}</option></select></label>
                        <label className="text-xs font-semibold text-gray-600 flex-1 min-w-[160px]">{t('cr.p_note', 'Note')}<input value={pay.note} maxLength={300} onChange={e => setPay(p => ({ ...p, note: e.target.value }))} placeholder={t('cr.p_note_ph', 'Ex : reçu par Ahmed, le 30/10')} className={`${inputClass} mt-1 block`} /></label>
                        <button type="submit" disabled={busy} className="text-xs font-semibold bg-[#a8c800] text-white rounded-lg px-4 py-2.5 hover:bg-[#7d9800] disabled:opacity-50">{busy ? '⏳' : t('cr.p_submit', 'Enregistrer')}</button>
                        <p className="w-full text-[11px] text-gray-400">{t('cr.p_hint', 'Affecté aux commandes les plus anciennes. Un trop-perçu reste en avoir sur le carnet.')}</p>
                      </form>
                    )}
                    {editId === id && (
                      <form onSubmit={async e => { e.preventDefault(); const j = await post({ action: 'update', id, ...edit }, t('cr.updated', 'Compte mis à jour.')); if (j) setEditId(null); }} className="mt-3 border border-[#d2e095] rounded-xl p-3 bg-white flex flex-wrap gap-2 items-end">
                        <label className="text-xs font-semibold text-gray-600">{t('cr.f_limit', 'Plafond (Fdj)')}<input type="number" inputMode="numeric" min={0} step={1} required value={edit.credit_limit} onChange={e => setEdit(x => ({ ...x, credit_limit: e.target.value }))} className={`${inputClass} mt-1 w-36 block`} /></label>
                        <label className="text-xs font-semibold text-gray-600">{t('cr.f_term', 'Échéance')}<select value={edit.term} onChange={e => setEdit(x => ({ ...x, term: e.target.value }))} className={`${selectClass} mt-1 block w-auto`}><option value="month_end">{t('cr.month_end', 'fin de mois')}</option><option value="days">{t('cr.term_days_opt', 'N jours après la commande')}</option></select></label>
                        {edit.term === 'days' && <label className="text-xs font-semibold text-gray-600">{t('cr.days', 'jours')}<input type="number" inputMode="numeric" min={1} step={1} value={edit.term_days} onChange={e => setEdit(x => ({ ...x, term_days: e.target.value }))} className={`${inputClass} mt-1 w-20 block`} /></label>}
                        <label className="text-xs font-semibold text-gray-600 flex-1 min-w-[160px]">{t('cr.f_note', 'Note interne')}<input value={edit.note} maxLength={300} onChange={e => setEdit(x => ({ ...x, note: e.target.value }))} className={`${inputClass} mt-1 block`} /></label>
                        <button type="submit" disabled={busy} className="text-xs font-semibold bg-[#a8c800] text-white rounded-lg px-4 py-2.5 hover:bg-[#7d9800] disabled:opacity-50">{busy ? '⏳' : t('admin.save', 'Enregistrer')}</button>
                      </form>
                    )}
                    {ledger?.id === id && (
                      <div className="mt-3 border-t border-[#f0f7e0] pt-2 space-y-1 text-xs">
                        {ledger.entries.length === 0 && <p className="text-gray-400">{t('cr.ledger_empty', 'Aucune écriture.')}</p>}
                        {ledger.entries.map(e => (
                          <div key={e.id} className="flex justify-between gap-2">
                            <span className="text-gray-600">{dateFr(e.created_at)} · {TYPE[e.type] || e.type}{e.order_id ? ` #${e.order_id}` : ''}{e.type === 'charge' && e.due_at ? ` (→ ${dateFr(e.due_at)}${e.paid_amount > 0 ? `, ${fdj(e.paid_amount)} ${t('cr.paid_part', 'réglés')}` : ''})` : ''}{e.method ? ` · ${e.method}` : ''}{e.note && e.type !== 'charge' ? ` — ${e.note}` : ''}</span>
                            <span className={`font-semibold shrink-0 ${e.type === 'charge' || e.type === 'adjustment' ? 'text-gray-800' : 'text-green-700'}`}>{e.type === 'charge' || e.type === 'adjustment' ? '+' : '−'}{fdj(e.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {msg && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-[92vw] bg-white border-2 border-[#d2e095] shadow-lg rounded-xl px-4 py-2.5 text-sm font-medium text-gray-700 flex items-center gap-3">
          <span>{msg}</span>
          <button onClick={() => setMsg('')} aria-label={t('admin.close', 'Fermer')} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
      )}
    </div>
  );
}
