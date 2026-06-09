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

interface AuthUser { id: string; email: string | null; full_name: string | null; phone: string | null; balance: number; verified: boolean; }
interface Tx { id: number; type: string; amount: number; note: string | null; created_at: string; }

const TX_LABEL: Record<string, string> = {
  deposit: '➕ Dépôt', debit: '➖ Débit', refund: '↩️ Remboursement', adjustment: '⚙️ Ajustement',
};

export default function AdminWallets() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [reviewing, setReviewing] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<AuthUser | null>(null);
  const [tx, setTx] = useState<Tx[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;
  const { can } = useCan();
  const canEdit = can('wallets', 'edit');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const h = await authHeader();
      const [uRes, rRes] = await Promise.all([fetch('/api/admin/users', { headers: h }), fetch('/api/admin/deposit-requests', { headers: h })]);
      const uJson = await uRes.json();
      const rJson = await rRes.json();
      setUsers((uJson.users || []).sort((a: AuthUser, b: AuthUser) => b.balance - a.balance));
      setRequests(rJson.requests || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const review = async (id: number, action: 'approve' | 'reject') => {
    setReviewing(id);
    await fetch('/api/admin/deposit-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify({ id, action }),
    });
    setReviewing(null);
    fetchAll();
  };

  const pending = requests.filter(r => r.status === 'pending');

  const open = async (u: AuthUser) => {
    setSelected(u); setAmount(''); setNote(''); setError(''); setTx([]); setLoadingTx(true);
    try {
      const res = await fetch(`/api/admin/wallet?user_id=${u.id}`, { headers: await authHeader() });
      const json = await res.json();
      setTx(json.transactions || []);
      setSelected({ ...u, balance: Number(json.balance) || 0 });
    } catch { /* ignore */ }
    setLoadingTx(false);
  };

  const credit = async (sign: 1 | -1) => {
    if (!selected) return;
    const amt = parseFloat(amount) * sign;
    if (!amt || isNaN(amt)) { setError(t('admin.wallet_amount_err', 'Montant invalide.')); return; }
    setSaving(true); setError('');
    const res = await fetch('/api/admin/wallet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify({ user_id: selected.id, amount: amt, note, type: sign > 0 ? 'deposit' : 'adjustment' }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { setError(json.error || 'Erreur'); return; }
    setAmount(''); setNote('');
    open(selected);   // refresh balance + history
    fetchAll();
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return !q || (u.full_name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q) || (u.phone || '').includes(q);
  });

  const fmtAmt = (n: number) => `${n > 0 ? '+' : ''}${Number(n).toLocaleString()} Fdj`;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">💰 {t('admin.nav_wallets', 'Cagnottes')}</h1>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        {t('admin.wallets_hint', 'Créditez la cagnotte d\'un client après réception de son dépôt (Waafi / espèces).')}
      </p>

      {/* Demandes de recharge en attente */}
      {pending.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5">
          <p className="text-sm font-bold text-amber-800 mb-3">⏳ {t('admin.deposit_pending_title', 'Demandes de recharge en attente')} ({pending.length})</p>
          <div className="space-y-2">
            {pending.map(r => (
              <div key={r.id} className="flex items-center justify-between gap-3 bg-white rounded-xl px-3 py-2.5 border border-amber-100">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{r.name || r.email || '—'}</p>
                  <p className="text-xs text-gray-400">
                    {Number(r.amount).toLocaleString()} Fdj
                    {r.reference ? ` · réf. ${r.reference}` : ''} · {new Date(r.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex gap-2 flex-none">
                    <button onClick={() => review(r.id, 'reject')} disabled={reviewing === r.id} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-orange-200 text-[#f97316] hover:bg-orange-50 transition disabled:opacity-50">
                      {t('admin.deposit_reject', 'Refuser')}
                    </button>
                    <button onClick={() => review(r.id, 'approve')} disabled={reviewing === r.id} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#a8c800] text-white hover:bg-[#7d9800] transition disabled:opacity-50">
                      {reviewing === r.id ? '⏳' : `✅ ${t('admin.deposit_approve', 'Valider')}`}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4">
        <input
          type="text"
          placeholder={t('admin.wallets_search', '🔍 Rechercher par nom, email ou téléphone...')}
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
                <th className="text-left px-4 py-3 text-gray-500 font-medium">{t('admin.col_phone', 'Téléphone')}</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium">{t('admin.wallet_balance', 'Solde')}</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium">{t('admin.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-12 text-gray-400">{t('admin.no_customers', 'Aucun client trouvé')}</td></tr>
              ) : filtered.map(u => (
                <tr key={u.id} className="hover:bg-[#faf7e8] transition">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{u.full_name || t('admin.unknown', 'Inconnu')}</p>
                    <p className="text-xs text-gray-400">{u.email}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{u.phone || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-bold ${u.balance > 0 ? 'text-[#526500]' : 'text-gray-400'}`}>{Number(u.balance).toLocaleString()} Fdj</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => open(u)} className="text-[#7d9800] hover:text-[#526500] text-xs font-medium">
                      💰 {t('admin.wallet_manage', 'Gérer')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {selected && (
        <Modal title={`💰 ${t('admin.nav_wallets', 'Cagnotte')} — ${selected.full_name || selected.email}`} onClose={() => setSelected(null)}>
          <div className="space-y-4">
            <div className="bg-[#ecf4d5] border border-[#a8c800] rounded-xl p-4 text-center">
              <p className="text-xs text-gray-500">{t('admin.wallet_balance', 'Solde actuel')}</p>
              <p className="text-2xl font-bold text-[#526500]">{Number(selected.balance).toLocaleString()} Fdj</p>
            </div>

            {error && <div className="bg-orange-50 text-[#f97316] text-sm px-4 py-3 rounded-xl">{error}</div>}

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-600 mb-1 block">{t('admin.wallet_amount', 'Montant (Fdj)')}</label>
                <input type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="20000"
                  className="w-full border border-[#d2e095] rounded-xl px-4 py-2.5 text-sm bg-[#faf7e8] focus:outline-none focus:border-[#a8c800]" />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-600 mb-1 block">{t('admin.wallet_note', 'Note (optionnel)')}</label>
                <input value={note} onChange={e => setNote(e.target.value)} placeholder={t('admin.wallet_note_ph', 'Ex: Dépôt Waafi réf. 1234')}
                  className="w-full border border-[#d2e095] rounded-xl px-4 py-2.5 text-sm bg-[#faf7e8] focus:outline-none focus:border-[#a8c800]" />
              </div>
            </div>
            {canEdit && (
              <div className="flex gap-3">
                <button onClick={() => credit(-1)} disabled={saving} className="flex-1 py-2.5 border border-orange-200 text-[#f97316] rounded-xl text-sm font-semibold hover:bg-orange-50 transition disabled:opacity-50">
                  ➖ {t('admin.wallet_debit', 'Débiter')}
                </button>
                <button onClick={() => credit(1)} disabled={saving} className="flex-1 py-2.5 bg-[#a8c800] text-white rounded-xl text-sm font-semibold hover:bg-[#7d9800] transition disabled:opacity-50">
                  ➕ {saving ? t('admin.saving', 'Enregistrement...') : t('admin.wallet_credit', 'Créditer')}
                </button>
              </div>
            )}

            <p className="text-sm font-semibold text-gray-700 pt-2">{t('admin.wallet_history', 'Historique')}</p>
            {loadingTx ? (
              <p className="text-gray-400 text-sm text-center py-4">{t('admin.loading', 'Chargement...')}</p>
            ) : tx.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">{t('admin.wallet_no_tx', 'Aucun mouvement')}</p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {tx.map(m => (
                  <div key={m.id} className="flex items-center justify-between p-3 bg-[#faf7e8] rounded-xl">
                    <div>
                      <p className="text-sm text-gray-700">{TX_LABEL[m.type] || m.type}</p>
                      {m.note && <p className="text-xs text-gray-400">{m.note}</p>}
                      <p className="text-xs text-gray-400">{new Date(m.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</p>
                    </div>
                    <span className={`text-sm font-bold ${m.amount >= 0 ? 'text-[#526500]' : 'text-[#f97316]'}`}>{fmtAmt(m.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
