'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

interface Order {
  id: string;
  user_id: string;
  total: number;
  status: string;
  payment_method: string;
  phone: string;
  address: string;
  customer_name: string;
  created_at: string;
}

interface OrderItem {
  id: string;
  product_id: number;
  quantity: number;
  price: number;
  products?: { name: string; unit: string };
}

const STATUSES = [
  { value: '', label: 'Toutes' },
  { value: 'pending', label: '⏳ En attente' },
  { value: 'processing', label: '🚚 En cours' },
  { value: 'delivered', label: '✅ Livré' },
  { value: 'cancelled', label: '❌ Annulé' },
];

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pending: { label: '⏳ En attente', cls: 'bg-yellow-100 text-yellow-700' },
  processing: { label: '🚚 En cours', cls: 'bg-blue-100 text-blue-700' },
  delivered: { label: '✅ Livré', cls: 'bg-green-100 text-green-700' },
  cancelled: { label: '❌ Annulé', cls: 'bg-red-100 text-red-600' },
};

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (filterStatus) query = query.eq('status', filterStatus);
    const { data } = await query;
    setOrders(data || []);
    setLoading(false);
  }, [filterStatus]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const loadItems = async (orderId: string) => {
    if (orderItems[orderId]) return;
    const { data } = await supabase
      .from('order_items')
      .select('*, products(name, unit)')
      .eq('order_id', orderId);
    setOrderItems(prev => ({ ...prev, [orderId]: data || [] }));
  };

  const toggleExpand = (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    loadItems(id);
  };

  const updateStatus = async (order: Order, status: string) => {
    setUpdatingId(order.id);
    await supabase.from('orders').update({ status }).eq('id', order.id);
    setUpdatingId(null);
    fetchAll();
  };

  const statusInfo = (s: string) => STATUS_LABELS[s] || { label: s, cls: 'bg-gray-100 text-gray-600' };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">📦 Commandes</h1>
        <div className="flex gap-2">
          {STATUSES.map(s => (
            <button
              key={s.value}
              onClick={() => setFilterStatus(s.value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                filterStatus === s.value ? 'bg-[#526500] text-white' : 'bg-white border border-[#dde8b0] text-gray-600 hover:border-[#a8c800]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><p className="text-gray-400">Chargement...</p></div>
      ) : (
        <div className="space-y-3">
          {orders.length === 0 && (
            <div className="text-center py-12 text-gray-400 bg-white rounded-2xl border border-[#dde8b0]">
              Aucune commande{filterStatus ? ' avec ce statut' : ''}
            </div>
          )}
          {orders.map(order => {
            const info = statusInfo(order.status);
            const isExpanded = expandedId === order.id;
            return (
              <div key={order.id} className="bg-white rounded-2xl border border-[#dde8b0] overflow-hidden">
                {/* Order row */}
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer hover:bg-[#f8faf0] transition"
                  onClick={() => toggleExpand(order.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-gray-400">#{order.id.slice(-8)}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${info.cls}`}>{info.label}</span>
                    </div>
                    <p className="font-medium text-gray-800">{order.customer_name || '—'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{order.phone} · {order.address}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-[#526500]">{Number(order.total).toLocaleString()} Fdj</p>
                    <p className="text-xs text-gray-400 mt-0.5">{order.payment_method}</p>
                    <p className="text-xs text-gray-400">{new Date(order.created_at).toLocaleDateString('fr-FR')}</p>
                  </div>
                  <span className="text-gray-400 text-lg">{isExpanded ? '▲' : '▼'}</span>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-[#f0f7e8] p-4 bg-[#f8faf0]">
                    {/* Update status */}
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-sm text-gray-600 font-medium">Statut :</span>
                      {['pending', 'processing', 'delivered', 'cancelled'].map(s => (
                        <button
                          key={s}
                          disabled={order.status === s || updatingId === order.id}
                          onClick={() => updateStatus(order, s)}
                          className={`px-3 py-1 rounded-xl text-xs font-medium transition ${
                            order.status === s
                              ? statusInfo(s).cls + ' ring-2 ring-offset-1 ring-current'
                              : 'bg-white border border-gray-200 text-gray-500 hover:border-[#a8c800] disabled:opacity-40'
                          }`}
                        >
                          {statusInfo(s).label}
                        </button>
                      ))}
                    </div>

                    {/* Order items */}
                    <p className="text-sm font-semibold text-gray-700 mb-2">Articles commandés</p>
                    {!orderItems[order.id] ? (
                      <p className="text-gray-400 text-sm">Chargement...</p>
                    ) : orderItems[order.id].length === 0 ? (
                      <p className="text-gray-400 text-sm">Aucun article</p>
                    ) : (
                      <div className="space-y-2">
                        {orderItems[order.id].map(item => (
                          <div key={item.id} className="flex items-center justify-between bg-white rounded-xl px-4 py-2.5 border border-[#dde8b0]">
                            <div>
                              <span className="text-sm font-medium text-gray-800">
                                {(item as any).products?.name || `Produit #${item.product_id}`}
                              </span>
                              <span className="text-xs text-gray-400 ml-2">
                                × {item.quantity} {(item as any).products?.unit || ''}
                              </span>
                            </div>
                            <span className="text-sm font-semibold text-[#526500]">
                              {Number(item.price * item.quantity).toLocaleString()} Fdj
                            </span>
                          </div>
                        ))}
                        <div className="flex justify-between pt-2 border-t border-[#dde8b0] mt-2">
                          <span className="text-sm font-semibold text-gray-700">Total</span>
                          <span className="text-sm font-bold text-[#526500]">{Number(order.total).toLocaleString()} Fdj</span>
                        </div>
                      </div>
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
