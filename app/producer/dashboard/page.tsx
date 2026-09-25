'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import { useLanguage } from '../../../context/LanguageContext';
import ProducerLayout from '../../../components/producer/ProducerLayout';

// Tableau de bord marchand — données via /api/producer/orders (service role, périmètre = ses produits)

function DashboardContent({ producer }: { producer: any }) {
  const [stats, setStats] = useState({ products: 0, published: 0, orders: 0, revenue: 0, delivered_revenue: 0 });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;

  useEffect(() => {
    const load = async () => {
      try {
        let { data: { session } } = await supabase.auth.getSession();
        if (!session || (session.expires_at && session.expires_at * 1000 < Date.now() + 60000)) session = (await supabase.auth.refreshSession()).data.session;
        const res = await fetch('/api/producer/orders?limit=5', { headers: { Authorization: `Bearer ${session?.access_token}` } });
        const j = await res.json();
        if (res.ok) { setStats(j.stats); setRecentOrders(j.orders || []); }
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, [producer.user_id]);

  const statusInfo = (s: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      pending:    { label: t('admin.status_pending',    '⏳ En attente'), cls: 'bg-yellow-100 text-yellow-700' },
      processing: { label: t('admin.status_processing', '🚚 En cours'),   cls: 'bg-blue-100 text-blue-700' },
      delivered:  { label: t('admin.status_delivered',  '✅ Livré'),       cls: 'bg-green-100 text-green-700' },
      cancelled:  { label: t('admin.status_cancelled',  '❌ Annulé'),      cls: 'bg-red-100 text-red-600' },
    };
    return map[s] || { label: s, cls: 'bg-gray-100 text-gray-600' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-gray-400">{t('producer.loading', 'Chargement...')}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">
          📊 {t('producer.nav_dashboard', 'Tableau de bord')}
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          {t('producer.welcome', 'Bienvenue')}, {producer.full_name}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 md:gap-4 mb-6">
        {[
          {
            emoji: '🥬',
            label: t('producer.stat_products', 'Mes produits'),
            value: stats.products,
            sub: `${stats.published} ${t('mer.published', 'publiés')}`,
            link: '/producer/products',
            color: 'text-[#526500]',
          },
          {
            emoji: '📦',
            label: t('producer.stat_orders', 'Commandes reçues'),
            value: stats.orders,
            sub: null,
            link: '/producer/orders',
            color: 'text-blue-600',
          },
          {
            emoji: '💰',
            label: t('producer.stat_revenue', 'Revenus totaux'),
            value: `${stats.revenue.toLocaleString()} Fdj`,
            sub: `${stats.delivered_revenue.toLocaleString()} Fdj ${t('producer.stat_delivered', 'livrés')}`,
            link: null,
            color: 'text-[#526500]',
          },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-2xl p-3 md:p-6 border border-[#d2e095] text-center hover:shadow-md transition">
            <p className="text-2xl md:text-3xl mb-1 md:mb-2">{stat.emoji}</p>
            <p className={`text-lg md:text-2xl font-bold ${stat.color} truncate`}>{stat.value}</p>
            <p className="text-xs md:text-sm text-gray-400 mt-0.5 md:mt-1 leading-tight">{stat.label}</p>
            {stat.sub && <p className="text-[11px] text-gray-400 mt-0.5 hidden sm:block">{stat.sub}</p>}
            {stat.link && (
              <Link href={stat.link} className="text-xs text-[#7d9800] hover:underline mt-1 md:mt-2 inline-block">
                {t('producer.see_all', 'Voir tout')} →
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 mb-6">
        <Link
          href="/producer/products"
          className="bg-[#a8c800] text-white rounded-2xl p-3 md:p-5 flex items-center gap-2 md:gap-4 hover:bg-[#7d9800] transition"
        >
          <span className="text-2xl md:text-3xl flex-none">🥬</span>
          <div className="min-w-0">
            <p className="font-semibold text-sm md:text-base leading-tight">{t('producer.add_product', 'Ajouter un produit')}</p>
            <p className="text-xs md:text-sm text-white/80 mt-0.5 hidden sm:block">{t('producer.add_product_desc', 'Gérer votre catalogue')}</p>
          </div>
        </Link>
        <Link
          href="/producer/orders"
          className="bg-white border border-[#d2e095] rounded-2xl p-3 md:p-5 flex items-center gap-2 md:gap-4 hover:shadow-md transition"
        >
          <span className="text-2xl md:text-3xl flex-none">📦</span>
          <div className="min-w-0">
            <p className="font-semibold text-gray-800 text-sm md:text-base leading-tight">{t('producer.view_orders', 'Voir les commandes')}</p>
            <p className="text-xs md:text-sm text-gray-400 mt-0.5 hidden sm:block">{t('producer.view_orders_desc', 'Suivre vos ventes')}</p>
          </div>
        </Link>
      </div>

      {/* Recent orders */}
      <div className="bg-white rounded-2xl border border-[#d2e095] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">
            📋 {t('producer.recent_orders', 'Commandes récentes')}
          </h2>
          {recentOrders.length > 0 && (
            <Link href="/producer/orders" className="text-xs text-[#7d9800] hover:underline">
              {t('producer.see_all', 'Voir tout')} →
            </Link>
          )}
        </div>
        {recentOrders.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-4xl mb-3 opacity-20">📦</p>
            <p className="text-gray-400 text-sm">
              {t('producer.no_orders_yet', 'Aucune commande pour le moment')}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentOrders.map(order => {
              const info = statusInfo(order.status);
              return (
                <div key={order.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 md:p-4 bg-[#faf7e8] rounded-xl">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">#{order.id} · {order.customer}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(order.created_at).toLocaleDateString('fr-FR')} · {order.items.map((i: any) => `${i.quantity} ${i.unit} ${i.name}`).join(', ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <p className="text-sm font-bold text-[#526500]">
                      {Number(order.subtotal).toLocaleString()} Fdj
                    </p>
                    <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${info.cls}`}>
                      {info.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProducerDashboardPage() {
  return (
    <ProducerLayout>
      {producer => <DashboardContent producer={producer} />}
    </ProducerLayout>
  );
}
