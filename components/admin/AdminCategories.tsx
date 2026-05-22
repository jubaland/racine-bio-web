'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import Modal, { ConfirmDelete, FormField, inputClass } from './Modal';

interface Category {
  id: number;
  slug: string;
  label: string;
  emoji: string;
}

const EMPTY = { slug: '', label: '', emoji: '' };

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('categories').select('*').order('id');
    setCategories(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const toSlug = (str: string) =>
    str.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY);
    setError('');
    setShowModal(true);
  };

  const openEdit = (c: Category) => {
    setEditingId(c.id);
    setForm({ slug: c.slug, label: c.label, emoji: c.emoji });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.label || !form.emoji) { setError('Label et emoji sont requis.'); return; }
    setSaving(true);
    setError('');
    const payload = {
      slug: form.slug || toSlug(form.label),
      label: form.label.trim(),
      emoji: form.emoji.trim(),
    };
    const { error: err } = editingId
      ? await supabase.from('categories').update(payload).eq('id', editingId)
      : await supabase.from('categories').insert(payload);
    if (err) { setError(err.message); setSaving(false); return; }
    setSaving(false);
    setShowModal(false);
    fetchAll();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    await supabase.from('categories').delete().eq('id', deleteId);
    setDeleting(false);
    setDeleteId(null);
    fetchAll();
  };

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">📂 Catégories</h1>
        <button onClick={openAdd} className="bg-[#a8c800] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#7d9800] transition">
          + Ajouter
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><p className="text-gray-400">Chargement...</p></div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#dde8b0] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#f8faf0] border-b border-[#dde8b0]">
              <tr>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Emoji</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Label</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Slug</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {categories.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-12 text-gray-400">Aucune catégorie</td></tr>
              ) : categories.map(c => (
                <tr key={c.id} className="hover:bg-[#f8faf0] transition">
                  <td className="px-4 py-3 text-2xl">{c.emoji}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{c.label}</td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">{c.slug}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(c)} className="text-[#7d9800] hover:text-[#526500] text-xs font-medium mr-3">Modifier</button>
                    <button onClick={() => setDeleteId(c.id)} className="text-red-400 hover:text-red-600 text-xs font-medium">Supprimer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t border-gray-50 text-xs text-gray-400">{categories.length} catégorie{categories.length !== 1 ? 's' : ''}</div>
        </div>
      )}

      {showModal && (
        <Modal title={editingId ? 'Modifier la catégorie' : 'Ajouter une catégorie'} onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>}
            <FormField label="Emoji *">
              <input value={form.emoji} onChange={e => set('emoji', e.target.value)} className={inputClass} placeholder="🥕" />
            </FormField>
            <FormField label="Label (nom affiché) *">
              <input
                value={form.label}
                onChange={e => { set('label', e.target.value); if (!editingId) set('slug', toSlug(e.target.value)); }}
                className={inputClass}
                placeholder="Légumes"
              />
            </FormField>
            <FormField label="Slug (URL)">
              <input value={form.slug} onChange={e => set('slug', e.target.value)} className={inputClass} placeholder="legumes" />
              <p className="text-xs text-gray-400 mt-1">Généré automatiquement depuis le label</p>
            </FormField>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition">Annuler</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-3 bg-[#a8c800] text-white rounded-xl text-sm font-semibold hover:bg-[#7d9800] transition disabled:opacity-50">
                {saving ? 'Enregistrement...' : editingId ? 'Modifier' : 'Ajouter'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleteId && <ConfirmDelete onConfirm={handleDelete} onCancel={() => setDeleteId(null)} loading={deleting} />}
    </div>
  );
}
