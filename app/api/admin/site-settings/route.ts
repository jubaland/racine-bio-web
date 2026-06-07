import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';

// Réglages d'affichage du site (service role).
export async function GET() {
  const { data, error } = await supabaseAdmin.from('site_settings').select('key, value');
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const settings: Record<string, boolean> = {};
  (data || []).forEach((r: any) => { settings[r.key] = r.value; });
  return NextResponse.json({ settings });
}

export async function POST(request: Request) {
  const { key, value } = await request.json();
  if (!key || typeof value !== 'boolean') {
    return NextResponse.json({ error: 'key et value (booléen) requis' }, { status: 400 });
  }
  const { error } = await supabaseAdmin.from('site_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
