'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { supabase, fetchProducts } from '../../lib/supabase';
import { planReorder, type ReorderPlan } from '../../lib/reorder';
import { notice } from '../Dialog';

// Créer une commande par copie (gestionnaire/admin) : les articles d'une commande passée sont
// repris aux prix et stocks DU JOUR, les quantités sont ajustables, puis une NOUVELLE commande
// est créée au nom du client (mode « pour le compte de » de /api/orders — on_behalf).
// Codes promo non copiés ; frais de livraison recalculés côté serveur (seuil « offerte » compris).

const fdj = (n: number) => `${Math.round(Number(n)).toLocaleString('fr-FR')} Fdj`;

type SourceOrder = {
  id: string; user_id: string | null; customer_name: string; phone: string; email: string | null;
  address: string; special_instructions: string | null; delivery_option_name: string | null;
  order_items: { product_id: number; quantity: number; price: number; product_name?: string | null; product_unit?: string | null; product_image_url?: string | null }[];
};

export default function AdminDuplicateOrder({ order, deliveryOpts, onClose, onCreated }: {
  order: SourceOrder;
  deliveryOpts: { id: number; name: string; price: number }[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;

  const [plan, setPlan] = useState<ReorderPlan | null>(null);
  const [failed, setFailed] = useState(false);
  const [qty, setQty] = useState<Record<number, number>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const defaultOpt = deliveryOpts.find(o => o.name === order.delivery_option_name) || deliveryOpts[0] || null;
  const [form, setForm] = useState({
    option_id: defaultOpt ? String(defaultOpt.id) : '',
    payment: 'cash',
    customer_name: order.customer_name || '',
    phone: order.phone || '',
    email: order.email || '',
    address: order.address || '',
    instructions: order.special_instructions || '',
  });

  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const catalog = await fetchProducts();
        if (!on) return;
        const p = planReorder(order.order_items, catalog);
        setPlan(p);
        setQty(Object.fromEntries(p.lines.map(l => [l.product_id, l.quantity])));
      } catch { if (on) setFailed(true); }
    })();
    return () => { on = false; };
  }, [order]);

  const stockOf = (id: number) => {
    const p = plan?.lines.find(l => l.product_id === id)?.product;
    return p ? Math.max(0, Number(p.stock_qty) || 0) : 0;
  };
  const bump = (id: number, d: number) => setQty(q => ({ ...q, [id]: Math.max(0, Math.min(stockOf(id), (q[id] || 0) + d)) }));

  const kept = useMemo(() => (plan?.lines || []).filter(l => l.product && (qty[l.product_id] || 0) > 0), [plan, qty]);
  const subtotal = kept.reduce((s, l) => s + (l.price || 0) * (qty[l.product_id] || 0), 0);
  const opt = deliveryOpts.find(o => String(o.id) === form.option_id) || null;

  const ERR: Record<string, string> = {
    stock_insufficient: t('dup.e_stock', 'Stock insuffisant pour certains articles — quantités mises à jour, vérifiez puis réessayez.'),
    delivery_option_invalid: t('dup.e_delivery', 'Choisissez une option de livraison.'),
    wallet_insufficient: t('dup.e_wallet', 'Cagnotte du client insuffisante.'),
    credit_unavailable: t('dup.e_credit', 'Carnet de crédit du client indisponible (plafond, retard ou compte inactif).'),
    credit_requires_account: t('dup.e_credit_acct', 'Le paiement par carnet exige un compte client.'),
    wallet_requires_account: t('dup.e_wallet_acct', 'Le paiement par cagnotte exige un compte client.'),
    empty_order: t('dup.e_empty', 'Aucun article à commander.'),
    on_behalf_unsupported: t('dup.e_unsupported', 'Mode non autorisé pour cette commande.'),
  };

  const create = async () => {
    if (!kept.length) { setMsg(ERR.empty_order); return; }
    setBusy(true); setMsg('');
    try {
      const tk = (await supabase.auth.getSession()).data.session?.access_token;
      const items = kept.map(l => ({
        product_id: l.product_id,
        quantity: qty[l.product_id],
        price: l.price,
        product_name: l.product.name,
        product_image_url: l.product.image_url ?? null,
        product_unit: l.product.unit ?? null,
        product_farm: l.product.farm ?? null,
      }));
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` },
        body: JSON.stringify({
          on_behalf: true,
          copied_from: Number(order.id),
          items,
          order: {
            user_id: order.user_id,
            payment_method: form.payment,
            delivery_option_id: form.option_id ? Number(form.option_id) : null,
            customer_name: form.customer_name || null,
            phone: form.phone || null,
            email: form.email || null,
            address: form.address || null,
            special_instructions: form.instructions || null,
          },
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        if (j.error === 'stock_insufficient' && Array.isArray(j.items)) {
          // Quantités replafonnées sur le disponible réel renvoyé par le serveur
          setQty(q => { const n = { ...q }; for (const it of j.items) n[it.product_id] = Math.max(0, Number(it.available) || 0); return n; });
        }
        setMsg('⚠️ ' + (ERR[j.error] || j.error || 'Erreur'));
        return;
      }
      notice('✅ ' + t('dup.done', 'Commande créée pour le client') + ` — #${j.order?.id ?? ''}`);
      onCreated();
    } catch (e: any) {
      setMsg('⚠️ ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const STATUS = {
    reduced:     { cls: 'text-amber-700', text: t('reorder.reduced', 'quantité réduite (stock)') },
    unavailable: { cls: 'text-red-500',   text: t('reorder.unavailable', 'indisponible') },
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={t('dup.title', 'Créer une commande par copie')}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-[#d2e095] flex items-center justify-between gap-3">
          <h3 className="font-bold text-gray-800">
            🔁 {t('dup.title', 'Créer une commande par copie')}
            <span className="block text-xs font-normal text-gray-400">{t('dup.from', 'd\'après')} #{order.id} — {order.customer_name}</span>
          </h3>
          <button onClick={onClose} aria-label={t('install.close', 'Fermer')} className="text-gray-400 hover:text-gray-600 text-2xl leading-none w-8 h-8 flex items-center justify-center">×</button>
        </div>

        {failed ? <p className="p-6 text-sm text-center text-gray-500">{t('profile.reorder_err', 'Erreur, réessayez.')}</p>
          : !plan ? <p className="p-10 text-center text-gray-400">⏳</p>
          : (
            <>
              <div className="overflow-y-auto p-3 space-y-2">
                {/* Lignes aux prix du jour, quantités ajustables */}
                {plan.lines.map(l => {
                  const q = qty[l.product_id] || 0;
                  const dead = !l.product;
                  return (
                    <div key={l.product_id} className={`flex items-center gap-3 rounded-xl px-3 py-2 ${dead || q === 0 ? 'bg-gray-50 opacity-70' : 'bg-[#faf7e8]'}`}>
                      <div className="w-10 h-10 rounded-lg overflow-hidden flex-none bg-[#ecf4d5] flex items-center justify-center">
                        {l.image_url ? <img src={l.image_url} alt="" className="w-full h-full object-cover" /> : <span>🥬</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{l.name}</p>
                        <p className="text-xs text-gray-500">
                          {dead ? <span className={STATUS.unavailable.cls}>{STATUS.unavailable.text}</span>
                            : <>{fdj(l.price || 0)} / {l.unit}{l.price !== l.old_price && <span className="text-gray-400"> ({t('dup.old_price', 'avant')} {fdj(l.old_price)})</span>}
                              {l.status === 'reduced' && <span className={`ml-1 ${STATUS.reduced.cls}`}>{STATUS.reduced.text}</span>}</>}
                        </p>
                      </div>
                      {!dead && (
                        <div className="flex items-center gap-1 flex-none">
                          <button onClick={() => bump(l.product_id, -1)} disabled={q <= 0} className="w-7 h-7 rounded-lg border border-[#d2e095] text-[#526500] font-bold disabled:opacity-30">−</button>
                          <span className="w-10 text-center text-sm font-semibold">{q} <span className="text-[10px] font-normal text-gray-400">{l.unit}</span></span>
                          <button onClick={() => bump(l.product_id, +1)} disabled={q >= stockOf(l.product_id)} className="w-7 h-7 rounded-lg border border-[#d2e095] text-[#526500] font-bold disabled:opacity-30">+</button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Livraison + paiement */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <label className="text-xs text-gray-500">
                    🚚 {t('dup.delivery', 'Livraison')}
                    <select value={form.option_id} onChange={e => setForm(f => ({ ...f, option_id: e.target.value }))}
                      className="mt-1 w-full border border-[#d2e095] rounded-xl px-2 py-2 text-sm">
                      {deliveryOpts.map(o => <option key={o.id} value={o.id}>{o.name} — {o.price.toLocaleString()} Fdj</option>)}
                    </select>
                  </label>
                  <label className="text-xs text-gray-500">
                    💳 {t('dup.payment', 'Paiement')}
                    <select value={form.payment} onChange={e => setForm(f => ({ ...f, payment: e.target.value }))}
                      className="mt-1 w-full border border-[#d2e095] rounded-xl px-2 py-2 text-sm">
                      <option value="cash">💵 {t('pay.cash', 'Espèces')}</option>
                      <option value="waafi">📱 Waafi</option>
                      <option value="dmoney">💳 D-Money</option>
                      {order.user_id && <option value="wallet">💰 {t('pay.wallet', 'Cagnotte')}</option>}
                      {order.user_id && <option value="credit">📒 {t('pay.credit', 'Carnet (crédit)')}</option>}
                    </select>
                  </label>
                </div>

                {/* Coordonnées (préremplies, modifiables) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
                    placeholder={t('dup.name', 'Nom du client')} className="border border-[#d2e095] rounded-xl px-3 py-2 text-sm" />
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder={t('dup.phone', 'Téléphone')} className="border border-[#d2e095] rounded-xl px-3 py-2 text-sm" />
                </div>
                <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  placeholder={t('dup.address', 'Adresse de livraison')} className="w-full border border-[#d2e095] rounded-xl px-3 py-2 text-sm" />
                <input value={form.instructions} onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))}
                  placeholder={t('dup.instructions', 'Instructions (facultatif)')} className="w-full border border-[#d2e095] rounded-xl px-3 py-2 text-sm" />

                {msg && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{msg}</p>}
              </div>

              <div className="p-4 border-t border-[#d2e095] space-y-2 bg-[#f8fdf0]">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t('admin.subtotal', 'Sous-total')} ({kept.length} {t('dup.items', 'article(s)')})</span>
                  <span className="font-semibold text-gray-800">{fdj(subtotal)}</span>
                </div>
                <p className="text-[11px] text-gray-400">
                  🚚 {opt ? `${opt.name} — ${fdj(opt.price)}` : '—'} · {t('dup.fee_note', 'frais recalculés à la création (livraison offerte si seuil atteint)')}
                </p>
                <button onClick={create} disabled={busy || !kept.length}
                  className="w-full bg-[#526500] text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50">
                  {busy ? '⏳' : `✅ ${t('dup.create', 'Créer la commande pour')} ${form.customer_name || t('dup.client', 'le client')}`}
                </button>
              </div>
            </>
          )}
      </div>
    </div>
  );
}
