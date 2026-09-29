// ── Recherche tolérante de produits (pure, utilisable côté client) ───────────
// • insensible aux accents et à la casse ;
// • tolère les fautes de frappe (« tomatte », « carote », lettres inversées) ;
// • cherche dans toutes les langues : nom français, noms traduits, boutique, catégorie, origine ;
// • chaque mot saisi doit correspondre ; les meilleurs résultats d'abord.
// Les écritures sans espaces ni alphabet latin (chinois, amharique) sont comparées par inclusion.

export type SearchEntry = { id: number; terms: string[] };

/** Texte comparable : minuscules, sans accents ; lettres et chiffres de toutes les écritures conservés. */
export const norm = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

const isLatin = (s: string) => /^[a-z0-9 ]+$/.test(s);

/** Nombre de fautes tolérées selon la longueur du mot saisi (un mot court doit être exact). */
export const tolerance = (len: number) => (len <= 3 ? 0 : len <= 5 ? 1 : 2);

/** Distance de Damerau-Levenshtein (insertion, suppression, remplacement, inversion), bornée par `max`. */
export function distance(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const n = a.length, m = b.length;
  let prev2: number[] = [], prev = Array.from({ length: m + 1 }, (_, j) => j);
  for (let i = 1; i <= n; i++) {
    const cur = [i]; let best = i;
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v; if (v < best) best = v;
    }
    if (best > max) return max + 1;      // plus aucune chance de rester sous la borne
    prev2 = prev; prev = cur;
  }
  return prev[m];
}

/** Qualité de la correspondance d'un mot saisi avec un terme d'un produit (0 = aucune). */
function tokenScore(token: string, term: string): number {
  if (!token || !term) return 0;
  if (term === token) return 100;
  const words = term.split(' ');
  if (words.includes(token)) return 95;
  if (term.startsWith(token)) return 90;
  if (words.some(w => w.startsWith(token))) return 85;
  if (term.includes(token)) return 70;
  if (!isLatin(token)) return 0;                       // pas de tolérance hors alphabet latin
  const max = tolerance(token.length);
  if (!max) return 0;
  let best = 0;
  for (const w of words) {
    if (!isLatin(w)) continue;
    // mot entier, ou début du mot (saisie en cours : « tomat » pour « tomate »)
    const d = Math.min(distance(token, w, max), w.length > token.length ? distance(token, w.slice(0, token.length), max) : max + 1);
    if (d <= max) best = Math.max(best, 60 - d * 15);
  }
  return best;
}

/** Score d'un produit pour une recherche ; null si un des mots saisis ne correspond à rien. */
export function scoreEntry(query: string, entry: SearchEntry): number | null {
  const tokens = norm(query).split(' ').filter(Boolean);
  if (!tokens.length) return 0;
  let total = 0;
  for (const tk of tokens) {
    let best = 0;
    // le nom (premier terme) compte plus que la boutique, la catégorie ou l'origine
    entry.terms.forEach((term, i) => { const s = tokenScore(tk, term) * (i === 0 ? 1 : 0.9); if (s > best) best = s; });
    if (!best) return null;
    total += best;
  }
  return total / tokens.length;
}

/** Produits correspondant à la recherche, meilleurs d'abord : { id → score }. */
export function searchScores(query: string, index: SearchEntry[]): Map<number, number> {
  const out = new Map<number, number>();
  if (!norm(query)) return out;
  for (const e of index) { const s = scoreEntry(query, e); if (s != null && s > 0) out.set(e.id, s); }
  return out;
}

/** Index de recherche : nom français d'abord, puis noms traduits et autres champs utiles. */
export function buildIndex(products: any[], translatedNames: Record<number, string[]> = {}, extra: (p: any) => unknown[] = () => []): SearchEntry[] {
  return products.map(p => ({
    id: p.id,
    terms: [...new Set([p.name, ...(translatedNames[p.id] || []), p.farm, p.category, p.origin_country, p.region, p.tag_label, ...extra(p)].map(norm).filter(Boolean))],
  }));
}
