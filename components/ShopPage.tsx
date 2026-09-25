'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '../context/LanguageContext';
import { useCart } from '../context/CartContext';
import { useFavorites } from '../context/FavoritesContext';
import Header from './Header';
import CartDrawer from './CartDrawer';
import CardLike from './CardLike';

// Vitrine publique d'un marchand : /boutique/[owner_id]
const ORIGIN_FLAGS: Record<string, string> = { DJ: '🇩🇯', ET: '🇪🇹', SO: '🇸🇴', YE: '🇾🇪', FR: '🇫🇷', EG: '🇪🇬', SA: '🇸🇦' };

export default function ShopPage({ shop, products }: { shop: { id: string; name: string; region: string | null }; products: any[] }) {
  const { ui, productTranslations, currentLang } = useLanguage();
  const { addItem } = useCart();
  const { isFavorite, addFavorite, removeFavorite } = useFavorites();
  const [cartOpen, setCartOpen] = useState(false);
  const t = (k: string, f: string) => ui[k] || f;
  const getProductName = (p: any) => (currentLang !== 'fr' && productTranslations[p.id]?.name) ? productTranslations[p.id].name : p.name;
  const inStock = products.filter(p => (p.stock_qty ?? 0) > 0).length;

  return (
    <div className="min-h-screen bg-[#faf7e8]">
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
      <Header onCartOpen={() => setCartOpen(true)} />

      <section className="bg-gradient-to-br from-[#1c3a05] via-[#2d6410] to-[#7a5800] text-white px-4 md:px-6 py-8 md:py-10">
        <div className="max-w-7xl mx-auto">
          <Link href="/" className="text-xs text-white/70 hover:text-white">← {t('shop.back', 'Retour au marché')}</Link>
          <div className="flex items-center gap-4 mt-3">
            <span className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center text-3xl">🏪</span>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">{shop.name}</h1>
              <p className="text-sm text-white/75 mt-0.5">
                {t('shop.merchant_on', 'Marchand partenaire sur Hornafresh')}{shop.region ? ` · 📍 ${shop.region}` : ''} · {products.length} {t('shop.products', 'produit(s)')}{inStock < products.length ? ` (${inStock} ${t('shop.in_stock', 'en stock')})` : ''}
              </p>
            </div>
          </div>
          <p className="text-xs text-white/60 mt-4 max-w-2xl">{t('shop.hub_note', 'Vous commandez et payez sur Hornafresh ; nous préparons et livrons votre commande avec les produits de ce marchand.')}</p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        {products.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-5xl mb-4 opacity-30">🏪</p>
            <p className="text-gray-400">{t('shop.empty', 'Cette boutique n\'a pas de produit disponible pour le moment.')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {products.map((product: any) => {
              const flag = ORIGIN_FLAGS[product.origin_country] || '🌍';
              const out = (product.stock_qty ?? 0) <= 0;
              return (
                <Link key={product.id} href={`/product/${product.id}`} onClick={out ? (e) => e.preventDefault() : undefined} className={`bg-white rounded-2xl overflow-hidden border border-[#d2e095] transition group ${out ? 'cursor-default opacity-75' : 'hover:shadow-lg'}`}>
                  <div className="relative h-36 sm:h-44 bg-[#ecf4d5]">
                    {product.image_url ? <img src={product.image_url} alt={getProductName(product)} className={`w-full h-full object-cover transition duration-300 ${out ? 'opacity-50' : 'group-hover:scale-105'}`} /> : <div className="w-full h-full flex items-center justify-center text-5xl opacity-20">📷</div>}
                    {out && <div className="absolute inset-0 flex items-center justify-center bg-black/20"><span className="bg-white text-gray-700 text-xs font-semibold px-3 py-1 rounded-full shadow">{t('product.out_of_stock', 'Rupture de stock')}</span></div>}
                    {!out && (product.stock_qty ?? 0) <= 5 && <div className="absolute bottom-2 left-2 bg-amber-900/80 text-amber-100 text-xs px-2.5 py-0.5 rounded-full backdrop-blur-sm">⚠️ {t('product.stock_left', 'Plus que')} {product.stock_qty} {product.unit}</div>}
                    {product.product_type === 'bio' && <div className="absolute top-2 left-2 text-xs font-bold px-2 py-1 rounded-md bg-[#edf5a0] text-[#526500]">🌿 {t('product.type_bio', 'Bio')}</div>}
                    <button onClick={(e) => { e.stopPropagation(); e.preventDefault(); isFavorite(product.id) ? removeFavorite(product.id) : addFavorite(product); }} className="absolute top-2 right-2 w-8 h-8 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow hover:scale-110 transition-all">
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill={isFavorite(product.id) ? '#f97316' : 'none'} stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
                    </button>
                  </div>
                  <div className="p-3">
                    <h3 className="text-sm font-semibold text-gray-800 truncate">{getProductName(product)}</h3>
                    <div className="flex items-center justify-between mt-1"><p className="text-xs text-gray-400">{t('product.origin_label', 'Origine')}</p><span className="text-base flex-none ml-1">{flag}</span></div>
                    <div className="flex items-center justify-between mt-3">
                      <div>
                        {product.old_price && <p className="text-xs text-red-400 line-through">{Number(product.old_price).toLocaleString()} Fdj</p>}
                        <p className="text-sm font-bold text-[#7d9800]">{Number(product.price).toLocaleString()} Fdj <span className="text-xs font-normal text-gray-400">{product.unit ? `/ ${product.unit}` : ''}</span></p>
                      </div>
                      <button disabled={out} onClick={(e) => { e.stopPropagation(); e.preventDefault(); addItem(product); setCartOpen(true); }} className="w-8 h-8 bg-[#a8c800] rounded-full flex items-center justify-center text-white text-lg font-bold hover:bg-[#7d9800] transition disabled:opacity-30 disabled:cursor-not-allowed">+</button>
                    </div>
                    <CardLike productId={product.id} initialCount={product.likes_count ?? 0} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
