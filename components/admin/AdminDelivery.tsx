'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import Modal, { ConfirmDelete, FormField, inputClass } from './Modal';

interface DeliveryOption {
  id: number;
  name: string;
  description: string;
  price: number;
  emoji: string;
  is_active: boolean;
  is_standard: boolean;
  sort_order: number;
}

const EMPTY = { name: '', description: '', price: 0, emoji: '🚚', is_active: true, is_standard: false, sort_order: 0 };

export default function AdminDelivery() {
  const [options, setOptions] = useState<DeliveryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<typeof EMPTY>({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('delivery_options')
      .select('*')
      .order('sort_order')
      .order('id');
    setOptions(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...EMPTY, sort_order: options.length + 1 });
    setError('');
    setShowModal(true);
  };

  const openEdit = (opt: DeliveryOption) => {
    setEditingId(opt.id);
    setForm({
      name: opt.name,
      description: opt.description || '',
      price: opt.price,
      emoji: opt.emoji,
      is_active: opt.is_active,
      is_standard: opt.is_standard,
      sort_order: opt.sort_order,
    });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Le nom est requis.'); return; }
    setSaving(true);
    setError('');
    const payload = {
      name:        form.name.trim(),
      description: form.description.trim(),
      price:       Math.max(0, Number(form.price) || 0),
      emoji:       form.emoji.trim() || '🚚',
      is_active:   form.is_active,
      is_standard: form.is_standard,
      sort_order:  Number(form.sort_order) || 0,
    };
    // Une seule option peut être "standard" — réinitialiser les autres si nécessaire
    if (form.is_standard) {
      await supabase.from('delivery_options').update({ is_standard: false }).neq('id', editingId ?? 0);
    }
    const { error: err } = editingId
      ? await supabase.from('delivery_options').update(payload).eq('id', editingId)
      : await supabase.from('delivery_options').insert(payload);
    if (err) { setError(err.message); setSaving(false); return; }
    setSaving(false);
    setShowModal(false);
    fetchAll();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    await supabase.from('delivery_options').delete().eq('id', deleteId);
    setDeleting(false);
    setDeleteId(null);
    fetchAll();
  };

  const toggleActive = async (opt: DeliveryOption) => {
    await supabase.from('delivery_options').update({ is_active: !opt.is_active }).eq('id', opt.id);
    setOptions(prev => prev.map(o => o.id === opt.id ? { ...o, is_active: !o.is_active } : o));
  };

  if (loading) return <div className="p-8 text-gray-400 text-center">Chargement...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800">🚚 Options de livraison</h2>
          <p className="text-sm text-gray-400 mt-1">
            Modes et tarifs proposés au checkout. Le code parrainage ou un crédit annule les frais.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="bg-[#a8c800] text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-[#7d9800] transition text-sm"
        >
          + Ajouter
        </button>
      </div>

      {options.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-[#d2e095]">
          <p className="text-4xl mb-3 opacity-20">🚚</p>
          <p className="text-gray-400 mb-4">Aucune option configurée.</p>
          <button onClick={openAdd} className="text-[#7d9800] text-sm hover:underline">
            + Créer la première option
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {options.map(opt => (
            <div
              key={opt.id}
              className={`bg-white rounded-2xl p-4 border transition ${opt.is_active ? 'border-[#d2e095]' : 'border-gray-100 opacity-55'}`}
            >
              <div className="flex items-center gap-4">
                <span className="text-3xl w-10 text-center flex-shrink-0">{opt.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="font-semibold text-gray-800">{opt.name}</p>
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${opt.price === 0 ? 'bg-green-100 text-green-700' : 'bg-[#ecf4d5] text-[#526500]'}`}>
                      {opt.price === 0 ? 'Gratuit' : `${opt.price.toLocaleString()} Fdj`}
                    </span>
                    <span className="text-xs text-gray-300">ordre {opt.sort_order}</span>
                    {opt.is_standard && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-0.5 rounded-full font-semibold">★ Référence parrainage</span>
                    )}
                    {!opt.is_active && (
                      <span className="text-xs bg-gray-100 text-gray-400 px-2.5 py-0.5 rounded-full">Désactivé</span>
                    )}
                  </div>
                  {opt.description && (
                    <p className="text-sm text-gray-400 mt-0.5 truncate">{opt.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => toggleActive(opt)}
                    title={opt.is_active ? 'Désactiver' : 'Activer'}
                    className={`relative w-11 h-6 rounded-full transition-colors ${opt.is_active ? 'bg-[#a8c800]' : 'bg-gray-200'}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${opt.is_active ? 'left-5' : 'left-0.5'}`} />
                  </button>
                  <button
                    onClick={() => openEdit(opt)}
                    className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-[#d2e095] rounded-lg hover:bg-[#ecf4d5] transition"
                  >
                    Modifier
                  </button>
                  <button
                    onClick={() => setDeleteId(opt.id)}
                    className="px-3 py-1.5 text-xs font-medium text-[#f97316] border border-orange-100 rounded-lg hover:bg-orange-50 transition"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <Modal
          title={editingId ? "Modifier l'option" : 'Nouvelle option de livraison'}
          onClose={() => setShowModal(false)}
        >
          <div className="space-y-4">
            <div className="flex gap-3">
              <div>
                <FormField label="Emoji">
                  <input
                    type="text"
                    value={form.emoji}
                    onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))}
                    className={inputClass + ' w-16 text-center text-xl'}
                    maxLength={4}
                  />
                </FormField>
              </div>
              <div className="flex-1">
                <FormField label="Nom *">
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Ex: Standard, Express, Point relais..."
                    className={inputClass}
                  />
                </FormField>
              </div>
            </div>

            <FormField label="Description">
              <input
                type="text"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Ex: Livraison dans la journée ou le lendemain"
                className={inputClass}
              />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Prix (Fdj)">
                <input
                  type="number"
                  value={form.price}
                  min={0}
                  onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))}
                  placeholder="0"
                  className={inputClass}
                />
              </FormField>
              <FormField label="Ordre d'affichage">
                <input
                  type="number"
                  value={form.sort_order}
                  min={0}
                  onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))}
                  className={inputClass}
                />
              </FormField>
            </div>

            <label className="flex items-center gap-3 cursor-pointer select-none p-3 bg-[#faf7e8] rounded-xl border border-[#d2e095]">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                className="w-4 h-4 accent-[#a8c800]"
              />
              <span className="text-sm font-medium text-gray-700">Active — visible au checkout</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer select-none p-3 bg-amber-50 rounded-xl border border-amber-200">
              <input
                type="checkbox"
                checked={form.is_standard}
                onChange={e => setForm(f => ({ ...f, is_standard: e.target.checked }))}
                className="w-4 h-4 accent-amber-500"
              />
              <div>
                <span className="text-sm font-medium text-amber-800">★ Option de référence (parrainage)</span>
                <p className="text-xs text-amber-600 mt-0.5">Le code parrainage déduit le prix de cette option des frais de livraison.</p>
              </div>
            </label>

            {error && <p className="text-sm text-[#f97316]">⚠️ {error}</p>}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-3 border border-[#d2e095] rounded-xl text-sm text-gray-600 hover:bg-[#ecf4d5] transition"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-3 bg-[#a8c800] text-white rounded-xl text-sm font-semibold hover:bg-[#7d9800] transition disabled:opacity-50"
              >
                {saving ? 'Enregistrement...' : (editingId ? 'Enregistrer' : 'Créer')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleteId !== null && (
        <ConfirmDelete
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
          loading={deleting}
        />
      )}
    </div>
  );
}
