'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { supabase } from '../../lib/supabase';
import ProductReport from './ProductReport';

type Product = {
  product_id: number;
  name: string;
  unit: string;
  qty: number;
  revenue: number;
  cost: number;
  margin: number | null;
  marginPct: number | null;
  costComplete: boolean;
  merchant: string | null;
};
type Data = {
  kpis: {
    caProduits: number; caMarchands: number; commissions?: number; reverseMarchands?: number; caHornafresh: number; caEntreprises?: number; nbOrdersEntreprises?: number; nbOrders: number; panierMoyen: number; deliveryCollected: number; deliveryOffered?: number; discountsTotal?: number; marginAfterDiscounts?: number; creditOutstanding?: number; creditOverdue?: number;
    costTotal: number; marginTotal: number; marginPct: number | null; caWithCost: number;
  };
  products: Product[];
  missingCost: number;
};

const fdj = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} Fdj`;

export default function AdminFinances() {
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;

  const [period, setPeriod] = useState<'month' | '30d' | 'year' | 'all' | 'custom'>('month');
  // Plage personnalisée (dates incluses) — pré-remplie sur le mois en cours
  const iso0 = (d: Date) => d.toISOString().slice(0, 10);
  const [customFrom, setCustomFrom] = useState(() => iso0(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [customTo, setCustomTo] = useState(() => iso0(new Date()));
  const customValid = !!customFrom && !!customTo && customFrom <= customTo;
  // Statuts comptés (défaut : livrées). « Annulée » sert à mesurer le manque à gagner.
  const STATUS_OPTS: { id: string; label: string }[] = [
    { id: 'pending', label: t('fin.st_pending', 'En attente') },
    { id: 'processing', label: t('fin.st_processing', 'En préparation') },
    { id: 'shipping', label: t('fin.st_shipping', 'Expédiée') },
    { id: 'delivered', label: t('fin.st_delivered', 'Livrée') },
    { id: 'cancelled', label: t('fin.st_cancelled', 'Annulée') },
  ];
  const [statuses, setStatuses] = useState<string[]>(['delivered']);
  const toggleStatus = (id: string) => setStatuses(prev => prev.includes(id)
    ? (prev.length > 1 ? prev.filter(x => x !== id) : prev)   // au moins un statut coché
    : [...prev, id]);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportProduct, setReportProduct] = useState<number | null>(null);

  // Bornes de date (YYYY-MM-DD) correspondant à la période sélectionnée
  const periodRange = (): { from: string; to: string } => {
    const now = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const today = iso(now);
    if (period === 'custom') return { from: customFrom, to: customTo };
    if (period === 'month') return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
    if (period === '30d') return { from: iso(new Date(now.getTime() - 30 * 86400000)), to: today };
    if (period === 'year') return { from: iso(new Date(now.getFullYear(), 0, 1)), to: today };
    return { from: '', to: '' };
  };

  const PERIODS: { id: typeof period; label: string }[] = [
    { id: 'month', label: t('fin.period_month', 'Ce mois') },
    { id: '30d',   label: t('fin.period_30d', '30 jours') },
    { id: 'year',  label: t('fin.period_year', 'Cette année') },
    { id: 'all',   label: t('fin.period_all', 'Tout') },
    { id: 'custom', label: `📅 ${t('fin.period_custom', 'Dates…')}` },
  ];

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let { data: { session } } = await supabase.auth.getSession();
      if (!session || (session.expires_at && session.expires_at * 1000 < Date.now() + 60000)) {
        session = (await supabase.auth.refreshSession()).data.session;
      }
      const custom = period === 'custom' ? `&from=${customFrom}&to=${customTo}` : '';
      const res = await fetch(`/api/admin/finances?period=${period}&statuses=${statuses.join(',')}${custom}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const json = await res.json();
      if (res.ok) setData(json);
    } catch { /* ignore */ }
    setLoading(false);
  }, [period, statuses, customFrom, customTo]);

  useEffect(() => {
    if (period === 'custom' && !customValid) return;   // plage incomplète ou inversée : on attend
    fetchData();
  }, [fetchData, period, customValid]);

  const k = data?.kpis;

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <h2 className="text-xl font-bold text-[#2d6410]">📊 {t('fin.title', 'Finances')}</h2>
        <div className="flex flex-wrap gap-1.5 bg-white border border-[#d2e095] rounded-2xl sm:rounded-full p-1">
          {PERIODS.map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${period === p.id ? 'bg-[#526500] text-white' : 'text-[#526500] hover:bg-[#ecf4d5]'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Plage de dates personnalisée (dates incluses) */}
      {period === 'custom' && (
        <div className="flex flex-wrap items-center gap-2 mb-3 bg-white border border-[#d2e095] rounded-2xl px-3 py-2">
          <label className="text-xs text-gray-600 font-medium flex items-center gap-1.5">{t('fin.from', 'Du')}
            <input type="date" value={customFrom} max={customTo || undefined} onChange={e => setCustomFrom(e.target.value)}
              className="border border-[#d2e095] rounded-lg px-2 py-1.5 text-xs bg-[#faf7e8] focus:outline-none focus:border-[#a8c800]" />
          </label>
          <label className="text-xs text-gray-600 font-medium flex items-center gap-1.5">{t('fin.to', 'au')}
            <input type="date" value={customTo} min={customFrom || undefined} onChange={e => setCustomTo(e.target.value)}
              className="border border-[#d2e095] rounded-lg px-2 py-1.5 text-xs bg-[#faf7e8] focus:outline-none focus:border-[#a8c800]" />
          </label>
          <span className="text-[11px] text-gray-400">{t('fin.range_hint', 'Dates incluses.')}</span>
          {!customValid && <span className="text-[11px] text-[#f97316]">⚠️ {t('fin.range_err', 'Choisissez deux dates, la première avant la seconde.')}</span>}
        </div>
      )}

      {/* Statuts comptés : les indicateurs suivent les cases cochées */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-4 bg-white border border-[#d2e095] rounded-2xl px-3 py-2">
        <span className="text-xs text-gray-500 font-medium">{t('fin.statuses', 'Statuts comptés')} :</span>
        {STATUS_OPTS.map(s => (
          <label key={s.id} className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
            <input type="checkbox" checked={statuses.includes(s.id)} onChange={() => toggleStatus(s.id)} className="accent-[#a8c800]" />
            {s.label}
          </label>
        ))}
        {statuses.length === 1 && statuses[0] === 'delivered'
          ? <span className="text-[11px] text-gray-400">{t('fin.scope', 'Basé sur les commandes livrées.')}</span>
          : <span className="text-[11px] text-[#b45309]">⚠️ {t('fin.scope_custom', 'Vue d\'analyse : seules les commandes livrées sont du chiffre réellement encaissé.')}</span>}
      </div>

      {loading ? (
        <p className="text-center text-gray-400 py-16">⏳</p>
      ) : !k ? (
        <p className="text-center text-gray-400 py-16">{t('fin.error', 'Impossible de charger les données.')}</p>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
            <Kpi emoji="💰" label={t('fin.ca', "Chiffre d'affaires")} value={fdj(k.caProduits)} hint={k.caMarchands > 0 ? `${t('fin.ca_hint', 'Produits, hors livraison')} · 🏪 ${t('fin.ca_merchants2', 'dont ventes marchands')} : ${fdj(k.caMarchands)}${(k.commissions || 0) > 0 ? ` · 🤝 ${t('fin.commissions', 'commissions retenues')} : ${fdj(k.commissions || 0)}` : ''}` : t('fin.ca_hint', 'Produits, hors livraison')} accent />
            <Kpi emoji={k.marginTotal < 0 ? '📉' : '📈'} label={t('fin.margin', 'Marge brute')}
              value={k.caWithCost > 0 ? fdj(k.marginTotal) : '—'}
              tone={k.caWithCost > 0 ? (k.marginTotal > 0 ? 'good' : k.marginTotal < 0 ? 'bad' : 'neutral') : 'neutral'}
              badge={k.marginPct != null ? `${k.marginTotal > 0 ? '▲' : k.marginTotal < 0 ? '▼' : ''} ${k.marginPct} %`.trim() : undefined}
              hint={k.marginPct != null
                ? (k.marginTotal < 0 ? `⚠️ ${t('fin.margin_neg', 'Vous vendez sous le coût d\'achat sur cette sélection.')}` : `${k.marginPct} % ${t('fin.margin_rate', 'de marge')}`)
                : t('fin.margin_na', 'coûts manquants')} />
            {(() => {
              // Marge NETTE : ce qui reste réellement après coûts d'achat ET remises accordées
              const net = (k.marginAfterDiscounts != null ? k.marginAfterDiscounts : k.marginTotal - (k.discountsTotal || 0));
              const netPct = k.caWithCost > 0 ? Math.round(net / k.caWithCost * 1000) / 10 : null;
              return (
                <Kpi emoji="💎" label={t('fin.margin_net', 'Marge nette')}
                  value={k.caWithCost > 0 ? fdj(net) : '—'}
                  tone={k.caWithCost > 0 ? (net > 0 ? 'good' : net < 0 ? 'bad' : 'neutral') : 'neutral'}
                  badge={netPct != null ? `${net > 0 ? '▲' : net < 0 ? '▼' : ''} ${netPct} %`.trim() : undefined}
                  hint={net < 0
                    ? `⚠️ ${t('fin.margin_net_neg', 'Coûts et remises dépassent les ventes sur cette sélection.')}`
                    : `${t('fin.margin_net_hint', 'Marge brute − remises accordées')}${(k.discountsTotal || 0) > 0 ? ` (−${fdj(k.discountsTotal || 0)})` : ''}`} />
              );
            })()}
            <Kpi emoji="🧾" label={t('fin.cost', "Coût d'achat")} value={k.costTotal ? fdj(k.costTotal) : '—'} hint={t('fin.cost_hint', 'Marchandises vendues')} />
            <Kpi emoji="📦" label={statuses.length === 1 && statuses[0] === 'delivered' ? t('fin.orders', 'Commandes livrées') : t('fin.orders2', 'Commandes comptées')} value={String(k.nbOrders)} hint={(k.nbOrdersEntreprises || 0) > 0 ? `🏢 ${t('fin.ca_companies', 'dont comptes entreprise')} : ${k.nbOrdersEntreprises} · ${fdj(k.caEntreprises || 0)}` : undefined} />
            <Kpi emoji="🛒" label={t('fin.basket', 'Panier moyen')} value={fdj(k.panierMoyen)} hint={t('fin.basket_hint', 'Par commande, livraison incluse')} />
            {(k.discountsTotal || 0) > 0 && <Kpi emoji="💸" label={t('fin.discounts', 'Remises accordées')} value={fdj(k.discountsTotal || 0)} hint={t('fin.discounts_hint2', 'Codes promo et remises admin, déjà déduites de la marge nette')} />}
            {(k.creditOutstanding || 0) > 0 && <Kpi emoji="💳" label={t('fin.credit', 'Encours crédit clients')} value={fdj(k.creditOutstanding || 0)} hint={(k.creditOverdue || 0) > 0 ? `⚠️ ${fdj(k.creditOverdue || 0)} ${t('fin.credit_overdue', 'en retard')}` : t('fin.credit_hint', 'Vendu, pas encore encaissé')} />}
            <Kpi emoji="🚚" label={t('fin.delivery', 'Frais de livraison')} value={fdj(k.deliveryCollected)} hint={(k.deliveryOffered || 0) > 0 ? `${t('fin.delivery_hint', 'Encaissés')} · 🎁 ${fdj(k.deliveryOffered || 0)} ${t('fin.delivery_offered', 'offerts (codes, seuil, parrainage)')}` : t('fin.delivery_hint', 'Encaissés')} />
          </div>

          {/* Avertissement coûts manquants */}
          {data!.missingCost > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3 mb-5">
              <p className="text-sm text-[#b45309]">
                ⚠️ {data!.missingCost} {t('fin.missing_cost', "produit(s) vendu(s) sans prix d'achat renseigné — leur marge n'est pas comptée. Complétez le « Prix d'achat » dans Produits pour une marge exacte.")}
              </p>
            </div>
          )}

          {/* Tableau par produit */}
          <div className="bg-white rounded-2xl border-2 border-[#d2e095] shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-[#ecf4d5] flex items-center justify-between gap-2">
              <h3 className="font-bold text-[#526500] text-sm">{t('fin.by_product', 'Détail par produit')}</h3>
              <span className="text-[11px] text-gray-400">👆 {t('fin.click_hint', 'Cliquez un produit pour le rapport détaillé')}</span>
            </div>
            {data!.products.length === 0 ? (
              <p className="text-center text-gray-400 py-12 text-sm">{t('fin.no_sales', 'Aucune vente livrée sur cette période.')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 text-xs border-b border-[#ecf4d5]">
                      <th className="text-left font-medium px-4 py-2.5">{t('fin.col_product', 'Produit')}</th>
                      <th className="text-right font-medium px-3 py-2.5 whitespace-nowrap">{t('fin.col_qty', 'Qté')}</th>
                      <th className="text-right font-medium px-3 py-2.5 whitespace-nowrap">{t('fin.col_ca', 'CA')}</th>
                      <th className="text-right font-medium px-3 py-2.5 whitespace-nowrap">{t('fin.col_cost', 'Coût')}</th>
                      <th className="text-right font-medium px-4 py-2.5 whitespace-nowrap">{t('fin.col_margin', 'Marge')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data!.products.map(p => (
                      <tr key={p.product_id} onClick={() => setReportProduct(p.product_id)}
                        className="border-b border-[#f5f9ea] last:border-0 cursor-pointer hover:bg-[#f7fbe9] transition">
                        <td className="px-4 py-2.5">
                          <span className="font-medium text-gray-800">{p.name}</span>
                          {p.merchant && <span className="ml-1.5 text-[10px] text-[#7d9800]" title={t('fin.merchant_row2', 'Produit marchand : la marge Hornafresh est la commission retenue')}>🏪 {p.merchant}</span>}
                          {!p.costComplete && <span className="ml-1.5 text-[10px] text-orange-500" title={t('fin.cost_partial', 'Coût manquant')}>⚠️</span>}
                        </td>
                        <td className="text-right px-3 py-2.5 text-gray-600 whitespace-nowrap">{p.qty} {p.unit}</td>
                        <td className="text-right px-3 py-2.5 font-semibold text-[#526500] whitespace-nowrap">{fdj(p.revenue)}</td>
                        <td className="text-right px-3 py-2.5 text-gray-500 whitespace-nowrap">{p.cost ? fdj(p.cost) : '—'}</td>
                        <td className="text-right px-4 py-2.5 whitespace-nowrap">
                          {p.margin != null ? (
                            <span className={`font-semibold ${p.margin < 0 ? 'text-red-600' : 'text-[#2d6410]'}`}>{p.margin < 0 ? '▼ ' : ''}{fdj(p.margin)}{p.marginPct != null && <span className={`text-xs font-normal ${p.margin < 0 ? 'text-red-400' : 'text-gray-400'}`}> · {p.marginPct}%</span>}</span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {reportProduct != null && (
        <ProductReport
          productId={reportProduct}
          defaultFrom={periodRange().from}
          defaultTo={periodRange().to}
          onClose={() => setReportProduct(null)}
        />
      )}
    </div>
  );
}

function Kpi({ emoji, label, value, hint, accent, tone, badge }: { emoji: string; label: string; value: string; hint?: string; accent?: boolean; tone?: 'good' | 'bad' | 'neutral'; badge?: string }) {
  // Tonalité financière : vert = positif, rouge = négatif (fond teinté léger + liseré gauche + pastille ▲▼)
  const tones = {
    good:    { card: 'bg-green-50 border-green-200 border-l-4 border-l-green-600', value: 'text-green-700', badge: 'bg-green-600 text-white' },
    bad:     { card: 'bg-red-50 border-red-200 border-l-4 border-l-red-600',       value: 'text-red-600',   badge: 'bg-red-600 text-white' },
    neutral: { card: 'bg-white border-[#d2e095]',                                   value: 'text-gray-500',  badge: 'bg-gray-200 text-gray-600' },
  } as const;
  const tn = tone ? tones[tone] : null;
  return (
    <div className={`rounded-2xl p-4 border-2 shadow-sm ${accent ? 'bg-[#526500] border-[#526500] text-white' : tn ? tn.card : 'bg-white border-[#d2e095]'}`}>
      <p className={`text-xs flex items-center justify-between gap-2 ${accent ? 'text-[#c8e050]' : tone ? 'text-gray-500' : 'text-gray-400'}`}>
        <span>{emoji} {label}</span>
        {badge && tn && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tn.badge}`}>{badge}</span>}
      </p>
      <p className={`text-xl font-extrabold mt-1 leading-tight ${accent ? 'text-white' : tn ? tn.value : 'text-[#2d6410]'}`}>{value}</p>
      {hint && <p className={`text-[11px] mt-0.5 ${accent ? 'text-white/60' : 'text-gray-400'}`}>{hint}</p>}
    </div>
  );
}
