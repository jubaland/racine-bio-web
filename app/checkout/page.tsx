'use client';

import { useState } from 'react';
import { useCart } from '../../context/CartContext';
import { useLanguage } from '../../context/LanguageContext';
import { supabase } from '../../lib/supabase';
import Header from '../../components/Header';
import Link from 'next/link';

const PAYMENT_METHODS = [
  { id: 'waafi', label: 'Waafi', emoji: '📱', desc: 'Paiement mobile Waafi' },
  { id: 'dmoney', label: 'D-Money', emoji: '💳', desc: 'Paiement mobile D-Money' },
  { id: 'cash', label: 'Espèces', emoji: '💵', desc: 'Paiement à la livraison' },
];

export default function CheckoutPage() {
  const { items, total, clearCart } = useCart();
  const { ui } = useLanguage();
  const t = (key: string, fallback: string) => ui[key] || fallback;

  const [step, setStep] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState<number | null>(null);

  const handleOrder = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const { data: order, error } = await supabase
        .from('orders')
        .insert({
          user_id: session?.user?.id || null,
          total: total,
          status: 'pending',
          payment_method: paymentMethod,
          phone: phone,
          address: address,
          customer_name: name,
        })
        .select()
        .single();

      if (error) throw error;

      // Ajouter les articles de la commande
      const orderItems = items.map(item => ({
        order_id: order.id,
        product_id: item.id,
        quantity: item.quantity,
        price: item.price,
      }));

      await supabase.from('order_items').insert(orderItems);

      setOrderId(order.id);
      clearCart();
      setSuccess(true);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0 && !success) {
    return (
      <div className="min-h-screen bg-[#f8faf0]">
        <Header onCartOpen={() => {}} />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <p className="text-6xl mb-4 opacity-20">🛒</p>
            <p className="text-gray-400 text-lg">Votre panier est vide</p>
            <Link href="/" className="mt-4 inline-block text-sm text-[#7d9800] hover:underline">
              ← Retour à l'accueil
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#f8faf0]">
        <Header onCartOpen={() => {}} />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-md mx-auto px-6">
            <p className="text-7xl mb-6">🎉</p>
            <h2 className="text-2xl font-bold text-gray-800 mb-3">Commande confirmée !</h2>
            <p className="text-gray-400 mb-2">Commande #{orderId}</p>
            <p className="text-gray-500 text-sm mb-8">
              Merci pour votre commande. Vous serez contacté pour la livraison.
            </p>
            <div className="bg-white rounded-2xl p-4 border border-[#dde8b0] mb-6">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Mode de paiement</span>
                <span className="font-medium">{PAYMENT_METHODS.find(p => p.id === paymentMethod)?.label}</span>
              </div>
            </div>
            <Link href="/" className="w-full block bg-[#a8c800] text-white py-4 rounded-2xl font-semibold text-lg hover:bg-[#7d9800] transition text-center">
              🏠 Retour à l'accueil
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8faf0]">
      <Header onCartOpen={() => {}} />

      <div className="max-w-3xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">💳 Finaliser la commande</h1>

        {/* Steps */}
        <div className="flex items-center gap-4 mb-8">
          {[
            { n: 1, label: 'Récapitulatif' },
            { n: 2, label: 'Livraison' },
            { n: 3, label: 'Paiement' },
          ].map((s, i) => (
            <div key={s.n} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= s.n ? 'bg-[#a8c800] text-white' : 'bg-white border border-[#dde8b0] text-gray-400'}`}>
                {s.n}
              </div>
              <span className={`text-sm ${step >= s.n ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>{s.label}</span>
              {i < 2 && <span className="text-gray-300 ml-2">›</span>}
            </div>
          ))}
        </div>

        {/* Step 1 — Récapitulatif */}
        {step === 1 && (
          <div>
            <div className="bg-white rounded-3xl p-6 border border-[#dde8b0] shadow-sm mb-4">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">🛒 Votre commande</h2>
              <div className="space-y-3">
                {items.map(item => (
                  <div key={item.id} className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-[#f0f7e8] flex-none">
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
              <div className="border-t border-[#dde8b0] mt-4 pt-4 flex items-center justify-between">
                <span className="font-semibold text-gray-800">Total</span>
                <span className="text-xl font-bold text-[#526500]">{total.toLocaleString()} Fdj</span>
              </div>
            </div>
            <button
              onClick={() => setStep(2)}
              className="w-full bg-[#a8c800] text-white py-4 rounded-2xl font-semibold text-lg hover:bg-[#7d9800] transition"
            >
              Continuer → Livraison
            </button>
          </div>
        )}

        {/* Step 2 — Livraison */}
        {step === 2 && (
          <div>
            <div className="bg-white rounded-3xl p-6 border border-[#dde8b0] shadow-sm mb-4">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">🚚 Informations de livraison</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-600 mb-1 block">Nom complet *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Ex: Ahmed Hassan"
                    className="w-full border border-[#dde8b0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#a8c800] bg-[#f8faf0]"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 mb-1 block">Téléphone *</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="Ex: 77 XX XX XX"
                    className="w-full border border-[#dde8b0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#a8c800] bg-[#f8faf0]"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 mb-1 block">Adresse de livraison *</label>
                  <textarea
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    placeholder="Ex: Quartier 4, Rue de la Paix, Djibouti-Ville"
                    rows={3}
                    className="w-full border border-[#dde8b0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#a8c800] bg-[#f8faf0] resize-none"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 bg-white text-gray-600 py-4 rounded-2xl font-semibold border border-[#dde8b0] hover:bg-[#f0f7e8] transition"
              >
                ← Retour
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!name || !phone || !address}
                className="flex-1 bg-[#a8c800] text-white py-4 rounded-2xl font-semibold hover:bg-[#7d9800] transition disabled:opacity-50"
              >
                Continuer → Paiement
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Paiement */}
        {step === 3 && (
          <div>
            <div className="bg-white rounded-3xl p-6 border border-[#dde8b0] shadow-sm mb-4">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">💳 Mode de paiement</h2>
              <div className="space-y-3">
                {PAYMENT_METHODS.map(method => (
                  <button
                    key={method.id}
                    onClick={() => setPaymentMethod(method.id)}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition ${paymentMethod === method.id ? 'border-[#a8c800] bg-[#f0f7e8]' : 'border-[#dde8b0] bg-white hover:bg-[#f8faf0]'}`}
                  >
                    <span className="text-3xl">{method.emoji}</span>
                    <div className="text-left">
                      <p className="font-semibold text-gray-800">{method.label}</p>
                      <p className="text-xs text-gray-400">{method.desc}</p>
                    </div>
                    {paymentMethod === method.id && (
                      <span className="ml-auto text-[#a8c800] text-xl">✓</span>
                    )}
                  </button>
                ))}
              </div>

              {(paymentMethod === 'waafi' || paymentMethod === 'dmoney') && (
                <div className="mt-4">
                  <label className="text-sm font-medium text-gray-600 mb-1 block">Numéro {paymentMethod === 'waafi' ? 'Waafi' : 'D-Money'}</label>
                  <input
                    type="tel"
                    placeholder="Ex: 77 XX XX XX"
                    className="w-full border border-[#dde8b0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#a8c800] bg-[#f8faf0]"
                  />
                </div>
              )}

              <div className="border-t border-[#dde8b0] mt-6 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600">Sous-total</span>
                  <span className="font-medium">{total.toLocaleString()} Fdj</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600">Livraison</span>
                  <span className="font-medium text-green-500">Gratuite</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-800">Total</span>
                  <span className="text-xl font-bold text-[#526500]">{total.toLocaleString()} Fdj</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 bg-white text-gray-600 py-4 rounded-2xl font-semibold border border-[#dde8b0] hover:bg-[#f0f7e8] transition"
              >
                ← Retour
              </button>
              <button
                onClick={handleOrder}
                disabled={loading}
                className="flex-1 bg-[#a8c800] text-white py-4 rounded-2xl font-semibold hover:bg-[#7d9800] transition disabled:opacity-50"
              >
                {loading ? '⏳ Traitement...' : '✅ Confirmer la commande'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 
