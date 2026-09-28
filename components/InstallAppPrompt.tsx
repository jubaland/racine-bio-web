'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useLanguage } from '../context/LanguageContext';

// Invitation « Installer l'app » : déclenche l'installation native (Chrome/Android)
// ou affiche les instructions manuelles (iOS / quand la bannière native est en
// refroidissement). Se masque si l'app est déjà installée ou après fermeture.
// Discrète : petite pastille en bas à gauche (ne recouvre pas les boutons de la page), affichée
// après quelques secondes, jamais pendant une commande, une connexion ou dans les espaces de gestion.
const QUIET_PATHS = ['/checkout', '/login', '/reset-password', '/auth', '/admin', '/producer'];
const APPEAR_DELAY_MS = 8000;

export default function InstallAppPrompt() {
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;
  const pathname = usePathname() || '/';
  const quiet = QUIET_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));

  const [deferred, setDeferred] = useState<any>(null);
  const [show, setShow] = useState(false);
  const [help, setHelp] = useState<'' | 'ios' | 'android'>('');

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    if (standalone) return;                                   // déjà installée
    if (localStorage.getItem('hf_install_dismissed') === '1') return;

    // Bannière réservée au mobile (appareil tactile / petit écran)
    const isMobile =
      /android|iphone|ipad|ipod|mobile/i.test(window.navigator.userAgent) ||
      window.matchMedia('(max-width: 820px)').matches;
    if (!isMobile) return;

    // Événement éventuellement déjà capté tôt (script inline dans le layout)
    if ((window as any).__bip) setDeferred((window as any).__bip);

    const onBIP = (e: Event) => { e.preventDefault(); setDeferred(e); };
    const onInstalled = () => { setShow(false); localStorage.setItem('hf_install_dismissed', '1'); };
    window.addEventListener('beforeinstallprompt', onBIP);
    window.addEventListener('appinstalled', onInstalled);
    const timer = window.setTimeout(() => setShow(true), APPEAR_DELAY_MS); // laisser d'abord découvrir la page
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', onBIP);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!show || quiet) return null;

  const dismiss = () => { setShow(false); localStorage.setItem('hf_install_dismissed', '1'); };

  const install = async () => {
    if (deferred) {
      deferred.prompt();
      const { outcome } = await deferred.userChoice;
      setDeferred(null);
      if (outcome === 'accepted') setShow(false);
    } else {
      const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
      setHelp(isIOS ? 'ios' : 'android');
    }
  };

  return (
    <div className="fixed bottom-3 left-3 z-40 pointer-events-none">
      {/* Pastille compacte : seule sa surface capte les clics, le reste de la page reste utilisable */}
      <div className="pointer-events-auto inline-flex items-center gap-1 bg-[#1c3a05] text-white rounded-full shadow-lg border border-[#2d6410] pl-1.5 pr-1 py-1">
        <button onClick={install} title={t('install.sub', 'Accès rapide depuis votre écran d\'accueil.')} className="inline-flex items-center gap-2 rounded-full pr-2 hover:opacity-90 transition">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="" className="w-7 h-7 rounded-full flex-none" />
          <span className="text-xs font-semibold whitespace-nowrap">📲 {t('install.cta_short', "Installer l'app")}</span>
        </button>
        <button onClick={dismiss} aria-label={t('install.close', 'Fermer')} className="flex-none w-7 h-7 rounded-full text-white/60 hover:text-white hover:bg-white/10 text-sm leading-none">✕</button>
      </div>

      {/* Instructions d'installation (modal clair) */}
      {help && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={() => setHelp('')}>
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
            <button onClick={() => setHelp('')} className="w-full bg-[#a8c800] text-white py-2.5 rounded-xl font-semibold hover:bg-[#7d9800] transition">
              {t('install.got_it', 'Compris')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
