import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requirePerm } from '../../../../lib/admin-auth';
import { monitorSettings, saveMonitorSettings, reportError, monitored } from '../../../../lib/monitor';

// Admin › Surveillance
// GET  ?state=open|resolved            → erreurs (les plus récentes d'abord), compteurs, réglages
// POST { action }
//   resolve { id } | resolve_all | reopen { id } | delete_resolved
//   save_settings { alert_enabled, alert_email, alert_client, client_enabled, alert_cooldown_min, retention_days }
//   test                               → enregistre une erreur d'essai (vérifie toute la chaîne, alerte comprise)
const MAX_DAYS = 365, MAX_MIN = 10080;

async function GET_(request: Request) {
  const auth = await requirePerm(request, 'monitoring', 'view');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const state = new URL(request.url).searchParams.get('state') === 'resolved' ? 'resolved' : 'open';
  let q = supabaseAdmin.from('error_logs').select('*').order('last_seen', { ascending: false }).limit(200);
  q = state === 'open' ? q.is('resolved_at', null) : q.not('resolved_at', 'is', null);
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const [{ data, error }, open, resolved, recent, settings] = await Promise.all([
    q,
    supabaseAdmin.from('error_logs').select('id', { count: 'exact', head: true }).is('resolved_at', null),
    supabaseAdmin.from('error_logs').select('id', { count: 'exact', head: true }).not('resolved_at', 'is', null),
    supabaseAdmin.from('error_logs').select('id', { count: 'exact', head: true }).is('resolved_at', null).gte('last_seen', since),
    monitorSettings(),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ state, errors: data || [], counts: { open: open.count || 0, resolved: resolved.count || 0, last_24h: recent.count || 0 }, settings });
}

async function POST_(request: Request) {
  const auth = await requirePerm(request, 'monitoring', 'edit');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  let body: any = {};
  try { body = await request.json(); } catch { /* ignore */ }
  const now = new Date().toISOString();
  const { action } = body;

  if (action === 'resolve' || action === 'reopen') {
    const id = Number(body.id);
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 });
    if (action === 'reopen') {
      // Une erreur identique a pu réapparaître depuis : une seule ligne ouverte par empreinte
      const { data: row } = await supabaseAdmin.from('error_logs').select('fingerprint').eq('id', id).maybeSingle();
      if (!row) return NextResponse.json({ error: 'introuvable' }, { status: 404 });
      const { data: twin } = await supabaseAdmin.from('error_logs').select('id').eq('fingerprint', row.fingerprint).is('resolved_at', null).maybeSingle();
      if (twin) return NextResponse.json({ error: 'already_open' }, { status: 409 });
    }
    const { data, error } = await supabaseAdmin.from('error_logs')
      .update(action === 'resolve' ? { resolved_at: now, resolved_by: auth.user.id } : { resolved_at: null, resolved_by: null })
      .eq('id', id).select('id');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data?.length) return NextResponse.json({ error: 'introuvable' }, { status: 404 });
    return NextResponse.json({ ok: true });
  }
  if (action === 'resolve_all') {
    const { data, error } = await supabaseAdmin.from('error_logs').update({ resolved_at: now, resolved_by: auth.user.id }).is('resolved_at', null).select('id');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, resolved: data?.length || 0 });
  }
  if (action === 'delete_resolved') {
    const { data, error } = await supabaseAdmin.from('error_logs').delete().not('resolved_at', 'is', null).select('id');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, deleted: data?.length || 0 });
  }
  if (action === 'save_settings') {
    const patch: Record<string, boolean | number | null> = {};
    for (const k of ['alert_enabled', 'alert_email', 'alert_client', 'client_enabled']) if (k in body) patch[k] = !!body[k];
    for (const [k, max] of [['alert_cooldown_min', MAX_MIN], ['retention_days', MAX_DAYS], ['code_attempts_15min', 10000], ['guest_orders_hour', 10000]] as const) {
      if (!(k in body)) continue;
      const raw = body[k];
      if (raw === '' || raw == null) { patch[k] = null; continue; }      // vide : pas de délai / pas de purge
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 1 || n > max) return NextResponse.json({ error: `Valeur invalide (entier de 1 à ${max})`, field: k }, { status: 400 });
      patch[k] = n;
    }
    await saveMonitorSettings(patch);
    return NextResponse.json({ ok: true, settings: await monitorSettings() });
  }
  if (action === 'test') {
    const r = await reportError(new Error('Erreur d\'essai déclenchée depuis Admin › Surveillance'), { source: 'server', route: '/api/admin/monitoring', method: 'POST', status: 500, userId: auth.user.id, context: { essai: true } });
    if (!r) return NextResponse.json({ error: 'Enregistrement impossible' }, { status: 500 });
    return NextResponse.json({ ok: true, ...r });
  }
  return NextResponse.json({ error: 'action invalide' }, { status: 400 });
}

export const GET = monitored('/api/admin/monitoring', GET_);
export const POST = monitored('/api/admin/monitoring', POST_);
