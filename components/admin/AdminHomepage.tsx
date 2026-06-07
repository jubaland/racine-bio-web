'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../context/LanguageContext';

export default function AdminHomepage() {
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;

  // Blocs masquables de la page d'accueil (def = visibilité par défaut)
  const BLOCKS: { key: string; emoji: string; label: string; desc: string; def: boolean }[] = [
    { key: 'home.promos',       emoji: '🏷️', label: t('admin.home_promos', 'Promotions'),            desc: t('admin.home_promos_d', 'Bandeau des promotions actives.'), def: true },
    { key: 'home.featured',     emoji: '⭐', label: t('admin.home_featured', 'Sélection du moment'),  desc: t('admin.home_featured_d', 'Produits mis en avant par l\'équipe.'), def: true },
    { key: 'home.local',        emoji: '🇩🇯', label: t('admin.home_local', 'Produits de Djibouti'),   desc: t('admin.home_local_d', 'Carrousel des produits locaux.'), def: true },
    { key: 'home.producers',    emoji: '👨‍🌾', label: t('admin.home_producers', 'Nos producteurs'),    desc: t('admin.home_producers_d', 'Liste / avis des producteurs.'), def: false },
    { key: 'home.producer_cta', emoji: '🌱', label: t('admin.home_producer_cta', 'Espace producteur'), desc: t('admin.home_producer_cta_d', 'Bannière « Vous êtes producteur ? ».'), def: true },
    { key: 'home.how',          emoji: '🔢', label: t('admin.home_how', 'Comment ça marche'),         desc: t('admin.home_how_d', 'Les 3 étapes de commande.'), def: true },
    { key: 'home.stats',        emoji: '📊', label: t('admin.home_stats', 'Statistiques'),            desc: t('admin.home_stats_d', 'Bandeau chiffres (produits, producteurs…).'), def: true },
    { key: 'home.apps',         emoji: '📱', label: t('admin.home_apps', 'Applications mobiles'),     desc: t('admin.home_apps_d', 'Bannière Android / iOS.'), def: true },
  ];

  const [settings, setSettings] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/site-settings');
      const json = await res.json();
      setSettings(json.settings || {});
    } catch { /* ignore */ }
    setLoading(false);
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const toggle = async (key: string, def: boolean) => {
    const current = settings[key] ?? def;
    const next = !current;
    setBusy(key);
    setSettings(prev => ({ ...prev, [key]: next })); // optimiste
    const res = await fetch('/api/admin/site-settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value: next }),
    });
    if (!res.ok) setSettings(prev => ({ ...prev, [key]: current })); // rollback
    setBusy(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">🏠 {t('admin.nav_homepage', 'Page d\'accueil')}</h1>
      </div>
      <p className="text-sm text-gray-500 mb-5">
        {t('admin.home_hint', 'Affichez ou masquez les blocs de la page d\'accueil. Utile par exemple pour cacher un bloc encore trop peu rempli.')}
      </p>

      {loading ? (
        <div className="flex items-center justify-center h-48"><p className="text-gray-400">{t('admin.loading', 'Chargement...')}</p></div>
      ) : (
        <div className="space-y-3">
          {BLOCKS.map(b => {
            const visible = settings[b.key] ?? b.def;
            return (
              <div key={b.key} className="bg-white rounded-2xl border border-[#d2e095] p-4 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-[#ecf4d5] flex items-center justify-center text-2xl flex-none">{b.emoji}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800">{b.label}</p>
                  <p className="text-xs text-gray-400">{b.desc}</p>
                </div>
                <button
                  onClick={() => toggle(b.key, b.def)}
                  disabled={busy === b.key}
                  role="switch"
                  aria-checked={visible}
                  className={`relative w-12 h-7 rounded-full transition-colors flex-none disabled:opacity-60 ${visible ? 'bg-[#a8c800]' : 'bg-gray-200'}`}
                >
                  <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${visible ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
