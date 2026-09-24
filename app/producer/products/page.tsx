'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useLanguage } from '../../../context/LanguageContext';
import ProducerLayout from '../../../components/producer/ProducerLayout';
import Modal, { ConfirmDelete, FormField, inputClass, selectClass } from '../../../components/admin/Modal';

const emptyForm = (farmName: string, region: string) => ({
  name: '', price: '', old_price: '', unit: 'kg', farm: farmName,
  category: '', product_type: 'bio', origin_country: 'DJ',
  image_url: '', description: '', is_local: true, region,
  stock_qty: '',
});

function ProductsContent({ producer }: { producer: any }) {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm(producer.farm_name, producer.region || ''));
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: prods }, { data: cats }] = await Promise.all([
      supabase
        .from('products')
        .select('*')
        .eq('owner_id', producer.user_id)
        .order('created_at', { ascending: false }),
      supabase.from('categories').select('*').order('id'),
    ]);
    setProducts(prods || []);
    setCategories(cats || []);
    setLoading(false);
  }, [producer.user_id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm(producer.farm_name, producer.region || ''));
    setError('');
    setShowModal(true);
  };

  const openEdit = (p: any) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      price: String(p.price),
      old_price: String(p.old_price ?? ''),
      unit: p.unit,
      farm: producer.farm_name,
      category: p.category || '',
      product_type: p.product_type,
      origin_country: p.origin_country || 'DJ',
      image_url: p.image_url || '',
      description: p.description || '',
      is_local: p.is_local,
      region: p.region || producer.region || '',
      stock_qty: String(p.stock_qty ?? ''),
    });
    setError('');
    setShowModal(true);
  };

  // Photo : envoi direct dans le bucket (autorisé aux comptes connectés)
  const [uploading, setUploading] = useState(false);
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError('');
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `m-${producer.user_id.slice(0, 8)}-${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from('product-images').upload(path, file, { upsert: true });
    if (uploadErr) { setError(uploadErr.message); setUploading(false); return; }
    set('image_url', supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl);
    setUploading(false);
  };

  const handleSave = async () => {
    if (!form.name || !form.price || !form.unit) {
      setError(t('admin.error_products', 'Nom, prix et unité sont requis.'));
      return;
    }
    // Produit déjà publié + champ sensible modifié → repassera en validation (et sera masqué entre-temps)
    if (editingId) {
      const orig = products.find(p => p.id === editingId);
      const sensitiveChanged = !!orig && orig.status === 'published' && (
        (orig.name || '') !== form.name.trim() ||
        Number(orig.price) !== parseFloat(form.price) ||
        (orig.description || '') !== form.description.trim() ||
        (orig.image_url || '') !== form.image_url.trim() ||
        (orig.category || '') !== form.category.trim() ||
        (orig.unit || '') !== form.unit.trim()
      );
      if (sensitiveChanged && !confirm(t('producer.edit_warning',
        'Vous modifiez le nom, le prix, la description, la photo, la catégorie ou l\'unité d\'un produit publié.\n\nIl repassera « À valider » par Hornafresh et ne sera plus visible sur le site jusqu\'à sa validation.\n\nContinuer ?'))) return;
    }
    setSaving(true);
    setError('');
    const payload = {
      name: form.name.trim(),
      price: parseFloat(form.price),
      old_price: form.old_price ? parseFloat(form.old_price) : null,
      unit: form.unit.trim(),
      farm: producer.farm_name,
      category: form.category.trim(),
      product_type: form.product_type,
      origin_country: form.origin_country.trim(),
      image_url: form.image_url.trim() || null,
      description: form.description.trim(),
      is_local: form.is_local,
      region: form.region.trim(),
      stock_qty: Math.max(0, parseInt(form.stock_qty || '0', 10) || 0),
    };
    // owner_id = compte propriétaire (exigé par la RLS pour créer/éditer ses produits)
    const { data: { user } } = await supabase.auth.getUser();
    const { error: err } = editingId
      ? await supabase.from('products').update(payload).eq('id', editingId)
      : await supabase.from('products').insert({ ...payload, owner_id: user?.id ?? null });
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            🥬 {t('producer.nav_products', 'Mes produits')}
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">🌱 {producer.farm_name}</p>
        </div>
        <button
          onClick={openAdd}
          className="bg-[#a8c800] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#7d9800] transition"
        >
          {t('admin.add', '+ Ajouter')}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <p className="text-gray-400">{t('producer.loading', 'Chargement...')}</p>
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#d2e095] text-center py-16">
          <p className="text-5xl mb-4 opacity-20">🥬</p>
          <p className="text-gray-400 mb-5">
            {t('producer.no_products', "Vous n'avez pas encore de produits")}
          </p>
          <button
            onClick={openAdd}
            className="bg-[#a8c800] text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-[#7d9800] transition"
          >
            + {t('producer.add_first', 'Ajouter mon premier produit')}
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#d2e095] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#faf7e8] border-b border-[#d2e095]">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">
                    {t('admin.col_product', 'Produit')}
                  </th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">
                    {t('admin.col_price', 'Prix')}
                  </th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">
                    {t('admin.col_category', 'Catégorie')}
                  </th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">
                    {t('admin.col_type', 'Type')}
                  </th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">
                    {t('admin.col_status', 'Statut')}
                  </th>
                  <th className="text-right px-4 py-3 text-gray-500 font-medium">
                    {t('admin.actions', 'Actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {products.map(p => (
                  <tr key={p.id} className="hover:bg-[#faf7e8] transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name} className="w-10 h-10 rounded-lg object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-[#ecf4d5] flex items-center justify-center text-xl">🥬</div>
                        )}
                        <div>
                          <p className="font-medium text-gray-800">{p.name}</p>
                          <p className="text-xs text-gray-400">{p.unit}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#526500]">{Number(p.price).toLocaleString()} Fdj</p>
                      {p.old_price && (
                        <p className="text-xs text-gray-400 line-through">{Number(p.old_price).toLocaleString()}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-[#ecf4d5] text-[#526500] rounded-full text-xs">
                        {p.category || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${p.product_type === 'bio' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'}`}>
                        {p.product_type === 'bio' ? t('admin.type_bio', '🌿 Bio') : t('admin.type_conv', '🌾 Conv.')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {p.status === 'published' ? (
                        <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">✅ {t('producer.st_published', 'Publié')}</span>
                      ) : p.status === 'pending_review' ? (
                        <span className="px-2 py-1 rounded-full text-xs bg-amber-100 text-amber-800">⏳ {t('producer.st_pending', 'À valider')}</span>
                      ) : p.status === 'rejected' ? (
                        <span className="px-2 py-1 rounded-full text-xs bg-red-100 text-red-600" title={p.review_note || ''}>❌ {t('producer.st_rejected', 'Refusé')}{p.review_note ? ` — ${p.review_note}` : ''}</span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600">{p.status || '—'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEdit(p)}
                        className="text-[#7d9800] hover:text-[#526500] text-xs font-medium mr-3"
                      >
                        {t('admin.edit', 'Modifier')}
                      </button>
                      <button
                        onClick={() => setDeleteId(p.id)}
                        className="text-red-400 hover:text-red-600 text-xs font-medium"
                      >
                        {t('admin.delete', 'Supprimer')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-50 text-xs text-gray-400">
            {products.length} {t('admin.nav_products', 'produits').toLowerCase()}
          </div>
        </div>
      )}

      {showModal && (
        <Modal
          title={editingId
            ? t('admin.products_edit_title', 'Modifier le produit')
            : t('admin.products_add_title', 'Ajouter un produit')}
          onClose={() => setShowModal(false)}
        >
          <div className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <FormField label={t('admin.field_product_name', 'Nom du produit *')}>
                  <input
                    value={form.name}
                    onChange={e => set('name', e.target.value)}
                    className={inputClass}
                    placeholder="ex: Tomates cerises"
                  />
                </FormField>
              </div>
              <FormField label={t('admin.field_price', 'Prix (Fdj) *')}>
                <input
                  type="number"
                  value={form.price}
                  onChange={e => set('price', e.target.value)}
                  className={inputClass}
                  placeholder="500"
                />
              </FormField>
              <FormField label={t('admin.field_old_price', 'Ancien prix (Fdj)')}>
                <input
                  type="number"
                  value={form.old_price}
                  onChange={e => set('old_price', e.target.value)}
                  className={inputClass}
                  placeholder="600"
                />
              </FormField>
              <FormField label={t('admin.field_unit', 'Unité *')}>
                <input
                  value={form.unit}
                  onChange={e => set('unit', e.target.value)}
                  className={inputClass}
                  placeholder="kg, L, boîte..."
                />
              </FormField>
              <FormField label={t('admin.field_stock_qty', 'Stock disponible *')}>
                <input
                  type="number"
                  min={0}
                  value={form.stock_qty}
                  onChange={e => set('stock_qty', e.target.value)}
                  className={inputClass}
                  placeholder={t('producer.stock_ph', 'Ex : 50')}
                />
                <p className="text-[11px] text-gray-400 mt-1">{t('producer.stock_hint', 'À 0, le produit est affiché « Rupture de stock » et ne peut pas être commandé. Le stock se modifie sans nouvelle validation.')}</p>
              </FormField>
              <FormField label={t('admin.col_category', 'Catégorie')}>
                <select
                  value={form.category}
                  onChange={e => set('category', e.target.value)}
                  className={selectClass}
                >
                  <option value="">{t('admin.no_category', '— Sans catégorie —')}</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.slug}>{c.emoji} {c.label}</option>
                  ))}
                </select>
              </FormField>
              <FormField label={t('admin.col_type', 'Type')}>
                <select
                  value={form.product_type}
                  onChange={e => set('product_type', e.target.value)}
                  className={selectClass}
                >
                  <option value="bio">{t('admin.type_bio', '🌿 Bio')}</option>
                  <option value="conventionnel">{t('admin.type_conv', '🌾 Conventionnel')}</option>
                </select>
              </FormField>
              <FormField label={t('admin.field_origin', "Pays d'origine")}>
                <input
                  value={form.origin_country}
                  onChange={e => set('origin_country', e.target.value)}
                  className={inputClass}
                  placeholder="DJ"
                />
              </FormField>
              <FormField label={t('admin.col_region', 'Région')}>
                <input
                  value={form.region}
                  onChange={e => set('region', e.target.value)}
                  className={inputClass}
                  placeholder="Ali Sabieh..."
                />
              </FormField>
            </div>
            <FormField label={t('admin.field_image', 'Photo du produit')}>
              <div className="flex items-center gap-3">
                {form.image_url ? (
                  <img src={form.image_url} alt="" className="w-16 h-16 rounded-xl object-cover border border-[#d2e095] flex-none" />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-[#ecf4d5] flex items-center justify-center text-2xl flex-none">📷</div>
                )}
                <label className={`flex-1 flex items-center gap-2 cursor-pointer border-2 border-dashed border-[#d2e095] rounded-xl px-3 py-3 text-sm text-[#526500] hover:bg-[#ecf4d5] transition ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                  <span>📁</span>
                  <span>{uploading ? t('admin.uploading', 'Envoi en cours...') : t('producer.upload_image', 'Choisir une photo (téléphone ou ordinateur)')}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                </label>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">{t('producer.image_hint', 'Une belle photo vend 3 fois mieux. Format carré conseillé.')}</p>
            </FormField>
            <FormField label={t('admin.field_description', 'Description')}>
              <textarea
                value={form.description}
                onChange={e => set('description', e.target.value)}
                className={inputClass + ' h-24 resize-none'}
                placeholder="Description du produit..."
              />
            </FormField>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_local}
                onChange={e => set('is_local', e.target.checked)}
                className="w-4 h-4 accent-[#a8c800]"
              />
              <span className="text-sm text-gray-700">
                {t('admin.field_is_local', 'Produit local (Djibouti)')}
              </span>
            </label>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-3 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition"
              >
                {t('admin.cancel', 'Annuler')}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-3 bg-[#a8c800] text-white rounded-xl text-sm font-semibold hover:bg-[#7d9800] transition disabled:opacity-50"
              >
                {saving
                  ? t('admin.saving', 'Enregistrement...')
                  : editingId ? t('admin.edit', 'Modifier') : t('admin.add', 'Ajouter')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleteId && (
        <ConfirmDelete
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
          loading={deleting}
        />
      )}
    </div>
  );
}

export default function ProducerProductsPage() {
  return (
    <ProducerLayout>
      {producer => <ProductsContent producer={producer} />}
    </ProducerLayout>
  );
}
