import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requirePerm } from '../../../../lib/admin-auth';
import { notifyAllUsers } from '../../../../lib/notify';

// GET — historique des annonces diffusées (admin)
export async function GET(request: Request) {
  const auth = await requirePerm(request, ['announcements'], 'view');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await supabaseAdmin
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ announcements: data || [] });
}

// POST — diffuse une annonce : bandeau sur le site + push PWA à tous les abonnés
export async function POST(request: Request) {
  const auth = await requirePerm(request, ['announcements'], 'create');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const { title, body, url } = await request.json();
    if (!title || !String(title).trim()) {
      return NextResponse.json({ error: 'Titre requis' }, { status: 400 });
    }

    const cleanTitle = String(title).trim().slice(0, 120);
    const cleanBody = body ? String(body).trim().slice(0, 300) : null;
    const cleanUrl = url ? String(url).trim().slice(0, 300) : null;

    // 1) Désactive les anciennes annonces (une seule active à la fois sur le bandeau)
    await supabaseAdmin.from('announcements').update({ active: false }).eq('active', true);

    // 2) Enregistre la nouvelle annonce (bandeau du site)
    const { data: ann, error: insErr } = await supabaseAdmin
      .from('announcements')
      .insert({ title: cleanTitle, body: cleanBody, url: cleanUrl, active: true })
      .select()
      .single();
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

    // 3) Centre de notifications de chaque client + push PWA à tous les abonnés
    const result = await notifyAllUsers({
      title: cleanTitle,
      body: cleanBody,
      url: cleanUrl || '/',
    });

    return NextResponse.json({ ok: true, announcement: ann, sent: result.sent, total: result.total, recipients: result.recipients });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE — désactive l'annonce courante (retire le bandeau du site)
export async function DELETE(request: Request) {
  const auth = await requirePerm(request, ['announcements'], 'create');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { error } = await supabaseAdmin.from('announcements').update({ active: false }).eq('active', true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
