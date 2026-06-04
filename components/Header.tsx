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
  const [menuOpen, setMenuOpen] = useState(false);
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
        <Link href="/" className="flex items-center gap-3">
          <span className="text-3xl">🌿</span>
          <div>
            <h1 className="text-xl font-bold text-[#526500]">Hornafresh</h1>
            <p className="text-xs text-gray-400 hidden md:block">{t('footer', 'Le marché premium, frais, bio, local et régional de Djibouti')}</p>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          {/* Hamburger mobile */}
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="md:hidden flex items-center justify-center w-9 h-9 rounded-full bg-[#ecf4d5] border border-[#d2e095] text-[#526500] hover:bg-[#d2e095] transition"
            aria-label="Menu"
          >
            <span className="text-lg">{menuOpen ? '✕' : '☰'}</span>
          </button>
          <LanguageSelector />

          {user ? (
            <div className="flex items-center gap-2">
              {user.user_metadata?.is_admin && (
                <Link href="/admin" className="flex items-center gap-1.5 bg-[#3a4800] text-[#c5d87a] px-3 py-2 rounded-full text-xs font-semibold hover:bg-[#526500] transition">
                  <span>⚙️</span><span className="hidden md:block">Admin</span>
                </Link>
              )}
              <Link href="/profile" className="flex items-center gap-2 bg-[#ecf4d5] border border-[#d2e095] px-3 py-2 rounded-full text-sm font-medium text-[#526500] hover:bg-[#d2e095] transition">
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
              {/* Icône login visible sur mobile */}
              <Link href="/login" className="md:hidden flex items-center justify-center w-9 h-9 rounded-full bg-[#ecf4d5] border border-[#d2e095] text-[#526500] hover:bg-[#d2e095] transition" title={t('login', 'Se connecter')}>
                <span className="text-lg">👤</span>
              </Link>
            </>
          )}

          {/* Favoris */}
          <button onClick={() => setFavOpen(true)} className="relative p-2 flex items-center justify-center" title={t('nav.favorites', 'Mes favoris')}>
            <svg
              viewBox="0 0 24 24"
              className="w-6 h-6 transition-all duration-200"
              fill={favCount > 0 ? '#f97316' : 'none'}
              stroke={favCount > 0 ? '#f97316' : '#9ca3af'}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            {favCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#f97316] text-white text-xs w-4.5 h-4.5 min-w-[18px] min-h-[18px] rounded-full flex items-center justify-center font-bold leading-none px-0.5">
                {favCount > 9 ? '9+' : favCount}
              </span>
            )}
          </button>

          {/* Panier */}
          <button onClick={onCartOpen} className="relative p-2">
            <span className="text-2xl">🛒</span>
            {count > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#f97316] text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                {count > 9 ? '9+' : count}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Menu mobile déroulant */}
      {menuOpen && (
        <div className="md:hidden border-t border-[#d2e095] bg-white px-4 py-3 flex flex-col gap-1">
          <button
            onClick={() => { setFavOpen(true); setMenuOpen(false); }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-[#fff3e8] hover:text-[#f97316] transition w-full text-left"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 flex-none" fill={favCount > 0 ? '#f97316' : 'none'} stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            <span>{t('nav.favorites', 'Mes favoris')}</span>
            {favCount > 0 && <span className="ml-auto bg-[#f97316] text-white text-xs px-2 py-0.5 rounded-full font-bold">{favCount}</span>}
          </button>
          {!user && (
            <Link href="/login" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-[#ecf4d5] hover:text-[#526500] transition">
              👤 {t('login', 'Se connecter')}
            </Link>
          )}
        </div>
      )}
    </header>
    </>
  );
}
