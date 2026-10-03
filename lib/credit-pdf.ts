import { PDFDocument, StandardFonts, rgb, PDFFont } from 'pdf-lib';
import type { OpenCharge } from './credit';

// Relevé de crédit (A4) : commandes à régler, total dû, plafond. Police standard : accents OK, emoji retirés.
const GREEN = rgb(0.32, 0.40, 0), GRAY = rgb(0.42, 0.45, 0.50), DARK = rgb(0.12, 0.15, 0.20);
const clean = (s: unknown) => String(s ?? '').replace(/[\r\n\t]+/g, ' ').replace(/[^\x20-\x7E\xA0-\xFF]/g, '').replace(/\s+/g, ' ').trim();
const fdj = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} Fdj`;
const dateFr = (day: string) => new Date(day + 'T00:00:00Z').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });

export async function buildCreditStatementPdf(p: { holder: string; day: string; due: string; lines: OpenCharge[]; total: number; limit: number; outstanding: number }): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28, H = 841.89, M = 48;
  let page = doc.addPage([W, H]);
  let y = H - M;
  const ensure = (need: number) => { if (y - need < M) { page = doc.addPage([W, H]); y = H - M; } };
  const draw = (s: string, o: { x?: number; size?: number; f?: PDFFont; color?: ReturnType<typeof rgb> } = {}) => page.drawText(clean(s), { x: o.x ?? M, y, size: o.size ?? 11, font: o.f ?? font, color: o.color ?? DARK });
  const drawR = (s: string, o: { size?: number; f?: PDFFont; color?: ReturnType<typeof rgb> } = {}) => { const f = o.f ?? font, size = o.size ?? 11; page.drawText(clean(s), { x: W - M - f.widthOfTextAtSize(clean(s), size), y, size, font: f, color: o.color ?? DARK }); };
  const line = (s: string, o: { size?: number; f?: PDFFont; color?: ReturnType<typeof rgb>; lh?: number } = {}) => { const lh = o.lh ?? 16; ensure(lh); draw(s, o); y -= lh; };
  const rowLR = (l: string, r: string, o: { size?: number; f?: PDFFont; color?: ReturnType<typeof rgb> } = {}) => { ensure(16); draw(l, o); drawR(r, o); y -= 16; };
  const hr = () => { ensure(10); page.drawLine({ start: { x: M, y: y + 4 }, end: { x: W - M, y: y + 4 }, thickness: 0.6, color: rgb(0.82, 0.88, 0.58) }); y -= 10; };

  draw('HORNAFRESH', { f: bold, size: 16, color: GREEN }); y -= 20;
  draw('Releve de credit', { f: bold, size: 13 }); y -= 24;
  line(`Client : ${p.holder}`, { f: bold });
  line(`Releve du ${dateFr(p.day)}`, { size: 10, color: GRAY });
  line(`A regler avant le ${dateFr(p.due)}`, { f: bold, size: 12, color: GREEN });
  y -= 6; hr();

  ensure(16); draw('COMMANDE', { f: bold, size: 9, color: GRAY }); drawR('RESTE A REGLER', { f: bold, size: 9, color: GRAY }); y -= 18;
  for (const c of p.lines) {
    rowLR(`#${c.order_id ?? '-'}  du ${dateFr(c.created_at.slice(0, 10))}  (echeance ${dateFr(c.due_at)})`, fdj(c.remaining), { size: 10 });
    if (c.paid_amount > 0) line(`   ${fdj(c.amount)} dont ${fdj(c.paid_amount)} deja regles`, { size: 9, color: GRAY });
  }
  hr();
  rowLR('TOTAL A REGLER', fdj(p.total), { f: bold, size: 14, color: GREEN });
  if (p.outstanding > p.total) rowLR('Encours total (echeances suivantes comprises)', fdj(p.outstanding), { size: 10, color: GRAY });
  rowLR('Plafond de credit', fdj(p.limit), { size: 10, color: GRAY });
  y -= 16;
  line('Reglement en especes, par Waafi ou D-Money aupres d\'Hornafresh.', { size: 10, color: GRAY });
  line('Merci pour votre confiance !', { f: bold, size: 12, color: GREEN });
  line('Hornafresh - Djibouti - 77432615', { size: 9, color: GRAY });
  return Buffer.from(await doc.save());
}
