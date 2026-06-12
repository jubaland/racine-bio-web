'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { supabase } from '../../lib/supabase';

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
};
type Data = {
  kpis: {
    caProduits: number; nbOrders: number; panierMoyen: number; deliveryCollected: number;
    costTotal: number; marginTotal: number; marginPct: number | null; caWithCost: number;
  };
  products: Product[];
  missingCost: number;
};

const fdj = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} Fdj`;

export default function AdminFinances() {
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;

  const [period, setPeriod] = useState<'month' | '30d' | 'year' | 'all'>('month');
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  const PERIODS: { id: typeof period; label: string }[] = [
    { id: 'month', label: t('fin.period_month', 'Ce mois') },
    { id: '30d',   label: t('fin.period_30d', '30 jours') },
    { id: 'year',  label: t('fin.period_year', 'Cette année') },
    { id: 'all',   label: t('fin.period_all', 'Tout') },
  ];

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let { data: { session } } = await supabase.auth.getSession();
      if (!session || (session.expires_at && session.expires_at * 1000 < Date.now() + 60000)) {
        session = (await supabase.auth.refreshSession()).data.session;
      }
      const res = await fetch(`/api/admin/finances?period=${period}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const json = await res.json();
      if (res.ok) setData(json);
    } catch { /* ignore */ }
    setLoading(false);
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const k = data?.kpis;

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <h2 className="text-xl font-bold text-[#2d6410]">📊 {t('fin.title', 'Finances')}</h2>
        <div className="flex gap-1.5 bg-white border border-[#d2e095] rounded-full p-1">
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

      <p className="text-xs text-gray-400 mb-4">{t('fin.scope', 'Basé sur les commandes livrées.')}</p>

      {loading ? (
        <p className="text-center text-gray-400 py-16">⏳</p>
      ) : !k ? (
        <p className="text-center text-gray-400 py-16">{t('fin.error', 'Impossible de charger les données.')}</p>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
            <Kpi emoji="💰" label={t('fin.ca', "Chiffre d'affaires")} value={fdj(k.caProduits)} hint={t('fin.ca_hint', 'Produits, hors livraison')} accent />
            <Kpi emoji="📈" label={t('fin.margin', 'Marge brute')}
              value={k.marginTotal ? fdj(k.marginTotal) : '—'}
              hint={k.marginPct != null ? `${k.marginPct} % ${t('fin.margin_rate', 'de marge')}` : t('fin.margin_na', 'coûts manquants')} />
            <Kpi emoji="🧾" label={t('fin.cost', "Coût d'achat")} value={k.costTotal ? fdj(k.costTotal) : '—'} hint={t('fin.cost_hint', 'Marchandises vendues')} />
            <Kpi emoji="📦" label={t('fin.orders', 'Commandes livrées')} value={String(k.nbOrders)} />
            <Kpi emoji="🛒" label={t('fin.basket', 'Panier moyen')} value={fdj(k.panierMoyen)} hint={t('fin.basket_hint', 'Par commande, livraison incluse')} />
            <Kpi emoji="🚚" label={t('fin.delivery', 'Frais de livraison')} value={fdj(k.deliveryCollected)} hint={t('fin.delivery_hint', 'Encaissés')} />
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
            <div className="px-5 py-3 border-b border-[#ecf4d5]">
              <h3 className="font-bold text-[#526500] text-sm">{t('fin.by_product', 'Détail par produit')}</h3>
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
                      <tr key={p.product_id} className="border-b border-[#f5f9ea] last:border-0">
                        <td className="px-4 py-2.5">
                          <span className="font-medium text-gray-800">{p.name}</span>
                          {!p.costComplete && <span className="ml-1.5 text-[10px] text-orange-500" title={t('fin.cost_partial', 'Coût manquant')}>⚠️</span>}
                        </td>
                        <td className="text-right px-3 py-2.5 text-gray-600 whitespace-nowrap">{p.qty} {p.unit}</td>
                        <td className="text-right px-3 py-2.5 font-semibold text-[#526500] whitespace-nowrap">{fdj(p.revenue)}</td>
                        <td className="text-right px-3 py-2.5 text-gray-500 whitespace-nowrap">{p.cost ? fdj(p.cost) : '—'}</td>
                        <td className="text-right px-4 py-2.5 whitespace-nowrap">
                          {p.margin != null ? (
                            <span className="font-semibold text-[#2d6410]">{fdj(p.margin)}{p.marginPct != null && <span className="text-xs text-gray-400 font-normal"> · {p.marginPct}%</span>}</span>
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
    </div>
  );
}

function Kpi({ emoji, label, value, hint, accent }: { emoji: string; label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 border-2 shadow-sm ${accent ? 'bg-[#526500] border-[#526500] text-white' : 'bg-white border-[#d2e095]'}`}>
      <p className={`text-xs ${accent ? 'text-[#c8e050]' : 'text-gray-400'}`}>{emoji} {label}</p>
      <p className={`text-xl font-extrabold mt-1 leading-tight ${accent ? 'text-white' : 'text-[#2d6410]'}`}>{value}</p>
      {hint && <p className={`text-[11px] mt-0.5 ${accent ? 'text-white/60' : 'text-gray-400'}`}>{hint}</p>}
    </div>
  );
}
