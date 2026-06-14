'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';
import { useLanguage } from '../../context/LanguageContext';
import AdminProducts from '../../components/admin/AdminProducts';
import AdminCategories from '../../components/admin/AdminCategories';
import AdminPromos from '../../components/admin/AdminPromos';
import AdminProducers from '../../components/admin/AdminProducers';
import AdminOrders from '../../components/admin/AdminOrders';
import AdminRequests from '../../components/admin/AdminRequests';
import AdminUsers from '../../components/admin/AdminUsers';
import AdminDelivery from '../../components/admin/AdminDelivery';
import AdminNotifications from '../../components/admin/AdminNotifications';
import AdminBroadcast from '../../components/admin/AdminBroadcast';
import AdminFinances from '../../components/admin/AdminFinances';
import AdminRefunds from '../../components/admin/AdminRefunds';
import AdminPreparers from '../../components/admin/AdminPreparers';
import AdminWallets from '../../components/admin/AdminWallets';
import AdminSubscriptions from '../../components/admin/AdminSubscriptions';
import AdminHomepage from '../../components/admin/AdminHomepage';
import AdminForecast from '../../components/admin/AdminForecast';
import { canAccessAdmin, hasPerm, roleOf } from '../../lib/permissions';
import { AdminPermsProvider } from '../../context/AdminPermsContext';

type Section = 'products' | 'categories' | 'promos' | 'producers' | 'orders' | 'preparers' | 'wallets' | 'subscriptions' | 'forecast' | 'requests' | 'users' | 'delivery' | 'notifications' | 'homepage' | 'announcements' | 'finances' | 'refunds';

