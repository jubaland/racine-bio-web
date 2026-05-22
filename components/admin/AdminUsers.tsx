'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../context/LanguageContext';
import Modal from './Modal';

interface CustomerSummary {
  user_id: string;
  customer_name: string;
  phone: string;
  address: string;
  order_count: number;
  total_spent: number;
  last_order: string;
}

interface Order {
  id: string;
  total: number;
  status: string;
  payment_method: string;
  created_at: string;
}

export default function AdminUsers() {
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<CustomerSummary | null>(null);
  const [userOrders, setUserOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;

  const statusInfo = useCallback((s: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      pending:    { label: t('admin.status_pending',    '⏳ En attente'), cls: 'bg-yellow-100 text-yellow-700' },
      processing: { label: t('admin.status_processing', '🚚 En cours'),   cls: 'bg-blue-100 text-blue-700' },
      delivered:  { label: t('admin.status_delivered',  '✅ Livré'),       cls: 'bg-green-100 text-green-700' },
      cancelled:  { label: t('admin.status_cancelled',  '❌ Annulé'),      cls: 'bg-red-100 text-red-600' },
    };
    return map[s] || { label: s, cls: 'bg-gray-100 text-gray-600' };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('orders')
      .select('user_id, customer_name, phone, address, total, created_at')
      .order('created_at', { ascending: false });

    if (!data) { setLoading(false); return; }

    const map = new Map<string, CustomerSummary>();
    for (const row of data) {
      const key = row.user_id || row.phone || row.customer_name;
      if (!key) continue;
      if (!map.has(key)) {
        map.set(key, {
          user_id: row.user_id || key,
          customer_name: row.customer_name || t('admin.unknown', 'Inconnu'),
          phone: row.phone || '—',
          address: row.address || '—',
          order_count: 0,
          total_spent: 0,
          last_order: row.created_at,
        });
      }
      const entry = map.get(key)!;
      entry.order_count += 1;
      entry.total_spent += Number(row.total) || 0;
    }

    setCustomers(Array.from(map.values()).sort((a, b) => b.total_spent - a.total_spent));
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openUser = async (customer: CustomerSummary) => {
    setSelectedUser(customer);
    setLoadingOrders(true);
    const { data } = await supabase
      .from('orders')
      .select('id, total, status, payment_method, created_at')
      .eq('user_id', customer.user_id)
      .order('created_at', { ascending: false });
    setUserOrders(data || []);
    setLoadingOrders(false);
  };

  const filtered = customers.filter(c => {
    const q = search.toLowerCase();
    return !q || c.customer_name.toLowerCase().includes(q) || c.phone.includes(q);
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">👥 {t('admin.nav_users', 'Utilisateurs')}</h1>
        <p className="text-sm text-gray-400">{customers.length} {t('admin.customers_label', 'clients')}</p>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder={t('admin.users_search', '🔍 Rechercher par nom ou téléphone...')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full border border-[#dde8b0] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#a8c800] bg-[#f8faf0]"
        />
      </div>

      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-4 text-sm text-amber-700">
        {t('admin.users_info', "ℹ️ Les utilisateurs sont identifiés à partir de leurs commandes. Pour accéder aux données d'authentification complètes, un accès service role est requis.")}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><p className="text-gray-400">{t('admin.loading', 'Chargement...')}</p></div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#dde8b0] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#f8faf0] border-b border-[#dde8b0]">
              <tr>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">{t('admin.col_customer', 'Client')}</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">{t('admin.col_phone', 'Téléphone')}</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">{t('admin.col_orders', 'Commandes')}</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">{t('admin.col_spent', 'Total dépensé')}</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">{t('admin.col_last_order', 'Dernière commande')}</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium">{t('admin.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400">{t('admin.no_customers', 'Aucun client trouvé')}</td></tr>
              ) : filtered.map(c => (
                <tr key={c.user_id} className="hover:bg-[#f8faf0] transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#f0f7e8] flex items-center justify-center text-lg">👤</div>
                      <div>
                        <p className="font-medium text-gray-800">{c.customer_name}</p>
                        <p className="text-xs text-gray-400 truncate max-w-[160px]">{c.address}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.phone}</td>
                  <td className="px-4 py-3">
                    <span className="bg-[#f0f7e8] text-[#526500] px-2 py-1 rounded-full text-xs font-semibold">{c.order_count}</span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-[#526500]">{c.total_spent.toLocaleString()} Fdj</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{new Date(c.last_order).toLocaleDateString('fr-FR')}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openUser(c)} className="text-[#7d9800] hover:text-[#526500] text-xs font-medium">
                      {t('admin.view_orders', 'Voir commandes')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedUser && (
        <Modal title={`${t('admin.order_history', 'Commandes')} — ${selectedUser.customer_name}`} onClose={() => setSelectedUser(null)}>
          <div className="space-y-4">
            <div className="bg-[#f8faf0] rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-400">{t('admin.col_phone', 'Téléphone')}</p>
                <p className="font-medium text-gray-800">{selectedUser.phone}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">{t('admin.col_spent', 'Total dépensé')}</p>
                <p className="font-bold text-[#526500]">{selectedUser.total_spent.toLocaleString()} Fdj</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-gray-400">{t('admin.col_address', 'Adresse')}</p>
                <p className="font-medium text-gray-800">{selectedUser.address}</p>
              </div>
            </div>

            <p className="text-sm font-semibold text-gray-700">{t('admin.order_history', 'Historique des commandes')}</p>
            {loadingOrders ? (
              <p className="text-gray-400 text-sm text-center py-4">{t('admin.loading', 'Chargement...')}</p>
            ) : userOrders.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">{t('admin.no_orders_user', 'Aucune commande')}</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {userOrders.map(order => {
                  const info = statusInfo(order.status);
                  return (
                    <div key={order.id} className="flex items-center justify-between p-3 bg-[#f8faf0] rounded-xl">
                      <div>
                        <p className="text-xs text-gray-400 font-mono">#{order.id.slice(-8)}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{order.payment_method} · {new Date(order.created_at).toLocaleDateString('fr-FR')}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-[#526500]">{Number(order.total).toLocaleString()} Fdj</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${info.cls}`}>{info.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
