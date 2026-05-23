'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useLanguage } from '../../../context/LanguageContext';
import ProducerLayout from '../../../components/producer/ProducerLayout';

function OrdersContent({ producer }: { producer: any }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [orderItems, setOrderItems] = useState<Record<string, any[]>>({});
  const [myProductIds, setMyProductIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;

  const fetchOrders = useCallback(async () => {
    setLoading(true);

    const { data: myProducts } = await supabase
      .from('products')
      .select('id')
      .eq('farm', producer.farm_name);

    const productIds = (myProducts || []).map((p: any) => p.id);
    setMyProductIds(productIds);

    if (productIds.length === 0) {
      setOrders([]);
      setLoading(false);
      return;
    }

    const { data: items } = await supabase
      .from('order_items')
      .select('order_id')
      .in('product_id', productIds);

    const orderIds = [...new Set((items || []).map((i: any) => i.order_id))];

    if (orderIds.length === 0) {
      setOrders([]);
      setLoading(false);
      return;
    }

    let query = supabase
      .from('orders')
      .select('*')
      .in('id', orderIds)
      .order('created_at', { ascending: false });

    if (filterStatus) query = query.eq('status', filterStatus);

    const { data: ordersData } = await query;
    setOrders(ordersData || []);
    setLoading(false);
  }, [producer.farm_name, filterStatus]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const loadItems = async (orderId: string) => {
    if (orderItems[orderId]) return;
    const { data } = await supabase
      .from('order_items')
      .select('*, products(name, unit)')
      .eq('order_id', orderId)
      .in('product_id', myProductIds);
    setOrderItems(prev => ({ ...prev, [orderId]: data || [] }));
  };

  const toggleExpand = (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    loadItems(id);
  };

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
      <div className="flex items-center justify-between mb-6">
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
                  : 'bg-white border border-[#dde8b0] text-gray-600 hover:border-[#a8c800]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <p className="text-gray-400">{t('producer.loading', 'Chargement...')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.length === 0 && (
            <div className="text-center py-16 bg-white rounded-2xl border border-[#dde8b0]">
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
              <div key={order.id} className="bg-white rounded-2xl border border-[#dde8b0] overflow-hidden">
                <div
                  className="flex items-center gap-4 p-5 cursor-pointer hover:bg-[#f8faf0] transition"
                  onClick={() => toggleExpand(order.id)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-gray-800 font-mono text-sm">
                        #{String(order.id).slice(0, 8)}
                      </p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${info.cls}`}>
                        {info.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">{order.customer_name || '—'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(order.created_at).toLocaleDateString('fr-FR', {
                        day: 'numeric', month: 'long', year: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-[#526500]">
                      {Number(order.total).toLocaleString()} Fdj
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {isExpanded ? '▲' : '▼'} {t('producer.details', 'Détails')}
                    </p>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-[#dde8b0] px-5 py-4 bg-[#f8faf0]">
                    {!orderItems[order.id] ? (
                      <p className="text-sm text-gray-400">{t('producer.loading', 'Chargement...')}</p>
                    ) : orderItems[order.id].length === 0 ? (
                      <p className="text-sm text-gray-400">{t('producer.no_items', 'Aucun article')}</p>
                    ) : (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-3">
                          {t('producer.my_items_in_order', 'Mes produits dans cette commande :')}
                        </p>
                        <div className="space-y-2">
                          {orderItems[order.id].map((item: any) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between bg-white rounded-xl px-4 py-3"
                            >
                              <div>
                                <p className="text-sm font-medium text-gray-800">
                                  {item.products?.name || '—'}
                                </p>
                                <p className="text-xs text-gray-400">
                                  {item.quantity} × {Number(item.price).toLocaleString()} Fdj
                                  {item.products?.unit ? ` / ${item.products.unit}` : ''}
                                </p>
                              </div>
                              <p className="text-sm font-bold text-[#526500]">
                                {(item.quantity * item.price).toLocaleString()} Fdj
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {order.address && (
                      <p className="text-xs text-gray-400 mt-4">📍 {order.address}</p>
                    )}
                    {order.phone && (
                      <p className="text-xs text-gray-400 mt-1">📞 {order.phone}</p>
                    )}
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
