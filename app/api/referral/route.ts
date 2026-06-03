import { NextResponse, NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-admin';

const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) code += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  return code;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(authHeader.slice(7));
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Get or create referral code
  let { data: record } = await supabaseAdmin
    .from('referral_codes')
    .select('code, credits')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!record) {
    let code = '';
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = generateCode();
      const { data: existing } = await supabaseAdmin
        .from('referral_codes')
        .select('id')
        .eq('code', candidate)
        .maybeSingle();
      if (!existing) { code = candidate; break; }
    }
    if (!code) code = generateCode();

    const { data: created } = await supabaseAdmin
      .from('referral_codes')
      .insert({ user_id: user.id, code, credits: 0 })
      .select('code, credits')
      .single();
    record = created;
  }

  const { count } = await supabaseAdmin
    .from('referrals')
    .select('id', { count: 'exact', head: true })
    .eq('referrer_id', user.id);

  return NextResponse.json({
    code:            record!.code,
    credits:         record!.credits,
    referrals_count: count ?? 0,
  });
}
