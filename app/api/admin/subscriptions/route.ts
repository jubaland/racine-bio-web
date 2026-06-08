import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';

// Liste de tous les abonnements (service role), enrichis client + panier + solde.
export async function GET() {
  const { data: subs, error } = await supabaseAdmin
    .from('subscriptions')
    .select('user_id, frequency, delivery_day, active, paused, last_delivery, valid_until, delivery_fee, created_at, updated_at');
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const { data: items } = await supabaseAdmin
    .from('subscription_items').select('user_id, frequency, product_id, quantity');

  const productIds = [...new Set((items || []).map((i: any) => i.product_id))];
  const { data: prods } = productIds.length
    ? await supabaseAdmin.from('products').select('id, name, price, unit').in('id', productIds)
    : { data: [] as any[] };
  const pmap: Record<number, any> = Object.fromEntries((prods || []).map((p: any) => [p.id, p]));

  const { data: wallets } = await supabaseAdmin.from('wallets').select('user_id, balance');
  const balanceMap: Record<string, number> = {};
  (wallets || []).forEach((w: any) => { balanceMap[w.user_id] = Number(w.balance) || 0; });

  // Infos client
  const userIds = [...new Set((subs || []).map((s: any) => s.user_id))];
  const info: Record<string, { name: string | null; email: string | null }> = {};
  await Promise.all(userIds.map(async (id) => {
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(id);
    info[id] = { name: u?.user?.user_metadata?.full_name ?? null, email: u?.user?.email ?? null };
  }));

  // Panier par (user, frequency)
  const itemsByKey: Record<string, any[]> = {};
  (items || []).forEach((it: any) => {
    const key = `${it.user_id}|${it.frequency}`;
    const p = pmap[it.product_id];
    (itemsByKey[key] ||= []).push({
      product_id: it.product_id,
      quantity: Number(it.quantity),
      name: p?.name ?? `#${it.product_id}`,
      price: Number(p?.price) || 0,
      unit: p?.unit ?? '',
    });
  });

  const result = (subs || []).map((s: any) => {
    const key = `${s.user_id}|${s.frequency}`;
    const its = itemsByKey[key] || [];
    const total = its.reduce((sum, it) => sum + it.price * it.quantity, 0);
    return {
      ...s,
      name: info[s.user_id]?.name ?? null,
      email: info[s.user_id]?.email ?? null,
      balance: balanceMap[s.user_id] ?? 0,
      items: its,
      total,
    };
  });

  return NextResponse.json({ subscriptions: result });
}

// Actions admin : pause / resume / delete / set_fee
export async function POST(request: Request) {
  const { user_id, frequency, action, fee } = await request.json();
  if (!user_id || !frequency) return NextResponse.json({ error: 'user_id et frequency requis' }, { status: 400 });

  if (action === 'set_fee') {
    const amount = Math.max(0, Number(fee) || 0);
    const { error } = await supabaseAdmin.from('subscriptions')
      .update({ delivery_fee: amount, updated_at: new Date().toISOString() })
      .eq('user_id', user_id).eq('frequency', frequency);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'pause' || action === 'resume') {
    const { error } = await supabaseAdmin.from('subscriptions')
      .update({ paused: action === 'pause', updated_at: new Date().toISOString() })
      .eq('user_id', user_id).eq('frequency', frequency);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'delete') {
    await supabaseAdmin.from('subscription_items').delete().eq('user_id', user_id).eq('frequency', frequency);
    const { error } = await supabaseAdmin.from('subscriptions').delete().eq('user_id', user_id).eq('frequency', frequency);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'action invalide' }, { status: 400 });
}
