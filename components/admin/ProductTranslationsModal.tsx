'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { supabase } from '../../lib/supabase';

// Traductions d'un produit : nom et description par langue. Les noms déjà connus du catalogue
// (produit portant le même nom français) sont proposés ; rien n'est enregistré avant « Enregistrer ».

type Tr = { name: string; description: string };
const LABEL: Record<string, string> = { en: '🇬🇧 English', zh: '🇨🇳 中文', so: '🇩🇯 Soomaali', am: '🇪🇹 አማርኛ' };

export default function ProductTranslationsModal({ productId, canEdit, onClose, onSaved }: { productId: number; canEdit: boolean; onClose: () => void; onSaved?: () => void }) {
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;
  const [fr, setFr] = useState<{ name: string; description: string } | null>(null);
  const [langs, setLangs] = useState<string[]>([]);
  const [form, setForm] = useState<Record<string, Tr>>({});
  const [suggested, setSuggested] = useState<Record<string, boolean>>({});   // nom proposé, pas encore enregistré
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const token = async () => {
    let { data: { session } } = await supabase.auth.getSession();
    if (!session || (session.expires_at && session.expires_at * 1000 < Date.now() + 60000)) session = (await supabase.auth.refreshSession()).data.session;
    return session?.access_token;
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/admin/product-translations?product_id=${productId}`, { headers: { Authorization: `Bearer ${await token()}` } });
        const j = await res.json();
        if (!res.ok) { setError(j.error || 'Erreur'); return; }
        setFr({ name: j.product.name, description: j.product.description });
        setLangs(j.langs);
        const f: Record<string, Tr> = {}; const s: Record<string, boolean> = {};
        for (const l of j.langs as string[]) {
          const saved = j.translations[l];
          f[l] = { name: saved?.name || j.suggestions[l] || '', description: saved?.description || '' };
          s[l] = !saved?.name && !!j.suggestions[l];
        }
        setForm(f); setSuggested(s);
      } catch (e: any) { setError(e.message); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const set = (l: string, k: keyof Tr, v: string) => { setForm(p => ({ ...p, [l]: { ...p[l], [k]: v } })); if (k === 'name') setSuggested(p => ({ ...p, [l]: false })); };

  const save = async () => {
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/admin/product-translations', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` }, body: JSON.stringify({ product_id: productId, translations: form }) });
      const j = await res.json();
      if (!res.ok) { setError(j.error || 'Erreur'); return; }
      onSaved?.(); onClose();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[88vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-bold text-[#2d6410]">🌍 {t('ptr.title', 'Traductions du produit')}</h3>
          <button onClick={onClose} aria-label={t('install.close', 'Fermer')} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500">✕</button>
        </div>
        {!fr ? <p className="text-center text-gray-400 py-10">{error ? `⚠️ ${error}` : '⏳'}</p> : (
          <>
            <div className="bg-[#faf7e8] rounded-xl px-3 py-2 mb-3">
              <p className="text-[11px] text-gray-400">🇫🇷 {t('ptr.source', 'Texte français (référence)')}</p>
              <p className="text-sm font-semibold text-gray-800">{fr.name}</p>
              {fr.description ? <p className="text-xs text-gray-500 mt-0.5">{fr.description}</p> : <p className="text-xs text-gray-400 mt-0.5 italic">{t('ptr.no_desc', 'Sans description')}</p>}
            </div>
            <p className="text-xs text-gray-500 mb-3">{t('ptr.hint', 'Une langue sans nom affiche le nom français. La description est facultative.')}</p>
            <div className="space-y-3">
              {langs.map(l => (
                <div key={l} className="border border-[#e3eebf] rounded-xl p-3">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <p className="text-xs font-semibold text-gray-700">{LABEL[l] || l}</p>
                    {suggested[l] && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 whitespace-nowrap">💡 {t('ptr.suggested', 'Proposé par le catalogue')}</span>}
                  </div>
                  <input value={form[l]?.name || ''} onChange={e => set(l, 'name', e.target.value)} maxLength={120} disabled={!canEdit}
                    placeholder={t('ptr.name_ph', 'Nom du produit dans cette langue')} className="w-full border border-[#d2e095] rounded-xl px-3 py-2 text-sm mb-1.5" />
                  <textarea value={form[l]?.description || ''} onChange={e => set(l, 'description', e.target.value)} maxLength={1000} rows={2} disabled={!canEdit}
                    placeholder={t('ptr.desc_ph', 'Description (facultatif)')} className="w-full border border-[#d2e095] rounded-xl px-3 py-2 text-sm resize-none" />
                </div>
              ))}
            </div>
            {error && <p className="text-xs text-red-500 mt-3">⚠️ {error}</p>}
            <div className="flex gap-2 justify-end mt-4">
              <button onClick={onClose} className="text-sm px-4 py-2 rounded-xl border border-gray-200 text-gray-600">{t('admin.cancel', 'Annuler')}</button>
              {canEdit && <button disabled={busy} onClick={save} className="text-sm font-semibold px-4 py-2 rounded-xl bg-[#a8c800] text-white hover:bg-[#7d9800] disabled:opacity-50">{busy ? '…' : `💾 ${t('admin.save', 'Enregistrer')}`}</button>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
