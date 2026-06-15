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
    marginPct: number | null; avgPrice: number; deliveredQty: number; deliveredRevenue: number;
  };
};

const STATUS_LABEL: Record<string, string> = {
  pending: '⏳', processing: '🚚', shipping: '📦', delivered: '✅', cancelled: '❌',
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
  const statusLabel = (s: string) => `${STATUS_LABEL[s] || ''} ${t(`admin.status_${s}`, s)}`.trim();

  const rows = (data?.rows || []).filter(r => !deliveredOnly || r.status === 'delivered');

  const exportCsv = () => {
    if (!data) return;
    const header = ['Date', 'Commande', 'Statut', 'Client', 'Quantité', 'Prix unitaire (Fdj)', 'Coût unitaire (Fdj)', 'CA (Fdj)', 'Marge (Fdj)'];
    const lines = rows.map(r => [
      dateFmt(r.date),
      '#' + String(r.order_id).slice(0, 8).toUpperCase(),
      r.status,
      (r.customer || '').replace(/;/g, ','),
      r.quantity,
      r.price,
      r.unit_cost ?? '',
      r.revenue,
      r.margin ?? '',
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

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-3xl my-4 shadow-xl" onClick={e => e.stopPropagation()}>
        {/* En-tête */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#ecf4d5] sticky top-0 bg-white rounded-t-2xl">
          <h3 className="font-bold text-[#2d6410] truncate">📈 {t('report.title', 'Ventes')} — {data?.product.name || '…'}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition text-lg font-bold flex-none">✕</button>
        </div>

        <div className="p-5">
          {/* Période + filtre + export */}
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <label className="text-xs text-gray-500">{t('report.from', 'Du')}
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="block mt-1 border border-[#d2e095] rounded-lg px-2 py-1.5 text-sm" />
            </label>
            <label className="text-xs text-gray-500">{t('report.to', 'Au')}
              <input type="date" value={to} onChange={e => setTo(e.target.value)} className="block mt-1 border border-[#d2e095] rounded-lg px-2 py-1.5 text-sm" />
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
            <p className="text-center text-gray-400 py-12">⏳</p>
          ) : !s ? (
            <p className="text-center text-gray-400 py-12">{t('report.error', 'Erreur de chargement.')}</p>
          ) : (
            <>
              {/* Synthèse */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                <Kpi label={t('report.qty', 'Quantité')} value={`${(deliveredOnly ? s.deliveredQty : s.qty).toLocaleString('fr-FR')} ${data!.product.unit}`} />
                <Kpi label={t('report.ca', 'CA')} value={fdj(deliveredOnly ? s.deliveredRevenue : s.revenue)} accent />
                <Kpi label={t('report.margin', 'Marge')} value={deliveredOnly ? '—' : fdj(s.margin)} hint={!deliveredOnly && s.marginPct != null ? `${s.marginPct}%` : undefined} />
                <Kpi label={t('report.avg_price', 'Prix moyen')} value={fdj(s.avgPrice)} />
              </div>
              <p className="text-[11px] text-gray-400 mb-3">{rows.length} {t('report.lines', 'ligne(s)')} · {t('report.scope', 'hors commandes annulées')}</p>

              {/* Tableau */}
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="text-gray-400 text-[11px] border-b border-[#ecf4d5]">
                      <th className="text-left font-medium px-2 py-2">{t('report.date', 'Date')}</th>
                      <th className="text-left font-medium px-2 py-2">{t('report.order', 'Commande')}</th>
                      <th className="text-left font-medium px-2 py-2">{t('report.status', 'Statut')}</th>
                      <th className="text-right font-medium px-2 py-2">{t('report.qty', 'Qté')}</th>
                      <th className="text-right font-medium px-2 py-2">{t('report.price', 'P.U.')}</th>
                      <th className="text-right font-medium px-2 py-2">{t('report.cost', 'Coût u.')}</th>
                      <th className="text-right font-medium px-2 py-2">{t('report.margin', 'Marge')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr><td colSpan={7} className="text-center text-gray-400 py-8">{t('report.empty', 'Aucune vente sur cette période.')}</td></tr>
                    ) : rows.map((r, i) => (
                      <tr key={i} className="border-b border-[#f5f9ea]">
                        <td className="px-2 py-2 text-gray-600 whitespace-nowrap">{dateFmt(r.date)}</td>
                        <td className="px-2 py-2 font-mono text-xs text-gray-500">#{String(r.order_id).slice(0, 8).toUpperCase()}</td>
                        <td className="px-2 py-2 whitespace-nowrap text-xs">{statusLabel(r.status)}</td>
                        <td className="px-2 py-2 text-right whitespace-nowrap">{r.quantity} {data!.product.unit}</td>
                        <td className="px-2 py-2 text-right whitespace-nowrap">{fdj(r.price)}</td>
                        <td className="px-2 py-2 text-right whitespace-nowrap text-gray-500">{fdj(r.unit_cost)}</td>
                        <td className="px-2 py-2 text-right whitespace-nowrap font-semibold text-[#2d6410]">{fdj(r.margin)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
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
