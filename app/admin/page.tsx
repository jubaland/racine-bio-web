'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';
import { useLanguage } from '../../context/LanguageContext';
import AdminDashboard from '../../components/admin/AdminDashboard';
import AdminProducts from '../../components/admin/AdminProducts';
import AdminCategories from '../../components/admin/AdminCategories';
import AdminPromos from '../../components/admin/AdminPromos';
import AdminProducers from '../../components/admin/AdminProducers';
import AdminOrders from '../../components/admin/AdminOrders';
import AdminRequests from '../../components/admin/AdminRequests';
import AdminUsers from '../../components/admin/AdminUsers';
import AdminDelivery from '../../components/admin/AdminDelivery';
import AdminNotifications from '../../components/admin/AdminNotifications';
import AdminPreparers from '../../components/admin/AdminPreparers';
import AdminWallets from '../../components/admin/AdminWallets';
import AdminSubscriptions from '../../components/admin/AdminSubscriptions';
import AdminHomepage from '../../components/admin/AdminHomepage';
import AdminForecast from '../../components/admin/AdminForecast';
import { canAccessAdmin, hasPerm } from '../../lib/permissions';

type Section = 'dashboard' | 'products' | 'categories' | 'promos' | 'producers' | 'orders' | 'preparers' | 'wallets' | 'subscriptions' | 'forecast' | 'requests' | 'users' | 'delivery' | 'notifications' | 'homepage';

const SECTION_ORDER: Section[] = ['dashboard', 'products', 'categories', 'promos', 'producers', 'orders', 'preparers', 'requests', 'wallets', 'subscriptions', 'forecast', 'users', 'delivery', 'homepage', 'notifications'];

export default function AdminPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [activeSection, setActiveSection] = useState<Section>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;

  const meta = user?.user_metadata;
  const NAV_ITEMS: { id: Section; emoji: string; label: string }[] = [
    { id: 'dashboard', emoji: '📊', label: t('admin.nav_dashboard', 'Tableau de bord') },
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
      // Onglet initial = premier module autorisé
      const first = SECTION_ORDER.find(s => hasPerm(meta, s, 'view'));
      if (first) setActiveSection(first);
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
    if (!hasPerm(meta, activeSection, 'view')) {
      return <p className="text-center text-gray-400 py-16">{t('admin.no_access', 'Accès non autorisé à ce module.')}</p>;
    }
    switch (activeSection) {
      case 'dashboard': return <AdminDashboard />;
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

  const currentNav = NAV_ITEMS.find(i => i.id === activeSection);

  return (
    <div className="min-h-screen bg-[#eef3e0] flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:sticky top-0 h-screen w-64 bg-[#3a4800] text-white flex flex-col z-30 transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="p-5 border-b border-[#526500]">
          <Link href="/" className="flex items-center gap-3 group">
            <span className="text-3xl">🌿</span>
            <div>
              <p className="font-bold text-white group-hover:text-[#c5d87a] transition">Hornafresh</p>
              <p className="text-[#8aaa00] text-xs font-medium tracking-wider uppercase">
                {t('admin.administration', 'Administration')}
              </p>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {visibleNav.map(item => (
            <button
              key={item.id}
              onClick={() => {
                setActiveSection(item.id);
                setSidebarOpen(false);
                if (item.id === 'notifications') setUnreadCount(0);
              }}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition
                ${activeSection === item.id
                  ? 'bg-[#a8c800] text-white shadow-sm'
                  : 'text-[#9ab800] hover:bg-[#526500] hover:text-white'}
              `}
            >
              <span className="text-lg w-6 text-center">{item.emoji}</span>
              <span className="flex-1 text-left">{item.label}</span>
              {item.id === 'notifications' && unreadCount > 0 && (
                <span className="bg-[#f97316] text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* User info + actions */}
        <div className="p-3 border-t border-[#526500] space-y-1">
          <div className="px-3 py-2">
            <p className="text-xs text-[#9ab800] truncate">{user?.email}</p>
            <span className="text-xs bg-[#a8c800]/20 text-[#c5d87a] px-2 py-0.5 rounded-full mt-1 inline-block">Admin</span>
          </div>
          <Link
            href="/"
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-[#9ab800] hover:bg-[#526500] hover:text-white transition"
          >
            <span>←</span> {t('admin.back_to_site', 'Retour au site')}
          </Link>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-[#9ab800] hover:bg-orange-900/30 hover:text-orange-300 transition"
          >
            <span>🚪</span> {t('admin.logout', 'Se déconnecter')}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Mobile topbar */}
        <header className="lg:hidden sticky top-0 z-10 bg-white border-b border-[#d2e095] px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-8 h-8 flex flex-col items-center justify-center gap-1.5 text-[#526500]"
            aria-label="Menu"
          >
            <span className="w-5 h-0.5 bg-current rounded" />
            <span className="w-5 h-0.5 bg-current rounded" />
            <span className="w-5 h-0.5 bg-current rounded" />
          </button>
          <span className="font-semibold text-[#526500]">
            {currentNav?.emoji} {currentNav?.label}
          </span>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {renderSection()}
        </main>
      </div>
    </div>
  );
}
