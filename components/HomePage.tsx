'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '../context/LanguageContext';
import { useCart } from '../context/CartContext';
import { useFavorites } from '../context/FavoritesContext';
import Header from './Header';
import CartDrawer from './CartDrawer';

const ORIGIN_FLAGS: Record<string, string> = {
  DJ: '🇩🇯', ET: '🇪🇹', SO: '🇸🇴', YE: '🇾🇪', FR: '🇫🇷',
};

const TYPE_FILTERS = [
  { id: 'all',           labelKey: 'filter.all',  label: 'Tout',          emoji: '🛒' },
  { id: 'bio',           labelKey: 'filter.bio',  label: 'Bio',           emoji: '🌿' },
  { id: 'conventionnel', labelKey: 'filter.conv', label: 'Conventionnel', emoji: '🥕' },
];

export default function HomePage({ products, categories, promos, producers }: {
  products: any[];
  categories: any[];
  promos: any[];
  producers: any[];
}) {
  const { ui, productTranslations, categoryTranslations, promoTranslations, currentLang } = useLanguage();
  const { addItem } = useCart();
  const { isFavorite, addFavorite, removeFavorite } = useFavorites();
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeType, setActiveType] = useState('all');
  const [activeOrigin, setActiveOrigin] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

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

  const filteredProducts = products.filter(p => {
    const catMatch = activeCategory === 'all' || p.category === activeCategory;
    const typeMatch = activeType === 'all' || p.product_type === activeType;
    const originMatch = activeOrigin === 'all' || p.origin_country === activeOrigin;
    const searchMatch = searchQuery === '' ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.farm && p.farm.toLowerCase().includes(searchQuery.toLowerCase()));
    return catMatch && typeMatch && originMatch && searchMatch;
  });

  const localProducts = products.filter(p => p.is_local);
  const featuredProducts = products.filter(p => p.is_featured);

  return (
    <div className="min-h-screen bg-[#faf7e8]">

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
      <Header onCartOpen={() => setCartOpen(true)} />

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
                { emoji: '⏱', desc: t('hero.delivery_delay_desc', 'Sous 48h') },
                { emoji: '🆓', desc: t('hero.delivery_free_desc', 'Livraison gratuite') },
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

      {/* Sélection du moment */}
      {featuredProducts.length > 0 && (
        <section id="selection" className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-semibold text-gray-800">⭐ {t('featuredTitle', 'Sélection du moment')}</h2>
              <p className="text-sm text-gray-400 mt-0.5">{t('featuredSub', 'Produits choisis par notre équipe — anti-gaspi & bons plans')}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {featuredProducts.map((p: any) => {
              const discount = p.old_price ? Math.round((1 - p.price / p.old_price) * 100) : null;
              return (
                <div key={p.id} className={`bg-white rounded-2xl overflow-hidden border border-[#d2e095] transition flex flex-col ${(p.stock_qty ?? 0) <= 0 ? 'opacity-75' : 'hover:shadow-md'}`}>
                  <Link href={`/product/${p.id}`} onClick={(p.stock_qty ?? 0) <= 0 ? (e) => e.preventDefault() : undefined} className={`relative ${(p.stock_qty ?? 0) <= 0 ? 'cursor-default' : ''}`}>
                    {p.image_url ? (
                      <img src={p.image_url} alt={getProductName(p)} className="w-full h-40 object-cover" />
                    ) : (
                      <div className="w-full h-40 bg-[#ecf4d5] flex items-center justify-center text-5xl opacity-30">
                        {p.emoji || '📷'}
                      </div>
                    )}
                    {p.featured_badge && (
                      <span className="absolute top-2 left-2 bg-[#526500] text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                        {p.featured_badge}
                      </span>
                    )}
                    {discount && (
                      <span className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                        -{discount}%
                      </span>
                    )}
                  </Link>
                  <div className="p-3 flex flex-col flex-1">
                    <p className="text-sm font-semibold text-gray-800 line-clamp-2 flex-1">{getProductName(p)}</p>
                    <p className="text-xs text-gray-400 mt-1">🌱 {p.farm}</p>
                    <div className="flex items-center justify-between mt-3">
                      <div>
                        <p className="text-base font-bold text-[#526500]">{Number(p.price).toLocaleString()} Fdj</p>
                        {p.old_price && (
                          <p className="text-xs text-gray-400 line-through">{Number(p.old_price).toLocaleString()} Fdj</p>
                        )}
                      </div>
                      <button
                        disabled={(p.stock_qty ?? 0) <= 0}
                        onClick={() => { addItem(p); setCartOpen(true); }}
                        className="w-8 h-8 bg-[#a8c800] rounded-full flex items-center justify-center text-white font-bold text-lg hover:bg-[#7d9800] transition disabled:opacity-30 disabled:cursor-not-allowed"
                      >+</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Produits locaux */}
      {localProducts.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-gray-800">🇩🇯 {t('localProducts', 'Produits de Djibouti')}</h2>
            <button onClick={() => setActiveOrigin('DJ')} className="text-sm text-[#7d9800] hover:underline">
              {t('seeAll', 'Tout voir')}
            </button>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {localProducts.map((p: any) => (
              <Link key={p.id} href={`/product/${p.id}`} onClick={(p.stock_qty ?? 0) <= 0 ? (e) => e.preventDefault() : undefined} className={`flex-none w-48 bg-white rounded-2xl overflow-hidden border border-[#d2e095] transition ${(p.stock_qty ?? 0) <= 0 ? 'cursor-default opacity-75' : 'hover:shadow-md'}`}>
                <div className="relative">
                  {p.image_url ? (
                    <img src={p.image_url} alt={getProductName(p)} className="w-full h-36 object-cover" />
                  ) : (
                    <div className="w-full h-36 bg-[#ecf4d5] flex items-center justify-center text-4xl opacity-30">📷</div>
                  )}
                  {(p.stock_qty ?? 0) <= 0 && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <span className="bg-white text-gray-700 text-xs font-semibold px-2 py-1 rounded-full">Rupture</span>
                    </div>
                  )}
                  {(p.stock_qty ?? 0) > 0 && (p.stock_qty ?? 0) <= 5 && (
                    <span className="absolute top-1 right-1 bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">⚠️ {p.stock_qty} {p.unit}</span>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium text-gray-800">{getProductName(p)}</p>
                  <p className="text-xs text-gray-400 mt-1">🌱 {p.farm}</p>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-sm font-bold text-[#7d9800]">{Number(p.price).toLocaleString()} Fdj</p>
                    <button
                      disabled={(p.stock_qty ?? 0) <= 0}
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); addItem(p); setCartOpen(true); }}
                      className="w-7 h-7 bg-[#a8c800] rounded-full flex items-center justify-center text-white font-bold hover:bg-[#7d9800] transition disabled:opacity-30 disabled:cursor-not-allowed"
                    >+</button>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Tous les produits */}
      <section id="produits" className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-gray-800">🛒 {t('allProducts', 'Tous les produits')}</h2>
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
                      <p className="text-xs text-gray-400 truncate">🌱 {p.farm}</p>
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

          {(activeCategory !== 'all' || activeType !== 'all' || activeOrigin !== 'all' || searchQuery) && (
            <button
              onClick={() => { setActiveType('all'); setActiveOrigin('all'); setActiveCategory('all'); setSearchQuery(''); }}
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
                  <div className="relative h-44 bg-[#ecf4d5]">
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
                      <div className="absolute bottom-2 left-2 bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
                        ⚠️ Plus que {product.stock_qty} {product.unit}
                      </div>
                    )}
                    <div className={`absolute top-2 left-2 text-xs font-bold px-2 py-1 rounded-md ${isBio ? 'bg-[#edf5a0] text-[#526500]' : 'bg-orange-100 text-orange-700'}`}>
                      {isBio ? `🌿 ${t('product.type_bio', 'Bio')}` : `🥕 ${t('product.type_conv', 'Conv.')}`}
                    </div>
                    {/* Bouton favori sur l'image */}
                    <button
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); isFavorite(product.id) ? removeFavorite(product.id) : addFavorite(product); }}
                      className="absolute top-2 right-2 w-8 h-8 bg-[#a8c800] rounded-full flex items-center justify-center shadow hover:bg-[#7d9800] hover:scale-110 transition-all text-base"
                      title={isFavorite(product.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                    >
                      {isFavorite(product.id) ? '❤️' : '🤍'}
                    </button>
                    {/* Drapeau en bas à droite */}
                    <div className="absolute bottom-2 right-2 bg-white/80 rounded-full px-2 py-0.5 text-xs backdrop-blur-sm">
                      {origin.flag}
                    </div>
                  </div>
                  <div className="p-3">
                    <h3 className="text-sm font-semibold text-gray-800 truncate">{getProductName(product)}</h3>
                    <p className="text-xs text-gray-400 mt-1">🌱 {product.farm}</p>
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
      {producers.length > 0 && (
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
      <section className="bg-gradient-to-br from-[#1c3a05] via-[#2d5c0a] to-[#1c3a05] py-12 md:py-16 px-4 md:px-6 text-white">
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

      {/* Comment ça marche */}
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
                title: t('howStep1Title', 'Parcourez'),
                desc: t('howStep1Desc', 'Explorez nos produits bio et locaux, filtrés par catégorie, origine ou type.'),
              },
              {
                step: '2',
                emoji: '📦',
                title: t('howStep2Title', 'Commandez'),
                desc: t('howStep2Desc', 'Ajoutez au panier, choisissez votre mode de paiement et confirmez en quelques clics.'),
              },
              {
                step: '3',
                emoji: '🚚',
                title: t('howStep3Title', 'Recevez'),
                desc: t('howStep3Desc', 'Vos produits frais sont livrés directement depuis les fermes jusqu\'à votre porte.'),
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

      {/* Stats */}
      <section className="bg-[#ecf4d5]">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {[
            { emoji: "🥬", label: t('freshProducts', 'Produits frais'), value: products.length + "+" },
            { emoji: "👨‍🌾", label: t('producers', 'Producteurs'), value: producers.length + "+" },
            { emoji: "🇩🇯", label: t('localProductsCount', 'Produits locaux'), value: localProducts.length + "+" },
            { emoji: "🚚", label: t('fastDelivery', 'Livraison rapide'), value: "48h" },
          ].map(stat => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl mb-2">{stat.emoji}</div>
              <div className="text-2xl font-bold text-[#526500]">{stat.value}</div>
              <div className="text-sm text-gray-500">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-[#d2e095] py-6 md:py-8 px-4 md:px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 md:gap-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌿</span>
            <span className="font-bold text-[#526500]">Hornafresh</span>
            <span className="text-gray-400 text-sm">— {t('footer', 'Le marché premium, frais, bio, local et régional de Djibouti')}</span>
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
