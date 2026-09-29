'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { supabase } from '../../lib/supabase';
import { useCan } from '../../context/AdminPermsContext';

// Admin › Surveillance : erreurs du site (serveur, tâches planifiées, navigateur des clients),
// regroupées par erreur identique, avec résolution et réglages des alertes.

type Err = { id: number; source: 'server' | 'cron' | 'client'; route: string | null; method: string | null; status: number | null; message: string; stack: string | null; context: Record<string, any> | null; count: number; first_seen: string; last_seen: string; resolved_at: string | null; user_id: string | null };
type Settings = { alert_enabled: boolean; alert_email: boolean; alert_client: boolean; client_enabled: boolean; alert_cooldown_min: number | null; retention_days: number | null };
type Data = { state: 'open' | 'resolved'; errors: Err[]; counts: { open: number; resolved: number; last_24h: number }; settings: Settings };

const when = (d: string) => new Date(d).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function AdminMonitoring() {
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;
  const { can } = useCan();
  const canEdit = can('monitoring', 'edit');

  const [tab, setTab] = useState<'open' | 'resolved' | 'settings'>('open');
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [msg, setMsg] = useState('');

  const token = async () => {
    let { data: { session } } = await supabase.auth.getSession();
    if (!session || (session.expires_at && session.expires_at * 1000 < Date.now() + 60000)) session = (await supabase.auth.refreshSession()).data.session;
    return session?.access_token;
  };
  const load = useCallback(async (state: 'open' | 'resolved') => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/monitoring?state=${state}`, { headers: { Authorization: `Bearer ${await token()}` } });
      const j = await res.json();
      if (res.ok) { setData(j); setForm({ ...j.settings, alert_cooldown_min: j.settings.alert_cooldown_min ?? '', retention_days: j.settings.retention_days ?? '' }); }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);
  useEffect(() => { load(tab === 'resolved' ? 'resolved' : 'open'); }, [tab, load]);

  const act = async (payload: any, key: string, confirmMsg?: string) => {
    if (confirmMsg && !confirm(confirmMsg)) return false;
    setBusy(key); setMsg('');
    try {
      const res = await fetch('/api/admin/monitoring', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` }, body: JSON.stringify(payload) });
      const j = await res.json();
      if (!res.ok) { setMsg('⚠️ ' + (j.error === 'already_open' ? t('mon.already_open', 'Cette erreur est déjà ouverte (elle est réapparue).') : (j.error || 'Erreur'))); return false; }
      await load(tab === 'resolved' ? 'resolved' : 'open');
      return j;
    } catch (e: any) { setMsg('⚠️ ' + e.message); return false; }
    finally { setBusy(null); }
  };

  const SOURCE: Record<Err['source'], { label: string; cls: string }> = {
    server: { label: `🖥️ ${t('mon.src_server', 'Serveur')}`, cls: 'bg-red-100 text-red-700' },
    cron:   { label: `⏰ ${t('mon.src_cron', 'Tâche planifiée')}`, cls: 'bg-amber-100 text-amber-800' },
    client: { label: `📱 ${t('mon.src_client', 'Navigateur client')}`, cls: 'bg-blue-100 text-blue-700' },
  };

  const Toggle = ({ k, label, hint }: { k: string; label: string; hint?: string }) => (
    <label className="flex items-start gap-2 text-sm text-gray-700">
      <input type="checkbox" disabled={!canEdit} checked={!!form[k]} onChange={e => setForm({ ...form, [k]: e.target.checked })} className="accent-[#a8c800] mt-1" />
      <span>{label}{hint ? <span className="block text-[11px] text-gray-400">{hint}</span> : null}</span>
    </label>
  );

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <h2 className="text-xl font-bold text-[#2d6410]">🚨 {t('admin.nav_monitoring', 'Surveillance')}</h2>
        <div className="flex flex-wrap gap-1.5 bg-white border border-[#d2e095] rounded-2xl sm:rounded-full p-1">
          {([['open', `🔴 ${t('mon.tab_open', 'À traiter')}${data ? ` (${data.counts.open})` : ''}`], ['resolved', `✅ ${t('mon.tab_resolved', 'Résolues')}${data ? ` (${data.counts.resolved})` : ''}`], ['settings', `⚙️ ${t('mon.tab_settings', 'Réglages')}`]] as [typeof tab, string][]).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${tab === id ? 'bg-[#526500] text-white' : 'text-[#526500] hover:bg-[#ecf4d5]'}`}>{label}</button>
          ))}
        </div>
      </div>
      {msg && <p className="text-sm text-gray-700 bg-[#f7fbe9] border border-[#e3eebf] rounded-xl px-3 py-2 mb-3">{msg}</p>}

      {loading || !data ? <p className="text-center text-gray-400 py-16">⏳</p> : tab === 'settings' ? (
        <div className="bg-white rounded-2xl border-2 border-[#d2e095] px-4 py-4 space-y-4 max-w-2xl">
          <p className="text-xs text-gray-500">{t('mon.settings_desc', 'Chaque erreur est enregistrée une fois, puis comptée. Vous êtes alerté à sa première apparition, puis au plus une fois par délai tant qu\'elle n\'est pas résolue.')}</p>
          <Toggle k="alert_enabled" label={t('mon.set_alert', 'M\'alerter (cloche et notification)')} />
          <Toggle k="alert_email" label={t('mon.set_email', 'M\'alerter aussi par e-mail')} />
          <Toggle k="client_enabled" label={t('mon.set_client', 'Enregistrer les erreurs du navigateur des clients')} hint={t('mon.set_client_hint', 'Message, page et taille d\'écran seulement. Aucune donnée personnelle.')} />
          <Toggle k="alert_client" label={t('mon.set_alert_client', 'M\'alerter aussi pour les erreurs du navigateur')} hint={t('mon.set_alert_client_hint', 'Elles sont plus nombreuses et souvent liées à l\'appareil du client.')} />
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-xs text-gray-600">{t('mon.set_cooldown', 'Délai entre deux alertes pour la même erreur (minutes)')}
              <input type="number" inputMode="numeric" min={1} step={1} disabled={!canEdit} value={form.alert_cooldown_min ?? ''} onChange={e => setForm({ ...form, alert_cooldown_min: e.target.value })} placeholder={t('mon.minutes_ph', 'Ex : nombre de minutes')} className="block w-full border border-[#d2e095] rounded-xl px-3 py-2 text-sm mt-1" />
              <span className="block text-[11px] text-gray-400 mt-1">{t('mon.set_cooldown_hint', 'Vide : une seule alerte par erreur.')}</span>
            </label>
            <label className="text-xs text-gray-600">{t('mon.set_retention', 'Conservation du journal (jours)')}
              <input type="number" inputMode="numeric" min={1} step={1} disabled={!canEdit} value={form.retention_days ?? ''} onChange={e => setForm({ ...form, retention_days: e.target.value })} placeholder={t('mer.duration_ph', 'Ex : nombre de jours')} className="block w-full border border-[#d2e095] rounded-xl px-3 py-2 text-sm mt-1" />
              <span className="block text-[11px] text-gray-400 mt-1">{t('mon.set_retention_hint', 'Vide : rien n\'est supprimé automatiquement.')}</span>
            </label>
          </div>
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <button disabled={busy === 'save'} onClick={async () => { if (await act({ action: 'save_settings', ...form }, 'save')) setMsg(`✅ ${t('mer.com_saved', 'Enregistré')}`); }} className="text-xs font-semibold bg-[#a8c800] text-white rounded-lg px-4 py-2 hover:bg-[#7d9800] disabled:opacity-50">💾 {t('admin.save', 'Enregistrer')}</button>
              <button disabled={busy === 'test'} onClick={async () => { const r = await act({ action: 'test' }, 'test'); if (r) { setMsg(`✅ ${t('mon.test_done', 'Erreur d\'essai enregistrée. Elle apparaît dans « À traiter ».')}${r.alert ? ` ${t('mon.test_alert', 'Une alerte vient de partir.')}` : ''}`); } }} className="text-xs font-semibold border border-[#d2e095] text-[#526500] rounded-lg px-4 py-2 hover:bg-[#ecf4d5] disabled:opacity-50">🧪 {t('mon.test', 'Envoyer une erreur d\'essai')}</button>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <p className="text-xs text-gray-500">{tab === 'open' ? `${data.counts.last_24h} ${t('mon.last_24h', 'erreur(s) vue(s) ces dernières 24 h')}` : t('mon.resolved_hint', 'Une erreur résolue qui réapparaît revient dans « À traiter ».')}</p>
            {canEdit && data.errors.length > 0 && (tab === 'open'
              ? <button disabled={busy === 'all'} onClick={() => act({ action: 'resolve_all' }, 'all', t('mon.resolve_all_confirm', 'Marquer toutes les erreurs comme résolues ?'))} className="text-xs font-semibold border border-[#d2e095] text-[#526500] rounded-lg px-3 py-1.5 hover:bg-[#ecf4d5] disabled:opacity-50">✅ {t('mon.resolve_all', 'Tout marquer résolu')}</button>
              : <button disabled={busy === 'del'} onClick={() => act({ action: 'delete_resolved' }, 'del', t('mon.delete_confirm', 'Supprimer définitivement les erreurs résolues ?'))} className="text-xs font-semibold border border-red-200 text-red-500 rounded-lg px-3 py-1.5 hover:bg-red-50 disabled:opacity-50">🗑️ {t('mon.delete_resolved', 'Vider les résolues')}</button>)}
          </div>
          {data.errors.length === 0 ? (
            <p className="text-sm text-gray-400 bg-white rounded-xl border border-[#e3eebf] px-4 py-8 text-center">{tab === 'open' ? `🌿 ${t('mon.none_open', 'Aucune erreur à traiter. Tout fonctionne.')}` : t('mon.none_resolved', 'Aucune erreur résolue.')}</p>
          ) : (
            <div className="space-y-2">
              {data.errors.map(e => (
                <div key={e.id} className="bg-white rounded-2xl border-2 border-[#d2e095] px-4 py-3">
                  <div className="flex flex-wrap items-start gap-3">
                    <button type="button" onClick={() => setOpenId(openId === e.id ? null : e.id)} className="flex-1 min-w-0 basis-full sm:basis-0 text-left">
                      <p className="text-sm font-semibold text-gray-800 break-words">{e.message}</p>
                      <p className="text-xs text-gray-500 mt-0.5 break-all">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full mr-1 ${SOURCE[e.source].cls}`}>{SOURCE[e.source].label}</span>
                        {e.method ? `${e.method} ` : ''}{e.route || '—'}{e.status ? ` · ${e.status}` : ''}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{e.count > 1 ? `${e.count} ${t('mon.times', 'fois')} · ` : ''}{t('mon.last', 'dernière')} {when(e.last_seen)}{e.count > 1 ? ` · ${t('mon.first', 'première')} ${when(e.first_seen)}` : ''} · {openId === e.id ? '▲' : '▼'} {t('mon.detail', 'détail')}</p>
                    </button>
                    {canEdit && (tab === 'open'
                      ? <button disabled={busy === 'r' + e.id} onClick={() => act({ action: 'resolve', id: e.id }, 'r' + e.id)} className="flex-none text-xs font-semibold bg-[#a8c800] text-white rounded-lg px-3 py-1.5 hover:bg-[#7d9800] disabled:opacity-50">✅ {t('mon.resolve', 'Résolu')}</button>
                      : <button disabled={busy === 'r' + e.id} onClick={() => act({ action: 'reopen', id: e.id }, 'r' + e.id)} className="flex-none text-xs font-semibold border border-[#d2e095] text-[#526500] rounded-lg px-3 py-1.5 hover:bg-[#ecf4d5] disabled:opacity-50">↩️ {t('mon.reopen', 'Rouvrir')}</button>)}
                  </div>
                  {openId === e.id && (
                    <div className="mt-3 space-y-2">
                      {e.context && <p className="text-xs text-gray-600 break-words">{Object.entries(e.context).map(([k, v]) => `${k} : ${v}`).join(' · ')}</p>}
                      {e.user_id && <p className="text-[11px] text-gray-400 break-all">{t('mon.user', 'Compte concerné')} : {e.user_id}</p>}
                      {e.stack ? <pre className="text-[11px] leading-snug text-gray-600 bg-[#faf7e8] rounded-xl p-3 overflow-x-auto max-h-64 whitespace-pre-wrap break-all">{e.stack}</pre> : <p className="text-[11px] text-gray-400">{t('mon.no_stack', 'Pas de détail technique.')}</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
