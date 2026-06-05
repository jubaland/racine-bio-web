import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-admin';

// Préparateurs de commandes — accès service role uniquement (emails non exposés publiquement).

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('preparers')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ preparers: data });
}

export async function POST(request: Request) {
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

export async function PATCH(request: Request) {
  const { id, name, email, is_active } = await request.json();
  const patch: Record<string, any> = {};
  if (name !== undefined) patch.name = String(name).trim();
  if (email !== undefined) patch.email = String(email).trim().toLowerCase();
  if (is_active !== undefined) patch.is_active = !!is_active;
  const { error } = await supabaseAdmin.from('preparers').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const { id } = await request.json();
  const { error } = await supabaseAdmin.from('preparers').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
