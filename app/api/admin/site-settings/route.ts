import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requirePerm } from '../../../../lib/admin-auth';
import { monitored } from '../../../../lib/monitor';

// Réglages d'affichage du site (admin / gestionnaire avec droit "Page d'accueil").
async function GET_(request: Request) {
  const auth = await requirePerm(request, 'homepage', 'view');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { data, error } = await supabaseAdmin.from('site_settings').select('key, value');
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const settings: Record<string, boolean> = {};
  (data || []).forEach((r: any) => { settings[r.key] = r.value; });
  return NextResponse.json({ settings });
}

async function POST_(request: Request) {
  const auth = await requirePerm(request, 'homepage', 'edit');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { key, value } = await request.json();
  if (!key || typeof value !== 'boolean') {
    return NextResponse.json({ error: 'key et value (booléen) requis' }, { status: 400 });
  }
  const { error } = await supabaseAdmin.from('site_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

// Surveillance : exceptions et réponses 5xx enregistrées (lib/monitor.ts)
export const GET = monitored('/api/admin/site-settings', GET_);
export const POST = monitored('/api/admin/site-settings', POST_);
