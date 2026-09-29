import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from './supabase-admin';

// ── Surveillance des erreurs ─────────────────────────────────────────────────
// reportError()  : enregistre une erreur (une ligne par erreur non résolue, compteur ensuite) et alerte
//                  l'admin à la première apparition puis au plus une fois par délai. Ne lève jamais.
// monitored()    : enveloppe une route d'API — une exception devient une réponse 500 propre et est
//                  enregistrée ; une réponse 5xx renvoyée par la route l'est aussi ; pour les tâches
//                  planifiées, un rapport contenant des erreurs est enregistré.
// Aucune donnée sensible : ni corps de requête, ni jeton ; le contexte est filtré et tronqué.
// Réglages : app_settings monitor.* (admin › Surveillance).

export type ErrorSource = 'server' | 'cron' | 'client';
export type MonitorSettings = { alert_enabled: boolean; alert_email: boolean; alert_cooldown_min: number | null; alert_client: boolean; client_enabled: boolean; retention_days: number | null };
export const MONITOR_KEYS = ['alert_enabled', 'alert_email', 'alert_cooldown_min', 'alert_client', 'client_enabled', 'retention_days'] as const;
const FLAGS = new Set(['alert_enabled', 'alert_email', 'alert_client', 'client_enabled']);

export async function monitorSettings(): Promise<MonitorSettings> {
  const { data } = await supabaseAdmin.from('app_settings').select('key, value_num').like('key', 'monitor.%');
  const v: Record<string, number | null> = Object.fromEntries((data || []).map((r: any) => [r.key.replace('monitor.', ''), r.value_num != null ? Number(r.value_num) : null]));
  return {
    alert_enabled: v.alert_enabled === 1, alert_email: v.alert_email === 1, alert_client: v.alert_client === 1, client_enabled: v.client_enabled === 1,
    alert_cooldown_min: v.alert_cooldown_min ?? null, retention_days: v.retention_days ?? null,
  };
}
export async function saveMonitorSettings(patch: Partial<Record<typeof MONITOR_KEYS[number], boolean | number | null>>) {
  const now = new Date().toISOString();
  const rows = MONITOR_KEYS.filter(k => k in patch).map(k => ({ key: `monitor.${k}`, value_num: FLAGS.has(k) ? (patch[k] ? 1 : 0) : (patch[k] as number | null), updated_at: now }));
  if (rows.length) await supabaseAdmin.from('app_settings').upsert(rows, { onConflict: 'key' });
}

const SECRET = /pass|token|secret|authorization|cookie|api[_-]?key|otp|pin/i;
const cut = (s: unknown, n: number) => { const x = String(s ?? ''); return x.length > n ? x.slice(0, n) + '…' : x; };

/** Contexte sûr : valeurs simples seulement, clés sensibles masquées, longueurs bornées. */
export function safeContext(ctx: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!ctx) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ctx).slice(0, 20)) {
    if (v == null) continue;
    if (SECRET.test(k)) { out[k] = '***'; continue; }
    out[k] = typeof v === 'number' || typeof v === 'boolean' ? v : cut(typeof v === 'string' ? v : JSON.stringify(v), 300);
  }
  return Object.keys(out).length ? out : null;
}

/** Message sans éléments variables (nombres, identifiants) : deux occurrences d'une même erreur se regroupent. */
const normalize = (m: string) => m.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '<id>').replace(/\d+/g, '<n>').replace(/\s+/g, ' ').trim().slice(0, 200);
const firstFrame = (stack?: string | null) => (stack || '').split('\n').map(l => l.trim()).find(l => l.startsWith('at ') && !l.includes('node_modules') && !l.includes('node:')) || '';
// Cadre d'appel sans ce qui varie d'une version ou d'une requête à l'autre : paramètres d'adresse, ligne et colonne
const frameKey = (stack?: string | null) => firstFrame(stack).replace(/\?[^\s:)]*/g, '').replace(/[():\d]+$/, '');
export const fingerprintOf = (source: string, route: string | null | undefined, message: string, stack?: string | null) =>
  createHash('sha1').update([source, route || '', normalize(message), frameKey(stack)].join('|')).digest('hex').slice(0, 20);

export type ErrorInput = { source?: ErrorSource; route?: string | null; method?: string | null; status?: number | null; userId?: string | null; context?: Record<string, unknown> | null };

