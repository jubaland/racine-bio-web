'use client';

import { useState, useEffect, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../context/LanguageContext';

interface ProducerRequest {
  id: string;
  full_name: string;
  email: string;
  farm_name: string;
  region: string;
  products_description: string;
  status: string;
}

interface ProducerLayoutProps {
  children: (producer: ProducerRequest) => ReactNode;
}

export default function ProducerLayout({ children }: ProducerLayoutProps) {
  const [producer, setProducer] = useState<ProducerRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/login';
        return;
      }
      const { data } = await supabase
        .from('producer_requests')
        .select('*')
        .eq('email', session.user.email)
        .eq('status', 'approved')
        .maybeSingle();
      setProducer(data || null);
      setLoading(false);
    };
    check();
  }, []);

  const navItems = [
    { href: '/producer/dashboard', emoji: '📊', label: t('producer.nav_dashboard', 'Tableau de bord') },
    { href: '/producer/products',  emoji: '🥬', label: t('producer.nav_products',  'Mes produits') },
    { href: '/producer/orders',    emoji: '📦', label: t('producer.nav_orders',    'Mes commandes') },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf7e8] flex items-center justify-center">
        <div className="text-center">
          <p className="text-5xl mb-4 opacity-40">🌱</p>
          <p className="text-gray-400">{t('producer.loading', 'Chargement...')}</p>
        </div>
      </div>
    );
  }

  if (!producer) {
    return (
      <div className="min-h-screen bg-[#faf7e8] flex flex-col items-center justify-center px-6">
        <div className="text-center max-w-md">
          <p className="text-6xl mb-4">🚫</p>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            {t('producer.access_denied', 'Accès réservé aux producteurs')}
          </h1>
          <p className="text-gray-400 mb-6">
            {t('producer.access_denied_msg', 'Cet espace est réservé aux producteurs approuvés par Hornafresh.')}
          </p>
          <div className="flex flex-col items-center gap-3">
            <Link
              href="/become-producer"
              className="bg-[#a8c800] text-white px-6 py-3 rounded-full font-semibold hover:bg-[#7d9800] transition"
            >
              👨‍🌾 {t('producer.become_cta', 'Devenir producteur')}
            </Link>
            <Link href="/" className="text-sm text-gray-400 hover:text-[#7d9800]">
              ← {t('producer.back_home', "Retour à l'accueil")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf7e8]">
      <header className="bg-white border-b border-[#d2e095] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="text-3xl">🌿</span>
            <div>
              <h1 className="text-xl font-bold text-[#526500]">Hornafresh</h1>
              <p className="text-xs text-[#a8c800] font-semibold">
                {t('producer.space_label', 'Espace Producteur')}
              </p>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <div className="text-right hidden md:block">
              <p className="text-sm font-semibold text-gray-700">{producer.full_name}</p>
              <p className="text-xs text-[#7d9800]">🌱 {producer.farm_name}</p>
            </div>
            <Link href="/" className="text-sm text-gray-400 hover:text-[#7d9800] transition border border-[#d2e095] px-3 py-1.5 rounded-full">
              ← {t('producer.back_site', 'Site')}
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-8 flex flex-col md:flex-row gap-4 md:gap-6">
        <aside className="md:w-52 md:flex-shrink-0">
          <div className="bg-white rounded-2xl border border-[#d2e095] p-3 mb-0 md:mb-4">
            <nav className="flex md:flex-col gap-1 md:space-y-1 overflow-x-auto">
              {navItems.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 md:gap-3 px-3 py-2 md:py-2.5 rounded-xl text-sm font-medium transition whitespace-nowrap flex-shrink-0 ${
                    pathname === item.href
                      ? 'bg-[#a8c800] text-white shadow-sm'
                      : 'text-gray-600 hover:bg-[#ecf4d5] hover:text-[#526500]'
                  }`}
                >
                  <span>{item.emoji}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
          </div>
          <div className="hidden md:block bg-[#ecf4d5] rounded-2xl p-4 text-center border border-[#d2e095]">
            <p className="text-3xl mb-2">👨‍🌾</p>
            <p className="text-xs font-bold text-[#526500]">{producer.farm_name}</p>
            {producer.region && (
              <p className="text-xs text-gray-400 mt-1">📍 {producer.region}</p>
            )}
          </div>
        </aside>

        <main className="flex-1 min-w-0">
          {children(producer)}
        </main>
      </div>
    </div>
  );
}
