'use client';

import Link from 'next/link';
import { useFavorites } from '../context/FavoritesContext';
import { useCart } from '../context/CartContext';
import { useLanguage } from '../context/LanguageContext';

export default function FavoritesDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { favorites, removeFavorite } = useFavorites();
  const { addItem } = useCart();
  const { ui } = useLanguage();
  const t = (key: string, fallback: string) => ui[key] || fallback;

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      )}
      <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-white z-50 shadow-2xl transform transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex flex-col h-full">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#fed7aa]">
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#f97316" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              <h2 className="text-lg font-semibold text-gray-800">{t('nav.favorites', 'Mes favoris')}</h2>
              {favorites.length > 0 && (
                <span className="text-sm text-gray-400">({favorites.length})</span>
              )}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">✕</button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {favorites.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <svg viewBox="0 0 24 24" className="w-16 h-16 mb-4 opacity-15" fill="none" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
                <p className="text-gray-400">{t('favorites.empty', 'Aucun article en favori')}</p>
                <button onClick={onClose} className="mt-4 text-sm text-[#7d9800] hover:underline">
                  {t('favorites.browse', 'Découvrir les produits')}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {favorites.map((product: any) => (
                  <div key={product.id} className="flex items-center gap-3 bg-[#faf7e8] rounded-2xl p-3">
                    <Link href={`/product/${product.id}`} onClick={onClose} className="w-16 h-16 rounded-xl overflow-hidden bg-[#ecf4d5] flex-none">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl opacity-30">📷</div>
                      )}
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link href={`/product/${product.id}`} onClick={onClose}>
                        <p className="text-sm font-semibold text-gray-800 truncate hover:text-[#526500] transition">{product.name}</p>
                      </Link>
                      {product.origin_country === 'DJ' && product.farm && <p className="text-xs text-gray-400">🌱 {product.farm}</p>}
                      <p className="text-sm font-bold text-[#7d9800] mt-0.5">
                        {product.price?.toLocaleString()} Fdj <span className="text-xs font-normal text-gray-400">{product.unit}</span>
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-none">
                      <button
                        onClick={() => { addItem(product); onClose(); }}
                        disabled={(product.stock_qty ?? 0) === 0}
                        className="px-3 py-1.5 bg-[#a8c800] text-white text-xs font-semibold rounded-full hover:bg-[#7d9800] transition disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {(product.stock_qty ?? 0) === 0 ? t('product.out_of_stock', 'Rupture') : '+ Panier'}
                      </button>
                      <button
                        onClick={() => removeFavorite(product.id)}
                        className="text-xs text-gray-300 hover:text-[#f97316] transition"
                      >
                        Retirer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}
