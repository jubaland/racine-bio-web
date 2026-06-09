'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { supabase } from '../../lib/supabase';
import { useCan } from '../../context/AdminPermsContext';
import Modal, { ConfirmDelete, FormField, inputClass } from './Modal';

const authHeader = async (): Promise<Record<string, string>> => {
  const tk = (await supabase.auth.getSession()).data.session?.access_token;
  return tk ? { Authorization: `Bearer ${tk}` } : {};
};

interface Preparer { id: number; name: string; email: string; is_active: boolean; }
const EMPTY = { name: '', email: '' };

export default function AdminPreparers() {
  const [preparers, setPreparers] = useState<Preparer[]>([]);
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
  const { can } = useCan();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/preparers', { headers: await authHeader() });
      const json = await res.json();
      setPreparers(json.preparers || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openAdd = () => { setEditingId(null); setForm(EMPTY); setError(''); setShowModal(true); };
  const openEdit = (p: Preparer) => {
    setEditingId(p.id);
    setForm({ name: p.name, email: p.email });
    setError('');
    setShowModal(true);
  };

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());

  const handleSave = async () => {
    if (!form.name.trim() || !emailValid) {
      setError(t('admin.error_preparers', 'Un nom et un email valide sont requis.'));
      return;
    }
    setSaving(true);
    setError('');
    const res = await fetch('/api/preparers', {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify(editingId ? { id: editingId, ...form } : form),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { setError(json.error || 'Erreur'); return; }
    setShowModal(false);
    fetchAll();
  };

  const toggleActive = async (p: Preparer) => {
    await fetch('/api/preparers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify({ id: p.id, is_active: !p.is_active }),
    });
    fetchAll();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    await fetch('/api/preparers', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify({ id: deleteId }),
    });
    setDeleting(false);
    setDeleteId(null);
    fetchAll();
  };

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">🧑‍🍳 {t('admin.nav_preparers', 'Préparateurs')}</h1>
        {can('preparers', 'create') && <button onClick={openAdd} className="bg-[#a8c800] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#7d9800] transition">{t('admin.add', '+ Ajouter')}</button>}
      </div>

      <p className="text-sm text-gray-500 mb-4">
        {t('admin.preparers_hint', 'Chaque préparateur actif reçoit par email le bordereau de chaque nouvelle commande.')}
      </p>

      {loading ? (
        <div className="flex items-center justify-center h-48"><p className="text-gray-400">{t('admin.loading', 'Chargement...')}</p></div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#d2e095] overflow-hidden">
          <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[#faf7e8] border-b border-[#d2e095]">
              <tr>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">{t('admin.col_preparer', 'Préparateur')}</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">{t('admin.col_email', 'Email')}</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">{t('admin.preparer_active', 'Actif')}</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium">{t('admin.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {preparers.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-12 text-gray-400">{t('admin.no_preparers', 'Aucun préparateur')}</td></tr>
              ) : preparers.map(p => (
                <tr key={p.id} className="hover:bg-[#faf7e8] transition">
                  <td className="px-4 py-3 font-medium text-gray-800">{p.name}</td>
                  <td className="px-4 py-3 text-gray-500">{p.email}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => can('preparers', 'edit') && toggleActive(p)}
                      disabled={!can('preparers', 'edit')}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${p.is_active ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'} disabled:opacity-60`}
                    >
                      {p.is_active ? t('admin.preparer_on', '✓ Actif') : t('admin.preparer_off', 'Inactif')}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {can('preparers', 'edit') && <button onClick={() => openEdit(p)} className="text-[#7d9800] hover:text-[#526500] text-xs font-medium mr-3">{t('admin.edit', 'Modifier')}</button>}
                    {can('preparers', 'delete') && <button onClick={() => setDeleteId(p.id)} className="text-orange-400 hover:text-[#f97316] text-xs font-medium">{t('admin.delete', 'Supprimer')}</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-50 text-xs text-gray-400">{preparers.length} {t('admin.nav_preparers', 'préparateurs').toLowerCase()}</div>
        </div>
      )}

      {showModal && (
        <Modal
          title={editingId ? t('admin.preparers_edit_title', 'Modifier le préparateur') : t('admin.preparers_add_title', 'Ajouter un préparateur')}
          onClose={() => setShowModal(false)}
        >
          <div className="space-y-4">
            {error && <div className="bg-orange-50 text-[#f97316] text-sm px-4 py-3 rounded-xl">{error}</div>}
            <FormField label={t('admin.field_preparer_name', 'Nom *')}>
              <input value={form.name} onChange={e => set('name', e.target.value)} className={inputClass} placeholder="Ahmed Hassan" />
            </FormField>
            <FormField label={t('admin.field_preparer_email', 'Email *')}>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className={inputClass} placeholder="ahmed@email.com" />
            </FormField>
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
