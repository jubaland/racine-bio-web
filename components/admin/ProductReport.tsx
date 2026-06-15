'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { supabase } from '../../lib/supabase';

type Row = {
  order_id: number; date: string; status: string; customer: string | null;
  quantity: number; price: number; unit_cost: number | null;
  revenue: number; cost: number | null; margin: number | null;
};
type Data = {
  product: { id: number; name: string; unit: string };
  rows: Row[];
  summary: {
    count: number; qty: number; revenue: number; cost: number; margin: number;
    marginPct: number | null; avgPrice: number;
    deliveredQty: number; deliveredRevenue: number;
    deliveredMargin: number; deliveredMarginPct: number | null; deliveredAvgPrice: number;
  };
};

const STATUS_EMOJI: Record<string, string> = {
  pending: '⏳', processing: '🚚', shipping: '📦', delivered: '✅', cancelled: '❌',
};
const STATUS_CLS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800', processing: 'bg-blue-100 text-blue-800',
  shipping: 'bg-purple-100 text-purple-800', delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-orange-100 text-[#f97316]',
};

export default function ProductReport({
  productId, defaultFrom, defaultTo, onClose,
}: { productId: number; defaultFrom: string; defaultTo: string; onClose: () => void }) {
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [deliveredOnly, setDeliveredOnly] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const tk = (await supabase.auth.getSession()).data.session?.access_token;
      const qs = new URLSearchParams({ product_id: String(productId) });
      if (from) qs.set('from', from);
      if (to) qs.set('to', to);
      const res = await fetch(`/api/admin/finances/product?${qs}`, { headers: { Authorization: `Bearer ${tk}` } });
      const j = await res.json();
      if (res.ok) setData(j);
    } catch { /* ignore */ }
    setLoading(false);
  }, [productId, from, to]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const fdj = (n: number | null) => n == null ? '—' : `${Math.round(n).toLocaleString('fr-FR')} Fdj`;
  const dateFmt = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const rows = (data?.rows || []).filter(r => !deliveredOnly || r.status === 'delivered');

  const exportCsv = () => {
    if (!data) return;
    const header = ['Date', 'Commande', 'Statut', 'Client', 'Quantité', 'Prix unitaire (Fdj)', 'Coût unitaire (Fdj)', 'CA (Fdj)', 'Marge (Fdj)'];
    const lines = rows.map(r => [
      dateFmt(r.date), '#' + String(r.order_id).slice(0, 8).toUpperCase(), r.status,
      (r.customer || '').replace(/;/g, ','), r.quantity, r.price, r.unit_cost ?? '', r.revenue, r.margin ?? '',
    ].join(';'));
    const csv = '﻿' + [header.join(';'), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ventes-${data.product.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${from || 'debut'}_${to || 'fin'}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const s = data?.summary;
  const unit = data?.product.unit || '';

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-2 sm:p-6" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* En-tête (figé) */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-[#ecf4d5] flex-none">
          <h3 className="font-bold text-[#2d6410] truncate">📈 {t('report.title', 'Ventes')} — {data?.product.name || '…'}</h3>
          <button onClick={onClose} aria-label="Fermer" className="w-8 h-8 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition text-lg font-bold flex-none">✕</button>
        </div>

        {/* Barre d'actions (figée) */}
        <div className="flex flex-wrap items-end gap-3 px-5 py-3 border-b border-[#f0f7e0] bg-[#faf7e8] flex-none">
          <label className="text-[11px] text-gray-500">{t('report.from', 'Du')}
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="block mt-1 border border-[#d2e095] rounded-lg px-2 py-1.5 text-sm bg-white" />
          </label>
          <label className="text-[11px] text-gray-500">{t('report.to', 'Au')}
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="block mt-1 border border-[#d2e095] rounded-lg px-2 py-1.5 text-sm bg-white" />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-gray-600 ml-auto cursor-pointer">
            <input type="checkbox" checked={deliveredOnly} onChange={e => setDeliveredOnly(e.target.checked)} className="accent-[#a8c800]" />
            {t('report.delivered_only', 'Livrées uniquement')}
          </label>
          <button onClick={exportCsv} disabled={!rows.length} className="text-xs font-semibold bg-[#526500] text-white rounded-lg px-3 py-2 hover:bg-[#3a4800] transition disabled:opacity-40">
            ⬇ {t('report.export', 'Export CSV')}
          </button>
        </div>

        {loading ? (
          <p className="text-center text-gray-400 py-16 flex-1">⏳</p>
        ) : !s ? (
          <p className="text-center text-gray-400 py-16 flex-1">{t('report.error', 'Erreur de chargement.')}</p>
        ) : (
          <>
            {/* Synthèse (figée) */}
            <div className="px-5 pt-4 flex-none">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Kpi label={t('report.qty', 'Quantité')} value={`${(deliveredOnly ? s.deliveredQty : s.qty).toLocaleString('fr-FR')} ${unit}`} />
                <Kpi label={t('report.ca', 'CA')} value={fdj(deliveredOnly ? s.deliveredRevenue : s.revenue)} accent />
                <Kpi label={t('report.margin', 'Marge')}
                  value={fdj(deliveredOnly ? s.deliveredMargin : s.margin)}
                  hint={(deliveredOnly ? s.deliveredMarginPct : s.marginPct) != null ? `${deliveredOnly ? s.deliveredMarginPct : s.marginPct}%` : undefined} />
                <Kpi label={t('report.avg_price', 'Prix moyen')} value={fdj(deliveredOnly ? s.deliveredAvgPrice : s.avgPrice)} />
              </div>
              <p className="text-[11px] text-gray-400 mt-2 mb-1">{rows.length} {t('report.lines', 'ligne(s)')} · {t('report.scope', 'hors commandes annulées')}</p>
            </div>

            {/* Tableau (zone défilante, en-tête figé) */}
            <div className="flex-1 overflow-auto px-5 pb-5 min-h-0">
              <table className="w-full text-sm border-separate border-spacing-0 min-w-[720px]">
                <thead>
                  <tr className="text-gray-500 text-[11px]">
                    {([
                      ['report.date', 'Date', false], ['report.order', 'Commande', false], ['report.client', 'Client', false], ['report.status', 'Statut', false],
                      ['report.qty', 'Qté', true], ['report.price', 'P.U.', true], ['report.cost', 'Coût u.', true], ['report.margin', 'Marge', true],
                    ] as [string, string, boolean][]).map(([k, f, right]) => (
                      <th key={k} className={`sticky top-0 bg-[#ecf4d5] font-semibold px-2.5 py-2 whitespace-nowrap first:rounded-l-lg last:rounded-r-lg ${right ? 'text-right' : 'text-left'}`}>
                        {t(k, f)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={8} className="text-center text-gray-400 py-10">{t('report.empty', 'Aucune vente sur cette période.')}</td></tr>
                  ) : rows.map((r, i) => (
                    <tr key={i} className="even:bg-[#f9fcf0] hover:bg-[#f1f8df] transition">
                      <td className="px-2.5 py-2 text-gray-600 whitespace-nowrap border-b border-[#f0f7e0]">{dateFmt(r.date)}</td>
                      <td className="px-2.5 py-2 font-mono text-xs text-gray-500 border-b border-[#f0f7e0]">#{String(r.order_id).slice(0, 8).toUpperCase()}</td>
                      <td className="px-2.5 py-2 text-gray-700 whitespace-nowrap border-b border-[#f0f7e0] max-w-[160px] truncate">{r.customer || '—'}</td>
                      <td className="px-2.5 py-2 border-b border-[#f0f7e0]">
                        <span className={`inline-block text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_CLS[r.status] || 'bg-gray-100 text-gray-600'}`}>
                          {STATUS_EMOJI[r.status] || ''} {t(`admin.status_${r.status}`, r.status)}
                        </span>
                      </td>
                      <td className="px-2.5 py-2 text-right whitespace-nowrap border-b border-[#f0f7e0]">{r.quantity} {unit}</td>
                      <td className="px-2.5 py-2 text-right whitespace-nowrap text-gray-600 border-b border-[#f0f7e0]">{fdj(r.price)}</td>
                      <td className="px-2.5 py-2 text-right whitespace-nowrap text-gray-400 border-b border-[#f0f7e0]">{fdj(r.unit_cost)}</td>
                      <td className="px-2.5 py-2 text-right whitespace-nowrap font-semibold text-[#2d6410] border-b border-[#f0f7e0]">{fdj(r.margin)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl p-3 border ${accent ? 'bg-[#ecf4d5] border-[#a8c800]' : 'bg-[#faf7e8] border-[#e3eebf]'}`}>
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="text-base font-extrabold text-[#2d6410] leading-tight">{value}{hint && <span className="text-xs font-normal text-gray-400"> · {hint}</span>}</p>
    </div>
  );
}
