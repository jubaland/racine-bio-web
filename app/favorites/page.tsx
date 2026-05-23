'use client';

import { useLanguage } from '../../context/LanguageContext';
import { useFavorites } from '../../context/FavoritesContext';
import { useCart } from '../../context/CartContext';
import Header from '../../components/Header';
import CartDrawer from '../../components/CartDrawer';
import Link from 'next/link';
import { useState } from 'react';

export default function FavoritesPage() {
  const { ui, productTranslations, currentLang } = useLanguage();
  const { favorites, removeFavorite } = useFavorites();
  const { addItem } = useCart();
  const [cartOpen, setCartOpen] = useState(false);

  const t = (key: string, fallback: string) => ui[key] || fallback;

  const getProductName = (product: any) => {
    if (currentLang !== 'fr' && productTranslations[product.id]?.name) {
      return productTranslations[product.id].name;
    }
    return product.name;
  };

  return (
    <div className="min-h-screen bg-[#f8faf0]">
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
      <Header onCartOpen={() => setCartOpen(true)} />

      <div className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">❤️ {t('favorites', 'Mes favoris')}</h1>

        {favorites.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-6xl mb-4 opacity-20">❤️</p>
            <p className="text-gray-400 text-lg mb-6">{t('favorites.empty', 'Aucun favori pour le moment')}</p>
            <Link href="/" className="bg-[#a8c800] text-white px-6 py-3 rounded-full font-semibold hover:bg-[#7d9800] transition">
              🛒 {t('favorites.browse', 'Parcourir les produits')}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {favorites.map((product: any) => (
              <div key={product.id} className="bg-white rounded-2xl overflow-hidden border border-[#dde8b0] hover:shadow-lg transition group">
                <div className="relative h-44 bg-[#f0f7e8]">
                  <Link href={`/product/${product.id}`}>
                    {product.image_url ? (
                      <img src={product.image_url} alt={getProductName(product)} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-5xl opacity-20">📷</div>
                    )}
                  </Link>
                  <button
                    onClick={() => removeFavorite(product.id)}
                    className="absolute top-2 right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow hover:bg-red-50 transition"
                  >
                    ❤️
                  </button>
                </div>
                <div className="p-3">
                  <Link href={`/product/${product.id}`}>
                    <h3 className="text-sm font-semibold text-gray-800 truncate">{getProductName(product)}</h3>
                    <p className="text-xs text-gray-400 mt-1">🌱 {product.farm}</p>
                  </Link>
                  <div className="flex items-center justify-between mt-3">
                    <p className="text-sm font-bold text-[#7d9800]">
                      {Number(product.price).toLocaleString()} Fdj
                      <span className="text-xs font-normal text-gray-400 ml-1">{product.unit}</span>
                    </p>
                    <button
                      onClick={() => { addItem(product); setCartOpen(true); }}
                      className="w-8 h-8 bg-[#a8c800] rounded-full flex items-center justify-center text-white text-lg font-bold hover:bg-[#7d9800] transition"
                    >+</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}