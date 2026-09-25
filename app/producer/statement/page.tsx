'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useLanguage } from '../../../context/LanguageContext';
import ProducerLayout from '../../../components/producer/ProducerLayout';

// « Mes reversements » : ce que Hornafresh doit au marchand (articles livrés non reversés) + historique

type Line = { item_id: number; order_id: number; order_date: string; customer: string; name: string; unit: string; quantity: number; price: number; total: number };
type Payout = { id: number; amount: number; lines_count: number; method: string; reference: string | null; period_from: string | null; period_to: string | null; paid_at: string };
type Data = { due: number; lines: Line[]; payouts: Payout[]; total_paid: number };

const fdj = (n: number) => `${Math.round(Number(n)).toLocaleString('fr-FR')} Fdj`;
const dateFr = (d: string | null) => d ? new Date(d.length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

function StatementContent() {
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const METHOD: Record<string, string> = { waafi: '📱 Waafi', cash: `💵 ${t('producer.sub_method_cash', 'Espèces')}`, other: t('producer.pay_other', 'Autre') };

  useEffect(() => {
    (async () => {
      try {
        let { data: { session } } = await supabase.auth.getSession();
        if (!session || (session.expires_at && session.expires_at * 1000 < Date.now() + 60000)) session = (await supabase.auth.refreshSession()).data.session;
        const res = await fetch('/api/producer/statement', { headers: { Authorization: `Bearer ${session?.access_token}` } });
        const j = await res.json();
        if (res.ok) setData(j);
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  const exportCsv = () => {
    if (!data) return;
    const rows = [[t('pay.col_date', 'Date'), t('pay.col_order', 'Commande'), t('pay.col_product', 'Produit'), t('pay.col_qty', 'Qté'), t('pay.col_price', 'Prix'), t('pay.col_total', 'Total')], ...data.lines.map(l => [dateFr(l.order_date), `#${l.order_id}`, l.name, `${l.quantity} ${l.unit}`, String(l.price), String(l.total)])];
    const csv = '﻿' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = `releve-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  };

  if (loading || !data) return <div className="flex items-center justify-center h-48"><p className="text-gray-400">{t('producer.loading', 'Chargement...')}</p></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-1">💸 {t('producer.nav_statement', 'Mes reversements')}</h1>
      <p className="text-xs text-gray-400 mb-6">{t('producer.statement_rule', 'Hornafresh encaisse vos clients et vous reverse 100 % du prix de vos articles livrés. Les lignes ci-dessous sont en attente de reversement.')}</p>

      <div className="grid grid-cols-2 gap-3 md:gap-4 mb-6">
        <div className="bg-gradient-to-br from-[#f6f9e6] to-white border border-[#d2e095] rounded-2xl p-4 md:p-6">
          <p className="text-xs text-gray-500">{t('producer.statement_due', 'À vous reverser')}</p>
          <p className="text-2xl md:text-3xl font-bold text-[#526500] mt-1">{fdj(data.due)}</p>
          <p className="text-xs text-gray-400 mt-1">{data.lines.length} {t('pay.lines', 'ligne(s)')}</p>
        </div>
        <div className="bg-white border border-[#d2e095] rounded-2xl p-4 md:p-6">
          <p className="text-xs text-gray-500">{t('producer.statement_paid', 'Déjà reversé')}</p>
          <p className="text-2xl md:text-3xl font-bold text-gray-700 mt-1">{fdj(data.total_paid)}</p>
          <p className="text-xs text-gray-400 mt-1">{data.payouts.length} {t('producer.statement_payouts', 'reversement(s)')}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#d2e095] p-5 md:p-6 mb-6">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="font-bold text-gray-800">📋 {t('producer.statement_pending', 'Articles livrés en attente')}</h2>
          {data.lines.length > 0 && <button onClick={exportCsv} className="text-xs font-semibold border border-[#d2e095] text-[#526500] rounded-lg px-3 py-1.5 hover:bg-[#ecf4d5]">⬇️ CSV</button>}
        </div>
        {data.lines.length === 0 ? <p className="text-sm text-gray-400">{t('producer.statement_empty', 'Rien en attente : toutes vos ventes livrées ont été reversées.')}</p> : (
          <><div className="md:hidden space-y-2">
            {data.lines.map(l => (
              <div key={l.item_id} className="bg-[#faf7e8] rounded-xl px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-800 truncate">{l.name}</p>
                  <p className="text-sm font-bold text-[#526500] whitespace-nowrap">{fdj(l.total)}</p>
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">{dateFr(l.order_date)} · #{l.order_id} · {l.customer} · {l.quantity} {l.unit} × {fdj(l.price)}</p>
              </div>
            ))}
          </div>
          <div className="hidden md:block overflow-x-auto -mx-2">
            <table className="w-full text-sm min-w-[520px]">
              <thead><tr className="text-left text-xs text-gray-400 border-b border-[#e3eebf]">
                <th className="px-2 py-2 font-medium">{t('pay.col_date', 'Date')}</th><th className="px-2 py-2 font-medium">{t('pay.col_order', 'Commande')}</th><th className="px-2 py-2 font-medium">{t('pay.col_product', 'Produit')}</th><th className="px-2 py-2 font-medium text-right">{t('pay.col_qty', 'Qté')}</th><th className="px-2 py-2 font-medium text-right">{t('pay.col_total', 'Total')}</th>
              </tr></thead>
              <tbody>{data.lines.map(l => (
                <tr key={l.item_id} className="border-b border-[#f0f4dc] last:border-0">
                  <td className="px-2 py-2.5 whitespace-nowrap text-gray-600">{dateFr(l.order_date)}</td>
                  <td className="px-2 py-2.5 text-gray-600">#{l.order_id} · {l.customer}</td>
                  <td className="px-2 py-2.5 text-gray-800">{l.name}</td>
                  <td className="px-2 py-2.5 text-right text-gray-600 whitespace-nowrap">{l.quantity} {l.unit} × {fdj(l.price)}</td>
                  <td className="px-2 py-2.5 text-right font-semibold text-[#526500] whitespace-nowrap">{fdj(l.total)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div></>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-[#d2e095] p-5 md:p-6">
        <h2 className="font-bold text-gray-800 mb-3">🗂️ {t('pay.history', 'Historique des reversements')}</h2>
        {data.payouts.length === 0 ? <p className="text-sm text-gray-400">{t('pay.history_empty', 'Aucun reversement enregistré.')}</p> : (
          <div className="space-y-2">{data.payouts.map(p => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 bg-[#faf7e8] rounded-xl px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-gray-800">{dateFr(p.paid_at)} · {METHOD[p.method] || p.method}{p.reference ? <span className="text-xs font-normal text-gray-500"> · {t('producer.sub_ref', 'Réf.')} {p.reference}</span> : null}</p>
                <p className="text-xs text-gray-400">{p.lines_count} {t('pay.lines', 'ligne(s)')} · {dateFr(p.period_from)} → {dateFr(p.period_to)}</p>
              </div>
              <p className="font-bold text-[#526500]">{fdj(p.amount)}</p>
            </div>
          ))}</div>
        )}
      </div>
    </div>
  );
}

export default function ProducerStatementPage() {
  return <ProducerLayout>{() => <StatementContent />}</ProducerLayout>;
}
