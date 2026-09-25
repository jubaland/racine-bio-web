'use client';

import { useMemo, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { FormField, inputClass, selectClass } from './Modal';

// Composition d'un panier : type (thématique / anti-gaspi), fin de validité, composants
// (produits Hornafresh publiés, non paniers) + chiffres en direct (valeur, coût, marge, disponibilité).
// Utilisé par le module « Paniers » (AdminBundles).

export type BundleLine = { product_id: number; quantity: number };
export type Composition = { bundle_kind: 'theme' | 'rescue'; bundle_ends_at: string; items: BundleLine[] };
export const EMPTY_COMPOSITION: Composition = { bundle_kind: 'theme', bundle_ends_at: '', items: [] };

export type Candidate = { id: number; name: string; unit: string; price: number; cost_price: number | null; stock_qty: number; status: string; owner_id?: string | null; is_bundle?: boolean };

export const LOW_STOCK = 5; // même seuil que les alertes de stock bas
const fdj = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} Fdj`;

/** Composants possibles d'un panier : produits Hornafresh publiés, non paniers. */
export const bundleCandidates = (products: Candidate[]) =>
  products.filter(p => !p.owner_id && !p.is_bundle && p.status === 'published').sort((a, b) => a.name.localeCompare(b.name));

/** Valeur catalogue, coût et nombre de paniers réalisables selon le stock des composants. */
export function bundleFigures(items: BundleLine[], byId: Record<number, Candidate>) {
  let value = 0, cost = 0, costKnown = false, possible = Infinity;
  for (const it of items) {
    const p = byId[it.product_id]; if (!p) { possible = 0; continue; }
    value += Number(p.price) * it.quantity;
    if (p.cost_price != null) { cost += Number(p.cost_price) * it.quantity; costKnown = true; }
    possible = Math.min(possible, Math.floor((Number(p.stock_qty) || 0) / it.quantity));
  }
  return { value, cost: costKnown ? cost : null, possible: items.length ? possible : 0 };
}

export default function BundleComposer({ value, onChange, products, price, stockQty }: {
  value: Composition; onChange: (v: Composition) => void;
  products: Candidate[];           // catalogue admin complet (filtré ici)
  price: string; stockQty: string; // prix et nombre de paniers saisis (aperçu)
}) {
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;
  const [pick, setPick] = useState('');
  const [qty, setQty] = useState('1');

  const candidates = useMemo(() => bundleCandidates(products), [products]);
  const byId = useMemo(() => Object.fromEntries(candidates.map(p => [p.id, p])) as Record<number, Candidate>, [candidates]);
  const set = (patch: Partial<Composition>) => onChange({ ...value, ...patch });

  const add = (id: number, q: number) => {
    if (!id || !(q > 0)) return;
    set({ items: value.items.filter(i => i.product_id !== id).concat({ product_id: id, quantity: q }) });
    setPick(''); setQty('1');
  };
  const suggestLowStock = () => {
    const low = candidates.filter(p => (p.stock_qty ?? 0) > 0 && p.stock_qty <= LOW_STOCK && !value.items.some(i => i.product_id === p.id));
    set({ items: value.items.concat(low.map(p => ({ product_id: p.id, quantity: 1 }))) });
  };

  const fig = bundleFigures(value.items, byId);
  const priceNum = parseFloat(price) || 0;
  const saving = fig.value > priceNum && priceNum > 0 ? Math.round((1 - priceNum / fig.value) * 100) : 0;
  const available = Math.min(parseFloat(stockQty) || 0, fig.possible);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label={t('admin.bundle_kind', 'Type de panier')}>
          <select value={value.bundle_kind} onChange={e => set({ bundle_kind: e.target.value as 'theme' | 'rescue' })} className={selectClass}>
            <option value="theme">🧺 {t('admin.bundle_kind_theme', 'Thématique (panier de la semaine, recette…)')}</option>
            <option value="rescue">♻️ {t('admin.bundle_kind_rescue', 'Anti-gaspi (articles à écouler)')}</option>
          </select>
        </FormField>
        <FormField label={value.bundle_kind === 'rescue' ? t('admin.bundle_ends_at_req', 'Fin de validité *') : t('admin.bundle_ends_at', 'Fin de validité (optionnel)')}>
          <input type="datetime-local" value={value.bundle_ends_at} onChange={e => set({ bundle_ends_at: e.target.value })} className={inputClass} />
          <p className="text-[11px] text-gray-400 mt-1">{t('admin.bundle_ends_hint', 'Passé cette date, le panier disparaît du site et n\'est plus commandable (archivé automatiquement).')}</p>
        </FormField>
      </div>

      <div className="border border-[#d2e095] rounded-2xl p-4 bg-[#fafff0]">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{t('admin.bundle_components', 'Composition')} ({value.items.length})</p>
          <button type="button" onClick={suggestLowStock} className="text-xs font-semibold text-[#c2410c] border border-[#fdba74] bg-white rounded-lg px-2.5 py-1 hover:bg-[#fff7ed]">
            ♻️ {t('admin.bundle_suggest', 'Ajouter les stocks faibles')} (≤ {LOW_STOCK})
          </button>
        </div>
        {value.items.length === 0 ? (
          <p className="text-xs text-gray-400 mb-2">{t('admin.bundle_no_components', 'Aucun composant : ajoutez au moins un produit.')}</p>
        ) : (
          <ul className="space-y-1.5 mb-2">
            {value.items.map(it => {
              const p = byId[it.product_id];
              const short = p && (p.stock_qty ?? 0) < it.quantity;
              return (
                <li key={it.product_id} className="flex items-center gap-2 bg-white border border-[#e8f0d0] rounded-xl px-3 py-2">
                  <input type="number" min="0.1" step="0.1" value={it.quantity}
                    onChange={e => set({ items: value.items.map(x => x.product_id === it.product_id ? { ...x, quantity: parseFloat(e.target.value) || 0 } : x) })}
                    className="w-16 flex-none border border-[#d2e095] rounded-lg px-2 py-1 text-sm" />
                  <span className="text-xs text-gray-500 w-12 flex-none truncate">{p?.unit || ''}</span>
                  <span className="flex-1 min-w-0 text-sm text-gray-800 truncate">{p?.name || `#${it.product_id}`}</span>
                  <span className={`text-[11px] whitespace-nowrap ${short ? 'text-[#f97316] font-semibold' : 'text-gray-400'}`}>{t('admin.col_stock', 'Stock')} {p?.stock_qty ?? '?'}</span>
                  <button type="button" onClick={() => set({ items: value.items.filter(x => x.product_id !== it.product_id) })} className="text-gray-400 hover:text-[#f97316] text-lg leading-none" title={t('admin.delete', 'Supprimer')}>×</button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex gap-2">
          <select value={pick} onChange={e => setPick(e.target.value)} className={selectClass + ' flex-1 min-w-0'}>
            <option value="">{t('admin.bundle_add', '— Ajouter un produit —')}</option>
            {candidates.filter(p => !value.items.some(i => i.product_id === p.id)).map(p => (
              <option key={p.id} value={p.id}>{p.name} · {fdj(Number(p.price))}/{p.unit} · {t('admin.col_stock', 'Stock')} {p.stock_qty}</option>
            ))}
          </select>
          <input type="number" min="0.1" step="0.1" value={qty} onChange={e => setQty(e.target.value)} className={inputClass + ' !w-20 flex-none'} placeholder={t('admin.bundle_qty', 'Qté')} />
          <button type="button" onClick={() => add(Number(pick), parseFloat(qty))} disabled={!pick} className="px-3 py-2 bg-[#526500] text-white rounded-xl text-sm font-semibold disabled:opacity-40">+</button>
        </div>
      </div>

      {value.items.length > 0 && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-white rounded-xl border border-[#e8f0d0] p-2">
            <p className="text-[11px] text-gray-400">{t('admin.bundle_value', 'Valeur des articles')}</p>
            <p className="text-sm font-bold text-gray-700">{fdj(fig.value)}</p>
            {saving > 0 && <p className="text-[11px] font-semibold text-[#f97316]">-{saving}% {t('admin.bundle_vs_price', 'vs prix panier')}</p>}
          </div>
          <div className="bg-white rounded-xl border border-[#e8f0d0] p-2">
            <p className="text-[11px] text-gray-400">{t('admin.bundle_cost', 'Coût (auto)')}</p>
            <p className="text-sm font-bold text-gray-700">{fig.cost != null ? fdj(fig.cost) : '—'}</p>
            {fig.cost != null && priceNum > 0 && <p className="text-[11px] text-gray-400">{t('admin.bundle_margin', 'Marge')} {fdj(priceNum - fig.cost)}</p>}
          </div>
          <div className="bg-white rounded-xl border border-[#e8f0d0] p-2">
            <p className="text-[11px] text-gray-400">{t('admin.bundle_possible', 'Paniers disponibles')}</p>
            <p className={`text-sm font-bold ${available <= 0 ? 'text-[#f97316]' : 'text-gray-700'}`}>{available}</p>
            <p className="text-[11px] text-gray-400">{t('admin.bundle_possible_hint', 'min(stock, composants)')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
