'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { supabase } from '../../lib/supabase';
import { useCan } from '../../context/AdminPermsContext';
import PrepSlip from './PrepSlip';

interface OrderEdit {
  id: number; order_id?: string; product_name: string | null; product_unit: string | null;
  from_qty: number; to_qty: number; amount: number; reason: string | null;
  by_name: string | null; by_role: string | null; order_status: string | null; created_at: string;
  orders?: { customer_name: string | null } | null;
}

interface OrderItem {
  id: string;
  product_id: number;
  quantity: number;
  price: number;
  discount?: number | null;   // remise admin sur la ligne (prix réel conservé)
  // Snapshot produit au moment de la commande
  product_name?:      string | null;
  product_image_url?: string | null;
  product_unit?:      string | null;
  bundle_contents?:   { product_id: number; name: string; unit: string | null; quantity: number }[] | null; // panier composé
  product_farm?:      string | null;
}

interface Order {
  id: string;
  user_id: string | null;
  total: number;
  delivery_fee: number | null;
  delivery_discount?: number | null;          // montant de livraison offert (code promo, seuil, parrainage)
  delivery_discount_source?: string | null;
  promo_code?: string | null;
  promo_discount?: number | null;             // remise d'un code promo sur les articles
  admin_discount?: number | null;             // remise globale accordée par l'admin
  discount_history?: { at: string; by_name?: string | null; kind: string; name?: string; from?: number; to?: number; amount?: number; note?: string | null }[] | null;
  order_edits?: OrderEdit[] | null;   // journal des modifications de quantités (traçabilité)
  delivery_option_name: string | null;
  status: string;
  payment_method: string;
  phone: string;
  email: string | null;
  address: string;
  customer_name: string;
  special_instructions: string | null;
  created_at: string;
  order_items: OrderItem[];
}

const STATUSES = ['pending', 'processing', 'shipping', 'delivered', 'cancelled'] as const;

