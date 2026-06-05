'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';

// Bannière « Installer l'app » : déclenche l'installation native (Chrome/Android)
// ou affiche les instructions manuelles (iOS / quand la bannière native est en
// refroidissement). Se masque si l'app est déjà installée ou après fermeture.
export default function InstallAppPrompt() {
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;

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
    setShow(true);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBIP);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!show) return null;

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
    <div className="fixed bottom-3 left-3 right-3 z-50 max-w-md mx-auto">
      <div className="bg-[#1c3a05] text-white rounded-2xl shadow-2xl border border-[#2d6410] px-4 py-3">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="" className="w-10 h-10 rounded-xl flex-none" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{t('install.title', "Installez l'app Hornafresh")}</p>
            <p className="text-xs text-white/70">{t('install.sub', 'Accès rapide depuis votre écran d\'accueil.')}</p>
          </div>
          <button
            onClick={install}
            className="flex-none bg-[#a8c800] text-[#1c3a05] text-sm font-bold px-4 py-2 rounded-xl hover:bg-[#c8e050] transition"
          >
            📲 {t('install.cta', 'Installer')}
          </button>
          <button onClick={dismiss} aria-label={t('install.close', 'Fermer')} className="flex-none text-white/50 hover:text-white text-lg leading-none">✕</button>
        </div>
        {help && (
          <p className="text-xs text-[#c8e050] mt-2 leading-relaxed">
            {help === 'ios'
              ? t('install.ios_help', "Appuyez sur le bouton Partager ⬆️ de Safari, puis « Sur l'écran d'accueil ».")
              : t('install.android_help', 'Ouvrez le menu ⋮ du navigateur, puis « Installer l\'application ».')}
          </p>
        )}
      </div>
    </div>
  );
}
