import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requirePerm } from '../../../../lib/admin-auth';
import { notifyAllUsers, previewAllUsers } from '../../../../lib/notify';
import { monitored } from '../../../../lib/monitor';

// GET — historique des annonces diffusées (admin)
async function GET_(request: Request) {
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
async function POST_(request: Request) {
  const auth = await requirePerm(request, ['announcements'], 'create');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const { title, body, url, translations, dry } = await request.json();
    if (!title || !String(title).trim()) {
      return NextResponse.json({ error: 'Titre requis' }, { status: 400 });
    }

    const cleanTitle = String(title).trim().slice(0, 120);
    const cleanBody = body ? String(body).trim().slice(0, 300) : null;
    const cleanUrl = url ? String(url).trim().slice(0, 300) : null;
    // Traductions facultatives du bandeau : { en: { title, body }, … } ; une langue sans titre est ignorée
    const cleanTr: Record<string, { title: string; body: string | null }> = {};
    for (const lang of ['en', 'zh', 'am', 'so', 'aa']) {
      const v = translations?.[lang];
      const tt = v?.title ? String(v.title).trim().slice(0, 120) : '';
      if (tt) cleanTr[lang] = { title: tt, body: v?.body ? String(v.body).trim().slice(0, 300) || null : null };
    }

    // Aperçu : qui recevra quoi, par langue — rien n'est enregistré ni envoyé
    if (dry) return NextResponse.json({ ok: true, dry: true, ...(await previewAllUsers({ title: cleanTitle, body: cleanBody, url: cleanUrl }, cleanTr)) });

    // 1) Désactive les anciennes annonces (une seule active à la fois sur le bandeau)
    await supabaseAdmin.from('announcements').update({ active: false }).eq('active', true);

    // 2) Enregistre la nouvelle annonce (bandeau du site)
    const { data: ann, error: insErr } = await supabaseAdmin
      .from('announcements')
      .insert({ title: cleanTitle, body: cleanBody, url: cleanUrl, active: true, translations: Object.keys(cleanTr).length ? cleanTr : null })
      .select()
      .single();
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

    // 3) Centre de notifications de chaque client + push PWA à tous les abonnés
    // Chaque client reçoit la version de sa langue si elle a été saisie, le français sinon
    const result = await notifyAllUsers({
      title: cleanTitle,
      body: cleanBody,
      url: cleanUrl || '/',
    }, cleanTr);

    return NextResponse.json({ ok: true, announcement: ann, sent: result.sent, total: result.total, recipients: result.recipients });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE — désactive l'annonce courante (retire le bandeau du site)
async function DELETE_(request: Request) {
  const auth = await requirePerm(request, ['announcements'], 'create');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { error } = await supabaseAdmin.from('announcements').update({ active: false }).eq('active', true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Surveillance : exceptions et réponses 5xx enregistrées (lib/monitor.ts)
export const GET = monitored('/api/admin/broadcast', GET_);
export const POST = monitored('/api/admin/broadcast', POST_);
export const DELETE = monitored('/api/admin/broadcast', DELETE_);
