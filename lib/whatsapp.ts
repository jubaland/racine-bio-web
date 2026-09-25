import { HORNAFRESH_PHONE } from './payments';

// WhatsApp « cliquer pour discuter » (liens wa.me) — gratuit, sans API : c'est toujours le client
// qui ouvre la conversation. Fonctions pures, utilisables côté client et serveur.

/** Numéro au format international sans « + » (Djibouti : 8 chiffres → 253…). null si inexploitable. */
export function toIntlPhone(raw: string | null | undefined): string | null {
  const d = String(raw || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.length === 8 && /^7/.test(d)) return '253' + d;          // mobile Djibouti
  if (d.length === 11 && d.startsWith('253')) return d;           // déjà international
  if (d.length >= 10 && d.length <= 15) return d;                 // autre pays, laissé tel quel
  return null;
}

/** Lien wa.me vers un numéro international, avec message prérempli optionnel. */
export function waLink(intlPhone: string, text?: string): string {
  return `https://wa.me/${intlPhone}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

export const HORNAFRESH_WHATSAPP = toIntlPhone(HORNAFRESH_PHONE) as string; // 25377432615

/** Lien vers le WhatsApp Hornafresh (service client). */
export const hornafreshWa = (text?: string) => waLink(HORNAFRESH_WHATSAPP, text);

/** Format d'affichage local « 77 43 26 15 » pour un numéro Djibouti, sinon +international. */
export function displayPhone(intlPhone: string): string {
  if (intlPhone.startsWith('253') && intlPhone.length === 11) return intlPhone.slice(3).replace(/(\d{2})(?=\d)/g, '$1 ');
  return '+' + intlPhone;
}
