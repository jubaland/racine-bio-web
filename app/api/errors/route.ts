import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-admin';
import { reportError, monitorSettings } from '../../../lib/monitor';

// POST — erreur survenue dans le navigateur d'un client (components/ErrorReporter.tsx).
// Ouverte à tous (un visiteur anonyme peut rencontrer une erreur) : tailles bornées, rien de sensible
// accepté, et une même erreur ne crée qu'une ligne (compteur). Peut être coupée dans les réglages.
const MAX = { message: 500, stack: 3000, url: 300 };
const NOISE = /ResizeObserver loop|^Script error\.?$|chrome-extension:|moz-extension:|safari-extension:|Load failed|NetworkError when attempting|Failed to fetch|AbortError|The operation was aborted/i;

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    if (raw.length > 8000) return NextResponse.json({ ok: false, error: 'too_large' }, { status: 413 });
    let b: any = {};
    try { b = JSON.parse(raw); } catch { return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 }); }
    const message = String(b.message || '').trim().slice(0, MAX.message);
    if (!message) return NextResponse.json({ ok: false, error: 'message_required' }, { status: 400 });
    // Bruit connu (extensions du navigateur, coupures réseau du client) : ignoré sans erreur
    if (NOISE.test(message) || NOISE.test(String(b.stack || ''))) return NextResponse.json({ ok: true, ignored: true });
    if (!(await monitorSettings()).client_enabled) return NextResponse.json({ ok: true, ignored: true });

    let userId: string | null = null;
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (token) { try { const { data } = await supabaseAdmin.auth.getUser(token); userId = data.user?.id || null; } catch { /* anonyme */ } }

    // Chemin de la page seulement : jamais les paramètres d'adresse (ils peuvent contenir un jeton)
    let path: string | null = null;
    try { path = new URL(String(b.url || ''), 'https://x').pathname.slice(0, MAX.url); } catch { /* ignore */ }
    const err = new Error(message);
    err.stack = b.stack ? String(b.stack).slice(0, MAX.stack).replace(/\?[^\s:)]*/g, '') : undefined;
    const r = await reportError(err, { source: 'client', route: path, userId, context: { langue: b.lang, ecran: b.viewport, type: b.kind } });
    return NextResponse.json({ ok: true, recorded: !!r });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });   // la collecte ne doit jamais gêner le client
  }
}
