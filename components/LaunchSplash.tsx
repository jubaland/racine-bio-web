'use client';

import { useEffect, useState } from 'react';

// Écran de lancement PWA. Rendu dès le SSR et piloté par le CSS
// @media (display-mode: standalone) dans globals.css (.launch-splash) :
// - app installée -> visible dès le 1er pixel (pas de flash de l'accueil)
// - navigateur web -> display:none (invisible pour les visiteurs web)
// Le JS ne gère que le fondu de sortie + la langue du slogan.
const SLOGANS: Record<string, string> = {
  fr: 'La fraîcheur livrée à votre porte !',
  en: 'Freshness delivered to your door!',
  zh: '新鲜直送到您家门！',
  so: 'Cusboonaanta albaabkaaga la keenay!',
  aa: 'Haaromina balbala keetti dhihaate!',
  am: 'ትኩስነት ወደ በርዎ ይደርሳል!',
};

export default function LaunchSplash() {
  const [gone, setGone] = useState(false);
  const [fading, setFading] = useState(false);
  const [slogan, setSlogan] = useState(SLOGANS.fr);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    if (!standalone) { setGone(true); return; } // retiré pour le web (déjà masqué par CSS)

    setSlogan(SLOGANS[localStorage.getItem('lang') || 'fr'] ?? SLOGANS.fr);
    const t1 = setTimeout(() => setFading(true), 1300);
    const t2 = setTimeout(() => setGone(true), 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (gone) return null;

  return (
    <div className={`launch-splash${fading ? ' fade' : ''}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon-192.png" alt="Hornafresh" width={96} height={96}
           style={{ borderRadius: '1.5rem', boxShadow: '0 12px 32px rgba(0,0,0,.3)' }} />
      <p style={{ marginTop: '1.25rem', color: '#fff', fontWeight: 800, fontSize: '1.85rem', letterSpacing: '-0.02em' }}>Hornafresh</p>
      <p style={{ marginTop: '0.4rem', color: 'rgba(255,255,255,.9)', fontSize: '0.9rem', fontWeight: 500 }}>{slogan} 🌿</p>
    </div>
  );
}
