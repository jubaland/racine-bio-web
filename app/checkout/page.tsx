'use client';

import { useState, useEffect } from 'react';
import { useCart } from '../../context/CartContext';
import { useLanguage } from '../../context/LanguageContext';
import { supabase } from '../../lib/supabase';
import Header from '../../components/Header';
import Link from 'next/link';

const WAAFI_MERCHANT_NUMBER = '77432615';

export default function CheckoutPage() {
  const { items, total, clearCart } = useCart();
  const { ui } = useLanguage();
  const t = (key: string, fallback: string) => ui[key] || fallback;

  const PAYMENT_METHODS = [
    { id: 'waafi', label: t('checkout.waafi_label', 'Waafi'),   emoji: '📱', desc: t('checkout.waafi_desc', 'Paiement mobile Waafi') },
    { id: 'cash',  label: t('checkout.cash_label',  'Espèces'), emoji: '💵', desc: t('checkout.cash_desc',  'Paiement à la livraison') },
  ];

  const [user, setUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [guestMode, setGuestMode] = useState(false);

  const [step, setStep] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [phone, setPhone] = useState('77');
  const [address, setAddress] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [confirmedTotal, setConfirmedTotal] = useState(0);
  const [stockError, setStockError] = useState<{ name: string; available: number; unit: string; requested: number }[] | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
      setAuthChecked(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user || null);
    });
    return () => subscription.unsubscribe();
  }, []);

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
            user_id:        session?.user?.id || null,
            total,
            status:         'pending',
            payment_method: paymentMethod,
            phone,
            address,
            customer_name:  name,
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
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        if (json.error === 'stock_insufficient') { setStockError(json.items); return; }
        throw new Error(json.error || 'Erreur serveur');
      }

      setOrderId(json.order.id);
      setConfirmedTotal(total);
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
        <Header onCartOpen={() => {}} />
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
        <Header onCartOpen={() => {}} />
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

            {/* Rappel paiement Waafi */}
            {paymentMethod === 'waafi' && (
              <div className="bg-[#e8f5e0] border border-[#a8c800] rounded-2xl p-4 mb-6 text-left">
                <p className="font-semibold text-[#526500] mb-1">📱 Paiement Waafi à effectuer</p>
                <p className="text-sm text-gray-600 mb-2">
                  Envoyez <span className="font-bold text-[#526500]">{confirmedTotal.toLocaleString()} Fdj</span> au numéro :
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
    { n: 1, label: t('checkout.step_recap',    'Récapitulatif') },
    { n: 2, label: t('checkout.step_delivery', 'Livraison') },
    { n: 3, label: t('checkout.step_payment',  'Paiement') },
  ];

  return (
    <div className="min-h-screen bg-[#faf7e8]">
      <Header onCartOpen={() => {}} />

      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">
          💳 {t('checkout.title', 'Finaliser la commande')}
        </h1>

        {/* Indicateur d'étapes */}
        <div className="flex items-center gap-2 md:gap-4 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.n} className="flex items-center gap-1.5 md:gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-none ${step >= s.n ? 'bg-[#a8c800] text-white' : 'bg-white border border-[#d2e095] text-gray-400'}`}>
                {s.n}
              </div>
              <span className={`text-xs md:text-sm hidden sm:inline ${step >= s.n ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>{s.label}</span>
              {i < 2 && <span className="text-gray-300 ml-1 md:ml-2">›</span>}
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
              <div className="space-y-3">
                {items.map(item => (
                  <div key={item.id} className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-[#ecf4d5] flex-none">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl opacity-30">📷</div>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">{item.name}</p>
                      <p className="text-xs text-gray-400">x{item.quantity} · {item.price.toLocaleString()} Fdj {item.unit}</p>
                    </div>
                    <p className="text-sm font-bold text-[#7d9800]">{(item.price * item.quantity).toLocaleString()} Fdj</p>
                  </div>
                ))}
              </div>
              <div className="border-t border-[#d2e095] mt-4 pt-4 flex items-center justify-between">
                <span className="font-semibold text-gray-800">{t('checkout.total', 'Total')}</span>
                <span className="text-xl font-bold text-[#526500]">{total.toLocaleString()} Fdj</span>
              </div>
            </div>
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
                🚚 {t('checkout.delivery_info', 'Informations de livraison')}
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-600 mb-1 block">
                    {t('checkout.full_name', 'Nom complet *')}
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder={t('checkout.name_placeholder', 'Ex: Ahmed Hassan')}
                    className="w-full border border-[#d2e095] rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:border-[#a8c800] bg-[#faf7e8]"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 mb-1 block">
                    {t('checkout.phone', 'Téléphone *')}
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder={t('checkout.phone_placeholder', 'XX XX XX (6 chiffres restants)')}
                    className="w-full border border-[#d2e095] rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:border-[#a8c800] bg-[#faf7e8]"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 mb-1 block">
                    {t('checkout.delivery_address', 'Adresse de livraison *')}
                  </label>
                  <textarea
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    placeholder={t('checkout.address_placeholder', 'Ex: Quartier 4, Rue de la Paix, Djibouti-Ville')}
                    rows={3}
                    className="w-full border border-[#d2e095] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#a8c800] bg-[#faf7e8] resize-none"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 bg-white text-gray-600 py-4 rounded-2xl font-semibold border border-[#d2e095] hover:bg-[#ecf4d5] transition"
              >
                {t('checkout.back', '← Retour')}
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!name || !phone || !address}
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
                onClick={() => setGuestMode(true)}
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

              {/* Instructions Waafi manuel */}
              {paymentMethod === 'waafi' && (
                <div className="mt-4 rounded-2xl overflow-hidden border border-[#a8c800]">
                  {/* En-tête vert Waafi */}
                  <div className="bg-[#526500] px-5 py-3 flex items-center gap-3">
                    <span className="text-2xl">📱</span>
                    <span className="text-white font-bold text-lg tracking-wide">WAAFI</span>
                  </div>
                  {/* Corps */}
                  <div className="bg-[#f0f8e8] px-5 py-4">
                    <p className="text-sm text-gray-600 mb-3">
                      {t('checkout.waafi_manual_instructions', 'Envoyez le montant total à notre compte Waafi, puis confirmez votre commande.')}
                    </p>
                    <div className="bg-white rounded-xl p-3 border border-[#d2e095] text-center mb-3">
                      <p className="text-xs text-gray-400 mb-1">{t('checkout.waafi_merchant_label', 'Numéro Waafi marchand')}</p>
                      <p className="text-3xl font-bold text-[#526500] tracking-widest">{WAAFI_MERCHANT_NUMBER}</p>
                      <p className="text-xs text-gray-400 mt-1">Hornafresh — Djibouti</p>
                    </div>
                    <div className="flex items-center justify-between bg-white rounded-xl p-3 border border-[#d2e095]">
                      <span className="text-sm text-gray-600">{t('checkout.waafi_amount_label', 'Montant à envoyer')}</span>
                      <span className="text-lg font-bold text-[#526500]">{total.toLocaleString()} Fdj</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-3 leading-relaxed">
                      {t('checkout.waafi_manual_note', '⚠️ Votre commande sera traitée après confirmation du paiement par notre équipe.')}
                    </p>
                  </div>
                </div>
              )}

              {/* Récapitulatif montant */}
              <div className="border-t border-[#d2e095] mt-6 pt-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{t('checkout.subtotal', 'Sous-total')}</span>
                  <span className="font-medium">{total.toLocaleString()} Fdj</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{t('checkout.delivery_label', 'Livraison')}</span>
                  <span className="font-medium text-green-500">{t('checkout.free', 'Gratuite')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-800">{t('checkout.total', 'Total')}</span>
                  <span className="text-xl font-bold text-[#526500]">{total.toLocaleString()} Fdj</span>
                </div>
              </div>
            </div>

            {/* Erreur stock */}
            {stockError && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-2">
                <p className="text-red-700 font-semibold text-sm mb-2">⚠️ {t('checkout.stock_error', 'Stock insuffisant pour certains articles :')}</p>
                <ul className="space-y-1">
                  {stockError.map((item, i) => (
                    <li key={i} className="text-sm text-red-600">
                      <span className="font-medium">{item.name}</span> — demandé : {item.requested} {item.unit}, disponible : {item.available} {item.unit}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-red-400 mt-2">{t('checkout.stock_adjust', 'Ajustez les quantités dans votre panier.')}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
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
