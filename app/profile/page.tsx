 
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';
import { useLanguage } from '../../context/LanguageContext';

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const { ui } = useLanguage();
  const t = (key: string, fallback: string) => ui[key] || fallback;

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/login';
        return;
      }
      setUser(session.user);

      // Charger les commandes
      const { data: ordersData } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });
      setOrders(ordersData || []);
      setLoading(false);
    };
    getUser();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8faf0] flex items-center justify-center">
        <div className="text-center">
          <p className="text-5xl mb-4">🌿</p>
          <p className="text-gray-400">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8faf0]">
      {/* Header */}
      <header className="bg-white border-b border-[#dde8b0] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="text-3xl">🌿</span>
            <div>
              <h1 className="text-xl font-bold text-[#526500]">Racine Bio</h1>
              <p className="text-xs text-gray-400">Le marché bio de Djibouti</p>
            </div>
          </Link>
          <Link href="/" className="text-sm text-gray-600 hover:text-[#7d9800]">← Retour</Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-12">

        {/* Profil card */}
        <div className="bg-white rounded-3xl p-8 border border-[#dde8b0] shadow-sm mb-6">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-[#f0f7e8] rounded-full flex items-center justify-center text-4xl">
              👤
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-800">
                {user?.user_metadata?.full_name || 'Utilisateur'}
              </h2>
              <p className="text-gray-400 text-sm mt-1">{user?.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="bg-[#f0f7e8] text-[#526500] text-xs font-semibold px-3 py-1 rounded-full">
                  ✅ Compte vérifié
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { emoji: "📦", label: "Commandes", value: orders.length },
            { emoji: "❤️", label: "Favoris", value: 0 },
            { emoji: "⭐", label: "Avis", value: 0 },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-2xl p-4 text-center border border-[#dde8b0]">
              <p className="text-2xl mb-1">{stat.emoji}</p>
              <p className="text-xl font-bold text-[#526500]">{stat.value}</p>
              <p className="text-xs text-gray-400">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Commandes */}
        <div className="bg-white rounded-3xl p-6 border border-[#dde8b0] shadow-sm mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">📦 Mes commandes</h3>
          {orders.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-4xl mb-3 opacity-20">📦</p>
              <p className="text-gray-400">Aucune commande pour le moment</p>
              <Link href="/" className="mt-4 inline-block text-sm text-[#7d9800] hover:underline">
                Commencer mes achats
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map(order => (
                <div key={order.id} className="flex items-center justify-between p-4 bg-[#f8faf0] rounded-2xl">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Commande #{order.id}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(order.created_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-[#7d9800]">{Number(order.total).toLocaleString()} Fdj</p>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      order.status === 'delivered' ? 'bg-green-100 text-green-600' :
                      order.status === 'pending' ? 'bg-yellow-100 text-yellow-600' :
                      'bg-blue-100 text-blue-600'
                    }`}>
                      {order.status === 'delivered' ? '✅ Livré' :
                       order.status === 'pending' ? '⏳ En attente' : '🚚 En cours'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="bg-white rounded-3xl p-6 border border-[#dde8b0] shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">⚙️ Paramètres</h3>
          <div className="space-y-3">
            <button className="w-full flex items-center gap-3 p-4 bg-[#f8faf0] rounded-2xl hover:bg-[#f0f7e8] transition text-left">
              <span className="text-xl">🔔</span>
              <span className="text-sm font-medium text-gray-700">Notifications</span>
              <span className="ml-auto text-gray-400">›</span>
            </button>
            <button className="w-full flex items-center gap-3 p-4 bg-[#f8faf0] rounded-2xl hover:bg-[#f0f7e8] transition text-left">
              <span className="text-xl">🔒</span>
              <span className="text-sm font-medium text-gray-700">Sécurité</span>
              <span className="ml-auto text-gray-400">›</span>
            </button>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 p-4 bg-red-50 rounded-2xl hover:bg-red-100 transition text-left"
            >
              <span className="text-xl">🚪</span>
              <span className="text-sm font-medium text-red-500">Se déconnecter</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}