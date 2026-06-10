'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLanguage } from '../context/LanguageContext';
import { useCart } from '../context/CartContext';
import { useFavorites } from '../context/FavoritesContext';
import Header from './Header';
import CartDrawer from './CartDrawer';

// Lit le rôle directement depuis le jeton stocké (synchrone, sans appel réseau)
function localRole(): string | null {
  try {
    const key = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
    if (!key) return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const token = parsed?.access_token || parsed?.currentSession?.access_token || (Array.isArray(parsed) ? parsed[0] : null);
    if (!token || typeof token !== 'string') return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    const meta = payload?.user_metadata || {};
    return meta.role || (meta.is_admin ? 'admin' : 'client');
  } catch { return null; }
}

const ORIGIN_FLAGS: Record<string, string> = {
  DJ: '🇩🇯', ET: '🇪🇹', SO: '🇸🇴', YE: '🇾🇪', FR: '🇫🇷',
};

const TYPE_FILTERS = [
  { id: 'all',           labelKey: 'filter.all',  label: 'Tout',          emoji: '🌿' },
  { id: 'bio',           labelKey: 'filter.bio',  label: 'Bio',           emoji: '🌿' },
  { id: 'conventionnel', labelKey: 'filter.conv', label: 'Conventionnel', emoji: '🥕' },
];

