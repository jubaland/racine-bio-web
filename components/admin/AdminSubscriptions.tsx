'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { supabase } from '../../lib/supabase';
import { useCan } from '../../context/AdminPermsContext';
import Modal from './Modal';

const authHeader = async (): Promise<Record<string, string>> => {
  const tk = (await supabase.auth.getSession()).data.session?.access_token;
  return tk ? { Authorization: `Bearer ${tk}` } : {};
};

interface SubItem { product_id: number; quantity: number; name: string; price: number; unit: string; }
interface Sub {
  user_id: string; frequency: string; delivery_day: number;
  active: boolean; paused: boolean; last_delivery: string | null; valid_until: string | null;
  delivery_fee: number;
  name: string | null; email: string | null; balance: number; items: SubItem[]; total: number;
}

export default function AdminSubscriptions() {
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;
  const { can } = useCan();
  const canEdit = can('subscriptions', 'edit');

  const [subs, setSubs] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Sub | null>(null);
  const [confirmDel, setConfirmDel] = useState<Sub | null>(null);
  const [feeInput, setFeeInput] = useState('');
  const [feeSaved, setFeeSaved] = useState(false);

  const DAYS = [
    t('sub.day_0', 'Dimanche'), t('sub.day_1', 'Lundi'), t('sub.day_2', 'Mardi'),
    t('sub.day_3', 'Mercredi'), t('sub.day_4', 'Jeudi'), t('sub.day_5', 'Vendredi'), t('sub.day_6', 'Samedi'),
  ];
  const FREQ_LABEL: Record<string, string> = {
    weekly:      t('sub.freq_weekly', 'Hebdomadaire'),
    fortnightly: t('sub.freq_fortnightly', 'Quinzaine'),
    monthly:     t('sub.freq_monthly', 'Mensuelle'),
  };
  const PERIOD_WORD: Record<string, string> = {
    weekly:      t('sub.per_week', 'par semaine'),
    fortnightly: t('sub.per_fortnight', 'par quinzaine'),
    monthly:     t('sub.per_month', 'par mois'),
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/subscriptions', { headers: await authHeader() });
      const json = await res.json();
      setSubs(json.subscriptions || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const act = async (s: Sub, action: 'pause' | 'resume' | 'delete') => {
    setBusy(`${s.user_id}|${s.frequency}`);
    await fetch('/api/admin/subscriptions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify({ user_id: s.user_id, frequency: s.frequency, action }),
    });
    setBusy(null); setConfirmDel(null);
    fetchAll();
  };

  const saveFee = async (s: Sub) => {
    setBusy(`${s.user_id}|${s.frequency}`);
    await fetch('/api/admin/subscriptions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify({ user_id: s.user_id, frequency: s.frequency, action: 'set_fee', fee: Number(feeInput) || 0 }),
    });
    setBusy(null);
    setFeeSaved(true);
    await fetchAll();
    setViewing(v => v ? { ...v, delivery_fee: Number(feeInput) || 0 } : v);
  };

  const today = new Date().toISOString().slice(0, 10);
  const isExpired = (s: Sub) => !!s.valid_until && s.valid_until < today;

  const statusBadge = (s: Sub) => {
    if (isExpired(s)) return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">⏳ {t('admin.sub_expired', 'Expiré')}</span>;
    if (!s.active) return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">○ {t('admin.sub_inactive', 'Inactif')}</span>;
    if (s.paused) return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">⏸️ {t('admin.sub_paused', 'En pause')}</span>;
    return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">🟢 {t('admin.sub_active', 'Actif')}</span>;
  };

  const fmtDate = (s: string | null) => s ? new Date(s + 'T00:00:00').toLocaleDateString('fr-FR') : '—';

  const filtered = subs.filter(s => {
    const q = search.toLowerCase();
    return !q || (s.name || '').toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q);
  });

  // Tri : actifs d'abord, puis par nom
  filtered.sort((a, b) => {
    const sa = (a.active && !a.paused && !isExpired(a)) ? 0 : 1;
    const sb = (b.active && !b.paused && !isExpired(b)) ? 0 : 1;
    if (sa !== sb) return sa - sb;
    return (a.name || a.email || '').localeCompare(b.name || b.email || '');
  });

  const activeCount = subs.filter(s => s.active && !s.paused && !isExpired(s)).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">🔄 {t('admin.nav_subscriptions', 'Abonnements')}</h1>
        <span className="text-sm text-gray-400">{activeCount} {t('admin.sub_active_count', 'actif(s)')}</span>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        {t('admin.subs_hint', 'Commandes modèles des clients (livraison automatique débitée de la cagnotte). Vous pouvez mettre en pause, réactiver ou supprimer un abonnement.')}
      </p>

      <div className="mb-4">
        <input
          type="text"
          placeholder={t('admin.subs_search', '🔍 Rechercher par nom ou email...')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full border border-[#d2e095] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#a8c800] bg-[#faf7e8]"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><p className="text-gray-400">{t('admin.loading', 'Chargement...')}</p></div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#d2e095] overflow-hidden">
          <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[#faf7e8] border-b border-[#d2e095]">
              <tr>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">{t('admin.col_customer', 'Client')}</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">{t('admin.sub_frequency', 'Fréquence')}</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">{t('sub.delivery_day', 'Jour de livraison')}</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium">{t('sub.total', 'Total')}</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium">{t('admin.wallet_balance', 'Solde')}</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">{t('admin.sub_status', 'Statut')}</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">{t('admin.sub_valid_until', 'Validité')}</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium">{t('admin.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">{t('admin.no_subs', 'Aucun abonnement')}</td></tr>
              ) : filtered.map(s => {
                const key = `${s.user_id}|${s.frequency}`;
                const fee = Number(s.delivery_fee) || 0;
                const grand = s.total + fee;
                const insufficient = s.active && !s.paused && grand > s.balance;
                return (
                  <tr key={key} className="hover:bg-[#faf7e8] transition">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{s.name || t('admin.unknown', 'Inconnu')}</p>
                      <p className="text-xs text-gray-400">{s.email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{FREQ_LABEL[s.frequency] || s.frequency}</td>
                    <td className="px-4 py-3 text-gray-600">{DAYS[s.delivery_day] ?? '—'}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <span className="font-semibold text-[#526500]">{grand.toLocaleString()} Fdj</span>
                      <span className="block text-[11px] text-gray-400">{PERIOD_WORD[s.frequency]}</span>
                      {fee > 0 && <span className="block text-[11px] text-gray-400">🚚 {fee.toLocaleString()} Fdj {t('admin.sub_fee_incl', 'frais')}</span>}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <span className={insufficient ? 'text-[#f97316] font-semibold' : 'text-gray-600'}>{Number(s.balance).toLocaleString()} Fdj</span>
                      {insufficient && <span className="block text-[11px] text-[#f97316]">⚠️ {t('admin.sub_insufficient', 'insuffisant')}</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={isExpired(s) ? 'text-[#f97316] font-semibold' : 'text-gray-600'}>{fmtDate(s.valid_until)}</span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {canEdit && (
                        <label className="inline-flex items-center gap-1.5 cursor-pointer align-middle" title={t('admin.sub_suspend_hint', 'Suspendre / réactiver la livraison automatique')}>
                          <input type="checkbox" checked={s.paused} disabled={busy === key} onChange={e => act(s, e.target.checked ? 'pause' : 'resume')} className="w-4 h-4 accent-[#a8c800]" />
                          <span className="text-xs text-gray-600">{busy === key ? '⏳' : t('admin.sub_suspend', 'Suspendre')}</span>
                        </label>
                      )}
                      <button onClick={() => { setViewing(s); setFeeInput(String(Number(s.delivery_fee) || 0)); setFeeSaved(false); }} className="ml-3 text-[#7d9800] hover:text-[#526500] text-xs font-medium">{t('admin.sub_view', 'Panier')}</button>
                      {canEdit && <button onClick={() => setConfirmDel(s)} className="ml-3 text-orange-400 hover:text-[#f97316] text-xs font-medium">{t('admin.delete', 'Supprimer')}</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Détail panier */}
      {viewing && (
        <Modal title={`🛒 ${viewing.name || viewing.email} — ${FREQ_LABEL[viewing.frequency] || viewing.frequency}`} onClose={() => setViewing(null)}>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-2 py-1 rounded-full bg-[#ecf4d5] text-[#526500]">{t('sub.delivery_day', 'Jour')} : {DAYS[viewing.delivery_day]}</span>
              <span className="px-2 py-1 rounded-full bg-[#ecf4d5] text-[#526500]">{t('admin.sub_valid_until', 'Validité')} : {fmtDate(viewing.valid_until)}</span>
              <span className="px-2 py-1 rounded-full bg-[#ecf4d5] text-[#526500]">{t('admin.sub_last_delivery', 'Dernière livraison')} : {fmtDate(viewing.last_delivery)}</span>
            </div>
            {viewing.items.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">{t('admin.sub_empty_basket', 'Panier vide')}</p>
            ) : (
              <div className="divide-y divide-[#f0f7e0] border border-[#d2e095] rounded-xl overflow-hidden">
                {viewing.items.map(it => (
                  <div key={it.product_id} className="flex items-center justify-between px-3 py-2.5 bg-white">
                    <span className="text-sm text-gray-700">{it.name} <span className="text-gray-400">× {it.quantity}</span></span>
                    <span className="text-sm font-semibold text-[#526500]">{(it.price * it.quantity).toLocaleString()} Fdj</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between pt-1">
              <span className="text-sm text-gray-600">{t('admin.sub_items_total', 'Sous-total articles')}</span>
              <span className="text-sm font-semibold text-gray-700">{Number(viewing.total).toLocaleString()} Fdj</span>
            </div>

            {/* Frais de transport personnalisés */}
            {canEdit && (
            <div className="border-t border-[#d2e095] pt-3">
              <label className="text-sm font-medium text-gray-600 mb-1.5 block">🚚 {t('admin.sub_fee_label', 'Frais de transport')} ({PERIOD_WORD[viewing.frequency]})</label>
              <div className="flex gap-2">
                <input
                  type="number" min="0" value={feeInput}
                  onChange={e => { setFeeInput(e.target.value); setFeeSaved(false); }}
                  placeholder="0"
                  className="flex-1 border border-[#d2e095] rounded-xl px-4 py-2.5 text-sm bg-[#faf7e8] focus:outline-none focus:border-[#a8c800]"
                />
                <span className="flex items-center text-sm text-gray-500">Fdj</span>
                <button
                  onClick={() => saveFee(viewing)}
                  disabled={busy !== null}
                  className="px-4 py-2.5 bg-[#a8c800] text-white text-sm font-semibold rounded-xl hover:bg-[#7d9800] transition disabled:opacity-50 whitespace-nowrap"
                >
                  {feeSaved ? '✅' : t('admin.save', 'Enregistrer')}
                </button>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">{t('admin.sub_fee_hint', 'Ajouté à chaque livraison et débité de la cagnotte.')}</p>
            </div>
            )}

            <div className="flex items-center justify-between border-t border-[#d2e095] pt-3">
              <span className="text-sm font-semibold text-gray-700">{t('sub.total', 'Total')} {PERIOD_WORD[viewing.frequency]}</span>
              <span className="text-lg font-bold text-[#526500]">{(Number(viewing.total) + (Number(feeInput) || 0)).toLocaleString()} Fdj</span>
            </div>
          </div>
        </Modal>
      )}

      {/* Confirmation suppression */}
      {confirmDel && (
        <Modal title={`🗑️ ${t('admin.sub_delete_title', 'Supprimer l\'abonnement')}`} onClose={() => setConfirmDel(null)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {t('admin.sub_delete_confirm', 'Confirmer la suppression de la commande modèle')} <strong>{FREQ_LABEL[confirmDel.frequency]}</strong> {t('admin.sub_delete_of', 'de')} <strong>{confirmDel.name || confirmDel.email}</strong> ?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDel(null)} className="flex-1 py-2.5 border border-[#d2e095] text-gray-600 rounded-xl text-sm font-semibold hover:bg-[#faf7e8] transition">{t('admin.cancel', 'Annuler')}</button>
              <button onClick={() => act(confirmDel, 'delete')} disabled={busy !== null} className="flex-1 py-2.5 bg-[#f97316] text-white rounded-xl text-sm font-semibold hover:bg-orange-600 transition disabled:opacity-50">{t('admin.delete', 'Supprimer')}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
