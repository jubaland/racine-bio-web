'use client';

import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

// Surveillance : signale au serveur les erreurs survenues dans le navigateur (erreur JavaScript,
// promesse rejetée). Silencieux, borné (quelques envois par page, une fois par erreur), sans
// donnée personnelle : message, pile d'appels, chemin de la page, langue, taille d'écran.
const MAX_PER_PAGE = 5;

export default function ErrorReporter() {
  useEffect(() => {
    const seen = new Set<string>();
    let sent = 0;
    const send = async (kind: string, message: string, stack?: string) => {
      const msg = String(message || '').slice(0, 500);
      if (!msg || sent >= MAX_PER_PAGE || seen.has(msg)) return;
      seen.add(msg); sent++;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        await fetch('/api/errors', {
          method: 'POST', keepalive: true,
          headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
          body: JSON.stringify({ kind, message: msg, stack: stack ? String(stack).slice(0, 3000) : undefined, url: window.location.pathname, lang: localStorage.getItem('lang') || 'fr', viewport: `${window.innerWidth}x${window.innerHeight}` }),
        });
      } catch { /* jamais bloquant */ }
    };
    const onError = (e: ErrorEvent) => { send('error', e.message || String(e.error), e.error?.stack); };
    const onRejection = (e: PromiseRejectionEvent) => { const r: any = e.reason; send('promise', r?.message || String(r), r?.stack); };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => { window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onRejection); };
  }, []);
  return null;
}