export default function HomePage({ products, categories, promos, producers, settings = {} }: {
  products: any[];
  categories: any[];
  promos: any[];
  producers: any[];
  settings?: Record<string, boolean>;
}) {
  // Visibilité des blocs (réglable dans le panneau admin → Page d'accueil).
  // Par défaut visible, sauf "producers" (avis producteurs) masqué par défaut.
  const show = (key: string, def = true) => settings[key] ?? def;
  const SHOW_PRODUCERS = show('home.producers', false);
  const { ui, productTranslations, categoryTranslations, promoTranslations, currentLang } = useLanguage();
  const { addItem, count, total } = useCart();
  const { isFavorite, addFavorite, removeFavorite } = useFavorites();
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeType, setActiveType] = useState('all');
  const [activeOrigin, setActiveOrigin] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [promoOnly, setPromoOnly] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  // Un gestionnaire connecté est dirigé vers le panneau d'admin, sauf s'il a
  // explicitement choisi de voir le site (carte « Page d'accueil » → flag).
  // Décision synchrone (lecture du jeton local) pour éviter le flash de l'accueil.
  useEffect(() => {
    if (sessionStorage.getItem('hf_view_site') === '1') { sessionStorage.removeItem('hf_view_site'); return; }
    if (localRole() === 'manager') {
      setRedirecting(true);
      window.location.replace('/admin');
    }
  }, []);

  useEffect(() => {
    // Capturer le code parrainage depuis l'URL (?ref=XXXXXX)
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      localStorage.setItem('hf_ref_code', ref.toUpperCase());
      const url = new URL(window.location.href);
      url.searchParams.delete('ref');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  const t = (key: string, fallback: string) => ui[key] || fallback;

  const getProductName = (product: any) => {
    if (currentLang !== 'fr' && productTranslations[product.id]?.name) {
      return productTranslations[product.id].name;
    }
    return product.name;
  };

  const getCategoryLabel = (cat: any) => {
    if (currentLang !== 'fr' && categoryTranslations[cat.id]) {
      return categoryTranslations[cat.id];
    }
    return cat.label;
  };

  const getPromoData = (promo: any) => {
    if (currentLang !== 'fr' && promoTranslations[promo.id]) {
      return promoTranslations[promo.id];
    }
    return { badge: promo.badge, title: promo.title, sub: promo.sub };
  };

  const getAvailableOrigins = () => {
    const seen: Record<string, boolean> = {};
    const result = [{ id: 'all', label: t('allCountries', 'Tous pays'), flag: '🌍' }];
    products.forEach(p => {
      const code = p.origin_country;
      if (code && !seen[code] && ORIGIN_FLAGS[code]) {
        seen[code] = true;
        result.push({ id: code, flag: ORIGIN_FLAGS[code], label: t(`origin.${code}`, code) });
      }
    });
    return result;
  };

  const promoCategories = new Set(
    promos.filter((p: any) => p.active !== false && p.category).map((p: any) => p.category)
  );

  const filteredProducts = products.filter(p => {
    const catMatch = activeCategory === 'all' || p.category === activeCategory;
    const typeMatch = activeType === 'all' || p.product_type === activeType;
    const originMatch = activeOrigin === 'all' || p.origin_country === activeOrigin;
    const searchMatch = searchQuery === '' ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.farm && p.farm.toLowerCase().includes(searchQuery.toLowerCase()));
    const promoMatch = !promoOnly || promoCategories.has(p.category);
    return catMatch && typeMatch && originMatch && searchMatch && promoMatch;
  });

  const localProducts = products.filter(p => p.is_local);
  const featuredProducts = products.filter(p => p.is_featured);

  // Gestionnaire en cours de redirection vers /admin : on n'affiche pas la boutique
  if (redirecting) {
    return (
      <div className="min-h-screen bg-[#faf7e8] flex items-center justify-center">
        <p className="text-5xl animate-pulse">🌿</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf7e8]">

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />

      <Header onCartOpen={() => setCartOpen(true)} />

      {/* Bannière commande en cours */}
      {count > 0 && (
        <Link href="/checkout" className="block bg-[#526500] text-white hover:bg-[#3f4f00] transition">
          <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-center gap-3 text-sm font-medium flex-wrap">
            <span>
              🛒 {t('cart.resume_text', 'Vous avez une commande en cours')}
              {' — '}
              {count} {count > 1 ? t('cart.items', 'articles') : t('cart.item', 'article')} · {total.toLocaleString()} Fdj
            </span>
            <span className="shrink-0 bg-white text-[#526500] text-xs font-semibold px-4 py-1.5 rounded-full">
              {t('cart.resume_cta', 'Reprendre →')}
            </span>
          </div>
        </Link>
      )}

      {/* Hero */}
      <section className="bg-gradient-to-br from-[#1c3a05] via-[#2d6410] to-[#7a5800] text-white py-3 px-4 md:px-6">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-6 md:gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-3 py-1 text-xs mb-3">
              🇩🇯 {t('heroTag', 'Produits frais de Djibouti et de la région')}
            </div>
            <h2 className="text-xl md:text-3xl font-bold mb-2 leading-tight">
              {t('tagline', 'Trouvez vos')} <span className="italic text-[#f5d020]">{t('tagline2', 'légumes')}</span> {t('tagline3', 'et fruits du jour')}
            </h2>
            <p className="text-sm text-white/75 mb-4 hidden md:block">
              {t('heroSub', 'Fruits et légumes frais, sélectionnés pour leur qualité par nos équipes — locaux en priorité, bio quand c\'est possible. Livrés où vous voulez, quand vous voulez.')}
            </p>
            <div className="flex gap-2 md:gap-4 flex-wrap">
              <a
                href="#produits"
                className="bg-white text-[#526500] px-4 py-2 rounded-full font-semibold hover:bg-[#faf7e8] transition text-sm"
              >
                🛒 {t('orderNow', 'Commander maintenant')}
              </a>
            </div>
          </div>
          <div className="hidden md:flex flex-col gap-3">
            <div className="bg-white/10 backdrop-blur rounded-xl px-5 py-3 border border-white/15 flex items-center gap-6">
              <p className="text-xs font-bold text-[#c8e050] uppercase tracking-widest whitespace-nowrap">{t('hero.delivery_info', 'Infos pratiques')}</p>
              {[
                { emoji: '🚚', desc: t('hero.delivery_zone_desc', 'Djibouti-Ville et environs') },
                { emoji: '⏱', desc: t('hero.delivery_delay_desc', 'À l\'heure qui vous convient') },
              ].map(item => (
                <div key={item.desc} className="flex items-center gap-1.5">
                  <span className="text-base">{item.emoji}</span>
                  <p className="text-xs text-white/75">{item.desc}</p>
                </div>
              ))}
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl px-5 py-2.5 border border-white/15 flex items-center gap-4">
              <p className="text-xs font-bold text-[#c8e050] uppercase tracking-widest whitespace-nowrap">{t('hero.payment_title', 'Paiement accepté')}</p>
              <div className="flex flex-wrap gap-2">
                {['📱 Waafi', '💳 D-Money', '💵 Espèces'].map(m => (
                  <span key={m} className="bg-white/15 text-white text-xs px-2.5 py-1 rounded-full">{m}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Promotions */}
      {show('home.promos') && promos.filter((p: any) => p.active !== false).length > 0 && (
        <section className="max-w-7xl mx-auto px-4 md:px-6 pt-6 md:pt-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">🔥 {t('promosTitle', 'Promotions du moment')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {promos.filter((p: any) => p.active !== false).map((p: any) => {
              const d = getPromoData(p);
              const color = p.color_start || '#a8c800';
              const go = () => {
                if (p.category) setActiveCategory(p.category);
                document.getElementById('produits')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              };
              return (
                <button
                  key={p.id}
                  onClick={go}
                  className="text-left rounded-2xl border border-[#d2e095] p-4 flex items-center gap-4 hover:shadow-md transition"
                  style={{ background: `linear-gradient(135deg, ${color}18, ${color}33)` }}
                >
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl flex-shrink-0 bg-white/60">
                    {p.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    {d.badge && (
                      <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded-full mb-1" style={{ background: color + '33', color }}>{d.badge}</span>
                    )}
                    <p className="font-semibold text-gray-800 truncate">{d.title}</p>
                    {d.sub && <p className="text-sm text-gray-500 truncate">{d.sub}</p>}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Sélection du moment */}
      {show('home.featured') && featuredProducts.length > 0 && (
        <section id="selection" className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-semibold text-gray-800">⭐ {t('featuredTitle', 'Sélection du moment')}</h2>
              <p className="text-sm text-gray-400 mt-0.5">{t('featuredSub', 'Produits choisis par notre équipe — anti-gaspi & bons plans')}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {featuredProducts.map((p: any) => {
              const isBio = p.product_type === 'bio';
              const flag = ORIGIN_FLAGS[p.origin_country] || '🌍';
              return (
                <Link key={p.id} href={`/product/${p.id}`} onClick={(p.stock_qty ?? 0) <= 0 ? (e) => e.preventDefault() : undefined}
                  className={`bg-white rounded-2xl overflow-hidden border border-[#d2e095] transition group ${(p.stock_qty ?? 0) <= 0 ? 'cursor-default opacity-75' : 'hover:shadow-lg'}`}>
                  <div className="relative h-32 sm:h-40 bg-[#ecf4d5]">
                    {p.image_url ? (
                      <img src={p.image_url} alt={getProductName(p)} className={`w-full h-full object-cover transition duration-300 ${(p.stock_qty ?? 0) <= 0 ? 'opacity-50' : 'group-hover:scale-105'}`} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-5xl opacity-20">📷</div>
                    )}
                    {(p.stock_qty ?? 0) <= 0 && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <span className="bg-white text-gray-700 text-xs font-semibold px-3 py-1 rounded-full shadow">Rupture de stock</span>
                      </div>
                    )}
                    {(p.stock_qty ?? 0) > 0 && (p.stock_qty ?? 0) <= 5 && (
                      <div title={`${t('product.stock_low_prefix', 'Stock limité : il ne reste que')} ${p.stock_qty} ${p.unit?.replace(/^\//, '')} ${t('product.stock_low_suffix', 'disponibles !')}`} className="absolute bottom-2 left-2 bg-amber-900/80 text-amber-100 text-xs px-2.5 py-0.5 rounded-full backdrop-blur-sm cursor-help">
                        ⚠️ Plus que {p.stock_qty} {p.unit?.replace(/^\//, '')}
                      </div>
                    )}
                    {isBio && (
                      <div className="absolute top-2 left-2 text-xs font-bold px-2 py-1 rounded-md bg-[#edf5a0] text-[#526500]">
                        🌿 {t('product.type_bio', 'Bio')}
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    {p.featured_badge && (
                      <span className="inline-block text-[11px] leading-tight font-semibold text-white bg-[#526500] px-2 py-1 rounded-md mb-1.5">
                        {t(`product.featured_badge.${p.id}`, p.featured_badge)}
                      </span>
                    )}
                    <h3 className="text-sm font-semibold text-gray-800 truncate">{getProductName(p)}</h3>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-gray-400">{t('product.origin_label', 'Origine')}</p>
                      <span className="text-base flex-none ml-1">{flag}</span>
                    </div>
                    {p.origin_country === 'DJ' && p.farm && (
                      <p className="text-xs text-gray-400 truncate mt-0.5">🌱 {p.farm}</p>
                    )}
                    <div className="flex items-center justify-between mt-3">
                      <div>
                        {p.old_price && (
                          <p className="text-xs text-red-400 line-through">{Number(p.old_price).toLocaleString()} Fdj</p>
                        )}
                        <p className="text-sm font-bold text-[#7d9800]">{Number(p.price).toLocaleString()} Fdj <span className="text-xs font-normal text-gray-400">{p.unit}</span></p>
                      </div>
                      <button
                        disabled={(p.stock_qty ?? 0) <= 0}
                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); addItem(p); setCartOpen(true); }}
                        className="w-8 h-8 bg-[#a8c800] rounded-full flex items-center justify-center text-white text-lg font-bold hover:bg-[#7d9800] transition disabled:opacity-30 disabled:cursor-not-allowed"
                      >+</button>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Produits locaux */}
      {show('home.local') && localProducts.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-gray-800">🇩🇯 {t('localProducts', 'Produits de Djibouti')}</h2>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory">
            {localProducts.map((p: any) => {
              const isBio = p.product_type === 'bio';
              const flag = ORIGIN_FLAGS[p.origin_country] || '🌍';
              return (
                <Link key={p.id} href={`/product/${p.id}`} onClick={(p.stock_qty ?? 0) <= 0 ? (e) => e.preventDefault() : undefined}
                  className={`flex-none w-44 sm:w-48 snap-center bg-white rounded-2xl overflow-hidden border border-[#d2e095] transition group ${(p.stock_qty ?? 0) <= 0 ? 'cursor-default opacity-75' : 'hover:shadow-md'}`}>
                  <div className="relative h-36 bg-[#ecf4d5]">
                    {p.image_url ? (
                      <img src={p.image_url} alt={getProductName(p)} className={`w-full h-full object-cover transition duration-300 ${(p.stock_qty ?? 0) <= 0 ? 'opacity-50' : 'group-hover:scale-105'}`} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl opacity-30">📷</div>
                    )}
                    {(p.stock_qty ?? 0) <= 0 && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <span className="bg-white text-gray-700 text-xs font-semibold px-2 py-1 rounded-full shadow">Rupture</span>
                      </div>
                    )}
                    {(p.stock_qty ?? 0) > 0 && (p.stock_qty ?? 0) <= 5 && (
                      <div title={`${t('product.stock_low_prefix', 'Stock limité : il ne reste que')} ${p.stock_qty} ${p.unit?.replace(/^\//, '')} ${t('product.stock_low_suffix', 'disponibles !')}`} className="absolute bottom-2 left-2 bg-amber-900/80 text-amber-100 text-[10px] px-1.5 py-0.5 rounded-full backdrop-blur-sm cursor-help">
                        ⚠️ {p.stock_qty} {p.unit?.replace(/^\//, '')}
                      </div>
                    )}
                    {isBio && (
                      <div className="absolute top-2 left-2 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#edf5a0] text-[#526500]">
                        🌿 {t('product.type_bio', 'Bio')}
                      </div>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); isFavorite(p.id) ? removeFavorite(p.id) : addFavorite(p); }}
                      className="absolute top-2 right-2 w-7 h-7 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow hover:scale-110 transition-all"
                    >
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill={isFavorite(p.id) ? '#f97316' : 'none'} stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                      </svg>
                    </button>
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium text-gray-800 truncate">{getProductName(p)}</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-gray-400">{t('product.origin_label', 'Origine')}</p>
                      <span className="text-base flex-none ml-1">{flag}</span>
                    </div>
                    {p.origin_country === 'DJ' && p.farm && (
                      <p className="text-xs text-gray-400 truncate mt-0.5">🌱 {p.farm}</p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <div>
                        {(p.old_price || p.oldPrice) && (
                          <p className="text-xs text-red-400 line-through">{Number(p.old_price || p.oldPrice).toLocaleString()} Fdj</p>
                        )}
                        <p className="text-sm font-bold text-[#7d9800]">{Number(p.price).toLocaleString()} Fdj <span className="text-xs font-normal text-gray-400">{p.unit}</span></p>
                      </div>
                      <button
                        disabled={(p.stock_qty ?? 0) <= 0}
                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); addItem(p); setCartOpen(true); }}
                        className="w-7 h-7 bg-[#a8c800] rounded-full flex items-center justify-center text-white font-bold hover:bg-[#7d9800] transition disabled:opacity-30 disabled:cursor-not-allowed"
                      >+</button>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Tous les produits */}
      <section id="produits" className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-gray-800">🥗 {t('allProducts', 'Tous les produits')}</h2>
          <span className="text-sm text-gray-400">{filteredProducts.length} {t('products', 'produits')}</span>
        </div>

        {/* Recherche */}
        <div className="relative mb-4">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">🔍</span>
          <input
            type="text"
            placeholder={t('search', 'Rechercher...')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            className="w-full pl-10 pr-10 py-3 bg-white border border-[#d2e095] rounded-xl text-sm text-gray-800 focus:outline-none focus:border-[#a8c800]"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setShowSuggestions(false); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg"
            >✕</button>
          )}
          {showSuggestions && searchQuery.trim().length >= 1 && (() => {
            const sugg = products.filter(p =>
              p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              (p.farm && p.farm.toLowerCase().includes(searchQuery.toLowerCase()))
            ).slice(0, 6);
            return sugg.length > 0 ? (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#d2e095] rounded-xl shadow-xl z-30 overflow-hidden">
                {sugg.map((p: any) => (
                  <button
                    key={p.id}
                    onMouseDown={() => { setSearchQuery(getProductName(p)); setShowSuggestions(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#faf7e8] transition border-b border-gray-50 last:border-0"
                  >
                    <div className="w-9 h-9 rounded-lg overflow-hidden flex-none bg-[#ecf4d5] flex items-center justify-center">
                      {p.image_url
                        ? <img src={p.image_url} alt={getProductName(p)} className="w-full h-full object-cover" />
                        : <span className="text-lg">{p.emoji || '🥬'}</span>
                      }
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{getProductName(p)}</p>
                      {p.origin_country === 'DJ' && p.farm && <p className="text-xs text-gray-400 truncate">🌱 {p.farm}</p>}
                    </div>
                    <span className="text-xs text-[#a8c800] font-semibold flex-none">{Number(p.price).toLocaleString()} Fdj</span>
                  </button>
                ))}
              </div>
            ) : null;
          })()}
        </div>


        {/* Filtres */}
        <div className="flex flex-wrap gap-3 mb-6">
          <select
            value={activeCategory}
            onChange={e => setActiveCategory(e.target.value)}
            className="flex-1 min-w-[140px] bg-white border border-[#d2e095] rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-[#a8c800] cursor-pointer"
          >
            <option value="all">🌿 {t('filter.all_categories', 'Toutes les catégories')}</option>
            {categories.filter((cat: any) => (cat.slug || cat.id) !== 'all').map((cat: any) => (
              <option key={cat.id} value={cat.slug || cat.id}>{cat.emoji} {getCategoryLabel(cat)}</option>
            ))}
          </select>

          <select
            value={activeType}
            onChange={e => setActiveType(e.target.value)}
            className="flex-1 min-w-[130px] bg-white border border-[#d2e095] rounded-xl px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:border-[#a8c800] cursor-pointer"
          >
            {TYPE_FILTERS.map(tf => (
              <option key={tf.id} value={tf.id}>{tf.emoji} {t(tf.labelKey, tf.label)}</option>
            ))}
          </select>

          <select
            value={activeOrigin}
            onChange={e => setActiveOrigin(e.target.value)}
            className="flex-1 min-w-[130px] bg-white border border-[#d2e095] rounded-xl px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:border-[#a8c800] cursor-pointer"
          >
            {getAvailableOrigins().map(of => (
              <option key={of.id} value={of.id}>{of.flag} {of.label}</option>
            ))}
          </select>

          {(activeCategory !== 'all' || activeType !== 'all' || activeOrigin !== 'all' || searchQuery || promoOnly) && (
            <button
              onClick={() => { setActiveType('all'); setActiveOrigin('all'); setActiveCategory('all'); setSearchQuery(''); setPromoOnly(false); }}
              className="px-4 py-2.5 text-sm text-red-400 hover:text-red-600 border border-red-200 rounded-xl bg-white hover:bg-red-50 transition"
            >
              ✕ {t('home.reset_filters', 'Réinitialiser')}
            </button>
          )}
        </div>

        {/* Grille produits */}
        {filteredProducts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-5xl mb-4 opacity-30">🌿</p>
            <p className="text-gray-400">{t('home.no_products', 'Aucun produit trouvé')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredProducts.map((product: any) => {
              const origin = { flag: ORIGIN_FLAGS[product.origin_country] || '🌍', label: t(`origin.${product.origin_country}`, product.origin_country) };
              const isBio = product.product_type === 'bio';
              return (
                <Link key={product.id} href={`/product/${product.id}`} onClick={(product.stock_qty ?? 0) <= 0 ? (e) => e.preventDefault() : undefined} className={`bg-white rounded-2xl overflow-hidden border border-[#d2e095] transition group ${(product.stock_qty ?? 0) <= 0 ? 'cursor-default opacity-75' : 'hover:shadow-lg'}`}>
                  <div className="relative h-36 sm:h-44 bg-[#ecf4d5]">
                    {product.image_url ? (
                      <img src={product.image_url} alt={getProductName(product)} className={`w-full h-full object-cover transition duration-300 ${(product.stock_qty ?? 0) <= 0 ? 'opacity-50' : 'group-hover:scale-105'}`} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-5xl opacity-20">📷</div>
                    )}
                    {(product.stock_qty ?? 0) <= 0 && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <span className="bg-white text-gray-700 text-xs font-semibold px-3 py-1 rounded-full shadow">Rupture de stock</span>
                      </div>
                    )}
                    {(product.stock_qty ?? 0) > 0 && (product.stock_qty ?? 0) <= 5 && (
                      <div title={`${t('product.stock_low_prefix', 'Stock limité : il ne reste que')} ${product.stock_qty} ${product.unit?.replace(/^\//, '')} ${t('product.stock_low_suffix', 'disponibles !')}`} className="absolute bottom-2 left-2 bg-amber-900/80 text-amber-100 text-xs px-2.5 py-0.5 rounded-full backdrop-blur-sm cursor-help">
                        ⚠️ Plus que {product.stock_qty} {product.unit?.replace(/^\//, '')}
                      </div>
                    )}
                    {isBio && (
                      <div className="absolute top-2 left-2 text-xs font-bold px-2 py-1 rounded-md bg-[#edf5a0] text-[#526500]">
                        🌿 {t('product.type_bio', 'Bio')}
                      </div>
                    )}
                    {/* Bouton favori sur l'image */}
                    <button
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); isFavorite(product.id) ? removeFavorite(product.id) : addFavorite(product); }}
                      className="absolute top-2 right-2 w-8 h-8 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow hover:scale-110 transition-all"
                      title={isFavorite(product.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                    >
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill={isFavorite(product.id) ? '#f97316' : 'none'} stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                      </svg>
                    </button>
                  </div>
                  <div className="p-3">
                    <h3 className="text-sm font-semibold text-gray-800 truncate">{getProductName(product)}</h3>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-gray-400">{t('product.origin_label', 'Origine')}</p>
                      <span className="text-base flex-none ml-1">{origin.flag}</span>
                    </div>
                    {product.origin_country === 'DJ' && product.farm && (
                      <p className="text-xs text-gray-400 truncate mt-0.5">🌱 {product.farm}</p>
                    )}
                    <div className="flex items-center justify-between mt-3">
                      <div>
                        {(product.old_price || product.oldPrice) && (
                          <p className="text-xs text-red-400 line-through">{Number(product.old_price || product.oldPrice).toLocaleString()} Fdj</p>
                        )}
                        <p className="text-sm font-bold text-[#7d9800]">{Number(product.price).toLocaleString()} Fdj <span className="text-xs font-normal text-gray-400">{product.unit}</span></p>
                      </div>
                      <button
                        disabled={(product.stock_qty ?? 0) <= 0}
                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); addItem(product); setCartOpen(true); }}
                        className="w-8 h-8 bg-[#a8c800] rounded-full flex items-center justify-center text-white text-lg font-bold hover:bg-[#7d9800] transition disabled:opacity-30 disabled:cursor-not-allowed"
                      >+</button>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Producteurs */}
      {SHOW_PRODUCERS && producers.length > 0 && (
        <section id="producteurs" className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-12">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">👨‍🌾 {t('ourProducers', 'Nos producteurs')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {producers.map((p: any) => (
              <div key={p.id} className="bg-white rounded-2xl p-6 text-center border border-[#d2e095] hover:shadow-md transition">
                <div className="text-4xl mb-3">{p.emoji}</div>
                <h3 className="font-semibold text-gray-800 text-sm">{p.name}</h3>
                <p className="text-xs text-gray-400 mt-1">{p.region}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Espace producteur */}
      {show('home.producer_cta') && (
      <section className="bg-gradient-to-br from-[#1c3a05] via-[#2d6410] to-[#7a5800] py-12 md:py-16 px-4 md:px-6 text-white">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
            <div>
              <span className="inline-block bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full mb-4">
                👨‍🌾 {t('producerSpaceTag', 'Espace Producteur')}
              </span>
              <h2 className="text-2xl md:text-3xl font-bold mb-4 leading-tight">
                {t('producerSpaceTitle', 'Vous êtes producteur ?')}<br />
                <span className="text-[#c8e050]">{t('producerSpaceTitle2', 'Rejoignez notre réseau')}</span>
              </h2>
              <p className="text-white/75 text-base mb-6 leading-relaxed">
                {t('producerSpaceDesc', 'Hornafresh vous accompagne au-delà de la vente : semences, conseil agronomique, matériel mutualisé et une communauté de producteurs engagés.')}
              </p>
              <Link
                href="/become-producer"
                className="inline-block bg-[#c8e050] text-[#1c3a05] px-7 py-3.5 rounded-full font-bold hover:bg-[#d4f060] transition"
              >
                {t('producerSpaceCta', 'Découvrir les avantages')} →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { emoji: '🌱', title: t('ps.seeds', 'Semences bio'), desc: t('ps.seeds_desc', 'Accès à des semences certifiées à tarif préférentiel') },
                { emoji: '🎓', title: t('ps.advice', 'Conseil agronomique'), desc: t('ps.advice_desc', 'Experts disponibles pour vous accompagner') },
                { emoji: '🚜', title: t('ps.equipment', 'Matériel partagé'), desc: t('ps.equipment_desc', 'Location et prêt entre producteurs partenaires') },
                { emoji: '💬', title: t('ps.community', 'Communauté'), desc: t('ps.community_desc', 'Échanges, entraide et retours d\'expérience') },
              ].map(b => (
                <div key={b.title} className="bg-white/10 backdrop-blur rounded-2xl p-4 hover:bg-white/15 transition">
                  <span className="text-2xl">{b.emoji}</span>
                  <p className="text-sm font-semibold mt-2 mb-1">{b.title}</p>
                  <p className="text-xs text-white/60">{b.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      )}

      {/* Comment ça marche */}
      {show('home.how') && (
      <section className="bg-white border-t border-[#d2e095] py-12 md:py-16 px-4 md:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-gray-800">{t('howItWorksTitle', 'Comment ça marche ?')}</h2>
            <p className="text-gray-400 mt-2">{t('howItWorksSub', 'Commander vos produits frais en 3 étapes simples')}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Ligne de connexion (desktop) */}
            <div className="hidden md:block absolute top-10 left-1/4 right-1/4 h-0.5 bg-[#d2e095]" />
            {[
              {
                step: '1',
                emoji: '🛒',
                title: t('about.step1_title', 'Vous choisissez'),
                desc: t('about.step1_desc', 'Parcourez notre catalogue et sélectionnez vos fruits et légumes préférés en quelques clics.'),
              },
              {
                step: '2',
                emoji: '🔍',
                title: t('about.step2_title', 'On sélectionne'),
                desc: t('about.step2_desc', 'Notre équipe choisit pour vous les meilleurs produits du marché — mûrs à point, sans défaut.'),
              },
              {
                step: '3',
                emoji: '🚚',
                title: t('about.step3_title', 'On livre'),
                desc: t('about.step3_desc', "Vos produits arrivent frais à l'adresse et à l'heure de votre choix, emballés avec soin."),
              },
            ].map(s => (
              <div key={s.step} className="flex flex-col items-center text-center relative">
                <div className="w-20 h-20 bg-[#ecf4d5] rounded-full flex items-center justify-center text-4xl mb-4 border-4 border-white shadow-sm z-10">
                  {s.emoji}
                </div>
                <span className="text-xs font-bold text-[#a8c800] uppercase tracking-widest mb-1">{t('howStepLabel', 'Étape')} {s.step}</span>
                <h3 className="text-lg font-bold text-gray-800 mb-2">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-12">
            <a href="#produits" className="inline-block bg-[#a8c800] text-white px-8 py-3.5 rounded-full font-semibold hover:bg-[#7d9800] transition">
              🌿 {t('howCta', 'Commencer mes achats')}
            </a>
          </div>
        </div>
      </section>
      )}

      {/* Stats */}
      {show('home.stats') && (
      <section className="bg-[#ecf4d5]">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {[
            { emoji: "🥬", label: t('freshProducts', 'Produits frais'), value: products.length + "+" },
            { emoji: "👨‍🌾", label: t('producers', 'Producteurs'), value: producers.length + "+" },
            { emoji: "🇩🇯", label: t('localProductsCount', 'Produits locaux'), value: localProducts.length + "+" },
            { emoji: "🚚", label: t('fastDelivery', 'Livraison flexible'), value: "✓" },
          ].map(stat => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl mb-2">{stat.emoji}</div>
              <div className="text-2xl font-bold text-[#526500]">{stat.value}</div>
              <div className="text-sm text-gray-500">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>
      )}

      {/* Bannière apps mobiles (Android + iOS) */}
      {show('home.apps') && (() => {
        const APP_I18N: Record<string, { android: string; ios: string; desc: string; badge: string }> = {
          fr: { android: 'Application Android', ios: 'Application iOS', badge: 'Bientôt disponible',    desc: 'Commandez encore plus facilement depuis votre téléphone.' },
          en: { android: 'Android App',         ios: 'iOS App',         badge: 'Coming soon',           desc: 'Order even more easily from your phone.' },
          zh: { android: 'Android 应用程序',     ios: 'iOS 应用程序',     badge: '即将推出',              desc: '更轻松地从手机下单。' },
          so: { android: 'App-ka Android',       ios: 'App-ka iOS',       badge: 'Dhawaan la heli doono', desc: 'Ka dalbo si fudud oo dheeraad ah telefoonkaaga.' },
          aa: { android: 'Android Application',  ios: 'iOS Application',  badge: 'Dhiyeenyatti argama',   desc: 'Telefoono xiinaanteen qaafileele abuurri.' },
          am: { android: 'አንድሮይድ መተግበሪያ',      ios: 'iOS መተግበሪያ',      badge: 'በቅርቡ ይገኛል',           desc: 'ከስልክዎ ይበልጥ በቀላሉ ያዝዙ።' },
        };
        const i = APP_I18N[currentLang] ?? APP_I18N.fr;
        const ANDROID_PATH = 'M17.523 15.341a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-9.046 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM2.307 8.4l1.738 3.01A9.957 9.957 0 0 0 2 16h20a9.957 9.957 0 0 0-2.045-4.59l1.738-3.01a.5.5 0 0 0-.866-.5l-1.7 2.945A9.965 9.965 0 0 0 12 9c-1.99 0-3.842.583-5.397 1.585L4.903 7.9a.5.5 0 0 0-.866.5z';
        const APPLE_PATH = 'M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z';
        const platforms = [
          { name: i.android, path: ANDROID_PATH },
          { name: i.ios,     path: APPLE_PATH },
        ];
        return (
          <section className="bg-gradient-to-br from-[#1c3a05] via-[#2d6410] to-[#7a5800] py-6 px-4 md:px-6">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-5">
              <p className="text-white/80 text-sm text-center md:text-left md:max-w-xs">{i.desc}</p>
              <div className="flex flex-col sm:flex-row items-stretch gap-3">
                {platforms.map(p => (
                  <div key={p.name} className="flex items-center gap-3 bg-white/10 rounded-2xl px-4 py-2.5 flex-1">
                    <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="#a8c800"><path d={p.path}/></svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-bold text-sm truncate">{p.name}</p>
                      <span className="inline-block bg-[#a8c800] text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide mt-0.5">{i.badge}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
      })()}

      {/* Footer */}
      <footer className="bg-white border-t border-[#d2e095] py-6 md:py-8 px-4 md:px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 md:gap-4">
          <div className="flex flex-col md:flex-row items-center gap-1 md:gap-2 text-center md:text-left">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🌿</span>
              <span className="font-bold text-[#526500]">Hornafresh</span>
            </div>
            <span className="text-gray-400 text-sm">
              <span className="hidden md:inline">— </span>{t('footer', 'Le marché premium, frais, bio, local et régional de Djibouti')}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/about" className="text-sm text-[#7d9800] hover:underline">
              {t('learnMore', 'Qui sommes-nous ?')}
            </Link>
            <p className="text-sm text-gray-400">© 2026 Hornafresh. {t('rights', 'Tous droits réservés.')}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
