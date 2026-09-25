'use client';

import { useState, useEffect, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../context/LanguageContext';
import { roleOf } from '../../lib/permissions';

// Identité du marchand transmise aux pages de l'espace
export interface Merchant {
  user_id: string;
  email: string;
  full_name: string;
  farm_name: string;
  region: string;
  subscription: { state: 'active' | 'pending' | 'suspended' | 'expired' | 'none'; ends_at: string | null; days_left: number | null };
}

interface ProducerLayoutProps {
  children: (producer: Merchant) => ReactNode;
}

export default function ProducerLayout({ children }: ProducerLayoutProps) {
  const [producer, setProducer] = useState<Merchant | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = '/login?redirect=' + encodeURIComponent(pathname || '/producer/dashboard'); return; }
      // Métadonnées fraîches (le rôle marchand vient peut-être d'être attribué par l'admin)
      const { data: { user: fresh } } = await supabase.auth.getUser();
      const user = fresh || session.user;
      const meta = user.user_metadata || {};

      // Accès : rôle marchand/producteur OU demande d'adhésion approuvée
      const { data: req } = await supabase
        .from('producer_requests').select('farm_name, region, full_name')
        .eq('email', user.email).eq('status', 'approved').maybeSingle();
      const isMerchant = roleOf(meta) === 'producer' || !!req;
      if (!isMerchant) { setProducer(null); setLoading(false); return; }

      // État de l'abonnement (RLS : le marchand lit ses propres lignes) + enseigne (merchant_profiles, gérée par l'admin)
      const today = new Date().toISOString().slice(0, 10);
      const [{ data: subs }, { data: profile }] = await Promise.all([
        supabase.from('merchant_subscriptions').select('status, ends_at, created_at')
          .eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('merchant_profiles').select('shop_name').eq('user_id', user.id).maybeSingle(),
      ]);
      const active = (subs || []).find(s => s.status === 'active' && s.ends_at >= today) || null;
      const pending = (subs || []).find(s => s.status === 'pending_payment') || null;
      const last = (subs || [])[0] || null;
      const hadPeriod = (subs || []).some(s => s.status === 'active' || s.status === 'expired');
      const state = active ? 'active' : pending ? 'pending' : last?.status === 'suspended' ? 'suspended' : hadPeriod ? 'expired' : 'none';
      const days_left = active ? Math.ceil((new Date(active.ends_at + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86400000) : null;

      setProducer({
        user_id: user.id,
        email: user.email || '',
        full_name: meta.full_name || req?.full_name || user.email || '',
        farm_name: profile?.shop_name || req?.farm_name || meta.shop_name || meta.full_name || t('producer.default_shop', 'Ma boutique'),
        region: req?.region || '',
        subscription: { state, ends_at: active?.ends_at || null, days_left },
      });
      setLoading(false);
    };
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const navItems = [
    { href: '/producer/dashboard', emoji: '📊', label: t('producer.nav_dashboard', 'Tableau de bord') },
    { href: '/producer/products',  emoji: '🥬', label: t('producer.nav_products',  'Mes produits') },
    { href: '/producer/orders',    emoji: '📦', label: t('producer.nav_orders',    'Mes commandes') },
    { href: '/producer/promotions',   emoji: '🏷️', label: t('producer.nav_promotions', 'Mes promotions') },
    { href: '/producer/statement',    emoji: '💸', label: t('producer.nav_statement', 'Mes reversements') },
    { href: '/producer/subscription', emoji: '💳', label: t('producer.nav_subscription', 'Mon abonnement') },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf7e8] flex items-center justify-center">
        <div className="text-center"><p className="text-5xl mb-4 opacity-40">🌱</p><p className="text-gray-400">{t('producer.loading', 'Chargement...')}</p></div>
      </div>
    );
  }

  if (!producer) {
    return (
      <div className="min-h-screen bg-[#faf7e8] flex flex-col items-center justify-center px-6">
        <div className="text-center max-w-md">
          <p className="text-6xl mb-4">🚫</p>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">{t('producer.access_denied', 'Accès réservé aux marchands')}</h1>
          <p className="text-gray-400 mb-6">{t('producer.access_denied_msg', 'Cet espace est réservé aux marchands et producteurs approuvés par Hornafresh.')}</p>
          <div className="flex flex-col items-center gap-3">
            <Link href="/become-producer" className="bg-[#a8c800] text-white px-6 py-3 rounded-full font-semibold hover:bg-[#7d9800] transition">🏪 {t('producer.become_cta', 'Devenir marchand')}</Link>
            <Link href="/" className="text-sm text-gray-400 hover:text-[#7d9800]">← {t('producer.back_home', "Retour à l'accueil")}</Link>
          </div>
        </div>
      </div>
    );
  }

  const sub = producer.subscription;
  const dateFr = (d: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const banner =
    sub.state === 'active' && sub.days_left != null && sub.days_left <= 7
      ? { cls: 'bg-amber-50 border-amber-200 text-amber-800', text: `⏳ ${t('producer.sub_expiring', 'Votre abonnement expire le')} ${dateFr(sub.ends_at)} (${sub.days_left} j). ${t('producer.sub_renew_hint', 'Pensez à le renouveler pour garder vos produits visibles.')}` }
    : sub.state === 'active'
      ? { cls: 'bg-green-50 border-green-200 text-green-800', text: `✅ ${t('producer.sub_active', 'Abonnement actif jusqu\'au')} ${dateFr(sub.ends_at)}` }
    : sub.state === 'pending'
      ? { cls: 'bg-amber-50 border-amber-200 text-amber-800', text: `⏳ ${t('producer.sub_pending', 'Paiement en attente de confirmation par Hornafresh.')}` }
    : sub.state === 'suspended'
      ? { cls: 'bg-red-50 border-red-200 text-red-700', text: `⏸️ ${t('producer.sub_suspended', 'Abonnement suspendu — vos produits ne sont pas visibles. Contactez-nous au 77 43 26 15.')}` }
      : { cls: 'bg-red-50 border-red-200 text-red-700', text: `🔒 ${t('producer.sub_none', 'Aucun abonnement actif — vos produits ne sont pas visibles sur le site. Activez votre abonnement pour les rendre visibles.')}` };
  // Lien d'action vers « Mon abonnement » dès que l'abonnement n'est pas simplement actif (sauf sur la page elle-même)
  const bannerLink = pathname !== '/producer/subscription' && sub.state !== 'active'
    ? { href: '/producer/subscription', label: sub.state === 'pending' ? t('producer.sub_link_view', 'Voir ma demande') : sub.state === 'expired' ? t('producer.sub_link_renew', 'Renouveler') : t('producer.sub_link_activate', 'Activer mon abonnement') }
    : pathname !== '/producer/subscription' && sub.state === 'active' && sub.days_left != null && sub.days_left <= 7
      ? { href: '/producer/subscription', label: t('producer.sub_link_renew', 'Renouveler') }
      : null;

  return (
    <div className="min-h-screen bg-[#faf7e8]">
      <header className="bg-white border-b border-[#d2e095] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="text-3xl">🌿</span>
            <div>
              <h1 className="text-xl font-bold text-[#526500]">Hornafresh</h1>
              <p className="text-xs text-[#a8c800] font-semibold">{t('producer.space_label', 'Espace Marchand')}</p>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <div className="text-right hidden md:block">
              <p className="text-sm font-semibold text-gray-700">{producer.full_name}</p>
              <p className="text-xs text-[#7d9800]">🏪 {producer.farm_name}</p>
            </div>
            <Link href="/" className="text-sm text-gray-400 hover:text-[#7d9800] transition border border-[#d2e095] px-3 py-1.5 rounded-full">← {t('producer.back_site', 'Site')}</Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-6 pt-4">
        <div className={`rounded-2xl border px-4 py-3 text-sm flex flex-wrap items-center gap-x-4 gap-y-2 ${banner.cls}`}>
          <span className="flex-1 min-w-0">{banner.text}</span>
          {bannerLink && (
            <Link href={bannerLink.href} className="flex-none text-xs font-semibold bg-[#a8c800] text-white rounded-full px-3 py-1.5 hover:bg-[#7d9800] transition">
              💳 {bannerLink.label} →
            </Link>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-6 flex flex-col md:flex-row gap-4 md:gap-6">
        <aside className="md:w-52 md:flex-shrink-0">
          <div className="bg-white rounded-2xl border border-[#d2e095] p-3 mb-0 md:mb-4">
            {/* Mobile : grille 3 colonnes (tous les onglets visibles d'un coup) ; desktop : liste verticale */}
            <nav className="grid grid-cols-3 gap-1 md:flex md:flex-col md:space-y-1">
              {navItems.map(item => (
                <Link key={item.href} href={item.href}
                  className={`flex flex-col md:flex-row items-center gap-0.5 md:gap-3 px-1 md:px-3 py-2 md:py-2.5 rounded-xl text-[11px] md:text-sm font-medium text-center md:text-left leading-tight transition ${pathname === item.href ? 'bg-[#a8c800] text-white shadow-sm' : 'text-gray-600 hover:bg-[#ecf4d5] hover:text-[#526500]'}`}>
                  <span className="text-lg md:text-base">{item.emoji}</span><span>{item.label}</span>
                </Link>
              ))}
            </nav>
          </div>
          <div className="hidden md:block bg-[#ecf4d5] rounded-2xl p-4 text-center border border-[#d2e095]">
            <p className="text-3xl mb-2">🏪</p>
            <p className="text-xs font-bold text-[#526500]">{producer.farm_name}</p>
            {producer.region && <p className="text-xs text-gray-400 mt-1">📍 {producer.region}</p>}
          </div>
        </aside>
        <main className="flex-1 min-w-0">{children(producer)}</main>
      </div>
    </div>
  );
}
