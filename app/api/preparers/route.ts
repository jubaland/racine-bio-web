import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-admin';
import { requirePerm } from '../../../lib/admin-auth';
import { monitored } from '../../../lib/monitor';

// Préparateurs de commandes — admin / gestionnaire avec droit "Préparateurs".

async function GET_(request: Request) {
  const auth = await requirePerm(request, 'preparers', 'view');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { data, error } = await supabaseAdmin
    .from('preparers')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ preparers: data });
}

async function POST_(request: Request) {
  const auth = await requirePerm(request, 'preparers', 'create');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { name, email } = await request.json();
  if (!name?.trim() || !email?.trim()) {
    return NextResponse.json({ error: 'Nom et email requis.' }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin
    .from('preparers')
    .insert({ name: name.trim(), email: email.trim().toLowerCase() })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ preparer: data });
}

async function PATCH_(request: Request) {
  const auth = await requirePerm(request, 'preparers', 'edit');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id, name, email, is_active } = await request.json();
  const patch: Record<string, any> = {};
  if (name !== undefined) patch.name = String(name).trim();
  if (email !== undefined) patch.email = String(email).trim().toLowerCase();
  if (is_active !== undefined) patch.is_active = !!is_active;
  const { error } = await supabaseAdmin.from('preparers').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

async function DELETE_(request: Request) {
  const auth = await requirePerm(request, 'preparers', 'delete');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await request.json();
  const { error } = await supabaseAdmin.from('preparers').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

// Surveillance : exceptions et réponses 5xx enregistrées (lib/monitor.ts)
export const GET = monitored('/api/preparers', GET_);
export const POST = monitored('/api/preparers', POST_);
export const PATCH = monitored('/api/preparers', PATCH_);
export const DELETE = monitored('/api/preparers', DELETE_);
