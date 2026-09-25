'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useLanguage } from '../../../context/LanguageContext';
import ProducerLayout from '../../../components/producer/ProducerLayout';

// « Mes promotions » : prix promo planifié sur une période, sans toucher au prix du produit
// (donc sans re-validation). Le site affiche le prix promo et l'ancien prix barré pendant la période.

type Product = { id: number; name: string; unit: string; price: number };
type Promo = { id: number; product_id: number; promo_price: number; starts_at: string; ends_at: string; status: string; state: 'upcoming' | 'active' | 'ended' | 'cancelled'; product: { name: string; unit: string; price: number } | null };

const fdj = (n: number) => `${Math.round(Number(n)).toLocaleString('fr-FR')} Fdj`;
const dateFr = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
const plusDays = (d: string, n: number) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

function PromotionsContent() {
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;
  const [data, setData] = useState<{ today: string; products: Product[]; promotions: Promo[] } | null>(null);
  const [form, setForm] = useState({ product_id: '', promo_price: '', starts_at: '', ends_at: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const token = async () => {
    let { data: { session } } = await supabase.auth.getSession();
    if (!session || (session.expires_at && session.expires_at * 1000 < Date.now() + 60000)) session = (await supabase.auth.refreshSession()).data.session;
    return session?.access_token;
  };
  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/producer/promotions', { headers: { Authorization: `Bearer ${await token()}` } });
      const j = await res.json();
      if (res.ok) { setData(j); setForm(f => ({ ...f, starts_at: f.starts_at || j.today, ends_at: f.ends_at || plusDays(j.today, 6) })); }
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  const ERR: Record<string, string> = {
    invalid: t('promo.err_invalid', 'Champs incomplets.'),
    not_published: t('promo.err_not_published', 'Le produit doit être publié.'),
    price_not_lower: t('promo.err_price', 'Le prix promo doit être inférieur au prix normal.'),
    start_in_past: t('promo.err_past', 'La date de début ne peut pas être passée.'),
    end_before_start: t('promo.err_end', 'La date de fin doit être après le début.'),
    too_long: t('promo.err_long', '90 jours maximum.'),
    overlap: t('promo.err_overlap', 'Une promotion est déjà programmée sur ce produit à ces dates.'),
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(''); setBusy(true);
    try {
      const res = await fetch('/api/producer/promotions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` }, body: JSON.stringify(form) });
      const j = await res.json();
      if (!res.ok) setMsg('⚠️ ' + (ERR[j.error] || j.error || 'Erreur'));
      else { setMsg('✅ ' + t('promo.created', 'Promotion programmée.')); setForm(f => ({ ...f, product_id: '', promo_price: '' })); await load(); }
    } catch (e: any) { setMsg('⚠️ ' + e.message); }
    setBusy(false);
  };
  const cancel = async (p: Promo) => {
    if (!confirm(t('promo.cancel_confirm', 'Annuler cette promotion ? Le prix normal s\'applique immédiatement.'))) return;
    setBusy(true);
    try { await fetch('/api/producer/promotions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` }, body: JSON.stringify({ action: 'cancel', id: p.id }) }); await load(); } catch { /* ignore */ }
    setBusy(false);
  };

  if (!data) return <div className="flex items-center justify-center h-48"><p className="text-gray-400">{t('producer.loading', 'Chargement...')}</p></div>;
  const selected = data.products.find(p => String(p.id) === form.product_id);
  const pct = selected && form.promo_price ? Math.round((1 - Number(form.promo_price) / selected.price) * 100) : null;
  const STATE: Record<Promo['state'], { label: string; cls: string }> = {
    active:    { label: t('promo.state_active', '🔥 En cours'),   cls: 'bg-orange-100 text-orange-700' },
    upcoming:  { label: t('promo.state_upcoming', '🗓️ À venir'), cls: 'bg-blue-100 text-blue-700' },
    ended:     { label: t('promo.state_ended', 'Terminée'),        cls: 'bg-gray-100 text-gray-500' },
    cancelled: { label: t('promo.state_cancelled', 'Annulée'),     cls: 'bg-gray-100 text-gray-400' },
  };
  const inputCls = 'w-full border border-[#d2e095] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-[#a8c800]';

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-1">🏷️ {t('producer.nav_promotions', 'Mes promotions')}</h1>
      <p className="text-xs text-gray-400 mb-6">{t('promo.intro', 'Programmez un prix promo sur une période : le site affiche le prix promo avec l\'ancien prix barré, puis revient automatiquement au prix normal. Sans re-validation.')}</p>

      <div className="bg-white rounded-2xl border border-[#d2e095] p-5 md:p-6 mb-6">
        <h2 className="font-bold text-[#526500] mb-4">➕ {t('promo.new', 'Nouvelle promotion')}</h2>
        {data.products.length === 0 ? <p className="text-sm text-gray-400">{t('promo.no_products', 'Aucun produit publié : publiez d\'abord un produit.')}</p> : (
          <form onSubmit={submit} className="grid sm:grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-gray-600 sm:col-span-2">{t('promo.product', 'Produit')}
              <select value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))} className={inputCls + ' mt-1'} required>
                <option value="">— {t('bp.select_placeholder', 'Sélectionner')} —</option>
                {data.products.map(p => <option key={p.id} value={p.id}>{p.name} — {fdj(p.price)} / {p.unit}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-gray-600">{t('promo.price', 'Prix promo (Fdj)')}
              <input type="number" min={1} value={form.promo_price} onChange={e => setForm(f => ({ ...f, promo_price: e.target.value }))} className={inputCls + ' mt-1'} placeholder={selected ? `${t('promo.price_ph', 'Ex :')} ${Math.round(selected.price * 0.8)}` : t('promo.price_ph', 'Ex : 400')} required />
              {pct != null && <span className={`block mt-1 text-[11px] ${pct > 0 ? 'text-orange-600' : 'text-red-500'}`}>{pct > 0 ? `−${pct} % ${t('promo.vs', 'par rapport à')} ${fdj(selected!.price)}` : t('promo.err_price', 'Le prix promo doit être inférieur au prix normal.')}</span>}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs font-semibold text-gray-600">{t('promo.from', 'Du')}<input type="date" min={data.today} value={form.starts_at} onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))} className={inputCls + ' mt-1'} required /></label>
              <label className="text-xs font-semibold text-gray-600">{t('promo.to', 'Au')}<input type="date" min={form.starts_at || data.today} value={form.ends_at} onChange={e => setForm(f => ({ ...f, ends_at: e.target.value }))} className={inputCls + ' mt-1'} required /></label>
            </div>
            {msg && <p className={`sm:col-span-2 text-sm ${msg.startsWith('✅') ? 'text-green-700' : 'text-red-500'}`}>{msg}</p>}
            <div className="sm:col-span-2"><button type="submit" disabled={busy} className="bg-[#a8c800] text-white font-semibold rounded-full px-6 py-2.5 hover:bg-[#7d9800] transition disabled:opacity-50">🏷️ {t('promo.schedule', 'Programmer')}</button></div>
          </form>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-[#d2e095] p-5 md:p-6">
        <h2 className="font-bold text-gray-800 mb-3">📋 {t('promo.list', 'Promotions')}</h2>
        {data.promotions.length === 0 ? <p className="text-sm text-gray-400">{t('promo.empty', 'Aucune promotion pour le moment.')}</p> : (
          <div className="space-y-2">{data.promotions.map(p => { const st = STATE[p.state]; return (
            <div key={p.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3 ${p.state === 'active' ? 'bg-orange-50 border border-orange-200' : 'bg-[#faf7e8]'}`}>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800">{p.product?.name || `#${p.product_id}`} <span className={`ml-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span></p>
                <p className="text-xs text-gray-500">{dateFr(p.starts_at)} → {dateFr(p.ends_at)} · <s className="text-gray-400">{p.product ? fdj(p.product.price) : ''}</s> <strong className="text-[#526500]">{fdj(p.promo_price)}</strong>{p.product ? ` (−${Math.round((1 - Number(p.promo_price) / p.product.price) * 100)} %)` : ''}</p>
              </div>
              {(p.state === 'active' || p.state === 'upcoming') && <button onClick={() => cancel(p)} disabled={busy} className="text-xs font-semibold border border-red-200 text-red-500 rounded-lg px-3 py-1.5 hover:bg-red-50 disabled:opacity-50">✖ {t('promo.cancel', 'Annuler')}</button>}
            </div>
          ); })}</div>
        )}
      </div>
    </div>
  );
}

export default function ProducerPromotionsPage() {
  return <ProducerLayout>{() => <PromotionsContent />}</ProducerLayout>;
}
