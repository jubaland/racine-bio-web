import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requirePerm } from '../../../../lib/admin-auth';
import { notifyAllUsers, previewAllUsers, announcementEmailAudience, emailAnnouncement } from '../../../../lib/notify';
import { monitored } from '../../../../lib/monitor';

// Diffusion + e-mails envoyés un par un : plus long que les 10 s par défaut d'une fonction Vercel
export const maxDuration = 60;

// GET — historique des annonces diffusées (admin)
async function GET_(request: Request) {
  const auth = await requirePerm(request, ['announcements'], 'view');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const [{ data, error }, { data: gap }] = await Promise.all([
    supabaseAdmin.from('announcements').select('*').order('created_at', { ascending: false }).limit(50),
    supabaseAdmin.from('app_settings').select('value_num').eq('key', 'announce.email_min_gap_hours').maybeSingle(),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ announcements: data || [], settings: { email_min_gap_hours: gap?.value_num != null ? Number(gap.value_num) : null } });
}

// POST — diffuse une annonce : bandeau sur le site + push PWA à tous les abonnés
async function POST_(request: Request) {
  const auth = await requirePerm(request, ['announcements'], 'create');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const { title, body, url, translations, dry, email, action, email_min_gap_hours } = await request.json();

    // Réglage : délai minimal entre deux e-mails d'annonce à un même client (heures ; vide = aucun)
    if (action === 'save_settings') {
      const raw = email_min_gap_hours;
      let value: number | null = null;
      if (raw !== '' && raw != null) {
        value = Number(raw);
        if (!Number.isInteger(value) || value < 1 || value > 8760) return NextResponse.json({ error: 'invalid_value', field: 'email_min_gap_hours' }, { status: 400 });
      }
      await supabaseAdmin.from('app_settings').upsert({ key: 'announce.email_min_gap_hours', value_num: value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      return NextResponse.json({ ok: true, settings: { email_min_gap_hours: value } });
    }
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
    if (dry) {
      const [preview, audience] = await Promise.all([previewAllUsers({ title: cleanTitle, body: cleanBody, url: cleanUrl }, cleanTr), announcementEmailAudience()]);
      return NextResponse.json({ ok: true, dry: true, ...preview, email: { eligible: audience.recipients.length, opted_out: audience.opted_out, recent: audience.recent, no_email: audience.no_email, gap_hours: audience.gap_hours } });
    }

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

    // 4) E-mail aux clients éligibles, si demandé (case « Envoyer aussi par e-mail »)
    let mail: any = null;
    if (email === true) {
      try { mail = await emailAnnouncement({ title: cleanTitle, body: cleanBody, url: cleanUrl }, cleanTr); }
      catch (e: any) { mail = { sent: 0, error: e.message }; }
    }

    return NextResponse.json({ ok: true, announcement: ann, sent: result.sent, total: result.total, recipients: result.recipients, email: mail });
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
