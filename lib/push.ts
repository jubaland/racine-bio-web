import webpush from 'web-push';
import { supabaseAdmin } from './supabase-admin';

function initVapid() {
  const subject = process.env.VAPID_SUBJECT;
  const pub     = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv    = process.env.VAPID_PRIVATE_KEY;
  console.log('[push] VAPID subject:', subject ? 'ok' : 'MISSING', '| pub:', pub ? pub.slice(0,10)+'...' : 'MISSING', '| priv:', priv ? 'ok' : 'MISSING');
  if (!subject || !pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  return true;
}

export async function sendPushToUser(userId: string, payload: { title: string; body: string; url?: string }) {
  const ready = initVapid();
  console.log('[push] sendPushToUser | initVapid:', ready, '| userId:', userId);
  if (!ready) return;

  const { data: subs, error } = await supabaseAdmin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId);

  console.log('[push] subs for user:', subs?.length ?? 0, '| error:', error?.message ?? 'none');
  if (!subs || subs.length === 0) return;

  const results = await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      )
    )
  );
  results.forEach((r, i) => {
    if (r.status === 'rejected') console.error('[push] sendNotification[' + i + '] failed:', r.reason);
    else console.log('[push] sendNotification[' + i + '] ok, statusCode:', r.value?.statusCode);
  });
}

export async function sendPushToAdmin(payload: { title: string; body: string; url?: string }) {
  const ready = initVapid();
  console.log('[push] sendPushToAdmin | initVapid:', ready);
  if (!ready) return;

  const { data: subs, error } = await supabaseAdmin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('is_admin', true);

  console.log('[push] subs for admin:', subs?.length ?? 0, '| error:', error?.message ?? 'none');
  if (!subs || subs.length === 0) return;

  const results = await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      )
    )
  );
  results.forEach((r, i) => {
    if (r.status === 'rejected') console.error('[push] admin sendNotification[' + i + '] failed:', r.reason);
    else console.log('[push] admin sendNotification[' + i + '] ok, statusCode:', r.value?.statusCode);
  });
}