export default function AdminPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [activeSection, setActiveSection] = useState<Section | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;

  const meta = user?.user_metadata;
  const NAV_ITEMS: { id: Section; emoji: string; label: string }[] = [
    { id: 'products', emoji: '🥬', label: t('admin.nav_products', 'Produits') },
    { id: 'categories', emoji: '📂', label: t('admin.nav_categories', 'Catégories') },
    { id: 'promos', emoji: '🏷️', label: t('admin.nav_promos', 'Promotions') },
    { id: 'producers', emoji: '👨‍🌾', label: t('admin.nav_producers', 'Producteurs') },
    { id: 'orders', emoji: '📦', label: t('admin.nav_orders', 'Commandes') },
    { id: 'preparers', emoji: '🧑‍🍳', label: t('admin.nav_preparers', 'Préparateurs') },
    { id: 'requests', emoji: '📋', label: t('admin.nav_requests', 'Demandes producteurs') },
    { id: 'wallets', emoji: '💰', label: t('admin.nav_wallets', 'Cagnottes') },
    { id: 'subscriptions', emoji: '🔄', label: t('admin.nav_subscriptions', 'Abonnements') },
    { id: 'forecast', emoji: '🗓️', label: t('admin.nav_forecast', 'Planning abonnements') },
    { id: 'users', emoji: '👥', label: t('admin.nav_users', 'Utilisateurs') },
    { id: 'delivery', emoji: '🚚', label: t('admin.nav_delivery', 'Livraison') },
    { id: 'homepage', emoji: '🏠', label: t('admin.nav_homepage', 'Page d\'accueil') },
    { id: 'notifications', emoji: '🔔', label: t('admin.nav_notifications', 'Notifications') },
    { id: 'announcements', emoji: '📣', label: t('admin.nav_announcements', 'Annonces') },
    { id: 'finances', emoji: '📊', label: t('admin.nav_finances', 'Finances') },
    { id: 'refunds', emoji: '💸', label: t('admin.nav_refunds', 'Remboursements') },
  ];
  // Onglets visibles selon le rôle/droits (admin = tout)
  const visibleNav = NAV_ITEMS.filter(i => hasPerm(meta, i.id, 'view'));

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/login?redirect=/admin';
        return;
      }
      // Métadonnées fraîches (rôle/droits récents définis par l'admin)
      const { data: { user: fresh } } = await supabase.auth.getUser();
      const u = fresh || session.user;
      const meta = u?.user_metadata;
      // Accès : administrateur OU gestionnaire ayant au moins un droit
      if (!canAccessAdmin(meta)) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }
      setUser(u);
      setLoading(false);

      // Unread notifications count + realtime
      const { count } = await supabase
        .from('admin_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('read', false);
      setUnreadCount(count || 0);

      const channel = supabase
        .channel('admin_notifs_badge')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_notifications' },
          () => setUnreadCount(c => c + 1)
        )
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    };
    init();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const renderSection = () => {
    if (!activeSection || !hasPerm(meta, activeSection, 'view')) {
      return <p className="text-center text-gray-400 py-16">{t('admin.no_access', 'Accès non autorisé à ce module.')}</p>;
    }
    switch (activeSection) {
      case 'products': return <AdminProducts />;
      case 'categories': return <AdminCategories />;
      case 'promos': return <AdminPromos />;
      case 'producers': return <AdminProducers />;
      case 'orders': return <AdminOrders />;
      case 'preparers': return <AdminPreparers />;
      case 'requests': return <AdminRequests />;
      case 'wallets': return <AdminWallets />;
    case 'subscriptions': return <AdminSubscriptions />;
    case 'forecast': return <AdminForecast />;
    case 'homepage': return <AdminHomepage />;
      case 'users': return <AdminUsers />;
      case 'delivery': return <AdminDelivery />;
      case 'notifications': return <AdminNotifications />;
      case 'announcements': return <AdminBroadcast />;
      case 'finances': return <AdminFinances />;
      case 'refunds': return <AdminRefunds />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf7e8] flex items-center justify-center">
        <div className="text-center">
          <p className="text-5xl mb-4 animate-pulse">🌿</p>
          <p className="text-gray-400">{t('admin.verifying', 'Vérification des accès...')}</p>
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-[#faf7e8] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="text-5xl mb-4">🔒</p>
          <h1 className="text-xl font-bold text-gray-800 mb-2">{t('admin.access_denied', 'Accès refusé')}</h1>
          <p className="text-gray-400 text-sm mb-6">
            {t('admin.access_denied_msg', "Vous n'avez pas les droits administrateur. Pour obtenir l'accès, définissez")}
            {' '}<code className="bg-[#ecf4d5] px-1 rounded text-[#526500]">is_admin: true</code>{' '}
            {t('admin.access_denied_meta', 'dans vos métadonnées utilisateur via le Dashboard Supabase.')}
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/" className="px-5 py-2.5 border border-[#d2e095] rounded-xl text-sm text-gray-600 hover:bg-white transition">
              ← {t('admin.back_to_site', 'Retour au site')}
            </Link>
            <button onClick={handleSignOut} className="px-5 py-2.5 bg-[#a8c800] text-white rounded-xl text-sm font-semibold hover:bg-[#7d9800] transition">
              {t('admin.logout', 'Se déconnecter')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const role = roleOf(meta);
  const roleLabel = role === 'admin'
    ? t('admin.role_admin', 'Administrateur')
    : t('admin.role_manager', 'Gestionnaire');

  return (
    <div className="min-h-screen bg-[#faf7e8]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

        {/* En-tête */}
        <div className="bg-gradient-to-br from-[#1c3a05] via-[#2d6410] to-[#7a5800] rounded-3xl p-6 text-white shadow-sm mb-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-white/15 ring-2 ring-[#a8c800]/40 flex items-center justify-center text-2xl flex-none">🛠️</div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-bold leading-tight truncate">{t('admin.administration', 'Administration')} · Hornafresh</p>
              <p className="text-xs text-white/60 truncate">{user?.email}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="bg-white/15 text-[#c8e050] text-[11px] font-semibold px-2.5 py-0.5 rounded-full">{roleLabel}</span>
                <Link href="/" onClick={() => { try { sessionStorage.setItem('hf_view_site', '1'); } catch {} }} className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-white/10 text-white/80 hover:bg-white/20 transition">← {t('admin.back_to_site', 'Retour au site')}</Link>
                <button onClick={handleSignOut} className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-white/10 text-white/80 hover:bg-white/20 transition">🚪 {t('admin.logout', 'Se déconnecter')}</button>
              </div>
            </div>
          </div>
        </div>

        {activeSection === null ? (
          /* Accueil : grille de cartes (modules autorisés) */
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 animate-tabfade">
            <Link
              href="/"
              onClick={() => { try { sessionStorage.setItem('hf_view_site', '1'); } catch {} }}
              className="bg-white rounded-2xl p-5 border-2 border-[#d2e095] shadow-sm hover:border-[#a8c800] hover:shadow-md hover:-translate-y-0.5 transition flex flex-col items-center gap-2 text-center"
            >
              <span className="w-12 h-12 rounded-full bg-[#ecf4d5] flex items-center justify-center text-2xl">🌿</span>
              <span className="text-sm font-semibold text-[#526500]">{t('admin.go_home', 'Page d\'accueil')}</span>
            </Link>
            {visibleNav.map(item => (
              <button
                key={item.id}
                onClick={() => { setActiveSection(item.id); if (item.id === 'notifications') setUnreadCount(0); }}
                className="relative bg-white rounded-2xl p-5 border-2 border-[#d2e095] shadow-sm hover:border-[#a8c800] hover:shadow-md hover:-translate-y-0.5 transition flex flex-col items-center gap-2 text-center"
              >
                <span className="w-12 h-12 rounded-full bg-[#ecf4d5] flex items-center justify-center text-2xl">{item.emoji}</span>
                <span className="text-sm font-semibold text-[#526500]">{item.label}</span>
                {item.id === 'notifications' && unreadCount > 0 && (
                  <span className="absolute top-2 right-2 bg-[#f97316] text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">{unreadCount > 99 ? '99+' : unreadCount}</span>
                )}
              </button>
            ))}
          </div>
        ) : (
          <>
            <button
              onClick={() => setActiveSection(null)}
              className="mb-4 inline-flex items-center gap-1.5 bg-white border border-[#d2e095] text-[#526500] text-sm font-semibold px-4 py-2 rounded-full hover:bg-[#ecf4d5] transition shadow-sm"
            >
              ← {t('admin.all_modules', 'Tous les modules')}
            </button>
            <div key={activeSection} className="animate-tabfade">
              <AdminPermsProvider meta={meta}>{renderSection()}</AdminPermsProvider>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
