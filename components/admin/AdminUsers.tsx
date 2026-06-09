'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../context/LanguageContext';
import { MODULES, ROLES, type Role } from '../../lib/permissions';
import { useCan } from '../../context/AdminPermsContext';
import Modal from './Modal';

interface AuthUser {
  id: string; email: string | null; verified: boolean; full_name: string | null;
  phone: string | null; civility: string | null; is_ambassador: boolean;
  role: Role; permissions: Record<string, string[]>; banned: boolean; created_at: string; balance: number;
}
interface Order { id: string; total: number; status: string; payment_method: string; created_at: string; }
interface Stat { count: number; total: number; last: string; }

const ROLE_META: Record<Role, { emoji: string; cls: string; key: string; fr: string }> = {
  client:   { emoji: '🛒',  cls: 'bg-gray-100 text-gray-600',   key: 'admin.role_client',   fr: 'Client' },
  producer: { emoji: '👨‍🌾', cls: 'bg-amber-100 text-amber-700', key: 'admin.role_producer', fr: 'Producteur' },
  manager:  { emoji: '🛠️',  cls: 'bg-blue-100 text-blue-700',   key: 'admin.role_manager',  fr: 'Gestionnaire' },
  admin:    { emoji: '⚙️',  cls: 'bg-[#526500] text-white',     key: 'admin.role_admin',    fr: 'Administrateur' },
};
const ambassadorLabel = (civility?: string | null) => civility === 'madame' ? 'Ambassadrice' : 'Ambassadeur';

