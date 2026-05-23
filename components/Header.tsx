'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';
import { useCart } from '../context/CartContext';
import { useFavorites } from '../context/FavoritesContext';
import LanguageSelector from './LanguageSelector';

export default function Header({ onCartOpen }: { onCartOpen: () => void }) {
  const [user, setUser] = useState<any>(null);
  const { ui } = useLanguage();
  const { count } = useCart();
  const { count: favCount } = useFavorites();
  const t = (key: string, fallback: string) => ui[key] || fallback;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <header className="bg-white border-b border-[#dde8b0] sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <span className="text-3xl">🌿</span>
          <div>
            <h1 className="text-xl font-bold text-[#526500]">Racine Bio</h1>
            <p className="text-xs text-gray-400">{t('footer', 'Le marché bio de Djibouti')}</p>
          </div>
        </Link>
        <nav className="hidden md:flex items-center gap-8">
          <a href="/#produits" className="text-sm font-medium text-gray-600 hover:text-[#7d9800]">{t('products', 'Produits')}</a>
          <a href="/#producteurs" className="text-sm font-medium text-gray-600 hover:text-[#7d9800]">{t('producers', 'Producteurs')}</a>
          <a href="/#promos" className="text-sm font-medium text-gray-600 hover:text-[#7d9800]">{t('promos', 'Promos')}</a>
        </nav>
        <div className="flex items-center gap-3">
          <LanguageSelector />

          {/* Favoris */}
          <Link href="/favorites" className="relative p-2" title={t('favorites', 'Mes favoris')}>
            <span className="text-2xl">❤️</span>
            {favCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                {favCount > 9 ? '9+' : favCount}
              </span>
            )}
          </Link>

          {user ? (
            <div className="flex items-center gap-2">
              {user.user_metadata?.is_admin && (
                <Link href="/admin" className="hidden md:flex items-center gap-1.5 bg-[#3a4800] text-[#c5d87a] px-3 py-2 rounded-full text-xs font-semibold hover:bg-[#526500] transition">
                  <span>⚙️</span> Admin
                </Link>
              )}
              <Link href="/profile" className="flex items-center gap-2 bg-[#f0f7e8] border border-[#dde8b0] px-3 py-2 rounded-full text-sm font-medium text-[#526500] hover:bg-[#dde8b0] transition">
                <span>👤</span>
                <span className="hidden md:block">{user.user_metadata?.full_name || user.email?.split('@')[0]}</span>
              </Link>
            </div>
          ) : (
            <>
              <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-[#7d9800] transition hidden md:block">
                {t('login', 'Se connecter')}
              </Link>
              <Link href="/login" className="hidden md:block bg-[#a8c800] text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-[#7d9800] transition">
                {t('register', "S'inscrire")}
              </Link>
            </>
          )}

          {/* Panier */}
          <button onClick={onCartOpen} className="relative p-2">
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
  );
}
