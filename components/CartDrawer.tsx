'use client';

import { useCart } from '../context/CartContext';
import { useLanguage } from '../context/LanguageContext';

export default function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { items, removeItem, updateQuantity, total, clearCart } = useCart();
  const { ui } = useLanguage();
  const t = (key: string, fallback: string) => ui[key] || fallback;

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      )}
      <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-white z-50 shadow-2xl transform transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#dde8b0]">
            <h2 className="text-lg font-semibold text-gray-800">🛒 {t('cart', 'Panier')}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <p className="text-6xl mb-4 opacity-20">🛒</p>
                <p className="text-gray-400 text-lg">Votre panier est vide</p>
                <button onClick={onClose} className="mt-6 text-sm text-[#7d9800] hover:underline">
                  Continuer mes achats
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map(item => (
                  <div key={item.id} className="flex items-center gap-4 bg-[#f8faf0] rounded-2xl p-3">
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#f0f7e8] flex-none">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl opacity-30">📷</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{item.name}</p>
                      <p className="text-xs text-gray-400">🌱 {item.farm}</p>
                      <p className="text-sm font-bold text-[#7d9800] mt-1">{item.price.toLocaleString()} Fdj <span className="text-xs font-normal text-gray-400">{item.unit}</span></p>
                    </div>
                    <div className="flex items-center gap-2 flex-none">
                      <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-7 h-7 rounded-full bg-white border border-[#dde8b0] flex items-center justify-center text-gray-600 hover:bg-[#f0f7e8] transition">−</button>
                      <span className="text-sm font-semibold w-5 text-center">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-7 h-7 rounded-full bg-[#a8c800] flex items-center justify-center text-white hover:bg-[#7d9800] transition">+</button>
                    </div>
                    <button onClick={() => removeItem(item.id)} className="text-gray-300 hover:text-red-400 transition flex-none">🗑</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {items.length > 0 && (
            <div className="px-6 py-4 border-t border-[#dde8b0] bg-white">
              <div className="flex items-center justify-between mb-4">
                <span className="text-gray-600 font-medium">Total</span>
                <span className="text-xl font-bold text-[#526500]">{total.toLocaleString()} Fdj</span>
              </div>
              <button className="w-full bg-[#a8c800] text-white py-4 rounded-2xl font-semibold text-lg hover:bg-[#7d9800] transition mb-3">
                ✅ Commander
              </button>
              <button onClick={clearCart} className="w-full text-sm text-gray-400 hover:text-red-400 transition">
                🗑 Vider le panier
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}