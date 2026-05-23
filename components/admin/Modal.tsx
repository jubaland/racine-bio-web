'use client';

import { useLanguage } from '../../context/LanguageContext';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export default function Modal({ title, onClose, children }: ModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-gray-800">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-3xl leading-none w-8 h-8 flex items-center justify-center"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

interface ConfirmDeleteProps {
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ConfirmDelete({ onConfirm, onCancel, loading }: ConfirmDeleteProps) {
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center">
        <p className="text-4xl mb-3">⚠️</p>
        <h3 className="font-bold text-gray-800 mb-2">{t('admin.confirm_delete', 'Confirmer la suppression')}</h3>
        <p className="text-gray-400 text-sm mb-6">{t('admin.irreversible', 'Cette action est irréversible.')}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition"
          >
            {t('admin.cancel', 'Annuler')}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-3 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 transition disabled:opacity-50"
          >
            {loading ? t('admin.deleting', 'Suppression...') : t('admin.delete', 'Supprimer')}
          </button>
        </div>
      </div>
    </div>
  );
}

interface FormFieldProps {
  label: string;
  children: React.ReactNode;
}

export function FormField({ label, children }: FormFieldProps) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-600 mb-1 block">{label}</label>
      {children}
    </div>
  );
}

export const inputClass = 'w-full border border-[#d2e095] rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-[#a8c800] bg-[#faf7e8]';
export const selectClass = 'w-full border border-[#d2e095] rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-[#a8c800] bg-[#faf7e8]';
