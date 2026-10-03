'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../context/LanguageContext';
import { useCan } from '../../context/AdminPermsContext';

// Admin › Fidélité : réglages de la carte à tampons (activation, nombre de commandes, montant de la
// récompense versée sur la cagnotte, commande minimale) + indicateurs et dernières récompenses.

type Data = {
  settings: { enabled: boolean; orders_required: number; reward_amount: number; min_order: number };
  cards_in_progress: number; stamps_open: number; near_reward: number; rewards_count: number; rewards_total: number;
  rewards: { id: number; customer: string; amount: number; stamps_used: number; created_at: string }[];
  cards: { user_id: string; customer: string; phone: string | null; stamps: number; remaining: number; last_stamp: string }[];
};
const fdj = (n: number) => `${Math.round(Number(n)).toLocaleString('fr-FR')} Fdj`;
const inputCls = 'w-full border border-[#d2e095] rounded-xl px-4 py-2.5 text-sm bg-[#faf7e8] focus:outline-none focus:border-[#a8c800]';

export default function AdminLoyalty() {
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;
  const { can } = useCan();
  const canEdit = can('loyalty', 'edit');
  const [data, setData] = useState<Data | null>(null);
  const [form, setForm] = useState({ enabled: true, orders_required: '', reward_amount: '', min_order: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const tokenOf = async () => {
    let { data: { session } } = await supabase.auth.getSession();
    if (!session || (session.expires_at && session.expires_at * 1000 < Date.now() + 60000)) session = (await supabase.auth.refreshSession()).data.session;
    return session?.access_token;
  };
  const load = useCallback(async () => {
    const res = await fetch('/api/admin/loyalty', { headers: { Authorization: `Bearer ${await tokenOf()}` } });
    const j = await res.json();
    if (!res.ok) { setMsg({ ok: false, text: j.error || 'Erreur' }); return; }
    setData(j);
    setForm({ enabled: j.settings.enabled, orders_required: String(j.settings.orders_required), reward_amount: String(j.settings.reward_amount), min_order: String(j.settings.min_order) });
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (patch: any) => {
    setBusy(true); setMsg(null);
    const res = await fetch('/api/admin/loyalty', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await tokenOf()}` }, body: JSON.stringify(patch) });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) { setMsg({ ok: false, text: t('loy.a_invalid', 'Valeur invalide : vérifiez les trois champs.') }); return; }
    setMsg({ ok: true, text: t('loy.a_saved', 'Réglages enregistrés. Ils s\'appliquent aux prochaines commandes livrées.') });
    await load();
    return j;
  };

  // Relance d'un client : notification « plus que N commandes avant la récompense »
  const remind = async (userId: string) => {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch('/api/admin/loyalty', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await tokenOf()}` }, body: JSON.stringify({ action: 'remind', user_id: userId }) });
      setMsg(res.ok ? { ok: true, text: t('loy.c_reminded', 'Relance envoyée.') } : { ok: false, text: 'Erreur' });
    } catch (e: any) { setMsg({ ok: false, text: e.message }); } finally { setBusy(false); }
  };

  if (!data) return <div className="flex items-center justify-center h-48"><p className="text-gray-400">{msg?.text || t('admin.loading', 'Chargement...')}</p></div>;

  const n = Number(form.orders_required) || 0, reward = Number(form.reward_amount) || 0, min = Number(form.min_order) || 0;
  // Coût du programme rapporté aux achats : récompense / (N commandes × commande minimale)
  const costPct = n > 0 && min > 0 ? Math.round((reward / (n * min)) * 1000) / 10 : null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">🎁 {t('admin.nav_loyalty', 'Fidélité')}</h1>
        <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${data.settings.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{data.settings.enabled ? `● ${t('loy.a_on', 'Programme actif')}` : `○ ${t('loy.a_off', 'Programme en pause')}`}</span>
      </div>
      {msg && <div className={`text-sm px-4 py-3 rounded-xl mb-4 ${msg.ok ? 'bg-green-50 text-[#526500] border border-green-200' : 'bg-orange-50 text-[#f97316]'}`}>{msg.ok ? '✅' : '⚠️'} {msg.text}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[['🎫', data.cards_in_progress, t('loy.k_cards', 'carte(s) en cours')], ['⭐', data.near_reward, t('loy.k_near', 'à 2 commandes ou moins de la récompense')], ['🎁', data.rewards_count, t('loy.k_rewards', 'récompense(s) versée(s)')], ['💰', fdj(data.rewards_total), t('loy.k_cost', 'coût total du programme')]].map(([e, v, l]) => (
          <div key={String(l)} className="bg-white rounded-2xl border border-[#d2e095] p-4"><p className="text-xl">{e}</p><p className="text-lg font-bold text-[#526500] mt-1">{v}</p><p className="text-xs text-gray-400">{l}</p></div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-[#d2e095] p-5 md:p-6 mb-6">
        <h2 className="font-semibold text-gray-800 mb-1">⚙️ {t('loy.a_settings', 'Réglages de la carte')}</h2>
        <p className="text-xs text-gray-400 mb-4">{t('loy.a_hint', 'Chaque commande livrée d\'un particulier pose un tampon (un par jour au maximum). Quand la carte est pleine, la récompense est créditée automatiquement sur la cagnotte du client et une nouvelle carte commence. Les comptes entreprise ne participent pas.')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="text-sm text-gray-600">{t('loy.a_orders', 'Commandes pour une récompense')} *
            <input type="number" min="1" max="100" disabled={!canEdit} value={form.orders_required} onChange={e => setForm({ ...form, orders_required: e.target.value })} className={inputCls + ' mt-1'} placeholder="Ex : 10" />
          </label>
          <label className="text-sm text-gray-600">{t('loy.a_reward', 'Récompense versée sur la cagnotte (Fdj)')} *
            <input type="number" min="0" disabled={!canEdit} value={form.reward_amount} onChange={e => setForm({ ...form, reward_amount: e.target.value })} className={inputCls + ' mt-1'} placeholder="Ex : 1000" />
          </label>
          <label className="text-sm text-gray-600">{t('loy.a_min', 'Commande minimale, hors livraison (Fdj)')}
            <input type="number" min="0" disabled={!canEdit} value={form.min_order} onChange={e => setForm({ ...form, min_order: e.target.value })} className={inputCls + ' mt-1'} placeholder="Ex : 1000" />
          </label>
        </div>
        <p className="text-xs text-gray-500 mt-3 bg-[#faf7e8] rounded-xl px-3 py-2">
          💡 {t('loy.a_preview', 'Avec ces réglages')} : {n} {t('loy.a_preview2', 'commandes livrées')} → <strong className="text-[#526500]">{fdj(reward)}</strong>{costPct != null ? <> · {t('loy.a_cost', 'soit au plus')} <strong>{costPct} %</strong> {t('loy.a_cost2', 'des achats du client')}</> : null}
        </p>
        {canEdit && (
          <div className="flex flex-wrap gap-2 mt-4">
            <button disabled={busy} onClick={() => save({ orders_required: form.orders_required, reward_amount: form.reward_amount, min_order: form.min_order })} className="px-5 py-2.5 bg-[#a8c800] text-white rounded-xl text-sm font-semibold hover:bg-[#7d9800] disabled:opacity-50">{t('producer.wa_save', 'Enregistrer')}</button>
            <button disabled={busy} onClick={() => save({ enabled: !data.settings.enabled })} className={`px-5 py-2.5 rounded-xl text-sm font-semibold border disabled:opacity-50 ${data.settings.enabled ? 'border-orange-200 text-[#f97316] hover:bg-orange-50' : 'border-[#d2e095] text-[#526500] hover:bg-[#ecf4d5]'}`}>
              {data.settings.enabled ? `⏸️ ${t('loy.a_pause', 'Mettre en pause')}` : `▶️ ${t('loy.a_resume', 'Réactiver')}`}
            </button>
          </div>
        )}
        <p className="text-[11px] text-gray-400 mt-3">{t('loy.a_pause_hint', 'En pause : plus aucun tampon n\'est posé et la carte disparaît du profil. Les tampons déjà gagnés sont conservés.')}</p>
      </div>

      {/* Cartes en cours : qui a des tampons, les plus proches de la récompense d'abord */}
      <div className="bg-white rounded-2xl border border-[#d2e095] p-5 md:p-6 mb-6">
        <h2 className="font-semibold text-gray-800 mb-1">🎫 {t('loy.c_title', 'Cartes en cours')}</h2>
        <p className="text-xs text-gray-400 mb-3">{t('loy.c_hint', 'Les clients les plus proches de la récompense sont en tête : ce sont ceux à relancer. « Relancer » envoie une notification « plus que N commandes avant la récompense ».')}</p>
        {(data.cards || []).length === 0 ? <p className="text-sm text-gray-400">{t('loy.c_none', 'Aucune carte en cours.')}</p> : (
          <div className="space-y-2">{data.cards.map(c => (
            <div key={c.user_id} className="flex flex-wrap items-center justify-between gap-2 bg-[#faf7e8] rounded-xl px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{c.customer}{c.phone ? <span className="text-xs font-normal text-gray-400"> · {c.phone}</span> : null}</p>
                <p className="text-xs text-gray-400">{t('loy.c_last', 'Dernier tampon')} : {new Date(c.last_stamp + 'T00:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' })}</p>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="text-right">
                  <p className="text-sm tracking-widest text-[#526500]" aria-label={`${c.stamps}/${data.settings.orders_required}`}>{'●'.repeat(Math.min(c.stamps, 12))}<span className="text-gray-300">{'○'.repeat(Math.max(0, Math.min(12, data.settings.orders_required) - Math.min(c.stamps, 12)))}</span> <span className="font-bold">{c.stamps}/{data.settings.orders_required}</span></p>
                  <p className={`text-xs ${c.remaining <= 2 ? 'text-[#f97316] font-semibold' : 'text-gray-500'}`}>{c.remaining <= 1 ? t('loy.c_one_left', 'Plus qu\'une commande') : `${c.remaining} ${t('loy.c_left', 'commandes restantes')}`}</p>
                </div>
                {canEdit && <button disabled={busy} onClick={() => remind(c.user_id)} className="text-xs font-semibold border border-[#d2e095] text-[#526500] rounded-lg px-3 py-1.5 hover:bg-[#ecf4d5] disabled:opacity-50">🔔 {t('loy.c_remind', 'Relancer')}</button>}
              </div>
            </div>
          ))}</div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-[#d2e095] p-5 md:p-6">
        <h2 className="font-semibold text-gray-800 mb-3">🗂️ {t('loy.a_history', 'Dernières récompenses')}</h2>
        {data.rewards.length === 0 ? <p className="text-sm text-gray-400">{t('loy.a_none', 'Aucune récompense versée pour le moment.')}</p> : (
          <div className="space-y-2">{data.rewards.map(r => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 bg-[#faf7e8] rounded-xl px-4 py-3">
              <div className="min-w-0"><p className="text-sm font-semibold text-gray-800 truncate">{r.customer}</p><p className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })} · {r.stamps_used} {t('loy.a_orders_short', 'commandes')}</p></div>
              <p className="font-bold text-[#526500]">+{fdj(r.amount)}</p>
            </div>
          ))}</div>
        )}
      </div>
    </div>
  );
}
