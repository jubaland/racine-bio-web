'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';
import { useLanguage } from '../../context/LanguageContext';
import { useFavorites } from '../../context/FavoritesContext';

interface OrderItem {
  id: string;
  product_id: number;
  quantity: number;
  price: number;
  product_name?:      string | null;
  product_image_url?: string | null;
  product_unit?:      string | null;
  product_farm?:      string | null;
  products?: { name: string; unit: string; image_url: string | null; farm: string } | null;
}

interface Order {
  id: string;
  total: number;
  status: string;
  payment_method: string;
  phone: string;
  address: string;
  customer_name: string;
  created_at: string;
  order_items: OrderItem[];
}

interface SavedAddress {
  id: number;
  label: string;
  recipient_name: string;
  phone: string;
  address: string;
  is_default: boolean;
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending:    { label: '⏳ En attente', cls: 'bg-yellow-100 text-yellow-700' },
  processing: { label: '🚚 En cours',   cls: 'bg-blue-100 text-blue-700' },
  shipping:   { label: '📦 Expédié',    cls: 'bg-purple-100 text-purple-700' },
  delivered:  { label: '✅ Livré',       cls: 'bg-green-100 text-green-700' },
  cancelled:  { label: '❌ Annulé',      cls: 'bg-red-100 text-red-600' },
};

const PAYMENT_LABELS: Record<string, string> = {
  waafi:  '📱 Waafi',
  dmoney: '💳 D-Money',
  cash:   '💵 Espèces',
};