const PAYMENT_LABELS: Record<string, string> = {
  waafi:  '📱 Waafi',
  dmoney: '💳 D-Money',
  cash:   '💵 Espèces',
  wallet: '💰 Cagnotte',
};

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);
  const [changeReqs, setChangeReqs] = useState<any[]>([]);
  const [cancelReqs, setCancelReqs] = useState<any[]>([]);
  const [cancelBusyId, setCancelBusyId] = useState<number | null>(null);
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [slipOrder, setSlipOrder] = useState<Order | null>(null);

  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;
  const { can, isAdmin } = useCan();

  const STATUS_META = {
    pending:    { label: t('admin.status_pending',    '⏳ En attente'), cls: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    processing: { label: t('admin.status_processing', '🚚 En cours'),   cls: 'bg-blue-100 text-blue-800 border-blue-200' },
    shipping:   { label: t('admin.status_shipping',   '📦 Expédié'),    cls: 'bg-purple-100 text-purple-800 border-purple-200' },
    delivered:  { label: t('admin.status_delivered',  '✅ Livré'),       cls: 'bg-green-100 text-green-800 border-green-200' },
    cancelled:  { label: t('admin.status_cancelled',  '❌ Annulé'),      cls: 'bg-orange-100 text-[#f97316] border-orange-200' },
  };
  const meta = (s: string) =>
    STATUS_META[s as keyof typeof STATUS_META] ?? { label: s, cls: 'bg-gray-100 text-gray-600 border-gray-200' };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const tk = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch('/api/orders', { headers: { Authorization: `Bearer ${tk}` } });
      const json = await res.json();
      if (!res.ok) { setFetchError(json.error); return; }
      let orders: Order[] = json.orders || [];
      if (filterStatus) orders = orders.filter(o => o.status === filterStatus);
      setOrders(orders);
      // Demandes de modification en attente
      try {
        const rr = await fetch('/api/orders/change-request', { headers: { Authorization: `Bearer ${tk}` } });
        const rj = await rr.json();
        if (rr.ok) setChangeReqs(rj.requests || []);
      } catch { /* ignore */ }
      // Demandes d'annulation en attente
      try {
        const cr = await fetch('/api/orders/cancel-request', { headers: { Authorization: `Bearer ${tk}` } });
        const cj = await cr.json();
        if (cr.ok) setCancelReqs(cj.requests || []);
      } catch { /* ignore */ }
    } catch (e: any) {
      setFetchError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Remise accordée par l'admin (marchandage, geste commercial) : nouveau prix sur une ligne, ou montant global
  const [discountFor, setDiscountFor] = useState<string | null>(null);
  const [dForm, setDForm] = useState({ mode: 'line', item_id: '', new_price: '', amount: '', note: '' });
  const [dBusy, setDBusy] = useState(false);
  const [dMsg, setDMsg] = useState('');
  const DISCOUNT_ERR: Record<string, string> = {
    note_required: t('admin.disc_e_note', 'Indiquez le motif de la remise.'),
    price_invalid: t('admin.disc_e_price', 'Le nouveau prix doit être un entier positif, inférieur au prix actuel.'),
    amount_invalid: t('admin.disc_e_amount', 'Montant invalide.'),
    amount_too_high: t('admin.disc_e_too_high', 'La remise dépasse le montant des articles.'),
    prepaid_increase: t('admin.disc_e_prepaid', 'Commande prépayée : une remise ne peut pas être réduite (il faudrait re-débiter le client).'),
    order_cancelled: t('admin.disc_e_cancelled', 'Commande annulée.'),
  };
  const grantDiscount = async (order: Order, mode: 'line' | 'global' | 'reset') => {
    if (mode === 'reset' && !confirm(t('admin.disc_reset_confirm', 'Annuler toutes les remises accordées sur cette commande ?'))) return;
    setDBusy(true); setDMsg('');
    try {
      const tk = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch('/api/admin/orders/discount', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` },
        body: JSON.stringify({ order_id: order.id, mode, item_id: dForm.item_id || undefined, new_price: dForm.new_price || undefined, amount: dForm.amount || undefined, note: dForm.note }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setDMsg('⚠️ ' + (DISCOUNT_ERR[j.error] || j.error || 'Erreur')); return; }
      setDMsg(`✅ ${t('admin.disc_done', 'Nouveau total')} : ${Number(j.total).toLocaleString()} Fdj${j.refund === 'wallet' ? ` · ${t('admin.disc_refunded', 'différence recréditée sur la cagnotte')}` : j.refund === 'manual' ? ` · ${t('admin.disc_manual', 'remboursement manuel à effectuer')}` : ''}`);
      setDForm({ mode: 'line', item_id: '', new_price: '', amount: '', note: '' });
      fetchAll();
    } catch (e: any) { setDMsg('⚠️ ' + e.message); } finally { setDBusy(false); }
  };

  const updateStatus = async (orderId: string, status: string) => {
    // Annulation = stock remis + remboursement enregistré + client prévenu : on confirme avant
    if (status === 'cancelled' && !confirm(t('admin.confirm_cancel_order', 'Annuler cette commande ? Le stock sera remis à disposition, le remboursement enregistré et le client prévenu.'))) return;
    setUpdatingId(orderId);
    const tk = (await supabase.auth.getSession()).data.session?.access_token;
    const res = await fetch('/api/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` },
      body: JSON.stringify({ id: orderId, status }),
    });
    const j = await res.json().catch(() => ({}));
    if (j.pending_validation) {
      // Gestionnaire : l'annulation n'est pas appliquée, une demande part en validation admin
      alert('🛑 ' + t('admin.cancel_requested', 'Demande d\'annulation envoyée à l\'administrateur pour validation.'));
      fetchAll();
    } else {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
    }
    setUpdatingId(null);
  };

  const resolveCancel = async (req: any, action: 'approve' | 'reject') => {
    if (!confirm(action === 'approve'
      ? t('admin.cancel_approve_confirm', 'Valider l\'annulation ? La commande sera annulée et remboursée.')
      : t('admin.cancel_reject_confirm', 'Refuser cette demande d\'annulation ?'))) return;
    setCancelBusyId(req.id);
    try {
      const tk = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch('/api/orders/cancel-request/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` },
        body: JSON.stringify({ request_id: req.id, action }),
      });
      const j = await res.json();
      if (!res.ok) {
        const map: Record<string, string> = {
          admin_only: t('admin.cancel_admin_only', 'Seul un administrateur peut valider une annulation.'),
          already_resolved: t('admin.req_already', 'Demande déjà traitée.'),
        };
        alert('⚠️ ' + (map[j.error] || j.error || 'Erreur'));
        return;
      }
      setCancelReqs(prev => prev.filter(r => r.id !== req.id));
      if (action === 'approve') fetchAll();
    } catch (e: any) {
      alert('⚠️ ' + e.message);
    } finally {
      setCancelBusyId(null);
    }
  };

  const resolveReq = async (req: any, action: 'approve' | 'reject') => {
    if (action === 'approve' && !confirm(t('admin.req_approve_confirm', 'Approuver cette demande ? La modification et le remboursement seront appliqués.'))) return;
    if (action === 'reject' && !confirm(t('admin.req_reject_confirm', 'Refuser cette demande ?'))) return;
    setResolvingId(req.id);
    try {
      const tk = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch('/api/orders/change-request/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` },
        body: JSON.stringify({ request_id: req.id, action }),
      });
      const j = await res.json();
      if (!res.ok) {
        const map: Record<string, string> = {
          order_locked: t('admin.remove_err_locked', 'Commande déjà expédiée/livrée : modification impossible.'),
          last_item: t('admin.remove_err_last', 'Dernier article : annulez plutôt la commande entière.'),
          already_resolved: t('admin.req_already', 'Demande déjà traitée.'),
        };
        alert('⚠️ ' + (map[j.error] || j.error || 'Erreur'));
        return;
      }
      setChangeReqs(prev => prev.filter(r => r.id !== req.id));
      if (action === 'approve') fetchAll(); // refléter total/articles à jour
    } catch (e: any) {
      alert('⚠️ ' + e.message);
    } finally {
      setResolvingId(null);
    }
  };

  // newQty === 0 → retrait complet ; sinon réduction à newQty
  // Quantité en cours d'ajustement (par article) : les clics +/− ne déclenchent rien,
  // tout part en une fois au « Appliquer » — une seule validation, un seul motif.
  const [qtyDraft, setQtyDraft] = useState<{ itemId: string; qty: string } | null>(null);
  const draftFor = (item: OrderItem) => qtyDraft?.itemId === item.id ? qtyDraft.qty : String(item.quantity);
  const bumpDraft = (item: OrderItem, delta: number) => {
    const cur = parseInt(draftFor(item), 10);
    const next = Math.max(0, (isNaN(cur) ? item.quantity : cur) + delta);
    setQtyDraft({ itemId: item.id, qty: String(next) });
  };

  const modifyItem = async (order: Order, item: OrderItem, newQty: number) => {
    const increase = newQty > item.quantity;
    const delta = Math.abs(item.quantity - newQty);
    const amt = `${(Number(item.price) * delta).toLocaleString()} Fdj`;
    const name = item.product_name || t('admin.this_item', 'cet article');
    const refundMsg = increase
      ? (order.payment_method === 'wallet' || order.payment_method === 'company_wallet' ? t('admin.add_charge_wallet', 'Le complément sera débité de la cagnotte.')
        : order.payment_method === 'credit' ? t('admin.add_charge_credit', 'Le complément sera ajouté au carnet de crédit.')
        : order.payment_method === 'cash' ? t('admin.add_charge_cash', 'Le montant à payer du client augmente.')
        : t('admin.add_charge_waafi', 'Pensez à encaisser le complément (Waafi / D-Money).'))
      : (order.payment_method === 'wallet' || order.payment_method === 'company_wallet' ? t('admin.remove_refund_wallet', 'Le montant sera recrédité sur la cagnotte du client.')
        : order.payment_method === 'cash' || order.payment_method === 'credit' ? t('admin.remove_refund_cash', 'Le montant à payer du client sera réduit.')
        : t('admin.remove_refund_waafi', 'Pensez à rembourser ce montant au client par Waafi.'));
    const action = newQty === 0
      ? `${t('admin.remove_item_confirm', 'Retirer')} « ${name} »`
      : increase
        ? `${t('admin.increase_qty_confirm', 'Augmenter')} « ${name} » → ${newQty} ${item.product_unit || ''}`
        : `${t('admin.reduce_qty_confirm', 'Réduire')} « ${name} » → ${newQty} ${item.product_unit || ''}`;
    const stockMsg = increase ? t('admin.add_item_stock', 'Le stock sera vérifié et réservé.') : t('admin.remove_item_stock', 'Le stock sera remis à disposition.');
    if (newQty === 0 && !confirm(`${action} (−${amt}) ?\n\n${refundMsg}\n${stockMsg}`)) return;
    // Garde-fou : après expédition/livraison, un motif est obligatoire (journal des modifications)
    let reason: string | null = null;
    if (!['pending', 'processing'].includes(order.status)) {
      reason = prompt(t('admin.edit_reason_prompt', 'Commande déjà expédiée/livrée : indiquez le motif de la modification (obligatoire, conservé dans le journal) :'));
      if (reason === null) return;
      if (!reason.trim()) { alert('⚠️ ' + t('admin.edit_reason_required', 'Motif obligatoire pour modifier une commande expédiée ou livrée.')); return; }
    }

    setRemovingItemId(item.id);
    try {
      const tk = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch('/api/admin/orders/remove-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` },
        body: JSON.stringify({ order_id: order.id, item_id: item.id, new_quantity: newQty, reason }),
      });
      const j = await res.json();
      if (!res.ok) {
        const map: Record<string, string> = {
          order_cancelled: t('admin.remove_err_cancelled', 'Commande annulée : modification impossible.'),
          last_item: t('admin.remove_err_last', 'Dernier article : annulez plutôt la commande entière.'),
          reason_required: t('admin.edit_reason_required', 'Motif obligatoire pour modifier une commande expédiée ou livrée.'),
          stock_insufficient: `${t('admin.edit_err_stock', 'Stock insuffisant.')}${j.available != null ? ` ${t('admin.edit_err_stock_max', 'Maximum possible :')} ${j.available}` : ''}`,
          wallet_insufficient: t('checkout.wallet_insufficient', 'Solde de cagnotte insuffisant'),
          company_wallet_insufficient: t('co.e_balance', 'Solde de la cagnotte société insuffisant.'),
          credit_unavailable: t('admin.edit_err_credit', 'Crédit indisponible (plafond, retard ou compte suspendu).'),
        };
        alert('⚠️ ' + (map[j.error] || j.error || 'Erreur'));
        return;
      }
      setOrders(prev => prev.map(o => o.id === order.id
        ? {
            ...o,
            total: j.newTotal,
            order_items: j.removed
              ? o.order_items.filter(it => it.id !== item.id)
              : o.order_items.map(it => it.id === item.id ? { ...it, quantity: newQty } : it),
          }
        : o));
      setQtyDraft(null);
      fetchAll();   // recharge le journal des modifications de la commande
      if (j.refundMethod === 'manual') {
        const n = Math.abs(Number(j.refundAmount)).toLocaleString();
        alert(`✅ ${t('admin.remove_done', 'Modification effectuée.')} ${Number(j.refundAmount) < 0 ? t('admin.add_collect_waafi', 'Complément à encaisser (Waafi / D-Money)') : t('admin.remove_refund_waafi_amount', 'À rembourser par Waafi')} : ${n} Fdj`);
      }
    } catch (e: any) {
      alert('⚠️ ' + e.message);
    } finally {
      setRemovingItemId(null);
    }
  };

  const statusFilters = [
    { value: '', label: t('admin.all', 'Toutes') },
    ...STATUSES.map(s => ({ value: s, label: meta(s).label })),
  ];

  // Journal global des commandes modifiées (traçabilité, admin seulement)
  const [editLog, setEditLog] = useState<OrderEdit[] | null>(null);
  const [editLogOpen, setEditLogOpen] = useState(false);
  const toggleEditLog = async () => {
    if (editLogOpen) { setEditLogOpen(false); return; }
    setEditLogOpen(true);
    if (editLog) return;
    try {
      const tk = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch('/api/admin/orders/edits', { headers: { Authorization: `Bearer ${tk}` } });
      const j = await res.json();
      setEditLog(res.ok ? (j.edits || []) : []);
    } catch { setEditLog([]); }
  };
  const editLine = (e: OrderEdit) => `${e.product_name || '—'} : ${Number(e.from_qty)} → ${Number(e.to_qty)} ${e.product_unit || ''}`.trim();
  const editWhen = (d: string) => new Date(d).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <div>
      {/* En-tête + filtres */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-gray-800">📦 {t('admin.nav_orders', 'Commandes')}</h1>
          {isAdmin && (
            <button onClick={toggleEditLog} className={`text-xs font-semibold rounded-full px-3 py-1.5 border transition ${editLogOpen ? 'bg-[#526500] text-white border-[#526500]' : 'border-[#d2e095] text-[#526500] hover:bg-[#ecf4d5]'}`}>
              🕘 {t('admin.edits_log', 'Commandes modifiées')}
            </button>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {statusFilters.map(s => (
            <button
              key={s.value}
              onClick={() => setFilterStatus(s.value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                filterStatus === s.value
                  ? 'bg-[#526500] text-white'
                  : 'bg-white border border-[#d2e095] text-gray-600 hover:border-[#a8c800]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Journal des commandes modifiées (traçabilité admin : qui, quoi, quand, pourquoi) */}
      {editLogOpen && isAdmin && (
        <div className="mb-6 bg-white border-2 border-[#d2e095] rounded-2xl p-4">
          <p className="font-bold text-gray-800 mb-1">🕘 {t('admin.edits_log', 'Commandes modifiées')}</p>
          <p className="text-xs text-gray-400 mb-3">{t('admin.edits_log_hint', 'Toutes les modifications de quantités, les plus récentes d\'abord. Les remises accordées ont leur propre journal sur chaque commande.')}</p>
          {editLog == null ? <p className="text-sm text-gray-400">{t('admin.loading', 'Chargement...')}</p>
            : editLog.length === 0 ? <p className="text-sm text-gray-400">{t('admin.edits_none', 'Aucune commande modifiée.')}</p>
            : (
              <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                {editLog.map(e => (
                  <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 bg-[#faf7e8] rounded-xl px-3 py-2 text-xs">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800">#{String(e.order_id).slice(0, 8).toUpperCase()} · {e.orders?.customer_name || '—'} — {editLine(e)}</p>
                      <p className="text-gray-500">{editWhen(e.created_at)} · {e.by_name || '—'} ({e.by_role === 'admin' ? t('admin.role_admin', 'admin') : t('admin.role_manager', 'gestionnaire')}) · {t('admin.edits_status', 'statut')} : {meta(e.order_status || '').label}{e.reason ? ` · 📝 ${e.reason}` : ''}</p>
                    </div>
                    <span className={`font-bold shrink-0 ${e.amount < 0 ? 'text-[#f97316]' : 'text-[#526500]'}`}>{e.amount < 0 ? '−' : '+'}{Math.abs(e.amount).toLocaleString()} Fdj</span>
                  </div>
                ))}
              </div>
            )}
        </div>
      )}

      {/* Demandes d'annulation en attente (validation admin) */}
      {can('orders', 'edit') && cancelReqs.length > 0 && (
        <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-2xl p-4">
          <p className="font-bold text-red-700 mb-3">🛑 {t('admin.cancel_req_title', 'Demandes d\'annulation')} ({cancelReqs.length})</p>
          <div className="space-y-2">
            {cancelReqs.map(req => {
              const shortId = String(req.order_id).slice(0, 8).toUpperCase();
              return (
                <div key={req.id} className="bg-white rounded-xl border border-red-200 px-4 py-3 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">#{shortId} · {req.order?.customer_name || '—'}
                      {req.order?.total != null && <span className="ml-2 text-[11px] font-normal text-gray-400">{Number(req.order.total).toLocaleString()} Fdj · {PAYMENT_LABELS[req.order?.payment_method] || ''}</span>}
                    </p>
                    <p className="text-xs text-gray-500">{t('admin.cancel_req_by', 'Demandé par')} {req.requested_by_name || '—'}{req.by_customer ? ` · 🙋 ${t('admin.cancel_req_customer', 'le client')}` : ''}</p>
                  </div>
                  {isAdmin ? (
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => resolveCancel(req, 'approve')} disabled={cancelBusyId === req.id}
                        className="text-xs font-semibold bg-red-500 text-white rounded-lg px-3 py-1.5 hover:bg-red-600 transition disabled:opacity-50">
                        {cancelBusyId === req.id ? '⏳' : '✅ ' + t('admin.cancel_approve', 'Valider l\'annulation')}
                      </button>
                      <button onClick={() => resolveCancel(req, 'reject')} disabled={cancelBusyId === req.id}
                        className="text-xs font-semibold border border-gray-300 text-gray-600 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition disabled:opacity-50">
                        ✖ {t('admin.cancel_reject', 'Refuser')}
                      </button>
                    </div>
                  ) : (
                    <span className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 flex-shrink-0">
                      ⏳ {t('admin.cancel_pending_admin', 'En attente de validation admin')}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Demandes de modification en attente */}
      {can('orders', 'edit') && changeReqs.length > 0 && (
        <div className="mb-6 bg-amber-50 border-2 border-amber-200 rounded-2xl p-4">
          <p className="font-bold text-amber-800 mb-3">✋ {t('admin.req_title', 'Demandes de modification')} ({changeReqs.length})</p>
          <div className="space-y-2">
            {changeReqs.map(req => {
              const shortId = String(req.order_id).slice(0, 8).toUpperCase();
              const isRemove = req.type === 'remove' || req.new_quantity === 0;
              const label = isRemove
                ? `${t('admin.req_remove', 'Retrait')} « ${req.product_name || '—'} »`
                : `${t('admin.req_reduce', 'Réduction')} « ${req.product_name || '—'} » : ${req.current_quantity} → ${req.new_quantity} ${req.unit || ''}`;
              return (
                <div key={req.id} className="bg-white rounded-xl border border-amber-200 px-4 py-3 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">#{shortId} · {req.order?.customer_name || '—'}</p>
                    <p className="text-xs text-gray-500">{label} · −{Number(req.refund_amount).toLocaleString()} Fdj · {PAYMENT_LABELS[req.order?.payment_method] || ''}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => resolveReq(req, 'approve')} disabled={resolvingId === req.id}
                      className="text-xs font-semibold bg-[#a8c800] text-white rounded-lg px-3 py-1.5 hover:bg-[#7d9800] transition disabled:opacity-50">
                      {resolvingId === req.id ? '⏳' : '✅ ' + t('admin.req_approve', 'Approuver')}
                    </button>
                    <button onClick={() => resolveReq(req, 'reject')} disabled={resolvingId === req.id}
                      className="text-xs font-semibold border border-red-200 text-red-500 rounded-lg px-3 py-1.5 hover:bg-red-50 transition disabled:opacity-50">
                      ✖ {t('admin.req_reject', 'Refuser')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <p className="text-gray-400">{t('admin.loading', 'Chargement...')}</p>
        </div>
      ) : fetchError ? (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6">
          <p className="text-[#f97316] font-semibold mb-1">⚠️ Erreur de chargement</p>
          <p className="text-[#f97316] text-sm font-mono">{fetchError}</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 text-gray-400 bg-white rounded-2xl border border-[#d2e095]">
          {filterStatus
            ? t('admin.orders_none_status', 'Aucune commande avec ce statut')
            : t('admin.orders_none', 'Aucune commande')}
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map(order => {
            const m = meta(order.status);
            const isUpdating = updatingId === order.id;
            const items = order.order_items || [];
            const subtotal = items.reduce((s, it) => s + Number(it.price) * it.quantity, 0);
            const deliveryFee = order.delivery_fee != null ? order.delivery_fee : Math.max(0, Number(order.total) - subtotal);

            return (
              <div key={order.id} className="bg-white rounded-2xl border-2 border-[#bcd36a] shadow-md overflow-hidden">

                {/* ── En-tête commande ── */}
                <div className="flex flex-wrap items-start gap-4 p-4 bg-[#f8fdf0] border-b border-[#d2e095]">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono text-xs text-gray-400 bg-white border border-[#d2e095] px-2 py-0.5 rounded-lg">
                        #{String(order.id).slice(0, 8).toUpperCase()}
                      </span>
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${m.cls}`}>
                        {m.label}
                      </span>
                    </div>
                    <p className="font-bold text-gray-800">{order.customer_name || '—'}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-500">
                      {order.phone   && <span>📞 {order.phone}</span>}
                      {order.email   && <span>✉️ {order.email}</span>}
                      {order.address && <span>📍 {order.address}</span>}
                      {order.special_instructions && (
                        <span className="w-full mt-1 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 block">
                          📝 {order.special_instructions}
                        </span>
                      )}
                      <span>{PAYMENT_LABELS[order.payment_method] || order.payment_method}</span>
                      <span>🕐 {new Date(order.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                    </div>
                  </div>

                  {/* Total + sélecteur statut */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-xs text-gray-400">{items.length} article{items.length > 1 ? 's' : ''}</p>
                      <p className="text-xl font-bold text-[#526500]">{Number(order.total).toLocaleString()} Fdj</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {can('orders', 'edit') ? (
                        <select
                          value={order.status}
                          disabled={isUpdating}
                          onChange={e => updateStatus(order.id, e.target.value)}
                          className={`text-xs border rounded-xl px-2 py-1.5 font-semibold cursor-pointer focus:outline-none disabled:opacity-50 ${m.cls}`}
                        >
                          {STATUSES.map(s => (
                            <option key={s} value={s}>{meta(s).label}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`text-xs border rounded-xl px-2 py-1.5 font-semibold ${m.cls}`}>{m.label}</span>
                      )}
                      {isUpdating && <span className="text-xs text-gray-400">⏳</span>}
                      <button
                        onClick={() => setSlipOrder(order)}
                        className="text-xs font-medium text-[#526500] border border-[#d2e095] rounded-lg px-2 py-1 hover:bg-[#ecf4d5] transition whitespace-nowrap"
                      >
                        🖨️ {t('admin.prep_slip', 'Bordereau')}
                      </button>
                    </div>
                  </div>
                </div>

                {/* ── Articles ── */}
                {items.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">
                    {t('admin.order_no_items', 'Aucun article enregistré')}
                  </p>
                ) : (
                  <div className="divide-y divide-[#f0f7e0]">
                    {items.map(item => {
                      const subtotal = item.price * item.quantity;
                      const name  = item.product_name || `Produit #${item.product_id}`;
                      const unit  = item.product_unit || 'u';
                      const farm  = item.product_farm || null;
                      const image = item.product_image_url ?? null;

                      return (
                        <div key={item.id} className="flex gap-4 p-4 items-start">
                          {/* Image */}
                          <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#ecf4d5] flex-shrink-0">
                            {image ? (
                              <img src={image} alt={name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-2xl opacity-20">📷</div>
                            )}
                          </div>

                          {/* Infos produit */}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-800 text-sm mb-0.5">{name}</p>
                            {farm && <p className="text-xs text-gray-400">🌱 {farm}</p>}
                            {Array.isArray(item.bundle_contents) && item.bundle_contents.length > 0 && (
                              <p className="text-xs text-gray-500 mt-0.5">🧺 {item.bundle_contents.map((c: any) => `${Number(c.quantity) * Number(item.quantity)} ${c.unit || ''} ${c.name}`.replace(/\s+/g, ' ').trim()).join(' · ')}</p>
                            )}
                          </div>

                          {/* Prix × quantité = total */}
                          <div className="text-right flex-shrink-0 space-y-0.5">
                            <p className="text-xs text-gray-400">
                              {Number(item.price).toLocaleString()} Fdj / {unit}
                            </p>
                            <p className="text-xs text-gray-500">
                              × {item.quantity} {unit}
                            </p>
                            {Number(item.discount) > 0 ? (
                              <p className="text-sm font-bold text-[#526500]">
                                <span className="line-through text-gray-400 font-normal mr-1">{Number(subtotal).toLocaleString()}</span>{(Number(subtotal) - Number(item.discount)).toLocaleString()} Fdj
                                <span className="block text-[10px] font-normal text-[#526500]">🎁 {Number(item.price).toLocaleString()} → {Math.round((Number(subtotal) - Number(item.discount)) / Number(item.quantity)).toLocaleString()} Fdj / {unit}</span>
                              </p>
                            ) : (
                              <p className="text-sm font-bold text-[#526500]">
                                {Number(subtotal).toLocaleString()} Fdj
                              </p>
                            )}
                            {can('orders', 'edit') && order.status !== 'cancelled' && (() => {
                              const draft = parseInt(draftFor(item), 10);
                              const changed = !isNaN(draft) && draft !== item.quantity && draft > 0;
                              const delta = changed ? (draft - item.quantity) * Number(item.price) : 0;
                              return (
                                <div className="flex items-center justify-end gap-1.5 mt-1 flex-wrap">
                                  <div className="inline-flex items-center border border-[#d2e095] rounded-lg overflow-hidden">
                                    <button onClick={() => bumpDraft(item, -1)} disabled={removingItemId === item.id || (isNaN(draft) ? item.quantity : draft) <= 1}
                                      title={t('admin.reduce_qty', 'Réduire la quantité')} className="px-2 py-1 text-[13px] font-bold text-[#526500] hover:bg-[#ecf4d5] disabled:opacity-40">−</button>
                                    <input type="number" inputMode="numeric" min={1} value={draftFor(item)}
                                      onChange={e => setQtyDraft({ itemId: item.id, qty: e.target.value })}
                                      aria-label={t('admin.qty_label', 'Quantité')}
                                      className="w-12 text-center text-[12px] font-semibold text-gray-800 py-1 outline-none border-x border-[#e3eebf]" />
                                    <button onClick={() => bumpDraft(item, 1)} disabled={removingItemId === item.id}
                                      title={t('admin.increase_qty', 'Augmenter la quantité')} className="px-2 py-1 text-[13px] font-bold text-[#526500] hover:bg-[#ecf4d5] disabled:opacity-40">+</button>
                                  </div>
                                  {changed && (
                                    <>
                                      <button onClick={() => modifyItem(order, item, draft)} disabled={removingItemId === item.id}
                                        className="inline-flex items-center gap-1 text-[11px] font-semibold bg-[#a8c800] text-white rounded-lg px-2.5 py-1 hover:bg-[#7d9800] transition disabled:opacity-50">
                                        {removingItemId === item.id ? '⏳' : `✓ ${t('admin.qty_apply', 'Appliquer')} (${delta > 0 ? '+' : '−'}${Math.abs(delta).toLocaleString()} Fdj)`}
                                      </button>
                                      <button onClick={() => setQtyDraft(null)} disabled={removingItemId === item.id}
                                        aria-label={t('admin.cancel', 'Annuler')} className="text-[11px] text-gray-400 hover:text-gray-600 px-1">✕</button>
                                    </>
                                  )}
                                  {!changed && items.length > 1 && (
                                    <button
                                      onClick={() => modifyItem(order, item, 0)}
                                      disabled={removingItemId === item.id}
                                      className="inline-flex items-center gap-1 text-[11px] font-medium text-[#f97316] border border-orange-200 rounded-lg px-2 py-1 hover:bg-orange-50 transition disabled:opacity-50"
                                    >
                                      {removingItemId === item.id ? '⏳' : '🗑️'} {t('admin.remove_item', 'Retirer')}
                                    </button>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ── Pied : ventilation sous-total / livraison / total ── */}
                {items.length > 0 && (
                  <div className="px-4 py-3 bg-[#f8fdf0] border-t border-[#d2e095] space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">{t('admin.subtotal', 'Sous-total')}</span>
                      <span className="text-gray-700">{Number(subtotal).toLocaleString()} Fdj</span>
                    </div>
                    {(order.order_edits || []).length > 0 && (
                      <div className="text-[11px] text-gray-500 border border-[#e3eebf] bg-white rounded-lg px-2.5 py-1.5 space-y-0.5">
                        {(order.order_edits || []).slice(-4).map(e => (
                          <p key={e.id}>✏️ {editWhen(e.created_at)} · {editLine(e)} ({e.amount < 0 ? '−' : '+'}{Math.abs(e.amount).toLocaleString()} Fdj) · {e.by_name || '—'}{e.reason ? ` — ${e.reason}` : ''}</p>
                        ))}
                      </div>
                    )}
                    {Number(order.promo_discount) > 0 && (
                      <div className="flex justify-between text-sm text-[#526500]">
                        <span>🎁 {t('admin.disc_promo', 'Code promo')} {order.promo_code}</span>
                        <span>−{Number(order.promo_discount).toLocaleString()} Fdj</span>
                      </div>
                    )}
                    {(Number(order.admin_discount) > 0 || items.some(it => Number(it.discount) > 0)) && (
                      <div className="flex justify-between text-sm text-[#526500]">
                        <span>💸 {t('admin.disc_granted', 'Remise accordée')}{(order.discount_history || []).length ? <span className="text-gray-400"> — {(order.discount_history || []).filter(h => h.kind !== 'reset').map(h => h.note).filter(Boolean).slice(-1)[0]}</span> : null}</span>
                        <span>−{(Number(order.admin_discount) + items.reduce((s, it) => s + (Number(it.discount) || 0), 0)).toLocaleString()} Fdj</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">
                        🚚 {t('admin.delivery', 'Frais de livraison')}
                        {order.delivery_option_name && <span className="text-gray-400"> — {order.delivery_option_name}</span>}
                      </span>
                      <span className={deliveryFee === 0 ? 'text-green-600 font-medium' : 'text-gray-700'}>
                        {deliveryFee === 0 ? t('admin.delivery_free', 'Offerte') : `${Number(deliveryFee).toLocaleString()} Fdj`}
                      </span>
                    </div>
                    {Number(order.delivery_discount) > 0 && (
                      <p className="text-[11px] text-[#526500] text-right">
                        🎁 {order.delivery_discount_source === 'promo' ? `${t('admin.disc_promo', 'Code promo')} ${order.promo_code}`
                          : order.delivery_discount_source === 'threshold' ? t('admin.disc_threshold', 'Seuil de livraison offerte')
                          : t('admin.disc_referral', 'Parrainage')} — {Number(order.delivery_discount).toLocaleString()} Fdj {t('admin.disc_offered', 'offerts')}
                      </p>
                    )}
                    <div className="flex justify-between items-center pt-1.5 border-t border-[#d2e095]">
                      <span className="text-sm text-gray-600 font-medium">{t('admin.total', 'Total commande')}</span>
                      <span className="text-lg font-bold text-[#526500]">{Number(order.total).toLocaleString()} Fdj</span>
                    </div>

                    {/* Remise admin : marchandage, geste commercial — prix réel conservé, remise tracée */}
                    {can('orders', 'edit') && order.status !== 'cancelled' && (
                      discountFor === order.id ? (
                        <div className="mt-2 border border-[#d2e095] rounded-xl p-3 bg-white space-y-2">
                          <div className="flex flex-wrap gap-3 text-xs">
                            <label className="flex items-center gap-1.5"><input type="radio" name={`dmode-${order.id}`} checked={dForm.mode === 'line'} onChange={() => setDForm(f => ({ ...f, mode: 'line' }))} className="accent-[#a8c800]" /> {t('admin.disc_mode_line', 'Nouveau prix sur un article')}</label>
                            <label className="flex items-center gap-1.5"><input type="radio" name={`dmode-${order.id}`} checked={dForm.mode === 'global'} onChange={() => setDForm(f => ({ ...f, mode: 'global' }))} className="accent-[#a8c800]" /> {t('admin.disc_mode_global', 'Montant sur toute la commande')}</label>
                          </div>
                          {dForm.mode === 'line' ? (
                            <div className="flex flex-wrap gap-2">
                              <select value={dForm.item_id} onChange={e => setDForm(f => ({ ...f, item_id: e.target.value }))} className="border border-[#d2e095] rounded-lg px-2 py-1.5 text-xs flex-1 min-w-[160px]">
                                <option value="">{t('admin.disc_pick_item', 'Choisir l\'article…')}</option>
                                {items.map(it => <option key={it.id} value={it.id}>{it.product_name} — {Number(it.price).toLocaleString()} Fdj / {it.product_unit || ''}</option>)}
                              </select>
                              <input type="number" inputMode="numeric" min={0} step={1} value={dForm.new_price} onChange={e => setDForm(f => ({ ...f, new_price: e.target.value }))} placeholder={t('admin.disc_new_price_ph', 'Ex : nouveau prix unitaire')} className="border border-[#d2e095] rounded-lg px-2 py-1.5 text-xs w-44" />
                            </div>
                          ) : (
                            <input type="number" inputMode="numeric" min={1} step={1} value={dForm.amount} onChange={e => setDForm(f => ({ ...f, amount: e.target.value }))} placeholder={t('admin.disc_amount_ph', 'Ex : montant de la remise en Fdj')} className="border border-[#d2e095] rounded-lg px-2 py-1.5 text-xs w-60" />
                          )}
                          <input value={dForm.note} maxLength={300} onChange={e => setDForm(f => ({ ...f, note: e.target.value }))} placeholder={t('admin.disc_note_ph', 'Ex : gros volume, négocié par téléphone')} className="border border-[#d2e095] rounded-lg px-2 py-1.5 text-xs w-full" />
                          <div className="flex flex-wrap gap-2 items-center">
                            <button disabled={dBusy || !dForm.note.trim() || (dForm.mode === 'line' ? !dForm.item_id || dForm.new_price === '' : !dForm.amount)} onClick={() => grantDiscount(order, dForm.mode as 'line' | 'global')} className="text-xs font-semibold bg-[#a8c800] text-white rounded-lg px-3 py-1.5 hover:bg-[#7d9800] disabled:opacity-40">{dBusy ? '⏳' : `💸 ${t('admin.disc_apply', 'Accorder la remise')}`}</button>
                            {(Number(order.admin_discount) > 0 || items.some(it => Number(it.discount) > 0)) && <button disabled={dBusy} onClick={() => grantDiscount(order, 'reset')} className="text-xs font-semibold border border-orange-200 text-[#f97316] rounded-lg px-3 py-1.5 hover:bg-orange-50">{t('admin.disc_reset', 'Annuler les remises')}</button>}
                            <button onClick={() => { setDiscountFor(null); setDMsg(''); }} className="text-xs text-gray-500 hover:underline">{t('admin.cancel', 'Annuler')}</button>
                          </div>
                          {dMsg && <p className="text-xs text-gray-700">{dMsg}</p>}
                          {(order.discount_history || []).length > 0 && (
                            <ul className="text-[11px] text-gray-500 space-y-0.5 border-t border-[#f0f7e0] pt-1.5">
                              {(order.discount_history || []).slice(-5).map((h, i) => (
                                <li key={i}>{new Date(h.at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {h.by_name || 'admin'} · {h.kind === 'reset' ? t('admin.disc_h_reset', 'remises annulées') : h.kind === 'line' ? `${h.name} : ${Number(h.from).toLocaleString()} → ${Number(h.to).toLocaleString()} Fdj` : `−${Number(h.amount).toLocaleString()} Fdj`}{h.note ? ` — ${h.note}` : ''}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ) : (
                        <div className="mt-2 text-right">
                          <button onClick={() => { setDiscountFor(order.id); setDMsg(''); setDForm({ mode: 'line', item_id: '', new_price: '', amount: '', note: '' }); }} className="text-xs font-semibold border border-[#d2e095] text-[#526500] rounded-lg px-3 py-1.5 hover:bg-[#ecf4d5]">💸 {t('admin.disc_button', 'Accorder une remise')}</button>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {slipOrder && <PrepSlip order={slipOrder} onClose={() => setSlipOrder(null)} />}
    </div>
  );
}
