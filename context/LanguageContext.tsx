'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchUITranslations, fetchProductTranslations, fetchCategoryTranslations, fetchPromoTranslations, fetchDeliveryOptionTranslations } from '../lib/supabase';

// Langues proposées dans le sélecteur. L'afar (aa) est masqué tant que ses textes n'ont pas été relus
// par un locuteur natif (en base, la colonne « aa » contient surtout du somali) : les données restent
// intactes, il suffit de retirer `hidden` pour le réactiver.
const ALL_LANGUAGES = [
  { code: "fr", flag: "🇫🇷", label: "Français" },
  { code: "en", flag: "🇬🇧", label: "English" },
  { code: "zh", flag: "🇨🇳", label: "中文" },
  { code: "so", flag: "🇩🇯", label: "Soomaali" },
  { code: "aa", flag: "🇩🇯", label: "Qafar", hidden: true },
  { code: "am", flag: "🇪🇹", label: "አማርኛ" },
];
const LANGUAGES = ALL_LANGUAGES.filter(l => !(l as any).hidden);
const isAllowed = (code: string) => LANGUAGES.some(l => l.code === code);

interface LanguageContextType {
  currentLang: string;
  setCurrentLang: (lang: string) => void;
  ui: Record<string, string>;
  productTranslations: Record<number, { name: string; description: string }>;
  categoryTranslations: Record<number, string>;
  promoTranslations: Record<number, { badge: string; title: string; sub: string }>;
  deliveryOptionTranslations: Record<number, { name: string; description: string }>;
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
  deliveryOptionTranslations: {},
  languages: LANGUAGES,
  loading: false,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [currentLang, setCurrentLangState] = useState('fr');
  const [ui, setUi] = useState<Record<string, string>>({});
  const [productTranslations, setProductTranslations] = useState<Record<number, { name: string; description: string }>>({});
  const [categoryTranslations, setCategoryTranslations] = useState<Record<number, string>>({});
  const [promoTranslations, setPromoTranslations] = useState<Record<number, { badge: string; title: string; sub: string }>>({});
  const [deliveryOptionTranslations, setDeliveryOptionTranslations] = useState<Record<number, { name: string; description: string }>>({});
  const [loading, setLoading] = useState(false);

  const loadTranslations = async (lang: string) => {
    if (lang === 'fr') {
      setUi({});
      setProductTranslations({});
      setCategoryTranslations({});
      setPromoTranslations({});
      setDeliveryOptionTranslations({});
      return;
    }
    setLoading(true);
    try {
      const [uiData, prodData, catData, promoData, deliveryData] = await Promise.all([
        fetchUITranslations(lang),
        fetchProductTranslations(lang),
        fetchCategoryTranslations(lang),
        fetchPromoTranslations(lang),
        fetchDeliveryOptionTranslations(lang),
      ]);
      setUi(uiData);
      setProductTranslations(prodData);
      setCategoryTranslations(catData);
      setPromoTranslations(promoData);
      setDeliveryOptionTranslations(deliveryData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const setCurrentLang = (lang: string) => {
    if (!isAllowed(lang)) lang = 'fr';
    setCurrentLangState(lang);
    localStorage.setItem('lang', lang);
    loadTranslations(lang);
  };

  useEffect(() => {
    // Un choix mémorisé sur une langue masquée (ex. « aa ») retombe sur le français
    let saved = localStorage.getItem('lang') || 'fr';
    if (!isAllowed(saved)) { saved = 'fr'; localStorage.setItem('lang', 'fr'); }
    setCurrentLangState(saved);
    loadTranslations(saved);
  }, []);

  return (
    <LanguageContext.Provider value={{
      currentLang, setCurrentLang, ui,
      productTranslations, categoryTranslations, promoTranslations, deliveryOptionTranslations,
      languages: LANGUAGES, loading,
    }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);