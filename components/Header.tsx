'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';
import { useCart } from '../context/CartContext';
import { useFavorites } from '../context/FavoritesContext';
import LanguageSelector from './LanguageSelector';
import FavoritesDrawer from './FavoritesDrawer';

export default function Header({ onCartOpen }: { onCartOpen: () => void }) {
  const [user, setUser] = useState<any>(null);
  const [favOpen, setFavOpen] = useState(false);
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
    <>
    <FavoritesDrawer open={favOpen} onClose={() => setFavOpen(false)} />
    <header className="bg-white border-b border-[#d2e095] sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 flex-none">
          <span className="text-3xl">🌿</span>
          <div className="hidden md:block">
            <h1 className="text-xl font-bold text-[#526500] leading-tight">Hornafresh</h1>
            <p className="text-xs text-gray-400">{t('footer', 'Le marché premium, frais, bio, local et régional de Djibouti')}</p>
          </div>
        </Link>

        {/* Boutons — tous en ligne */}
        <div className="flex items-center gap-1.5 md:gap-3">
          <LanguageSelector />

          {/* Admin */}
          {user?.user_metadata?.is_admin && (
            <Link href="/admin" className="flex items-center justify-center w-9 h-9 md:w-auto md:h-auto md:px-3 md:py-2 rounded-full bg-[#3a4800] text-[#c5d87a] md:gap-1.5 hover:bg-[#526500] transition">
              <span>⚙️</span>
              <span className="hidden md:block text-xs font-semibold">Admin</span>
            </Link>
          )}

          {/* Profil / Connexion */}
          {user ? (
            <Link href="/profile" className="flex items-center justify-center w-9 h-9 md:w-auto md:h-auto md:px-3 md:py-2 rounded-full bg-[#ecf4d5] border border-[#d2e095] text-[#526500] hover:bg-[#d2e095] transition">
              <span>👤</span>
              <span className="hidden md:block text-sm font-medium ml-1.5">{user.user_metadata?.full_name || user.email?.split('@')[0]}</span>
            </Link>
          ) : (
            <>
              <Link href="/login" className="hidden md:block text-sm font-medium text-gray-600 hover:text-[#7d9800] transition">
                {t('login', 'Se connecter')}
              </Link>
              <Link href="/login" className="hidden md:block bg-[#a8c800] text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-[#7d9800] transition">
                {t('register', "S'inscrire")}
              </Link>
              <Link href="/login" className="md:hidden flex items-center justify-center w-9 h-9 rounded-full bg-[#ecf4d5] border border-[#d2e095] text-[#526500] hover:bg-[#d2e095] transition">
                <span>👤</span>
              </Link>
            </>
          )}

          {/* Favoris */}
          <button onClick={() => setFavOpen(true)} className="relative flex items-center justify-center w-9 h-9" title={t('nav.favorites', 'Mes favoris')}>
            <svg viewBox="0 0 24 24" className="w-6 h-6"
              fill={favCount > 0 ? '#f97316' : 'none'}
              stroke={favCount > 0 ? '#f97316' : '#9ca3af'}
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            {favCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#f97316] text-white text-xs min-w-[18px] min-h-[18px] rounded-full flex items-center justify-center font-bold leading-none px-0.5">
                {favCount > 9 ? '9+' : favCount}
              </span>
            )}
          </button>

          {/* Panier */}
          <button onClick={onCartOpen} className="relative flex items-center justify-center w-9 h-9">
            <span className="text-2xl">🛒</span>
            {count > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#f97316] text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                {count > 9 ? '9+' : count}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
    </>
  );
}
