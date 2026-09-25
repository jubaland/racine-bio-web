'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { supabase } from '../../lib/supabase';

// Marchands → Reversements : dû par marchand, détail des lignes livrées, reversement, historique.

type MerchantDue = { id: string; shop: string; due: number; lines: number; oldest: string | null };
type Payout = { id: number; user_id: string; shop?: string; amount: number; lines_count: number; method: string; reference: string | null; note: string | null; period_from: string | null; period_to: string | null; paid_at: string };
type Line = { item_id: number; order_id: number; order_date: string; customer: string; name: string; unit: string; quantity: number; price: number; total: number };

const fdj = (n: number) => `${Math.round(Number(n)).toLocaleString('fr-FR')} Fdj`;
const dateFr = (d: string | null) => d ? new Date(d.length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const METHOD: Record<string, string> = { waafi: '📱 Waafi', cash: '💵 Espèces', other: 'Autre' };

export default function MerchantPayouts({ canEdit }: { canEdit: boolean }) {
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;
  const [data, setData] = useState<{ merchants: MerchantDue[]; payouts: Payout[]; total_due: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<{ id: string; shop: string; lines: Line[]; payouts: Payout[]; due: number } | null>(null);
  const [payFor, setPayFor] = useState<MerchantDue | null>(null);
  const [method, setMethod] = useState('waafi');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const token = async () => {
    let { data: { session } } = await supabase.auth.getSession();
    if (!session || (session.expires_at && session.expires_at * 1000 < Date.now() + 60000)) session = (await supabase.auth.refreshSession()).data.session;
    return session?.access_token;
  };
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/merchants/payouts', { headers: { Authorization: `Bearer ${await token()}` } });
      const j = await res.json();
      if (res.ok) setData(j);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const openDetail = async (m: MerchantDue) => {
    setDetail({ id: m.id, shop: m.shop, lines: [], payouts: [], due: 0 });
    try {
      const res = await fetch(`/api/admin/merchants/payouts?user_id=${m.id}`, { headers: { Authorization: `Bearer ${await token()}` } });
      const j = await res.json();
      if (res.ok) setDetail({ id: m.id, shop: m.shop, lines: j.lines, payouts: j.payouts, due: j.due });
    } catch { /* ignore */ }
  };

  const pay = async () => {
    if (!payFor) return;
    setError('');
    if (method === 'waafi' && !reference.trim()) { setError(t('pay.ref_required', 'Indiquez la référence Waafi du virement.')); return; }
    if (!confirm(`${t('pay.confirm', 'Enregistrer un reversement de')} ${fdj(payFor.due)} ${t('pay.confirm_to', 'à')} ${payFor.shop} ?\n\n${t('pay.confirm_note', 'Toutes ses lignes livrées non reversées seront marquées comme réglées. Le marchand sera notifié.')}`)) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/merchants/payouts', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` }, body: JSON.stringify({ user_id: payFor.id, method, reference, note }) });
      const j = await res.json();
      if (!res.ok) { setError(j.error === 'nothing_due' ? t('pay.nothing_due', 'Rien à reverser pour ce marchand.') : (j.error || 'Erreur')); }
      else { setPayFor(null); setReference(''); setNote(''); await load(); if (detail?.id === payFor.id) openDetail(payFor); }
    } catch (e: any) { setError(e.message); }
    setBusy(false);
  };

  const exportCsv = (shop: string, lines: Line[]) => {
    const rows = [['Date', 'Commande', 'Client', 'Produit', 'Qté', 'Unité', 'Prix', 'Total'], ...lines.map(l => [dateFr(l.order_date), `#${l.order_id}`, l.customer, l.name, String(l.quantity), l.unit, String(l.price), String(l.total)])];
    const csv = '﻿' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = `releve-${shop.replace(/\s+/g, '_')}-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  };

  if (loading || !data) return <p className="text-center text-gray-400 py-16">⏳</p>;

  return (
    <div className="space-y-6">
      <div className="bg-[#f6f9e6] border border-[#d2e095] rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-700">💸 {t('pay.total_due', 'Total à reverser aux marchands')}</p>
        <p className="text-xl font-bold text-[#526500]">{fdj(data.total_due)}</p>
      </div>
      <p className="text-xs text-gray-400 -mt-4">{t('pay.rule', 'Règle : 100 % du prix des articles livrés revient au marchand ; les frais de livraison restent à Hornafresh. Une ligne réduite ou annulée n\'est jamais comptée.')}</p>

      {/* Dû par marchand */}
      <section>
        <h3 className="font-bold text-[#526500] mb-2">🧑‍🌾 {t('pay.by_merchant', 'Par marchand')}</h3>
        {data.merchants.length === 0 ? <p className="text-sm text-gray-400 bg-white rounded-xl border border-[#e3eebf] px-4 py-4">{t('pay.none', 'Aucune vente marchande livrée pour le moment.')}</p> : data.merchants.map(m => (
          <div key={m.id} className="bg-white rounded-xl border border-[#d2e095] px-4 py-3 flex flex-wrap items-center gap-3 mb-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800">🏪 {m.shop}</p>
              <p className="text-xs text-gray-500">{m.lines} {t('pay.lines_due', 'ligne(s) livrée(s) à reverser')}{m.oldest ? ` · ${t('pay.since', 'depuis le')} ${dateFr(m.oldest)}` : ''}</p>
            </div>
            <p className={`text-lg font-bold ${m.due > 0 ? 'text-[#526500]' : 'text-gray-300'}`}>{fdj(m.due)}</p>
            <div className="flex gap-2">
              <button onClick={() => openDetail(m)} className="text-xs font-semibold border border-[#d2e095] text-[#526500] rounded-lg px-3 py-1.5 hover:bg-[#ecf4d5]">📋 {t('pay.detail', 'Détail')}</button>
              {canEdit && m.due > 0 && <button onClick={() => { setPayFor(m); setMethod('waafi'); setReference(''); setNote(''); setError(''); }} className="text-xs font-semibold bg-[#a8c800] text-white rounded-lg px-3 py-1.5 hover:bg-[#7d9800]">💸 {t('pay.pay', 'Reverser')}</button>}
            </div>
          </div>
        ))}
      </section>

      {/* Historique global */}
      <section>
        <h3 className="font-bold text-gray-800 mb-2">🗂️ {t('pay.history', 'Historique des reversements')} ({data.payouts.length})</h3>
        {data.payouts.length === 0 ? <p className="text-sm text-gray-400 bg-white rounded-xl border border-[#e3eebf] px-4 py-4">{t('pay.history_empty', 'Aucun reversement enregistré.')}</p> : (
          <><div className="md:hidden space-y-2">
            {data.payouts.map(p => (
              <div key={p.id} className="bg-white rounded-xl border border-[#d2e095] px-3 py-2.5">
                <div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-gray-800">🏪 {p.shop}</p><p className="text-sm font-bold text-[#526500] whitespace-nowrap">{fdj(p.amount)}</p></div>
                <p className="text-[11px] text-gray-500 mt-0.5">{dateFr(p.paid_at)} · {METHOD[p.method] || p.method}{p.reference ? ` · ${p.reference}` : ''} · {p.lines_count} {t('pay.lines', 'ligne(s)')} · {dateFr(p.period_from)} → {dateFr(p.period_to)}</p>
              </div>
            ))}
          </div>
          <div className="hidden md:block bg-white rounded-xl border border-[#d2e095] overflow-x-auto">
            <table className="w-full text-sm min-w-[620px]">
              <thead><tr className="text-left text-xs text-gray-400 border-b border-[#ecf4d5]">
                <th className="px-3 py-2 font-medium">{t('pay.col_date', 'Date')}</th><th className="px-3 py-2 font-medium">{t('pay.col_merchant', 'Marchand')}</th><th className="px-3 py-2 font-medium">{t('pay.col_period', 'Période')}</th><th className="px-3 py-2 font-medium text-right">{t('pay.col_amount', 'Montant')}</th><th className="px-3 py-2 font-medium">{t('pay.col_method', 'Mode')}</th>
              </tr></thead>
              <tbody>{data.payouts.map(p => (
                <tr key={p.id} className="border-b border-[#f0f4dc] last:border-0">
                  <td className="px-3 py-2 whitespace-nowrap text-gray-600">{dateFr(p.paid_at)}</td>
                  <td className="px-3 py-2 text-gray-800">🏪 {p.shop}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-500 text-xs">{dateFr(p.period_from)} → {dateFr(p.period_to)} · {p.lines_count} {t('pay.lines', 'ligne(s)')}</td>
                  <td className="px-3 py-2 text-right font-semibold text-[#526500] whitespace-nowrap">{fdj(p.amount)}</td>
                  <td className="px-3 py-2 text-gray-600 text-xs">{METHOD[p.method] || p.method}{p.reference ? ` · ${p.reference}` : ''}{p.note ? <span className="block text-gray-400">{p.note}</span> : null}</td>
                </tr>
              ))}</tbody>
            </table>
          </div></>
        )}
      </section>

      {/* Modal détail */}
      {detail && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="font-bold text-[#2d6410]">📋 🏪 {detail.shop} — {t('pay.detail_title', 'lignes à reverser')} · {fdj(detail.due)}</h3>
              <div className="flex gap-2">
                {detail.lines.length > 0 && <button onClick={() => exportCsv(detail.shop, detail.lines)} className="text-xs font-semibold border border-[#d2e095] text-[#526500] rounded-lg px-3 py-1.5 hover:bg-[#ecf4d5]">⬇️ CSV</button>}
                <button onClick={() => setDetail(null)} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500">✕</button>
              </div>
            </div>
            {detail.lines.length === 0 ? <p className="text-sm text-gray-400 py-6 text-center">{t('pay.no_lines', 'Aucune ligne en attente.')}</p> : (
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-gray-400 border-b border-[#ecf4d5]">
                  <th className="px-2 py-2 font-medium">{t('pay.col_date', 'Date')}</th><th className="px-2 py-2 font-medium">{t('pay.col_order', 'Commande')}</th><th className="px-2 py-2 font-medium">{t('pay.col_product', 'Produit')}</th><th className="px-2 py-2 font-medium text-right">{t('pay.col_qty', 'Qté')}</th><th className="px-2 py-2 font-medium text-right">{t('pay.col_price', 'Prix')}</th><th className="px-2 py-2 font-medium text-right">{t('pay.col_total', 'Total')}</th>
                </tr></thead>
                <tbody>{detail.lines.map(l => (
                  <tr key={l.item_id} className="border-b border-[#f0f4dc] last:border-0">
                    <td className="px-2 py-2 whitespace-nowrap text-gray-600">{dateFr(l.order_date)}</td>
                    <td className="px-2 py-2 text-gray-600">#{l.order_id} · {l.customer}</td>
                    <td className="px-2 py-2 text-gray-800">{l.name}</td>
                    <td className="px-2 py-2 text-right text-gray-600 whitespace-nowrap">{l.quantity} {l.unit}</td>
                    <td className="px-2 py-2 text-right text-gray-600 whitespace-nowrap">{fdj(l.price)}</td>
                    <td className="px-2 py-2 text-right font-semibold text-[#526500] whitespace-nowrap">{fdj(l.total)}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
            {detail.payouts.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-gray-500 mb-1">{t('pay.history', 'Historique des reversements')}</p>
                {detail.payouts.map(p => <p key={p.id} className="text-xs text-gray-600">{dateFr(p.paid_at)} · {fdj(p.amount)} · {METHOD[p.method] || p.method}{p.reference ? ` · ${p.reference}` : ''} · {p.lines_count} {t('pay.lines', 'ligne(s)')}</p>)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal reversement */}
      {payFor && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setPayFor(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-[#2d6410] mb-1">💸 {t('pay.pay_title', 'Reverser à')} {payFor.shop}</h3>
            <p className="text-sm text-gray-600 mb-4">{fdj(payFor.due)} · {payFor.lines} {t('pay.lines', 'ligne(s)')} — {t('pay.pay_hint', 'à enregistrer une fois le virement Waafi ou la remise en espèces effectués.')}</p>
            <label className="block text-xs font-semibold text-gray-600 mb-1">{t('mer.method', 'Moyen de paiement')}</label>
            <select value={method} onChange={e => setMethod(e.target.value)} className="w-full border border-[#d2e095] rounded-xl px-3 py-2 text-sm mb-3 bg-white">
              <option value="waafi">📱 Waafi</option><option value="cash">💵 Espèces</option><option value="other">Autre</option>
            </select>
            <input value={reference} onChange={e => setReference(e.target.value)} placeholder={method === 'waafi' ? t('pay.ref_ph', 'Ex : référence du virement Waafi') : t('pay.ref_ph_cash', 'Ex : remis en main propre (optionnel)')} className="w-full border border-[#d2e095] rounded-xl px-3 py-2 text-sm mb-3" />
            <input value={note} onChange={e => setNote(e.target.value)} placeholder={t('pay.note_ph', 'Ex : note interne (optionnel)')} className="w-full border border-[#d2e095] rounded-xl px-3 py-2 text-sm mb-3" />
            {error && <p className="text-xs text-red-500 mb-3">⚠️ {error}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setPayFor(null)} className="text-sm px-4 py-2 rounded-xl border border-gray-200 text-gray-600">{t('admin.cancel', 'Annuler')}</button>
              <button disabled={busy} onClick={pay} className="text-sm font-semibold px-4 py-2 rounded-xl bg-[#a8c800] text-white hover:bg-[#7d9800] disabled:opacity-50">{busy ? '…' : `✅ ${t('pay.record', 'Enregistrer le reversement')}`}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
