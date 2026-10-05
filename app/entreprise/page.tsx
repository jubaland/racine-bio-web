'use client';

import { useState, useEffect, useCallback } from 'react';
import { ask, askText } from '../../components/Dialog';
import Link from 'next/link';
import { supabase, fetchProducts } from '../../lib/supabase';
import { useLanguage } from '../../context/LanguageContext';
import Header from '../../components/Header';
import CartDrawer from '../../components/CartDrawer';
import CreditPanel, { type CreditView } from '../../components/CreditPanel';
import { WAAFI_MERCHANT_NUMBER, WAAFI_ACCOUNT_HOLDER } from '../../lib/payments';

// Espace entreprise (compte prépayé) : cagnotte société, commandes, sites, équipe, commande récurrente.
// Rôles : gérant (tout), acheteur (commander, ses commandes), comptable (consultation).

type Tab = 'home' | 'wallet' | 'orders' | 'sites' | 'team' | 'recurring';
type Freq = 'weekly' | 'fortnightly' | 'monthly';
const FREQS: Freq[] = ['weekly', 'fortnightly', 'monthly'];
const fdj = (n: number) => `${Math.round(Number(n)).toLocaleString('fr-FR')} Fdj`;
const dateFr = (d: string) => new Date(d.length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
const csvDownload = (name: string, rows: (string | number)[][]) => {
  const csv = '﻿' + rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = name; a.click();
};
const inputCls = 'w-full border border-[#d2e095] rounded-xl px-4 py-2.5 text-sm bg-[#faf7e8] focus:outline-none focus:border-[#a8c800]';
const card = 'bg-white rounded-2xl border border-[#d2e095] p-5 md:p-6';

export default function CompanySpacePage() {
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;
  const [cartOpen, setCartOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [s, setS] = useState<any>(null);
  const [tab, setTab] = useState<Tab>('home');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [credit, setCredit] = useState<CreditView | null>(null);   // ligne de crédit de la société, s'il y en a une

  const tokenOf = async () => {
    let { data: { session } } = await supabase.auth.getSession();
    if (!session || (session.expires_at && session.expires_at * 1000 < Date.now() + 60000)) session = (await supabase.auth.refreshSession()).data.session;
    return session?.access_token;
  };
  const load = useCallback(async () => {
    const token = await tokenOf();
    if (!token) { window.location.href = '/login?redirect=/entreprise'; return; }
    const res = await fetch('/api/company', { headers: { Authorization: `Bearer ${token}` } });
    const j = await res.json();
    if (res.ok && !j.membership) { window.location.href = '/entreprises'; return; }
    if (res.ok) setS(j);
    setLoading(false);
    fetch('/api/credit', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null).then(c => { if (c?.company) setCredit(c.company); }).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const ERR: Record<string, string> = {
    below_min_topup: t('co.e_min', 'Montant inférieur à la recharge minimale.'), amount_invalid: t('co.e_amount', 'Montant invalide.'),
    invite_invalid: t('co.e_invite', 'Adresse e-mail ou rôle invalide.'), already_member: t('co.e_member', 'Cette personne est déjà membre.'), already_invited: t('co.e_invited', 'Cette personne est déjà invitée.'),
    last_manager: t('co.e_last_manager', 'Une société doit garder au moins un gérant.'), last_site: t('co.e_last_site', 'Une société doit garder au moins un site de livraison.'),
    site_invalid: t('co.e_site', 'Renseignez le nom du site, le destinataire, le téléphone (8 chiffres) et l\'adresse.'), site_required: t('co.e_site_required', 'Choisissez un site de livraison.'),
    empty_order: t('co.e_empty', 'Ajoutez au moins un produit.'), company_wallet_insufficient: t('co.e_balance', 'Solde de la cagnotte société insuffisant.'),
    stock_insufficient: t('co.e_stock', 'Stock insuffisant pour un ou plusieurs articles.'), threshold_invalid: t('co.e_threshold', 'Seuil invalide.'),
    company_inactive: t('co.e_inactive', 'Le compte entreprise n\'est pas actif.'), forbidden_role: t('co.e_role', 'Votre rôle ne permet pas cette action.'),
  };
  const act = async (body: any, okText?: string, confirmMsg?: string) => {
    if (confirmMsg && !(await ask({ text: confirmMsg }))) return false;
    setBusy(true); setMsg(null);
    const res = await fetch('/api/company', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await tokenOf()}` }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg({ ok: false, text: ERR[j.error] || j.error || 'Erreur' }); return false; }
    if (okText) setMsg({ ok: true, text: okText });
    await load(); return true;
  };

  if (loading || !s) return (
    <div className="min-h-screen bg-[#faf7e8]"><Header onCartOpen={() => setCartOpen(true)} /><p className="text-center text-gray-400 py-20">{t('admin.loading', 'Chargement...')}</p></div>
  );

  const role: string = s.membership.role;
  const isManager = role === 'manager', canOrder = role !== 'accountant', seesMoney = role !== 'buyer';
  const co = s.company;
  const active = co.status === 'active';
  const ROLE: Record<string, string> = { manager: t('co.role_manager', 'Gérant'), buyer: t('co.role_buyer', 'Acheteur'), accountant: t('co.role_accountant', 'Comptable') };
  const METHOD: Record<string, string> = { waafi: '📱 Waafi', cash: `💵 ${t('co.m_cash', 'Espèces')}`, transfer: `🏦 ${t('co.m_transfer', 'Virement')}`, cheque: `🧾 ${t('co.m_cheque', 'Chèque')}` };
  const STATUS: Record<string, string> = { pending: t('admin.status_pending', '⏳ En attente'), processing: t('admin.status_processing', '🚚 En cours'), shipping: t('admin.status_shipping', '📦 Expédié'), delivered: t('admin.status_delivered', '✅ Livré'), cancelled: t('admin.status_cancelled', '❌ Annulé') };
  const awaiting = (s.requests || []).filter((r: any) => r.status === 'awaiting');
  const TABS: [Tab, string][] = [
    ['home', `🏠 ${t('profile.tab_home', 'Accueil')}`],
    ...(seesMoney ? [['wallet', `💰 ${t('profile.tab_wallet', 'Cagnotte')}`] as [Tab, string]] : []),
    ['orders', `📦 ${t('profile.tab_orders', 'Commandes')}${awaiting.length ? ` (${awaiting.length})` : ''}`],
    ['sites', `📍 ${t('co.tab_sites', 'Sites')}`],
    ['team', `👥 ${t('co.tab_team', 'Équipe')}`],
    ...(role !== 'accountant' ? [['recurring', `🔄 ${t('co.tab_recurring', 'Récurrente')}`] as [Tab, string]] : []),
  ];

  return (
    <div className="min-h-screen bg-[#faf7e8]">
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
      <Header onCartOpen={() => setCartOpen(true)} />
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-8">

        <div className="bg-gradient-to-br from-[#1c3a05] via-[#2d6410] to-[#7a5800] rounded-3xl p-5 md:p-6 text-white mb-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-widest text-[#c8e050]">🏢 {t('nav.company_short', 'Mon entreprise')}</p>
              <h1 className="text-xl md:text-2xl font-bold truncate">{co.name}</h1>
              <p className="text-xs text-white/70 mt-0.5">{ROLE[role]}{co.activity ? ` · ${co.activity}` : ''}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-[#c8e050] uppercase tracking-wide">💰 {t('co.wallet', 'Cagnotte société')}</p>
              <p className="text-2xl md:text-3xl font-extrabold">{fdj(s.balance)}</p>
            </div>
          </div>
          {active && (
            <div className="flex flex-wrap gap-2 mt-4">
              {canOrder && <Link href="/" className="bg-[#a8c800] text-[#1c3a05] text-sm font-bold px-4 py-2 rounded-xl hover:bg-[#c8e050]">🛒 {t('co.order_now', 'Commander')}</Link>}
              {isManager && <button onClick={() => setTab('wallet')} className="bg-white/15 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-white/25">➕ {t('sub.topup', 'Recharger')}</button>}
            </div>
          )}
        </div>

        {co.status === 'pending' && <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3 rounded-2xl mb-5">⏳ {t('co.pending_banner', 'Votre demande est en cours d\'étude par notre équipe. Vous serez prévenu dès l\'ouverture du compte.')}</div>}
        {co.status === 'rejected' && <div className="bg-orange-50 border border-orange-200 text-[#c2410c] text-sm px-4 py-3 rounded-2xl mb-5">❌ {t('co.rejected_banner', 'La demande n\'a pas été retenue.')}{co.admin_note ? ` ${co.admin_note}` : ''}</div>}
        {co.status === 'suspended' && <div className="bg-orange-50 border border-orange-200 text-[#c2410c] text-sm px-4 py-3 rounded-2xl mb-5">⏸️ {t('co.suspended_banner', 'Le compte est suspendu : les commandes sont bloquées, le solde est conservé.')}{co.admin_note ? ` ${co.admin_note}` : ''}</div>}

        <div className="flex flex-wrap gap-1.5 mb-5">
          {TABS.map(([id, label]) => (
            <button key={id} onClick={() => { setTab(id); setMsg(null); }} className={`px-3 py-2 rounded-full text-sm font-semibold border transition ${tab === id ? 'bg-[#526500] text-white border-[#526500]' : 'bg-white text-[#526500] border-[#d2e095] hover:bg-[#ecf4d5]'}`}>{label}</button>
          ))}
        </div>
        {msg && <div className={`text-sm px-4 py-3 rounded-xl mb-4 ${msg.ok ? 'bg-green-50 text-[#526500] border border-green-200' : 'bg-orange-50 text-[#f97316]'}`}>{msg.ok ? '✅' : '⚠️'} {msg.text}</div>}

        {tab === 'home' && credit && <CreditPanel credit={credit} />}
        {tab === 'home' && <HomeTab s={s} t={t} setTab={setTab} isManager={isManager} awaiting={awaiting.length} />}
        {tab === 'wallet' && seesMoney && <WalletTab s={s} t={t} act={act} busy={busy} isManager={isManager} active={active} METHOD={METHOD} />}
        {tab === 'orders' && <OrdersTab s={s} t={t} act={act} busy={busy} isManager={isManager} role={role} STATUS={STATUS} />}
        {tab === 'sites' && <SitesTab s={s} t={t} act={act} busy={busy} isManager={isManager} />}
        {tab === 'team' && <TeamTab s={s} t={t} act={act} busy={busy} isManager={isManager} ROLE={ROLE} />}
        {tab === 'recurring' && role !== 'accountant' && <RecurringTab s={s} t={t} act={act} busy={busy} isManager={isManager} active={active} />}
      </div>
    </div>
  );
}

type P = { s: any; t: (k: string, f: string) => string; act: (body: any, okText?: string, confirmMsg?: string) => Promise<boolean>; busy: boolean; isManager: boolean };

function HomeTab({ s, t, setTab, isManager, awaiting }: { s: any; t: P['t']; setTab: (x: Tab) => void; isManager: boolean; awaiting: number }) {
  const live = (s.orders || []).filter((o: any) => ['pending', 'processing', 'shipping'].includes(o.status)).length;
  const month = new Date().toISOString().slice(0, 7);
  const spent = (s.orders || []).filter((o: any) => o.status !== 'cancelled' && String(o.created_at).startsWith(month)).reduce((a: number, o: any) => a + Number(o.total), 0);
  const low = s.balance < s.min_topup;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[[`📦`, live, t('co.k_live', 'commande(s) en cours')], [`🧾`, fdj(spent), t('co.k_month', 'commandé ce mois-ci')], [`📍`, s.sites.length, t('co.k_sites', 'site(s) de livraison')], [`👥`, s.members.length, t('co.k_members', 'membre(s)')]].map(([e, v, l]) => (
          <div key={String(l)} className="bg-white rounded-2xl border border-[#d2e095] p-4"><p className="text-xl">{e}</p><p className="text-lg font-bold text-[#526500] mt-1">{v}</p><p className="text-xs text-gray-400">{l}</p></div>
        ))}
      </div>
      {low && s.company.status === 'active' && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3 rounded-2xl flex flex-wrap items-center gap-2">
          <span>⚠️ {t('co.low_balance', 'Le solde de la cagnotte société est bas.')}</span>
          {isManager && <button onClick={() => setTab('wallet')} className="text-xs font-semibold bg-[#a8c800] text-white px-3 py-1.5 rounded-full">➕ {t('sub.topup', 'Recharger')}</button>}
        </div>
      )}
      {awaiting > 0 && (
        <button onClick={() => setTab('orders')} className="w-full text-left bg-[#ecf4d5] border border-[#d2e095] text-[#526500] text-sm px-4 py-3 rounded-2xl">🧾 {awaiting} {t('co.awaiting', 'commande(s) en attente de validation')} →</button>
      )}
      <div className={card}>
        <h2 className="font-semibold text-gray-800 mb-2">ℹ️ {t('co.how_order_title', 'Commander pour la société')}</h2>
        <p className="text-sm text-gray-500">{t('co.how_order', 'Remplissez votre panier sur le marché, puis au moment de finaliser choisissez « Commander pour mon entreprise » : vous sélectionnez le site de livraison et la commande est débitée de la cagnotte société.')}</p>
        {s.company.approval_threshold != null && <p className="text-xs text-gray-400 mt-2">🔐 {t('co.threshold_info', 'Au-delà de')} {fdj(s.company.approval_threshold)}, {t('co.threshold_info2', 'la commande d\'un acheteur est envoyée au gérant pour validation.')}</p>}
      </div>
    </div>
  );
}

function WalletTab({ s, t, act, busy, isManager, active, METHOD }: P & { active: boolean; METHOD: Record<string, string> }) {
  const [amount, setAmount] = useState(''); const [method, setMethod] = useState('waafi'); const [reference, setReference] = useState('');
  const pending = (s.deposits || []).filter((d: any) => d.status === 'pending');
  const exportCsv = () => csvDownload(`cagnotte-${s.company.name}-${new Date().toISOString().slice(0, 10)}.csv`, [
    [t('pay.col_date', 'Date'), t('co.col_type', 'Type'), t('co.col_amount', 'Montant'), t('pay.col_order', 'Commande'), t('co.col_note', 'Note')],
    ...(s.transactions || []).map((x: any) => [dateFr(x.created_at), x.type, x.amount, x.order_id ? `#${x.order_id}` : '', x.note || '']),
  ]);
  const TYPE: Record<string, string> = { deposit: t('co.ty_deposit', 'Recharge'), debit: t('co.ty_debit', 'Commande'), refund: t('co.ty_refund', 'Remboursement'), adjustment: t('co.ty_adjust', 'Ajustement') };
  return (
    <div className="space-y-4">
      {isManager && active && (
        <div className={card}>
          <h2 className="font-semibold text-gray-800 mb-1">➕ {t('co.topup_title', 'Recharger la cagnotte société')}</h2>
          <p className="text-xs text-gray-400 mb-3">{t('co.topup_hint', 'Effectuez le paiement, puis déclarez-le ici : le solde est crédité dès que notre équipe l\'a validé.')} {t('co.min_topup_is', 'Recharge minimale')} : <strong>{fdj(s.min_topup)}</strong>.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-sm text-gray-600">{t('co.col_amount', 'Montant')} (Fdj) *
              <input type="number" min={s.min_topup} value={amount} onChange={e => setAmount(e.target.value)} className={inputCls + ' mt-1'} placeholder={`Ex : ${Math.max(s.min_topup, 20000)}`} />
            </label>
            <label className="text-sm text-gray-600">{t('co.method', 'Moyen de paiement')}
              <select value={method} onChange={e => setMethod(e.target.value)} className={inputCls + ' mt-1'}>{Object.entries(METHOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </label>
            <label className="text-sm text-gray-600">{t('co.reference', 'Référence')}
              <input value={reference} onChange={e => setReference(e.target.value)} className={inputCls + ' mt-1'} placeholder={t('co.reference_ph', 'Ex : n° de transaction, n° de chèque')} />
            </label>
          </div>
          {method === 'waafi' && <p className="text-xs text-gray-500 mt-3">📱 Waafi : <strong className="tracking-widest text-[#526500]">{WAAFI_MERCHANT_NUMBER}</strong> — {WAAFI_ACCOUNT_HOLDER}</p>}
          {Number(amount) > 0 && Number(amount) < s.min_topup && <p className="text-xs text-[#f97316] mt-2">⚠️ {t('co.e_min', 'Montant inférieur à la recharge minimale.')}</p>}
          <button disabled={busy || !(Number(amount) >= s.min_topup)} onClick={async () => { if (await act({ action: 'deposit', amount, method, reference }, t('co.topup_sent', 'Recharge déclarée : elle sera créditée après validation.'))) { setAmount(''); setReference(''); } }}
            className="mt-4 w-full sm:w-auto bg-[#a8c800] text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-[#7d9800] disabled:opacity-50">{t('co.topup_declare', 'Déclarer la recharge')}</button>
        </div>
      )}
      {pending.length > 0 && (
        <div className={card}>
          <h2 className="font-semibold text-gray-800 mb-3">⏳ {t('co.topup_pending', 'Recharges en attente de validation')}</h2>
          <div className="space-y-2">{pending.map((d: any) => (
            <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 bg-[#faf7e8] rounded-xl px-4 py-3">
              <p className="text-sm text-gray-700"><strong>{fdj(d.amount)}</strong> · {METHOD[d.method] || d.method}{d.reference ? ` · ${d.reference}` : ''} · {dateFr(d.created_at)}</p>
              {isManager && <button disabled={busy} onClick={() => act({ action: 'cancel_deposit', id: d.id })} className="text-xs text-gray-400 hover:text-[#f97316]">{t('co.withdraw', 'Retirer')}</button>}
            </div>
          ))}</div>
        </div>
      )}
      <div className={card}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="font-semibold text-gray-800">📒 {t('co.movements', 'Mouvements')}</h2>
          {(s.transactions || []).length > 0 && <button onClick={exportCsv} className="text-xs font-semibold border border-[#d2e095] text-[#526500] rounded-lg px-3 py-1.5 hover:bg-[#ecf4d5]">⬇️ CSV</button>}
        </div>
        {(s.transactions || []).length === 0 ? <p className="text-sm text-gray-400">{t('co.no_movements', 'Aucun mouvement pour le moment.')}</p> : (
          <div className="divide-y divide-[#f0f4dc]">{s.transactions.map((x: any) => (
            <div key={x.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0"><p className="text-sm text-gray-800 truncate">{TYPE[x.type] || x.type}{x.order_id ? ` · #${x.order_id}` : ''}</p><p className="text-[11px] text-gray-400 truncate">{dateFr(x.created_at)}{x.note ? ` · ${x.note}` : ''}</p></div>
              <p className={`text-sm font-bold whitespace-nowrap ${Number(x.amount) >= 0 ? 'text-[#526500]' : 'text-gray-600'}`}>{Number(x.amount) >= 0 ? '+' : ''}{fdj(x.amount)}</p>
            </div>
          ))}</div>
        )}
      </div>
    </div>
  );
}

function OrdersTab({ s, t, act, busy, isManager, role, STATUS }: P & { role: string; STATUS: Record<string, string> }) {
  const awaiting = (s.requests || []).filter((r: any) => r.status === 'awaiting');
  const siteName = (id: number) => s.sites.find((x: any) => x.id === id)?.label || '—';
  const exportCsv = () => csvDownload(`releve-commandes-${s.company.name}-${new Date().toISOString().slice(0, 10)}.csv`, [
    [t('pay.col_date', 'Date'), t('pay.col_order', 'Commande'), t('co.col_status', 'Statut'), t('co.col_buyer', 'Commandé par'), t('co.col_site', 'Site'), t('pay.col_product', 'Produit'), t('pay.col_qty', 'Qté'), t('pay.col_price', 'Prix'), t('pay.col_total', 'Total')],
    ...(s.orders || []).flatMap((o: any) => (o.order_items || []).map((i: any) => [dateFr(o.created_at), `#${o.id}`, o.status, o.buyer_name, siteName(o.company_site_id), i.product_name, `${i.quantity} ${i.product_unit || ''}`, i.price, Number(i.price) * Number(i.quantity)])),
  ]);
  return (
    <div className="space-y-4">
      {awaiting.length > 0 && (
        <div className={card + ' !border-amber-200'}>
          <h2 className="font-semibold text-gray-800 mb-3">🧾 {t('co.to_validate', 'Commandes à valider')} ({awaiting.length})</h2>
          <div className="space-y-3">{awaiting.map((r: any) => (
            <div key={r.id} className="bg-[#faf7e8] rounded-xl p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-gray-800">{r.buyer_name} · <span className="text-[#526500]">{fdj(r.total)}</span></p>
                <p className="text-[11px] text-gray-400">{dateFr(r.created_at)} · 📍 {siteName(r.site_id)}</p>
              </div>
              <p className="text-xs text-gray-500 mt-1">{(r.items || []).map((i: any) => `${i.quantity} ${i.product_unit || ''} ${i.product_name}`.replace(/\s+/g, ' ')).join(' · ')}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {isManager && <button disabled={busy} onClick={() => act({ action: 'decide_request', id: r.id, decision: 'approve' }, t('co.req_approved', 'Commande validée et passée.'), `${t('co.confirm_validate', 'Valider cette commande de')} ${fdj(r.total)} ?`)} className="bg-[#526500] text-white text-xs font-semibold px-4 py-2 rounded-xl disabled:opacity-50">✅ {t('co.validate', 'Valider')}</button>}
                {isManager && <button disabled={busy} onClick={async () => { const n = await askText({ text: t('co.req_reject_reason', 'Motif du refus (envoyé à l\'acheteur) :') }); if (n !== null) act({ action: 'decide_request', id: r.id, decision: 'reject', note: n }); }} className="border border-orange-200 text-[#f97316] text-xs font-semibold px-4 py-2 rounded-xl bg-white disabled:opacity-50">{t('co.reject', 'Refuser')}</button>}
                {!isManager && <button disabled={busy} onClick={() => act({ action: 'cancel_request', id: r.id })} className="text-xs text-gray-400 hover:text-[#f97316]">{t('co.withdraw', 'Retirer')}</button>}
              </div>
            </div>
          ))}</div>
        </div>
      )}
      <div className={card}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="font-semibold text-gray-800">📦 {role === 'buyer' ? t('co.my_orders', 'Mes commandes pour la société') : t('co.all_orders', 'Commandes de la société')}</h2>
          {(s.orders || []).length > 0 && <button onClick={exportCsv} className="text-xs font-semibold border border-[#d2e095] text-[#526500] rounded-lg px-3 py-1.5 hover:bg-[#ecf4d5]">⬇️ {t('co.statement', 'Relevé CSV')}</button>}
        </div>
        {(s.orders || []).length === 0 ? <p className="text-sm text-gray-400">{t('co.no_orders', 'Aucune commande pour le moment.')}</p> : (
          <div className="space-y-2">{s.orders.map((o: any) => (
            <div key={o.id} className="bg-[#faf7e8] rounded-xl px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-gray-800">#{o.id} · {STATUS[o.status] || o.status}</p>
                <p className="text-sm font-bold text-[#526500]">{fdj(o.total)}</p>
              </div>
              <p className="text-[11px] text-gray-400">{dateFr(o.created_at)} · 📍 {siteName(o.company_site_id)} · 👤 {o.buyer_name}</p>
              <p className="text-xs text-gray-500 mt-1">{(o.order_items || []).map((i: any) => `${i.quantity} ${i.product_unit || ''} ${i.product_name}`.replace(/\s+/g, ' ')).join(' · ')}</p>
            </div>
          ))}</div>
        )}
      </div>
    </div>
  );
}

function SitesTab({ s, t, act, busy, isManager }: P) {
  const empty = { id: null as number | null, label: '', recipient_name: '', phone: '', address: '', is_default: false };
  const [form, setForm] = useState<typeof empty | null>(null);
  return (
    <div className="space-y-4">
      <div className={card}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="font-semibold text-gray-800">📍 {t('co.sites_title', 'Sites de livraison')}</h2>
          {isManager && <button onClick={() => setForm(empty)} className="text-xs font-semibold bg-[#a8c800] text-white rounded-lg px-3 py-1.5 hover:bg-[#7d9800]">{t('admin.add', '+ Ajouter')}</button>}
        </div>
        <div className="space-y-2">{s.sites.map((x: any) => (
          <div key={x.id} className="bg-[#faf7e8] rounded-xl px-4 py-3 flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800">{x.label}{x.is_default && <span className="ml-2 text-[11px] font-semibold bg-[#ecf4d5] text-[#526500] px-2 py-0.5 rounded-full">{t('co.default', 'Par défaut')}</span>}</p>
              <p className="text-xs text-gray-500">👤 {x.recipient_name} · 📞 {x.phone}</p>
              <p className="text-xs text-gray-500">{x.address}</p>
            </div>
            {isManager && (
              <div className="flex gap-3 text-xs font-medium">
                <button onClick={() => setForm({ id: x.id, label: x.label, recipient_name: x.recipient_name, phone: String(x.phone).slice(-8), address: x.address, is_default: x.is_default })} className="text-[#7d9800] hover:text-[#526500]">{t('admin.edit', 'Modifier')}</button>
                <button disabled={busy} onClick={() => act({ action: 'delete_site', id: x.id }, undefined, `${t('co.confirm_delete_site', 'Supprimer le site')} « ${x.label} » ?`)} className="text-orange-400 hover:text-[#f97316]">{t('admin.delete', 'Supprimer')}</button>
              </div>
            )}
          </div>
        ))}</div>
      </div>
      {form && (
        <div className={card}>
          <h2 className="font-semibold text-gray-800 mb-3">{form.id ? t('co.site_edit', 'Modifier le site') : t('co.site_add', 'Nouveau site')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-sm text-gray-600">{t('co.site_label', 'Nom du site')} *<input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} className={inputCls + ' mt-1'} placeholder={t('co.site_label_ph', 'Ex : Cuisine centrale')} /></label>
            <label className="text-sm text-gray-600">{t('co.site_recipient', 'Personne à la réception')} *<input value={form.recipient_name} onChange={e => setForm({ ...form, recipient_name: e.target.value })} className={inputCls + ' mt-1'} placeholder={t('co.f_contact_ph', 'Ex : Ahmed Hassan')} /></label>
            <label className="text-sm text-gray-600">{t('co.f_phone', 'Téléphone')} *<input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} inputMode="tel" className={inputCls + ' mt-1'} placeholder={t('producer.wa_ph', 'Ex : 77 12 34 56')} /></label>
            <label className="text-sm text-gray-600">{t('co.site_address', 'Adresse')} *<input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className={inputCls + ' mt-1'} placeholder={t('co.f_address_ph', 'Ex : Quartier 4, rue de la Paix, Djibouti-Ville')} /></label>
          </div>
          <label className="flex items-center gap-2 mt-3 text-sm text-gray-600 cursor-pointer"><input type="checkbox" checked={form.is_default} onChange={e => setForm({ ...form, is_default: e.target.checked })} className="w-4 h-4 accent-[#a8c800]" />{t('co.site_default', 'Site par défaut')}</label>
          <div className="flex gap-2 mt-4">
            <button onClick={() => setForm(null)} className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm">{t('admin.cancel', 'Annuler')}</button>
            <button disabled={busy} onClick={async () => { if (await act({ action: 'save_site', ...form }, t('co.site_saved', 'Site enregistré.'))) setForm(null); }} className="px-5 py-2.5 bg-[#a8c800] text-white rounded-xl text-sm font-semibold disabled:opacity-50">{t('producer.wa_save', 'Enregistrer')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function TeamTab({ s, t, act, busy, isManager, ROLE }: P & { ROLE: Record<string, string> }) {
  const [email, setEmail] = useState(''); const [role, setRole] = useState('buyer');
  const [threshold, setThreshold] = useState(s.company.approval_threshold != null ? String(s.company.approval_threshold) : '');
  const me = s.membership.user_id;
  return (
    <div className="space-y-4">
      <div className={card}>
        <h2 className="font-semibold text-gray-800 mb-3">👥 {t('co.members', 'Membres')}</h2>
        <div className="space-y-2">{s.members.map((m: any) => (
          <div key={m.user_id} className="bg-[#faf7e8] rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0"><p className="text-sm font-semibold text-gray-800 truncate">{m.full_name || m.email}{m.user_id === me ? ` (${t('co.you', 'vous')})` : ''}</p><p className="text-xs text-gray-500 truncate">{m.email}</p></div>
            {isManager ? (
              <div className="flex items-center gap-2">
                <select value={m.role} disabled={busy} onChange={e => act({ action: 'set_role', user_id: m.user_id, role: e.target.value })} className="border border-[#d2e095] rounded-lg px-2 py-1.5 text-xs bg-white">{Object.entries(ROLE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                {m.user_id !== me && <button disabled={busy} onClick={() => act({ action: 'remove_member', user_id: m.user_id }, undefined, `${t('co.confirm_remove', 'Retirer')} ${m.full_name || m.email} ?`)} className="text-xs text-orange-400 hover:text-[#f97316]">{t('co.remove', 'Retirer')}</button>}
              </div>
            ) : <span className="text-xs font-semibold bg-[#ecf4d5] text-[#526500] px-2 py-1 rounded-full">{ROLE[m.role]}</span>}
          </div>
        ))}</div>
        {(s.invites || []).length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">📨 {t('co.invites_pending', 'Invitations en attente')}</p>
            {s.invites.map((i: any) => (
              <div key={i.id} className="flex items-center justify-between gap-2 text-sm text-gray-600 py-1.5"><span className="truncate">{i.email} · {ROLE[i.role]}</span><button disabled={busy} onClick={() => act({ action: 'cancel_invite', invite_id: i.id })} className="text-xs text-gray-400 hover:text-[#f97316]">{t('admin.cancel', 'Annuler')}</button></div>
            ))}
          </div>
        )}
      </div>
      {isManager && (
        <>
          <div className={card}>
            <h2 className="font-semibold text-gray-800 mb-1">➕ {t('co.invite_title', 'Inviter un collaborateur')}</h2>
            <p className="text-xs text-gray-400 mb-3">{t('co.invite_hint', 'La personne reçoit un e-mail. Elle se connecte (ou crée un compte) avec cette adresse, puis accepte l\'invitation dans « Mon entreprise ».')}</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input value={email} onChange={e => setEmail(e.target.value)} className={inputCls + ' flex-1'} placeholder={t('co.f_email_ph', 'Ex : contact@palmier.dj')} />
              <select value={role} onChange={e => setRole(e.target.value)} className={inputCls + ' sm:!w-44'}>{Object.entries(ROLE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              <button disabled={busy || !email.trim()} onClick={async () => { if (await act({ action: 'invite', email, role }, t('co.invite_sent', 'Invitation envoyée.'))) setEmail(''); }} className="px-5 py-2.5 bg-[#a8c800] text-white rounded-xl text-sm font-semibold disabled:opacity-50">{t('co.invite', 'Inviter')}</button>
            </div>
            <p className="text-[11px] text-gray-400 mt-2">{t('co.roles_help', 'Gérant : tout. Acheteur : commander et suivre ses commandes. Comptable : consulter commandes et mouvements.')}</p>
          </div>
          <div className={card}>
            <h2 className="font-semibold text-gray-800 mb-1">🔐 {t('co.threshold_title', 'Validation des commandes')}</h2>
            <p className="text-xs text-gray-400 mb-3">{t('co.threshold_hint', 'Au-delà de ce montant, la commande d\'un acheteur vous est envoyée pour validation avant d\'être passée. Laissez vide pour ne rien valider.')}</p>
            <div className="flex gap-2">
              <input type="number" min="0" value={threshold} onChange={e => setThreshold(e.target.value)} className={inputCls + ' flex-1'} placeholder="Ex : 20000" />
              <button disabled={busy} onClick={() => act({ action: 'update_company', approval_threshold: threshold }, t('co.threshold_saved', 'Seuil enregistré.'))} className="px-5 py-2.5 bg-[#a8c800] text-white rounded-xl text-sm font-semibold disabled:opacity-50">{t('producer.wa_save', 'Enregistrer')}</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function RecurringTab({ s, t, act, busy, isManager, active }: P & { active: boolean }) {
  const [freq, setFreq] = useState<Freq>('weekly');
  const [products, setProducts] = useState<any[]>([]);
  const [qty, setQty] = useState<Record<number, number>>({});
  const [day, setDay] = useState(1); const [siteId, setSiteId] = useState<number | ''>(''); const [on, setOn] = useState(false);
  const [pick, setPick] = useState('');
  const sub = (s.subscriptions || []).find((x: any) => x.frequency === freq);
  useEffect(() => { fetchProducts().then(p => setProducts(p.filter((x: any) => !x.is_bundle))); }, []);
  useEffect(() => {
    setQty(Object.fromEntries((sub?.items || []).map((i: any) => [i.product_id, Number(i.quantity)])));
    setDay(sub?.delivery_day ?? 1); setOn(!!sub?.active && !sub?.paused);
    setSiteId(sub?.site_id ?? s.sites.find((x: any) => x.is_default)?.id ?? s.sites[0]?.id ?? '');
  }, [freq, s]); // eslint-disable-line react-hooks/exhaustive-deps
  const FREQ: Record<Freq, string> = { weekly: t('sub.freq_weekly', 'Hebdomadaire'), fortnightly: t('sub.freq_fortnightly', 'Quinzaine'), monthly: t('sub.freq_monthly', 'Mensuelle') };
  const DAYS = [t('sub.day_0', 'Dimanche'), t('sub.day_1', 'Lundi'), t('sub.day_2', 'Mardi'), t('sub.day_3', 'Mercredi'), t('sub.day_4', 'Jeudi'), t('sub.day_5', 'Vendredi'), t('sub.day_6', 'Samedi')];
  const basket = products.filter(p => (qty[p.id] || 0) > 0);
  const total = basket.reduce((a, p) => a + Number(p.price) * qty[p.id], 0) + (Number(sub?.delivery_fee) || 0);
  const missing = Math.max(0, total - s.balance);
  return (
    <div className="space-y-4">
      <div className="flex gap-2">{FREQS.map(f => (
        <button key={f} onClick={() => setFreq(f)} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition relative ${freq === f ? 'bg-[#526500] text-white border-[#526500]' : 'bg-white text-[#526500] border-[#d2e095] hover:bg-[#ecf4d5]'}`}>
          {FREQ[f]}{(s.subscriptions || []).some((x: any) => x.frequency === f && x.active && !x.paused) && <span className="absolute top-1.5 right-2 text-[10px]">🟢</span>}
        </button>
      ))}</div>
      {sub?.paused && sub?.paused_reason === 'low_balance' && <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3 rounded-xl">⏸️ {t('sub.paused_low_balance', 'En pause : solde insuffisant lors de la dernière livraison.')} {t('co.resume_auto', 'Elle reprendra automatiquement à la prochaine recharge suffisante.')}</div>}
      <div className={card}>
        <h2 className="font-semibold text-gray-800 mb-1">🔄 {t('co.recurring_title', 'Commande récurrente de la société')} — {FREQ[freq]}</h2>
        <p className="text-xs text-gray-400 mb-3">{t('co.recurring_hint', 'Livrée automatiquement le jour choisi et débitée de la cagnotte société. Les gérants sont prévenus la veille.')}</p>
        {basket.length === 0 ? <p className="text-sm text-gray-400 py-3">{t('sub.empty_basket', 'Aucun produit. Ajoutez-en un pour composer votre commande modèle.')}</p> : (
          <div className="divide-y divide-[#f0f7e0]">{basket.map(p => (
            <div key={p.id} className="flex items-center gap-3 py-2.5">
              <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#ecf4d5] flex-none">{p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover" /> : null}</div>
              <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-800 truncate">{p.name}</p><p className="text-xs text-gray-400">{Number(p.price).toLocaleString()} Fdj / {p.unit}</p></div>
              {isManager ? (
                <div className="flex items-center gap-2">
                  <button onClick={() => setQty(q => ({ ...q, [p.id]: Math.max(0, (q[p.id] || 0) - 1) }))} className="w-7 h-7 rounded-full border border-[#d2e095] text-[#526500]">−</button>
                  <span className="w-6 text-center text-sm font-semibold">{qty[p.id]}</span>
                  <button onClick={() => setQty(q => ({ ...q, [p.id]: (q[p.id] || 0) + 1 }))} className="w-7 h-7 rounded-full border border-[#d2e095] text-[#526500]">+</button>
                </div>
              ) : <span className="text-sm font-semibold">{qty[p.id]} {p.unit}</span>}
            </div>
          ))}</div>
        )}
        {isManager && (
          <div className="flex gap-2 mt-3">
            <select value={pick} onChange={e => setPick(e.target.value)} className={inputCls + ' flex-1 min-w-0'}>
              <option value="">{t('admin.bundle_add', '— Ajouter un produit —')}</option>
              {products.filter(p => !(qty[p.id] > 0) && (p.stock_qty ?? 0) > 0).map(p => <option key={p.id} value={p.id}>{p.name} · {Number(p.price).toLocaleString()} Fdj/{p.unit}</option>)}
            </select>
            <button disabled={!pick} onClick={() => { setQty(q => ({ ...q, [Number(pick)]: 1 })); setPick(''); }} className="px-4 py-2 bg-[#526500] text-white rounded-xl text-sm font-semibold disabled:opacity-40">+</button>
          </div>
        )}
        <div className="border-t border-[#d2e095] mt-3 pt-3 flex items-center justify-between"><span className="text-sm text-gray-600">{t('sub.total', 'Total')}{Number(sub?.delivery_fee) > 0 ? ` (${t('co.incl_delivery', 'livraison incluse')})` : ''}</span><span className="text-lg font-bold text-[#526500]">{fdj(total)}</span></div>
      </div>
      <div className={card + ' space-y-3'}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-sm text-gray-600">📅 {t('sub.delivery_day', 'Jour de livraison')}
            <select disabled={!isManager} value={day} onChange={e => setDay(Number(e.target.value))} className={inputCls + ' mt-1'}>{DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}</select>
          </label>
          <label className="text-sm text-gray-600">📍 {t('co.col_site', 'Site')}
            <select disabled={!isManager} value={siteId} onChange={e => setSiteId(Number(e.target.value))} className={inputCls + ' mt-1'}>{s.sites.map((x: any) => <option key={x.id} value={x.id}>{x.label}</option>)}</select>
          </label>
        </div>
        <label className="flex items-center gap-3 cursor-pointer select-none"><input type="checkbox" disabled={!isManager} checked={on} onChange={e => setOn(e.target.checked)} className="w-5 h-5 accent-[#a8c800]" /><span className="text-sm text-gray-700">{t('sub.activate_freq', 'Activer la livraison automatique')} ({FREQ[freq].toLowerCase()})</span></label>
        {on && total > 0 && (
          <p className={`text-sm px-3 py-2 rounded-xl ${missing > 0 ? 'bg-amber-50 text-amber-800' : 'bg-[#ecf4d5] text-[#526500]'}`}>
            📅 {t('sub.next_delivery', 'Prochaine livraison')} : <strong>{sub?.next_delivery ? dateFr(sub.next_delivery) : t('co.after_save', 'calculée à l\'enregistrement')}</strong>{missing > 0 ? ` · ⚠️ ${t('sub.missing_before', 'Il manque')} ${fdj(missing)}` : ''}
          </p>
        )}
        {isManager
          ? <button disabled={busy || !active} onClick={() => act({ action: 'save_subscription', frequency: freq, delivery_day: day, site_id: siteId, active: on, items: Object.entries(qty).map(([product_id, quantity]) => ({ product_id: Number(product_id), quantity })) }, t('sub.saved_msg', 'Votre commande modèle a été enregistrée.'))} className="w-full bg-[#a8c800] text-white py-3 rounded-2xl font-semibold hover:bg-[#7d9800] disabled:opacity-50">{t('producer.wa_save', 'Enregistrer')}</button>
          : <p className="text-xs text-gray-400">{t('co.recurring_manager_only', 'Seul un gérant peut modifier la commande récurrente.')}</p>}
      </div>
    </div>
  );
}
