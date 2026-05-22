'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    products: 0, categories: 0, promos: 0, producers: 0, orders: 0, pendingOrders: 0,
  });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
        <p className="text-gray-400">Chargement des statistiques...</p>
      </div>
    );
  }

  const statCards = [
    { emoji: '🥬', label: 'Produits', value: stats.products, bg: 'bg-green-50', border: 'border-green-100', text: 'text-green-700' },
    { emoji: '📂', label: 'Catégories', value: stats.categories, bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-700' },
    { emoji: '🏷️', label: 'Promotions', value: stats.promos, bg: 'bg-purple-50', border: 'border-purple-100', text: 'text-purple-700' },
    { emoji: '👨‍🌾', label: 'Producteurs', value: stats.producers, bg: 'bg-yellow-50', border: 'border-yellow-100', text: 'text-yellow-700' },
    { emoji: '📦', label: 'Commandes total', value: stats.orders, bg: 'bg-orange-50', border: 'border-orange-100', text: 'text-orange-700' },
    { emoji: '⏳', label: 'En attente', value: stats.pendingOrders, bg: 'bg-red-50', border: 'border-red-100', text: 'text-red-700' },
  ];

  const statusBadge = (status: string) => {
    switch (status) {
      case 'delivered': return <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-600">✅ Livré</span>;
      case 'pending': return <span className="px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-600">⏳ En attente</span>;
      default: return <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-600">🚚 En cours</span>;
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">📊 Tableau de bord</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        {statCards.map(card => (
          <div key={card.label} className={`${card.bg} ${card.border} border rounded-2xl p-4 text-center`}>
            <p className="text-3xl mb-2">{card.emoji}</p>
            <p className={`text-2xl font-bold ${card.text}`}>{card.value}</p>
            <p className="text-xs text-gray-500 mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-[#dde8b0] p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">📦 Commandes récentes</h2>
        {recentOrders.length === 0 ? (
          <p className="text-gray-400 text-center py-8">Aucune commande pour le moment</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-gray-100">
                  <th className="pb-3 text-gray-500 font-medium">ID</th>
                  <th className="pb-3 text-gray-500 font-medium">Client</th>
                  <th className="pb-3 text-gray-500 font-medium">Téléphone</th>
                  <th className="pb-3 text-gray-500 font-medium">Total</th>
                  <th className="pb-3 text-gray-500 font-medium">Statut</th>
                  <th className="pb-3 text-gray-500 font-medium">Date</th>
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
