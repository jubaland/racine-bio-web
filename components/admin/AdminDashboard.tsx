'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../context/LanguageContext';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    products: 0, categories: 0, promos: 0, producers: 0, orders: 0, pendingOrders: 0,
  });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;

  useEffect(() => {
    const fetchStats = async () => {
      const [
        { count: products },
        { count: categories },
        { count: promos },
        { count: producers },
        { count: orders },
        { count: pendingOrders },
        { data: recent },
      ] = await Promise.all([
        supabase.from('products').select('*', { count: 'exact', head: true }),
        supabase.from('categories').select('*', { count: 'exact', head: true }),
        supabase.from('promos').select('*', { count: 'exact', head: true }),
        supabase.from('producers').select('*', { count: 'exact', head: true }),
        supabase.from('orders').select('*', { count: 'exact', head: true }),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(6),
      ]);
      setStats({
        products: products || 0, categories: categories || 0, promos: promos || 0,
        producers: producers || 0, orders: orders || 0, pendingOrders: pendingOrders || 0,
      });
      setRecentOrders(recent || []);
      setLoading(false);
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">{t('admin.loading_stats', 'Chargement des statistiques...')}</p>
      </div>
    );
  }

  const statCards = [
    { emoji: '🥬', label: t('admin.stat_products', 'Produits'), value: stats.products, bg: 'bg-green-50', border: 'border-green-100', text: 'text-green-700' },
    { emoji: '📂', label: t('admin.stat_categories', 'Catégories'), value: stats.categories, bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-700' },
    { emoji: '🏷️', label: t('admin.stat_promos', 'Promotions'), value: stats.promos, bg: 'bg-purple-50', border: 'border-purple-100', text: 'text-purple-700' },
    { emoji: '👨‍🌾', label: t('admin.stat_producers', 'Producteurs'), value: stats.producers, bg: 'bg-yellow-50', border: 'border-yellow-100', text: 'text-yellow-700' },
    { emoji: '📦', label: t('admin.stat_orders', 'Commandes total'), value: stats.orders, bg: 'bg-orange-50', border: 'border-orange-100', text: 'text-orange-700' },
    { emoji: '⏳', label: t('admin.stat_pending', 'En attente'), value: stats.pendingOrders, bg: 'bg-orange-50', border: 'border-orange-100', text: 'text-[#f97316]' },
  ];

  const statusBadge = (status: string) => {
    switch (status) {
      case 'delivered': return <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-600">{t('admin.status_delivered', '✅ Livré')}</span>;
      case 'pending': return <span className="px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-600">{t('admin.status_pending', '⏳ En attente')}</span>;
      case 'cancelled': return <span className="px-2 py-1 rounded-full text-xs bg-orange-100 text-[#f97316]">{t('admin.status_cancelled', '❌ Annulé')}</span>;
      default: return <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-600">{t('admin.status_processing', '🚚 En cours')}</span>;
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">📊 {t('admin.nav_dashboard', 'Tableau de bord')}</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        {statCards.map(card => (
          <div key={card.label} className={`${card.bg} ${card.border} border rounded-2xl p-4 text-center`}>
            <p className="text-3xl mb-2">{card.emoji}</p>
            <p className={`text-2xl font-bold ${card.text}`}>{card.value}</p>
            <p className="text-xs text-gray-500 mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-[#d2e095] p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">{t('admin.recent_orders', '📦 Commandes récentes')}</h2>
        {recentOrders.length === 0 ? (
          <p className="text-gray-400 text-center py-8">{t('admin.no_orders_recent', 'Aucune commande pour le moment')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-gray-100">
                  <th className="pb-3 text-gray-500 font-medium">{t('admin.col_id', 'ID')}</th>
                  <th className="pb-3 text-gray-500 font-medium">{t('admin.col_customer', 'Client')}</th>
                  <th className="pb-3 text-gray-500 font-medium">{t('admin.col_phone', 'Téléphone')}</th>
                  <th className="pb-3 text-gray-500 font-medium">{t('admin.col_total', 'Total')}</th>
                  <th className="pb-3 text-gray-500 font-medium">{t('admin.col_status', 'Statut')}</th>
                  <th className="pb-3 text-gray-500 font-medium">{t('admin.col_date', 'Date')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentOrders.map(order => (
                  <tr key={order.id}>
                    <td className="py-3 text-gray-400 font-mono">#{order.id.toString().slice(-6)}</td>
                    <td className="py-3 font-medium text-gray-800">{order.customer_name || '—'}</td>
                    <td className="py-3 text-gray-500">{order.phone || '—'}</td>
                    <td className="py-3 text-[#526500] font-semibold">{Number(order.total).toLocaleString()} Fdj</td>
                    <td className="py-3">{statusBadge(order.status)}</td>
                    <td className="py-3 text-gray-400">{new Date(order.created_at).toLocaleDateString('fr-FR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
