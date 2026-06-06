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

  await Promise.allSettled(
    subs.map(async sub => {
      try {
        const res = await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        );
        console.log('[push] user sendNotification ok, statusCode:', res?.statusCode);
      } catch (e: any) {
        if (e?.statusCode === 410 || e?.statusCode === 404) {
          await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
          console.log('[push] removed expired subscription (user)');
        } else console.error('[push] user sendNotification failed:', e?.statusCode, e?.body);
      }
    })
  );
}

export async function sendPushToAdmin(payload: { title: string; body: string; url?: string }) {
  // Log en base — awaité pour garantir l'exécution en serverless
  const { error: insertError } = await supabaseAdmin.from('admin_notifications')
    .insert({ title: payload.title, body: payload.body ?? null, url: payload.url ?? null });
  if (insertError) console.error('[push] admin_notifications insert error:', insertError.message);
  else console.log('[push] admin_notifications insert ok');

  const ready = initVapid();
  console.log('[push] sendPushToAdmin | initVapid:', ready);
  if (!ready) return;

  const { data: subs, error } = await supabaseAdmin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('is_admin', true);

  console.log('[push] subs for admin:', subs?.length ?? 0, '| error:', error?.message ?? 'none');
  if (!subs || subs.length === 0) return;

  await Promise.allSettled(
    subs.map(async sub => {
      try {
        const res = await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        );
        console.log('[push] admin sendNotification ok, statusCode:', res?.statusCode);
      } catch (e: any) {
        if (e?.statusCode === 410 || e?.statusCode === 404) {
          await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
          console.log('[push] removed expired subscription (admin)');
        } else console.error('[push] admin sendNotification failed:', e?.statusCode, e?.body);
      }
    })
  );
}