export default function AdminUsers() {
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;
  const { can } = useCan();
  const canEdit = can('users', 'edit');

  const [users, setUsers] = useState<AuthUser[]>([]);
  const [stats, setStats] = useState<Record<string, Stat>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | Role>('all');
  const [selected, setSelected] = useState<AuthUser | null>(null);
  const [userOrders, setUserOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draftPerms, setDraftPerms] = useState<Record<string, string[]>>({});
  const [permsSaved, setPermsSaved] = useState(false);

  const roleLabel = (r: Role) => t(ROLE_META[r].key, ROLE_META[r].fr);
  const moduleLabel = (key: string) => t(`admin.nav_${key}`, key);
  const actionLabel = (a: string) => ({
    view: t('admin.perm_view', 'Voir'), create: t('admin.perm_create', 'Créer'),
    edit: t('admin.perm_edit', 'Modifier'), delete: t('admin.perm_delete', 'Supprimer'),
  } as Record<string, string>)[a] || a;

  const statusInfo = useCallback((s: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      pending:    { label: t('admin.status_pending',    '⏳ En attente'), cls: 'bg-yellow-100 text-yellow-700' },
      processing: { label: t('admin.status_processing', '🚚 En cours'),   cls: 'bg-blue-100 text-blue-700' },
      shipping:   { label: t('admin.status_shipping',   '📦 Expédié'),    cls: 'bg-purple-100 text-purple-700' },
      delivered:  { label: t('admin.status_delivered',  '✅ Livré'),       cls: 'bg-green-100 text-green-700' },
      cancelled:  { label: t('admin.status_cancelled',  '❌ Annulé'),      cls: 'bg-orange-100 text-[#f97316]' },
    };
    return map[s] || { label: s, cls: 'bg-gray-100 text-gray-600' };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui]);

  const token = async () => (await supabase.auth.getSession()).data.session?.access_token;

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const tk = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch('/api/admin/users', { headers: { Authorization: `Bearer ${tk}` } });
      const json = await res.json();
      setUsers((json.users || []) as AuthUser[]);
    } catch { /* ignore */ }

    const { data } = await supabase.from('orders').select('user_id, total, created_at');
    const s: Record<string, Stat> = {};
    (data || []).forEach((r: any) => {
      if (!r.user_id) return;
      const e = (s[r.user_id] ||= { count: 0, total: 0, last: r.created_at });
      e.count += 1; e.total += Number(r.total) || 0;
      if (r.created_at > e.last) e.last = r.created_at;
    });
    setStats(s);
    setLoading(false);
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const post = async (payload: any) => {
    setBusy(true);
    const tk = await token();
    const res = await fetch('/api/admin/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    return res.ok;
  };

  const patchUser = (id: string, patch: Partial<AuthUser>) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...patch } : u));
    setSelected(s => s && s.id === id ? { ...s, ...patch } : s);
  };

  const openUser = async (u: AuthUser) => {
    setSelected(u); setDraftPerms(u.permissions || {}); setPermsSaved(false);
    setLoadingOrders(true);
    const { data } = await supabase.from('orders')
      .select('id, total, status, payment_method, created_at').eq('user_id', u.id)
      .order('created_at', { ascending: false });
    setUserOrders(data || []);
    setLoadingOrders(false);
  };

  const changeRole = async (u: AuthUser, role: Role) => {
    if (await post({ user_id: u.id, role })) patchUser(u.id, { role });
  };
  const toggleBlock = async (u: AuthUser) => {
    const next = !u.banned;
    if (await post({ user_id: u.id, action: next ? 'block' : 'unblock' })) patchUser(u.id, { banned: next });
  };
  const setCivilityFor = async (u: AuthUser, civility: 'madame' | 'monsieur') => {
    if (await post({ user_id: u.id, civility })) patchUser(u.id, { civility });
  };
  const toggleAmbassador = async (u: AuthUser) => {
    const next = !u.is_ambassador;
    if (await post({ user_id: u.id, is_ambassador: next })) patchUser(u.id, { is_ambassador: next });
  };
  const togglePerm = (module: string, action: string) => {
    setPermsSaved(false);
    setDraftPerms(prev => {
      const set = new Set(prev[module] || []);
      if (action === 'view') {
        if (set.has('view')) return { ...prev, [module]: [] };        // retirer view = tout retirer
        set.add('view');
      } else {
        if (set.has(action)) set.delete(action);
        else { set.add(action); set.add('view'); }                    // une action implique l'accès
      }
      return { ...prev, [module]: [...set] };
    });
  };
  const savePerms = async (u: AuthUser) => {
    if (await post({ user_id: u.id, permissions: draftPerms })) {
      patchUser(u.id, { permissions: draftPerms }); setPermsSaved(true);
    }
  };

  const filtered = users
    .filter(u => roleFilter === 'all' || u.role === roleFilter)
    .filter(u => {
      const q = search.toLowerCase();
      return !q || (u.full_name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q) || (u.phone || '').includes(q);
    })
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

  const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString('fr-FR') : '—';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">👥 {t('admin.nav_users', 'Utilisateurs')}</h1>
        <p className="text-sm text-gray-400">{users.length} {t('admin.accounts_label', 'comptes')}</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          type="text"
          placeholder={t('admin.users_search', '🔍 Rechercher par nom, email ou téléphone...')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 border border-[#d2e095] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#a8c800] bg-[#faf7e8]"
        />
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value as any)} className="border border-[#d2e095] rounded-xl px-3 py-2.5 text-sm bg-[#faf7e8] focus:outline-none focus:border-[#a8c800]">
          <option value="all">{t('admin.role_all', 'Tous les rôles')}</option>
          {ROLES.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
        </select>
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
                <th className="text-left px-4 py-3 text-gray-500 font-medium">{t('admin.col_role', 'Rôle')}</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">{t('admin.col_registered', 'Inscrit le')}</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">{t('admin.col_orders', 'Commandes')}</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">{t('admin.col_status', 'Statut')}</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium">{t('admin.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400">{t('admin.no_customers', 'Aucun compte trouvé')}</td></tr>
              ) : filtered.map(u => {
                const st = stats[u.id];
                return (
                  <tr key={u.id} className={`hover:bg-[#faf7e8] transition ${u.banned ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#ecf4d5] flex items-center justify-center text-lg">👤</div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-800 truncate">{u.full_name || t('admin.unknown', 'Inconnu')}</p>
                          <p className="text-xs text-gray-400 truncate max-w-[200px]">{u.email || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${ROLE_META[u.role].cls}`}>{ROLE_META[u.role].emoji} {roleLabel(u.role)}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{fmtDate(u.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className="bg-[#ecf4d5] text-[#526500] px-2 py-1 rounded-full text-xs font-semibold">{st?.count ?? 0}</span>
                    </td>
                    <td className="px-4 py-3">
                      {u.banned ? (
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-700 whitespace-nowrap">🚫 {t('admin.user_blocked', 'Bloqué')}</span>
                      ) : u.verified ? (
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700 whitespace-nowrap">✅ {t('admin.user_verified', 'Vérifié')}</span>
                      ) : (
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-orange-100 text-[#f97316] whitespace-nowrap">⚠️ {t('admin.user_unverified', 'Non vérifié')}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openUser(u)} className="text-[#7d9800] hover:text-[#526500] text-xs font-medium whitespace-nowrap">👤 {t('admin.client_card', 'Fiche client')}</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {selected && (
        <Modal title={`👤 ${t('admin.client_card', 'Fiche client')} — ${selected.full_name || selected.email}`} onClose={() => setSelected(null)}>
          <div className="space-y-4">
            {/* Infos */}
            <div className="bg-[#faf7e8] rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-gray-400">{t('admin.col_phone', 'Téléphone')}</p><p className="font-medium text-gray-800">{selected.phone || '—'}</p></div>
              <div><p className="text-xs text-gray-400">{t('admin.col_registered', 'Inscrit le')}</p><p className="font-medium text-gray-800">{fmtDate(selected.created_at)}</p></div>
              <div><p className="text-xs text-gray-400">{t('admin.col_spent', 'Total dépensé')}</p><p className="font-bold text-[#526500]">{(stats[selected.id]?.total ?? 0).toLocaleString()} Fdj</p></div>
              <div><p className="text-xs text-gray-400">{t('admin.wallet_balance', 'Cagnotte')}</p><p className="font-bold text-[#526500]">{Number(selected.balance).toLocaleString()} Fdj</p></div>
              <div className="col-span-2"><p className="text-xs text-gray-400">Email</p><p className="font-medium text-gray-800 break-all">{selected.email || '—'}</p></div>
            </div>

            {canEdit && (<>
            {/* Rôle */}
            <div className="bg-white border border-[#d2e095] rounded-xl px-4 py-3">
              <p className="text-sm font-medium text-gray-700 mb-2">{t('admin.col_role', 'Rôle')}</p>
              <div className="flex flex-wrap gap-2">
                {ROLES.map(r => (
                  <button key={r} onClick={() => changeRole(selected, r)} disabled={busy}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition disabled:opacity-60 ${selected.role === r ? 'border-[#a8c800] bg-[#ecf4d5] text-[#526500]' : 'border-[#d2e095] bg-white text-gray-500 hover:bg-[#ecf4d5]'}`}>
                    {ROLE_META[r].emoji} {roleLabel(r)}
                  </button>
                ))}
              </div>
            </div>

            {/* Droits du gestionnaire */}
            {selected.role === 'manager' && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                <p className="text-sm font-semibold text-blue-800 mb-1">🛠️ {t('admin.perms_title', 'Droits du gestionnaire')}</p>
                <p className="text-xs text-blue-600 mb-3">{t('admin.perms_hint', 'Cochez les actions autorisées par module.')}</p>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {MODULES.map(m => (
                    <div key={m.key} className="bg-white rounded-lg border border-blue-100 px-3 py-2">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="text-xs font-semibold text-gray-700 w-32 truncate">{moduleLabel(m.key)}</span>
                        {m.actions.map(a => {
                          const on = (draftPerms[m.key] || []).includes(a);
                          return (
                            <label key={a} className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                              <input type="checkbox" checked={on} onChange={() => togglePerm(m.key, a)} className="w-3.5 h-3.5 accent-[#2563eb]" />
                              {actionLabel(a)}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={() => savePerms(selected)} disabled={busy} className="mt-3 w-full py-2 rounded-xl bg-[#2563eb] text-white text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50">
                  {permsSaved ? `✅ ${t('admin.perms_saved', 'Droits enregistrés')}` : t('admin.perms_save', 'Enregistrer les droits')}
                </button>
              </div>
            )}

            {/* Civilité + Ambassadeur */}
            <div className="flex items-center justify-between gap-3 bg-[#faf7e8] border border-[#d2e095] rounded-xl px-4 py-3">
              <p className="text-sm font-medium text-gray-700">{t('login.civility', 'Civilité')}</p>
              <div className="flex gap-2">
                {([{ v: 'madame', l: t('login.civility_mme', 'Madame') }, { v: 'monsieur', l: t('login.civility_m', 'Monsieur') }] as { v: 'madame' | 'monsieur'; l: string }[]).map(o => (
                  <button key={o.v} onClick={() => setCivilityFor(selected, o.v)} disabled={busy}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition disabled:opacity-60 ${selected.civility === o.v ? 'border-[#a8c800] bg-[#ecf4d5] text-[#526500]' : 'border-[#d2e095] bg-white text-gray-500 hover:bg-[#ecf4d5]'}`}>
                    {o.l}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 bg-[#ecf4d5] border border-[#a8c800] rounded-xl px-4 py-3">
              <p className="text-sm font-semibold text-[#526500]">⭐ {t('admin.ambassador_label', 'Statut ambassadeur')} {selected.is_ambassador ? `(${ambassadorLabel(selected.civility)})` : ''}</p>
              <button onClick={() => toggleAmbassador(selected)} disabled={busy} role="switch" aria-checked={selected.is_ambassador}
                className={`relative w-12 h-7 rounded-full transition-colors flex-none ${selected.is_ambassador ? 'bg-[#a8c800]' : 'bg-gray-200'} disabled:opacity-60`}>
                <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${selected.is_ambassador ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {/* Blocage */}
            <button onClick={() => toggleBlock(selected)} disabled={busy}
              className={`w-full py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-50 ${selected.banned ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'}`}>
              {selected.banned ? `✅ ${t('admin.unblock_user', 'Débloquer le compte')}` : `🚫 ${t('admin.block_user', 'Bloquer le compte')}`}
            </button>
            </>)}

            {/* Historique */}
            <p className="text-sm font-semibold text-gray-700 pt-1">{t('admin.order_history', 'Historique des commandes')}</p>
            {loadingOrders ? (
              <p className="text-gray-400 text-sm text-center py-4">{t('admin.loading', 'Chargement...')}</p>
            ) : userOrders.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">{t('admin.no_orders_user', 'Aucune commande')}</p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {userOrders.map(order => {
                  const info = statusInfo(order.status);
                  return (
                    <div key={order.id} className="flex items-center justify-between p-3 bg-[#faf7e8] rounded-xl">
                      <div>
                        <p className="text-xs text-gray-400 font-mono">#{String(order.id).slice(-8)}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{order.payment_method} · {new Date(order.created_at).toLocaleDateString('fr-FR')}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-[#526500]">{Number(order.total).toLocaleString()} Fdj</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${info.cls}`}>{info.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
