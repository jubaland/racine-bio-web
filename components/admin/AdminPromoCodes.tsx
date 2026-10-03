'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { supabase } from '../../lib/supabase';
import { inputClass, selectClass } from './Modal';

// Promotions → onglet « Codes promo » : codes « livraison offerte » (campagne, personnel, première
// commande…) et seuil automatique de livraison offerte. Tout est réglable ici, rien n'est en dur.

type Code = {
  id: number; code: string; label: string | null; active: boolean; starts_at: string | null; ends_at: string | null;
  min_subtotal: number | null; first_order_only: boolean; max_uses: number | null; max_uses_per_user: number | null;
  scope: 'standard' | 'all'; max_discount: number | null; user_id: string | null; user_email: string | null;
  uses: number; amount_offered: number;
};
type Rules = { free_threshold: number | null; threshold_scope: 'standard' | 'all' };
const EMPTY = { id: 0, code: '', label: '', scope: 'standard', max_discount: '', min_subtotal: '', starts_at: '', ends_at: '', max_uses: '', max_uses_per_user: '', first_order_only: false, user_email: '', active: true };

const fdj = (n: number) => `${Math.round(Number(n)).toLocaleString('fr-FR')} Fdj`;
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomCode = () => Array.from({ length: 8 }, () => CHARSET[Math.floor(Math.random() * CHARSET.length)]).join('');
// Date ISO ↔ champ « datetime-local » (heure de l'appareil)
const toInput = (iso: string | null) => { if (!iso) return ''; const d = new Date(iso); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const toIso = (v: string) => v ? new Date(v).toISOString() : '';

export default function AdminPromoCodes({ canCreate, canEdit, canDelete }: { canCreate: boolean; canEdit: boolean; canDelete: boolean }) {
  const { ui, currentLang } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;
  const [codes, setCodes] = useState<Code[] | null>(null);
  const [rules, setRules] = useState({ free_threshold: '', threshold_scope: 'standard' });
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [loadError, setLoadError] = useState('');

  const headers = async () => {
    let { data: { session } } = await supabase.auth.getSession();
    if (!session || (session.expires_at && session.expires_at * 1000 < Date.now() + 60000)) session = (await supabase.auth.refreshSession()).data.session;
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` };
  };
  const apply = (j: { codes: Code[]; rules: Rules }) => {
    setCodes(j.codes || []);
    setRules({ free_threshold: j.rules?.free_threshold != null ? String(j.rules.free_threshold) : '', threshold_scope: j.rules?.threshold_scope || 'standard' });
  };
  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/promo-codes', { headers: await headers() });
      const j = await res.json();
      if (res.ok) { apply(j); setLoadError(''); } else setLoadError(j.error || 'Erreur');
    } catch (e: any) { setLoadError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const ERR: Record<string, string> = {
    code_format: t('pc.e_format', 'Code : 3 à 20 lettres majuscules ou chiffres, sans espace.'),
    code_taken: t('pc.e_taken', 'Ce code existe déjà (code promo ou code parrainage).'),
    number_invalid: t('pc.e_number', 'Les montants et limites doivent être des nombres entiers positifs (ou vides).'),
    date_invalid: t('pc.e_date', 'Date invalide.'),
    date_order: t('pc.e_date_order', 'La date de fin doit être après la date de début.'),
    date_past: t('pc.e_date_past', 'La date de fin est déjà passée.'),
    user_not_found: t('pc.e_user', 'Aucun compte client avec cette adresse e-mail.'),
    code_used: t('pc.e_used', 'Ce code a déjà été utilisé : désactivez-le plutôt que de le supprimer.'),
    threshold_invalid: t('pc.e_threshold', 'Le seuil doit être un nombre entier positif (ou vide pour le désactiver).'),
  };
  const post = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true); setMsg('');
    try {
      const res = await fetch('/api/admin/promo-codes', { method: 'POST', headers: await headers(), body: JSON.stringify(body) });
      const j = await res.json();
      if (!res.ok) { setMsg('⚠️ ' + (ERR[j.error] || j.error || 'Erreur')); return false; }
      apply(j); setMsg('✅ ' + ok); return true;
    } catch (e: any) { setMsg('⚠️ ' + e.message); return false; } finally { setBusy(false); }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const ok = await post({ action: 'save', ...form, id: form.id || undefined, starts_at: toIso(form.starts_at), ends_at: toIso(form.ends_at) }, t('pc.saved', 'Code enregistré.'));
    if (ok) setForm(null);
  };
  const edit = (c: Code) => setForm({
    id: c.id, code: c.code, label: c.label || '', scope: c.scope, max_discount: c.max_discount != null ? String(c.max_discount) : '',
    min_subtotal: c.min_subtotal != null ? String(c.min_subtotal) : '', starts_at: toInput(c.starts_at), ends_at: toInput(c.ends_at),
    max_uses: c.max_uses != null ? String(c.max_uses) : '', max_uses_per_user: c.max_uses_per_user != null ? String(c.max_uses_per_user) : '',
    first_order_only: c.first_order_only, user_email: c.user_email || '', active: c.active,
  });
  const set = (k: string, v: unknown) => setForm(f => f ? { ...f, [k]: v } : f);

  const stateOf = (c: Code): [string, string] => {
    const now = Date.now();
    if (!c.active) return [t('pc.st_off', 'Désactivé'), 'bg-gray-100 text-gray-500'];
    if (c.ends_at && new Date(c.ends_at).getTime() < now) return [t('pc.st_expired', 'Expiré'), 'bg-gray-100 text-gray-500'];
    if (c.max_uses != null && c.uses >= c.max_uses) return [t('pc.st_exhausted', 'Épuisé'), 'bg-orange-100 text-orange-700'];
    if (c.starts_at && new Date(c.starts_at).getTime() > now) return [t('pc.st_upcoming', 'À venir'), 'bg-blue-100 text-blue-700'];
    return [t('pc.st_active', 'Actif'), 'bg-green-100 text-green-700'];
  };
  const dateFmt = (iso: string) => new Date(iso).toLocaleString(currentLang === 'fr' ? 'fr-FR' : currentLang, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const conditions = (c: Code) => [
    c.scope === 'all' ? t('pc.c_all', 'Toute option de livraison') : t('pc.c_standard', 'Montant de la livraison standard'),
    c.max_discount != null && `${t('pc.c_cap', 'plafond')} ${fdj(c.max_discount)}`,
    c.min_subtotal != null && `${t('pc.c_min', 'panier dès')} ${fdj(c.min_subtotal)}`,
    c.first_order_only && t('pc.c_first', '1re commande'),
    c.max_uses_per_user != null && `${c.max_uses_per_user} ${t('pc.c_per_user', 'par client')}`,
    c.user_email && `${t('pc.c_personal', 'réservé à')} ${c.user_email}`,
  ].filter(Boolean).join(' · ');

  const label = 'block text-xs font-semibold text-gray-600 mb-1';
  const hint = 'text-[11px] text-gray-400 mt-1';

  if (loadError) return <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 text-sm text-[#b45309]">⚠️ {t('pc.load_error', 'Chargement impossible')} : {loadError} <button onClick={load} className="underline ml-2">{t('admin.retry', 'Réessayer')}</button></div>;
  if (!codes) return <div className="flex items-center justify-center h-48"><p className="text-gray-400">{t('admin.loading', 'Chargement...')}</p></div>;

  return (
    <div className="space-y-5">
      {/* Seuil automatique : sans code, dès un montant d'articles */}
      <div className="bg-white rounded-2xl border border-[#d2e095] p-5">
        <h2 className="font-bold text-gray-800">🚚 {t('pc.th_title', 'Livraison offerte automatique')}</h2>
        <p className="text-xs text-gray-500 mt-1">{t('pc.th_desc', 'Sans code : la livraison est offerte dès que le montant des articles atteint le seuil. Le client voit ce qu\'il lui manque au moment de payer.')}</p>
        <div className="flex flex-wrap items-end gap-3 mt-3">
          <label className="text-xs font-semibold text-gray-600">{t('pc.th_amount', 'Seuil d\'achat (Fdj)')}
            <input type="number" inputMode="numeric" min={1} step={1} value={rules.free_threshold} disabled={!canEdit} onChange={e => setRules(r => ({ ...r, free_threshold: e.target.value }))}
              placeholder={t('pc.th_ph', 'Ex : montant en Fdj')} className={`${inputClass} mt-1 w-48 block`} />
          </label>
          <label className="text-xs font-semibold text-gray-600">{t('pc.f_scope', 'Montant offert')}
            <select value={rules.threshold_scope} disabled={!canEdit} onChange={e => setRules(r => ({ ...r, threshold_scope: e.target.value }))} className={`${selectClass} mt-1 block w-auto`}>
              <option value="standard">{t('pc.scope_standard', 'Le tarif de la livraison standard')}</option>
              <option value="all">{t('pc.scope_all', 'Le tarif de l\'option choisie, quelle qu\'elle soit')}</option>
            </select>
          </label>
          {canEdit && <button type="button" disabled={busy} onClick={() => post({ action: 'save_rules', ...rules }, t('pc.th_saved', 'Seuil enregistré.'))}
            className="text-sm font-semibold border border-[#d2e095] text-[#526500] rounded-xl px-4 py-2.5 hover:bg-[#ecf4d5] disabled:opacity-50">💾 {t('admin.save', 'Enregistrer')}</button>}
        </div>
        <p className={hint}>{t('pc.th_hint', 'Vide : pas de livraison offerte automatique. Les abonnements et commandes récurrentes gardent leur tarif convenu.')}</p>
      </div>

      {/* Codes */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-bold text-gray-800">🎟️ {t('pc.title', 'Codes « livraison offerte »')}</h2>
          <p className="text-xs text-gray-500 mt-1">{t('pc.desc', 'Le client saisit le code au paiement. Une seule remise par commande : pas de cumul avec le parrainage ni avec le seuil automatique.')}</p>
        </div>
        {canCreate && !form && <button onClick={() => { setForm({ ...EMPTY }); setMsg(''); }} className="bg-[#a8c800] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#7d9800] transition">+ {t('pc.new', 'Nouveau code')}</button>}
      </div>

      {form && (
        <form onSubmit={save} className="bg-white rounded-2xl border-2 border-[#d2e095] p-5 space-y-4">
          <h3 className="font-bold text-gray-800">{form.id ? t('pc.edit_title', 'Modifier le code') : t('pc.new', 'Nouveau code')}</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={label} htmlFor="pc-code">{t('pc.f_code', 'Code')} *</label>
              <div className="flex gap-2">
                <input id="pc-code" value={form.code} required maxLength={20} onChange={e => set('code', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  placeholder={t('pc.f_code_ph', 'Ex : RAMADAN26')} className={`${inputClass} tracking-widest uppercase`} />
                <button type="button" onClick={() => set('code', randomCode())} className="shrink-0 text-xs font-semibold border border-[#d2e095] text-[#526500] rounded-xl px-3 hover:bg-[#ecf4d5]">🎲 {t('pc.generate', 'Générer')}</button>
              </div>
              <p className={hint}>{t('pc.f_code_hint', 'Lettres et chiffres, sans espace. C\'est ce que le client saisit.')}</p>
            </div>
            <div>
              <label className={label} htmlFor="pc-label">{t('pc.f_label', 'Nom de la campagne (interne)')}</label>
              <input id="pc-label" value={form.label} maxLength={120} onChange={e => set('label', e.target.value)} placeholder={t('pc.f_label_ph', 'Ex : Relance clients inactifs')} className={inputClass} />
            </div>
            <div>
              <label className={label} htmlFor="pc-scope">{t('pc.f_scope', 'Montant offert')}</label>
              <select id="pc-scope" value={form.scope} onChange={e => set('scope', e.target.value)} className={selectClass}>
                <option value="standard">{t('pc.scope_standard', 'Le tarif de la livraison standard')}</option>
                <option value="all">{t('pc.scope_all', 'Le tarif de l\'option choisie, quelle qu\'elle soit')}</option>
              </select>
            </div>
            <div>
              <label className={label} htmlFor="pc-cap">{t('pc.f_cap', 'Plafond de la remise (Fdj)')}</label>
              <input id="pc-cap" type="number" inputMode="numeric" min={1} step={1} value={form.max_discount} onChange={e => set('max_discount', e.target.value)} placeholder={t('pc.f_empty_none', 'Ex : montant en Fdj (vide = aucun)')} className={inputClass} />
            </div>
            <div>
              <label className={label} htmlFor="pc-start">{t('pc.f_start', 'Valable à partir du')}</label>
              <input id="pc-start" type="datetime-local" value={form.starts_at} onChange={e => set('starts_at', e.target.value)} className={inputClass} />
              <p className={hint}>{t('pc.f_start_hint', 'Vide : valable tout de suite.')}</p>
            </div>
            <div>
              <label className={label} htmlFor="pc-end">{t('pc.f_end', 'Valable jusqu\'au')}</label>
              <input id="pc-end" type="datetime-local" value={form.ends_at} onChange={e => set('ends_at', e.target.value)} className={inputClass} />
              <p className={hint}>{t('pc.f_end_hint', 'Vide : sans date de fin.')}</p>
            </div>
            <div>
              <label className={label} htmlFor="pc-min">{t('pc.f_min', 'Panier minimum (Fdj d\'articles)')}</label>
              <input id="pc-min" type="number" inputMode="numeric" min={1} step={1} value={form.min_subtotal} onChange={e => set('min_subtotal', e.target.value)} placeholder={t('pc.f_empty_none', 'Ex : montant en Fdj (vide = aucun)')} className={inputClass} />
            </div>
            <div>
              <label className={label} htmlFor="pc-max">{t('pc.f_max', 'Nombre total d\'utilisations')}</label>
              <input id="pc-max" type="number" inputMode="numeric" min={1} step={1} value={form.max_uses} onChange={e => set('max_uses', e.target.value)} placeholder={t('pc.f_empty_unlimited', 'Ex : nombre (vide = illimité)')} className={inputClass} />
            </div>
            <div>
              <label className={label} htmlFor="pc-per">{t('pc.f_per_user', 'Utilisations par client')}</label>
              <input id="pc-per" type="number" inputMode="numeric" min={1} step={1} value={form.max_uses_per_user} onChange={e => set('max_uses_per_user', e.target.value)} placeholder={t('pc.f_empty_unlimited', 'Ex : nombre (vide = illimité)')} className={inputClass} />
            </div>
            <div>
              <label className={label} htmlFor="pc-user">{t('pc.f_user', 'Réservé à un client (e-mail du compte)')}</label>
              <input id="pc-user" type="email" value={form.user_email} onChange={e => set('user_email', e.target.value)} placeholder={t('pc.f_user_ph', 'Ex : client@exemple.com')} className={inputClass} />
              <p className={hint}>{t('pc.f_user_hint', 'Vide : tous les clients.')}</p>
            </div>
          </div>
          <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={form.first_order_only} onChange={e => set('first_order_only', e.target.checked)} className="accent-[#a8c800] mt-0.5" />
            <span>{t('pc.f_first', 'Réservé à une première commande')}<span className="block text-[11px] text-gray-400">{t('pc.f_first_hint', 'Vérifié sur le compte, ou sur le numéro de téléphone pour un client sans compte.')}</span></span>
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="bg-[#a8c800] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#7d9800] transition disabled:opacity-50">{busy ? '⏳' : t('admin.save', 'Enregistrer')}</button>
            <button type="button" onClick={() => setForm(null)} className="px-5 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50">{t('admin.cancel', 'Annuler')}</button>
          </div>
        </form>
      )}

      {codes.length === 0 && !form ? (
        <div className="bg-white rounded-2xl p-10 text-center border border-[#d2e095]">
          <p className="text-4xl mb-3 opacity-20">🎟️</p>
          <p className="text-gray-400 text-sm">{t('pc.empty', 'Aucun code promo pour le moment.')}</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {codes.map(c => {
            const [st, cls] = stateOf(c);
            return (
              <div key={c.id} className="bg-white rounded-2xl border border-[#d2e095] p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-[#526500] tracking-widest break-all">{c.code}</span>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${cls}`}>{st}</span>
                    </p>
                    {c.label && <p className="text-sm text-gray-700 mt-0.5">{c.label}</p>}
                    <p className="text-xs text-gray-500 mt-1">{conditions(c)}</p>
                    {(c.starts_at || c.ends_at) && <p className="text-xs text-gray-400 mt-0.5">📅 {c.starts_at ? dateFmt(c.starts_at) : '…'} → {c.ends_at ? dateFmt(c.ends_at) : '…'}</p>}
                  </div>
                  <div className="text-right text-xs text-gray-600 shrink-0">
                    <p><span className="font-bold text-gray-800">{c.uses}</span>{c.max_uses != null ? ` / ${c.max_uses}` : ''} {t('pc.uses', 'utilisation(s)')}</p>
                    <p>{fdj(c.amount_offered)} {t('pc.offered', 'offerts')}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {canEdit && <button disabled={busy} onClick={() => { edit(c); setMsg(''); }} className="text-xs font-semibold border border-[#d2e095] text-[#526500] rounded-lg px-3 py-1.5 hover:bg-[#ecf4d5]">✏️ {t('admin.edit', 'Modifier')}</button>}
                  {canEdit && <button disabled={busy} onClick={() => post({ action: 'toggle', id: c.id, active: !c.active }, c.active ? t('pc.disabled', 'Code désactivé.') : t('pc.enabled', 'Code réactivé.'))} className="text-xs font-semibold border border-gray-200 text-gray-600 rounded-lg px-3 py-1.5 hover:bg-gray-50">{c.active ? `⏸ ${t('pc.disable', 'Désactiver')}` : `▶️ ${t('pc.enable', 'Réactiver')}`}</button>}
                  {canDelete && c.uses === 0 && <button disabled={busy} onClick={() => { if (confirm(t('pc.delete_confirm', 'Supprimer ce code ?'))) post({ action: 'delete', id: c.id }, t('pc.deleted', 'Code supprimé.')); }} className="text-xs font-semibold border border-orange-200 text-[#f97316] rounded-lg px-3 py-1.5 hover:bg-orange-50">🗑 {t('admin.delete', 'Supprimer')}</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Message toujours visible, où que l'on soit dans la page */}
      {msg && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-[92vw] bg-white border-2 border-[#d2e095] shadow-lg rounded-xl px-4 py-2.5 text-sm font-medium text-gray-700 flex items-center gap-3">
          <span>{msg}</span>
          <button onClick={() => setMsg('')} aria-label={t('admin.close', 'Fermer')} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
      )}
    </div>
  );
}
