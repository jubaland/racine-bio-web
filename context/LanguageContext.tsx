'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchUITranslations, fetchProductTranslations, fetchCategoryTranslations, fetchPromoTranslations } from '../lib/supabase';

const LANGUAGES = [
  { code: "fr", flag: "🇫🇷", label: "Français" },
  { code: "en", flag: "🇬🇧", label: "English" },
  { code: "zh", flag: "🇨🇳", label: "中文" },
  { code: "so", flag: "🇩🇯", label: "Soomaali" },
  { code: "aa", flag: "🇩🇯", label: "Qafar" },
  { code: "am", flag: "🇪🇹", label: "አማርኛ" },
];

interface LanguageContextType {
  currentLang: string;
  setCurrentLang: (lang: string) => void;
  ui: Record<string, string>;
  productTranslations: Record<number, { name: string; description: string }>;
  categoryTranslations: Record<number, string>;
  promoTranslations: Record<number, { badge: string; title: string; sub: string }>;
  languages: typeof LANGUAGES;
  loading: boolean;
}

const LanguageContext = createContext<LanguageContextType>({
  currentLang: 'fr',
  setCurrentLang: () => {},
  ui: {},
  productTranslations: {},
  categoryTranslations: {},
  promoTranslations: {},
  languages: LANGUAGES,
  loading: false,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [currentLang, setCurrentLangState] = useState('fr');
  const [ui, setUi] = useState<Record<string, string>>({});
  const [productTranslations, setProductTranslations] = useState<Record<number, { name: string; description: string }>>({});
  const [categoryTranslations, setCategoryTranslations] = useState<Record<number, string>>({});
  const [promoTranslations, setPromoTranslations] = useState<Record<number, { badge: string; title: string; sub: string }>>({});
  const [loading, setLoading] = useState(false);

  const loadTranslations = async (lang: string) => {
    if (lang === 'fr') {
      setUi({});
      setProductTranslations({});
      setCategoryTranslations({});
      setPromoTranslations({});
      return;
    }
    setLoading(true);
    try {
      const [uiData, prodData, catData, promoData] = await Promise.all([
        fetchUITranslations(lang),
        fetchProductTranslations(lang),
        fetchCategoryTranslations(lang),
        fetchPromoTranslations(lang),
      ]);
      setUi(uiData);
      setProductTranslations(prodData);
      setCategoryTranslations(catData);
      setPromoTranslations(promoData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const setCurrentLang = (lang: string) => {
    setCurrentLangState(lang);
    localStorage.setItem('lang', lang);
    loadTranslations(lang);
  };

  useEffect(() => {
    const saved = localStorage.getItem('lang') || 'fr';
    setCurrentLangState(saved);
    loadTranslations(saved);
  }, []);

  return (
    <LanguageContext.Provider value={{
      currentLang, setCurrentLang, ui,
      productTranslations, categoryTranslations, promoTranslations,
      languages: LANGUAGES, loading,
    }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);