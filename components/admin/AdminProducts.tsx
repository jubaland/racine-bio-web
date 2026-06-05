'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../context/LanguageContext';
import Modal, { ConfirmDelete, FormField, inputClass, selectClass } from './Modal';

interface Product {
  id: number;
  name: string;
  price: number;
  old_price: number | null;
  stock_qty: number;
  unit: string;
  farm: string;
  category: string;
  product_type: string;
  origin_country: string;
  image_url: string | null;
  description: string;
  is_local: boolean;
  region: string;
  emoji: string | null;
  bg_color: string | null;
  tag: string | null;
  tag_label: string | null;
  rating: number | null;
  reviews_count: number | null;
  badges: string[] | null;
  in_stock: boolean;
  status: string;
  producer_account_id: string | null;
  is_featured: boolean;
  featured_badge: string | null;
  created_at: string;
}

const EMPTY_FORM = {
  name: '', price: '', old_price: '', unit: 'kg', farm: '', category: '',
  product_type: 'bio', origin_country: 'DJ', image_url: '', description: '',
  is_local: true, region: '', emoji: '', bg_color: '#ecf4d5', tag: '', tag_label: '',
  rating: '', reviews_count: '', badges: '', in_stock: true, status: 'published',
  producer_account_id: '', is_featured: false, featured_badge: '', stock_qty: '',
};

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [producers, setProducers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: prods }, { data: cats }, { data: prodrs }] = await Promise.all([
      supabase.from('products').select('*').order('created_at', { ascending: false }),
      supabase.from('categories').select('*').order('id'),
      supabase.from('producers').select('id, name').order('name'),
    ]);
    setProducts(prods || []);
    setCategories(cats || []);
    setProducers(prodrs || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openAdd = () => { setEditingId(null); setForm(EMPTY_FORM); setError(''); setShowModal(true); };

  const openEdit = (p: Product) => {
    setEditingId(p.id);
    setForm({
      name: p.name ?? '', price: String(p.price), old_price: String(p.old_price ?? ''),
      unit: p.unit ?? '', farm: p.farm ?? '', category: p.category ?? '', product_type: p.product_type ?? 'bio',
      origin_country: p.origin_country ?? '', image_url: p.image_url ?? '',
      description: p.description ?? '', is_local: p.is_local, region: p.region ?? '',
      emoji: p.emoji ?? '', bg_color: p.bg_color ?? '#ecf4d5',
      tag: p.tag ?? '', tag_label: p.tag_label ?? '',
      rating: String(p.rating ?? ''), reviews_count: String(p.reviews_count ?? ''),
      badges: (p.badges ?? []).join(', '),
      in_stock: p.in_stock, status: p.status ?? 'published',
      producer_account_id: p.producer_account_id ?? '',
      is_featured: p.is_featured ?? false, featured_badge: p.featured_badge ?? '',
      stock_qty: String(p.stock_qty ?? 0),
    });
    setError('');
    setShowModal(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    const ext = file.name.split('.').pop();
    const path = `${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from('product-images').upload(path, file, { upsert: true });
    if (uploadErr) { setError(uploadErr.message); setUploading(false); return; }
    const { data } = supabase.storage.from('product-images').getPublicUrl(path);
    set('image_url', data.publicUrl);
    setUploading(false);
  };

  const handleSave = async () => {
    if (!form.name || !form.price || !form.unit) {
      setError(t('admin.error_products', 'Nom, prix et unité sont requis.'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const s = (v: any) => (v ?? '').toString().trim();
      const badgesArr = s(form.badges)
        ? s(form.badges).split(',').map((b: string) => b.trim()).filter(Boolean)
        : null;
      const payload = {
        name: s(form.name), price: parseFloat(form.price),
        old_price: form.old_price ? parseFloat(form.old_price) : null,
        unit: s(form.unit), farm: s(form.farm), category: s(form.category),
        product_type: form.product_type, origin_country: s(form.origin_country),
        image_url: s(form.image_url) || null, description: s(form.description),
        is_local: form.is_local, region: s(form.region),
        emoji: s(form.emoji) || null, bg_color: form.bg_color || null,
        tag: s(form.tag) || null, tag_label: s(form.tag_label) || null,
        rating: form.rating ? parseFloat(form.rating) : null,
        reviews_count: form.reviews_count ? parseInt(form.reviews_count) : null,
        badges: badgesArr,
        in_stock: form.in_stock, status: form.status,
        producer_account_id: s(form.producer_account_id) || null,
        is_featured: form.is_featured,
        featured_badge: s(form.featured_badge) || null,
        stock_qty: form.stock_qty !== '' ? parseFloat(form.stock_qty) : 0,
      };
      const { error: err } = editingId
        ? await supabase.from('products').update(payload).eq('id', editingId)
        : await supabase.from('products').insert(payload);
      if (err) { setError(err.message); setSaving(false); return; }
      setSaving(false);
      setShowModal(false);
      fetchAll();
    } catch (e: any) {
      setError(e?.message || 'Erreur inattendue');
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    setError('');
    // Nettoyer les dépendances : traductions (appartiennent au produit) et
    // délier les promos qui le ciblent (promos.product_id n'est pas utilisé à l'affichage).
    await supabase.from('product_translations').delete().eq('product_id', deleteId);
    await supabase.from('promos').update({ product_id: null }).eq('product_id', deleteId);
    const { data: deleted, error: delErr } = await supabase
      .from('products').delete().eq('id', deleteId).select('id');
    setDeleting(false);
    if (delErr) {
      setError(
        delErr.message.includes('order_items')
          ? t('admin.delete_err_order', 'Ce produit figure dans des commandes : impossible de le supprimer. Passez plutôt son statut à « Archivé ».')
          : t('admin.delete_err', 'Suppression impossible : ') + delErr.message
      );
      return;
    }
    if (!deleted || deleted.length === 0) {
      setError(t('admin.delete_blocked', 'Suppression bloquée : aucune ligne supprimée (permissions ou dépendance).'));
      return;
    }
    setDeleteId(null);
    fetchAll();
  };

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const filtered = products.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.name.toLowerCase().includes(q) || p.farm.toLowerCase().includes(q);
    const matchCat = !filterCategory || p.category === filterCategory;
    return matchSearch && matchCat;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">🥬 {t('admin.nav_products', 'Produits')}</h1>
        <button onClick={openAdd} className="bg-[#a8c800] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#7d9800] transition">
          {t('admin.add', '+ Ajouter')}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder={t('admin.products_search', '🔍 Rechercher par nom ou ferme...')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={inputClass + ' flex-1'}
        />
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className={selectClass + ' sm:w-48'}>
          <option value="">{t('admin.products_all_cats', 'Toutes catégories')}</option>
          {categories.map(c => <option key={c.id} value={c.slug}>{c.emoji} {c.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><p className="text-gray-400">{t('admin.loading', 'Chargement...')}</p></div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#d2e095] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#faf7e8] border-b border-[#d2e095]">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">{t('admin.col_product', 'Produit')}</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">{t('admin.col_price', 'Prix')}</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">{t('admin.col_farm', 'Ferme')}</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">{t('admin.col_category', 'Catégorie')}</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">{t('admin.col_type', 'Type')}</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">{t('admin.col_stock', 'Stock')}</th>
                  <th className="text-right px-4 py-3 text-gray-500 font-medium">{t('admin.actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-gray-400">{t('admin.products_no_results', 'Aucun produit trouvé')}</td></tr>
                ) : filtered.map(p => (
                  <tr key={p.id} className="hover:bg-[#faf7e8] transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name} className="w-10 h-10 rounded-lg object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-[#ecf4d5] flex items-center justify-center text-xl">🥬</div>
                        )}
                        <div>
                          <p className="font-medium text-gray-800">{p.name} {p.is_featured && <span className="text-amber-400 text-xs">⭐</span>}</p>
                          <p className="text-xs text-gray-400">{p.origin_country} · {p.unit}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#526500]">{Number(p.price).toLocaleString()} Fdj</p>
                      {p.old_price && <p className="text-xs text-gray-400 line-through">{Number(p.old_price).toLocaleString()}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p.farm}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-[#ecf4d5] text-[#526500] rounded-full text-xs">{p.category || '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${p.product_type === 'bio' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'}`}>
                        {p.product_type === 'bio' ? t('admin.type_bio', '🌿 Bio') : t('admin.type_conv', '🌾 Conv.')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {(p.stock_qty ?? 0) <= 0 ? (
                        <span className="px-2 py-1 bg-orange-100 text-[#f97316] rounded-full text-xs">Rupture</span>
                      ) : (p.stock_qty ?? 0) <= 5 ? (
                        <span className="px-2 py-1 bg-orange-100 text-orange-600 rounded-full text-xs">⚠️ {p.stock_qty} {p.unit}</span>
                      ) : (
                        <span className="px-2 py-1 bg-green-50 text-green-700 rounded-full text-xs">✓ {p.stock_qty} {p.unit}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEdit(p)} className="text-[#7d9800] hover:text-[#526500] text-xs font-medium mr-3">{t('admin.edit', 'Modifier')}</button>
                      <button onClick={() => { setError(''); setDeleteId(p.id); }} className="text-orange-400 hover:text-[#f97316] text-xs font-medium">{t('admin.delete', 'Supprimer')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-50 text-xs text-gray-400">
            {filtered.length} {t('admin.nav_products', 'produits').toLowerCase()}
          </div>
        </div>
      )}

      {showModal && (
        <Modal
          title={editingId ? t('admin.products_edit_title', 'Modifier le produit') : t('admin.products_add_title', 'Ajouter un produit')}
          onClose={() => setShowModal(false)}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <FormField label={t('admin.field_product_name', 'Nom du produit *')}>
                  <input value={form.name} onChange={e => set('name', e.target.value)} className={inputClass} placeholder="ex: Tomates cerises" />
                </FormField>
              </div>
              <FormField label={t('admin.field_price', 'Prix (Fdj) *')}>
                <input type="number" value={form.price} onChange={e => set('price', e.target.value)} className={inputClass} placeholder="500" />
              </FormField>
              <FormField label={t('admin.field_old_price', 'Ancien prix (Fdj)')}>
                <input type="number" value={form.old_price} onChange={e => set('old_price', e.target.value)} className={inputClass} placeholder="600" />
              </FormField>
              <div className="col-span-2">
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                  <p className="text-xs font-semibold text-blue-700 mb-2">📦 Gestion du stock</p>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label={t('admin.field_stock_qty', 'Quantité en stock *')}>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={form.stock_qty}
                        onChange={e => set('stock_qty', e.target.value)}
                        className={inputClass}
                        placeholder="0"
                      />
                    </FormField>
                    <FormField label={t('admin.field_unit', 'Unité (stock = prix) *')}>
                      <input value={form.unit} onChange={e => set('unit', e.target.value)} className={inputClass} placeholder="kg, L, boîte..." />
                    </FormField>
                  </div>
                  <p className="text-xs text-blue-500 mt-2">
                    Le stock est géré dans la même unité que le prix. Ex&nbsp;: 50 kg → les clients commandent en kg, le stock décrémente en kg.
                  </p>
                </div>
              </div>
              <FormField label={t('admin.field_farm', 'Ferme / Producteur *')}>
                <input value={form.farm} onChange={e => set('farm', e.target.value)} className={inputClass} placeholder="Ferme Abdi" />
              </FormField>
              <FormField label={t('admin.col_category', 'Catégorie')}>
                <select value={form.category} onChange={e => set('category', e.target.value)} className={selectClass}>
                  <option value="">{t('admin.no_category', '— Sans catégorie —')}</option>
                  {categories.map(c => <option key={c.id} value={c.slug}>{c.emoji} {c.label}</option>)}
                </select>
              </FormField>
              <FormField label={t('admin.col_type', 'Type')}>
                <select value={form.product_type} onChange={e => set('product_type', e.target.value)} className={selectClass}>
                  <option value="bio">{t('admin.type_bio', '🌿 Bio')}</option>
                  <option value="conventionnel">{t('admin.type_conv', '🌾 Conventionnel')}</option>
                </select>
              </FormField>
              <FormField label={t('admin.field_origin', "Pays d'origine")}>
                <input value={form.origin_country} onChange={e => set('origin_country', e.target.value)} className={inputClass} placeholder="DJ" />
              </FormField>
              <FormField label={t('admin.col_region', 'Région')}>
                <input value={form.region} onChange={e => set('region', e.target.value)} className={inputClass} placeholder="Ali Sabieh..." />
              </FormField>
              <FormField label={t('admin.field_emoji', 'Emoji')}>
                <input value={form.emoji} onChange={e => set('emoji', e.target.value)} className={inputClass} placeholder="🍅" />
              </FormField>
              <FormField label={t('admin.field_bg_color', 'Couleur fond')}>
                <div className="flex gap-2">
                  <input type="color" value={form.bg_color} onChange={e => set('bg_color', e.target.value)} className="h-10 w-14 rounded-lg border border-[#d2e095] cursor-pointer p-1" />
                  <input value={form.bg_color} onChange={e => set('bg_color', e.target.value)} className={inputClass + ' flex-1'} placeholder="#ecf4d5" />
                </div>
              </FormField>
              <FormField label={t('admin.field_tag', 'Tag (slug)')}>
                <input value={form.tag} onChange={e => set('tag', e.target.value)} className={inputClass} placeholder="bio, promo..." />
              </FormField>
              <FormField label={t('admin.field_tag_label', 'Tag (libellé affiché)')}>
                <input value={form.tag_label} onChange={e => set('tag_label', e.target.value)} className={inputClass} placeholder="Bio, Promo..." />
              </FormField>
              <FormField label={t('admin.field_rating', 'Note (0–5)')}>
                <input type="number" min="0" max="5" step="0.1" value={form.rating} onChange={e => set('rating', e.target.value)} className={inputClass} placeholder="4.5" />
              </FormField>
              <FormField label={t('admin.field_reviews', 'Nombre d\'avis')}>
                <input type="number" min="0" value={form.reviews_count} onChange={e => set('reviews_count', e.target.value)} className={inputClass} placeholder="128" />
              </FormField>
              <FormField label={t('admin.field_status', 'Statut')}>
                <select value={form.status} onChange={e => set('status', e.target.value)} className={selectClass}>
                  <option value="published">✅ Publié</option>
                  <option value="draft">📝 Brouillon</option>
                  <option value="archived">📦 Archivé</option>
                </select>
              </FormField>
              <FormField label={t('admin.field_producer_account', 'Compte producteur')}>
                <select value={form.producer_account_id} onChange={e => set('producer_account_id', e.target.value)} className={selectClass}>
                  <option value="">— Aucun —</option>
                  {producers.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </FormField>
            </div>

            <FormField label={t('admin.field_badges', 'Badges (séparés par virgule)')}>
              <input
                value={form.badges}
                onChange={e => set('badges', e.target.value)}
                className={inputClass}
                placeholder="🌿 Certifié AB, ☀️ Plein soleil..."
              />
            </FormField>

            <FormField label={t('admin.field_image', 'Image')}>
              <div className="space-y-2">
                {form.image_url && (
                  <img src={form.image_url} alt="" className="w-full h-40 object-cover rounded-xl border border-[#d2e095]" />
                )}
                <label className={`flex items-center gap-3 cursor-pointer border-2 border-dashed border-[#d2e095] rounded-xl p-4 hover:bg-[#ecf4d5] transition ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                  <span className="text-2xl">📷</span>
                  <span className="text-sm text-gray-600">
                    {uploading ? t('admin.uploading', 'Envoi en cours...') : t('admin.upload_image', 'Choisir une image depuis mon ordinateur')}
                  </span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                </label>
                <input
                  value={form.image_url}
                  onChange={e => set('image_url', e.target.value)}
                  className={inputClass}
                  placeholder={t('admin.field_image_url', 'ou coller une URL https://...')}
                />
              </div>
            </FormField>

            <FormField label={t('admin.field_description', 'Description')}>
              <textarea
                value={form.description}
                onChange={e => set('description', e.target.value)}
                className={inputClass + ' h-24 resize-none'}
                placeholder={t('admin.field_description', 'Description du produit...')}
              />
            </FormField>

            <div className="flex gap-6 flex-wrap">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.is_local} onChange={e => set('is_local', e.target.checked)} className="w-4 h-4 accent-[#a8c800]" />
                <span className="text-sm text-gray-700">{t('admin.field_is_local', 'Produit local (Djibouti)')}</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.in_stock} onChange={e => set('in_stock', e.target.checked)} className="w-4 h-4 accent-[#a8c800]" />
                <span className="text-sm text-gray-700">{t('admin.field_in_stock', 'En stock')}</span>
              </label>
            </div>

            {/* Mise en avant homepage */}
            <div className="border border-[#d2e095] rounded-2xl p-4 space-y-3 bg-[#fafff0]">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.is_featured} onChange={e => set('is_featured', e.target.checked)} className="w-4 h-4 accent-[#a8c800]" />
                <span className="text-sm font-semibold text-[#526500]">⭐ {t('admin.field_is_featured', 'Mettre en avant sur la page d\'accueil')}</span>
              </label>
              {form.is_featured && (
                <FormField label={t('admin.field_featured_badge', 'Badge affiché (ex: ⏰ Date courte, 🔥 -30%)')}>
                  <input
                    value={form.featured_badge}
                    onChange={e => set('featured_badge', e.target.value)}
                    className={inputClass}
                    placeholder="⏰ Date courte · -20%"
                  />
                </FormField>
              )}
            </div>

            {error && <div className="bg-orange-50 text-[#f97316] text-sm px-4 py-3 rounded-xl">{error}</div>}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition">
                {t('admin.cancel', 'Annuler')}
              </button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-3 bg-[#a8c800] text-white rounded-xl text-sm font-semibold hover:bg-[#7d9800] transition disabled:opacity-50">
                {saving ? t('admin.saving', 'Enregistrement...') : editingId ? t('admin.edit', 'Modifier') : t('admin.add', 'Ajouter')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleteId && <ConfirmDelete onConfirm={handleDelete} onCancel={() => { setDeleteId(null); setError(''); }} loading={deleting} error={error} />}
    </div>
  );
}
