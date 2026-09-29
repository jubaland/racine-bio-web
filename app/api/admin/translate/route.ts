import { NextResponse } from 'next/server';
import { requirePerm } from '../../../../lib/admin-auth';
import { monitored } from '../../../../lib/monitor';
import { translateFields, TranslateError, TARGET_LANGS, MAX_TEXT, MAX_TOTAL, type TargetLang } from '../../../../lib/translate';

// POST { fields: { champ: 'texte français' }, langs?: ['en','zh','am','so'] }
//   → { translations: { langue: { champ: texte } }, errors: [{ lang, code }], provider }
// Prérempli les champs de traduction de l'admin. Rien n'est enregistré ici : l'admin relit puis enregistre.
// Réservé à l'équipe (produits, annonces, achats groupés, marchands).
async function POST_(request: Request) {
  const auth = await requirePerm(request, ['products', 'announcements', 'campaigns', 'merchants', 'categories', 'promos'], 'edit');
  // « announcements » n'a pas d'action « edit » : le droit de diffuser suffit
  const auth2 = auth.ok ? auth : await requirePerm(request, 'announcements', 'create');
  if (!auth2.ok) return NextResponse.json({ error: auth2.error }, { status: auth2.status });

  let body: any = {};
  try { body = await request.json(); } catch { /* ignore */ }
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(body.fields || {}).slice(0, 10)) if (typeof v === 'string' && v.trim()) fields[String(k).slice(0, 40)] = v;
  if (!Object.keys(fields).length) return NextResponse.json({ error: 'nothing_to_translate' }, { status: 400 });
  const langs = (Array.isArray(body.langs) && body.langs.length ? body.langs : TARGET_LANGS).filter((l: string) => (TARGET_LANGS as readonly string[]).includes(l)) as TargetLang[];
  if (!langs.length) return NextResponse.json({ error: 'invalid_lang' }, { status: 400 });

  try {
    const r = await translateFields(fields, langs);
    if (!Object.keys(r.translations).length) {
      const quota = r.errors.some(e => e.code === 'quota');
      // 503 volontairement absent : un service externe indisponible n'est pas une erreur du site à surveiller
      return NextResponse.json({ error: quota ? 'quota' : 'unavailable', errors: r.errors }, { status: quota ? 429 : 424 });
    }
    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) {
    if (e instanceof TranslateError && e.code === 'too_long') return NextResponse.json({ error: 'too_long', max_text: MAX_TEXT, max_total: MAX_TOTAL }, { status: 413 });
    throw e;
  }
}

export const POST = monitored('/api/admin/translate', POST_);
