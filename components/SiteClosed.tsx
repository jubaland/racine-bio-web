'use client';

import { useLanguage } from '../context/LanguageContext';
import LanguageSelector from './LanguageSelector';

export default function SiteClosed() {
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1c3a05] via-[#2d6410] to-[#7a5800] text-white flex flex-col">
      <div className="flex justify-end p-4">
        <LanguageSelector />
      </div>

      <div className="flex-1 flex items-center justify-center px-5 pb-16">
        <div className="max-w-md w-full text-center">
          <p className="text-6xl mb-4">🌿</p>
          <h1 className="text-2xl font-bold tracking-wide mb-1">Hornafresh</h1>
          <p className="text-[#c8e050] text-sm mb-8">{t('closed.tag', 'Le marché bio de Djibouti')}</p>

          <div className="bg-white/10 backdrop-blur-sm rounded-3xl border border-white/15 px-6 py-8">
            <p className="text-5xl mb-4">☀️</p>
            <h2 className="text-2xl sm:text-3xl font-extrabold leading-tight mb-3">
              {t('closed.title', 'On se retrouve en septembre !')}
            </h2>
            <p className="text-white/80 text-sm leading-relaxed">
              {t('closed.message', 'Notre boutique fait une pause estivale. Merci pour votre confiance — nous revenons en septembre avec de nouveaux produits frais, bio et locaux.')}
            </p>
            <p className="text-[#c8e050] text-sm font-semibold mt-5">{t('closed.signature', "À très bientôt — l'équipe Hornafresh")}</p>
          </div>

          <p className="text-white/50 text-xs mt-6">© Hornafresh — Djibouti</p>
        </div>
      </div>
    </div>
  );
}
