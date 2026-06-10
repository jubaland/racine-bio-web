'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';
import { canAccessAdmin } from '../lib/permissions';
import { useCart } from '../context/CartContext';
import { useFavorites } from '../context/FavoritesContext';
import LanguageSelector from './LanguageSelector';
import FavoritesDrawer from './FavoritesDrawer';
import NotificationBell from './NotificationBell';

export default function Header({ onCartOpen }: { onCartOpen: () => void }) {
  const [user, setUser] = useState<any>(null);
  const [favOpen, setFavOpen] = useState(false);
  const { ui } = useLanguage();
  const { count } = useCart();
  const { count: favCount } = useFavorites();
  const t = (key: string, fallback: string) => ui[key] || fallback;
  const router = useRouter();
  const pathname = usePathname();
  const showBack = pathname !== '/';
  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.push('/');
  };

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

        {/* Retour + Logo */}
        <div className="flex items-center gap-2 min-w-0">
          {showBack && (
            <button
              onClick={goBack}
              aria-label={t('nav.back', 'Retour')}
              className="flex-none flex items-center justify-center gap-1.5 rounded-full bg-[#ecf4d5] text-[#526500] border border-[#d2e095] hover:bg-[#d2e095] transition w-10 h-10 sm:w-auto sm:h-auto sm:px-3.5 sm:py-2"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 flex-none" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              <span className="hidden sm:inline text-sm font-semibold">{t('nav.back', 'Retour')}</span>
            </button>
          )}
          {!showBack && (
            <Link href="/" className="flex items-center gap-2 min-w-0">
              <span className="text-3xl">🌿</span>
              <div className="hidden md:block">
                <h1 className="text-xl font-bold text-[#526500] leading-tight">Hornafresh</h1>
                <p className="text-xs text-gray-400">{t('footer', 'Le marché premium, frais, bio, local et régional de Djibouti')}</p>
              </div>
            </Link>
          )}
        </div>

        {/* Boutons — tous en ligne */}
        <div className="flex items-center gap-1.5 md:gap-3 flex-none shrink-0">
          <LanguageSelector />

          {/* Admin / Gestionnaire */}
          {canAccessAdmin(user?.user_metadata) && (
            <Link href="/admin" className="flex items-center justify-center w-9 h-9 md:w-auto md:h-auto md:px-3 md:py-2 rounded-full bg-[#3a4800] text-[#c5d87a] md:gap-1.5 hover:bg-[#526500] transition">
              <span>⚙️</span>
              <span className="hidden md:block text-xs font-semibold">Admin</span>
            </Link>
          )}

          {/* Centre de notifications (connecté uniquement) */}
          {user && <NotificationBell userId={user.id} />}

          {/* Profil / Connexion — état visuellement distinct */}
          {user ? (
            (() => {
              const name = user.user_metadata?.full_name || user.email?.split('@')[0] || '';
              const initial = (name.trim().charAt(0) || '?').toUpperCase();
              return (
                <Link href="/profile" title={name} className="flex items-center gap-2">
                  <span className="relative w-9 h-9 rounded-full bg-gradient-to-br from-[#526500] to-[#7d9800] text-white flex items-center justify-center font-bold text-sm shadow-sm ring-2 ring-[#a8c800]/40">
                    {initial}
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#22c55e] border-2 border-white rounded-full" title={t('account.online', 'Connecté')} />
                  </span>
                  <span className="hidden md:block text-sm font-medium text-[#526500] max-w-[140px] truncate">{name}</span>
                </Link>
              );
            })()
          ) : (
            <>
              <Link href="/login" className="hidden md:block text-sm font-medium text-gray-600 hover:text-[#7d9800] transition">
                {t('login', 'Se connecter')}
              </Link>
              <Link href="/login" className="hidden md:block bg-[#a8c800] text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-[#7d9800] transition">
                {t('register', "S'inscrire")}
              </Link>
              {/* Mobile : bouton « se connecter » neutre, distinct de l'état connecté */}
              <Link href="/login" title={t('login', 'Se connecter')} className="md:hidden flex items-center justify-center w-9 h-9 rounded-full bg-white border border-gray-300 text-gray-400 hover:border-[#a8c800] hover:text-[#7d9800] transition">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
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
