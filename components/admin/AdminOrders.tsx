'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { supabase } from '../../lib/supabase';
import PrepSlip from './PrepSlip';

interface OrderItem {
  id: string;
  product_id: number;
  quantity: number;
  price: number;
  // Snapshot produit au moment de la commande
  product_name?:      string | null;
  product_image_url?: string | null;
  product_unit?:      string | null;
  product_farm?:      string | null;
}

interface Order {
  id: string;
  user_id: string | null;
  total: number;
  delivery_fee: number | null;
  delivery_option_name: string | null;
  status: string;
  payment_method: string;
  phone: string;
  email: string | null;
  address: string;
  customer_name: string;
  special_instructions: string | null;
  created_at: string;
  order_items: OrderItem[];
}

const STATUSES = ['pending', 'processing', 'shipping', 'delivered', 'cancelled'] as const;

const PAYMENT_LABELS: Record<string, string> = {
  waafi:  '📱 Waafi',
  dmoney: '💳 D-Money',
  cash:   '💵 Espèces',
  wallet: '💰 Cagnotte',
};

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [slipOrder, setSlipOrder] = useState<Order | null>(null);

  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;

  const STATUS_META = {
    pending:    { label: t('admin.status_pending',    '⏳ En attente'), cls: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    processing: { label: t('admin.status_processing', '🚚 En cours'),   cls: 'bg-blue-100 text-blue-800 border-blue-200' },
    shipping:   { label: t('admin.status_shipping',   '📦 Expédié'),    cls: 'bg-purple-100 text-purple-800 border-purple-200' },
    delivered:  { label: t('admin.status_delivered',  '✅ Livré'),       cls: 'bg-green-100 text-green-800 border-green-200' },
    cancelled:  { label: t('admin.status_cancelled',  '❌ Annulé'),      cls: 'bg-orange-100 text-[#f97316] border-orange-200' },
  };
  const meta = (s: string) =>
    STATUS_META[s as keyof typeof STATUS_META] ?? { label: s, cls: 'bg-gray-100 text-gray-600 border-gray-200' };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const tk = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch('/api/orders', { headers: { Authorization: `Bearer ${tk}` } });
      const json = await res.json();
      if (!res.ok) { setFetchError(json.error); return; }
      let orders: Order[] = json.orders || [];
      if (filterStatus) orders = orders.filter(o => o.status === filterStatus);
      setOrders(orders);
    } catch (e: any) {
      setFetchError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const updateStatus = async (orderId: string, status: string) => {
    setUpdatingId(orderId);
    const tk = (await supabase.auth.getSession()).data.session?.access_token;
    await fetch('/api/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` },
      body: JSON.stringify({ id: orderId, status }),
    });
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
    setUpdatingId(null);
  };

  const statusFilters = [
    { value: '', label: t('admin.all', 'Toutes') },
    ...STATUSES.map(s => ({ value: s, label: meta(s).label })),
  ];

  return (
    <div>
      {/* En-tête + filtres */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-800">📦 {t('admin.nav_orders', 'Commandes')}</h1>
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

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <p className="text-gray-400">{t('admin.loading', 'Chargement...')}</p>
        </div>
      ) : fetchError ? (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6">
          <p className="text-[#f97316] font-semibold mb-1">⚠️ Erreur de chargement</p>
          <p className="text-[#f97316] text-sm font-mono">{fetchError}</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 text-gray-400 bg-white rounded-2xl border border-[#d2e095]">
          {filterStatus
            ? t('admin.orders_none_status', 'Aucune commande avec ce statut')
            : t('admin.orders_none', 'Aucune commande')}
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map(order => {
            const m = meta(order.status);
            const isUpdating = updatingId === order.id;
            const items = order.order_items || [];
            const subtotal = items.reduce((s, it) => s + Number(it.price) * it.quantity, 0);
            const deliveryFee = order.delivery_fee != null ? order.delivery_fee : Math.max(0, Number(order.total) - subtotal);

            return (
              <div key={order.id} className="bg-white rounded-2xl border border-[#d2e095] shadow-sm overflow-hidden">

                {/* ── En-tête commande ── */}
                <div className="flex flex-wrap items-start gap-4 p-4 bg-[#f8fdf0] border-b border-[#d2e095]">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono text-xs text-gray-400 bg-white border border-[#d2e095] px-2 py-0.5 rounded-lg">
                        #{String(order.id).slice(0, 8).toUpperCase()}
                      </span>
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${m.cls}`}>
                        {m.label}
                      </span>
                    </div>
                    <p className="font-bold text-gray-800">{order.customer_name || '—'}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-500">
                      {order.phone   && <span>📞 {order.phone}</span>}
                      {order.email   && <span>✉️ {order.email}</span>}
                      {order.address && <span>📍 {order.address}</span>}
                      {order.special_instructions && (
                        <span className="w-full mt-1 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 block">
                          📝 {order.special_instructions}
                        </span>
                      )}
                      <span>{PAYMENT_LABELS[order.payment_method] || order.payment_method}</span>
                      <span>🕐 {new Date(order.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                    </div>
                  </div>

                  {/* Total + sélecteur statut */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-xs text-gray-400">{items.length} article{items.length > 1 ? 's' : ''}</p>
                      <p className="text-xl font-bold text-[#526500]">{Number(order.total).toLocaleString()} Fdj</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <select
                        value={order.status}
                        disabled={isUpdating}
                        onChange={e => updateStatus(order.id, e.target.value)}
                        className={`text-xs border rounded-xl px-2 py-1.5 font-semibold cursor-pointer focus:outline-none disabled:opacity-50 ${m.cls}`}
                      >
                        {STATUSES.map(s => (
                          <option key={s} value={s}>{meta(s).label}</option>
                        ))}
                      </select>
                      {isUpdating && <span className="text-xs text-gray-400">⏳</span>}
                      <button
                        onClick={() => setSlipOrder(order)}
                        className="text-xs font-medium text-[#526500] border border-[#d2e095] rounded-lg px-2 py-1 hover:bg-[#ecf4d5] transition whitespace-nowrap"
                      >
                        🖨️ {t('admin.prep_slip', 'Bordereau')}
                      </button>
                    </div>
                  </div>
                </div>

                {/* ── Articles ── */}
                {items.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">
                    {t('admin.order_no_items', 'Aucun article enregistré')}
                  </p>
                ) : (
                  <div className="divide-y divide-[#f0f7e0]">
                    {items.map(item => {
                      const subtotal = item.price * item.quantity;
                      const name  = item.product_name || `Produit #${item.product_id}`;
                      const unit  = item.product_unit || 'u';
                      const farm  = item.product_farm || null;
                      const image = item.product_image_url ?? null;

                      return (
                        <div key={item.id} className="flex gap-4 p-4 items-start">
                          {/* Image */}
                          <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#ecf4d5] flex-shrink-0">
                            {image ? (
                              <img src={image} alt={name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-2xl opacity-20">📷</div>
                            )}
                          </div>

                          {/* Infos produit */}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-800 text-sm mb-0.5">{name}</p>
                            {farm && <p className="text-xs text-gray-400">🌱 {farm}</p>}
                          </div>

                          {/* Prix × quantité = total */}
                          <div className="text-right flex-shrink-0 space-y-0.5">
                            <p className="text-xs text-gray-400">
                              {Number(item.price).toLocaleString()} Fdj / {unit}
                            </p>
                            <p className="text-xs text-gray-500">
                              × {item.quantity} {unit}
                            </p>
                            <p className="text-sm font-bold text-[#526500]">
                              {Number(subtotal).toLocaleString()} Fdj
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ── Pied : ventilation sous-total / livraison / total ── */}
                {items.length > 0 && (
                  <div className="px-4 py-3 bg-[#f8fdf0] border-t border-[#d2e095] space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">{t('admin.subtotal', 'Sous-total')}</span>
                      <span className="text-gray-700">{Number(subtotal).toLocaleString()} Fdj</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">
                        🚚 {t('admin.delivery', 'Frais de livraison')}
                        {order.delivery_option_name && <span className="text-gray-400"> — {order.delivery_option_name}</span>}
                      </span>
                      <span className={deliveryFee === 0 ? 'text-green-600 font-medium' : 'text-gray-700'}>
                        {deliveryFee === 0 ? t('admin.delivery_free', 'Offerte') : `${Number(deliveryFee).toLocaleString()} Fdj`}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-1.5 border-t border-[#d2e095]">
                      <span className="text-sm text-gray-600 font-medium">{t('admin.total', 'Total commande')}</span>
                      <span className="text-lg font-bold text-[#526500]">{Number(order.total).toLocaleString()} Fdj</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {slipOrder && <PrepSlip order={slipOrder} onClose={() => setSlipOrder(null)} />}
    </div>
  );
}