const LABEL_ICONS: Record<string, string> = { Maison: '🏠', Bureau: '🏢', Autre: '📍' };
const ADDRESS_LABELS = ['Maison', 'Bureau', 'Autre'];

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const { ui } = useLanguage();
  const { count: favCount } = useFavorites();
  const t = (key: string, fallback: string) => ui[key] || fallback;

  // Adresses
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<number | null>(null);
  const [addrLabel, setAddrLabel] = useState('Maison');
  const [addrName, setAddrName] = useState('');
  const [addrPhoneDigits, setAddrPhoneDigits] = useState('');
  const [addrPhoneFocused, setAddrPhoneFocused] = useState(false);
  const [addrText, setAddrText] = useState('');
  const [savingAddress, setSavingAddress] = useState(false);
  const [deletingAddressId, setDeletingAddressId] = useState<number | null>(null);

  const addrPhoneDisplay = addrPhoneFocused
    ? addrPhoneDigits
    : (addrPhoneDigits.match(/.{1,2}/g) || []).join(' ');
  const addrPhoneValid = addrPhoneDigits.length === 6;
  const addrFormValid = addrName.trim().length > 0 && addrPhoneValid && addrText.trim().length > 0;

  const loadAddresses = async (userId: string) => {
    const { data } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });
    setAddresses((data || []) as SavedAddress[]);
  };

  const startEdit = (addr: SavedAddress) => {
    setEditingAddressId(addr.id);
    setAddrLabel(addr.label);
    setAddrName(addr.recipient_name);
    setAddrPhoneDigits(addr.phone.replace(/\D/g, '').slice(2));
    setAddrText(addr.address);
    setShowAddressForm(true);
  };

  const cancelForm = () => {
    setShowAddressForm(false);
    setEditingAddressId(null);
    setAddrLabel('Maison');
    setAddrName('');
    setAddrPhoneDigits('');
    setAddrText('');
  };

  const saveAddress = async () => {
    if (!user || !addrFormValid) return;
    setSavingAddress(true);
    const payload = {
      label:          addrLabel,
      recipient_name: addrName.trim(),
      phone:          '77' + addrPhoneDigits,
      address:        addrText.trim(),
    };
    if (editingAddressId) {
      await supabase.from('addresses').update(payload).eq('id', editingAddressId);
    } else {
      await supabase.from('addresses').insert({
        ...payload,
        user_id:    user.id,
        is_default: addresses.length === 0,
      });
    }
    await loadAddresses(user.id);
    cancelForm();
    setSavingAddress(false);
  };

  const deleteAddress = async (id: number) => {
    setDeletingAddressId(id);
    await supabase.from('addresses').delete().eq('id', id);
    setAddresses(prev => prev.filter(a => a.id !== id));
    setDeletingAddressId(null);
  };

  const setDefaultAddress = async (id: number) => {
    const ids = addresses.map(a => a.id);
    await supabase.from('addresses').update({ is_default: false }).in('id', ids);
    await supabase.from('addresses').update({ is_default: true }).eq('id', id);
    setAddresses(prev => prev.map(a => ({ ...a, is_default: a.id === id })));
  };

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = '/login'; return; }
      setUser(session.user);

      const [ordersRes] = await Promise.all([
        fetch('/api/orders/mine', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        loadAddresses(session.user.id),
      ]);

      if (ordersRes.ok) {
        const json = await ordersRes.json();
        setOrders(json.orders || []);
      }
      setLoading(false);
    };
    init();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const statusMeta = (s: string) =>
    STATUS_META[s] ?? { label: s, cls: 'bg-gray-100 text-gray-600' };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf7e8] flex items-center justify-center">
        <div className="text-center">
          <p className="text-5xl mb-4">🌿</p>
          <p className="text-gray-400">{t('profile.loading', 'Chargement...')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf7e8]">
      <header className="bg-white border-b border-[#d2e095] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="text-3xl">🌿</span>
            <div>
              <h1 className="text-xl font-bold text-[#526500]">Hornafresh</h1>
              <p className="text-xs text-gray-400">{t('footer', 'Le marché premium, frais, bio, local et régional de Djibouti')}</p>
            </div>
          </Link>
          <Link href="/" className="text-sm text-gray-600 hover:text-[#7d9800]">
            {t('profile.back', '← Retour')}
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-12">

        {/* Carte utilisateur */}
        <div className="bg-white rounded-3xl p-8 border border-[#d2e095] shadow-sm mb-6">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-[#ecf4d5] rounded-full flex items-center justify-center text-4xl">👤</div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-800">
                {user?.user_metadata?.full_name || t('profile.user_default', 'Utilisateur')}
              </h2>
              <p className="text-gray-400 text-sm mt-1">{user?.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="bg-[#ecf4d5] text-[#526500] text-xs font-semibold px-3 py-1 rounded-full">
                  {t('profile.verified', '✅ Compte vérifié')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { emoji: '📦', label: t('profile.stat_orders', 'Commandes'), value: orders.length },
            { emoji: '❤️', label: t('profile.stat_favorites', 'Favoris'), value: favCount },
            { emoji: '📍', label: t('profile.stat_addresses', 'Adresses'), value: addresses.length },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-2xl p-4 text-center border border-[#d2e095]">
              <p className="text-2xl mb-1">{stat.emoji}</p>
              <p className="text-xl font-bold text-[#526500]">{stat.value}</p>
              <p className="text-xs text-gray-400">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Favoris */}
        <div className="bg-white rounded-3xl p-6 border border-[#d2e095] shadow-sm mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">❤️ {t('profile.my_favorites', 'Mes favoris')}</h3>
            <Link href="/favorites" className="text-sm text-[#7d9800] hover:underline">
              {t('profile.see_all', 'Voir tout')} →
            </Link>
          </div>
          {favCount === 0 ? (
            <div className="text-center py-6">
              <p className="text-3xl mb-2 opacity-20">❤️</p>
              <p className="text-gray-400 text-sm">{t('profile.no_favorites', 'Aucun favori pour le moment')}</p>
              <Link href="/" className="mt-3 inline-block text-sm text-[#7d9800] hover:underline">
                {t('profile.browse_products', 'Parcourir les produits')}
              </Link>
            </div>
          ) : (
            <Link href="/favorites" className="flex items-center gap-4 p-4 bg-[#faf7e8] rounded-2xl hover:bg-[#ecf4d5] transition">
              <span className="text-3xl">❤️</span>
              <div>
                <p className="font-semibold text-gray-800">{favCount} {t('profile.favorites_count', favCount > 1 ? 'produits favoris' : 'produit favori')}</p>
                <p className="text-sm text-gray-400">{t('profile.favorites_desc', 'Retrouvez tous vos produits sauvegardés')}</p>
              </div>
              <span className="ml-auto text-gray-400">›</span>
            </Link>
          )}
        </div>

        {/* Adresses de livraison */}
        <div className="bg-white rounded-3xl p-6 border border-[#d2e095] shadow-sm mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">📍 Mes adresses</h3>
            {!showAddressForm && (
              <button
                onClick={() => { cancelForm(); setShowAddressForm(true); }}
                className="text-sm text-[#7d9800] hover:underline"
              >
                + Ajouter
              </button>
            )}
          </div>

          {/* Liste des adresses */}
          {addresses.length === 0 && !showAddressForm && (
            <div className="text-center py-6">
              <p className="text-3xl mb-2 opacity-20">📍</p>
              <p className="text-gray-400 text-sm">Aucune adresse sauvegardée</p>
              <button
                onClick={() => setShowAddressForm(true)}
                className="mt-3 text-sm text-[#7d9800] hover:underline"
              >
                Ajouter une adresse
              </button>
            </div>
          )}

          {addresses.length > 0 && (
            <div className="space-y-3 mb-4">
              {addresses.map(addr => (
                <div
                  key={addr.id}
                  className={`rounded-2xl border p-4 ${addr.is_default ? 'border-[#a8c800] bg-[#f0f9e0]' : 'border-[#d2e095] bg-[#fafaf5]'}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl mt-0.5">{LABEL_ICONS[addr.label] ?? '📍'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-gray-800 text-sm">{addr.label}</p>
                        {addr.is_default && (
                          <span className="text-xs bg-[#a8c800] text-white px-2 py-0.5 rounded-full">Par défaut</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700">{addr.recipient_name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">📞 {addr.phone}</p>
                      <p className="text-xs text-gray-400 mt-0.5">📍 {addr.address}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#e8f0d0]">
                    {!addr.is_default && (
                      <button
                        onClick={() => setDefaultAddress(addr.id)}
                        className="text-xs text-[#7d9800] hover:underline"
                      >
                        ⭐ Par défaut
                      </button>
                    )}
                    <button
                      onClick={() => startEdit(addr)}
                      className="text-xs text-gray-500 hover:text-gray-800 ml-auto"
                    >
                      ✏️ Modifier
                    </button>
                    <button
                      onClick={() => deleteAddress(addr.id)}
                      disabled={deletingAddressId === addr.id}
                      className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50"
                    >
                      🗑️ Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Formulaire ajout / modification */}
          {showAddressForm && (
            <div className="border border-[#d2e095] rounded-2xl p-4 bg-[#faf7e8] space-y-4">
              <p className="text-sm font-semibold text-gray-700">
                {editingAddressId ? '✏️ Modifier l\'adresse' : '➕ Nouvelle adresse'}
              </p>

              {/* Type */}
              <div className="flex gap-2">
                {ADDRESS_LABELS.map(lbl => (
                  <button
                    key={lbl}
                    onClick={() => setAddrLabel(lbl)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-sm font-medium transition ${
                      addrLabel === lbl
                        ? 'border-[#a8c800] bg-[#ecf4d5] text-[#526500]'
                        : 'border-[#d2e095] bg-white text-gray-500 hover:bg-white'
                    }`}
                  >
                    {LABEL_ICONS[lbl]} {lbl}
                  </button>
                ))}
              </div>

              {/* Nom */}
              <input
                type="text"
                value={addrName}
                onChange={e => setAddrName(e.target.value)}
                placeholder="Nom complet *"
                className="w-full border border-[#d2e095] rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:border-[#a8c800]"
              />

              {/* Téléphone */}
              <div>
                <div className="flex border border-[#d2e095] rounded-xl overflow-hidden focus-within:border-[#a8c800] bg-white transition">
                  <span className="flex items-center px-4 text-sm font-semibold text-gray-700 bg-[#ecf4d5] border-r border-[#d2e095] select-none">77</span>
                  <input
                    type="tel"
                    value={addrPhoneDisplay}
                    onChange={e => setAddrPhoneDigits(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    onFocus={() => setAddrPhoneFocused(true)}
                    onBlur={() => setAddrPhoneFocused(false)}
                    placeholder="XX XX XX"
                    maxLength={8}
                    className="flex-1 px-4 py-3 text-sm text-gray-800 bg-transparent focus:outline-none"
                  />
                </div>
                {addrPhoneDigits.length > 0 && !addrPhoneValid && (
                  <p className="text-xs text-red-500 mt-1.5">⚠️ Le numéro doit contenir 8 chiffres au total (77 + 6 chiffres)</p>
                )}
              </div>

              {/* Adresse */}
              <textarea
                value={addrText}
                onChange={e => setAddrText(e.target.value)}
                placeholder="Adresse complète *"
                rows={2}
                className="w-full border border-[#d2e095] rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:border-[#a8c800] resize-none"
              />

              {/* Boutons */}
              <div className="flex gap-2">
                <button
                  onClick={cancelForm}
                  className="flex-1 py-2.5 rounded-xl border border-[#d2e095] text-sm text-gray-600 hover:bg-white transition"
                >
                  Annuler
                </button>
                <button
                  onClick={saveAddress}
                  disabled={!addrFormValid || savingAddress}
                  className="flex-1 py-2.5 rounded-xl bg-[#a8c800] text-white text-sm font-semibold hover:bg-[#7d9800] transition disabled:opacity-50"
                >
                  {savingAddress ? '⏳ Sauvegarde...' : '✅ Sauvegarder'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Commandes */}
        <div className="bg-white rounded-3xl p-6 border border-[#d2e095] shadow-sm mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">📦 {t('profile.my_orders', 'Mes commandes')}</h3>

          {orders.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-4xl mb-3 opacity-20">📦</p>
              <p className="text-gray-400">{t('profile.no_orders', 'Aucune commande pour le moment')}</p>
              <Link href="/" className="mt-4 inline-block text-sm text-[#7d9800] hover:underline">
                {t('profile.start_shopping', 'Commencer mes achats')}
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map(order => {
                const m = statusMeta(order.status);
                const items = order.order_items || [];
                return (
                  <div key={order.id} className="border border-[#d2e095] rounded-2xl overflow-hidden">

                    {/* En-tête commande */}
                    <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#f8fdf0]">
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-mono text-xs text-gray-400">#{String(order.id).slice(0, 8).toUpperCase()}</span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${m.cls}`}>{m.label}</span>
                        </div>
                        <p className="text-xs text-gray-400">
                          {new Date(order.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                          {' · '}{PAYMENT_LABELS[order.payment_method] || order.payment_method}
                        </p>
                        {order.address && (
                          <p className="text-xs text-gray-400 mt-0.5">📍 {order.address}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-400">{items.length} article{items.length > 1 ? 's' : ''}</p>
                        <p className="text-lg font-bold text-[#526500]">{Number(order.total).toLocaleString()} Fdj</p>
                      </div>
                    </div>

                    {/* Articles */}
                    {items.length > 0 && (
                      <div className="divide-y divide-[#f0f7e0]">
                        {items.map(item => {
                          const name  = item.product_name  || item.products?.name  || `Produit #${item.product_id}`;
                          const unit  = item.product_unit  || item.products?.unit  || 'u';
                          const image = item.product_image_url ?? item.products?.image_url ?? null;
                          const subtotal = item.price * item.quantity;

                          return (
                            <div key={item.id} className="flex items-center gap-3 p-3">
                              <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#ecf4d5] flex-shrink-0">
                                {image ? (
                                  <img src={image} alt={name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-xl opacity-20">📷</div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-800 truncate">{name}</p>
                                <p className="text-xs text-gray-400">
                                  {Number(item.price).toLocaleString()} Fdj / {unit} × {item.quantity}
                                </p>
                              </div>
                              <p className="text-sm font-bold text-[#526500] flex-shrink-0">
                                {Number(subtotal).toLocaleString()} Fdj
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {items.length > 0 && (
                      <div className="flex justify-between items-center px-4 py-2.5 bg-[#f8fdf0] border-t border-[#d2e095]">
                        <span className="text-xs text-gray-500 font-medium">{t('checkout.total', 'Total')}</span>
                        <span className="text-sm font-bold text-[#526500]">{Number(order.total).toLocaleString()} Fdj</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Espace producteur */}
        <div className="bg-gradient-to-r from-[#ecf4d5] to-[#e8f5d0] rounded-3xl p-6 border border-[#d2e095] shadow-sm mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-4xl">👨‍🌾</span>
              <div>
                <h3 className="font-semibold text-[#526500]">{t('profile.producer_space', 'Espace Producteur')}</h3>
                <p className="text-sm text-gray-500">{t('profile.producer_space_desc', 'Gérez vos produits et commandes')}</p>
              </div>
            </div>
            <Link href="/producer/dashboard" className="bg-[#a8c800] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#7d9800] transition">
              {t('profile.go_producer', 'Accéder')} →
            </Link>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            {t('profile.not_producer', 'Pas encore producteur ?')}{' '}
            <Link href="/become-producer" className="text-[#7d9800] hover:underline">
              {t('profile.become_producer_link', 'Faire une demande')}
            </Link>
          </p>
        </div>

        {/* Paramètres */}
        <div className="bg-white rounded-3xl p-6 border border-[#d2e095] shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">⚙️ {t('profile.settings', 'Paramètres')}</h3>
          <div className="space-y-3">
            <button className="w-full flex items-center gap-3 p-4 bg-[#faf7e8] rounded-2xl hover:bg-[#ecf4d5] transition text-left">
              <span className="text-xl">🔔</span>
              <span className="text-sm font-medium text-gray-700">{t('profile.notifications', 'Notifications')}</span>
              <span className="ml-auto text-gray-400">›</span>
            </button>
            <button className="w-full flex items-center gap-3 p-4 bg-[#faf7e8] rounded-2xl hover:bg-[#ecf4d5] transition text-left">
              <span className="text-xl">🔒</span>
              <span className="text-sm font-medium text-gray-700">{t('profile.security', 'Sécurité')}</span>
              <span className="ml-auto text-gray-400">›</span>
            </button>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 p-4 bg-red-50 rounded-2xl hover:bg-red-100 transition text-left"
            >
              <span className="text-xl">🚪</span>
              <span className="text-sm font-medium text-red-500">{t('profile.signout', 'Se déconnecter')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
