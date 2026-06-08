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
  // Frais de transport personnalisés (définis par l'admin) — lecture seule côté client
  const [feeByFreq, setFeeByFreq] = useState<Record<Freq, number>>({ weekly: 0, fortnightly: 0, monthly: 0 });
  const [lastByFreq, setLastByFreq] = useState<Record<Freq, string | null>>({ weekly: null, fortnightly: null, monthly: null });

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [addSearch, setAddSearch] = useState('');

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
      const fees: Record<Freq, number> = { weekly: 0, fortnightly: 0, monthly: 0 };
      const last: Record<Freq, string | null> = { weekly: null, fortnightly: null, monthly: null };
      (subs || []).forEach((s: any) => {
        const f = (s.frequency || 'weekly') as Freq;
        if (!FREQS.includes(f)) return;
        day[f] = s.delivery_day ?? 1;
        act[f] = !!s.active && !s.paused;
        val[f] = s.valid_until ?? null;
        fees[f] = Number(s.delivery_fee) || 0;
        last[f] = s.last_delivery ?? null;
      });
      setDayByFreq(day); setActiveByFreq(act); setValidByFreq(val); setFeeByFreq(fees); setLastByFreq(last);

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

  const setQ = (id: number, v: number) => {
    setSaved(false);
    setQtyByFreq(prev => ({ ...prev, [freq]: { ...prev[freq], [id]: Math.max(0, v) } }));
  };
  const setDay = (v: number) => { setSaved(false); setDayByFreq(prev => ({ ...prev, [freq]: v })); };
  const setActive = (v: boolean) => { setSaved(false); setActiveByFreq(prev => ({ ...prev, [freq]: v })); };

  const basket = products.filter(p => (qty[p.id] || 0) > 0);
  const itemsTotal = basket.reduce((s, p) => s + Number(p.price) * (qty[p.id] || 0), 0);
  const fee = feeByFreq[freq] || 0;
  const total = itemsTotal + fee; // articles + frais de transport (fréquence courante)

  const totalForFreq = (f: Freq) =>
    products.reduce((s, p) => s + Number(p.price) * (qtyByFreq[f][p.id] || 0), 0);

  // Autonomie exacte : simulation calendaire jour par jour (comme le cron).
  // Toutes les commandes types actives partagent la cagnotte ; quand plusieurs
  // livraisons tombent le même jour, un seul frais de transport (le plus élevé)
  // est compté. On respecte les cycles (quinzaine = 14 j, mensuel = 1×/mois) et
  // les dates de validité, jusqu'à épuisement du solde.
  const daysBetweenUTC = (a: string, b: string) =>
    Math.round((new Date(b + 'T00:00:00Z').getTime() - new Date(a + 'T00:00:00Z').getTime()) / 86400000);
  const isDueSim = (f: Freq, last: string | null, dayStr: string) => {
    if (!last) return true;
    if (f === 'weekly') return true;
    if (f === 'fortnightly') return daysBetweenUTC(last, dayStr) >= 14;
    // monthly : une fois par mois (mois ou année différents)
    const l = new Date(last + 'T00:00:00Z'), d = new Date(dayStr + 'T00:00:00Z');
    return l.getUTCFullYear() !== d.getUTCFullYear() || l.getUTCMonth() !== d.getUTCMonth();
  };

  const { coverageEnd, weeksCovered, anyActive } = (() => {
    const sims = FREQS
      .filter(f => activeByFreq[f] && totalForFreq(f) > 0)
      .map(f => ({ f, day: dayByFreq[f], items: totalForFreq(f), fee: feeByFreq[f] || 0, validUntil: validByFreq[f], last: lastByFreq[f] }));
    if (!sims.length) return { coverageEnd: null as string | null, weeksCovered: 0, anyActive: false };

    const lastMap: Record<string, string | null> = {};
    sims.forEach(s => { lastMap[s.f] = s.last; });

    let bal = balance;
    const now = new Date();
    const cur = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const todayStr = cur.toISOString().slice(0, 10);
    let lastCovered: string | null = null;
    const CAP_DAYS = 800;

    for (let i = 0; i < CAP_DAYS; i++) {
      const dayStr = cur.toISOString().slice(0, 10);
      const dow = cur.getUTCDay();
      const delivering = sims.filter(s =>
        s.day === dow && !(s.validUntil && dayStr > s.validUntil) && isDueSim(s.f, lastMap[s.f], dayStr)
      );
      if (delivering.length) {
        const itemsSum = delivering.reduce((a, s) => a + s.items, 0);
        const feeOnce = delivering.reduce((m, s) => Math.max(m, s.fee), 0);
        const dayCost = itemsSum + feeOnce;
        if (dayCost > bal) break;          // solde insuffisant pour cette livraison
        bal -= dayCost;
        delivering.forEach(s => { lastMap[s.f] = dayStr; });
        lastCovered = dayStr;
      }
      cur.setUTCDate(cur.getUTCDate() + 1);
    }

    const weeks = lastCovered ? Math.floor(daysBetweenUTC(todayStr, lastCovered) / 7) : 0;
    return { coverageEnd: lastCovered, weeksCovered: weeks, anyActive: true };
  })();

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
        <h1 className="text-2xl font-bold text-gray-800 mb-1">🔄 {t('sub.title', 'Ma commande type')}</h1>
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
            {anyActive && coverageEnd && (
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
              {basket.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">{t('sub.empty_basket', 'Aucun produit. Ajoutez-en un pour composer votre commande type.')}</p>
              ) : (
                <div className="divide-y divide-[#f0f7e0]">
                  {basket.map(p => (
                    <div key={p.id} className="flex items-center gap-3 py-3">
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#ecf4d5] flex-none">
                        {p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center opacity-30">📷</div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{getName(p)}</p>
                        <p className="text-xs text-gray-400">{Number(p.price).toLocaleString()} Fdj {p.unit}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setQ(p.id, (qty[p.id] || 0) - 1)} title={(qty[p.id] || 0) <= 1 ? t('sub.remove', 'Retirer') : ''} className="w-7 h-7 rounded-full border border-[#d2e095] text-[#526500] leading-none text-lg flex items-center justify-center hover:bg-[#ecf4d5]">−</button>
                        <span className="w-6 text-center text-sm font-semibold">{qty[p.id] || 0}</span>
                        <button onClick={() => setQ(p.id, (qty[p.id] || 0) + 1)} disabled={(qty[p.id] || 0) >= (p.stock_qty ?? 0)} className="w-7 h-7 rounded-full border border-[#d2e095] text-[#526500] leading-none text-lg flex items-center justify-center hover:bg-[#ecf4d5] disabled:opacity-30">+</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => { setAddSearch(''); setAddOpen(true); }}
                className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-[#a8c800] text-[#526500] text-sm font-semibold hover:bg-[#ecf4d5] transition"
              >
                ➕ {t('sub.add_product', 'Ajouter un produit')}
              </button>
              {fee > 0 && (
                <>
                  <div className="border-t border-[#d2e095] mt-3 pt-3 flex items-center justify-between">
                    <span className="text-sm text-gray-500">{t('sub.items_subtotal', 'Sous-total articles')}</span>
                    <span className="text-sm text-gray-600">{itemsTotal.toLocaleString()} Fdj</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-sm text-gray-500">🚚 {t('sub.delivery_fee', 'Frais de transport')}</span>
                    <span className="text-sm text-gray-600">{fee.toLocaleString()} Fdj</span>
                  </div>
                </>
              )}
              <div className={`${fee > 0 ? 'mt-2 pt-2' : 'border-t border-[#d2e095] mt-3 pt-3'} flex items-center justify-between`}>
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

      {/* Sélecteur d'ajout de produit */}
      {addOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setAddOpen(false)}>
          <div className="bg-white rounded-3xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-[#d2e095] flex items-center justify-between gap-3">
              <h3 className="font-bold text-gray-800">➕ {t('sub.add_product', 'Ajouter un produit')}</h3>
              <button onClick={() => setAddOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none w-8 h-8 flex items-center justify-center">×</button>
            </div>
            <div className="p-3 border-b border-[#f0f7e0]">
              <input value={addSearch} onChange={e => setAddSearch(e.target.value)} placeholder={t('sub.search_product', 'Rechercher un produit...')} className="w-full border border-[#d2e095] rounded-xl px-4 py-2.5 text-sm bg-[#faf7e8] focus:outline-none focus:border-[#a8c800]" />
            </div>
            <div className="overflow-y-auto p-2">
              {(() => {
                const list = products.filter(p => getName(p).toLowerCase().includes(addSearch.toLowerCase()));
                if (list.length === 0) return <p className="text-center text-sm text-gray-400 py-6">{t('sub.no_match', 'Aucun produit trouvé.')}</p>;
                return list.map(p => {
                  const q = qty[p.id] || 0;
                  const out = (p.stock_qty ?? 0) <= 0;
                  return (
                    <div key={p.id} className={`flex items-center gap-3 p-2.5 rounded-xl ${q > 0 ? 'bg-[#f5fae6]' : ''}`}>
                      <div className="w-11 h-11 rounded-lg overflow-hidden bg-[#ecf4d5] flex-none">
                        {p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center opacity-30">📷</div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{getName(p)}</p>
                        <p className="text-xs text-gray-400">{Number(p.price).toLocaleString()} Fdj {p.unit}{out ? ` · ${t('sub.out_of_stock', 'rupture')}` : ''}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-none">
                        <button onClick={() => setQ(p.id, q - 1)} disabled={q <= 0} className="w-7 h-7 rounded-full border border-[#d2e095] text-[#526500] leading-none text-lg flex items-center justify-center hover:bg-[#ecf4d5] disabled:opacity-30">−</button>
                        <span className="w-6 text-center text-sm font-semibold">{q}</span>
                        <button onClick={() => setQ(p.id, q + 1)} disabled={q >= (p.stock_qty ?? 0)} className="w-7 h-7 rounded-full border border-[#d2e095] text-[#526500] leading-none text-lg flex items-center justify-center hover:bg-[#ecf4d5] disabled:opacity-30">+</button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
            <div className="p-3 border-t border-[#d2e095]">
              <button onClick={() => setAddOpen(false)} className="w-full py-2.5 rounded-xl bg-[#a8c800] text-white text-sm font-semibold hover:bg-[#7d9800] transition">{t('sub.done', 'Terminé')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
