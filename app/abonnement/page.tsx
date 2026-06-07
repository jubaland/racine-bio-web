'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase, fetchProducts } from '../../lib/supabase';
import { useLanguage } from '../../context/LanguageContext';
import Header from '../../components/Header';
import CartDrawer from '../../components/CartDrawer';

type Freq = 'weekly' | 'fortnightly' | 'monthly';
const FREQS: Freq[] = ['weekly', 'fortnightly', 'monthly'];

export default function SubscriptionPage() {
  const { ui, productTranslations, currentLang } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;

  const [cartOpen, setCartOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [balance, setBalance] = useState(0);

  // Fréquence sélectionnée (onglet)
  const [freq, setFreq] = useState<Freq>('weekly');

  // État par fréquence
  const [qtyByFreq, setQtyByFreq] = useState<Record<Freq, Record<number, number>>>({ weekly: {}, fortnightly: {}, monthly: {} });
  const [dayByFreq, setDayByFreq] = useState<Record<Freq, number>>({ weekly: 1, fortnightly: 1, monthly: 1 });
  const [activeByFreq, setActiveByFreq] = useState<Record<Freq, boolean>>({ weekly: false, fortnightly: false, monthly: false });
  const [validByFreq, setValidByFreq] = useState<Record<Freq, string | null>>({ weekly: null, fortnightly: null, monthly: null });

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const DAYS = [
    t('sub.day_0', 'Dimanche'), t('sub.day_1', 'Lundi'), t('sub.day_2', 'Mardi'),
    t('sub.day_3', 'Mercredi'), t('sub.day_4', 'Jeudi'), t('sub.day_5', 'Vendredi'), t('sub.day_6', 'Samedi'),
  ];
  const FREQ_LABEL: Record<Freq, string> = {
    weekly:      t('sub.freq_weekly', 'Hebdomadaire'),
    fortnightly: t('sub.freq_fortnightly', 'Quinzaine'),
    monthly:     t('sub.freq_monthly', 'Mensuelle'),
  };
  const PERIOD_WORD: Record<Freq, string> = {
    weekly:      t('sub.per_week', 'par semaine'),
    fortnightly: t('sub.per_fortnight', 'par quinzaine'),
    monthly:     t('sub.per_month', 'par mois'),
  };

  const getName = (p: any) =>
    (currentLang !== 'fr' && productTranslations[p.id]?.name) ? productTranslations[p.id].name : p.name;

  const fmtDate = (s: string | null) => {
    if (!s) return '';
    try { return new Date(s + 'T00:00:00').toLocaleDateString(currentLang === 'fr' ? 'fr-FR' : currentLang); }
    catch { return new Date(s + 'T00:00:00').toLocaleDateString('fr-FR'); }
  };

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = '/login?redirect=/abonnement'; return; }
      setUser(session.user);

      const prods = await fetchProducts();
      setProducts(prods);

      const [{ data: subs }, { data: items }, { data: w }] = await Promise.all([
        supabase.from('subscriptions').select('*').eq('user_id', session.user.id),
        supabase.from('subscription_items').select('product_id, quantity, frequency').eq('user_id', session.user.id),
        supabase.from('wallets').select('balance').eq('user_id', session.user.id).maybeSingle(),
      ]);

      const day: Record<Freq, number> = { weekly: 1, fortnightly: 1, monthly: 1 };
      const act: Record<Freq, boolean> = { weekly: false, fortnightly: false, monthly: false };
      const val: Record<Freq, string | null> = { weekly: null, fortnightly: null, monthly: null };
      (subs || []).forEach((s: any) => {
        const f = (s.frequency || 'weekly') as Freq;
        if (!FREQS.includes(f)) return;
        day[f] = s.delivery_day ?? 1;
        act[f] = !!s.active && !s.paused;
        val[f] = s.valid_until ?? null;
      });
      setDayByFreq(day); setActiveByFreq(act); setValidByFreq(val);

      const q: Record<Freq, Record<number, number>> = { weekly: {}, fortnightly: {}, monthly: {} };
      (items || []).forEach((it: any) => {
        const f = (it.frequency || 'weekly') as Freq;
        if (!FREQS.includes(f)) return;
        q[f][it.product_id] = Number(it.quantity);
      });
      setQtyByFreq(q);

      setBalance(Number(w?.balance) || 0);
      setLoading(false);
    })();
  }, []);

  // Raccourcis sur la fréquence courante
  const qty = qtyByFreq[freq];
  const deliveryDay = dayByFreq[freq];
  const active = activeByFreq[freq];
  const validUntil = validByFreq[freq];

  const setQ = (id: number, v: number) => {
    setSaved(false);
    setQtyByFreq(prev => ({ ...prev, [freq]: { ...prev[freq], [id]: Math.max(0, v) } }));
  };
  const setDay = (v: number) => { setSaved(false); setDayByFreq(prev => ({ ...prev, [freq]: v })); };
  const setActive = (v: boolean) => { setSaved(false); setActiveByFreq(prev => ({ ...prev, [freq]: v })); };

  const basket = products.filter(p => (qty[p.id] || 0) > 0);
  const total = basket.reduce((s, p) => s + Number(p.price) * (qty[p.id] || 0), 0);

  // Autonomie globale : toutes les commandes types ACTIVES partagent la même
  // cagnotte. On calcule le rythme de consommation cumulé (par jour) puis la
  // durée que le solde peut couvrir — au lieu d'un compteur par fréquence
  // (trompeur, car chacun utiliserait tout le solde).
  const PERIOD_DAYS: Record<Freq, number> = { weekly: 7, fortnightly: 14, monthly: 30.4 };
  const totalForFreq = (f: Freq) =>
    products.reduce((s, p) => s + Number(p.price) * (qtyByFreq[f][p.id] || 0), 0);
  const dailyBurn = FREQS.reduce((sum, f) => {
    if (!activeByFreq[f]) return sum;
    const tot = totalForFreq(f);
    return sum + (tot > 0 ? tot / PERIOD_DAYS[f] : 0);
  }, 0);
  const daysCovered = dailyBurn > 0 ? Math.floor(balance / dailyBurn) : 0;
  const weeksCovered = Math.floor(daysCovered / 7);
  const coverageEnd = dailyBurn > 0
    ? (() => { const d = new Date(); d.setDate(d.getDate() + daysCovered); return d.toISOString().slice(0, 10); })()
    : null;

  const save = async () => {
    setError(''); setSaved(false);
    if (active && basket.length === 0) {
      setError(t('sub.err_empty', 'Ajoutez au moins un produit pour activer votre commande type.'));
      return;
    }
    setSaving(true);

    // Validité : 1 an à partir d'aujourd'hui (renouvelée à chaque enregistrement)
    const vu = new Date(); vu.setFullYear(vu.getFullYear() + 1);
    const validStr = vu.toISOString().slice(0, 10);

    const { error: e1 } = await supabase.from('subscriptions').upsert({
      user_id: user.id, frequency: freq, delivery_day: deliveryDay, active, paused: false,
      valid_until: validStr, updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,frequency' });
    if (e1) { setSaving(false); setError(e1.message); return; }

    const { error: e2 } = await supabase.from('subscription_items').delete()
      .eq('user_id', user.id).eq('frequency', freq);
    if (e2) { setSaving(false); setError(e2.message); return; }

    if (basket.length > 0) {
      const { error: e3 } = await supabase.from('subscription_items').insert(
        basket.map(p => ({ user_id: user.id, frequency: freq, product_id: p.id, quantity: qty[p.id] }))
      );
      if (e3) { setSaving(false); setError(e3.message); return; }
    }

    setValidByFreq(prev => ({ ...prev, [freq]: validStr }));
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
        <p className="text-gray-500 text-sm mb-6">{t('sub.subtitle_multi', 'Composez un panier livré automatiquement, débité de votre cagnotte. Vous pouvez enregistrer un panier différent par fréquence.')}</p>

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

            {/* Autonomie globale (toutes commandes types actives, cagnotte partagée) */}
            {dailyBurn > 0 && coverageEnd && (
              <div className="bg-[#ecf4d5] border border-[#d2e095] rounded-2xl px-4 py-3 mb-5 text-sm text-[#526500]">
                💡 {t('sub.autonomy_until', 'Avec votre solde, vos commandes types actives sont couvertes jusqu\'au')} <strong>{fmtDate(coverageEnd)}</strong> (≈ {weeksCovered} {weeksCovered > 1 ? t('sub.weeks_unit', 'semaines') : t('sub.week_unit', 'semaine')}).
              </div>
            )}

            {/* Onglets de fréquence */}
            <div className="flex gap-2 mb-5">
              {FREQS.map(f => (
                <button
                  key={f}
                  onClick={() => { setSaved(false); setError(''); setFreq(f); }}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition relative ${freq === f ? 'bg-[#526500] text-white border-[#526500]' : 'bg-white text-[#526500] border-[#d2e095] hover:bg-[#ecf4d5]'}`}
                >
                  {FREQ_LABEL[f]}
                  {activeByFreq[f] && <span className="absolute top-1.5 right-2 text-[10px]">🟢</span>}
                </button>
              ))}
            </div>

            {/* Produits */}
            <div className="bg-white rounded-3xl p-5 border border-[#d2e095] shadow-sm mb-5">
              <h2 className="font-semibold text-gray-800 mb-3">🛒 {t('sub.basket_for', 'Mon panier')} — {FREQ_LABEL[freq]}</h2>
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
                <span className="text-sm text-gray-600">{t('sub.total', 'Total')} {PERIOD_WORD[freq]}</span>
                <span className="text-lg font-bold text-[#526500]">{total.toLocaleString()} Fdj</span>
              </div>
            </div>

            {/* Réglages */}
            <div className="bg-white rounded-3xl p-5 border border-[#d2e095] shadow-sm mb-5 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1.5 block">📅 {t('sub.delivery_day', 'Jour de livraison')}</label>
                <select value={deliveryDay} onChange={e => setDay(Number(e.target.value))} className="w-full border border-[#d2e095] rounded-xl px-4 py-2.5 text-sm bg-[#faf7e8] focus:outline-none focus:border-[#a8c800]">
                  {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
                {freq === 'monthly' && <p className="text-xs text-gray-400 mt-1">{t('sub.monthly_hint', 'Livraison une fois par mois, le premier jour choisi du mois.')}</p>}
                {freq === 'fortnightly' && <p className="text-xs text-gray-400 mt-1">{t('sub.fortnightly_hint', 'Livraison toutes les deux semaines, le jour choisi.')}</p>}
              </div>
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} className="w-5 h-5 accent-[#a8c800]" />
                <span className="text-sm text-gray-700">{t('sub.activate_freq', 'Activer la livraison automatique')} ({FREQ_LABEL[freq].toLowerCase()})</span>
              </label>
              {validUntil && (
                <p className="text-xs text-gray-500">⏳ {t('sub.valid_until', 'Valable jusqu\'au')} <strong>{fmtDate(validUntil)}</strong>. {t('sub.renew_hint', 'Réenregistrez pour prolonger d\'un an.')}</p>
              )}
            </div>

            {error && <div className="bg-orange-50 text-[#f97316] text-sm px-4 py-3 rounded-xl mb-4">⚠️ {error}</div>}
            {active && total > balance && total > 0 && (
              <div className="bg-amber-50 text-amber-700 text-sm px-4 py-3 rounded-xl mb-4">
                ⚠️ {t('sub.low_balance', 'Votre solde est insuffisant pour la première livraison. Pensez à recharger votre cagnotte.')}
              </div>
            )}

            <button onClick={save} disabled={saving} className="w-full bg-[#a8c800] text-white py-3.5 rounded-2xl font-semibold hover:bg-[#7d9800] transition disabled:opacity-50">
              {saving ? t('admin.saving', 'Enregistrement...') : saved ? t('sub.saved', '✅ Enregistré') : `${t('sub.save_freq', 'Enregistrer le panier')} — ${FREQ_LABEL[freq]}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
