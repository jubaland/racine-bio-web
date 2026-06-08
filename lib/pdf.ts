import { PDFDocument, StandardFonts, rgb, PDFFont } from 'pdf-lib';

const GREEN = rgb(0.32, 0.40, 0);
const GRAY = rgb(0.42, 0.45, 0.50);
const DARK = rgb(0.12, 0.15, 0.20);

// Retire les caractères non encodables par WinAnsi (emoji, CJK, contrôles) ;
// garde l'ASCII imprimable + le Latin-1 (accents français).
function clean(s: any): string {
  return String(s ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Génère le bordereau de préparation en PDF (A4) et renvoie un Buffer. */
export async function buildPrepSlipPdf(order: any, items: any[]): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const W = 595.28, H = 841.89, M = 48;
  let page = doc.addPage([W, H]);
  let y = H - M;

  const shortId = String(order.id).slice(0, 8).toUpperCase();
  const ordered = new Date(order.created_at);
  const deadline = new Date(ordered.getTime() + 24 * 3600 * 1000);
  const fmt = (d: Date) => d.toLocaleString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' });
  const isCash = order.payment_method === 'cash';

  const ensure = (need: number) => { if (y - need < M) { page = doc.addPage([W, H]); y = H - M; } };
  const draw = (s: string, opts: { x?: number; size?: number; f?: PDFFont; color?: any } = {}) => {
    const { x = M, size = 11, f = font, color = DARK } = opts;
    page.drawText(clean(s), { x, y, size, font: f, color });
  };
  const line = (s: string, opts: { x?: number; size?: number; f?: PDFFont; color?: any; lh?: number } = {}) => {
    const lh = opts.lh ?? 16; ensure(lh); draw(s, opts); y -= lh;
  };
  const gap = (h = 10) => { y -= h; };
  const wrap = (s: string, f: PDFFont, size: number, maxW: number): string[] => {
    const words = clean(s).split(' ');
    const out: string[] = []; let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (f.widthOfTextAtSize(test, size) > maxW && cur) { out.push(cur); cur = w; }
      else cur = test;
    }
    if (cur) out.push(cur);
    return out.length ? out : [''];
  };
  const maxW = W - 2 * M;

  // En-tête
  draw('HORNAFRESH', { f: bold, size: 16, color: GREEN }); y -= 20;
  draw('Bordereau de preparation', { f: bold, size: 13 }); y -= 26;

  line(`Commande #${shortId}`, { f: bold, size: 12 });
  line(`Commandee le ${fmt(ordered)}`, { color: GRAY, size: 10 });
  gap();

  // Délai
  line(`A LIVRER AVANT : ${fmt(deadline)}`, { f: bold, size: 12, color: GREEN });
  gap();

  // Client
  line('CLIENT', { f: bold, size: 9, color: GRAY });
  line(order.customer_name || '-', { f: bold });
  if (order.phone)   line(`Tel : ${order.phone}`, { size: 10, color: GRAY });
  if (order.email)   line(`Email : ${order.email}`, { size: 10, color: GRAY });
  if (order.address) wrap(`Adresse : ${order.address}`, font, 10, maxW).forEach(l => line(l, { size: 10, color: GRAY }));
  gap();

  // Articles
  line(`ARTICLES A PREPARER (${items.length})`, { f: bold, size: 9, color: GRAY });
  for (const it of items) {
    const name = it.product_name || `Produit #${it.product_id}`;
    const unit = it.product_unit || '';
    const label = `[  ]  ${it.quantity} ${unit}  -  ${name}`;
    wrap(label, font, 11, maxW).forEach((l, i) => line(i === 0 ? l : '        ' + l));
    if (it.product_farm) line(`        Ferme : ${it.product_farm}`, { size: 9, color: GRAY });
  }
  gap();

  // Demande spéciale
  if (order.special_instructions) {
    line('DEMANDE SPECIALE', { f: bold, size: 9, color: GRAY });
    wrap(order.special_instructions, font, 11, maxW).forEach(l => line(l));
    gap();
  }

  // Paiement
  if (order.delivery_option_name) line(`Livraison : ${order.delivery_option_name}`, { size: 10, color: GRAY });
  const totalStr = `${Number(order.total).toLocaleString('fr-FR')} Fdj`;
  line(isCash ? `A ENCAISSER : ${totalStr}` : `Paye via Waafi (a verifier) : ${totalStr}`, { f: bold, size: 13, color: GREEN });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

const RECEIPT_PAY: Record<string, string> = {
  waafi: 'Waafi', dmoney: 'D-Money', cash: 'Especes', wallet: 'Cagnotte (prepaye)',
};

/** Génère un reçu client en PDF (A4) et renvoie un Buffer. */
export async function buildReceiptPdf(order: any, items: any[]): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const W = 595.28, H = 841.89, M = 48;
  const maxW = W - 2 * M;
  let page = doc.addPage([W, H]);
  let y = H - M;

  const shortId = String(order.id).slice(0, 8).toUpperCase();
  const ordered = new Date(order.created_at);
  const fmt = (d: Date) => d.toLocaleString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const ensure = (need: number) => { if (y - need < M) { page = doc.addPage([W, H]); y = H - M; } };
  const draw = (s: string, opts: { x?: number; size?: number; f?: PDFFont; color?: any } = {}) => {
    const { x = M, size = 11, f = font, color = DARK } = opts;
    page.drawText(clean(s), { x, y, size, font: f, color });
  };
  const drawR = (s: string, opts: { size?: number; f?: PDFFont; color?: any } = {}) => {
    const { size = 11, f = font, color = DARK } = opts;
    const w = f.widthOfTextAtSize(clean(s), size);
    page.drawText(clean(s), { x: W - M - w, y, size, font: f, color });
  };
  const line = (s: string, opts: { x?: number; size?: number; f?: PDFFont; color?: any; lh?: number } = {}) => {
    const lh = opts.lh ?? 16; ensure(lh); draw(s, opts); y -= lh;
  };
  const rowLR = (left: string, right: string, opts: { size?: number; f?: PDFFont; color?: any; lh?: number } = {}) => {
    const lh = opts.lh ?? 16; ensure(lh); draw(left, opts); drawR(right, opts); y -= lh;
  };
  const gap = (h = 10) => { y -= h; };
  const hr = () => { ensure(14); page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.7, color: rgb(0.82, 0.88, 0.6) }); y -= 14; };
  const wrap = (s: string, f: PDFFont, size: number, mw: number): string[] => {
    const words = clean(s).split(' '); const out: string[] = []; let cur = '';
    for (const w of words) { const test = cur ? cur + ' ' + w : w; if (f.widthOfTextAtSize(test, size) > mw && cur) { out.push(cur); cur = w; } else cur = test; }
    if (cur) out.push(cur); return out.length ? out : [''];
  };

  // En-tête
  draw('HORNAFRESH', { f: bold, size: 18, color: GREEN });
  drawR('RECU', { f: bold, size: 18, color: GREEN }); y -= 22;
  draw('Le marche premium frais & bio de Djibouti', { size: 9, color: GRAY }); y -= 22;
  hr();

  line(`Recu #${shortId}`, { f: bold, size: 12 });
  line(`Date : ${fmt(ordered)}`, { color: GRAY, size: 10 });
  gap();

  // Client
  line('CLIENT', { f: bold, size: 9, color: GRAY });
  line(order.customer_name || '-', { f: bold });
  if (order.phone)   line(`Tel : ${order.phone}`, { size: 10, color: GRAY });
  if (order.email)   line(`Email : ${order.email}`, { size: 10, color: GRAY });
  if (order.address) wrap(`Adresse : ${order.address}`, font, 10, maxW).forEach(l => line(l, { size: 10, color: GRAY }));
  gap(); hr();

  // Articles
  ensure(16);
  draw('ARTICLE', { f: bold, size: 9, color: GRAY });
  drawR('MONTANT', { f: bold, size: 9, color: GRAY }); y -= 18;

  let itemsSum = 0;
  for (const it of items) {
    const name = it.product_name || `Produit #${it.product_id}`;
    const unit = it.product_unit || '';
    const sub = Number(it.price) * Number(it.quantity);
    itemsSum += sub;
    rowLR(name, `${sub.toLocaleString('fr-FR')} Fdj`, { size: 11 });
    line(`   ${it.quantity} ${unit} x ${Number(it.price).toLocaleString('fr-FR')} Fdj`, { size: 9, color: GRAY });
  }
  gap(4); hr();

  // Totaux
  const fee = Number(order.delivery_fee) || 0;
  if (fee > 0) {
    rowLR('Sous-total', `${itemsSum.toLocaleString('fr-FR')} Fdj`, { size: 11, color: GRAY });
    rowLR('Livraison', `${fee.toLocaleString('fr-FR')} Fdj`, { size: 11, color: GRAY });
  }
  rowLR('TOTAL', `${Number(order.total).toLocaleString('fr-FR')} Fdj`, { f: bold, size: 14, color: GREEN });
  gap();
  line(`Paiement : ${RECEIPT_PAY[order.payment_method] || order.payment_method || '-'}`, { size: 10, color: GRAY });
  if (order.delivery_option_name) line(`Livraison : ${order.delivery_option_name}`, { size: 10, color: GRAY });

  gap(24);
  line('Merci pour votre confiance !', { f: bold, size: 12, color: GREEN });
  line('Hornafresh - Djibouti - 77432615', { size: 9, color: GRAY });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
