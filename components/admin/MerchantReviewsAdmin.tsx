'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { supabase } from '../../lib/supabase';

// Marchands → Avis : notes moyennes par marchand, liste des avis, masquer / réafficher.
type Review = { id: number; owner_id: string; shop: string; user_name: string | null; rating: number; comment: string | null; status: string; created_at: string };
const Stars = ({ v }: { v: number }) => <span className="text-[#f59e0b] text-sm">{'★'.repeat(Math.round(v))}<span className="text-gray-300">{'★'.repeat(5 - Math.round(v))}</span></span>;

export default function MerchantReviewsAdmin({ canEdit }: { canEdit: boolean }) {
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;
  const [data, setData] = useState<{ reviews: Review[]; merchants: { id: string; shop: string; avg: number; count: number }[] } | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const token = async () => {
    let { data: { session } } = await supabase.auth.getSession();
    if (!session || (session.expires_at && session.expires_at * 1000 < Date.now() + 60000)) session = (await supabase.auth.refreshSession()).data.session;
    return session?.access_token;
  };
  const load = useCallback(async () => {
    try { const res = await fetch('/api/admin/merchant-reviews', { headers: { Authorization: `Bearer ${await token()}` } }); const j = await res.json(); if (res.ok) setData(j); } catch { /* ignore */ }
  }, []);
  useEffect(() => { load(); }, [load]);
  const toggle = async (r: Review) => {
    setBusy(r.id);
    try { await fetch('/api/admin/merchant-reviews', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` }, body: JSON.stringify({ action: r.status === 'hidden' ? 'show' : 'hide', id: r.id }) }); await load(); } catch { /* ignore */ }
    setBusy(null);
  };
  if (!data) return <p className="text-center text-gray-400 py-16">⏳</p>;
  return (
    <div className="space-y-6">
      <section>
        <h3 className="font-bold text-[#526500] mb-2">⭐ {t('rev.admin_avg', 'Notes moyennes')}</h3>
        {data.merchants.length === 0 ? <p className="text-sm text-gray-400 bg-white rounded-xl border border-[#e3eebf] px-4 py-4">{t('rev.admin_none', 'Aucun avis pour le moment.')}</p> : (
          <div className="flex flex-wrap gap-2">{data.merchants.map(m => <div key={m.id} className="bg-white rounded-xl border border-[#d2e095] px-4 py-2 text-sm"><span className="font-semibold text-gray-800">🏪 {m.shop}</span> · <Stars v={m.avg} /> <strong>{m.avg}</strong>/5 · {m.count} {t('rev.count', 'avis')}</div>)}</div>
        )}
      </section>
      <section>
        <h3 className="font-bold text-gray-800 mb-2">💬 {t('rev.admin_list', 'Avis')} ({data.reviews.length})</h3>
        <div className="space-y-2">{data.reviews.map(r => (
          <div key={r.id} className={`bg-white rounded-xl border px-4 py-3 flex flex-wrap items-start gap-3 ${r.status === 'hidden' ? 'border-gray-200 opacity-60' : 'border-[#d2e095]'}`}>
            <div className="flex-1 min-w-0">
              <p className="text-sm"><Stars v={r.rating} /> <span className="font-semibold text-gray-800">{r.user_name || 'Client'}</span> <span className="text-xs text-gray-400">→ 🏪 {r.shop} · {new Date(r.created_at).toLocaleDateString('fr-FR')}</span>{r.status === 'hidden' && <span className="ml-2 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{t('rev.hidden', 'Masqué')}</span>}</p>
              {r.comment && <p className="text-sm text-gray-600 mt-1">{r.comment}</p>}
            </div>
            {canEdit && <button disabled={busy === r.id} onClick={() => toggle(r)} className={`text-xs font-semibold rounded-lg px-3 py-1.5 border disabled:opacity-50 ${r.status === 'hidden' ? 'border-[#d2e095] text-[#526500] hover:bg-[#ecf4d5]' : 'border-red-200 text-red-500 hover:bg-red-50'}`}>{r.status === 'hidden' ? `👁 ${t('rev.show', 'Réafficher')}` : `🙈 ${t('rev.hide', 'Masquer')}`}</button>}
          </div>
        ))}</div>
      </section>
    </div>
  );
}
