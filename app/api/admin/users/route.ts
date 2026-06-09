import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { roleOf } from '../../../../lib/permissions';

// Vérifie que l'appelant est administrateur (via son JWT).
async function requireAdmin(request: Request): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '').trim();
  if (!token) return { ok: false, status: 401, error: 'Non authentifié' };
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return { ok: false, status: 401, error: 'Token invalide' };
  if (roleOf(user.user_metadata) !== 'admin') return { ok: false, status: 403, error: 'Accès refusé' };
  return { ok: true };
}

// Liste de tous les comptes (admin uniquement).
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const { data: wallets } = await supabaseAdmin.from('wallets').select('user_id, balance');
  const balanceMap: Record<string, number> = {};
  (wallets || []).forEach((w: any) => { balanceMap[w.user_id] = Number(w.balance) || 0; });

  const now = Date.now();
  const users = (data?.users || []).map((u: any) => ({
    id: u.id,
    email: u.email ?? null,
    verified: !!u.email_confirmed_at,
    full_name: u.user_metadata?.full_name ?? null,
    phone: u.user_metadata?.phone ?? null,
    civility: u.user_metadata?.civility ?? null,
    is_ambassador: !!u.user_metadata?.is_ambassador,
    role: roleOf(u.user_metadata),
    permissions: u.user_metadata?.permissions ?? {},
    banned: !!(u.banned_until && new Date(u.banned_until).getTime() > now),
    created_at: u.created_at,
    balance: balanceMap[u.id] ?? 0,
  }));
  return NextResponse.json({ users });
}

// Modifier un compte (admin uniquement) : rôle, droits, blocage, ambassadeur, civilité.
export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const { user_id, action } = body;
  if (!user_id) return NextResponse.json({ error: 'user_id requis' }, { status: 400 });

  // Blocage / déblocage (empêche la connexion)
  if (action === 'block' || action === 'unblock') {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      ban_duration: action === 'block' ? '876000h' : 'none',
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  // Préserver les métadonnées existantes, modifier les champs fournis
  const { data: u } = await supabaseAdmin.auth.admin.getUserById(user_id);
  const meta: Record<string, any> = { ...(u?.user?.user_metadata || {}) };

  if (body.role !== undefined) {
    meta.role = body.role;
    meta.is_admin = body.role === 'admin'; // garde la compat avec l'ancien contrôle d'accès
  }
  if (body.permissions !== undefined) meta.permissions = body.permissions;
  if (typeof body.is_ambassador === 'boolean') meta.is_ambassador = body.is_ambassador;
  if (body.civility !== undefined) meta.civility = body.civility || null;

  const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, { user_metadata: meta });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
