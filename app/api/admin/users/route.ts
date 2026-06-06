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
    balance: balanceMap[u.id] ?? 0,
    created_at: u.created_at,
  }));
  return NextResponse.json({ users });
}
