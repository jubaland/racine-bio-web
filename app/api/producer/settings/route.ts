import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requireMerchant } from '../../../../lib/producer-auth';
import { toIntlPhone } from '../../../../lib/whatsapp';

// Préférences du marchand — GET → { email_mode, digest_sent_at, whatsapp }
// POST { email_mode?: 'instant' | 'daily', whatsapp?: string | null } (numéro Djibouti 8 chiffres ou international)
export async function GET(request: Request) {
  const auth = await requireMerchant(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { data } = await supabaseAdmin.from('merchant_profiles').select('email_mode, digest_sent_at, whatsapp').eq('user_id', auth.user.id).maybeSingle();
  return NextResponse.json({ email_mode: data?.email_mode || 'instant', digest_sent_at: data?.digest_sent_at || null, whatsapp: data?.whatsapp || null });
}

export async function POST(request: Request) {
  const auth = await requireMerchant(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  let body: any = {};
  try { body = await request.json(); } catch { /* ignore */ }
  const patch: Record<string, any> = {};
  if ('email_mode' in body) {
    const mode = body.email_mode === 'daily' ? 'daily' : body.email_mode === 'instant' ? 'instant' : null;
    if (!mode) return NextResponse.json({ error: 'email_mode invalide' }, { status: 400 });
    patch.email_mode = mode;
  }
  if ('whatsapp' in body) {
    // WhatsApp public (vitrine, fiches produit) : vide = retiré ; sinon numéro valide obligatoire
    if (body.whatsapp == null || String(body.whatsapp).trim() === '') patch.whatsapp = null;
    else { const n = toIntlPhone(String(body.whatsapp)); if (!n) return NextResponse.json({ error: 'whatsapp_invalid' }, { status: 400 }); patch.whatsapp = n; }
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'rien à modifier' }, { status: 400 });
  const { error } = await supabaseAdmin.from('merchant_profiles').update(patch).eq('user_id', auth.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, ...patch });
}
