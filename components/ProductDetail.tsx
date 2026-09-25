'use client';

import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useCart } from '../context/CartContext';
import { useFavorites } from '../context/FavoritesContext';
import Header from './Header';
import CartDrawer from './CartDrawer';
import LikeButton from './LikeButton';
import Link from 'next/link';

const ORIGIN_FLAGS: Record<string, string> = {
  DJ: '🇩🇯', ET: '🇪🇹', SO: '🇸🇴', YE: '🇾🇪', FR: '🇫🇷',
};

export default function ProductDetail({ product, allProducts }: { product: any; allProducts: any[] }) {
  const { ui, productTranslations, currentLang } = useLanguage();
  const { addItem } = useCart();
  const { isFavorite, addFavorite, removeFavorite } = useFavorites();
  const [cartOpen, setCartOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  // Galerie : images[] si renseigné, sinon la photo principale
  const gallery: string[] = Array.isArray(product.images) && product.images.length ? product.images : (product.image_url ? [product.image_url] : []);
  const [imgIdx, setImgIdx] = useState(0);

  const t = (key: string, fallback: string) => ui[key] || fallback;

  const getOrigin = (code: string) => ({
    flag: ORIGIN_FLAGS[code] || '🌍',
    label: t(`origin.${code}`, code),
  });

  const getProductName = (p: any) => {
    if (currentLang !== 'fr' && productTranslations[p.id]?.name) return productTranslations[p.id].name;
    return p.name;
  };

  const getProductDesc = (p: any) => {
    if (currentLang !== 'fr' && productTranslations[p.id]?.description) return productTranslations[p.id].description;
    return p.description;
  };

  const origin = getOrigin(product.origin_country);
  const isBio = product.product_type === 'bio';
  // Panier composé : composition, valeur catalogue et économie réalisée
  const isBundle = !!product.is_bundle;
  const bundleItems: any[] = isBundle && Array.isArray(product.bundle_items) ? product.bundle_items : [];
  const bundleValue = Number(product.bundle_value) || 0;
  const bundleSaving = isBundle && bundleValue > Number(product.price) ? bundleValue - Number(product.price) : 0;
  const isRescue = isBundle && product.bundle_kind === 'rescue';

  const relatedProducts = allProducts
    .filter(p => p.id !== product.id && p.category === product.category && (p.stock_qty ?? 0) > 0)
    .slice(0, 4);

  const handleAddToCart = () => {
    for (let i = 0; i < quantity; i++) addItem(product);
    setCartOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#faf7e8]">
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
      <Header onCartOpen={() => setCartOpen(true)} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
          <Link href="/" className="hover:text-[#7d9800]">{t('product.breadcrumb_home', 'Accueil')}</Link>
          <span>›</span>
          <Link href="/#produits" className="hover:text-[#7d9800]">{t('products', 'Produits')}</Link>
          <span>›</span>
          <span className="text-gray-600">{getProductName(product)}</span>
        </div>

        {/* Product */}
        <div className="bg-white rounded-3xl overflow-hidden border border-[#d2e095] shadow-md mb-8">
          <div className="grid md:grid-cols-2 gap-0">

            {/* Image + galerie (photos multiples) */}
            <div className="relative h-72 sm:h-96 md:h-auto min-h-[320px] bg-[#ecf4d5]">
              {gallery[imgIdx] ? (
                <img src={gallery[imgIdx]} alt={getProductName(product)} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-8xl opacity-20">📷</div>
              )}
              {gallery.length > 1 && (
                <>
                  <button type="button" aria-label="previous" onClick={() => setImgIdx((imgIdx - 1 + gallery.length) % gallery.length)} className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/85 shadow flex items-center justify-center text-gray-700 hover:bg-white z-10">‹</button>
                  <button type="button" aria-label="next" onClick={() => setImgIdx((imgIdx + 1) % gallery.length)} className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/85 shadow flex items-center justify-center text-gray-700 hover:bg-white z-10">›</button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                    {gallery.map((g: string, i: number) => (
                      <button key={g + i} type="button" onClick={() => setImgIdx(i)} className={`w-10 h-10 rounded-lg overflow-hidden border-2 ${i === imgIdx ? 'border-[#a8c800]' : 'border-white/70'} shadow`}>
                        <img src={g} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
              <div className={`absolute top-4 left-4 text-xs font-bold px-3 py-1.5 rounded-full backdrop-blur-sm shadow-sm ${isRescue ? 'bg-[#f97316] text-white' : isBundle ? 'bg-[#526500] text-white' : isBio ? 'bg-[#edf5a0]/90 text-[#526500]' : 'bg-orange-100/90 text-orange-700'}`}>
                {isRescue ? `♻️ ${t('bundle.tag_rescue', 'Anti-gaspi')}` : isBundle ? `🧺 ${t('bundle.tag_theme', 'Panier')}` : isBio ? `🌿 ${t('product.type_bio', 'Bio')}` : `🥕 ${t('product.type_conv', 'Conventionnel')}`}
              </div>
              <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm shadow-sm rounded-full px-3 py-1.5 text-sm font-medium text-gray-700">
                {origin.flag} {origin.label}
              </div>
              {(product.stock_qty ?? 0) > 0 && (product.stock_qty ?? 0) <= 5 && (
                <div className="absolute bottom-4 left-4 bg-amber-900/80 text-amber-100 text-xs px-3 py-1 rounded-full backdrop-blur-sm">
                  ⚠️ {t('product.stock_low_prefix', 'Plus que')} {product.stock_qty} {product.unit?.replace(/^\//, '')}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex flex-col p-5 sm:p-7">

              {/* Nom + ferme */}
              <div className="mb-4">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight mb-1">{getProductName(product)}</h1>
                {product.shop_name ? (
                  <p className="text-sm text-[#7d9800] font-medium">🏪 {t('product.sold_by', 'Vendu par')} <Link href={`/boutique/${product.owner_id}`} className="underline underline-offset-2 hover:text-[#526500]">{product.shop_name}</Link>
                    {product.shop_rating != null && product.shop_rating_count > 0 && <span className="ml-2 text-xs text-gray-500"><span className="text-[#f59e0b]">★</span> {product.shop_rating}/5 · {product.shop_rating_count} {t('rev.count', 'avis')}</span>}
                  </p>
                ) : product.origin_country === 'DJ' && product.farm && (
                  <p className="text-sm text-[#7d9800] font-medium">🌱 {product.farm}{product.region ? ` · ${product.region}` : ''}</p>
                )}
                <div className="mt-3">
                  <LikeButton productId={product.id} initialCount={product.likes_count ?? 0} />
                </div>
              </div>

              {/* Description */}
              {getProductDesc(product) && (
                <p className="text-gray-500 text-sm leading-relaxed pb-4 mb-4 border-b border-[#f0f4e0]">{getProductDesc(product)}</p>
              )}

              {/* Panier composé : contenu + économie */}
              {isBundle && (
                <div className={`rounded-2xl p-4 mb-5 border ${isRescue ? 'bg-[#fff7ed] border-[#fdba74]' : 'bg-[#f8faf0] border-[#e8f0d0]'}`}>
                  {isRescue && (
                    <p className="text-sm font-semibold text-[#c2410c] mb-2">♻️ {t('bundle.rescue_hint', 'Anti-gaspi : articles à écouler, prix réduit, quantités limitées.')}{product.bundle_ends_at ? ` ⏰ ${t('bundle.until', 'Jusqu\'au')} ${new Date(product.bundle_ends_at).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}` : ''}</p>
                  )}
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">🧺 {t('bundle.contents', 'Contenu du panier')}</p>
                  <ul className="space-y-1.5">
                    {bundleItems.map((c: any) => (
                      <li key={c.product_id} className="flex items-center gap-2 text-sm text-gray-700">
                        <div className="w-8 h-8 rounded-lg overflow-hidden bg-[#ecf4d5] flex-none">{c.image_url ? <img src={c.image_url} alt="" className="w-full h-full object-cover" /> : null}</div>
                        <span className="font-semibold text-[#526500] whitespace-nowrap">{c.quantity} {c.unit || ''}</span>
                        <span className="truncate">{getProductName({ id: c.product_id, name: c.name })}</span>
                      </li>
                    ))}
                  </ul>
                  {bundleSaving > 0 && (
                    <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-[#e8f0d0]">{t('bundle.value', 'Valeur des articles')} : <span className="line-through">{bundleValue.toLocaleString()} Fdj</span> · <span className="font-bold text-[#f97316]">{t('bundle.save', 'Vous économisez')} {bundleSaving.toLocaleString()} Fdj</span></p>
                  )}
                </div>
              )}

              {/* Prix */}
              <div className="mb-5">
                {(product.old_price || product.oldPrice) && (
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm text-gray-400 line-through">{Number(product.old_price || product.oldPrice).toLocaleString()} Fdj</p>
                    <span className="text-xs font-bold text-[#f97316] bg-orange-50 px-2 py-0.5 rounded-full">
                      -{Math.round((1 - Number(product.price) / Number(product.old_price || product.oldPrice)) * 100)}%
                    </span>
                    {product.promo_ends_at && (
                      <span className="text-xs text-[#f97316]">🔥 {t('product.promo_until', 'Promo jusqu\'au')} {new Date(product.promo_ends_at + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</span>
                    )}
                  </div>
                )}
                <div className="flex items-end gap-1.5">
                  <span className="text-4xl font-bold text-[#526500]">{Number(product.price).toLocaleString()}</span>
                  <span className="text-lg text-gray-500 mb-0.5">Fdj <span className="text-sm">{product.unit ? `/ ${product.unit}` : ''}</span></span>
                </div>
              </div>

              {/* Quantité + Total */}
              <div className="bg-[#f8faf0] rounded-2xl p-4 mb-5 border border-[#e8f0d0]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-600">{t('product.quantity', 'Quantité')}</span>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-8 h-8 rounded-full bg-white border border-[#d2e095] flex items-center justify-center text-gray-600 hover:bg-[#d2e095] transition shadow-sm">−</button>
                    <span className="text-lg font-bold text-gray-800 w-6 text-center">{quantity}</span>
                    <button onClick={() => setQuantity(Math.min(product.stock_qty ?? 99, quantity + 1))}
                      className="w-8 h-8 rounded-full bg-[#a8c800] flex items-center justify-center text-white hover:bg-[#7d9800] transition shadow-sm">+</button>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-[#e8f0d0]">
                  <span className="text-sm text-gray-500">{t('product.total', 'Total')}</span>
                  <span className="text-xl font-bold text-[#526500]">{(Number(product.price) * quantity).toLocaleString()} Fdj</span>
                </div>
              </div>

              {/* Boutons */}
              <div className="flex gap-3 mb-4">
                <button onClick={handleAddToCart} disabled={(product.stock_qty ?? 0) <= 0}
                  className="flex-1 bg-[#a8c800] text-white py-4 rounded-2xl font-bold text-base hover:bg-[#7d9800] transition shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                  <span>🛒</span><span>{t('product.add_to_cart', 'Ajouter au panier')}</span>
                </button>
                <button onClick={() => isFavorite(product.id) ? removeFavorite(product.id) : addFavorite(product)}
                  className={`w-14 flex items-center justify-center rounded-2xl border-2 transition ${isFavorite(product.id) ? 'bg-[#fff3e8] border-[#f97316]' : 'bg-white border-[#d2e095] hover:bg-[#fff3e8] hover:border-[#f97316]'}`}
                  title={isFavorite(product.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'}>
                  <svg viewBox="0 0 24 24" className="w-6 h-6" fill={isFavorite(product.id) ? '#f97316' : 'none'} stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                </button>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                {product.is_local && (
                  <span className="bg-[#e6f0ff] text-[#0066cc] text-xs px-3 py-1.5 rounded-full font-medium">
                    🇩🇯 {t('product.local_badge', 'Produit local')}
                  </span>
                )}
                {isBio && (
                  <span className="bg-[#ecf4d5] text-[#526500] text-xs px-3 py-1.5 rounded-full font-medium">
                    🌿 {t('product.bio_badge', 'Bio')}
                  </span>
                )}
                <span className="bg-[#fff3e0] text-[#c25000] text-xs px-3 py-1.5 rounded-full font-medium">
                  🚚 {t('product.delivery_badge', 'Livraison 24h')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Produits similaires */}
        {relatedProducts.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">{t('product.similar', 'Produits similaires')}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {relatedProducts.map((p: any) => (
                <Link key={p.id} href={`/product/${p.id}`} className="bg-white rounded-2xl overflow-hidden border border-[#d2e095] hover:shadow-md transition">
                  <div className="h-32 bg-[#ecf4d5]">
                    {p.image_url ? (
                      <img src={p.image_url} alt={getProductName(p)} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl opacity-20">📷</div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium text-gray-800 truncate">{getProductName(p)}</p>
                    <p className="text-sm font-bold text-[#7d9800] mt-1">{Number(p.price).toLocaleString()} Fdj</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
