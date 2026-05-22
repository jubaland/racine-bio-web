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
  unit: string;
  farm: string;
  category: string;
  product_type: string;
  origin_country: string;
  image_url: string | null;
  description: string;
  is_local: boolean;
  region: string;
  created_at: string;
}

const EMPTY_FORM = {
  name: '', price: '', old_price: '', unit: 'kg', farm: '', category: '',
  product_type: 'bio', origin_country: 'Djibouti', image_url: '', description: '',
  is_local: true, region: '',
};

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: prods }, { data: cats }] = await Promise.all([
      supabase.from('products').select('*').order('created_at', { ascending: false }),
      supabase.from('categories').select('*').order('id'),
    ]);
    setProducts(prods || []);
    setCategories(cats || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openAdd = () => { setEditingId(null); setForm(EMPTY_FORM); setError(''); setShowModal(true); };

  const openEdit = (p: Product) => {
    setEditingId(p.id);
    setForm({
      name: p.name, price: String(p.price), old_price: String(p.old_price ?? ''),
      unit: p.unit, farm: p.farm, category: p.category, product_type: p.product_type,
      origin_country: p.origin_country, image_url: p.image_url ?? '',
      description: p.description, is_local: p.is_local, region: p.region,
    });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.price || !form.unit || !form.farm) {
      setError(t('admin.error_products', 'Nom, prix, unité et ferme sont requis.'));
      return;
    }
    setSaving(true);
    setError('');
    const payload = {
      name: form.name.trim(), price: parseFloat(form.price),
      old_price: form.old_price ? parseFloat(form.old_price) : null,
      unit: form.unit.trim(), farm: form.farm.trim(), category: form.category.trim(),
      product_type: form.product_type, origin_country: form.origin_country.trim(),
      image_url: form.image_url.trim() || null, description: form.description.trim(),
      is_local: form.is_local, region: form.region.trim(),
    };
    const { error: err } = editingId
      ? await supabase.from('products').update(payload).eq('id', editingId)
      : await supabase.from('products').insert(payload);
    if (err) { setError(err.message); setSaving(false); return; }
    setSaving(false);
    setShowModal(false);
    fetchAll();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    await supabase.from('products').delete().eq('id', deleteId);
    setDeleting(false);
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
        <div className="bg-white rounded-2xl border border-[#dde8b0] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#f8faf0] border-b border-[#dde8b0]">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">{t('admin.col_product', 'Produit')}</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">{t('admin.col_price', 'Prix')}</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">{t('admin.col_farm', 'Ferme')}</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">{t('admin.col_category', 'Catégorie')}</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">{t('admin.col_type', 'Type')}</th>
                  <th className="text-right px-4 py-3 text-gray-500 font-medium">{t('admin.actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-gray-400">{t('admin.products_no_results', 'Aucun produit trouvé')}</td></tr>
                ) : filtered.map(p => (
                  <tr key={p.id} className="hover:bg-[#f8faf0] transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name} className="w-10 h-10 rounded-lg object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-[#f0f7e8] flex items-center justify-center text-xl">🥬</div>
                        )}
                        <div>
                          <p className="font-medium text-gray-800">{p.name}</p>
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
                      <span className="px-2 py-1 bg-[#f0f7e8] text-[#526500] rounded-full text-xs">{p.category || '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${p.product_type === 'bio' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'}`}>
                        {p.product_type === 'bio' ? t('admin.type_bio', '🌿 Bio') : t('admin.type_conv', '🌾 Conv.')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEdit(p)} className="text-[#7d9800] hover:text-[#526500] text-xs font-medium mr-3">{t('admin.edit', 'Modifier')}</button>
                      <button onClick={() => setDeleteId(p.id)} className="text-red-400 hover:text-red-600 text-xs font-medium">{t('admin.delete', 'Supprimer')}</button>
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
            {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>}

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
              <FormField label={t('admin.field_unit', 'Unité *')}>
                <input value={form.unit} onChange={e => set('unit', e.target.value)} className={inputClass} placeholder="kg, L, boîte..." />
              </FormField>
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
                <input value={form.origin_country} onChange={e => set('origin_country', e.target.value)} className={inputClass} placeholder="Djibouti" />
              </FormField>
              <FormField label={t('admin.col_region', 'Région')}>
                <input value={form.region} onChange={e => set('region', e.target.value)} className={inputClass} placeholder="Ali Sabieh..." />
              </FormField>
            </div>

            <FormField label={t('admin.field_image_url', "URL de l'image")}>
              <input value={form.image_url} onChange={e => set('image_url', e.target.value)} className={inputClass} placeholder="https://..." />
            </FormField>

            <FormField label={t('admin.field_description', 'Description')}>
              <textarea
                value={form.description}
                onChange={e => set('description', e.target.value)}
                className={inputClass + ' h-24 resize-none'}
                placeholder={t('admin.field_description', 'Description du produit...')}
              />
            </FormField>

            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.is_local} onChange={e => set('is_local', e.target.checked)} className="w-4 h-4 accent-[#a8c800]" />
              <span className="text-sm text-gray-700">{t('admin.field_is_local', 'Produit local (Djibouti)')}</span>
            </label>

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

      {deleteId && <ConfirmDelete onConfirm={handleDelete} onCancel={() => setDeleteId(null)} loading={deleting} />}
    </div>
  );
}
