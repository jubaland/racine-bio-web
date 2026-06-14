'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { supabase } from '../../lib/supabase';
import { useCan } from '../../context/AdminPermsContext';

type Refund = {
  id: number;
  order_id: number;
  amount: number;
  method: 'wallet' | 'manual';
  reason: string | null;
  status: 'pending' | 'done';
  created_at: string;
  done_at: string | null;
  order: { customer_name: string | null; payment_method: string | null; phone: string | null } | null;
};

const PAYMENT_LABELS: Record<string, string> = { waafi: '📱 Waafi', dmoney: '💳 D-Money', cash: '💵 Espèces', wallet: '💰 Cagnotte' };

export default function AdminRefunds() {
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;
  const { can } = useCan();
  const canEdit = can('refunds', 'edit');

  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const tk = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch('/api/admin/refunds', { headers: { Authorization: `Bearer ${tk}` } });
      const j = await res.json();
      if (res.ok) setRefunds(j.refunds || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const markDone = async (r: Refund) => {
    if (!confirm(t('refunds.mark_confirm', 'Confirmer que ce remboursement a bien été effectué ?'))) return;
    setBusyId(r.id);
    try {
      const tk = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch('/api/admin/refunds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` },
        body: JSON.stringify({ refund_id: r.id }),
      });
      if (res.ok) setRefunds(prev => prev.map(x => x.id === r.id ? { ...x, status: 'done', done_at: new Date().toISOString() } : x));
    } catch { /* ignore */ }
    setBusyId(null);
  };

  const fdj = (n: number) => `${Number(n).toLocaleString('fr-FR')} Fdj`;
  const date = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

  const pending = refunds.filter(r => r.status === 'pending');
  const done = refunds.filter(r => r.status === 'done');
  const pendingTotal = pending.reduce((s, r) => s + Number(r.amount), 0);

  const Row = ({ r }: { r: Refund }) => (
    <div className="bg-white rounded-xl border border-[#e3eebf] px-4 py-3 flex flex-wrap items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800">
          #{String(r.order_id).slice(0, 8).toUpperCase()} · {r.order?.customer_name || '—'}
          <span className="ml-2 text-[11px] font-normal text-gray-400">{PAYMENT_LABELS[r.order?.payment_method || ''] || ''}</span>
        </p>
        <p className="text-xs text-gray-500">{r.reason || '—'} · {date(r.created_at)}{r.order?.phone ? ` · 📞 ${r.order.phone}` : ''}</p>
      </div>
      <span className="font-bold text-[#526500] flex-none">{fdj(r.amount)}</span>
      {r.status === 'pending' ? (
        canEdit ? (
          <button onClick={() => markDone(r)} disabled={busyId === r.id}
            className="flex-none text-xs font-semibold bg-[#a8c800] text-white rounded-lg px-3 py-1.5 hover:bg-[#7d9800] transition disabled:opacity-50">
            {busyId === r.id ? '⏳' : '✅ ' + t('refunds.mark_done', 'Marquer remboursé')}
          </button>
        ) : <span className="text-[11px] text-amber-600">⏳ {t('refunds.todo', 'À effectuer')}</span>
      ) : (
        <span className="flex-none text-[11px] text-green-600 bg-green-50 border border-green-200 rounded-lg px-2 py-1">
          ✅ {r.method === 'wallet' ? t('refunds.auto', 'Cagnotte (auto)') : t('refunds.done', 'Effectué')}{r.done_at ? ` · ${date(r.done_at)}` : ''}
        </span>
      )}
    </div>
  );

  return (
    <div>
      <h2 className="text-xl font-bold text-[#2d6410] mb-1">💸 {t('refunds.title', 'Remboursements')}</h2>
      <p className="text-sm text-gray-500 mb-5">{t('refunds.subtitle', 'Suivi des remboursements suite aux modifications/annulations de commande.')}</p>

      {loading ? (
        <p className="text-center text-gray-400 py-16">⏳</p>
      ) : (
        <>
          {/* À effectuer */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-amber-800">⏳ {t('refunds.todo_title', 'À effectuer')} ({pending.length})</h3>
              {pending.length > 0 && <span className="text-sm font-bold text-amber-800">{fdj(pendingTotal)}</span>}
            </div>
            {pending.length === 0 ? (
              <p className="text-sm text-gray-400 bg-white rounded-xl border border-[#e3eebf] px-4 py-6 text-center">{t('refunds.todo_empty', 'Aucun remboursement en attente. 🎉')}</p>
            ) : (
              <div className="space-y-2">{pending.map(r => <Row key={r.id} r={r} />)}</div>
            )}
          </div>

          {/* Effectués */}
          <div>
            <h3 className="font-bold text-gray-600 mb-2">✅ {t('refunds.done_title', 'Effectués')} ({done.length})</h3>
            {done.length === 0 ? (
              <p className="text-sm text-gray-400">{t('refunds.done_empty', 'Aucun remboursement effectué pour le moment.')}</p>
            ) : (
              <div className="space-y-2">{done.map(r => <Row key={r.id} r={r} />)}</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
