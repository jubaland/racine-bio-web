'use client';

import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useCart } from '../context/CartContext';
import Header from './Header';
import CartDrawer from './CartDrawer';
import Link from 'next/link';

const ORIGINS: Record<string, { flag: string; label: string }> = {
  DJ: { flag: '🇩🇯', label: 'Djibouti' },
  ET: { flag: '🇪🇹', label: 'Éthiopie' },
  SO: { flag: '🇸🇴', label: 'Somalie' },
  YE: { flag: '🇾🇪', label: 'Yémen' },
  FR: { flag: '🇫🇷', label: 'France' },
};

export default function ProductDetail({ product, allProducts }: { product: any; allProducts: any[] }) {
  const { ui, productTranslations, currentLang } = useLanguage();
  const { addItem } = useCart();
  const [cartOpen, setCartOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const t = (key: string, fallback: string) => ui[key] || fallback;

  const getProductName = (p: any) => {
    if (currentLang !== 'fr' && productTranslations[p.id]?.name) {
      return productTranslations[p.id].name;
    }
    return p.name;
  };

  const getProductDesc = (p: any) => {
    if (currentLang !== 'fr' && productTranslations[p.id]?.description) {
      return productTranslations[p.id].description;
    }
    return p.description;
  };

  const origin = ORIGINS[product.origin_country] || { flag: '🌍', label: product.origin_country };
  const isBio = product.product_type === 'bio';

  const relatedProducts = allProducts
    .filter(p => p.id !== product.id && p.category === product.category)
    .slice(0, 4);

  const handleAddToCart = () => {
    for (let i = 0; i < quantity; i++) {
      addItem(product);
    }
    setCartOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#f8faf0]">
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
      <Header onCartOpen={() => setCartOpen(true)} />

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
          <Link href="/" className="hover:text-[#7d9800]">Accueil</Link>
          <span>›</span>
          <Link href="/#produits" className="hover:text-[#7d9800]">{t('products', 'Produits')}</Link>
          <span>›</span>
          <span className="text-gray-600">{getProductName(product)}</span>
        </div>

        {/* Product */}
        <div className="bg-white rounded-3xl overflow-hidden border border-[#dde8b0] shadow-sm mb-8">
          <div className="grid md:grid-cols-2 gap-0">

            {/* Image */}
            <div className="relative h-80 md:h-auto bg-[#f0f7e8]">
              {product.image_url ? (
                <img src={product.image_url} alt={getProductName(product)} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-8xl opacity-20">📷</div>
              )}
              <div className={`absolute top-4 left-4 text-xs font-bold px-3 py-1 rounded-full ${isBio ? 'bg-[#eef5b0] text-[#526500]' : 'bg-orange-100 text-orange-700'}`}>
                {isBio ? '🌿 Bio' : '🥕 Conventionnel'}
              </div>
              <div className="absolute top-4 right-4 bg-white/90 rounded-full px-3 py-1 text-sm">
                {origin.flag} {origin.label}
              </div>
            </div>

            {/* Info */}
            <div className="p-8">
              <h1 className="text-2xl font-bold text-gray-800 mb-2">{getProductName(product)}</h1>
              <p className="text-gray-400 text-sm mb-4">🌱 {product.farm} · {product.region}</p>

              {getProductDesc(product) && (
                <p className="text-gray-600 text-sm leading-relaxed mb-6">{getProductDesc(product)}</p>
              )}

              {/* Prix */}
              <div className="mb-6">
                {(product.old_price || product.oldPrice) && (
                  <p className="text-sm text-red-400 line-through">{Number(product.old_price || product.oldPrice).toLocaleString()} Fdj</p>
                )}
                <p className="text-3xl font-bold text-[#526500]">
                  {Number(product.price).toLocaleString()} Fdj
                  <span className="text-base font-normal text-gray-400 ml-1">{product.unit}</span>
                </p>
              </div>

              {/* Quantité */}
              <div className="flex items-center gap-4 mb-6">
                <span className="text-sm font-medium text-gray-600">Quantité :</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-9 h-9 rounded-full bg-[#f0f7e8] border border-[#dde8b0] flex items-center justify-center text-gray-600 hover:bg-[#dde8b0] transition"
                  >−</button>
                  <span className="text-lg font-semibold w-8 text-center">{quantity}</span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-9 h-9 rounded-full bg-[#a8c800] flex items-center justify-center text-white hover:bg-[#7d9800] transition"
                  >+</button>
                </div>
              </div>

              {/* Total */}
              <div className="bg-[#f8faf0] rounded-2xl p-4 mb-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total</span>
                  <span className="text-xl font-bold text-[#526500]">
                    {(Number(product.price) * quantity).toLocaleString()} Fdj
                  </span>
                </div>
              </div>

              {/* Bouton */}
              <button
                onClick={handleAddToCart}
                className="w-full bg-[#a8c800] text-white py-4 rounded-2xl font-semibold text-lg hover:bg-[#7d9800] transition"
              >
                🛒 Ajouter au panier
              </button>

              {/* Badges */}
              <div className="flex flex-wrap gap-2 mt-4">
                {product.is_local && (
                  <span className="bg-[#e6f0ff] text-[#0066cc] text-xs px-3 py-1 rounded-full">🇩🇯 Produit local</span>
                )}
                {isBio && (
                  <span className="bg-[#f0f7e8] text-[#526500] text-xs px-3 py-1 rounded-full">🌿 Certifié Bio</span>
                )}
                <span className="bg-[#fff3e0] text-[#e65100] text-xs px-3 py-1 rounded-full">🚚 Livraison 48h</span>
              </div>
            </div>
          </div>
        </div>

        {/* Produits similaires */}
        {relatedProducts.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Produits similaires</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {relatedProducts.map((p: any) => (
                <Link key={p.id} href={`/product/${p.id}`} className="bg-white rounded-2xl overflow-hidden border border-[#dde8b0] hover:shadow-md transition">
                  <div className="h-32 bg-[#f0f7e8]">
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
