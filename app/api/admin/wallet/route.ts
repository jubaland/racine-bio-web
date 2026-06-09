import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requirePerm } from '../../../../lib/admin-auth';

// Solde + historique d'un client
export async function GET(request: Request) {
  const auth = await requirePerm(request, 'wallets', 'view');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const userId = new URL(request.url).searchParams.get('user_id');
  if (!userId) return NextResponse.json({ error: 'user_id requis' }, { status: 400 });

  const { data: wallet } = await supabaseAdmin
    .from('wallets').select('balance').eq('user_id', userId).maybeSingle();
  const { data: tx } = await supabaseAdmin
    .from('wallet_transactions')
    .select('id, type, amount, order_id, note, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  return NextResponse.json({ balance: wallet?.balance ?? 0, transactions: tx || [] });
}

// Créditer un dépôt (admin) — débits négatifs possibles pour ajustement
export async function POST(request: Request) {
  const auth = await requirePerm(request, 'wallets', 'edit');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { user_id, amount, note, type } = await request.json();
  const amt = Number(amount);
  if (!user_id || !amt || isNaN(amt)) {
    return NextResponse.json({ error: 'user_id et montant valides requis.' }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin.rpc('wallet_adjust', {
    p_user: user_id,
    p_amount: amt,
    p_type: type || 'deposit',
    p_order: null,
    p_note: note || null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ balance: data });
}
