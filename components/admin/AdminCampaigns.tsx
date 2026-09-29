'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { supabase } from '../../lib/supabase';
import { useCan } from '../../context/AdminPermsContext';
import { unitCost, suggestedPrice, marginOf } from '../../lib/campaign-math';
import AutoTranslateButton from './AutoTranslateButton';

// Admin › Achats groupés : producteurs étrangers, campagnes de précommande (fiche de coût, seuil,
// date limite), suivi jusqu'à la distribution, paiements au producteur.

type Supplier = { id: number; name: string; country: string; region: string | null; contact_name: string | null; phone: string | null; whatsapp: string | null; currency: string; payment_channel: string | null; notes: string | null; is_active: boolean };
type Campaign = any;
type Data = { suppliers: Supplier[]; campaigns: Campaign[]; pending_payments: any[]; settings: Record<string, number | null>; currencies: string[] };
type Detail = { campaign: Campaign; orders: any[]; payments: any[]; summary: any; next: string[] };

const fdj = (n: number) => `${Math.round(Number(n)).toLocaleString('fr-FR')} Fdj`;
const dateFr = (d: string | null) => d ? new Date(d.length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const dateTimeFr = (d: string) => new Date(d).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const toLocalInput = (iso: string | null) => { if (!iso) return ''; const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const COUNTRY: Record<string, string> = { SO: '🇸🇴 Somalie / Somaliland', ET: '🇪🇹 Éthiopie', DJ: '🇩🇯 Djibouti', OTHER: '🌍 Autre' };
const TR_LANGS: [string, string][] = [['en', '🇬🇧 English'], ['zh', '🇨🇳 中文'], ['so', '🇩🇯 Soomaali'], ['am', '🇪🇹 አማርኛ']];

export default function AdminCampaigns() {
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;
  const { can } = useCan();
  const canEdit = can('campaigns', 'edit');

  const [tab, setTab] = useState<'campaigns' | 'suppliers' | 'settings'>('campaigns');
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');   // chargement impossible : affiché, jamais un sablier sans fin
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState<Record<string, any> | null>(null);         // campagne en cours de saisie
  const [marginPct, setMarginPct] = useState('');
  const [supForm, setSupForm] = useState<Partial<Supplier> | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [pay, setPay] = useState<Record<string, any> | null>(null);
  const [received, setReceived] = useState('');
  const [settings, setSettings] = useState<Record<string, any>>({});

  const token = async () => {
    let { data: { session } } = await supabase.auth.getSession();
    if (!session || (session.expires_at && session.expires_at * 1000 < Date.now() + 60000)) session = (await supabase.auth.refreshSession()).data.session;
    return session?.access_token;
  };
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/campaigns', { headers: { Authorization: `Bearer ${await token()}` } });
      const j = await res.json();
      if (res.ok) { setData(j); setLoadError(''); setSettings(Object.fromEntries(Object.entries(j.settings).map(([k, v]) => [k, v ?? '']))); }
      else setLoadError(res.status === 401 ? 'session' : (j.error || String(res.status)));
    } catch (e: any) { setLoadError(e.message || 'network'); }
    setLoading(false);
  }, []);
  const openDetail = useCallback(async (id: number) => {
    try {
      const res = await fetch(`/api/admin/campaigns?id=${id}`, { headers: { Authorization: `Bearer ${await token()}` } });
      const j = await res.json();
      if (res.ok) { setDetail(j); setReceived(''); }
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  const ERR: Record<string, string> = {
    required: t('ag.err_required', 'Champ obligatoire'), invalid_value: t('ag.err_invalid', 'Valeur invalide'), name_required: t('ag.err_required', 'Champ obligatoire'),
    max_below_min: t('ag.err_max_min', 'Le plafond doit être au moins égal au seuil'), eta_before_close: t('ag.err_eta', 'L\'arrivée ne peut pas précéder la date limite'),
    locked_after_orders: t('ag.err_locked', 'Des clients ont déjà réservé : le prix et l\'unité de vente ne peuvent plus changer'),
    max_below_reserved: t('ag.err_max_reserved', 'Le plafond est inférieur aux quantités déjà réservées'), closes_in_past: t('ag.err_past', 'La date limite est déjà passée'),
    wrong_status: t('ag.err_status', 'Cette action n\'est pas possible à cette étape'), orders_not_delivered: t('ag.err_not_delivered', 'Des réservations ne sont pas encore remises'),
    not_open: t('ag.err_status', 'Cette action n\'est pas possible à cette étape'), campaign_closed: t('ag.err_closed', 'La campagne est clôturée'),
    distribution_required: t('ag.err_distribution', 'Choisissez la livraison, le retrait, ou les deux'), invalid_units: t('ag.err_invalid', 'Valeur invalide'),
  };
  const act = async (payload: any, key: string, confirmMsg?: string) => {
    if (confirmMsg && !confirm(confirmMsg)) return null;
    setBusy(key); setMsg('');
    try {
      const res = await fetch('/api/admin/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` }, body: JSON.stringify(payload) });
      const j = await res.json();
      if (!res.ok) { setMsg(`⚠️ ${ERR[j.error] || j.error || 'Erreur'}${j.field ? ` (${FIELD[j.field] || j.field})` : ''}`); return null; }
      await load();
      if (detail) await openDetail(detail.campaign.id);
      return j;
    } catch (e: any) { setMsg('⚠️ ' + e.message); return null; }
    finally { setBusy(null); }
  };

  const STATUS: Record<string, { label: string; cls: string }> = {
    draft:        { label: `📝 ${t('ag.st_draft', 'Brouillon')}`, cls: 'bg-gray-100 text-gray-600' },
    open:         { label: `🟢 ${t('ag.st_open', 'Ouverte')}`, cls: 'bg-green-100 text-green-700' },
    closed:       { label: `🎯 ${t('ag.st_closed', 'Seuil atteint, à commander')}`, cls: 'bg-orange-100 text-orange-700' },
    failed:       { label: `↩️ ${t('ag.st_failed', 'Non déclenchée')}`, cls: 'bg-gray-100 text-gray-500' },
    ordered:      { label: `🧾 ${t('ag.st_ordered', 'Commandée au producteur')}`, cls: 'bg-blue-100 text-blue-700' },
    in_transit:   { label: `🚚 ${t('ag.st_transit', 'En transit')}`, cls: 'bg-blue-100 text-blue-700' },
    arrived:      { label: `📦 ${t('ag.st_arrived', 'Arrivée, contrôlée')}`, cls: 'bg-amber-100 text-amber-800' },
    distributing: { label: `🤝 ${t('ag.st_distributing', 'En distribution')}`, cls: 'bg-amber-100 text-amber-800' },
    done:         { label: `✅ ${t('ag.st_done', 'Terminée')}`, cls: 'bg-green-100 text-green-700' },
    cancelled:    { label: `✖ ${t('ag.st_cancelled', 'Annulée')}`, cls: 'bg-red-100 text-red-600' },
  };
  const ORDER_ST: Record<string, string> = { pending_payment: t('ag.o_pending', 'Paiement à confirmer'), paid: t('ag.o_paid', 'Payée'), cancelled: t('ag.o_cancelled', 'Annulée'), refunded: t('ag.o_refunded', 'Remboursée'), delivered: t('ag.o_delivered', 'Remise') };
  const MODE: Record<string, string> = { delivery: `🚚 ${t('ag.mode_delivery', 'Livraison')}`, pickup: `📍 ${t('ag.mode_pickup', 'Retrait')}`, group: `👥 ${t('ag.mode_group', 'Avec le groupe')}` };
  const FIELD: Record<string, string> = {
    title: t('ag.f_title', 'Nom de la campagne'), unit_label: t('ag.f_unit', 'Unité de vente'), supplier_id: t('ag.f_supplier', 'Producteur'), supplier_unit_price: t('ag.f_sup_price', 'Prix du producteur'),
    exchange_rate: t('ag.f_rate', 'Taux de change'), price_djf: t('ag.f_price', 'Prix de vente'), min_units: t('ag.f_min', 'Seuil'), max_units: t('ag.f_max', 'Plafond'), closes_at: t('ag.f_closes', 'Date limite'),
    eta_date: t('ag.f_eta', 'Arrivée estimée'), pickup_place: t('ag.f_pickup', 'Lieu de retrait'), name: t('ag.s_name', 'Nom'), currency: t('ag.s_currency', 'Devise'), country: t('ag.s_country', 'Pays'),
  };

  const newCampaign = () => {
    const s = data?.suppliers.find(x => x.is_active);
    setMarginPct(data?.settings.margin_pct != null ? String(data.settings.margin_pct) : '');
    setForm({ supplier_id: s?.id ?? '', title: '', description: '', image_url: '', unit_label: '', unit_weight_kg: '', supplier_unit_price: '', exchange_rate: '', transport_per_unit: '', customs_per_unit: '', other_per_unit: '',
      loss_pct: data?.settings.loss_pct ?? '', price_djf: '', min_units: '', max_units: '', max_units_per_client: '', closes_at: '', eta_date: '', audience: 'all', allow_delivery: true, allow_pickup: true, pickup_place: '', delivery_fee: '',
      supplier_deposit_pct: data?.settings.supplier_deposit_pct ?? '', translations: {} });
  };
  const editCampaign = (c: Campaign) => { setMarginPct(''); setForm({ ...Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v ?? ''])), closes_at: toLocalInput(c.closes_at), translations: c.translations || {} }); };

  const inputCls = 'block w-full border border-[#d2e095] rounded-xl px-3 py-2 text-sm mt-1 bg-white';
  const F = (k: string, label: string, opts: { type?: string; ph?: string; hint?: string; step?: string } = {}) => (
    <label className="text-xs text-gray-600">{label}
      <input type={opts.type || 'text'} inputMode={opts.type === 'number' ? 'decimal' : undefined} step={opts.step} min={opts.type === 'number' ? 0 : undefined} disabled={!canEdit}
        value={form?.[k] ?? ''} onChange={e => setForm({ ...form, [k]: e.target.value })} placeholder={opts.ph} className={inputCls} />
      {opts.hint && <span className="block text-[11px] text-gray-400 mt-1">{opts.hint}</span>}
    </label>
  );

  const cost = form ? unitCost(form as any) : null;
  const suggested = form ? suggestedPrice(form as any, marginPct) : null;
  const margin = form && form.price_djf !== '' ? marginOf(form as any, form.price_djf) : null;
  const currency = form ? (data?.suppliers.find(s => s.id === Number(form.supplier_id))?.currency || '') : '';

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <h2 className="text-xl font-bold text-[#2d6410]">🌍 {t('admin.nav_campaigns', 'Achats groupés')}</h2>
        <div className="flex flex-wrap gap-1.5 bg-white border border-[#d2e095] rounded-2xl sm:rounded-full p-1">
          {([['campaigns', `📦 ${t('ag.tab_campaigns', 'Campagnes')}${data ? ` (${data.campaigns.length})` : ''}`], ['suppliers', `👨‍🌾 ${t('ag.tab_suppliers', 'Producteurs')}${data ? ` (${data.suppliers.length})` : ''}`], ['settings', `⚙️ ${t('mon.tab_settings', 'Réglages')}`]] as [typeof tab, string][]).map(([id, label]) => (
            <button key={id} onClick={() => { setTab(id); setDetail(null); setMsg(''); }} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${tab === id ? 'bg-[#526500] text-white' : 'text-[#526500] hover:bg-[#ecf4d5]'}`}>{label}</button>
          ))}
        </div>
      </div>
      {/* Message toujours visible, où que l'on soit dans la page (une erreur en haut de liste passait inaperçue) */}
      {msg && (
        <div role="alert" className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-2rem)] max-w-md rounded-2xl shadow-xl px-4 py-3 text-sm flex items-start gap-3 ${msg.startsWith('✅') ? 'bg-[#526500] text-white' : 'bg-red-600 text-white'}`}>
          <span className="flex-1 min-w-0 break-words">{msg}</span>
          <button onClick={() => setMsg('')} aria-label={t('install.close', 'Fermer')} className="flex-none text-white/80 hover:text-white text-lg leading-none">✕</button>
        </div>
      )}

      {loadError && !data ? (
        <div className="bg-white rounded-2xl border border-red-200 px-4 py-6 text-center">
          <p className="text-sm text-red-600">⚠️ {loadError === 'session' ? t('ag.err_session', 'Votre session a expiré. Reconnectez-vous.') : `${t('ag.err_load', 'Chargement impossible')} : ${loadError}`}</p>
          <button onClick={load} className="mt-3 text-xs font-semibold border border-[#d2e095] text-[#526500] rounded-lg px-3 py-1.5 hover:bg-[#ecf4d5]">🔄 {t('today.refresh', 'Actualiser')}</button>
        </div>
      ) : loading || !data ? <p className="text-center text-gray-400 py-16">⏳</p> : (
        <>
          {/* ── Campagnes : liste ── */}
          {tab === 'campaigns' && !detail && (
            <div className="space-y-4">
              {data.pending_payments.length > 0 && (
                <section>
                  <h3 className="font-bold text-amber-800 mb-2">💳 {t('ag.pay_title', 'Paiements Waafi à confirmer')} ({data.pending_payments.length})</h3>
                  {data.pending_payments.map((o: any) => (
                    <div key={o.id} className="bg-white rounded-xl border border-amber-200 px-4 py-3 flex flex-wrap items-center gap-3 mb-2">
                      <div className="flex-1 min-w-0 basis-full sm:basis-0">
                        <p className="text-sm font-semibold text-gray-800">{o.customer_name} <span className="text-xs font-normal text-gray-500">· {o.campaigns?.title}</span></p>
                        <p className="text-xs text-gray-500">{o.units} {o.campaigns?.unit_label} · {fdj(o.amount)} · {t('producer.sub_ref', 'Réf.')} {o.payment_reference} · {dateTimeFr(o.created_at)}</p>
                      </div>
                      {canEdit && <div className="flex gap-2">
                        <button disabled={busy === 'p' + o.id} onClick={() => act({ action: 'confirm_payment', order_id: o.id }, 'p' + o.id)} className="text-xs font-semibold bg-[#a8c800] text-white rounded-lg px-3 py-1.5 hover:bg-[#7d9800] disabled:opacity-50">✅ {t('mer.confirm', 'Confirmer')}</button>
                        <button disabled={busy === 'p' + o.id} onClick={() => { const note = prompt(t('mer.reject_note', 'Motif (optionnel) :')); if (note !== null) act({ action: 'reject_payment', order_id: o.id, note }, 'p' + o.id); }} className="text-xs font-semibold border border-red-200 text-red-500 rounded-lg px-3 py-1.5 hover:bg-red-50 disabled:opacity-50">✖ {t('mer.reject', 'Refuser')}</button>
                      </div>}
                    </div>
                  ))}
                </section>
              )}
              {canEdit && (data.suppliers.some(s => s.is_active)
                ? <button onClick={newCampaign} className="text-xs font-semibold bg-[#a8c800] text-white rounded-lg px-4 py-2 hover:bg-[#7d9800]">➕ {t('ag.new_campaign', 'Nouvelle campagne')}</button>
                : <p className="text-sm text-gray-500 bg-white rounded-xl border border-[#e3eebf] px-4 py-4">{t('ag.need_supplier', 'Ajoutez d\'abord un producteur dans l\'onglet Producteurs.')}</p>)}
              {data.campaigns.length === 0 ? <p className="text-sm text-gray-400 bg-white rounded-xl border border-[#e3eebf] px-4 py-6 text-center">{t('ag.none', 'Aucune campagne pour le moment.')}</p> : data.campaigns.map((c: Campaign) => {
                const st = STATUS[c.status]; const pct = Math.min(100, Math.round((c.units.paid / c.min_units) * 100));
                return (
                  <div key={c.id} className="bg-white rounded-2xl border-2 border-[#d2e095] px-4 py-3">
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="flex-1 min-w-0 basis-full sm:basis-0">
                        <p className="font-semibold text-gray-800">{c.title} <span className={`ml-1 text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${st.cls}`}>{st.label}</span></p>
                        <p className="text-xs text-gray-500">👨‍🌾 {c.suppliers?.name} · {fdj(c.price_djf)} / {c.unit_label} · {t('ag.cost', 'coût')} {fdj(c.cost.cost)} · {t('ag.margin', 'marge')} {fdj(c.margin.amount)}{c.margin.pct != null ? ` (${c.margin.pct} %)` : ''}</p>
                        <p className="text-xs text-gray-500">{t('ag.closes', 'Clôture')} {dateTimeFr(c.closes_at)}{c.eta_date ? ` · ${t('ag.eta', 'arrivée')} ${dateFr(c.eta_date)}` : ''}</p>
                        {c.status === 'draft' && new Date(c.closes_at).getTime() <= Date.now() && <p className="text-xs font-semibold text-red-500 mt-0.5">⚠️ {t('ag.draft_past', 'Date limite dépassée : modifiez-la pour pouvoir ouvrir la campagne.')}</p>}
                        <div className="mt-1.5 h-2 rounded-full bg-[#ecf4d5] overflow-hidden max-w-xs"><div className={`h-full ${pct >= 100 ? 'bg-[#526500]' : 'bg-[#a8c800]'}`} style={{ width: `${pct}%` }} /></div>
                        <p className="text-[11px] text-gray-500 mt-0.5">{c.units.paid} / {c.min_units} {c.unit_label}{c.max_units ? ` · ${t('ag.max', 'plafond')} ${c.max_units}` : ''}{c.units.pending ? ` · ${c.units.pending} ${t('ag.pending_units', 'en attente de paiement')}` : ''} · {c.units.buyers} {t('ag.buyers', 'acheteur(s)')}</p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <button onClick={() => openDetail(c.id)} className="text-xs font-semibold border border-[#d2e095] text-[#526500] rounded-lg px-3 py-1.5 hover:bg-[#ecf4d5]">📋 {t('ag.follow', 'Suivi')}</button>
                        {canEdit && ['draft', 'open'].includes(c.status) && <button onClick={() => editCampaign(c)} className="text-xs font-semibold border border-[#d2e095] text-[#526500] rounded-lg px-3 py-1.5 hover:bg-[#ecf4d5]">✏️ {t('admin.edit', 'Modifier')}</button>}
                        {canEdit && c.status === 'draft' && new Date(c.closes_at).getTime() > Date.now() && <button disabled={busy === 'o' + c.id} onClick={() => act({ action: 'open', id: c.id }, 'o' + c.id, t('ag.open_confirm', 'Ouvrir cette campagne aux réservations ?'))} className="text-xs font-semibold bg-[#a8c800] text-white rounded-lg px-3 py-1.5 hover:bg-[#7d9800] disabled:opacity-50">🟢 {t('ag.open', 'Ouvrir')}</button>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Campagne : suivi ── */}
          {tab === 'campaigns' && detail && (() => {
            const c = detail.campaign, s = detail.summary, st = STATUS[c.status];
            const NEXT_LABEL: Record<string, string> = { ordered: `🧾 ${t('ag.do_ordered', 'Commande passée au producteur')}`, in_transit: `🚚 ${t('ag.do_transit', 'Marchandise partie')}`, distributing: `🤝 ${t('ag.do_distribute', 'Lancer la distribution')}`, done: `✅ ${t('ag.do_done', 'Terminer la campagne')}` };
            return (
              <div className="space-y-4">
                <button onClick={() => setDetail(null)} className="text-xs font-semibold border border-[#d2e095] text-[#526500] rounded-full px-3 py-1.5 hover:bg-[#ecf4d5]">← {t('ag.back', 'Toutes les campagnes')}</button>
                <div className="bg-white rounded-2xl border-2 border-[#d2e095] px-4 py-4">
                  <p className="font-bold text-gray-800">{c.title} <span className={`ml-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span></p>
                  <p className="text-xs text-gray-500 mt-0.5">👨‍🌾 {c.suppliers?.name} · {COUNTRY[c.suppliers?.country] || ''}{c.suppliers?.region ? ` · ${c.suppliers.region}` : ''}{c.suppliers?.whatsapp ? ` · 💬 ${c.suppliers.whatsapp}` : ''}</p>
                  {c.status_note && <p className="text-xs text-red-500 mt-1">{c.status_note}</p>}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-3">
                    {([[t('ag.k_units', 'Unités vendues'), `${s.units} ${c.unit_label}`], [t('ag.k_sales', 'Ventes nettes'), fdj(s.net_sales)], [t('ag.k_refunded', 'Remboursé'), fdj(s.refunded)], [t('ag.k_margin', 'Marge prévue'), fdj(s.expected_margin)]] as [string, string][]).map(([k, v]) => (
                      <div key={k} className="bg-[#f6f9e6] rounded-xl px-3 py-2"><p className="text-[11px] text-gray-500">{k}</p><p className="text-sm font-bold text-[#526500] break-words">{v}</p></div>
                    ))}
                  </div>
                  {canEdit && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {c.status === 'open' && <button disabled={busy === 'close'} onClick={() => act({ action: 'close_now', id: c.id }, 'close', t('ag.close_confirm', 'Clôturer maintenant ? Si le seuil n\'est pas atteint, tous les clients seront remboursés.'))} className="text-xs font-semibold bg-[#526500] text-white rounded-lg px-3 py-1.5 hover:bg-[#3a4800] disabled:opacity-50">🎯 {t('ag.close_now', 'Clôturer maintenant')}</button>}
                      {detail.next.filter(n => NEXT_LABEL[n]).map(n => (
                        <button key={n} disabled={busy === n} onClick={() => act({ action: 'set_status', id: c.id, status: n }, n)} className="text-xs font-semibold bg-[#a8c800] text-white rounded-lg px-3 py-1.5 hover:bg-[#7d9800] disabled:opacity-50">{NEXT_LABEL[n]}</button>
                      ))}
                      {detail.next.includes('cancelled') && <button disabled={busy === 'cancel'} onClick={() => { const note = prompt(t('ag.cancel_note', 'Motif de l\'annulation (communiqué aux clients, qui seront tous remboursés) :')); if (note !== null) act({ action: 'cancel', id: c.id, note }, 'cancel'); }} className="text-xs font-semibold border border-red-200 text-red-500 rounded-lg px-3 py-1.5 hover:bg-red-50 disabled:opacity-50">✖ {t('ag.cancel', 'Annuler et rembourser')}</button>}
                    </div>
                  )}
                  {canEdit && detail.next.includes('arrived') && (
                    <div className="mt-3 bg-[#faf7e8] rounded-xl px-3 py-3">
                      <p className="text-xs font-semibold text-gray-700">📦 {t('ag.receive_title', 'Réception contrôlée')}</p>
                      <p className="text-[11px] text-gray-500 mb-2">{t('ag.receive_hint', 'Quantité réellement reçue et vendable. S\'il en manque, les réservations sont réduites au prorata et la différence est remboursée.')} {t('ag.reserved', 'Réservé')} : {s.units} {c.unit_label}</p>
                      <div className="flex gap-2">
                        <input type="number" inputMode="numeric" min={0} step={1} value={received} onChange={e => setReceived(e.target.value)} placeholder={t('ag.receive_ph', 'Ex : nombre d\'unités reçues')} className="w-48 border border-[#d2e095] rounded-xl px-3 py-2 text-sm bg-white" />
                        <button disabled={busy === 'rcv' || received === ''} onClick={() => act({ action: 'receive', id: c.id, received_units: received }, 'rcv', `${t('ag.receive_confirm', 'Enregistrer la réception de')} ${received} ${c.unit_label} ?`)} className="text-xs font-semibold bg-[#a8c800] text-white rounded-lg px-3 py-1.5 hover:bg-[#7d9800] disabled:opacity-50">✅ {t('ag.receive', 'Enregistrer')}</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Producteur : dû, payé, solde */}
                <div className="bg-white rounded-2xl border-2 border-[#d2e095] px-4 py-4">
                  <p className="font-semibold text-gray-800 mb-1">💱 {t('ag.sup_pay_title', 'Paiement du producteur')}</p>
                  <p className="text-xs text-gray-500">{t('ag.sup_due', 'Dû')} : <b>{s.supplier.due_currency} {s.supplier.currency}</b> ({s.supplier.basis_units} {c.unit_label}) · {t('ag.sup_paid', 'payé')} : <b>{s.supplier.paid_currency} {s.supplier.currency}</b> ({fdj(s.supplier.paid_djf)}) · {t('ag.sup_balance', 'reste')} : <b>{s.supplier.balance_currency} {s.supplier.currency}</b>{s.supplier.deposit_currency != null ? ` · ${t('ag.sup_deposit', 'acompte prévu')} : ${s.supplier.deposit_currency} ${s.supplier.currency}` : ''}</p>
                  {detail.payments.map((p: any) => (
                    <p key={p.id} className="text-xs text-gray-600 mt-1">{dateFr(p.paid_at)} · {p.kind === 'deposit' ? t('ag.kind_deposit', 'Acompte') : p.kind === 'balance' ? t('ag.kind_balance', 'Solde') : t('ag.kind_other', 'Autre')} · {p.amount_currency} {p.currency} × {p.exchange_rate} = {fdj(p.amount_djf)}{p.method ? ` · ${p.method}` : ''}{p.reference ? ` · ${p.reference}` : ''}
                      {canEdit && <button onClick={() => act({ action: 'delete_supplier_payment', payment_id: p.id }, 'dp' + p.id, t('ag.pay_delete_confirm', 'Supprimer cette ligne de paiement ?'))} className="ml-2 text-red-400 hover:text-red-600">🗑️</button>}</p>
                  ))}
                  {canEdit && ['closed', 'ordered', 'in_transit', 'arrived', 'distributing', 'done'].includes(c.status) && (
                    <button onClick={() => setPay({ id: c.id, kind: detail.payments.length ? 'balance' : 'deposit', amount_currency: '', exchange_rate: c.exchange_rate, method: c.suppliers?.payment_channel || '', reference: '', currency: c.currency })} className="mt-2 text-xs font-semibold border border-[#d2e095] text-[#526500] rounded-lg px-3 py-1.5 hover:bg-[#ecf4d5]">➕ {t('ag.pay_add', 'Enregistrer un paiement')}</button>
                  )}
                </div>

                {/* Réservations */}
                <div className="bg-white rounded-2xl border-2 border-[#d2e095] px-4 py-4">
                  <p className="font-semibold text-gray-800 mb-2">🧾 {t('ag.orders_title', 'Réservations')} ({detail.orders.length})</p>
                  {detail.orders.length === 0 ? <p className="text-sm text-gray-400">{t('ag.orders_none', 'Aucune réservation.')}</p> : detail.orders.map((o: any) => (
                    <div key={o.id} className="flex flex-wrap items-center gap-2 border-b border-[#f0f4dc] last:border-0 py-2">
                      <div className="flex-1 min-w-0 basis-full sm:basis-0">
                        <p className="text-sm text-gray-800">{o.customer_name || '—'} <span className="text-xs text-gray-500">· {o.final_units != null && o.final_units !== o.units ? `${o.final_units} / ${o.units}` : o.units} {c.unit_label} · {fdj(o.amount)}{Number(o.refunded) > 0 ? ` · ${t('ag.o_refunded', 'Remboursée')} ${fdj(o.refunded)}` : ''}</span></p>
                        <p className="text-[11px] text-gray-500">{MODE[o.delivery_mode]}{o.address ? ` · ${o.address}` : ''}{o.phone ? ` · 📞 ${o.phone}` : ''}{o.group_code ? ` · 👥 ${o.group_code}` : ''} · {o.payment_method === 'waafi' ? `Waafi ${o.payment_reference || ''}` : o.payment_method === 'company_wallet' ? t('ag.pm_company', 'Cagnotte société') : t('ag.pm_wallet', 'Cagnotte')}</p>
                      </div>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#ecf4d5] text-[#526500] whitespace-nowrap">{ORDER_ST[o.status] || o.status}</span>
                      {canEdit && o.status === 'paid' && ['arrived', 'distributing'].includes(c.status) && <button disabled={busy === 'd' + o.id} onClick={() => act({ action: 'deliver', order_id: o.id }, 'd' + o.id)} className="text-xs font-semibold bg-[#a8c800] text-white rounded-lg px-3 py-1.5 hover:bg-[#7d9800] disabled:opacity-50">✅ {t('ag.deliver', 'Remise')}</button>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ── Producteurs ── */}
          {tab === 'suppliers' && (
            <div className="space-y-2">
              {canEdit && <button onClick={() => setSupForm({ name: '', country: 'SO', currency: 'USD', is_active: true })} className="text-xs font-semibold bg-[#a8c800] text-white rounded-lg px-4 py-2 hover:bg-[#7d9800]">➕ {t('ag.new_supplier', 'Nouveau producteur')}</button>}
              {data.suppliers.length === 0 ? <p className="text-sm text-gray-400 bg-white rounded-xl border border-[#e3eebf] px-4 py-6 text-center">{t('ag.suppliers_none', 'Aucun producteur enregistré.')}</p> : data.suppliers.map(s => (
                <div key={s.id} className="bg-white rounded-xl border border-[#d2e095] px-4 py-3 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-0 basis-full sm:basis-0">
                    <p className="font-semibold text-gray-800">{s.name} {!s.is_active && <span className="text-[11px] text-gray-400">({t('mer.plan_inactive', 'inactif')})</span>}</p>
                    <p className="text-xs text-gray-500">{COUNTRY[s.country]}{s.region ? ` · ${s.region}` : ''} · {s.currency}{s.payment_channel ? ` · ${s.payment_channel}` : ''}{s.contact_name ? ` · ${s.contact_name}` : ''}{s.phone ? ` · 📞 ${s.phone}` : ''}{s.whatsapp ? ` · 💬 ${s.whatsapp}` : ''}</p>
                    {s.notes && <p className="text-xs text-gray-400 mt-0.5">{s.notes}</p>}
                  </div>
                  {canEdit && <button onClick={() => setSupForm(s)} className="text-xs font-semibold border border-[#d2e095] text-[#526500] rounded-lg px-3 py-1.5 hover:bg-[#ecf4d5]">✏️ {t('admin.edit', 'Modifier')}</button>}
                </div>
              ))}
            </div>
          )}

          {/* ── Réglages ── */}
          {tab === 'settings' && (
            <div className="bg-white rounded-2xl border-2 border-[#d2e095] px-4 py-4 max-w-2xl">
              <p className="font-semibold text-gray-800">⚙️ {t('ag.set_title', 'Valeurs proposées à la création d\'une campagne')}</p>
              <p className="text-xs text-gray-500 mb-3">{t('ag.set_desc', 'Facultatives : elles préremplissent la fiche de coût et restent modifiables campagne par campagne. Vide : rien n\'est prérempli.')}</p>
              <div className="grid sm:grid-cols-3 gap-3">
                {([['loss_pct', t('ag.set_loss', 'Provision pour pertes (%)')], ['margin_pct', t('ag.set_margin', 'Marge visée (%)')], ['supplier_deposit_pct', t('ag.set_deposit', 'Acompte au producteur (%)')]] as [string, string][]).map(([k, label]) => (
                  <label key={k} className="text-xs text-gray-600">{label}
                    <input type="number" inputMode="decimal" min={0} step="0.5" disabled={!canEdit} value={settings[k] ?? ''} onChange={e => setSettings({ ...settings, [k]: e.target.value })} placeholder={t('ag.pct_ph', 'Ex : pourcentage')} className={inputCls} />
                  </label>
                ))}
              </div>
              {canEdit && <button disabled={busy === 'set'} onClick={async () => { if (await act({ action: 'save_settings', ...settings }, 'set')) setMsg(`✅ ${t('mer.com_saved', 'Enregistré')}`); }} className="mt-3 text-xs font-semibold bg-[#a8c800] text-white rounded-lg px-4 py-2 hover:bg-[#7d9800] disabled:opacity-50">💾 {t('admin.save', 'Enregistrer')}</button>}
            </div>
          )}
        </>
      )}

      {/* ── Fenêtre : campagne ── */}
      {form && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-3" onClick={() => setForm(null)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-[#2d6410]">🌍 {form.id ? t('admin.edit', 'Modifier') : t('ag.new_campaign', 'Nouvelle campagne')}</h3>

            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-xs text-gray-600">{FIELD.supplier_id} *
                <select disabled={!canEdit} value={form.supplier_id} onChange={e => setForm({ ...form, supplier_id: e.target.value })} className={inputCls}>
                  {data?.suppliers.filter(s => s.is_active || s.id === Number(form.supplier_id)).map(s => <option key={s.id} value={s.id}>{s.name} ({s.currency})</option>)}
                </select>
              </label>
              {F('title', `${FIELD.title} *`, { ph: t('ag.title_ph', 'Ex : Oignons rouges de Gabiley') })}
              {F('unit_label', `${FIELD.unit_label} *`, { ph: t('ag.unit_ph', 'Ex : sac de 50 kg'), hint: t('ag.unit_hint', 'Ce que le client achète et que le producteur expédie.') })}
              {F('unit_weight_kg', t('ag.f_weight', 'Poids d\'une unité (kg)'), { type: 'number', ph: t('ag.weight_ph', 'Ex : poids en kg') })}
              <label className="text-xs text-gray-600 sm:col-span-2">{t('ag.f_desc', 'Description')}
                <textarea rows={2} disabled={!canEdit} value={form.description ?? ''} onChange={e => setForm({ ...form, description: e.target.value })} placeholder={t('ag.desc_ph', 'Ex : variété, calibre, date de récolte')} className={inputCls + ' resize-none'} />
              </label>
              <div className="sm:col-span-2">{F('image_url', t('ag.f_image', 'Photo (adresse de l\'image)'), { ph: 'https://…' })}</div>
            </div>

            <div className="bg-[#faf7e8] rounded-xl p-3">
              <p className="text-xs font-semibold text-gray-700 mb-2">🧮 {t('ag.sheet', 'Fiche de coût, par unité de vente')}</p>
              <div className="grid sm:grid-cols-3 gap-3">
                {F('supplier_unit_price', `${FIELD.supplier_unit_price} (${currency || '…'}) *`, { type: 'number', step: 'any', ph: t('ag.amount_ph', 'Ex : montant') })}
                {F('exchange_rate', `${FIELD.exchange_rate} *`, { type: 'number', step: 'any', ph: t('ag.rate_ph', 'Ex : Fdj pour 1 unité de devise'), hint: `1 ${currency || '…'} = ? Fdj` })}
                {F('transport_per_unit', t('ag.f_transport', 'Transport (Fdj)'), { type: 'number', ph: t('ag.amount_ph', 'Ex : montant') })}
                {F('customs_per_unit', t('ag.f_customs', 'Douane et certificats (Fdj)'), { type: 'number', ph: t('ag.amount_ph', 'Ex : montant') })}
                {F('other_per_unit', t('ag.f_other', 'Autres frais (Fdj)'), { type: 'number', ph: t('ag.amount_ph', 'Ex : montant') })}
                {F('loss_pct', t('ag.set_loss', 'Provision pour pertes (%)'), { type: 'number', step: '0.5', ph: t('ag.pct_ph', 'Ex : pourcentage') })}
              </div>
              {cost && cost.cost > 0 && (
                <p className="text-xs text-gray-600 mt-3">{t('ag.s_purchase', 'Achat')} {fdj(cost.purchase)} · {t('ag.s_landed', 'rendu à Djibouti')} {fdj(cost.landed)} · {t('ag.s_loss', 'pertes')} {fdj(cost.loss)} · <b className="text-[#526500]">{t('ag.s_cost', 'coût de revient')} {fdj(cost.cost)}</b></p>
              )}
              <div className="grid sm:grid-cols-3 gap-3 mt-3 items-end">
                <label className="text-xs text-gray-600">{t('ag.set_margin', 'Marge visée (%)')}
                  <input type="number" inputMode="decimal" min={0} step="0.5" value={marginPct} onChange={e => setMarginPct(e.target.value)} placeholder={t('ag.pct_ph', 'Ex : pourcentage')} className={inputCls} />
                </label>
                <div className="text-xs text-gray-600">
                  {suggested != null && cost && cost.cost > 0 ? <button type="button" onClick={() => setForm({ ...form, price_djf: String(suggested) })} className="w-full text-left border border-dashed border-[#a8c800] rounded-xl px-3 py-2 bg-white hover:bg-[#f6f9e6]">💡 {t('ag.suggested', 'Prix conseillé')} : <b>{fdj(suggested)}</b><span className="block text-[11px] text-gray-400">{t('ag.use_it', 'Cliquer pour l\'utiliser')}</span></button> : <span className="text-[11px] text-gray-400">{t('ag.suggest_hint', 'Indiquez une marge visée pour obtenir un prix conseillé.')}</span>}
                </div>
                {F('price_djf', `${FIELD.price_djf} (Fdj) *`, { type: 'number', ph: t('ag.amount_ph', 'Ex : montant') })}
              </div>
              {margin && cost && cost.cost > 0 && <p className={`text-xs mt-2 font-semibold ${margin.amount < 0 ? 'text-red-500' : 'text-[#526500]'}`}>{margin.amount < 0 ? `⚠️ ${t('ag.loss_warning', 'Vente à perte')} : ` : `${t('ag.margin_unit', 'Marge par unité')} : `}{fdj(margin.amount)}{margin.pct != null ? ` (${margin.pct} %)` : ''}</p>}
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              {F('min_units', `${t('ag.f_min_long', 'Seuil de déclenchement')} *`, { type: 'number', step: '1', ph: t('ag.units_ph', 'Ex : nombre d\'unités'), hint: t('ag.min_hint', 'En dessous, la campagne n\'a pas lieu et tout le monde est remboursé.') })}
              {F('max_units', t('ag.f_max_long', 'Plafond (facultatif)'), { type: 'number', step: '1', ph: t('ag.units_ph', 'Ex : nombre d\'unités'), hint: t('ag.max_hint', 'Capacité du producteur ou du camion.') })}
              {F('max_units_per_client', t('ag.f_max_client', 'Maximum par client (facultatif)'), { type: 'number', step: '1', ph: t('ag.units_ph', 'Ex : nombre d\'unités') })}
              {F('closes_at', `${FIELD.closes_at} *`, { type: 'datetime-local', hint: t('ag.closes_hint', 'Fin des réservations. Elle doit être dans le futur.') })}
              {F('eta_date', FIELD.eta_date, { type: 'date' })}
              {F('supplier_deposit_pct', t('ag.set_deposit', 'Acompte au producteur (%)'), { type: 'number', step: '0.5', ph: t('ag.pct_ph', 'Ex : pourcentage') })}
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={form.allow_pickup !== false} onChange={e => setForm({ ...form, allow_pickup: e.target.checked })} className="accent-[#a8c800]" /> 📍 {t('ag.allow_pickup', 'Retrait sur place')}</label>
                {form.allow_pickup !== false && F('pickup_place', `${FIELD.pickup_place} *`, { ph: t('ag.pickup_ph', 'Ex : dépôt Hornafresh, quartier') })}
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={form.allow_delivery !== false} onChange={e => setForm({ ...form, allow_delivery: e.target.checked })} className="accent-[#a8c800]" /> 🚚 {t('ag.allow_delivery', 'Livraison')}</label>
                {form.allow_delivery !== false && F('delivery_fee', t('ag.f_fee', 'Frais de livraison (Fdj)'), { type: 'number', ph: t('ag.amount_ph', 'Ex : montant') })}
              </div>
              <label className="text-xs text-gray-600">{t('ag.f_audience', 'Ouverte à')}
                <select value={form.audience} onChange={e => setForm({ ...form, audience: e.target.value })} className={inputCls}>
                  <option value="all">{t('ag.aud_all', 'Tous les clients')}</option>
                  <option value="pro">{t('ag.aud_pro', 'Comptes entreprise seulement')}</option>
                </select>
              </label>
            </div>

            <details className="border border-[#e3eebf] rounded-xl px-3 py-2">
              <summary className="text-xs font-semibold text-[#526500] cursor-pointer">🌍 {t('ag.tr_title', 'Traductions (facultatif)')}</summary>
              <p className="text-[11px] text-gray-400 my-2">{t('ag.tr_hint', 'Sans traduction, la campagne s\'affiche en français dans cette langue.')}</p>
              {canEdit && (
                <AutoTranslateButton className="mb-3" source={{ title: form.title, unit_label: form.unit_label, description: form.description }} current={form.translations}
                  onTranslated={(l, f) => setForm((p: any) => ({ ...p, translations: { ...p.translations, [l]: { ...(p.translations?.[l] || {}), ...f } } }))} />
              )}
              {TR_LANGS.map(([l, label]) => (
                <div key={l} className="grid sm:grid-cols-2 gap-2 mb-2">
                  <input value={form.translations?.[l]?.title || ''} onChange={e => setForm({ ...form, translations: { ...form.translations, [l]: { ...(form.translations?.[l] || {}), title: e.target.value } } })} placeholder={`${label} · ${FIELD.title}`} className="border border-[#d2e095] rounded-xl px-3 py-2 text-sm" />
                  <input value={form.translations?.[l]?.unit_label || ''} onChange={e => setForm({ ...form, translations: { ...form.translations, [l]: { ...(form.translations?.[l] || {}), unit_label: e.target.value } } })} placeholder={`${label} · ${FIELD.unit_label}`} className="border border-[#d2e095] rounded-xl px-3 py-2 text-sm" />
                  <textarea rows={2} value={form.translations?.[l]?.description || ''} onChange={e => setForm({ ...form, translations: { ...form.translations, [l]: { ...(form.translations?.[l] || {}), description: e.target.value } } })} placeholder={`${label} · ${t('ag.f_desc', 'Description')}`} className="sm:col-span-2 border border-[#d2e095] rounded-xl px-3 py-2 text-sm resize-none" />
                </div>
              ))}
            </details>

            <div className="flex gap-2 justify-end">
              <button onClick={() => { setForm(null); setMsg(''); }} className="text-sm px-4 py-2 rounded-xl border border-gray-200 text-gray-600">{t('admin.cancel', 'Annuler')}</button>
              {canEdit && <button disabled={busy === 'save'} onClick={async () => { if (await act({ action: 'save_campaign', ...form, closes_at: form.closes_at ? new Date(form.closes_at).toISOString() : '' }, 'save')) { setForm(null); setMsg(''); } }} className="text-sm font-semibold px-4 py-2 rounded-xl bg-[#a8c800] text-white hover:bg-[#7d9800] disabled:opacity-50">💾 {t('ag.save_draft', 'Enregistrer')}</button>}
            </div>
          </div>
        </div>
      )}

      {/* ── Fenêtre : producteur ── */}
      {supForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-3" onClick={() => setSupForm(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[92vh] overflow-y-auto p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-[#2d6410]">👨‍🌾 {supForm.id ? t('admin.edit', 'Modifier') : t('ag.new_supplier', 'Nouveau producteur')}</h3>
            <input value={supForm.name || ''} onChange={e => setSupForm({ ...supForm, name: e.target.value })} placeholder={t('ag.s_name_ph', 'Ex : nom du producteur ou de la coopérative')} className="w-full border border-[#d2e095] rounded-xl px-3 py-2 text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-gray-600">{FIELD.country}
                <select value={supForm.country} onChange={e => setSupForm({ ...supForm, country: e.target.value })} className={inputCls}>{Object.entries(COUNTRY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              </label>
              <label className="text-xs text-gray-600">{FIELD.currency}
                <select value={supForm.currency} onChange={e => setSupForm({ ...supForm, currency: e.target.value })} className={inputCls}>{data?.currencies.map(c => <option key={c} value={c}>{c}</option>)}</select>
              </label>
            </div>
            {([['region', t('ag.s_region', 'Région ou ville'), t('ag.s_region_ph', 'Ex : Gabiley')], ['contact_name', t('ag.s_contact', 'Personne à contacter'), t('ag.s_contact_ph', 'Ex : nom du contact')], ['phone', t('bp.field_phone', 'Téléphone'), t('ag.s_phone_ph', 'Ex : numéro avec indicatif')], ['whatsapp', 'WhatsApp', t('ag.s_phone_ph', 'Ex : numéro avec indicatif')], ['payment_channel', t('ag.s_channel', 'Moyen de paiement du producteur'), t('ag.s_channel_ph', 'Ex : Zaad, Waafi, virement')]] as [keyof Supplier, string, string][]).map(([k, label, ph]) => (
              <label key={k} className="block text-xs text-gray-600">{label}
                <input value={(supForm[k] as string) || ''} onChange={e => setSupForm({ ...supForm, [k]: e.target.value })} placeholder={ph} className={inputCls} />
              </label>
            ))}
            <label className="block text-xs text-gray-600">{t('ag.s_notes', 'Notes internes')}
              <textarea rows={2} value={supForm.notes || ''} onChange={e => setSupForm({ ...supForm, notes: e.target.value })} className={inputCls + ' resize-none'} />
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={supForm.is_active !== false} onChange={e => setSupForm({ ...supForm, is_active: e.target.checked })} className="accent-[#a8c800]" /> {t('ag.s_active', 'Producteur actif')}</label>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setSupForm(null); setMsg(''); }} className="text-sm px-4 py-2 rounded-xl border border-gray-200 text-gray-600">{t('admin.cancel', 'Annuler')}</button>
              <button disabled={busy === 'sup'} onClick={async () => { if (await act({ action: 'save_supplier', ...supForm }, 'sup')) { setSupForm(null); setMsg(''); } }} className="text-sm font-semibold px-4 py-2 rounded-xl bg-[#a8c800] text-white hover:bg-[#7d9800] disabled:opacity-50">💾 {t('admin.save', 'Enregistrer')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Fenêtre : paiement au producteur ── */}
      {pay && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-3" onClick={() => setPay(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-[#2d6410]">💱 {t('ag.pay_add', 'Enregistrer un paiement')}</h3>
            <p className="text-xs text-gray-500">{t('ag.pay_hint', 'À enregistrer une fois le paiement réellement effectué. Le taux de change de ce paiement est conservé.')}</p>
            <select value={pay.kind} onChange={e => setPay({ ...pay, kind: e.target.value })} className={inputCls}>
              <option value="deposit">{t('ag.kind_deposit', 'Acompte')}</option><option value="balance">{t('ag.kind_balance', 'Solde')}</option><option value="other">{t('ag.kind_other', 'Autre')}</option>
            </select>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-gray-600">{t('ag.pay_amount', 'Montant')} ({pay.currency})
                <input type="number" inputMode="decimal" min={0} step="any" value={pay.amount_currency} onChange={e => setPay({ ...pay, amount_currency: e.target.value })} placeholder={t('ag.amount_ph', 'Ex : montant')} className={inputCls} />
              </label>
              <label className="text-xs text-gray-600">{FIELD.exchange_rate}
                <input type="number" inputMode="decimal" min={0} step="any" value={pay.exchange_rate} onChange={e => setPay({ ...pay, exchange_rate: e.target.value })} className={inputCls} />
              </label>
            </div>
            {Number(pay.amount_currency) > 0 && Number(pay.exchange_rate) > 0 && <p className="text-xs text-[#526500] font-semibold">= {fdj(Number(pay.amount_currency) * Number(pay.exchange_rate))}</p>}
            <input value={pay.method} onChange={e => setPay({ ...pay, method: e.target.value })} placeholder={t('ag.s_channel_ph', 'Ex : Zaad, Waafi, virement')} className="w-full border border-[#d2e095] rounded-xl px-3 py-2 text-sm" />
            <input value={pay.reference} onChange={e => setPay({ ...pay, reference: e.target.value })} placeholder={t('pay.ref_ph', 'Ex : référence du virement Waafi')} className="w-full border border-[#d2e095] rounded-xl px-3 py-2 text-sm" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setPay(null); setMsg(''); }} className="text-sm px-4 py-2 rounded-xl border border-gray-200 text-gray-600">{t('admin.cancel', 'Annuler')}</button>
              <button disabled={busy === 'pay'} onClick={async () => { if (await act({ action: 'pay_supplier', ...pay }, 'pay')) { setPay(null); setMsg(''); } }} className="text-sm font-semibold px-4 py-2 rounded-xl bg-[#a8c800] text-white hover:bg-[#7d9800] disabled:opacity-50">✅ {t('ag.receive', 'Enregistrer')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
