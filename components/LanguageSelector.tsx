'use client';

import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';

export default function LanguageSelector() {
  const { currentLang, setCurrentLang, languages } = useLanguage();
  const [showDropdown, setShowDropdown] = useState(false);
  const current = languages.find(l => l.code === currentLang) || languages[0];

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2 bg-white border border-[#dde8b0] rounded-full px-3 py-2 text-sm hover:border-[#a8c800] transition"
      >
        <span>{current.flag}</span>
        <span className="hidden md:block text-gray-600">{current.label}</span>
        <span className="text-gray-400 text-xs">▼</span>
      </button>

      {showDropdown && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDropdown(false)}
          />
          <div className="absolute right-0 top-12 bg-white border border-[#dde8b0] rounded-2xl shadow-lg z-50 overflow-hidden w-44">
            {languages.map(lang => (
              <button
                key={lang.code}
                onClick={() => { setCurrentLang(lang.code); setShowDropdown(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-[#f0f7e8] transition ${currentLang === lang.code ? 'bg-[#f0f7e8] text-[#526500] font-semibold' : 'text-gray-600'}`}
              >
                <span>{lang.flag}</span>
                <span>{lang.label}</span>
                {currentLang === lang.code && <span className="ml-auto text-[#a8c800]">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}