'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../context/LanguageContext';
import ImagesField from '../ImagesField';
import BundleMosaic from '../BundleMosaic';
import Modal, { ConfirmDelete, FormField, inputClass, selectClass } from './Modal';
import BundleComposer, { EMPTY_COMPOSITION, bundleFigures, bundleCandidates, LOW_STOCK, type Composition, type Candidate } from './BundleComposer';

// Module « Paniers » (onglet du module Produits) : liste des paniers composés + création / édition
// dans un formulaire dédié. Un panier est un produit Hornafresh (is_bundle) : les champs
// techniques du produit sont remplis automatiquement ; la composition vit dans bundle_items.

type Bundle = Candidate & { bundle_kind?: 'theme' | 'rescue' | null; bundle_ends_at?: string | null; image_url?: string | null; images?: string[] | null; description?: string | null };
type Line = { bundle_id: number; product_id: number; quantity: number; sort_order: number };

const toLocalInput = (iso: string | null | undefined) => { if (!iso) return ''; const d = new Date(iso); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const fromLocalInput = (v: string) => v ? new Date(v).toISOString() : null;
const fdj = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} Fdj`;
const fmtUntil = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const EMPTY_FORM = { name: '', price: '', stock_qty: '', description: '', images: [] as string[], status: 'published' };

export default function AdminBundles({ products, refresh, can, initialProduct, onInitialConsumed }: {
  products: Bundle[];                 // catalogue admin complet
  refresh: () => void;                // recharge le catalogue après une écriture
  can: (module: string, action: string) => boolean;
  initialProduct?: number | null;     // « Nouveau panier avec ce produit » depuis la liste Produits
  onInitialConsumed?: () => void;
}) {
  const { ui, currentLang } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;
  const LOCALE: Record<string, string> = { fr: 'fr-FR', en: 'en-GB', zh: 'zh-CN', am: 'am-ET', so: 'so-SO', aa: 'fr-FR' }; // date du nom par défaut dans la langue de l'admin
  const [lines, setLines] = useState<Line[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [comp, setComp] = useState<Composition>(EMPTY_COMPOSITION);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const bundles = useMemo(() => products.filter(p => p.is_bundle).sort((a, b) => (a.bundle_kind === 'rescue' ? 0 : 1) - (b.bundle_kind === 'rescue' ? 0 : 1) || a.name.localeCompare(b.name)), [products]);
  const byId = useMemo(() => Object.fromEntries(bundleCandidates(products).map(p => [p.id, p])) as Record<number, Candidate>, [products]);
  const itemsOf = (bundleId: number) => lines.filter(l => l.bundle_id === bundleId).sort((a, b) => a.sort_order - b.sort_order).map(l => ({ product_id: l.product_id, quantity: Number(l.quantity) }));

  // Composition de tous les paniers (une requête)
  useEffect(() => {
    const ids = bundles.map(b => b.id);
    if (!ids.length) { setLines([]); return; }
    supabase.from('bundle_items').select('bundle_id, product_id, quantity, sort_order').in('bundle_id', ids).then(({ data }) => setLines((data || []) as Line[]));
  }, [bundles]);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const defaultEnd = () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(20, 0, 0, 0); return toLocalInput(d.toISOString()); };

  const openCreate = (preset?: Partial<Composition>, name = '') => {
    setEditingId(null); setForm({ ...EMPTY_FORM, name }); setComp({ ...EMPTY_COMPOSITION, ...preset }); setError(''); setShowModal(true);
  };
  const openRescue = () => {
    const low = bundleCandidates(products).filter(p => (p.stock_qty ?? 0) > 0 && p.stock_qty <= LOW_STOCK).map(p => ({ product_id: p.id, quantity: 1 }));
    const day = new Date().toLocaleDateString(LOCALE[currentLang] || 'fr-FR', { day: 'numeric', month: 'long' });
    openCreate({ bundle_kind: 'rescue', bundle_ends_at: defaultEnd(), items: low }, `${t('admin.bundle_rescue_name', 'Panier anti-gaspi du')} ${day}`);
  };
  const openEdit = (b: Bundle) => {
    setEditingId(b.id);
    setForm({ name: b.name, price: String(b.price), stock_qty: String(b.stock_qty ?? 0), description: b.description ?? '', images: Array.isArray(b.images) && b.images.length ? b.images : (b.image_url ? [b.image_url] : []), status: b.status });
    setComp({ bundle_kind: b.bundle_kind || 'theme', bundle_ends_at: toLocalInput(b.bundle_ends_at), items: itemsOf(b.id) });
    setError(''); setShowModal(true);
  };

  // « Nouveau panier avec ce produit » (depuis la liste Produits)
  useEffect(() => {
    if (!initialProduct) return;
    openCreate({ items: [{ product_id: initialProduct, quantity: 1 }] });
    onInitialConsumed?.();
  }, [initialProduct]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    const items = comp.items.filter(i => i.quantity > 0);
    if (!form.name.trim() || !form.price) { setError(t('admin.bundle_err_name_price', 'Nom et prix du panier sont requis.')); return; }
    if (!items.length) { setError(t('admin.bundle_err_components', 'Un panier doit contenir au moins un composant.')); return; }
    if (comp.bundle_kind === 'rescue' && !comp.bundle_ends_at) { setError(t('admin.bundle_err_ends', 'Un panier anti-gaspi doit avoir une date de fin.')); return; }
    setSaving(true); setError('');
    const fig = bundleFigures(items, byId);
    // Champs techniques d'un produit remplis automatiquement (un panier est un produit Hornafresh)
    const payload: any = {
      name: form.name.trim(), price: parseFloat(form.price), stock_qty: form.stock_qty !== '' ? parseFloat(form.stock_qty) : 0,
      description: form.description.trim() || null, images: form.images, image_url: form.images[0] || null, status: form.status,
      is_bundle: true, bundle_kind: comp.bundle_kind, bundle_ends_at: fromLocalInput(comp.bundle_ends_at), cost_price: fig.cost,
      unit: 'panier', in_stock: true,
      ...(editingId ? {} : { farm: 'Hornafresh', category: '', product_type: 'conventionnel', origin_country: 'DJ', region: 'Djibouti', is_local: false, bg_color: '#ecf4d5' }),
    };
    const { data: saved, error: err } = editingId
      ? await supabase.from('products').update(payload).eq('id', editingId).select('id').single()
      : await supabase.from('products').insert(payload).select('id').single();
    if (err || !saved) { setError(err?.message || 'Erreur'); setSaving(false); return; }
    // Composition remplacée intégralement (simple et idempotent)
    const { error: delErr } = await supabase.from('bundle_items').delete().eq('bundle_id', saved.id);
    if (delErr) { setError(delErr.message); setSaving(false); return; }
    const { error: biErr } = await supabase.from('bundle_items').insert(items.map((it, i) => ({ bundle_id: saved.id, product_id: it.product_id, quantity: it.quantity, sort_order: i })));
    if (biErr) { setError(biErr.message); setSaving(false); return; }
    setSaving(false); setShowModal(false); refresh();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true); setError('');
    await supabase.from('product_translations').delete().eq('product_id', deleteId);
    const { error: delErr } = await supabase.from('products').delete().eq('id', deleteId); // bundle_items : cascade
    setDeleting(false);
    if (delErr) { setError(delErr.message.includes('order_items') ? t('admin.delete_err_order', 'Ce produit figure dans des commandes : impossible de le supprimer. Passez plutôt son statut à « Archivé ».') : delErr.message); return; }
    setDeleteId(null); refresh();
  };

  const setStatus = async (b: Bundle, status: string) => { await supabase.from('products').update({ status }).eq('id', b.id); refresh(); };

  const stateOf = (b: Bundle) => {
    const now = Date.now();
    if (b.status !== 'published') return { key: b.status, label: b.status === 'draft' ? t('admin.status_draft', '📝 Brouillon') : t('admin.status_archived', '📦 Archivé'), cls: 'bg-gray-100 text-gray-500' };
    if (b.bundle_ends_at && new Date(b.bundle_ends_at).getTime() <= now) return { key: 'expired', label: t('admin.bundle_state_expired', '⏰ Expiré'), cls: 'bg-gray-100 text-gray-500' };
    const fig = bundleFigures(itemsOf(b.id), byId);
    const available = Math.min(Number(b.stock_qty) || 0, fig.possible);
    if (available <= 0) return { key: 'out', label: fig.possible <= 0 ? t('admin.bundle_state_blocked', '⛔ Composant en rupture') : t('admin.bundle_state_soldout', '⛔ Épuisé'), cls: 'bg-orange-100 text-[#f97316]' };
    return { key: 'ok', label: `✓ ${available} ${t('admin.bundle_state_available', 'disponible(s)')}`, cls: available <= LOW_STOCK ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-700' };
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <p className="text-sm text-gray-500 max-w-xl">{t('admin.bundles_intro', 'Un panier regroupe plusieurs produits Hornafresh à un prix unique. À la commande, le stock de chaque composant est décrémenté ; la disponibilité affichée tient compte du nombre de paniers et du stock des composants.')}</p>
        {can('products', 'create') && (
          <div className="flex flex-wrap gap-2">
            <button onClick={openRescue} className="border border-[#fdba74] text-[#c2410c] bg-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#fff7ed] transition">♻️ {t('admin.bundles_rescue_express', 'Panier anti-gaspi express')}</button>
            <button onClick={() => openCreate()} className="bg-[#a8c800] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#7d9800] transition">🧺 {t('admin.bundles_create', '+ Créer un panier')}</button>
          </div>
        )}
      </div>

      {bundles.length === 0 ? (
        <div className="text-center py-12 text-gray-400 bg-white rounded-2xl border border-[#d2e095]">{t('admin.bundles_empty', 'Aucun panier pour le moment. Créez un panier thématique ou un panier anti-gaspi à partir des stocks faibles.')}</div>
      ) : (
        <div className="grid gap-3">
          {bundles.map(b => {
            const st = stateOf(b);
            const items = itemsOf(b.id);
            const fig = bundleFigures(items, byId);
            const saving = fig.value > Number(b.price) ? Math.round((1 - Number(b.price) / fig.value) * 100) : 0;
            return (
              <div key={b.id} className={`bg-white rounded-2xl border p-4 flex flex-wrap items-start gap-4 ${b.bundle_kind === 'rescue' ? 'border-[#fdba74]' : 'border-[#d2e095]'}`}>
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#ecf4d5] flex-none">
                  {b.image_url ? <img src={b.image_url} alt={b.name} className="w-full h-full object-cover" /> : <BundleMosaic items={items.map(it => byId[it.product_id]).filter(Boolean)} />}
                </div>
                <div className="flex-1 min-w-0 basis-full sm:basis-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <p className="font-semibold text-gray-800">{b.name}</p>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${b.bundle_kind === 'rescue' ? 'bg-orange-100 text-[#c2410c]' : 'bg-[#ecf4d5] text-[#526500]'}`}>{b.bundle_kind === 'rescue' ? `♻️ ${t('bundle.tag_rescue', 'Anti-gaspi')}` : `🧺 ${t('bundle.tag_theme', 'Panier')}`}</span>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                  </div>
                  <p className="text-xs text-gray-500">{items.map(it => `${it.quantity} ${byId[it.product_id]?.unit || ''} ${byId[it.product_id]?.name || `#${it.product_id}`}`.replace(/\s+/g, ' ').trim()).join(' · ') || t('admin.bundle_no_components', 'Aucun composant')}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    <span className="font-bold text-[#526500] text-sm">{fdj(Number(b.price))}</span>
                    {saving > 0 && <> · <span className="line-through">{fdj(fig.value)}</span> <span className="text-[#f97316] font-semibold">-{saving}%</span></>}
                    {fig.cost != null && <> · {t('admin.bundle_margin', 'Marge')} {fdj(Number(b.price) - fig.cost)}</>}
                    {' · '}{Number(b.stock_qty) || 0} {t('admin.bundle_stock_short', 'panier(s) en stock')}
                    {b.bundle_ends_at && <> · ⏰ {fmtUntil(b.bundle_ends_at)}</>}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 flex-none">
                  {can('products', 'edit') && b.status === 'published' && <button onClick={() => setStatus(b, 'archived')} className="text-xs text-gray-400 hover:text-gray-600 font-medium">{t('admin.bundle_archive', 'Archiver')}</button>}
                  {can('products', 'edit') && b.status !== 'published' && <button onClick={() => setStatus(b, 'published')} className="text-xs text-[#7d9800] hover:text-[#526500] font-medium">{t('admin.bundle_publish', 'Publier')}</button>}
                  {can('products', 'edit') && <button onClick={() => openEdit(b)} className="text-[#7d9800] hover:text-[#526500] text-xs font-medium">{t('admin.edit', 'Modifier')}</button>}
                  {can('products', 'delete') && <button onClick={() => { setError(''); setDeleteId(b.id); }} className="text-orange-400 hover:text-[#f97316] text-xs font-medium">{t('admin.delete', 'Supprimer')}</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <Modal title={editingId ? t('admin.bundle_edit_title', 'Modifier le panier') : t('admin.bundle_add_title', 'Créer un panier')} onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <FormField label={t('admin.bundle_name', 'Nom du panier *')}>
              <input value={form.name} onChange={e => set('name', e.target.value)} className={inputClass} placeholder={t('admin.bundle_name_ph', 'Ex : Panier soupe de la semaine')} />
            </FormField>

            <BundleComposer value={comp} onChange={setComp} products={products} price={form.price} stockQty={form.stock_qty} />

            <div className="grid grid-cols-2 gap-3">
              <FormField label={t('admin.bundle_price', 'Prix du panier (Fdj) *')}>
                <input type="number" value={form.price} onChange={e => set('price', e.target.value)} className={inputClass} placeholder="Ex : 1500" />
              </FormField>
              <FormField label={t('admin.bundle_stock', 'Nombre de paniers *')}>
                <input type="number" min="0" step="1" value={form.stock_qty} onChange={e => set('stock_qty', e.target.value)} className={inputClass} placeholder="Ex : 10" />
              </FormField>
            </div>

            <FormField label={t('admin.field_images', 'Photos')}>
              <ImagesField value={form.images} onChange={imgs => set('images', imgs)} pathPrefix="hf" onError={setError} />
              <p className="text-[11px] text-gray-400 mt-1">{t('admin.bundle_photo_hint', 'Facultatif : sans photo, le site affiche une mosaïque des photos des composants.')}</p>
            </FormField>

            <FormField label={t('admin.field_description', 'Description')}>
              <textarea value={form.description} onChange={e => set('description', e.target.value)} className={inputClass + ' h-20 resize-none'} placeholder={t('admin.bundle_desc_ph', 'Ex : De quoi préparer une soupe pour 4 personnes')} />
            </FormField>

            <FormField label={t('admin.field_status', 'Statut')}>
              <select value={form.status} onChange={e => set('status', e.target.value)} className={selectClass}>
                <option value="published">✅ {t('admin.status_published', 'Publié')}</option>
                <option value="draft">📝 {t('admin.status_draft_plain', 'Brouillon')}</option>
                <option value="archived">📦 {t('admin.status_archived_plain', 'Archivé')}</option>
              </select>
            </FormField>

            {error && <div className="bg-orange-50 text-[#f97316] text-sm px-4 py-3 rounded-xl">{error}</div>}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition">{t('admin.cancel', 'Annuler')}</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-3 bg-[#a8c800] text-white rounded-xl text-sm font-semibold hover:bg-[#7d9800] transition disabled:opacity-50">
                {saving ? t('admin.saving', 'Enregistrement...') : editingId ? t('admin.edit', 'Modifier') : t('admin.bundles_create_short', 'Créer le panier')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleteId && <ConfirmDelete onConfirm={handleDelete} onCancel={() => { setDeleteId(null); setError(''); }} loading={deleting} error={error} />}
    </div>
  );
}
