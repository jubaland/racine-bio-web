'use client';

import { useEffect } from 'react';

// Enregistre le service worker (/sw.js) pour la PWA : installabilité + cache offline.
// Idempotent avec l'enregistrement déjà fait dans le flux push (profil).
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
  return null;
}
