'use client';

import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

// Enregistre le service worker (/sw.js) pour la PWA : installabilité + cache offline.
// Ré-abonne aussi SILENCIEUSEMENT au push à chaque ouverture si l'autorisation est
// déjà accordée mais que l'abonnement a expiré (ex. après une longue inactivité) —
// sans jamais demander la permission ici (iOS la bloque hors geste utilisateur).
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        if (!('PushManager' in window) || Notification.permission !== 'granted') return;
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return; // ré-abonnement lié au compte uniquement
        const existing = await reg.pushManager.getSubscription();
        if (existing) return;
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidKey) return;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
        await fetch('/api/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ subscription: sub.toJSON(), action: 'subscribe' }),
        });
      } catch { /* silencieux : ne doit jamais gêner la navigation */ }
    })();
  }, []);
  return null;
}
