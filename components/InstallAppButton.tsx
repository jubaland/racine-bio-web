'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';

// Bouton permanent « Installer l'application » (profil, pied de page) : déclenche l'installation
// native quand le navigateur la propose (événement capté par le script du layout dans window.__bip),
// sinon affiche les instructions iOS / Android. Masqué dans l'app déjà installée.

export function InstallHelpModal({ help, onClose }: { help: 'ios' | 'android'; onClose: () => void }) {
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;
  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl p-6 max-w-xs w-full text-center text-gray-800" onClick={e => e.stopPropagation()}>
        <p className="text-4xl mb-2">📲</p>
        <h3 className="font-bold text-lg mb-4">{t('install.howto_title', "Installer l'application")}</h3>
        {help === 'ios' ? (
          <ol className="text-sm text-gray-600 text-left space-y-3 mb-5">
            <li><span className="font-bold text-[#526500]">1.</span> {t('install.ios_step1', 'Appuyez sur le bouton Partager')} <span className="inline-block align-middle">⎋</span> {t('install.ios_step1b', '(en bas de Safari).')}</li>
            <li><span className="font-bold text-[#526500]">2.</span> {t('install.ios_step2', "Faites défiler et choisissez « Sur l'écran d'accueil ».")}</li>
            <li><span className="font-bold text-[#526500]">3.</span> {t('install.ios_step3', 'Appuyez sur « Ajouter ».')}</li>
          </ol>
        ) : (
          <p className="text-sm text-gray-600 mb-5">{t('install.android_help', 'Ouvrez le menu ⋮ du navigateur, puis « Installer l\'application ».')}</p>
        )}
        <button onClick={onClose} className="w-full bg-[#a8c800] text-white py-2.5 rounded-xl font-semibold hover:bg-[#7d9800] transition">
          {t('install.got_it', 'Compris')}
        </button>
      </div>
    </div>
  );
}

/** Déclenche l'installation native si possible ; sinon renvoie la plateforme pour les instructions. */
export async function triggerInstall(): Promise<'' | 'ios' | 'android'> {
  const deferred = (window as any).__bip;
  if (deferred) {
    deferred.prompt();
    try { await deferred.userChoice; } catch { /* ignore */ }
    (window as any).__bip = null;
    return '';
  }
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent) ? 'ios' : 'android';
}

export default function InstallAppButton({ variant = 'link' }: { variant?: 'link' | 'card' }) {
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;
  const [standalone, setStandalone] = useState(true);   // masqué tant qu'on ne sait pas (rendu serveur)
  const [help, setHelp] = useState<'' | 'ios' | 'android'>('');

  useEffect(() => {
    setStandalone(window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true);
  }, []);
  if (standalone) return null;   // déjà dans l'app installée

  const onClick = async () => setHelp(await triggerInstall());

  return (
    <>
      {variant === 'card' ? (
        <button onClick={onClick} className="w-full text-left bg-gradient-to-r from-[#ecf4d5] to-[#e8f5d0] rounded-3xl p-6 border border-[#d2e095] shadow-sm hover:border-[#a8c800] transition flex items-center justify-between gap-4">
          <span className="flex items-center gap-4">
            <span className="text-4xl">📲</span>
            <span>
              <span className="block font-semibold text-[#526500]">{t('install.howto_title', "Installer l'application")}</span>
              <span className="block text-sm text-gray-500">{t('install.sub', 'Accès rapide depuis votre écran d\'accueil.')}</span>
            </span>
          </span>
          <span className="bg-[#a8c800] text-white px-4 py-2 rounded-xl text-sm font-semibold">{t('install.cta_short', "Installer l'app")}</span>
        </button>
      ) : (
        <button onClick={onClick} className="text-sm text-[#7d9800] hover:underline">
          📲 {t('install.cta_short', "Installer l'app")}
        </button>
      )}
      {help && <InstallHelpModal help={help} onClose={() => setHelp('')} />}
    </>
  );
}
