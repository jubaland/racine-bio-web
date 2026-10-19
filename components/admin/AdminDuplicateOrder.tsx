'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { supabase, fetchProducts } from '../../lib/supabase';
import { planReorder } from '../../lib/reorder';
import { notice } from '../Dialog';

// Créer une commande par copie (gestionnaire/admin) : les articles d'une commande passée sont
// repris aux prix et stocks DU JOUR, les quantités sont ajustables, d'autres articles du catalogue
// peuvent être ajoutés, un code promo peut être appliqué (limites comptées sur le client) et une
// remise globale accordée — puis une NOUVELLE commande est créée au nom du client (on_behalf).
// Frais de livraison recalculés côté serveur (seuil « offerte » et code compris).

const fdj = (n: number) => `${Math.round(Number(n)).toLocaleString('fr-FR')} Fdj`;

type SourceOrder = {
  id: string; user_id: string | null; customer_name: string; phone: string; email: string | null;
  address: string; special_instructions: string | null; delivery_option_name: string | null;
  order_items: { product_id: number; quantity: number; price: number; product_name?: string | null; product_unit?: string | null; product_image_url?: string | null }[];
};

type Row = {
  product_id: number; name: string; unit: string; image_url: string | null;
  price: number; old_price: number | null;   // old_price null : article ajouté (pas dans l'original)
  status: 'ok' | 'reduced' | 'unavailable';
  product: any | null;
};

