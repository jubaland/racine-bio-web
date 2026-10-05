'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';

// Dialogues intégrés à la page, en remplacement de window.confirm / prompt / alert :
// ces fenêtres du navigateur sont supprimées sans rien afficher par certains navigateurs
// et par la PWA installée (« le bouton ne fait rien »). Un seul <DialogHost /> est monté
// dans la mise en page racine ; partout ailleurs on appelle :
//   await ask({ text })                        → true / false   (remplace confirm)
//   await askText({ text, placeholder? })      → string | null  (remplace prompt ; '' possible)
//   notice(text)                               → bandeau fugace (remplace alert)
// Repli : si l'hôte n'est pas monté (cas limite), les fenêtres du navigateur sont utilisées.

export type AskOptions = { text: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean };
export type AskTextOptions = AskOptions & { placeholder?: string; initial?: string; required?: boolean };
type Question =
  | (AskOptions & { mode: 'confirm'; resolve: (v: boolean) => void })
  | (AskTextOptions & { mode: 'text'; resolve: (v: string | null) => void });

let pushQuestion: ((q: Question) => void) | null = null;
let pushToast: ((text: string) => void) | null = null;

export function ask(opts: AskOptions): Promise<boolean> {
  return new Promise(resolve => {
    if (pushQuestion) pushQuestion({ ...opts, mode: 'confirm', resolve });
    else resolve(typeof window !== 'undefined' && window.confirm(opts.text));
  });
}
export function askText(opts: AskTextOptions): Promise<string | null> {
  return new Promise(resolve => {
    if (pushQuestion) pushQuestion({ ...opts, mode: 'text', resolve });
    else resolve(typeof window !== 'undefined' ? window.prompt(opts.text, opts.initial ?? '') : null);
  });
}
export function notice(text: string) {
  if (pushToast) pushToast(text);
  else if (typeof window !== 'undefined') window.alert(text);
}

export default function DialogHost() {
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;
  const [queue, setQueue] = useState<Question[]>([]);
  const [value, setValue] = useState('');
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const nextId = useRef(1);
  const q = queue[0] || null;

  useEffect(() => {
    pushQuestion = (question) => { setQueue(prev => [...prev, question]); setValue(''); };
    pushToast = (text) => {
      const id = nextId.current++;
      setToasts(prev => [...prev.slice(-2), { id, text }]);
      setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), 8000);
    };
    return () => { pushQuestion = null; pushToast = null; };
  }, []);
  useEffect(() => { setValue(q && q.mode === 'text' ? (q.initial ?? '') : ''); }, [q]);

  const close = useCallback((result: boolean) => {
    if (!q) return;
    if (q.mode === 'confirm') q.resolve(result);
    else q.resolve(result ? value : null);
    setQueue(prev => prev.slice(1));
  }, [q, value]);

  useEffect(() => {
    if (!q) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [q, close]);

  return (
    <>
      {q && (
        <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={() => close(false)} role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl shadow-xl border-2 border-[#d2e095] w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
            <p className="text-sm text-gray-800 whitespace-pre-line">{q.text}</p>
            {q.mode === 'text' && (
              <input
                autoFocus
                value={value}
                maxLength={300}
                onChange={e => setValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (!q.required || value.trim())) close(true); }}
                placeholder={q.placeholder || ''}
                className="mt-3 w-full border border-[#d2e095] rounded-xl px-3 py-2.5 text-sm bg-[#faf7e8] focus:outline-none focus:border-[#a8c800]"
              />
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => close(false)} className="px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50">
                {q.cancelLabel || t('dlg.cancel', 'Annuler')}
              </button>
              <button
                onClick={() => close(true)}
                disabled={q.mode === 'text' && q.required === true && !value.trim()}
                className={`px-4 py-2 rounded-xl text-sm font-bold text-white transition disabled:opacity-40 ${q.danger ? 'bg-[#f97316] hover:bg-[#ea580c]' : 'bg-[#a8c800] hover:bg-[#7d9800]'}`}
              >
                {q.confirmLabel || t('dlg.confirm', 'Confirmer')}
              </button>
            </div>
          </div>
        </div>
      )}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[95] space-y-2 max-w-[92vw]">
          {toasts.map(x => (
            <div key={x.id} className="bg-white border-2 border-[#d2e095] shadow-lg rounded-xl px-4 py-2.5 text-sm font-medium text-gray-700 flex items-center gap-3">
              <span className="whitespace-pre-line">{x.text}</span>
              <button onClick={() => setToasts(prev => prev.filter(y => y.id !== x.id))} aria-label={t('admin.close', 'Fermer')} className="text-gray-400 hover:text-gray-600 flex-none">✕</button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
