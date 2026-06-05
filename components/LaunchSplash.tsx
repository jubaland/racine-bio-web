'use client';

import { useEffect, useState } from 'react';

// Écran de lancement de la PWA : logo + slogan sur fond chaud, au démarrage
// de l'app installée (mode standalone). Ne s'affiche pas pour les visiteurs web.
const SLOGANS: Record<string, string> = {
  fr: 'Du champ à votre porte',
  en: 'From farm to your door',
  zh: '从农场到您家门',
  so: 'Beerta ilaa albaabkaaga',
  aa: 'Oobdii irraa balbala keetti',
  am: 'ከእርሻ እስከ በርዎ',
};

export default function LaunchSplash() {
  const [show, setShow] = useState(false);
  const [fading, setFading] = useState(false);
  const [lang, setLang] = useState('fr');

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    if (!standalone) return;
    if (sessionStorage.getItem('hf_splash_shown')) return;
    sessionStorage.setItem('hf_splash_shown', '1');

    setLang(localStorage.getItem('lang') || 'fr');
    setShow(true);
    const t1 = setTimeout(() => setFading(true), 1300);
    const t2 = setTimeout(() => setShow(false), 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (!show) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-500 ${fading ? 'opacity-0' : 'opacity-100'}`}
      style={{ backgroundColor: '#c2410c' }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon-192.png" alt="Hornafresh" className="w-24 h-24 rounded-[1.5rem] shadow-2xl" />
      <p className="mt-5 text-white font-extrabold text-3xl tracking-tight">Hornafresh</p>
      <p className="mt-1.5 text-white/90 text-sm font-medium">{SLOGANS[lang] ?? SLOGANS.fr} 🌿</p>
    </div>
  );
}