export default function AdminDuplicateOrder({ order, deliveryOpts, onClose, onCreated }: {
  order: SourceOrder;
  deliveryOpts: { id: number; name: string; price: number }[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;

  const [catalog, setCatalog] = useState<any[] | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [qty, setQty] = useState<Record<number, number>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  // Ajout d'articles hors commande d'origine
  const [search, setSearch] = useState('');
  // Code promo (vérifié via /api/promo, appliqué réellement par le serveur à la création)
  const [codeInput, setCodeInput] = useState('');
  const [code, setCode] = useState<{ code: string; benefit: any } | null>(null);
  const [codeMsg, setCodeMsg] = useState('');
  const [codeBusy, setCodeBusy] = useState(false);
  // Remise globale accordée à la création (outil remise existant, appliqué juste après)
  const [discAmount, setDiscAmount] = useState('');
  const [discNote, setDiscNote] = useState('');

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
        const cat = await fetchProducts();
        if (!on) return;
        setCatalog(cat);
        const p = planReorder(order.order_items, cat);
        setRows(p.lines.map(l => ({ product_id: l.product_id, name: l.name, unit: l.unit, image_url: l.image_url, price: l.price ?? 0, old_price: l.old_price, status: l.status, product: l.product })));
        setQty(Object.fromEntries(p.lines.map(l => [l.product_id, l.quantity])));
      } catch { if (on) setFailed(true); }
    })();
    return () => { on = false; };
  }, [order]);

  const stockOf = (r: Row) => r.product ? Math.max(0, Number(r.product.stock_qty) || 0) : 0;
  const bump = (r: Row, d: number) => setQty(q => ({ ...q, [r.product_id]: Math.max(0, Math.min(stockOf(r), (q[r.product_id] || 0) + d)) }));

  // Recherche catalogue : produits disponibles, pas déjà dans la liste
  const matches = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s || !catalog || !rows) return [];
    const present = new Set(rows.map(r => r.product_id));
    return catalog.filter(p => !present.has(p.id) && Number(p.stock_qty) > 0 && String(p.name).toLowerCase().includes(s)).slice(0, 6);
  }, [search, catalog, rows]);
  const addProduct = (p: any) => {
    setRows(rs => [...(rs || []), { product_id: p.id, name: p.name, unit: String(p.unit || '').replace(/^\s*\/\s*/, ''), image_url: p.image_url || null, price: Number(p.price), old_price: null, status: 'ok', product: p }]);
    setQty(q => ({ ...q, [p.id]: 1 }));
    setSearch('');
  };

  const kept = useMemo(() => (rows || []).filter(r => r.product && (qty[r.product_id] || 0) > 0), [rows, qty]);
  const subtotal = kept.reduce((s, r) => s + r.price * (qty[r.product_id] || 0), 0);
  const opt = deliveryOpts.find(o => String(o.id) === form.option_id) || null;
  const disc = Math.max(0, parseInt(discAmount, 10) || 0);
  // Total estimé affiché en direct (le serveur reste seul juge des frais : seuil « offerte », code…)
  const promoCut = code?.benefit?.kind === 'percent' ? Math.round(subtotal * (Number(code.benefit.value) || 0) / 100)
    : code?.benefit?.kind === 'amount' ? Math.min(Number(code.benefit.value) || 0, subtotal)
    : 0;
  const freeDelivery = code?.benefit?.kind === 'free_delivery';
  const estTotal = Math.max(0, subtotal - promoCut - disc) + (freeDelivery ? 0 : (opt?.price || 0));

  const checkCode = async () => {
    const c = codeInput.trim().toUpperCase();
    if (c.length < 3) { setCodeMsg('⚠️ ' + t('checkout.code_invalid', 'Code invalide')); return; }
    setCodeBusy(true); setCodeMsg('');
    try {
      const tk = (await supabase.auth.getSession()).data.session?.access_token;
      const r = await fetch('/api/promo', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` },
        body: JSON.stringify({ code: c, phone: form.phone, items: kept.map(k => ({ product_id: k.product_id, quantity: qty[k.product_id], price: k.price })) }),
      });
      const j = await r.json();
      if (j.valid && j.kind === 'promo') {
        setCode({ code: c, benefit: j.promo });
        setCodeMsg('');
      } else {
        setCode(null);
        setCodeMsg('⚠️ ' + t('checkout.code_invalid', 'Code invalide') + (j.reason ? ` (${j.reason})` : ''));
      }
    } catch (e: any) { setCodeMsg('⚠️ ' + e.message); }
    finally { setCodeBusy(false); }
  };
  const codeLabel = (b: any) =>
    b?.kind === 'free_delivery' ? t('dup.code_free_delivery', 'livraison offerte')
      : b?.kind === 'percent' ? `−${b.value} %`
      : b?.kind === 'amount' ? `−${fdj(b.value)}`
      : '';

  const ERR: Record<string, string> = {
    stock_insufficient: t('dup.e_stock', 'Stock insuffisant pour certains articles — quantités mises à jour, vérifiez puis réessayez.'),
    delivery_option_invalid: t('dup.e_delivery', 'Choisissez une option de livraison.'),
    wallet_insufficient: t('dup.e_wallet', 'Cagnotte du client insuffisante.'),
    credit_unavailable: t('dup.e_credit', 'Carnet de crédit du client indisponible (plafond, retard ou compte inactif).'),
    credit_requires_account: t('dup.e_credit_acct', 'Le paiement par carnet exige un compte client.'),
    wallet_requires_account: t('dup.e_wallet_acct', 'Le paiement par cagnotte exige un compte client.'),
    empty_order: t('dup.e_empty', 'Aucun article à commander.'),
    on_behalf_unsupported: t('dup.e_unsupported', 'Mode non autorisé pour cette commande.'),
    promo_invalid: t('dup.e_promo', 'Le code n\'est plus utilisable — retirez-le ou vérifiez-le à nouveau.'),
  };

  const create = async () => {
    if (!kept.length) { setMsg('⚠️ ' + ERR.empty_order); return; }
    if (disc > 0 && !discNote.trim()) { setMsg('⚠️ ' + t('dup.e_disc_note', 'Indiquez le motif de la remise.')); return; }
    if (disc >= subtotal && disc > 0) { setMsg('⚠️ ' + t('dup.e_disc_amount', 'La remise doit rester inférieure au sous-total.')); return; }
    setBusy(true); setMsg('');
    try {
      const tk = (await supabase.auth.getSession()).data.session?.access_token;
      const items = kept.map(r => ({
        product_id: r.product_id, quantity: qty[r.product_id], price: r.price,
        product_name: r.product.name, product_image_url: r.product.image_url ?? null,
        product_unit: r.product.unit ?? null, product_farm: r.product.farm ?? null,
      }));
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` },
        body: JSON.stringify({
          on_behalf: true,
          copied_from: Number(order.id),
          promo_code: code?.code || undefined,
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
          setQty(q => { const n = { ...q }; for (const it of j.items) n[it.product_id] = Math.max(0, Number(it.available) || 0); return n; });
        }
        if (j.error === 'promo_invalid') setCode(null);
        setMsg('⚠️ ' + (ERR[j.error] || j.error || 'Erreur'));
        return;
      }
      // Remise globale : appliquée dans la foulée via l'outil remise (historisée, annulable)
      let discountWarn = '';
      if (disc > 0) {
        try {
          const dr = await fetch('/api/admin/orders/discount', {
            method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` },
            body: JSON.stringify({ order_id: j.order.id, mode: 'global', amount: disc, note: discNote.trim() }),
          });
          if (!dr.ok) {
            let detail = '';
            try {
              const dj = await dr.json();
              detail = dj.error === 'amount_too_high' ? t('admin.disc_e_too_high', 'La remise dépasse le montant des articles.')
                : dj.error === 'note_required' ? t('admin.disc_e_note', 'Indiquez le motif de la remise.')
                : String(dj.error || '');
            } catch {}
            discountWarn = ' — ' + t('dup.disc_failed', 'remise non appliquée : utilisez l\'outil remise sur la commande') + (detail ? ` (${detail})` : '');
          }
        } catch { discountWarn = ' — ' + t('dup.disc_failed', 'remise non appliquée : utilisez l\'outil remise sur la commande'); }
      }
      notice((discountWarn ? '⚠️ ' : '✅ ') + t('dup.done', 'Commande créée pour le client') + ` — #${j.order?.id ?? ''}` + discountWarn);
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
          : !rows ? <p className="p-10 text-center text-gray-400">⏳</p>
          : (
            <>
              <div className="overflow-y-auto p-3 space-y-2">
                {/* Lignes aux prix du jour, quantités ajustables */}
                {rows.map(r => {
                  const q = qty[r.product_id] || 0;
                  const dead = !r.product;
                  return (
                    <div key={r.product_id} className={`flex items-center gap-3 rounded-xl px-3 py-2 ${dead || q === 0 ? 'bg-gray-50 opacity-70' : 'bg-[#faf7e8]'}`}>
                      <div className="w-10 h-10 rounded-lg overflow-hidden flex-none bg-[#ecf4d5] flex items-center justify-center">
                        {r.image_url ? <img src={r.image_url} alt="" className="w-full h-full object-cover" /> : <span>🥬</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{r.name}{r.old_price === null && <span className="ml-1 text-[10px] text-[#526500] bg-[#ecf4d5] rounded-full px-1.5 py-0.5">{t('dup.added', 'ajouté')}</span>}</p>
                        <p className="text-xs text-gray-500">
                          {dead ? <span className={STATUS.unavailable.cls}>{STATUS.unavailable.text}</span>
                            : <>{fdj(r.price)} / {r.unit}{r.old_price !== null && r.price !== r.old_price && <span className="text-gray-400"> ({t('dup.old_price', 'avant')} {fdj(r.old_price)})</span>}
                              {r.status === 'reduced' && <span className={`ml-1 ${STATUS.reduced.cls}`}>{STATUS.reduced.text}</span>}</>}
                        </p>
                      </div>
                      {!dead && (
                        <div className="flex items-center gap-1 flex-none">
                          <button onClick={() => bump(r, -1)} disabled={q <= 0} className="w-7 h-7 rounded-lg border border-[#d2e095] text-[#526500] font-bold disabled:opacity-30">−</button>
                          <span className="w-10 text-center text-sm font-semibold">{q} <span className="text-[10px] font-normal text-gray-400">{r.unit}</span></span>
                          <button onClick={() => bump(r, +1)} disabled={q >= stockOf(r)} className="w-7 h-7 rounded-lg border border-[#d2e095] text-[#526500] font-bold disabled:opacity-30">+</button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Ajouter un article du catalogue */}
                <div className="relative">
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder={'➕ ' + t('dup.add_product', 'Ajouter un article (rechercher…)')}
                    className="w-full border border-dashed border-[#a8c800] rounded-xl px-3 py-2 text-sm bg-[#fdfcf7]" />
                  {matches.length > 0 && (
                    <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-[#d2e095] rounded-xl shadow-lg overflow-hidden">
                      {matches.map(p => (
                        <button key={p.id} onClick={() => addProduct(p)} className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[#ecf4d5]">
                          <span className="w-7 h-7 rounded-lg overflow-hidden bg-[#ecf4d5] flex-none flex items-center justify-center">
                            {p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover" /> : '🥬'}
                          </span>
                          <span className="text-sm text-gray-800 truncate flex-1">{p.name}</span>
                          <span className="text-xs text-gray-500 flex-none">{fdj(p.price)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

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

                {/* Code promo (facultatif) */}
                <div className="flex gap-2 items-center">
                  {code ? (
                    <div className="flex-1 flex items-center gap-2 bg-[#ecf4d5] border border-[#a8c800] rounded-xl px-3 py-2">
                      <span className="text-sm font-semibold text-[#526500]">🎁 {code.code}</span>
                      <span className="text-xs text-gray-600 flex-1">{codeLabel(code.benefit)}</span>
                      <button onClick={() => { setCode(null); setCodeInput(''); }} className="text-gray-400 hover:text-gray-600">✕</button>
                    </div>
                  ) : (
                    <>
                      <input value={codeInput} onChange={e => setCodeInput(e.target.value.toUpperCase())}
                        placeholder={'🎁 ' + t('dup.code', 'Code promo (facultatif)')}
                        className="flex-1 border border-[#d2e095] rounded-xl px-3 py-2 text-sm uppercase" />
                      <button onClick={checkCode} disabled={codeBusy || codeInput.trim().length < 3}
                        className="px-3 py-2 text-sm font-semibold text-[#526500] border border-[#d2e095] rounded-xl hover:bg-[#ecf4d5] disabled:opacity-40">
                        {codeBusy ? '⏳' : t('dup.code_check', 'Vérifier')}
                      </button>
                    </>
                  )}
                </div>
                {codeMsg && <p className="text-xs text-red-600">{codeMsg}</p>}

                {/* Remise globale (facultative, historisée) */}
                <div className="grid grid-cols-[110px_1fr] gap-2">
                  <input value={discAmount} onChange={e => setDiscAmount(e.target.value.replace(/\D/g, ''))} inputMode="numeric"
                    placeholder={'💸 ' + t('dup.disc_amount', 'Remise (Fdj)')}
                    className="border border-[#d2e095] rounded-xl px-3 py-2 text-sm" />
                  <input value={discNote} onChange={e => setDiscNote(e.target.value)}
                    placeholder={t('dup.disc_note', 'Motif de la remise (requis si remise)')}
                    className="border border-[#d2e095] rounded-xl px-3 py-2 text-sm" />
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

              <div className="p-4 border-t border-[#d2e095] space-y-1.5 bg-[#f8fdf0]">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t('admin.subtotal', 'Sous-total')} ({kept.length} {t('dup.items', 'article(s)')})</span>
                  <span className="font-semibold text-gray-800">{fdj(subtotal)}</span>
                </div>
                {code && <div className="flex justify-between text-xs text-[#526500]"><span>🎁 {code.code}</span><span>{promoCut > 0 ? `−${fdj(promoCut)}` : codeLabel(code.benefit)}</span></div>}
                {disc > 0 && <div className="flex justify-between text-xs text-[#526500]"><span>💸 {t('admin.disc_granted', 'Remise accordée')}</span><span>−{fdj(disc)}</span></div>}
                <div className="flex justify-between text-xs text-gray-500">
                  <span>🚚 {opt ? opt.name : '—'}</span>
                  <span>{freeDelivery ? t('dup.code_free_delivery', 'livraison offerte') : opt ? `+${fdj(opt.price)}` : '—'}</span>
                </div>
                <div className="flex justify-between text-sm border-t border-[#d2e095] pt-1.5">
                  <span className="font-semibold text-gray-700">{t('dup.est_total', 'Total estimé')}</span>
                  <span className="font-bold text-[#526500]">{fdj(estTotal)}</span>
                </div>
                <p className="text-[11px] text-gray-400">
                  {t('dup.fee_note', 'frais recalculés à la création (livraison offerte si seuil atteint)')}
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
