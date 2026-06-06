'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { titleCase } from '../../lib/format';
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
  cancelled:  { label: '❌ Annulé',      cls: 'bg-[#fff3e8] text-[#f97316]' },
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
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletTx, setWalletTx] = useState<{ id: number; type: string; amount: number; note: string | null; created_at: string }[]>([]);
  const { ui } = useLanguage();
  const { count: favCount } = useFavorites();
  const t = (key: string, fallback: string) => ui[key] || fallback;

  // Adresses
  // Parrainage
  const [referralCode, setReferralCode] = useState('');
  const [referralCredits, setReferralCredits] = useState(0);
  const [referralCount, setReferralCount] = useState(0);
  const [referralCopied, setReferralCopied] = useState<'code' | 'link' | null>(null);

  // Notifications email
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState({ orders: true, status: true, promos: false });
  const [savingNotifs, setSavingNotifs] = useState(false);

  // Push navigateur
  const [pushSupported, setPushSupported] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushError, setPushError] = useState('');

  // Sécurité
  const [securityOpen, setSecurityOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

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
      recipient_name: titleCase(addrName),
      phone:          '77' + addrPhoneDigits,
      address:        titleCase(addrText),
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
      if (session.user.user_metadata?.notifications) {
        setNotifPrefs(prev => ({ ...prev, ...session.user.user_metadata.notifications }));
      }

      // Cagnotte (solde + historique) — lecture RLS (propriétaire)
      supabase.from('wallets').select('balance').eq('user_id', session.user.id).maybeSingle()
        .then(({ data }) => setWalletBalance(Number(data?.balance) || 0));
      supabase.from('wallet_transactions').select('id, type, amount, note, created_at')
        .eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(20)
        .then(({ data }) => setWalletTx(data || []));

      // Push navigateur
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        setPushSupported(true);
        const reg = await navigator.serviceWorker.register('/sw.js');
        const existing = await reg.pushManager.getSubscription();
        setPushEnabled(!!existing);
      }

      const [ordersRes, , referralRes] = await Promise.all([
        fetch('/api/orders/mine', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        loadAddresses(session.user.id),
        fetch('/api/referral', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
      ]);

      if (ordersRes.ok) {
        const json = await ordersRes.json();
        setOrders(json.orders || []);
      } else {
        const json = await ordersRes.json().catch(() => ({}));
        setOrdersError(`${ordersRes.status} — ${json.error || 'Erreur inconnue'}`);
      }
      if (referralRes.ok) {
        const json = await referralRes.json();
        setReferralCode(json.code ?? '');
        setReferralCredits(json.credits ?? 0);
        setReferralCount(json.referrals_count ?? 0);
      }
      setLoading(false);
    };
    init();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const verified = !!(user?.email_confirmed_at || user?.confirmed_at);

  const resendVerification = async () => {
    if (!user?.email) return;
    setResending(true);
    try {
      await supabase.auth.resend({
        type: 'signup',
        email: user.email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      setResent(true);
    } catch { /* ignore */ }
    setResending(false);
  };

  const saveNotifs = async (prefs: typeof notifPrefs) => {
    setSavingNotifs(true);
    await supabase.auth.updateUser({ data: { notifications: prefs } });
    setSavingNotifs(false);
  };

  const toggleNotif = (key: keyof typeof notifPrefs) => {
    const updated = { ...notifPrefs, [key]: !notifPrefs[key] };
    setNotifPrefs(updated);
    saveNotifs(updated);
  };

  const changePassword = async () => {
    setPasswordError('');
    setPasswordSuccess(false);
    if (newPassword.length < 8) { setPasswordError(t('profile.pwd_too_short', 'Minimum 8 caractères')); return; }
    if (newPassword !== confirmPassword) { setPasswordError(t('profile.pwd_mismatch', 'Les mots de passe ne correspondent pas')); return; }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) setPasswordError(error.message);
    else { setPasswordSuccess(true); setNewPassword(''); setConfirmPassword(''); }
    setSavingPassword(false);
  };

  const urlBase64ToUint8Array = (base64: string) => {
    const padding = '='.repeat((4 - base64.length % 4) % 4);
    const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = window.atob(b64);
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
  };

  const togglePush = async () => {
    setPushLoading(true);
    setPushError('');
    try {
      const reg = await navigator.serviceWorker.ready;
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (pushEnabled) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify({ subscription: sub.toJSON(), action: 'unsubscribe' }) });
          await sub.unsubscribe();
        }
        setPushEnabled(false);
      } else {
        const permission = await Notification.requestPermission();
        if (permission === 'denied') {
          const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
          const isFirefox = /Firefox/.test(navigator.userAgent);
          const hint = isIOS
            ? 'Réglages iPhone → Applications → Safari → Réglages pour les sites web → Notifications → hornafresh.com → Autoriser'
            : isFirefox
              ? 'Menu Firefox ⋮ → Paramètres → Autorisations de site → Notifications → hornafresh.com → Autoriser'
              : 'Appuyez sur le 🔒 dans la barre d\'adresse → Autorisations → Notifications → Autoriser';
          setPushError(`🔕 Notifications bloquées. ${hint}`);
          setPushLoading(false);
          return;
        }
        if (permission !== 'granted') { setPushLoading(false); return; }
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidKey) { setPushError('Clé VAPID manquante — contactez le support.'); setPushLoading(false); return; }
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
        const res = await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ subscription: sub.toJSON(), action: 'subscribe' }) });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        setPushEnabled(true);
      }
    } catch (e: any) {
      console.error('[push] togglePush error:', e);
      setPushError(e?.message || 'Erreur inconnue');
    }
    setPushLoading(false);
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
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
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

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

        {/* Carte utilisateur */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#d2e095] shadow-sm mb-6">
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="w-20 h-20 bg-[#ecf4d5] rounded-full flex items-center justify-center text-4xl">👤</div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-800">
                {user?.user_metadata?.full_name || t('profile.user_default', 'Utilisateur')}
              </h2>
              <p className="text-gray-400 text-sm mt-1">{user?.email}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {verified ? (
                  <span className="bg-[#ecf4d5] text-[#526500] text-xs font-semibold px-3 py-1 rounded-full">
                    {t('profile.verified', '✅ Compte vérifié')}
                  </span>
                ) : (
                  <span className="bg-orange-50 text-[#f97316] text-xs font-semibold px-3 py-1 rounded-full border border-orange-200">
                    {t('profile.unverified', '⚠️ Compte non vérifié')}
                  </span>
                )}
                <button
                  onClick={handleSignOut}
                  className="text-xs font-semibold px-3 py-1 rounded-full bg-[#fff3e8] text-[#f97316] hover:bg-[#ffe0c8] transition"
                >
                  🚪 {t('profile.signout', 'Se déconnecter')}
                </button>
              </div>
              {!verified && (
                <div className="mt-2">
                  {resent ? (
                    <p className="text-xs text-[#526500]">📧 {t('profile.verify_resent', 'Email de vérification renvoyé ! Vérifiez votre boîte de réception.')}</p>
                  ) : (
                    <p className="text-xs text-gray-500">
                      {t('profile.verify_hint', 'Vérifiez votre email pour activer votre compte.')}{' '}
                      <button onClick={resendVerification} disabled={resending} className="text-[#7d9800] font-semibold hover:underline disabled:opacity-50">
                        {resending ? t('profile.verify_sending', 'Envoi...') : t('profile.verify_resend', 'Renvoyer le lien')}
                      </button>
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Cagnotte (si le client en a une) */}
        {(walletBalance > 0 || walletTx.length > 0) && (
          <div className="bg-gradient-to-br from-[#1c3a05] via-[#2d6410] to-[#7a5800] rounded-3xl p-6 text-white shadow-sm mb-6">
            <p className="text-xs uppercase tracking-widest text-[#c8e050]">💰 {t('profile.wallet', 'Ma cagnotte')}</p>
            <p className="text-3xl font-extrabold mt-1">{walletBalance.toLocaleString()} Fdj</p>
            {walletTx.length > 0 && (
              <div className="mt-4 space-y-1.5">
                {walletTx.slice(0, 5).map(m => (
                  <div key={m.id} className="flex items-center justify-between text-sm bg-white/10 rounded-lg px-3 py-1.5">
                    <span className="text-white/80">
                      {m.note || (m.type === 'deposit' ? t('profile.wallet_deposit', 'Dépôt') : m.type === 'debit' ? t('profile.wallet_debit', 'Livraison') : t('profile.wallet_adjust', 'Ajustement'))}
                      <span className="text-white/40 text-xs ml-2">{new Date(m.created_at).toLocaleDateString('fr-FR')}</span>
                    </span>
                    <span className={`font-bold ${m.amount >= 0 ? 'text-[#c8e050]' : 'text-orange-200'}`}>
                      {m.amount > 0 ? '+' : ''}{Number(m.amount).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {([
            {
              icon: <span className="text-2xl">📦</span>,
              label: t('profile.stat_orders', 'Commandes'), value: orders.length, anchor: 'section-orders',
            },
            {
              icon: (
                <svg viewBox="0 0 24 24" className="w-7 h-7" fill="#f97316" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              ),
              label: t('profile.stat_favorites', 'Favoris'), value: favCount, anchor: 'section-favorites',
            },
            {
              icon: (
                <svg viewBox="0 0 24 24" className="w-7 h-7" fill="#f97316" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                  <circle cx="12" cy="10" r="3" fill="white" stroke="white"/>
                </svg>
              ),
              label: t('profile.stat_addresses', 'Adresses'), value: addresses.length, anchor: 'section-addresses',
            },
          ] as { icon: React.ReactNode; label: string; value: number; anchor: string }[]).map(stat => (
            <button
              key={stat.label}
              onClick={() => document.getElementById(stat.anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="bg-white rounded-2xl p-4 text-center border border-[#d2e095] hover:border-[#a8c800] hover:shadow-sm transition"
            >
              <div className="flex justify-center mb-1">{stat.icon}</div>
              <p className="text-xl font-bold text-[#526500]">{stat.value}</p>
              <p className="text-xs text-gray-400">{stat.label}</p>
            </button>
          ))}
        </div>

        {/* Favoris */}
        <div id="section-favorites" className="bg-white rounded-3xl p-6 border border-[#d2e095] shadow-sm mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0" fill="#f97316" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              {t('profile.my_favorites', 'Mes favoris')}
            </h3>
            <Link href="/favorites" className="text-sm text-[#7d9800] hover:underline">
              {t('profile.see_all', 'Voir tout')} →
            </Link>
          </div>
          {favCount === 0 ? (
            <div className="text-center py-6">
              <svg viewBox="0 0 24 24" className="w-10 h-10 mx-auto mb-2 opacity-20" fill="#f97316" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              <p className="text-gray-400 text-sm">{t('profile.no_favorites', 'Aucun favori pour le moment')}</p>
              <Link href="/" className="mt-3 inline-block text-sm text-[#7d9800] hover:underline">
                {t('profile.browse_products', 'Parcourir les produits')}
              </Link>
            </div>
          ) : (
            <Link href="/favorites" className="flex items-center gap-4 p-4 bg-[#faf7e8] rounded-2xl hover:bg-[#ecf4d5] transition">
              <svg viewBox="0 0 24 24" className="w-9 h-9 flex-shrink-0" fill="#f97316" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              <div>
                <p className="font-semibold text-gray-800">{favCount} {t('profile.favorites_count', favCount > 1 ? 'produits favoris' : 'produit favori')}</p>
                <p className="text-sm text-gray-400">{t('profile.favorites_desc', 'Retrouvez tous vos produits sauvegardés')}</p>
              </div>
              <span className="ml-auto text-gray-400">›</span>
            </Link>
          )}
        </div>

        {/* Adresses de livraison */}
        <div id="section-addresses" className="bg-white rounded-3xl p-6 border border-[#d2e095] shadow-sm mb-6">
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
                      className="text-xs text-[#f97316] opacity-60 hover:opacity-100 disabled:opacity-30 transition"
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
                {!addrPhoneFocused && addrPhoneDigits.length > 0 && !addrPhoneValid && (
                  <p className="text-xs text-[#f97316] mt-1.5">⚠️ Le numéro doit contenir 8 chiffres au total (77 + 6 chiffres)</p>
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

        {/* Parrainage */}
        {referralCode && (
          <div className="bg-white rounded-3xl p-6 border border-[#d2e095] shadow-sm mb-6">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-semibold text-gray-800">🎁 {t('profile.referral_title', 'Parrainage')}</h3>
              {referralCredits > 0 && (
                <span className="bg-[#c8e050] text-[#1c3a05] text-xs font-bold px-3 py-1 rounded-full">
                  🎁 {referralCredits} crédit{referralCredits > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-400 mb-5">
              {t('profile.referral_desc', 'Partagez votre code — votre ami reçoit la livraison offerte, et vous aussi sur votre prochaine commande.')}
            </p>

            {/* Code */}
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                {t('profile.referral_your_code', 'Votre code unique')}
              </p>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-[#ecf4d5] border border-[#d2e095] rounded-xl px-5 py-3 text-center">
                  <span className="text-xl sm:text-2xl font-bold text-[#526500] tracking-[0.1em] sm:tracking-[0.25em]">{referralCode}</span>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(referralCode);
                    setReferralCopied('code');
                    setTimeout(() => setReferralCopied(null), 2000);
                  }}
                  className="px-4 py-3 bg-[#a8c800] text-white text-sm font-semibold rounded-xl hover:bg-[#7d9800] transition whitespace-nowrap"
                >
                  {referralCopied === 'code' ? '✓ Copié' : t('profile.referral_copy', 'Copier')}
                </button>
              </div>
            </div>

            {/* Partager le lien */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  const link = `${window.location.origin}/?ref=${referralCode}`;
                  navigator.clipboard.writeText(link);
                  setReferralCopied('link');
                  setTimeout(() => setReferralCopied(null), 2000);
                }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-[#d2e095] rounded-xl text-sm text-gray-600 hover:bg-[#ecf4d5] transition"
              >
                📋 {referralCopied === 'link' ? 'Lien copié !' : t('profile.referral_copy_link', 'Copier le lien')}
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Je commande mes fruits et légumes frais sur Hornafresh à Djibouti. Utilise mon code ${referralCode} pour recevoir la livraison offerte sur ta 1ère commande ! ${window.location.origin}/?ref=${referralCode}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#25d366] text-white rounded-xl text-sm font-semibold hover:bg-[#1da851] transition"
              >
                💬 WhatsApp
              </a>
            </div>

            {/* Stats */}
            {referralCount > 0 && (
              <div className="mt-5 pt-4 border-t border-[#d2e095] flex items-center gap-2 text-sm text-gray-500">
                <span>👥</span>
                <span>
                  {referralCount} filleul{referralCount > 1 ? 's' : ''} {t('profile.referral_invited', 'invité')}{referralCount > 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Commandes */}
        <div id="section-orders" className="bg-white rounded-3xl p-6 border border-[#d2e095] shadow-sm mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">📦 {t('profile.my_orders', 'Mes commandes')}</h3>

          {ordersError ? (
            <div className="text-center py-6 text-xs text-[#f97316] bg-[#fff3e8] rounded-2xl px-4 font-mono">
              ⚠️ {ordersError}
            </div>
          ) : orders.length === 0 ? (
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
                          const name  = item.product_name || `Produit #${item.product_id}`;
                          const unit  = item.product_unit || 'u';
                          const image = item.product_image_url ?? null;
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

            {/* Notifications */}
            <div className="rounded-2xl border border-[#d2e095] overflow-hidden">
              <button
                onClick={() => setNotifOpen(o => !o)}
                className="w-full flex items-center gap-3 p-4 bg-[#faf7e8] hover:bg-[#ecf4d5] transition text-left"
              >
                <span className="text-xl">🔔</span>
                <span className="text-sm font-medium text-gray-700">{t('profile.notifications', 'Notifications')}</span>
                <span className="ml-auto text-gray-400 transition-transform" style={{ transform: notifOpen ? 'rotate(90deg)' : 'none' }}>›</span>
              </button>
              {notifOpen && (
                <div className="px-4 pb-4 pt-2 space-y-4 bg-white">
                  {pushSupported && (
                    <div className="flex flex-col gap-2 pb-3 border-b border-[#f0f7e0]">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-700">🔔 {t('profile.notif_push', 'Notifications navigateur')}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{t('profile.notif_push_desc', 'Alertes instantanées sur cet appareil')}</p>
                        </div>
                        <button
                          onClick={togglePush}
                          disabled={pushLoading}
                          className={`relative w-11 h-6 rounded-full transition-colors flex-none ${pushEnabled ? 'bg-[#a8c800]' : 'bg-gray-200'} disabled:opacity-60`}
                        >
                          <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${pushEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
                        </button>
                      </div>
                    </div>
                  )}
                  {pushError && (
                    <p className={`text-xs rounded-lg px-3 py-2 ${pushError.startsWith('✅') ? 'text-green-700 bg-green-50' : 'text-[#f97316] bg-orange-50'}`}>{pushError}</p>
                  )}
                  {([
                    { key: 'orders', label: t('profile.notif_orders', 'Confirmation de commande'), desc: t('profile.notif_orders_desc', 'Recevoir un email à chaque nouvelle commande') },
                    { key: 'status', label: t('profile.notif_status', 'Mises à jour de livraison'), desc: t('profile.notif_status_desc', 'Être notifié quand le statut change') },
                    { key: 'promos', label: t('profile.notif_promos', 'Offres et promotions'), desc: t('profile.notif_promos_desc', 'Recevoir les bons plans et nouveautés') },
                  ] as { key: keyof typeof notifPrefs; label: string; desc: string }[]).map(({ key, label, desc }) => (
                    <div key={key} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-700">{label}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                      </div>
                      <button
                        onClick={() => toggleNotif(key)}
                        disabled={savingNotifs}
                        className={`relative w-11 h-6 rounded-full transition-colors flex-none ${notifPrefs[key] ? 'bg-[#a8c800]' : 'bg-gray-200'} disabled:opacity-60`}
                      >
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${notifPrefs[key] ? 'translate-x-5' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sécurité */}
            <div className="rounded-2xl border border-[#d2e095] overflow-hidden">
              <button
                onClick={() => { setSecurityOpen(o => !o); setPasswordError(''); setPasswordSuccess(false); }}
                className="w-full flex items-center gap-3 p-4 bg-[#faf7e8] hover:bg-[#ecf4d5] transition text-left"
              >
                <span className="text-xl">🔒</span>
                <span className="text-sm font-medium text-gray-700">{t('profile.security', 'Sécurité')}</span>
                <span className="ml-auto text-gray-400 transition-transform" style={{ transform: securityOpen ? 'rotate(90deg)' : 'none' }}>›</span>
              </button>
              {securityOpen && (
                <div className="px-4 pb-4 pt-2 space-y-3 bg-white">
                  <p className="text-xs text-gray-400">{t('profile.pwd_change_label', 'Changer de mot de passe')}</p>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder={t('profile.pwd_new', 'Nouveau mot de passe')}
                    className="w-full border border-[#d2e095] rounded-xl px-4 py-3 text-sm bg-[#faf7e8] focus:outline-none focus:border-[#a8c800]"
                  />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder={t('profile.pwd_confirm', 'Confirmer le mot de passe')}
                    className="w-full border border-[#d2e095] rounded-xl px-4 py-3 text-sm bg-[#faf7e8] focus:outline-none focus:border-[#a8c800]"
                  />
                  {passwordError && <p className="text-xs text-[#f97316]">⚠️ {passwordError}</p>}
                  {passwordSuccess && <p className="text-xs text-green-600">✅ {t('profile.pwd_success', 'Mot de passe mis à jour avec succès')}</p>}
                  <button
                    onClick={changePassword}
                    disabled={savingPassword || !newPassword || !confirmPassword}
                    className="w-full py-3 bg-[#a8c800] text-white text-sm font-semibold rounded-xl hover:bg-[#7d9800] transition disabled:opacity-50"
                  >
                    {savingPassword ? '⏳ ' + t('profile.pwd_saving', 'Enregistrement...') : '🔒 ' + t('profile.pwd_save', 'Mettre à jour le mot de passe')}
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
