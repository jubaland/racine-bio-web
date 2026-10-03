import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requirePerm } from '../../../../lib/admin-auth';
import { promoOverview, saveDeliveryRules, cleanCode } from '../../../../lib/promo-codes';
import { monitored } from '../../../../lib/monitor';

// Codes promo « livraison offerte » (admin › Promotions › Codes promo) et seuil automatique.

// Entier strictement positif, ou vide (= pas de limite). undefined = valeur refusée.
const optInt = (v: unknown): number | null | undefined => {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : undefined;
};
const optDate = (v: unknown): string | null | undefined => {
  if (v === '' || v == null) return null;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? undefined : d.toISOString();
};

async function userIdByEmail(email: string): Promise<string | null> {
  const wanted = email.trim().toLowerCase();
  for (let page = 1; ; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return null;
    const hit = (data?.users || []).find(u => u.email?.toLowerCase() === wanted);
    if (hit) return hit.id;
    if (!data?.users || data.users.length < 1000) return null;
  }
}

// GET — liste des codes (utilisations, montant offert) + seuil automatique
async function GET_(request: Request) {
  const auth = await requirePerm(request, ['promos'], 'view');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  return NextResponse.json(await promoOverview());
}

async function POST_(request: Request) {
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || 'save');
  const need = action === 'delete' ? 'delete' : action === 'save' && !body.id ? 'create' : 'edit';
  const auth = await requirePerm(request, ['promos'], need);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // Seuil automatique : livraison offerte dès un montant d'articles (vide = désactivé)
  if (action === 'save_rules') {
    const threshold = optInt(body.free_threshold);
    if (threshold === undefined) return NextResponse.json({ error: 'threshold_invalid' }, { status: 400 });
    await saveDeliveryRules({ free_threshold: threshold, threshold_scope: body.threshold_scope === 'all' ? 'all' : 'standard' });
    return NextResponse.json(await promoOverview());
  }

  if (action === 'toggle') {
    const { error } = await supabaseAdmin.from('promo_codes').update({ active: !!body.active, updated_at: new Date().toISOString() }).eq('id', Number(body.id));
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(await promoOverview());
  }

  if (action === 'delete') {
    // Un code déjà utilisé garde son historique : on le désactive au lieu de le supprimer
    const { count } = await supabaseAdmin.from('promo_redemptions').select('id', { count: 'exact', head: true }).eq('promo_id', Number(body.id));
    if (count) return NextResponse.json({ error: 'code_used' }, { status: 409 });
    const { error } = await supabaseAdmin.from('promo_codes').delete().eq('id', Number(body.id));
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(await promoOverview());
  }

  if (action !== 'save') return NextResponse.json({ error: 'action_invalid' }, { status: 400 });

  const code = cleanCode(body.code);
  if (code.length < 3 || code !== String(body.code || '').trim().toUpperCase()) return NextResponse.json({ error: 'code_format' }, { status: 400 });
  const fields = { min_subtotal: optInt(body.min_subtotal), max_uses: optInt(body.max_uses), max_uses_per_user: optInt(body.max_uses_per_user), max_discount: optInt(body.max_discount), value: optInt(body.value) };
  for (const [k, v] of Object.entries(fields)) if (v === undefined) return NextResponse.json({ error: 'number_invalid', field: k }, { status: 400 });
  // Type : livraison offerte (pas de valeur), pourcentage (1-100, plafond obligatoire), montant fixe (Fdj)
  const kind = ['free_delivery', 'percent', 'amount'].includes(body.kind) ? body.kind : 'free_delivery';
  if (kind === 'free_delivery') fields.value = null;
  else if (!fields.value) return NextResponse.json({ error: 'value_required' }, { status: 400 });
  if (kind === 'percent' && fields.value! > 100) return NextResponse.json({ error: 'percent_range' }, { status: 400 });
  if (kind === 'percent' && !fields.max_discount) return NextResponse.json({ error: 'cap_required' }, { status: 400 });
  const starts_at = optDate(body.starts_at), ends_at = optDate(body.ends_at);
  if (starts_at === undefined || ends_at === undefined) return NextResponse.json({ error: 'date_invalid' }, { status: 400 });
  if (starts_at && ends_at && ends_at <= starts_at) return NextResponse.json({ error: 'date_order' }, { status: 400 });
  if (!body.id && ends_at && new Date(ends_at).getTime() <= Date.now()) return NextResponse.json({ error: 'date_past' }, { status: 400 });

  // Code personnel : réservé au compte de cette adresse e-mail
  let user_id: string | null = null;
  const email = String(body.user_email || '').trim();
  if (email) {
    user_id = await userIdByEmail(email);
    if (!user_id) return NextResponse.json({ error: 'user_not_found' }, { status: 400 });
  }

  // Pas de collision : avec un autre code promo, ni avec un code parrainage (même champ au paiement)
  const [{ data: same }, { data: ref }] = await Promise.all([
    supabaseAdmin.from('promo_codes').select('id').eq('code', code).maybeSingle(),
    supabaseAdmin.from('referral_codes').select('id').eq('code', code).maybeSingle(),
  ]);
  if ((same && same.id !== Number(body.id)) || ref) return NextResponse.json({ error: 'code_taken' }, { status: 409 });

  const row = {
    code, kind, label: String(body.label || '').trim().slice(0, 120) || null,
    active: body.active !== false, starts_at, ends_at, ...fields,
    first_order_only: !!body.first_order_only, scope: body.scope === 'all' ? 'all' : 'standard',
    products_scope: body.products_scope === 'hornafresh' ? 'hornafresh' : 'all',
    user_id, updated_at: new Date().toISOString(),
  };
  const { error } = body.id
    ? await supabaseAdmin.from('promo_codes').update(row).eq('id', Number(body.id))
    : await supabaseAdmin.from('promo_codes').insert({ ...row, created_by: auth.user.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(await promoOverview());
}

// Surveillance : exceptions et réponses 5xx enregistrées (lib/monitor.ts)
export const GET = monitored('/api/admin/promo-codes', GET_);
export const POST = monitored('/api/admin/promo-codes', POST_);
