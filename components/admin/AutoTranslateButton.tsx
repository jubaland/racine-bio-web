'use client';

import { useState } from 'react';
import { ask } from '../Dialog';
import { useLanguage } from '../../context/LanguageContext';
import { supabase } from '../../lib/supabase';

// Bouton « Traduire automatiquement » : envoie les textes français à un service de traduction en
// ligne et PRÉREMPLIT les champs de traduction. Rien n'est enregistré : l'admin relit, corrige,
// puis enregistre lui-même. Les champs déjà remplis ne sont remplacés qu'après confirmation.
//
//   <AutoTranslateButton
//      source={{ title: 'Oignons rouges', description: '…' }}            textes français
//      current={{ en: { title: 'Red onions' }, so: {} }}                 ce qui est déjà saisi
//      onTranslated={(lang, fields) => …}                                 appelé pour chaque langue traduite
//   />

type Fields = Record<string, string>;
const LANGS = ['en', 'zh', 'so', 'am'] as const;

export default function AutoTranslateButton({ source, current, onTranslated, disabled, className }: {
  source: Fields;
  current?: Record<string, Partial<Fields> | undefined>;
  onTranslated: (lang: string, fields: Fields, info: { replaced: boolean }) => void;
  disabled?: boolean;
  className?: string;
}) {
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const fields: Fields = Object.fromEntries(Object.entries(source).map(([k, v]) => [k, String(v ?? '').trim()]).filter(([, v]) => v));
  const empty = Object.keys(fields).length === 0;

  const run = async () => {
    setNote(null);
    if (empty) { setNote({ ok: false, text: t('tr.no_source', 'Saisissez d\'abord le texte français.') }); return; }
    // Champs déjà traduits : on demande avant de les remplacer
    const filled = LANGS.some(l => Object.keys(fields).some(k => String(current?.[l]?.[k] || '').trim()));
    let replace = false;
    if (filled) replace = await ask({ text: t('tr.replace_confirm2', 'Certaines traductions sont déjà saisies.\n\nConfirmer : les remplacer par la traduction automatique.\nAnnuler : ne remplir que les champs vides.') });
    setBusy(true);
    try {
      let { data: { session } } = await supabase.auth.getSession();
      if (!session || (session.expires_at && session.expires_at * 1000 < Date.now() + 60000)) session = (await supabase.auth.refreshSession()).data.session;
      const res = await fetch('/api/admin/translate', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` }, body: JSON.stringify({ fields, langs: LANGS }) });
      const j = await res.json();
      if (!res.ok) {
        setNote({ ok: false, text: j.error === 'quota' ? t('tr.err_quota', 'Le quota gratuit du service de traduction est atteint pour aujourd\'hui. Réessayez demain ou saisissez la traduction.')
          : j.error === 'too_long' ? t('tr.err_long', 'Le texte est trop long pour la traduction automatique.')
          : t('tr.err_unavailable', 'Le service de traduction ne répond pas. Réessayez dans un instant.') });
        return;
      }
      let done = 0;
      for (const l of LANGS) {
        const got: Fields = j.translations?.[l] || {};
        const keep: Fields = {};
        for (const [k, v] of Object.entries(got)) if (v && (replace || !String(current?.[l]?.[k] || '').trim())) keep[k] = v;
        if (Object.keys(keep).length) { onTranslated(l, keep, { replaced: replace }); done++; }
      }
      const failed = (j.errors || []).length;
      setNote({ ok: done > 0, text: done === 0 ? t('tr.nothing', 'Tous les champs étaient déjà remplis : rien n\'a été modifié.')
        : `${t('tr.done', 'Traductions proposées. Relisez-les avant d\'enregistrer.')}${failed ? ` ${failed} ${t('tr.partial', 'langue(s) non traduite(s) : réessayez.')}` : ''}` });
    } catch {
      setNote({ ok: false, text: t('tr.err_unavailable', 'Le service de traduction ne répond pas. Réessayez dans un instant.') });
    } finally { setBusy(false); }
  };

  return (
    <div className={className}>
      <button type="button" onClick={run} disabled={disabled || busy}
        className="text-xs font-semibold border border-dashed border-[#a8c800] text-[#526500] bg-white rounded-xl px-3 py-2 hover:bg-[#f6f9e6] transition disabled:opacity-50">
        {busy ? `⏳ ${t('tr.busy', 'Traduction en cours…')}` : `✨ ${t('tr.button', 'Traduire automatiquement')}`}
      </button>
      {note && <p role="status" className={`text-[11px] mt-1 ${note.ok ? 'text-[#526500]' : 'text-red-500'}`}>{note.ok ? '✅' : '⚠️'} {note.text}</p>}
      {!note && <p className="text-[11px] text-gray-400 mt-1">{t('tr.hint', 'Traduction par un service en ligne, à relire : elle peut contenir des erreurs.')}</p>}
    </div>
  );
}
