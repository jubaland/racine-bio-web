'use client';

import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useCart } from '../context/CartContext';
import LanguageSelector from './LanguageSelector';
import CartDrawer from './CartDrawer';
import Link from 'next/link';

const ORIGINS: Record<string, { flag: string; label: string }> = {
  DJ: { flag: '🇩🇯', label: 'Djibouti' },
  ET: { flag: '🇪🇹', label: 'Éthiopie' },
  SO: { flag: '🇸🇴', label: 'Somalie' },
  YE: { flag: '🇾🇪', label: 'Yémen' },
  FR: { flag: '🇫🇷', label: 'France' },
};

const TYPE_FILTERS = [
  { id: 'all', labelKey: 'all', emoji: '🛒' },
  { id: 'bio', labelKey: 'bio', emoji: '🌿' },
  { id: 'conventionnel', labelKey: 'conventionnel', emoji: '🥕' },
];

export default function HomePage({ products, categories, promos, producers }: {
  products: any[];
  categories: any[];
  promos: any[];
  producers: any[];
}) {
  const { ui, productTranslations, categoryTranslations, promoTranslations, currentLang } = useLanguage();
  const { addItem, count } = useCart();
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeType, setActiveType] = useState('all');
  const [activeOrigin, setActiveOrigin] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
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
    const ORIGIN_MAP: Record<string, { id: string; label: string; flag: string }> = {
      DJ: { id: 'DJ', label: 'Djibouti', flag: '🇩🇯' },
      ET: { id: 'ET', label: 'Éthiopie', flag: '🇪🇹' },
      SO: { id: 'SO', label: 'Somalie', flag: '🇸🇴' },
      YE: { id: 'YE', label: 'Yémen', flag: '🇾🇪' },
      FR: { id: 'FR', label: 'France', flag: '🇫🇷' },
    };
    const seen: Record<string, boolean> = {};
    const result = [{ id: 'all', label: t('allCountries', 'Tous pays'), flag: '🌍' }];
    products.forEach(p => {
      const code = p.origin_country;
      if (code && !seen[code] && ORIGIN_MAP[code]) {
        seen[code] = true;
        result.push(ORIGIN_MAP[code]);
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

  return (
    <div className="min-h-screen bg-[#f8faf0]">

      {/* Cart Drawer */}
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />

      {/* Header */}
      <header className="bg-white border-b border-[#dde8b0] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🌿</span>
            <div>
              <h1 className="text-xl font-bold text-[#526500]">Racine Bio</h1>
              <p className="text-xs text-gray-400">{t('footer', 'Le marché bio de Djibouti')}</p>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#produits" className="text-sm font-medium text-gray-600 hover:text-[#7d9800]">{t('products', 'Produits')}</a>
            <a href="#producteurs" className="text-sm font-medium text-gray-600 hover:text-[#7d9800]">{t('producers', 'Producteurs')}</a>
            <a href="#promos" className="text-sm font-medium text-gray-600 hover:text-[#7d9800]">{t('promos', 'Promos')}</a>
          </nav>
          <div className="flex items-center gap-3">
            <LanguageSelector />
            <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-[#7d9800] transition hidden md:block">
              {t('login', 'Se connecter')}
            </Link>
            <Link href="/login" className="hidden md:block bg-[#a8c800] text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-[#7d9800] transition">
              {t('register', "S'inscrire")}
            </Link>
            <button
              onClick={() => setCartOpen(true)}
              className="relative p-2"
            >
              <span className="text-2xl">🛒</span>
              {count > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                  {count > 9 ? '9+' : count}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-[#2a4f08] to-[#5a9a18] text-white py-20 px-6">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-4 py-1 text-sm mb-6">
              🇩🇯 {t('heroTag', 'Produits frais de Djibouti et de la région')}
            </div>
            <h2 className="text-5xl font-bold mb-6 leading-tight">
              {t('tagline', 'Trouvez vos')} <span className="italic text-[#c4e025]">{t('tagline2', 'légumes')}</span> {t('tagline3', 'et fruits du jour')}
            </h2>
            <p className="text-lg text-white/80 mb-8">
              {t('heroSub', 'Bio, conventionnel, local — tous les produits frais livrés directement depuis les fermes djiboutiennes.')}
            </p>
            <div className="flex gap-4 flex-wrap">
              <button
                onClick={() => setCartOpen(true)}
                className="bg-white text-[#526500] px-6 py-3 rounded-full font-semibold hover:bg-[#f8faf0] transition"
              >
                🛒 {t('orderNow', 'Commander maintenant')}
              </button>
              <a href="#produits" className="border border-white/40 text-white px-6 py-3 rounded-full font-medium hover:bg-white/10 transition">
                {t('learnMore', 'En savoir plus')}
              </a>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {localProducts.slice(0, 4).map((p: any) => (
              <div key={p.id} className="bg-white/10 rounded-2xl overflow-hidden backdrop-blur">
                {p.image_url ? (
                  <img src={p.image_url} alt={getProductName(p)} className="w-full h-32 object-cover" />
                ) : (
                  <div className="w-full h-32 flex items-center justify-center text-5xl bg-white/10">📷</div>
                )}
                <div className="p-3">
                  <p className="text-sm font-medium">{getProductName(p)}</p>
                  <p className="text-xs text-white/60">{p.farm}</p>
                  <p className="text-sm font-bold text-[#c4e025] mt-1">{Number(p.price).toLocaleString()} Fdj</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-white border-b border-[#dde8b0]">
        <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-6">
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

      {/* Promos */}
      {promos.length > 0 && (
        <section id="promos" className="max-w-7xl mx-auto px-6 py-12">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">🔥 {t('promos', 'Promos du moment')}</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {promos.map((promo: any) => {
              const promoData = getPromoData(promo);
              return (
                <div key={promo.id} className="rounded-2xl p-6 text-white relative overflow-hidden" style={{ backgroundColor: promo.color_start || '#2a4f08' }}>
                  <div className="absolute -top-4 -right-4 text-8xl opacity-20">{promo.emoji}</div>
                  <span className="bg-white/25 text-xs font-semibold px-3 py-1 rounded-full inline-block mb-3">{promoData.badge}</span>
                  <h3 className="text-lg font-semibold mb-1">{promoData.title}</h3>
                  <p className="text-sm text-white/75">{promoData.sub}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Produits locaux */}
      {localProducts.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-gray-800">🇩🇯 {t('localProducts', 'Produits de Djibouti')}</h2>
            <button onClick={() => setActiveOrigin('DJ')} className="text-sm text-[#7d9800] hover:underline">
              {t('seeAll', 'Tout voir')}
            </button>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {localProducts.map((p: any) => (
              <div key={p.id} className="flex-none w-48 bg-white rounded-2xl overflow-hidden border border-[#dde8b0] hover:shadow-md transition">
                {p.image_url ? (
                  <img src={p.image_url} alt={getProductName(p)} className="w-full h-36 object-cover" />
                ) : (
                  <div className="w-full h-36 bg-[#f0f7e8] flex items-center justify-center text-4xl opacity-30">📷</div>
                )}
                <div className="p-3">
                  <p className="text-sm font-medium text-gray-800">{getProductName(p)}</p>
                  <p className="text-xs text-gray-400 mt-1">🌱 {p.farm}</p>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-sm font-bold text-[#7d9800]">{Number(p.price).toLocaleString()} Fdj</p>
                    <button
                      onClick={() => { addItem(p); setCartOpen(true); }}
                      className="w-7 h-7 bg-[#a8c800] rounded-full flex items-center justify-center text-white font-bold hover:bg-[#7d9800] transition"
                    >+</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tous les produits */}
      <section id="produits" className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-gray-800">🛒 {t('allProducts', 'Tous les produits')}</h2>
          <span className="text-sm text-gray-400">{filteredProducts.length} {t('products', 'produits')}</span>
        </div>

        {/* Recherche */}
        <div className="relative mb-4">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input
            type="text"
            placeholder={t('search', 'Rechercher...')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-[#dde8b0] rounded-xl text-sm focus:outline-none focus:border-[#a8c800]"
          />
        </div>

        {/* Type filters */}
        <div className="flex gap-3 overflow-x-auto pb-2 mb-3">
          {TYPE_FILTERS.map(tf => (
            <button
              key={tf.id}
              onClick={() => setActiveType(tf.id)}
              className={`flex-none flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition border ${activeType === tf.id ? 'bg-[#e6f0ff] border-[#0066cc] text-[#0066cc]' : 'bg-white border-[#dde8b0] text-gray-600 hover:bg-[#f0f7e8]'}`}
            >
              <span>{tf.emoji}</span>
              <span>{t(tf.labelKey, tf.labelKey)}</span>
            </button>
          ))}
        </div>

        {/* Origin filters */}
        <div className="flex gap-3 overflow-x-auto pb-2 mb-3">
          {getAvailableOrigins().map(of => (
            <button
              key={of.id}
              onClick={() => setActiveOrigin(of.id)}
              className={`flex-none flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition border ${activeOrigin === of.id ? 'bg-[#e6f0ff] border-[#0066cc] text-[#0066cc]' : 'bg-white border-[#dde8b0] text-gray-600 hover:bg-[#f0f7e8]'}`}
            >
              <span>{of.flag}</span>
              <span>{of.label}</span>
            </button>
          ))}
        </div>

        {/* Category filters */}
        <div className="flex gap-3 overflow-x-auto pb-4 mb-6">
          {[{ id: 'all', label: t('all', 'Tout'), emoji: '🌿', slug: 'all' }, ...categories].map((cat: any) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.slug || cat.id)}
              className={`flex-none flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition border ${activeCategory === (cat.slug || cat.id) ? 'bg-[#e6f0ff] border-[#0066cc] text-[#0066cc]' : 'bg-white border-[#dde8b0] text-gray-600 hover:bg-[#f0f7e8]'}`}
            >
              <span>{cat.emoji}</span>
              <span>{getCategoryLabel(cat)}</span>
            </button>
          ))}
        </div>

        {/* Grille produits */}
        {filteredProducts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-5xl mb-4 opacity-30">🌿</p>
            <p className="text-gray-400">Aucun produit trouvé</p>
            <button
              onClick={() => { setActiveType('all'); setActiveOrigin('all'); setActiveCategory('all'); setSearchQuery(''); }}
              className="mt-4 text-sm text-[#7d9800] hover:underline"
            >
              Réinitialiser les filtres
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredProducts.map((product: any) => {
              const origin = ORIGINS[product.origin_country] || { flag: '🌍', label: product.origin_country };
              const isBio = product.product_type === 'bio';
              return (
                <div key={product.id} className="bg-white rounded-2xl overflow-hidden border border-[#dde8b0] hover:shadow-lg transition group cursor-pointer">
                  <div className="relative h-44 bg-[#f0f7e8]">
                    {product.image_url ? (
                      <img src={product.image_url} alt={getProductName(product)} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-5xl opacity-20">📷</div>
                    )}
                    <div className={`absolute top-2 left-2 text-xs font-bold px-2 py-1 rounded-md ${isBio ? 'bg-[#eef5b0] text-[#526500]' : 'bg-orange-100 text-orange-700'}`}>
                      {isBio ? '🌿 Bio' : '🥕 Conv.'}
                    </div>
                    <div className="absolute top-2 right-2 bg-white/90 rounded-full px-2 py-1 text-xs">
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
                        onClick={() => { addItem(product); setCartOpen(true); }}
                        className="w-8 h-8 bg-[#a8c800] rounded-full flex items-center justify-center text-white text-lg font-bold hover:bg-[#7d9800] transition"
                      >+</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Producteurs */}
      {producers.length > 0 && (
        <section id="producteurs" className="max-w-7xl mx-auto px-6 py-12">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">👨‍🌾 {t('ourProducers', 'Nos producteurs')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {producers.map((p: any) => (
              <div key={p.id} className="bg-white rounded-2xl p-6 text-center border border-[#dde8b0] hover:shadow-md transition">
                <div className="text-4xl mb-3">{p.emoji}</div>
                <h3 className="font-semibold text-gray-800 text-sm">{p.name}</h3>
                <p className="text-xs text-gray-400 mt-1">{p.region}</p>
                <p className="text-xs text-amber-500 mt-2">{'★'.repeat(Math.round(p.rating))} {p.rating}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="bg-gradient-to-br from-[#2a4f08] to-[#5a9a18] text-white py-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">📱 {t('downloadApp', "Téléchargez l'application")}</h2>
          <p className="text-white/80 mb-8">{t('downloadSub', 'Commandez vos produits frais depuis votre téléphone. Disponible sur Android.')}</p>
          <button className="bg-white text-[#526500] px-8 py-4 rounded-full font-bold text-lg hover:bg-[#f8faf0] transition">
            📥 {t('downloadPlayStore', 'Télécharger sur Play Store')}
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-[#dde8b0] py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌿</span>
            <span className="font-bold text-[#526500]">Racine Bio</span>
            <span className="text-gray-400 text-sm">— {t('footer', 'Le marché bio de Djibouti')}</span>
          </div>
          <p className="text-sm text-gray-400">© 2026 Racine Bio. {t('rights', 'Tous droits réservés.')}</p>
        </div>
      </footer>
    </div>
  );
}