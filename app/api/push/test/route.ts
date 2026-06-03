import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import webpush from 'web-push';

export async function POST(request: Request) {
  try {
    const auth = request.headers.get('Authorization');
    const token = auth?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const subject = process.env.VAPID_SUBJECT;
    const pub     = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const priv    = process.env.VAPID_PRIVATE_KEY;

    if (!subject || !pub || !priv) {
      return NextResponse.json({ error: `VAPID vars missing: subject=${!!subject} pub=${!!pub} priv=${!!priv}` }, { status: 500 });
    }

    webpush.setVapidDetails(subject, pub, priv);

    const { data: subs, error: subErr } = await supabaseAdmin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', user.id);

    if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 });
    if (!subs || subs.length === 0) return NextResponse.json({ error: 'No subscription found for this user' }, { status: 404 });

    const results = await Promise.allSettled(
      subs.map(sub =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title: '🧪 Test notification', body: 'Si tu vois ça, les push fonctionnent !', url: '/profile' })
        )
      )
    );

    const report = results.map((r, i) =>
      r.status === 'fulfilled'
        ? { i, ok: true, statusCode: r.value?.statusCode }
        : { i, ok: false, error: String(r.reason) }
    );

    return NextResponse.json({ report });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
