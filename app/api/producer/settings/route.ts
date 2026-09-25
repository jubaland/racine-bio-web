import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requireMerchant } from '../../../../lib/producer-auth';

// Préférences du marchand — GET → { email_mode } ; POST { email_mode: 'instant' | 'daily' }
export async function GET(request: Request) {
  const auth = await requireMerchant(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { data } = await supabaseAdmin.from('merchant_profiles').select('email_mode, digest_sent_at').eq('user_id', auth.user.id).maybeSingle();
  return NextResponse.json({ email_mode: data?.email_mode || 'instant', digest_sent_at: data?.digest_sent_at || null });
}

export async function POST(request: Request) {
  const auth = await requireMerchant(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  let body: any = {};
  try { body = await request.json(); } catch { /* ignore */ }
  const mode = body.email_mode === 'daily' ? 'daily' : body.email_mode === 'instant' ? 'instant' : null;
  if (!mode) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const { error } = await supabaseAdmin.from('merchant_profiles').update({ email_mode: mode }).eq('user_id', auth.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, email_mode: mode });
}
