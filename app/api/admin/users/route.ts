import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';

// Comptes authentifiés + statut de vérification — service role uniquement.
export async function GET() {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Soldes de cagnotte
  const { data: wallets } = await supabaseAdmin.from('wallets').select('user_id, balance');
  const balanceMap: Record<string, number> = {};
  (wallets || []).forEach((w: any) => { balanceMap[w.user_id] = Number(w.balance) || 0; });

  const users = (data?.users || []).map((u: any) => ({
    id: u.id,
    email: u.email ?? null,
    verified: !!u.email_confirmed_at,
    full_name: u.user_metadata?.full_name ?? null,
    phone: u.user_metadata?.phone ?? null,
    civility: u.user_metadata?.civility ?? null,
    is_ambassador: !!u.user_metadata?.is_ambassador,
    balance: balanceMap[u.id] ?? 0,
    created_at: u.created_at,
  }));
  return NextResponse.json({ users });
}

// Modifier un client (statut ambassadeur, civilité) — service role.
export async function POST(request: Request) {
  const { user_id, is_ambassador, civility } = await request.json();
  if (!user_id) return NextResponse.json({ error: 'user_id requis' }, { status: 400 });

  // Préserver les métadonnées existantes, modifier seulement les champs fournis
  const { data: u } = await supabaseAdmin.auth.admin.getUserById(user_id);
  const next: Record<string, any> = { ...(u?.user?.user_metadata || {}) };
  if (typeof is_ambassador === 'boolean') next.is_ambassador = is_ambassador;
  if (civility !== undefined) next.civility = civility || null; // 'madame' | 'monsieur' | null

  const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, { user_metadata: next });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
