'use client';

import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';

// Champ « photos » partagé (admin + marchand) : envoi multiple dans le bucket product-images,
// la première photo est la principale (cartes, commandes) ; réordonner, définir comme principale, retirer.

export const MAX_PRODUCT_IMAGES = 5;

export default function ImagesField({ value, onChange, pathPrefix, onError }: {
  value: string[]; onChange: (urls: string[]) => void; pathPrefix: string; onError?: (msg: string) => void;
}) {
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;
  const [uploading, setUploading] = useState(false);
  const [url, setUrl] = useState('');

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    const room = MAX_PRODUCT_IMAGES - value.length;
    if (room <= 0) { onError?.(`${t('img.max', 'Maximum')} ${MAX_PRODUCT_IMAGES} ${t('img.photos', 'photos')}`); return; }
    setUploading(true);
    const added: string[] = [];
    for (const file of files.slice(0, room)) {
      if (file.size > 8 * 1024 * 1024) { onError?.(`${file.name} : ${t('img.too_big', 'fichier trop lourd (8 Mo max)')}`); continue; }
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const path = `${pathPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
      const { error } = await supabase.storage.from('product-images').upload(path, file, { upsert: false });
      if (error) { onError?.(error.message); continue; }
      added.push(supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl);
    }
    if (added.length) onChange([...value, ...added]);
    setUploading(false);
  };
  const move = (i: number, dir: -1 | 1) => { const j = i + dir; if (j < 0 || j >= value.length) return; const a = [...value]; [a[i], a[j]] = [a[j], a[i]]; onChange(a); };
  const setCover = (i: number) => { if (i === 0) return; const a = [...value]; const [x] = a.splice(i, 1); onChange([x, ...a]); };
  const remove = (i: number) => onChange(value.filter((_, k) => k !== i));
  const addUrl = () => { const u = url.trim(); if (!/^https?:\/\//i.test(u) || value.length >= MAX_PRODUCT_IMAGES) return; onChange([...value, u]); setUrl(''); };

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {value.map((u, i) => (
            <div key={u + i} className={`relative rounded-xl overflow-hidden border-2 ${i === 0 ? 'border-[#a8c800]' : 'border-[#d2e095]'} bg-[#ecf4d5] aspect-square group`}>
              <img src={u} alt="" className="w-full h-full object-cover" />
              {i === 0 && <span className="absolute top-1 left-1 text-[10px] font-bold bg-[#a8c800] text-white px-1.5 py-0.5 rounded-md">★ {t('img.cover', 'Principale')}</span>}
              <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-black/45 py-1 opacity-90">
                <button type="button" title={t('img.left', 'Avancer')} onClick={() => move(i, -1)} disabled={i === 0} className="text-white text-xs px-1 disabled:opacity-30">◀</button>
                {i !== 0 && <button type="button" title={t('img.set_cover', 'Définir comme principale')} onClick={() => setCover(i)} className="text-white text-xs px-1">★</button>}
                <button type="button" title={t('img.right', 'Reculer')} onClick={() => move(i, 1)} disabled={i === value.length - 1} className="text-white text-xs px-1 disabled:opacity-30">▶</button>
                <button type="button" title={t('img.remove', 'Retirer')} onClick={() => remove(i)} className="text-white text-xs px-1">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <label className={`flex items-center gap-2 cursor-pointer border-2 border-dashed border-[#d2e095] rounded-xl px-3 py-3 text-sm text-[#526500] hover:bg-[#ecf4d5] transition ${uploading || value.length >= MAX_PRODUCT_IMAGES ? 'opacity-50 pointer-events-none' : ''}`}>
        <span>📷</span>
        <span>{uploading ? t('admin.uploading', 'Envoi en cours...') : value.length >= MAX_PRODUCT_IMAGES ? `${t('img.max', 'Maximum')} ${MAX_PRODUCT_IMAGES} ${t('img.photos', 'photos')}` : `${t('img.add', 'Ajouter des photos')} (${value.length}/${MAX_PRODUCT_IMAGES})`}</span>
        <input type="file" accept="image/*" multiple className="hidden" onChange={upload} disabled={uploading || value.length >= MAX_PRODUCT_IMAGES} />
      </label>
      <div className="flex gap-2">
        <input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addUrl(); } }} placeholder={t('img.url_ph', 'ou coller une URL https://… puis Entrée')} className="flex-1 border border-[#d2e095] rounded-xl px-3 py-2 text-xs bg-white focus:outline-none focus:border-[#a8c800]" />
        <button type="button" onClick={addUrl} disabled={!url.trim()} className="text-xs font-semibold border border-[#d2e095] text-[#526500] rounded-xl px-3 hover:bg-[#ecf4d5] disabled:opacity-40">+</button>
      </div>
      <p className="text-[11px] text-gray-400">{t('img.hint', 'La première photo est celle des cartes et des commandes. Format carré conseillé, 5 photos maximum.')}</p>
    </div>
  );
}
