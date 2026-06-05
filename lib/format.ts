// Petits mots de liaison qui restent en minuscule (sauf en tête de chaîne).
const SMALL_WORDS = new Set([
  'de', 'des', 'du', 'la', 'le', 'les', 'un', 'une', 'et', 'ou',
  'à', 'au', 'aux', 'd', 'l', 'sur', 'sous', 'en', 'dans',
]);

/**
 * Met un nom ou une adresse en forme « Title Case » propre, pour un affichage
 * homogène quelle que soit la casse saisie (tout minuscule, TOUT MAJUSCULE, mélange).
 * - normalise les espaces
 * - 1re lettre de chaque mot en majuscule (accents gérés)
 * - petits mots de liaison (de, la, du…) en minuscule, sauf en tête
 * Séparateurs gérés : espace, virgule, tiret, slash.
 */
export function titleCase(input: string): string {
  const s = (input ?? '').trim().replace(/\s+/g, ' ');
  if (!s) return s;
  return s.replace(/[^\s,/-]+/g, (word: string, offset: number) => {
    const lower = word.toLocaleLowerCase('fr');
    if (offset !== 0 && SMALL_WORDS.has(lower)) return lower;
    return lower.charAt(0).toLocaleUpperCase('fr') + lower.slice(1);
  });
}

/**
 * Met un texte libre (phrase / paragraphe) en « casse de phrase » : majuscule
 * en début de texte et après chaque ponctuation forte (. ! ?) ou retour ligne.
 * Le reste de la casse saisie est préservé (noms propres, etc.).
 */
export function sentenceCase(input: string): string {
  const s = (input ?? '').trim();
  if (!s) return s;
  return s.replace(/(^|[.!?]\s+|\n\s*)([a-zà-ÿ])/g, (_m, sep: string, ch: string) =>
    sep + ch.toLocaleUpperCase('fr'));
}