export async function reportError(err: unknown, info: ErrorInput = {}): Promise<{ id: number; count: number; is_new: boolean; alert: boolean } | null> {
  try {
    const e = err instanceof Error ? err : new Error(typeof err === 'string' ? err : (() => { try { return JSON.stringify(err); } catch { return String(err); } })());
    const source = info.source || 'server';
    const message = cut(e.message || 'Erreur sans message', 500);
    const stack = e.stack ? cut(e.stack, 4000) : null;
    const settings = await monitorSettings();
    const { data, error } = await supabaseAdmin.rpc('error_log_record', {
      p_fingerprint: fingerprintOf(source, info.route, message, stack), p_source: source, p_route: info.route ? cut(info.route, 200) : null,
      p_method: info.method || null, p_status: info.status ?? null, p_message: message, p_stack: stack,
      p_user: info.userId || null, p_context: safeContext(info.context), p_cooldown_min: settings.alert_cooldown_min,
    });
    if (error) { console.error('[monitor] enregistrement impossible :', error.message); return null; }
    const r = data as { id: number; count: number; is_new: boolean; alert: boolean };
    if (r.alert && settings.alert_enabled && (source !== 'client' || settings.alert_client)) {
      const where = info.route ? `${info.method ? info.method + ' ' : ''}${info.route}` : source;
      const title = source === 'cron' ? '🚨 Erreur dans une tâche planifiée' : source === 'client' ? '🚨 Erreur chez un client' : '🚨 Erreur sur le site';
      const body = `${where} — ${cut(message, 140)}${r.count > 1 ? ` (${r.count} fois)` : ''}`;
      try { const { sendPushToAdmin } = await import('./push'); await sendPushToAdmin({ title, body, url: '/admin' }); } catch (x) { console.error('[monitor] alerte push :', x); }
      if (settings.alert_email) {
        try { const { sendErrorAlert } = await import('./emails'); await sendErrorAlert({ title, where, message, count: r.count, source }); } catch (x) { console.error('[monitor] alerte e-mail :', x); }
      }
    }
    return r;
  } catch (x) {
    console.error('[monitor] reportError a échoué :', x);
    return null;
  }
}

type Handler = (request: any, ctx?: any) => Promise<Response> | Response;

/** Enveloppe une route d'API (voir en-tête). `route` : chemin affiché dans le journal, ex. « /api/orders ». */
export function monitored(route: string, handler: Handler): (request: any, ctx?: any) => Promise<Response> {
  const source: ErrorSource = route.startsWith('/api/cron') ? 'cron' : 'server';
  return async (request: any, ctx?: any) => {
    const method = request.method;
    try {
      const res = await handler(request, ctx);
      if (res.status >= 500) {
        let message = `Réponse ${res.status}`;
        try { const j = await res.clone().json(); if (j?.error) message = typeof j.error === 'string' ? j.error : JSON.stringify(j.error); } catch { /* corps non JSON */ }
        await reportError(new Error(message), { source, route, method, status: res.status });
      } else if (source === 'cron' && res.status === 200) {
        // Tâche terminée mais avec des erreurs dans son rapport
        try {
          const j = await res.clone().json();
          const errs: string[] = [
            ...(Array.isArray(j?.errors) ? j.errors : []),
            ...(Array.isArray(j?.results) ? j.results.filter((x: any) => x?.error).map((x: any) => `${x.user || x.company || ''} ${x.error}`.trim()) : []),
            ...[j?.reminders?.error, j?.companies?.error].filter(Boolean),
          ].map(String);
          if (errs.length) await reportError(new Error(errs[0]), { source, route, method, status: 200, context: { erreurs: errs.length, detail: errs.slice(0, 5).join(' | ') } });
        } catch { /* corps non JSON */ }
      }
      return res;
    } catch (e: any) {
      // Redirections et « not found » de Next ne sont pas des erreurs
      if (typeof e?.digest === 'string' && /^(NEXT_REDIRECT|NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK)/.test(e.digest)) throw e;
      await reportError(e, { source, route, method, status: 500 });
      return NextResponse.json({ error: 'Erreur interne. Notre équipe est prévenue.' }, { status: 500 });
    }
  };
}
