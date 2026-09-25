'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useLanguage } from '../../../context/LanguageContext';
import ProducerLayout from '../../../components/producer/ProducerLayout';

// Commandes marchand — via /api/producer/orders : uniquement ses articles, prénom du client,
// pas de coordonnées (Hornafresh prépare et livre).

type Item = { product_id: number; name: string; unit: string; quantity: number; price: number; total: number };
type Order = { id: string; status: string; created_at: string; customer: string; items: Item[]; subtotal: number };

function OrdersContent({ producer }: { producer: any }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      let { data: { session } } = await supabase.auth.getSession();
      if (!session || (session.expires_at && session.expires_at * 1000 < Date.now() + 60000)) session = (await supabase.auth.refreshSession()).data.session;
      const res = await fetch(`/api/producer/orders${filterStatus ? `?status=${filterStatus}` : ''}`, { headers: { Authorization: `Bearer ${session?.access_token}` } });
      const j = await res.json();
      setOrders(res.ok ? (j.orders || []) : []);
    } catch { setOrders([]); }
    setLoading(false);
  }, [producer.user_id, filterStatus]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const statusInfo = (s: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      pending:    { label: t('admin.status_pending',    '⏳ En attente'), cls: 'bg-yellow-100 text-yellow-700' },
      processing: { label: t('admin.status_processing', '🚚 En cours'),   cls: 'bg-blue-100 text-blue-700' },
      delivered:  { label: t('admin.status_delivered',  '✅ Livré'),       cls: 'bg-green-100 text-green-700' },
      cancelled:  { label: t('admin.status_cancelled',  '❌ Annulé'),      cls: 'bg-red-100 text-red-600' },
    };
    return map[s] || { label: s, cls: 'bg-gray-100 text-gray-600' };
  };

  const statusFilters = [
    { value: '', label: t('admin.all', 'Toutes') },
    { value: 'pending',    label: t('admin.status_pending',    '⏳ En attente') },
    { value: 'processing', label: t('admin.status_processing', '🚚 En cours') },
    { value: 'delivered',  label: t('admin.status_delivered',  '✅ Livré') },
    { value: 'cancelled',  label: t('admin.status_cancelled',  '❌ Annulé') },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-800">
          📦 {t('producer.nav_orders', 'Mes commandes')}
        </h1>
        <div className="flex gap-2 flex-wrap">
          {statusFilters.map(s => (
            <button
              key={s.value}
              onClick={() => setFilterStatus(s.value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                filterStatus === s.value
                  ? 'bg-[#526500] text-white'
                  : 'bg-white border border-[#d2e095] text-gray-600 hover:border-[#a8c800]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-4">{t('producer.orders_hint', 'Seuls vos articles sont affichés. Hornafresh prépare et livre la commande complète.')}</p>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <p className="text-gray-400">{t('producer.loading', 'Chargement...')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.length === 0 && (
            <div className="text-center py-16 bg-white rounded-2xl border border-[#d2e095]">
              <p className="text-5xl mb-4 opacity-20">📦</p>
              <p className="text-gray-400">
                {filterStatus
                  ? t('admin.orders_none_status', 'Aucune commande avec ce statut')
                  : t('producer.no_orders', 'Aucune commande pour le moment')}
              </p>
            </div>
          )}
          {orders.map(order => {
            const info = statusInfo(order.status);
            const isExpanded = expandedId === order.id;
            return (
              <div key={order.id} className="bg-white rounded-2xl border border-[#d2e095] overflow-hidden">
                <div
                  className="flex items-center gap-4 p-5 cursor-pointer hover:bg-[#faf7e8] transition"
                  onClick={() => setExpandedId(isExpanded ? null : order.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="font-semibold text-gray-800 font-mono text-sm">#{order.id}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${info.cls}`}>
                        {info.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">{order.customer} · {order.items.length} {t('producer.items', 'article(s)')}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(order.created_at).toLocaleDateString('fr-FR', {
                        day: 'numeric', month: 'long', year: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-[#526500]">
                      {Number(order.subtotal).toLocaleString()} Fdj
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {isExpanded ? '▲' : '▼'} {t('producer.details', 'Détails')}
                    </p>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-[#d2e095] px-5 py-4 bg-[#faf7e8]">
                    <p className="text-xs font-medium text-gray-500 mb-3">
                      {t('producer.my_items_in_order', 'Mes produits dans cette commande :')}
                    </p>
                    <div className="space-y-2">
                      {order.items.map(item => (
                        <div
                          key={item.product_id}
                          className="flex items-center justify-between bg-white rounded-xl px-4 py-3"
                        >
                          <div>
                            <p className="text-sm font-medium text-gray-800">{item.name}</p>
                            <p className="text-xs text-gray-400">
                              {item.quantity} × {Number(item.price).toLocaleString()} Fdj
                              {item.unit ? ` / ${item.unit}` : ''}
                            </p>
                          </div>
                          <p className="text-sm font-bold text-[#526500]">
                            {item.total.toLocaleString()} Fdj
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ProducerOrdersPage() {
  return (
    <ProducerLayout>
      {producer => <OrdersContent producer={producer} />}
    </ProducerLayout>
  );
}
