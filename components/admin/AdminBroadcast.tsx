'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { supabase } from '../../lib/supabase';
import { useCan } from '../../context/AdminPermsContext';

type Announcement = {
  id: number;
  title: string;
  body: string | null;
  url: string | null;
  active: boolean;
  created_at: string;
};

export default function AdminBroadcast() {
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;
  const { can } = useCan();
  const canSend = can('announcements', 'create');

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [history, setHistory] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  const authHeader = useCallback(async () => {
    const tk = (await supabase.auth.getSession()).data.session?.access_token;
    return { Authorization: `Bearer ${tk}`, 'Content-Type': 'application/json' };
  }, []);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/broadcast', { headers: await authHeader() });
      const json = await res.json();
      setHistory(json.announcements || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [authHeader]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const send = async () => {
    if (!title.trim() || busy) return;
    if (!confirm(t('admin.bc_confirm', 'Diffuser ce message à TOUS les clients (notification + bandeau) ?'))) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: await authHeader(),
        body: JSON.stringify({ title: title.trim(), body: body.trim() || null, url: url.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok) { setFeedback('❌ ' + (json.error || 'Erreur')); }
      else {
        setFeedback(`✅ ${t('admin.bc_sent', 'Diffusé !')} ${json.sent}/${json.total} ${t('admin.bc_devices', 'appareils notifiés')}.`);
        setTitle(''); setBody(''); setUrl('');
        fetchHistory();
      }
    } catch (e: any) {
      setFeedback('❌ ' + e.message);
    }
    setBusy(false);
  };

  const stopCurrent = async () => {
    if (!confirm(t('admin.bc_stop_confirm', 'Retirer le bandeau du site ?'))) return;
    try {
      await fetch('/api/admin/broadcast', { method: 'DELETE', headers: await authHeader() });
      fetchHistory();
    } catch { /* ignore */ }
  };

  const active = history.find(h => h.active);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-[#2d6410]">📣 {t('admin.bc_title', 'Diffuser une annonce')}</h2>
        <p className="text-sm text-gray-500 mt-1">
          {t('admin.bc_subtitle', 'Le message part en notification push (PWA) à tous les abonnés et s\'affiche en bandeau sur le site.')}
        </p>
      </div>

      {/* Formulaire */}
      <div className="bg-white rounded-2xl border-2 border-[#d2e095] shadow-sm p-5 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">{t('admin.bc_field_title', 'Titre')} *</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={120}
            disabled={!canSend}
            placeholder={t('admin.bc_ph_title', 'Ex : 🍊 Oranges Bio de Somalie — stock limité')}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#a8c800] focus:ring-1 focus:ring-[#a8c800] outline-none text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">{t('admin.bc_field_body', 'Message')}</label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            maxLength={300}
            rows={3}
            disabled={!canSend}
            placeholder={t('admin.bc_ph_body', 'Ex : Fraîches de Hargeisa, juteuses & parfumées. Profitez-en vite !')}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#a8c800] focus:ring-1 focus:ring-[#a8c800] outline-none text-sm resize-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">{t('admin.bc_field_url', 'Lien (optionnel)')}</label>
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            maxLength={300}
            disabled={!canSend}
            placeholder="/product/15"
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#a8c800] focus:ring-1 focus:ring-[#a8c800] outline-none text-sm"
          />
          <p className="text-[11px] text-gray-400 mt-1">{t('admin.bc_url_hint', 'Page ouverte au clic. Ex : /product/15 ou /promotions')}</p>
        </div>

        {feedback && (
          <div className="text-sm font-medium px-3 py-2 rounded-xl bg-[#f7fbe9] border border-[#e3eebf] text-gray-700">{feedback}</div>
        )}

        <button
          onClick={send}
          disabled={!canSend || !title.trim() || busy}
          className="w-full bg-[#a8c800] text-white font-bold py-3 rounded-xl hover:bg-[#7d9800] transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy ? t('admin.bc_sending', 'Diffusion…') : `📢 ${t('admin.bc_send', 'Diffuser à tous les clients')}`}
        </button>
        {!canSend && <p className="text-[11px] text-gray-400 text-center">{t('admin.bc_no_perm', 'Vous n\'avez pas le droit de diffuser.')}</p>}
      </div>

      {/* Bandeau actif */}
      {active && (
        <div className="mt-5 bg-[#fff8ef] border-2 border-[#f5c98a] rounded-2xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-[#ea6a00] uppercase tracking-wide mb-0.5">{t('admin.bc_active', 'Bandeau actif sur le site')}</p>
              <p className="font-semibold text-gray-800 truncate">{active.title}</p>
              {active.body && <p className="text-sm text-gray-500 truncate">{active.body}</p>}
            </div>
            {canSend && (
              <button onClick={stopCurrent} className="shrink-0 text-xs font-semibold text-red-500 border border-red-200 px-3 py-1.5 rounded-full hover:bg-red-50 transition">
                {t('admin.bc_stop', 'Retirer')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Historique */}
      <div className="mt-6">
        <h3 className="text-sm font-bold text-gray-600 mb-2">{t('admin.bc_history', 'Historique')}</h3>
        {loading ? (
          <p className="text-sm text-gray-400">…</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-gray-400">{t('admin.bc_empty', 'Aucune annonce diffusée pour le moment.')}</p>
        ) : (
          <div className="space-y-2">
            {history.map(h => (
              <div key={h.id} className="bg-white rounded-xl border border-gray-100 px-4 py-2.5 flex items-center gap-3">
                <span className="text-lg">{h.active ? '🟢' : '⚪'}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-800 truncate">{h.title}</p>
                  {h.body && <p className="text-xs text-gray-400 truncate">{h.body}</p>}
                </div>
                <span className="text-[11px] text-gray-400 shrink-0">{new Date(h.created_at).toLocaleDateString('fr-FR')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
