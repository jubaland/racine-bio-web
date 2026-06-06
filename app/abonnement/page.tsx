'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase, fetchProducts } from '../../lib/supabase';
import { useLanguage } from '../../context/LanguageContext';
import Header from '../../components/Header';
import CartDrawer from '../../components/CartDrawer';

export default function SubscriptionPage() {
  const { ui, productTranslations, currentLang } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;

  const [cartOpen, setCartOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [qty, setQty] = useState<Record<number, number>>({});
  const [deliveryDay, setDeliveryDay] = useState(1);
  const [active, setActive] = useState(false);
  const [balance, setBalance] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const DAYS = [
    t('sub.day_0', 'Dimanche'), t('sub.day_1', 'Lundi'), t('sub.day_2', 'Mardi'),
    t('sub.day_3', 'Mercredi'), t('sub.day_4', 'Jeudi'), t('sub.day_5', 'Vendredi'), t('sub.day_6', 'Samedi'),
  ];

  const getName = (p: any) =>
    (currentLang !== 'fr' && productTranslations[p.id]?.name) ? productTranslations[p.id].name : p.name;

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = '/login?redirect=/abonnement'; return; }
      setUser(session.user);

      const prods = await fetchProducts();
      setProducts(prods);

      const [{ data: sub }, { data: items }, { data: w }] = await Promise.all([
        supabase.from('subscriptions').select('*').eq('user_id', session.user.id).maybeSingle(),
        supabase.from('subscription_items').select('product_id, quantity').eq('user_id', session.user.id),
        supabase.from('wallets').select('balance').eq('user_id', session.user.id).maybeSingle(),
      ]);
      if (sub) { setDeliveryDay(sub.delivery_day); setActive(sub.active && !sub.paused); }
      const q: Record<number, number> = {};
      (items || []).forEach((it: any) => { q[it.product_id] = Number(it.quantity); });
      setQty(q);
      setBalance(Number(w?.balance) || 0);
      setLoading(false);
    })();
  }, []);

  const setQ = (id: number, v: number) => { setSaved(false); setQty(prev => ({ ...prev, [id]: Math.max(0, v) })); };

  const basket = products.filter(p => (qty[p.id] || 0) > 0);
  const total = basket.reduce((s, p) => s + Number(p.price) * (qty[p.id] || 0), 0);
  const weeks = total > 0 ? Math.floor(balance / total) : 0;

  const save = async () => {
    setError(''); setSaved(false);
    if (active && basket.length === 0) {
      setError(t('sub.err_empty', 'Ajoutez au moins un produit pour activer votre commande type.'));
      return;
    }
    setSaving(true);
    const { error: e1 } = await supabase.from('subscriptions').upsert({
      user_id: user.id, delivery_day: deliveryDay, active, paused: false,
      updated_at: new Date().toISOString(),
    });
    if (e1) { setSaving(false); setError(e1.message); return; }

    const { error: e2 } = await supabase.from('subscription_items').delete().eq('user_id', user.id);
    if (e2) { setSaving(false); setError(e2.message); return; }

    if (basket.length > 0) {
      const { error: e3 } = await supabase.from('subscription_items').insert(
        basket.map(p => ({ user_id: user.id, product_id: p.id, quantity: qty[p.id] }))
      );
      if (e3) { setSaving(false); setError(e3.message); return; }
    }
    setSaving(false);
    setSaved(true);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#faf7e8]">
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
      <Header onCartOpen={() => setCartOpen(true)} />

      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <Link href="/profile" className="inline-flex items-center gap-1.5 bg-white border border-[#d2e095] text-[#526500] text-sm font-semibold px-4 py-2 rounded-full hover:bg-[#ecf4d5] hover:border-[#a8c800] transition shadow-sm">
          <span className="text-base leading-none">←</span> {t('sub.back', 'Mon profil')}
        </Link>
        <h1 className="text-2xl font-bold text-gray-800 mt-4 mb-1">🔄 {t('sub.title', 'Ma commande type')}</h1>
        <p className="text-gray-500 text-sm mb-6">{t('sub.subtitle', 'Composez votre panier livré automatiquement chaque semaine, débité de votre cagnotte.')}</p>

        {loading ? (
          <p className="text-gray-400 text-center py-12">{t('admin.loading', 'Chargement...')}</p>
        ) : (
          <>
            {saved && (
              <div className="bg-green-50 border border-green-200 text-[#526500] rounded-2xl px-4 py-3 mb-5 text-sm font-semibold">
                ✅ {t('sub.saved_msg', 'Votre commande type a été enregistrée.')}
              </div>
            )}

            {/* Cagnotte */}
            <div className="bg-gradient-to-br from-[#1c3a05] via-[#2d6410] to-[#7a5800] rounded-2xl p-4 text-white mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-[#c8e050] uppercase tracking-wide">💰 {t('profile.wallet', 'Ma cagnotte')}</p>
                <p className="text-2xl font-extrabold">{balance.toLocaleString()} Fdj</p>
              </div>
              <Link href="/profile" className="text-xs bg-white/15 px-3 py-1.5 rounded-full hover:bg-white/25 transition">{t('sub.topup', 'Recharger')}</Link>
            </div>

            {/* Produits */}
            <div className="bg-white rounded-3xl p-5 border border-[#d2e095] shadow-sm mb-5">
              <h2 className="font-semibold text-gray-800 mb-3">🛒 {t('sub.basket', 'Mon panier hebdomadaire')}</h2>
              <div className="divide-y divide-[#f0f7e0]">
                {products.map(p => (
                  <div key={p.id} className="flex items-center gap-3 py-3">
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#ecf4d5] flex-none">
                      {p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center opacity-30">📷</div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{getName(p)}</p>
                      <p className="text-xs text-gray-400">{Number(p.price).toLocaleString()} Fdj {p.unit}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setQ(p.id, (qty[p.id] || 0) - 1)} className="w-7 h-7 rounded-full border border-[#d2e095] text-[#526500] leading-none text-lg flex items-center justify-center hover:bg-[#ecf4d5]">−</button>
                      <span className="w-6 text-center text-sm font-semibold">{qty[p.id] || 0}</span>
                      <button onClick={() => setQ(p.id, (qty[p.id] || 0) + 1)} disabled={(qty[p.id] || 0) >= (p.stock_qty ?? 0)} className="w-7 h-7 rounded-full border border-[#d2e095] text-[#526500] leading-none text-lg flex items-center justify-center hover:bg-[#ecf4d5] disabled:opacity-30">+</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-[#d2e095] mt-3 pt-3 flex items-center justify-between">
                <span className="text-sm text-gray-600">{t('sub.total_week', 'Total par semaine')}</span>
                <span className="text-lg font-bold text-[#526500]">{total.toLocaleString()} Fdj</span>
              </div>
              {total > 0 && (
                <p className="text-xs text-gray-400 mt-1 text-right">
                  ≈ {weeks} {weeks > 1 ? t('sub.weeks', 'semaines couvertes') : t('sub.week', 'semaine couverte')} {t('sub.with_balance', 'avec votre solde')}
                </p>
              )}
            </div>

            {/* Réglages */}
            <div className="bg-white rounded-3xl p-5 border border-[#d2e095] shadow-sm mb-5 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1.5 block">📅 {t('sub.delivery_day', 'Jour de livraison')}</label>
                <select value={deliveryDay} onChange={e => { setSaved(false); setDeliveryDay(Number(e.target.value)); }} className="w-full border border-[#d2e095] rounded-xl px-4 py-2.5 text-sm bg-[#faf7e8] focus:outline-none focus:border-[#a8c800]">
                  {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input type="checkbox" checked={active} onChange={e => { setSaved(false); setActive(e.target.checked); }} className="w-5 h-5 accent-[#a8c800]" />
                <span className="text-sm text-gray-700">{t('sub.activate', 'Activer la livraison automatique hebdomadaire')}</span>
              </label>
            </div>

            {error && <div className="bg-orange-50 text-[#f97316] text-sm px-4 py-3 rounded-xl mb-4">⚠️ {error}</div>}
            {active && total > balance && total > 0 && (
              <div className="bg-amber-50 text-amber-700 text-sm px-4 py-3 rounded-xl mb-4">
                ⚠️ {t('sub.low_balance', 'Votre solde est insuffisant pour la première livraison. Pensez à recharger votre cagnotte.')}
              </div>
            )}

            <button onClick={save} disabled={saving} className="w-full bg-[#a8c800] text-white py-3.5 rounded-2xl font-semibold hover:bg-[#7d9800] transition disabled:opacity-50">
              {saving ? t('admin.saving', 'Enregistrement...') : saved ? t('sub.saved', '✅ Enregistré') : t('sub.save', 'Enregistrer ma commande type')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
