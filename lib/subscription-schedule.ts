// Calendrier des commandes modèles — fonctions pures, partagées entre le cron (serveur),
// la reprise après recharge et la page client « Ma commande modèle ».

export type Frequency = 'weekly' | 'fortnightly' | 'monthly';

export const FREQ_LABEL: Record<string, string> = {
  weekly:      'hebdomadaire',
  fortnightly: 'toutes les deux semaines',
  monthly:     'mensuelle',
};

/** Nombre de jours entiers entre deux dates YYYY-MM-DD. */
export function daysBetween(fromStr: string, toStr: string): number {
  return Math.round((new Date(toStr + 'T00:00:00Z').getTime() - new Date(fromStr + 'T00:00:00Z').getTime()) / 86400000);
}

export function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}

export const dowOf = (dateStr: string) => new Date(dateStr + 'T00:00:00Z').getUTCDay(); // 0 = dimanche

/** Une livraison est-elle due ce jour-là selon la fréquence ? (le jour de la semaine est déjà le bon) */
export function isDue(frequency: string, lastDelivery: string | null, dayStr: string): boolean {
  if (!lastDelivery) return true;
  if (lastDelivery === dayStr) return false;
  if (frequency === 'weekly') return true;
  if (frequency === 'fortnightly') return daysBetween(lastDelivery, dayStr) >= 14;
  if (frequency === 'monthly') {
    const last = new Date(lastDelivery + 'T00:00:00Z'), d = new Date(dayStr + 'T00:00:00Z');
    return last.getUTCFullYear() !== d.getUTCFullYear() || last.getUTCMonth() !== d.getUTCMonth();
  }
  return false;
}

/** Prochaine date de livraison (YYYY-MM-DD) à partir de `fromStr` inclus, ou null (validité dépassée / rien sous 90 j). */
export function nextDeliveryDate(sub: { frequency: string; delivery_day: number; last_delivery: string | null; valid_until?: string | null }, fromStr: string): string | null {
  let d = fromStr;
  for (let i = 0; i < 92; i++) {
    if (sub.valid_until && d > sub.valid_until) return null;
    if (dowOf(d) === Number(sub.delivery_day) && isDue(sub.frequency, sub.last_delivery, d)) return d;
    d = addDays(d, 1);
  }
  return null;
}
