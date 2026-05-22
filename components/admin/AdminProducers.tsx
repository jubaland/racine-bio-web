'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import Modal, { ConfirmDelete, FormField, inputClass } from './Modal';

interface Producer {
  id: number;
  name: string;
  emoji: string;
  region: string;
  rating: number;
}

const EMPTY = { name: '', emoji: '👨‍🌾', region: '', rating: '4.5' };

export default function AdminProducers() {
  const [producers, setProducers] = useState<Producer[]>([]);
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
    const { data } = await supabase.from('producers').select('*').order('rating', { ascending: false });
    setProducers(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openAdd = () => { setEditingId(null); setForm(EMPTY); setError(''); setShowModal(true); };

  const openEdit = (p: Producer) => {
    setEditingId(p.id);
    setForm({ name: p.name, emoji: p.emoji, region: p.region, rating: String(p.rating) });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name) { setError('Le nom est requis.'); return; }
    setSaving(true);
    setError('');
    const payload = { name: form.name.trim(), emoji: form.emoji.trim(), region: form.region.trim(), rating: parseFloat(form.rating) || 0 };
    const { error: err } = editingId
      ? await supabase.from('producers').update(payload).eq('id', editingId)
      : await supabase.from('producers').insert(payload);
    if (err) { setError(err.message); setSaving(false); return; }
    setSaving(false);
    setShowModal(false);
    fetchAll();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    await supabase.from('producers').delete().eq('id', deleteId);
    setDeleting(false);
    setDeleteId(null);
    fetchAll();
  };

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const Stars = ({ rating }: { rating: number }) => {
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.5;
    return (
      <span className="text-yellow-400 text-sm">
        {'★'.repeat(full)}{half ? '½' : ''}{'☆'.repeat(5 - full - (half ? 1 : 0))}
        <span className="text-gray-500 text-xs ml-1">{rating.toFixed(1)}</span>
      </span>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">👨‍🌾 Producteurs</h1>
        <button onClick={openAdd} className="bg-[#a8c800] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#7d9800] transition">+ Ajouter</button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><p className="text-gray-400">Chargement...</p></div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#dde8b0] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#f8faf0] border-b border-[#dde8b0]">
              <tr>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Producteur</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Région</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Note</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {producers.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-12 text-gray-400">Aucun producteur</td></tr>
              ) : producers.map(p => (
                <tr key={p.id} className="hover:bg-[#f8faf0] transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#f0f7e8] flex items-center justify-center text-xl">{p.emoji}</div>
                      <span className="font-medium text-gray-800">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{p.region || '—'}</td>
                  <td className="px-4 py-3"><Stars rating={p.rating} /></td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(p)} className="text-[#7d9800] hover:text-[#526500] text-xs font-medium mr-3">Modifier</button>
                    <button onClick={() => setDeleteId(p.id)} className="text-red-400 hover:text-red-600 text-xs font-medium">Supprimer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t border-gray-50 text-xs text-gray-400">{producers.length} producteur{producers.length !== 1 ? 's' : ''}</div>
        </div>
      )}

      {showModal && (
        <Modal title={editingId ? 'Modifier le producteur' : 'Ajouter un producteur'} onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <FormField label="Nom du producteur *">
                  <input value={form.name} onChange={e => set('name', e.target.value)} className={inputClass} placeholder="Abdi Hassan" />
                </FormField>
              </div>
              <FormField label="Emoji">
                <input value={form.emoji} onChange={e => set('emoji', e.target.value)} className={inputClass} placeholder="👨‍🌾" />
              </FormField>
            </div>
            <FormField label="Région">
              <input value={form.region} onChange={e => set('region', e.target.value)} className={inputClass} placeholder="Ali Sabieh" />
            </FormField>
            <FormField label="Note (0–5)">
              <input type="number" min="0" max="5" step="0.1" value={form.rating} onChange={e => set('rating', e.target.value)} className={inputClass} placeholder="4.5" />
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
