'use client';

import { useState, useEffect } from 'react';
import { useCart } from '../../context/CartContext';
import { useLanguage } from '../../context/LanguageContext';
import { supabase } from '../../lib/supabase';
import Header from '../../components/Header';
import CartDrawer from '../../components/CartDrawer';
import Link from 'next/link';

const WAAFI_MERCHANT_NUMBER = '77092146';

interface SavedAddress {
  id: number;
  label: string;
  recipient_name: string;
  phone: string;
  address: string;
  is_default: boolean;
}

const LABEL_ICONS: Record<string, string> = { Maison: '🏠', Bureau: '🏢', Autre: '📍' };
// La valeur stockée en DB reste la canonique FR ; seul l'affichage est traduit.
const ADDRESS_LABELS = ['Maison', 'Bureau', 'Autre'];
const ADDR_LABEL_TKEYS: Record<string, string> = {
  Maison: 'checkout.label_home',
  Bureau: 'checkout.label_office',
  Autre:  'checkout.label_other',
};

export default function CheckoutPage() {
  const { items, total, clearCart, updateQuantity, removeItem } = useCart();
  const { ui } = useLanguage();
  const t = (key: string, fallback: string) => ui[key] || fallback;
  const addrLabelText = (lbl: string) => ADDR_LABEL_TKEYS[lbl] ? t(ADDR_LABEL_TKEYS[lbl], lbl) : lbl;

  const PAYMENT_METHODS = [
    { id: 'waafi', label: t('checkout.waafi_label', 'Waafi'),   emoji: '📱', desc: t('checkout.waafi_desc', 'Paiement mobile Waafi') },
    { id: 'cash',  label: t('checkout.cash_label',  'Espèces'), emoji: '💵', desc: t('checkout.cash_desc',  'Paiement à la livraison') },
  ];

  const [cartOpen, setCartOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [guestMode, setGuestMode] = useState(false);

  const [step, setStep] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState('waafi');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [phoneFocused, setPhoneFocused] = useState(false);
  const phoneDisplay = phoneFocused
    ? phoneDigits
    : (phoneDigits.match(/.{1,2}/g) || []).join(' ');
  const [address, setAddress] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [confirmedTotal, setConfirmedTotal] = useState(0);
  const [stockError, setStockError] = useState<{ name: string; available: number; unit: string; requested: number }[] | null>(null);

  // Demande spéciale
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Options de livraison
  const [deliveryOptions, setDeliveryOptions] = useState<{ id: number; name: string; description: string; price: number; emoji: string; is_standard: boolean }[]>([]);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<number | null>(null);
  const selectedDelivery = deliveryOptions.find(o => o.id === selectedDeliveryId) ?? null;
  const baseFee = selectedDelivery?.price ?? 0;

  // Parrainage
  const [refCodeInput, setRefCodeInput] = useState('');
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [codeValidating, setCodeValidating] = useState(false);
  const [codeError, setCodeError] = useState('');
  const [referralCredits, setReferralCredits] = useState(0);
  const [useReferralCredit, setUseReferralCredit] = useState(false);

  // Adresses sauvegardées
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [addressesLoaded, setAddressesLoaded] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<number | 'new' | null>(null);
  const [saveNewAddress, setSaveNewAddress] = useState(false);
  const [newAddressLabel, setNewAddressLabel] = useState('Maison');

  const referralActive = !!(appliedCode || (useReferralCredit && referralCredits > 0));
  const standardOption = deliveryOptions.find(o => o.is_standard);
  const referralDiscount = referralActive && standardOption ? standardOption.price : 0;
  const deliveryFee = Math.max(0, baseFee - referralDiscount);
  const orderTotal = total + deliveryFee;

  const showAddressCards = !!(user && savedAddresses.length > 0);
  const showNewAddressForm = !showAddressCards || selectedAddressId === 'new';
  const phoneValid = phoneDigits.length === 6;
  const formFilled = name.trim().length > 0 && phoneValid && address.trim().length > 0;
  const canContinueStep2 = (showAddressCards && selectedAddressId !== 'new'
    ? selectedAddressId !== null
    : formFilled) && selectedDeliveryId !== null;

  const selectSavedAddress = (addr: SavedAddress) => {
    setSelectedAddressId(addr.id);
    setName(addr.recipient_name);
    setPhoneDigits(addr.phone.replace(/\D/g, '').slice(2));
    setAddress(addr.address);
  };

  useEffect(() => {
    // Charger les options de livraison
    supabase
      .from('delivery_options')
      .select('id, name, description, price, emoji, is_standard')
      .eq('is_active', true)
      .order('sort_order')
      .order('id')
      .then(({ data }) => {
        const opts = data || [];
        setDeliveryOptions(opts);
        if (opts.length > 0) setSelectedDeliveryId(opts[0].id);
      });

    // Pré-remplir le code depuis localStorage (lien de parrainage)
    const saved = localStorage.getItem('hf_ref_code');
    if (saved) { setRefCodeInput(saved); setAppliedCode(saved); }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
      setAuthChecked(true);
      // Récupérer les crédits parrainage si connecté
      if (session?.access_token) {
        fetch('/api/referral', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }).then(r => r.ok ? r.json() : null).then(json => {
          if (json?.credits > 0) setReferralCredits(json.credits);
        }).catch(() => {});
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user || null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Charger les adresses sauvegardées quand on arrive à l'étape 2
  useEffect(() => {
    if (step !== 2 || !user || addressesLoaded) return;
    setAddressesLoaded(true);
    supabase
      .from('addresses')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        const addrs = (data || []) as SavedAddress[];
        setSavedAddresses(addrs);
        if (addrs.length > 0) {
          selectSavedAddress(addrs[0]);
        } else {
          setSelectedAddressId('new');
        }
      });
  }, [step, user, addressesLoaded]);

  const applyCode = async () => {
    const code = refCodeInput.trim().toUpperCase();
    if (!code) return;
    setCodeValidating(true);
    setCodeError('');
    try {
      const res = await fetch('/api/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, user_id: user?.id }),
      });
      const json = await res.json();
      if (json.valid) {
        setAppliedCode(code);
      } else {
        setCodeError(json.error || t('checkout.code_invalid', 'Code invalide'));
        setAppliedCode(null);
      }
    } catch {
      setCodeError(t('checkout.code_network_error', 'Erreur réseau, réessayez.'));
    } finally {
      setCodeValidating(false);
    }
  };

  const handleOrder = async () => {
    setLoading(true);
    setStockError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order: {
            user_id:              session?.user?.id || null,
            total:                orderTotal,
            delivery_fee:          deliveryFee,
            delivery_option_name:  selectedDelivery?.name ?? null,
            special_instructions:  specialInstructions.trim() || null,
            status:               'pending',
            payment_method:       paymentMethod,
            phone:   '77' + phoneDigits,
            address,
            customer_name: name,
          },
          items: items.map(item => ({
            product_id:        item.id,
            quantity:          item.quantity,
            price:             item.price,
            product_name:      item.name,
            product_image_url: item.image_url ?? null,
            product_unit:      item.unit,
            product_farm:      item.farm ?? null,
          })),
          ref_code:             appliedCode || undefined,
          use_referral_credit:  useReferralCredit && referralCredits > 0,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        if (json.error === 'stock_insufficient') { setStockError(json.items); return; }
        throw new Error(json.error || 'Erreur serveur');
      }

      setOrderId(json.order.id);
      setConfirmedTotal(orderTotal);
      if (appliedCode) localStorage.removeItem('hf_ref_code');

      // Sauvegarder la nouvelle adresse si demandé
      if (saveNewAddress && user && showNewAddressForm) {
        try {
          await supabase.from('addresses').insert({
            user_id:        user.id,
            label:          newAddressLabel,
            recipient_name: name,
            phone:          '77' + phoneDigits,
            address,
            is_default:     savedAddresses.length === 0,
          });
        } catch (_) {}
      }

      clearCart();
      setSuccess(true);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // ── Panier vide ─────────────────────────────────────────────────────────────
  if (items.length === 0 && !success) {
    return (
      <div className="min-h-screen bg-[#faf7e8]">
        <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
        <Header onCartOpen={() => setCartOpen(true)} />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <p className="text-6xl mb-4 opacity-20">🛒</p>
            <p className="text-gray-400 text-lg">{t('checkout.empty_cart', 'Votre panier est vide')}</p>
            <Link href="/" className="mt-4 inline-block text-sm text-[#7d9800] hover:underline">
              {t('checkout.back_home', "← Retour à l'accueil")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Commande confirmée ───────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen bg-[#faf7e8]">
        <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
        <Header onCartOpen={() => setCartOpen(true)} />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-md mx-auto px-6">
            <p className="text-7xl mb-6">🎉</p>
            <h2 className="text-2xl font-bold text-gray-800 mb-3">{t('checkout.confirmed', 'Commande confirmée !')}</h2>
            <p className="text-gray-400 mb-2">
              {t('checkout.order_label', 'Commande #')}{orderId ? String(orderId).slice(0, 8).toUpperCase() : ''}
            </p>
            <p className="text-gray-500 text-sm mb-6">
              {t('checkout.thanks', 'Merci pour votre commande. Vous serez contacté pour la livraison.')}
            </p>

            {paymentMethod === 'waafi' && (
              <div className="bg-[#e8f5e0] border border-[#a8c800] rounded-2xl p-4 mb-6 text-left">
                <p className="font-semibold text-[#526500] mb-1">📱 Paiement Waafi à effectuer</p>
                <p className="text-sm text-gray-600 mb-2">
                  Envoyez <span className="font-bold text-[#526500]">{confirmedTotal.toLocaleString()} Fdj</span> au numéro marchand :
                </p>
                <p className="text-2xl font-bold text-[#526500] tracking-widest text-center py-2">
                  {WAAFI_MERCHANT_NUMBER}
                </p>
                <p className="text-xs text-gray-400 text-center mt-1">Hornafresh — Djibouti</p>
              </div>
            )}

            <div className="bg-white rounded-2xl p-4 border border-[#d2e095] mb-6">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">{t('checkout.payment_method_label', 'Mode de paiement')}</span>
                <span className="font-medium">{PAYMENT_METHODS.find(p => p.id === paymentMethod)?.label}</span>
              </div>
            </div>
            <Link href="/" className="w-full block bg-[#a8c800] text-white py-4 rounded-2xl font-semibold text-lg hover:bg-[#7d9800] transition text-center">
              {t('checkout.back_home_btn', "🏠 Retour à l'accueil")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const STEPS = [
    { n: 1, label: t('checkout.step_cart',     'Panier') },
    { n: 2, label: t('checkout.step_delivery', 'Livraison') },
    { n: 3, label: t('checkout.step_payment',  'Paiement') },
    { n: 4, label: t('checkout.step_confirm',  'Confirmation') },
  ];

  return (
    <div className="min-h-screen bg-[#faf7e8]">
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
      <Header onCartOpen={() => setCartOpen(true)} />

      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">
          💳 {t('checkout.title', 'Finaliser la commande')}
        </h1>

        {/* Indicateur d'étapes */}
        <div className="flex items-start mb-8">
          {STEPS.map((s, i) => (
            <div key={s.n} className={`flex flex-col items-center ${i < STEPS.length - 1 ? 'flex-1' : ''}`}>
              <div className="flex items-center w-full">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-none transition-all
                  ${step > s.n
                    ? 'bg-[#a8c800] text-white'
                    : step === s.n
                      ? 'bg-[#526500] text-white ring-2 ring-[#a8c800] ring-offset-2'
                      : 'bg-white border-2 border-[#d2e095] text-gray-300'}`}>
                  {step > s.n ? '✓' : s.n}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 transition-all ${step > s.n ? 'bg-[#a8c800]' : 'bg-[#d2e095]'}`} />
                )}
              </div>
              <p className={`text-xs mt-1.5 font-medium text-center ${step >= s.n ? 'text-[#526500]' : 'text-gray-300'}`}>
                {s.label}
              </p>
            </div>
          ))}
        </div>

        {/* ── Étape 1 : Récapitulatif ─────────────────────────────────────── */}
        {step === 1 && (
          <div>
            <div className="bg-white rounded-3xl p-6 border border-[#d2e095] shadow-sm mb-4">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
                🛒 {t('checkout.your_order', 'Votre commande')}
              </h2>
              <div className="space-y-4">
                {items.map(item => (
                  <div key={item.id} className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-[#ecf4d5] flex-none">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl opacity-30">📷</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                      <p className="text-xs text-gray-400">{item.price.toLocaleString()} Fdj {item.unit}</p>

                      {/* Sélecteur de quantité + retrait */}
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="w-7 h-7 rounded-full border border-[#d2e095] text-[#526500] flex items-center justify-center hover:bg-[#ecf4d5] transition leading-none text-lg"
                            aria-label={t('checkout.decrease', 'Diminuer la quantité')}
                          >−</button>
                          <span className="w-6 text-center text-sm font-semibold text-gray-700">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            disabled={item.quantity >= item.stock_qty}
                            className="w-7 h-7 rounded-full border border-[#d2e095] text-[#526500] flex items-center justify-center hover:bg-[#ecf4d5] transition leading-none text-lg disabled:opacity-30 disabled:cursor-not-allowed"
                            aria-label={t('checkout.increase', 'Augmenter la quantité')}
                          >+</button>
                        </div>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="text-gray-300 hover:text-[#f97316] transition p-1"
                          aria-label={t('checkout.remove_item', 'Retirer du panier')}
                          title={t('checkout.remove_item', 'Retirer')}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                        {item.quantity >= item.stock_qty && (
                          <span className="text-[10px] text-[#f97316] font-medium">{t('checkout.max_stock', 'Stock max')}</span>
                        )}
                      </div>
                    </div>
                    <p className="text-sm font-bold text-[#7d9800] flex-none">{(item.price * item.quantity).toLocaleString()} Fdj</p>
                  </div>
                ))}
              </div>
              <div className="border-t border-[#d2e095] mt-4 pt-4 flex items-center justify-between">
                <span className="font-semibold text-gray-800">{t('checkout.total', 'Total')}</span>
                <span className="text-xl font-bold text-[#526500]">{total.toLocaleString()} Fdj</span>
              </div>
            </div>
            <Link
              href="/"
              className="w-full block text-center border-2 border-[#d2e095] text-[#526500] py-3 rounded-2xl font-semibold hover:bg-[#ecf4d5] transition mb-3"
            >
              {t('checkout.add_more', '＋ Ajouter d\'autres produits')}
            </Link>
            <button
              onClick={() => setStep(2)}
              className="w-full bg-[#a8c800] text-white py-4 rounded-2xl font-semibold text-lg hover:bg-[#7d9800] transition"
            >
              {t('checkout.continue_delivery', 'Continuer → Livraison')}
            </button>
          </div>
        )}

        {/* ── Étape 2 : Livraison ─────────────────────────────────────────── */}
        {step === 2 && (
          <div>
            <div className="bg-white rounded-3xl p-6 border border-[#d2e095] shadow-sm mb-4">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
                🚚 {t('checkout.delivery_info', 'Adresse de livraison')}
              </h2>

              {/* Cartes d'adresses sauvegardées */}
              {showAddressCards && (
                <div className="space-y-3 mb-5">
                  {savedAddresses.map(addr => (
                    <button
                      key={addr.id}
                      onClick={() => selectSavedAddress(addr)}
                      className={`w-full text-left p-4 rounded-2xl border-2 transition ${
                        selectedAddressId === addr.id
                          ? 'border-[#a8c800] bg-[#ecf4d5]'
                          : 'border-[#d2e095] bg-white hover:bg-[#faf7e8]'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl mt-0.5">{LABEL_ICONS[addr.label] ?? '📍'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="font-semibold text-gray-800 text-sm">{addrLabelText(addr.label)}</p>
                            {addr.is_default && (
                              <span className="text-xs bg-[#d2e095] text-[#526500] px-2 py-0.5 rounded-full">{t('checkout.address_default', 'Par défaut')}</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">{addr.recipient_name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">📞 {addr.phone}</p>
                          <p className="text-xs text-gray-400 mt-0.5 truncate">📍 {addr.address}</p>
                        </div>
                        {selectedAddressId === addr.id && (
                          <span className="text-[#a8c800] text-xl flex-shrink-0">✓</span>
                        )}
                      </div>
                    </button>
                  ))}

                  {/* Carte "Nouvelle adresse" */}
                  <button
                    onClick={() => {
                      setSelectedAddressId('new');
                      setName('');
                      setPhoneDigits('');
                      setAddress('');
                    }}
                    className={`w-full text-left p-4 rounded-2xl border-2 transition ${
                      selectedAddressId === 'new'
                        ? 'border-[#a8c800] bg-[#ecf4d5]'
                        : 'border-dashed border-[#d2e095] bg-white hover:bg-[#faf7e8]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">➕</span>
                      <p className="font-medium text-gray-600 text-sm">{t('checkout.new_address', 'Nouvelle adresse')}</p>
                      {selectedAddressId === 'new' && (
                        <span className="ml-auto text-[#a8c800] text-xl">✓</span>
                      )}
                    </div>
                  </button>
                </div>
              )}

              {/* Formulaire (nouvelle adresse ou pas d'adresses sauvegardées) */}
              {showNewAddressForm && (
                <div className="space-y-4">
                  {/* Type d'adresse (utilisateurs connectés uniquement) */}
                  {user && (
                    <div className="flex gap-2">
                      {ADDRESS_LABELS.map(lbl => (
                        <button
                          key={lbl}
                          onClick={() => setNewAddressLabel(lbl)}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-sm font-medium transition ${
                            newAddressLabel === lbl
                              ? 'border-[#a8c800] bg-[#ecf4d5] text-[#526500]'
                              : 'border-[#d2e095] text-gray-500 hover:bg-[#faf7e8]'
                          }`}
                        >
                          {LABEL_ICONS[lbl]} {addrLabelText(lbl)}
                        </button>
                      ))}
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium text-gray-600 mb-1 block">
                      {t('checkout.full_name', 'Nom complet *')}
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder={t('checkout.name_placeholder', 'Ex: Ahmed Hassan')}
                      className="w-full border border-[#d2e095] rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:border-[#a8c800] bg-white"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-600 mb-1 block">
                      {t('checkout.phone', 'Téléphone *')}
                    </label>
                    <div className="flex border border-[#d2e095] rounded-xl overflow-hidden focus-within:border-[#a8c800] bg-white transition">
                      <span className="flex items-center px-4 text-sm font-semibold text-gray-700 bg-[#ecf4d5] border-r border-[#d2e095] select-none">
                        77
                      </span>
                      <input
                        type="tel"
                        value={phoneDisplay}
                        onChange={e => setPhoneDigits(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        onFocus={() => setPhoneFocused(true)}
                        onBlur={() => setPhoneFocused(false)}
                        placeholder="XX XX XX"
                        maxLength={8}
                        className="flex-1 px-4 py-3 text-sm text-gray-800 bg-transparent focus:outline-none"
                      />
                    </div>
                    {!phoneFocused && phoneDigits.length > 0 && !phoneValid && (
                      <p className="text-xs text-[#f97316] mt-1.5">⚠️ {t('checkout.phone_error', 'Le numéro doit contenir 8 chiffres au total (77 + 6 chiffres)')}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-600 mb-1 block">
                      {t('checkout.delivery_address', 'Adresse *')}
                    </label>
                    <textarea
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      placeholder={t('checkout.address_placeholder', 'Ex: Quartier 4, Rue de la Paix, Djibouti-Ville')}
                      rows={3}
                      className="w-full border border-[#d2e095] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#a8c800] bg-white resize-none"
                    />
                  </div>

                  {/* Checkbox sauvegarder (connectés uniquement) */}
                  {user && (
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={saveNewAddress}
                        onChange={e => setSaveNewAddress(e.target.checked)}
                        className="w-4 h-4 accent-[#a8c800]"
                      />
                      <span className="text-sm text-gray-600">{t('checkout.save_address', 'Sauvegarder cette adresse')}</span>
                    </label>
                  )}
                </div>
              )}
            </div>

            {/* Demande spéciale */}
            <div className="bg-white rounded-3xl p-6 border border-[#d2e095] shadow-sm mb-4">
              <h2 className="text-lg font-semibold text-gray-800 mb-1">
                📝 {t('checkout.special_title', 'Demande spéciale')}
              </h2>
              <p className="text-xs text-gray-400 mb-4">
                {t('checkout.special_desc', 'Maturité des fruits et légumes, calibre des oignons… précisez tout ce qui compte pour vous.')}
              </p>
              <textarea
                value={specialInstructions}
                onChange={e => setSpecialInstructions(e.target.value)}
                placeholder={t('checkout.special_placeholder', 'Ex : tomates très mûres, oignons en demi-lune, éviter les bananes trop vertes…')}
                rows={3}
                maxLength={500}
                className="w-full border border-[#d2e095] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#a8c800] bg-white resize-none"
              />
              {specialInstructions.length > 0 && (
                <p className="text-xs text-gray-300 text-right mt-1">{specialInstructions.length}/500</p>
              )}
            </div>

            {/* Mode de livraison */}
            {deliveryOptions.length > 0 && (
              <div className="bg-white rounded-3xl p-6 border border-[#d2e095] shadow-sm mb-4">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">
                  📦 {t('checkout.delivery_mode', 'Mode de livraison')}
                </h2>
                <div className="space-y-3">
                  {deliveryOptions.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setSelectedDeliveryId(opt.id)}
                      className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition text-left ${
                        selectedDeliveryId === opt.id
                          ? 'border-[#a8c800] bg-[#ecf4d5]'
                          : 'border-[#d2e095] bg-white hover:bg-[#faf7e8]'
                      }`}
                    >
                      <span className="text-2xl flex-shrink-0">{opt.emoji}</span>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800 text-sm">{opt.name}</p>
                        {opt.description && (
                          <p className="text-xs text-gray-400 mt-0.5">{opt.description}</p>
                        )}
                      </div>
                      <span className={`text-sm font-bold flex-shrink-0 ${opt.price === 0 ? 'text-green-500' : 'text-[#526500]'}`}>
                        {opt.price === 0 ? t('checkout.free', 'Gratuit') : `${opt.price.toLocaleString()} Fdj`}
                      </span>
                      {selectedDeliveryId === opt.id && (
                        <span className="text-[#a8c800] text-xl flex-shrink-0">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 bg-white text-gray-600 py-4 rounded-2xl font-semibold border border-[#d2e095] hover:bg-[#ecf4d5] transition"
              >
                {t('checkout.back', '← Retour')}
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!canContinueStep2}
                className="flex-1 bg-[#a8c800] text-white py-4 rounded-2xl font-semibold hover:bg-[#7d9800] transition disabled:opacity-50"
              >
                {t('checkout.continue_payment', 'Continuer → Paiement')}
              </button>
            </div>
          </div>
        )}

        {/* ── Étape 3 : Garde auth ────────────────────────────────────────── */}
        {step === 3 && authChecked && !user && !guestMode && (
          <div className="bg-white rounded-3xl p-8 border border-[#d2e095] shadow-sm text-center">
            <p className="text-5xl mb-4">🔐</p>
            <h2 className="text-xl font-bold text-gray-800 mb-2">
              {t('checkout.auth_gate_title', 'Identifiez-vous pour continuer')}
            </h2>
            <p className="text-sm text-gray-400 mb-8">
              {t('checkout.auth_gate_sub', 'Connectez-vous pour suivre vos commandes, ou continuez sans compte.')}
            </p>
            <div className="flex flex-col gap-3">
              <Link
                href={`/login?redirect=/checkout`}
                className="w-full bg-[#a8c800] text-white py-3.5 rounded-2xl font-semibold hover:bg-[#7d9800] transition"
              >
                {t('checkout.auth_signin', "🔑 Se connecter / S'inscrire")}
              </Link>
              <button
                onClick={() => { setGuestMode(true); setSelectedAddressId('new'); }}
                className="w-full bg-white border border-[#d2e095] text-gray-600 py-3.5 rounded-2xl font-semibold hover:bg-[#ecf4d5] transition"
              >
                {t('checkout.auth_guest', 'Continuer sans compte →')}
              </button>
              <button onClick={() => setStep(2)} className="text-sm text-gray-400 hover:text-gray-600 mt-1">
                {t('checkout.back', '← Retour')}
              </button>
            </div>
          </div>
        )}

        {/* ── Étape 3 : Paiement ──────────────────────────────────────────── */}
        {step === 3 && authChecked && (user || guestMode) && (
          <div>
            <div className="bg-white rounded-3xl p-6 border border-[#d2e095] shadow-sm mb-4">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
                💳 {t('checkout.payment_title', 'Mode de paiement')}
              </h2>

              <div className="space-y-3">
                {PAYMENT_METHODS.map(method => (
                  <button
                    key={method.id}
                    onClick={() => setPaymentMethod(method.id)}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition text-left ${
                      paymentMethod === method.id
                        ? 'border-[#a8c800] bg-[#ecf4d5]'
                        : 'border-[#d2e095] bg-white hover:bg-[#faf7e8]'
                    }`}
                  >
                    <span className="text-3xl">{method.emoji}</span>
                    <div>
                      <p className="font-semibold text-gray-800">{method.label}</p>
                      <p className="text-xs text-gray-400">{method.desc}</p>
                    </div>
                    {paymentMethod === method.id && (
                      <span className="ml-auto text-[#a8c800] text-xl flex-shrink-0">✓</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Instructions Waafi */}
              {paymentMethod === 'waafi' && (
                <div className="mt-4 rounded-2xl overflow-hidden border border-[#a8c800]">
                  <div className="bg-[#526500] px-5 py-3 flex items-center gap-3">
                    <span className="text-2xl">📱</span>
                    <span className="text-white font-bold text-lg tracking-wide">WAAFI</span>
                  </div>
                  <div className="bg-[#f0f8e8] px-5 py-4">
                    <p className="text-sm text-gray-600 mb-3">
                      {t('checkout.waafi_manual_instructions', 'Envoyez le montant total à notre compte Waafi, puis confirmez votre commande.')}
                    </p>
                    <div className="bg-white rounded-xl p-3 border border-[#d2e095] text-center mb-3">
                      <p className="text-xs text-gray-400 mb-1">{t('checkout.waafi_merchant_label', 'Numéro Waafi marchand')}</p>
                      <p className="text-3xl font-bold text-[#526500] tracking-widest">{WAAFI_MERCHANT_NUMBER}</p>
                      <p className="text-xs text-gray-400 mt-1">Salah Omar (Hornafresh — Djibouti)</p>
                    </div>
                    <div className="flex items-center justify-between bg-white rounded-xl p-3 border border-[#d2e095]">
                      <span className="text-sm text-gray-600">{t('checkout.waafi_amount_label', 'Montant à envoyer')}</span>
                      <span className="text-lg font-bold text-[#526500]">{orderTotal.toLocaleString()} Fdj</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-3 leading-relaxed">
                      {t('checkout.waafi_manual_note', '⚠️ Votre commande sera traitée après confirmation du paiement par notre équipe.')}
                    </p>
                  </div>
                </div>
              )}

              {/* Code parrainage */}
              <div className="mt-5 pt-5 border-t border-[#d2e095]">
                <p className="text-sm font-medium text-gray-600 mb-3">
                  🎁 {t('checkout.referral_code_label', 'Code parrainage')}
                </p>
                {appliedCode ? (
                  <div className="flex items-center gap-3 p-3.5 bg-[#ecf4d5] border border-[#a8c800] rounded-xl">
                    <span className="text-[#a8c800] text-xl font-bold flex-shrink-0">✓</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[#526500]">
                        {t('checkout.referral_applied', 'Code')} <span className="tracking-widest">{appliedCode}</span> {t('checkout.referral_applied2', 'appliqué')}
                      </p>
                      <p className="text-xs text-gray-500">{t('checkout.referral_applied_desc', 'Livraison offerte sur cette commande.')}</p>
                    </div>
                    <button
                      onClick={() => { setAppliedCode(null); setRefCodeInput(''); setCodeError(''); }}
                      className="text-gray-400 hover:text-gray-600 transition text-lg leading-none"
                      aria-label={t('checkout.remove_code', 'Retirer le code')}
                    >✕</button>
                  </div>
                ) : (
                  <div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={refCodeInput}
                        onChange={e => { setRefCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')); setCodeError(''); }}
                        onKeyDown={e => e.key === 'Enter' && applyCode()}
                        placeholder={t('checkout.referral_placeholder', 'Ex: R4K7NP')}
                        maxLength={8}
                        className="flex-1 border border-[#d2e095] rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:border-[#a8c800] tracking-widest uppercase"
                      />
                      <button
                        onClick={applyCode}
                        disabled={!refCodeInput.trim() || codeValidating}
                        className="px-5 py-3 bg-[#a8c800] text-white text-sm font-semibold rounded-xl hover:bg-[#7d9800] transition disabled:opacity-40 whitespace-nowrap"
                      >
                        {codeValidating ? '⏳' : t('checkout.referral_apply', 'Appliquer')}
                      </button>
                    </div>
                    {codeError && (
                      <p className="text-xs text-[#f97316] mt-1.5">⚠️ {codeError}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Crédit parrainage (utilisateurs avec crédits gagnés) */}
              {referralCredits > 0 && !appliedCode && (
                <label className="mt-3 flex items-center gap-3 p-3.5 bg-[#ecf4d5] border border-[#a8c800] rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useReferralCredit}
                    onChange={e => setUseReferralCredit(e.target.checked)}
                    className="w-4 h-4 accent-[#a8c800] flex-shrink-0"
                  />
                  <div>
                    <p className="font-semibold text-[#526500] text-sm">
                      🎁 {t('checkout.use_credit', 'Utiliser mon crédit parrainage')}
                    </p>
                    <p className="text-xs text-gray-500">
                      {referralCredits} {t('checkout.credit_available', referralCredits > 1 ? 'livraisons offertes disponibles' : 'livraison offerte disponible')}
                    </p>
                  </div>
                </label>
              )}

              {/* Récapitulatif montant */}
              <div className="border-t border-[#d2e095] mt-6 pt-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{t('checkout.subtotal', 'Sous-total')}</span>
                  <span className="font-medium">{total.toLocaleString()} Fdj</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">
                    {t('checkout.delivery_label', 'Livraison')}
                    {selectedDelivery && <span className="text-gray-400"> — {selectedDelivery.name}</span>}
                  </span>
                  {deliveryFee === 0 ? (
                    <span className="font-medium text-green-500">
                      {baseFee > 0 ? <>{t('checkout.delivery_offered', 'Offerte')} 🎁</> : t('checkout.free', 'Gratuite')}
                    </span>
                  ) : referralDiscount > 0 ? (
                    <span className="font-medium flex items-center gap-1.5">
                      <span className="line-through text-gray-400">{baseFee.toLocaleString()} Fdj</span>
                      <span className="text-[#526500]">{deliveryFee.toLocaleString()} Fdj</span>
                      <span>🎁</span>
                    </span>
                  ) : (
                    <span className="font-medium">{deliveryFee.toLocaleString()} Fdj</span>
                  )}
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-[#f0f0f0]">
                  <span className="font-bold text-gray-800">{t('checkout.total', 'Total')}</span>
                  <span className="text-xl font-bold text-[#526500]">{orderTotal.toLocaleString()} Fdj</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 bg-white text-gray-600 py-4 rounded-2xl font-semibold border border-[#d2e095] hover:bg-[#ecf4d5] transition"
              >
                {t('checkout.back', '← Retour')}
              </button>
              <button
                onClick={() => setStep(4)}
                className="flex-1 bg-[#a8c800] text-white py-4 rounded-2xl font-semibold hover:bg-[#7d9800] transition"
              >
                {t('checkout.continue_confirm', 'Continuer →')}
              </button>
            </div>
          </div>
        )}

        {/* ── Étape 4 : Confirmation ──────────────────────────────────────── */}
        {step === 4 && (
          <div>
            {/* Récapitulatif complet */}
            <div className="bg-[#f4f9e8] rounded-3xl border-2 border-[#a8c800] shadow-sm mb-4 overflow-hidden">
              <div className="bg-[#526500] px-6 py-3 flex items-center gap-2">
                <span className="text-white text-base">📋</span>
                <h2 className="text-base font-bold text-white">{t('checkout.recap_title', 'Récapitulatif de votre commande')}</h2>
              </div>
              <div className="p-6 space-y-4">

                {/* Articles */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">🛒 {t('checkout.your_order', 'Articles')}</p>
                    <button onClick={() => setStep(1)} className="text-xs text-[#7d9800] hover:underline">{t('checkout.edit', 'Modifier')}</button>
                  </div>
                  <div className="space-y-2">
                    {items.map(item => (
                      <div key={item.id} className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#ecf4d5] flex-none">
                          {item.image_url
                            ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-base opacity-30">📷</div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                          <p className="text-xs text-gray-400">x{item.quantity} · {item.price.toLocaleString()} Fdj {item.unit}</p>
                        </div>
                        <p className="text-sm font-bold text-[#7d9800] flex-none">{(item.price * item.quantity).toLocaleString()} Fdj</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-[#d2e095]" />

                {/* Adresse */}
                <div className="flex items-start gap-3">
                  <span className="text-base mt-0.5 flex-none">📍</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{t('checkout.delivery_address', 'Adresse de livraison')}</p>
                    <p className="text-sm font-medium text-gray-800">{name}</p>
                    <p className="text-xs text-gray-500">77 {(phoneDigits.match(/.{1,2}/g) || []).join(' ')}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{address}</p>
                  </div>
                  <button onClick={() => setStep(2)} className="text-xs text-[#7d9800] hover:underline flex-none">{t('checkout.edit', 'Modifier')}</button>
                </div>

                {/* Mode de livraison */}
                {selectedDelivery && (
                  <div className="flex items-center gap-3">
                    <span className="text-base flex-none">{selectedDelivery.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{t('checkout.delivery_mode', 'Livraison')}</p>
                      <p className="text-sm text-gray-800">{selectedDelivery.name}</p>
                    </div>
                    <p className="text-sm font-bold flex-none">
                      {deliveryFee === 0
                        ? <span className="text-green-500">{baseFee > 0 ? t('checkout.delivery_offered', 'Offerte') + ' 🎁' : t('checkout.free', 'Gratuite')}</span>
                        : <span className="text-[#526500]">{deliveryFee.toLocaleString()} Fdj</span>}
                    </p>
                  </div>
                )}

                {/* Demande spéciale */}
                {specialInstructions.trim() && (
                  <div className="flex items-start gap-3">
                    <span className="text-base flex-none mt-0.5">📝</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{t('checkout.special_title', 'Demande spéciale')}</p>
                      <p className="text-xs text-gray-600 leading-relaxed">{specialInstructions}</p>
                    </div>
                    <button onClick={() => setStep(2)} className="text-xs text-[#7d9800] hover:underline flex-none">{t('checkout.edit', 'Modifier')}</button>
                  </div>
                )}

                <div className="border-t border-[#d2e095]" />

                {/* Mode de paiement */}
                <div className="flex items-center gap-3">
                  <span className="text-base flex-none">{PAYMENT_METHODS.find(p => p.id === paymentMethod)?.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{t('checkout.payment_method_label', 'Paiement')}</p>
                    <p className="text-sm text-gray-800">{PAYMENT_METHODS.find(p => p.id === paymentMethod)?.label}</p>
                  </div>
                  <button onClick={() => setStep(3)} className="text-xs text-[#7d9800] hover:underline flex-none">{t('checkout.edit', 'Modifier')}</button>
                </div>

                {/* Promo / crédit */}
                {(appliedCode || (useReferralCredit && referralCredits > 0)) && (
                  <div className="flex items-center gap-3">
                    <span className="text-base flex-none">🎁</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{t('checkout.referral_code_label', 'Avantage')}</p>
                      <p className="text-sm text-[#526500] font-medium">
                        {appliedCode ? `${t('checkout.referral_applied', 'Code')} ${appliedCode}` : t('checkout.use_credit', 'Crédit parrainage')} — {t('checkout.delivery_offered', 'Livraison offerte')} 🎁
                      </p>
                    </div>
                    <button onClick={() => setStep(3)} className="text-xs text-[#7d9800] hover:underline flex-none">{t('checkout.edit', 'Modifier')}</button>
                  </div>
                )}

                <div className="border-t border-[#d2e095]" />

                {/* Total */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">{t('checkout.subtotal', 'Sous-total')}</span>
                    <span className="font-medium">{total.toLocaleString()} Fdj</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">{t('checkout.delivery_label', 'Livraison')}{selectedDelivery && <span className="text-gray-400"> — {selectedDelivery.name}</span>}</span>
                    {deliveryFee === 0
                      ? <span className="font-medium text-green-500">{baseFee > 0 ? <>{t('checkout.delivery_offered', 'Offerte')} 🎁</> : t('checkout.free', 'Gratuite')}</span>
                      : referralDiscount > 0
                        ? <span className="font-medium flex items-center gap-1.5"><span className="line-through text-gray-400">{baseFee.toLocaleString()} Fdj</span><span className="text-[#526500]">{deliveryFee.toLocaleString()} Fdj</span><span>🎁</span></span>
                        : <span className="font-medium">{deliveryFee.toLocaleString()} Fdj</span>}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-[#d2e095]">
                    <span className="font-bold text-gray-800 text-base">{t('checkout.total', 'Total')}</span>
                    <span className="text-2xl font-bold text-[#526500]">{orderTotal.toLocaleString()} Fdj</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Erreur stock */}
            {stockError && (
              <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-2">
                <p className="text-[#f97316] font-semibold text-sm mb-2">⚠️ {t('checkout.stock_error', 'Stock insuffisant pour certains articles :')}</p>
                <ul className="space-y-1">
                  {stockError.map((item, i) => (
                    <li key={i} className="text-sm text-[#f97316]">
                      <span className="font-medium">{item.name}</span> — {t('checkout.qty_requested', 'demandé')} : {item.requested} {item.unit}, {t('checkout.qty_available', 'disponible')} : {item.available} {item.unit}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-orange-400 mt-2">{t('checkout.stock_adjust', 'Ajustez les quantités dans votre panier.')}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep(3)}
                className="flex-1 bg-white text-gray-600 py-4 rounded-2xl font-semibold border border-[#d2e095] hover:bg-[#ecf4d5] transition"
              >
                {t('checkout.back', '← Retour')}
              </button>
              <button
                onClick={handleOrder}
                disabled={loading}
                className="flex-1 bg-[#a8c800] text-white py-4 rounded-2xl font-semibold hover:bg-[#7d9800] transition disabled:opacity-50"
              >
                {loading
                  ? t('checkout.processing', '⏳ Traitement...')
                  : t('checkout.confirm', '✅ Confirmer la commande')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
