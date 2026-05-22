'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../context/LanguageContext';
import Modal, { ConfirmDelete, FormField, inputClass } from './Modal';

interface Promo { id: number; emoji: string; badge: string; title: string; sub: string; color_start: string; active: boolean; }
const EMPTY = { emoji: '🎉', badge: '', title: '', sub: '', color_start: '#a8c800', active: true };

export default function AdminPromos() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('promos').select('*').order('id');
    setPromos(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openAdd = () => { setEditingId(null); setForm(EMPTY); setError(''); setShowModal(true); };
  const openEdit = (p: Promo) => {
    setEditingId(p.id);
    setForm({ emoji: p.emoji, badge: p.badge, title: p.title, sub: p.sub, color_start: p.color_start, active: p.active });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.badge || !form.title) { setError(t('admin.error_promos', 'Badge et titre sont requis.')); return; }
    setSaving(true);
    setError('');
    const payload = { emoji: form.emoji.trim(), badge: form.badge.trim(), title: form.title.trim(), sub: form.sub.trim(), color_start: form.color_start, active: form.active };
    const { error: err } = editingId
      ? await supabase.from('promos').update(payload).eq('id', editingId)
      : await supabase.from('promos').insert(payload);
    if (err) { setError(err.message); setSaving(false); return; }
    setSaving(false);
    setShowModal(false);
    fetchAll();
  };

  const toggleActive = async (p: Promo) => {
    await supabase.from('promos').update({ active: !p.active }).eq('id', p.id);
    fetchAll();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    await supabase.from('promos').delete().eq('id', deleteId);
    setDeleting(false);
    setDeleteId(null);
    fetchAll();
  };

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">🏷️ {t('admin.nav_promos', 'Promotions')}</h1>
        <button onClick={openAdd} className="bg-[#a8c800] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#7d9800] transition">{t('admin.add', '+ Ajouter')}</button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><p className="text-gray-400">{t('admin.loading', 'Chargement...')}</p></div>
      ) : (
        <div className="grid gap-4">
          {promos.length === 0 && (
            <div className="text-center py-12 text-gray-400 bg-white rounded-2xl border border-[#dde8b0]">{t('admin.no_promos', 'Aucune promotion')}</div>
          )}
          {promos.map(p => (
            <div key={p.id} className="bg-white rounded-2xl border border-[#dde8b0] p-5 flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl flex-shrink-0"
                style={{ background: `linear-gradient(135deg, ${p.color_start}20, ${p.color_start}40)` }}>
                {p.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: p.color_start + '30', color: p.color_start }}>{p.badge}</span>
                  <button
                    onClick={() => toggleActive(p)}
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.active ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}
                  >
                    {p.active ? t('admin.promo_active', '✓ Active') : t('admin.promo_inactive', '○ Inactive')}
                  </button>
                </div>
                <p className="font-semibold text-gray-800 truncate">{p.title}</p>
                <p className="text-sm text-gray-400 truncate">{p.sub}</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => openEdit(p)} className="text-[#7d9800] hover:text-[#526500] text-xs font-medium">{t('admin.edit', 'Modifier')}</button>
                <button onClick={() => setDeleteId(p.id)} className="text-red-400 hover:text-red-600 text-xs font-medium">{t('admin.delete', 'Supprimer')}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <Modal
          title={editingId ? t('admin.promos_edit_title', 'Modifier la promotion') : t('admin.promos_add_title', 'Ajouter une promotion')}
          onClose={() => setShowModal(false)}
        >
          <div className="space-y-4">
            {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>}
            <div className="grid grid-cols-2 gap-3">
              <FormField label={t('admin.col_emoji', 'Emoji')}>
                <input value={form.emoji} onChange={e => set('emoji', e.target.value)} className={inputClass} placeholder="🎉" />
              </FormField>
              <FormField label={t('admin.field_color', 'Couleur principale')}>
                <div className="flex gap-2">
                  <input type="color" value={form.color_start} onChange={e => set('color_start', e.target.value)} className="h-10 w-14 rounded-lg border border-[#dde8b0] cursor-pointer" />
                  <input value={form.color_start} onChange={e => set('color_start', e.target.value)} className={inputClass + ' flex-1'} />
                </div>
              </FormField>
            </div>
            <FormField label={t('admin.field_badge', 'Badge (ex: SOLDES, -20%) *')}>
              <input value={form.badge} onChange={e => set('badge', e.target.value)} className={inputClass} placeholder="SOLDES" />
            </FormField>
            <FormField label={t('admin.field_title', 'Titre *')}>
              <input value={form.title} onChange={e => set('title', e.target.value)} className={inputClass} placeholder="Fruits de saison à prix réduit" />
            </FormField>
            <FormField label={t('admin.field_subtitle', 'Sous-titre')}>
              <input value={form.sub} onChange={e => set('sub', e.target.value)} className={inputClass} placeholder="Jusqu'au 31 décembre" />
            </FormField>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.active} onChange={e => set('active', e.target.checked)} className="w-4 h-4 accent-[#a8c800]" />
              <span className="text-sm text-gray-700">{t('admin.field_promo_visible', 'Promotion active (visible sur le site)')}</span>
            </label>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition">{t('admin.cancel', 'Annuler')}</button>
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
