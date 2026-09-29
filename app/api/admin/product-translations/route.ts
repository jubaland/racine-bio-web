import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requirePerm } from '../../../../lib/admin-auth';
import { PRODUCT_LANGS, translationsOf, suggestNames, saveTranslations } from '../../../../lib/product-translations';
import { monitored } from '../../../../lib/monitor';

// Traductions d'un produit (nom + description par langue) — admin › Produits et Marchands › À traiter.
// GET  ?product_id=…  → texte français, traductions enregistrées, suggestions de nom (produits homonymes)
// POST { product_id, translations: { en: { name, description }, … } } → enregistre
// Ne repasse pas le produit en validation : une traduction n'est pas une modification sensible.

async function GET_(request: Request) {
  const auth = await requirePerm(request, ['products', 'merchants'], 'view');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const id = Number(new URL(request.url).searchParams.get('product_id'));
  if (!id) return NextResponse.json({ error: 'product_id requis' }, { status: 400 });
  const { data: p } = await supabaseAdmin.from('products').select('id, name, description, owner_id').eq('id', id).maybeSingle();
  if (!p) return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });
  const [tr, sug] = await Promise.all([translationsOf([id]), suggestNames([{ id, name: p.name }])]);
  return NextResponse.json({
    product: { id: p.id, name: p.name, description: p.description || '', merchant: !!p.owner_id },
    langs: PRODUCT_LANGS,
    translations: tr[id] || {},
    suggestions: sug[id] || {},
  });
}

async function POST_(request: Request) {
  const auth = await requirePerm(request, ['products', 'merchants'], 'edit');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  let body: any = {};
  try { body = await request.json(); } catch { /* ignore */ }
  const id = Number(body.product_id);
  if (!id || !body.translations || typeof body.translations !== 'object') return NextResponse.json({ error: 'Données invalides' }, { status: 400 });
  const { data: p } = await supabaseAdmin.from('products').select('id').eq('id', id).maybeSingle();
  if (!p) return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });
  const r = await saveTranslations(id, body.translations);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 500 });
  return NextResponse.json({ ok: true, saved: r.saved, removed: r.removed, translations: (await translationsOf([id]))[id] || {} });
}

// Surveillance : exceptions et réponses 5xx enregistrées (lib/monitor.ts)
export const GET = monitored('/api/admin/product-translations', GET_);
export const POST = monitored('/api/admin/product-translations', POST_);
