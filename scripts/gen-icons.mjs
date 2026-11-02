#!/usr/bin/env node
/**
 * Génère les icônes PWA de Hornafresh dans public/ à partir du logo de marque.
 *   node scripts/gen-icons.mjs
 * Logo actuel (nov. 2026, piste E) : médaillon soleil orange avec feuille
 * d'acacia (penne à folioles) incrustée en vert foncé — identité « Afrique de l'Est ».
 * ⚠ Ancien logo (feuille simple) sauvegardé dans
 *   C:\Users\bongo\hornafresh-android\ancien-logo\ (PNG + gen-icons.mjs d'origine) :
 *   pour revenir en arrière, relancer ce script-là.
 */
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = (f) => join(__dirname, '..', 'public', f);

// ——— Feuille d'acacia : tige en courbe quadratique, folioles en paires ———
const P0 = [182, 345], P1 = [225, 205], P2 = [345, 122];
const q = (t) => {
  const u = 1 - t;
  const x = u * u * P0[0] + 2 * u * t * P1[0] + t * t * P2[0];
  const y = u * u * P0[1] + 2 * u * t * P1[1] + t * t * P2[1];
  const dx = 2 * u * (P1[0] - P0[0]) + 2 * t * (P2[0] - P1[0]);
  const dy = 2 * u * (P1[1] - P0[1]) + 2 * t * (P2[1] - P1[1]);
  return { x, y, a: Math.atan2(dy, dx) * 180 / Math.PI };
};
export const leafGroup = (fill) => {
  let leaflets = '';
  for (let i = 0; i < 8; i++) {
    const t = 0.14 + i * 0.105;
    const { x, y, a } = q(t);
    const s = 1 - i * 0.055;               // folioles qui rapetissent vers la pointe
    const rx = 30 * s, ry = 12.5 * s, off = rx * 0.82;
    for (const side of [1, -1]) {
      const ang = a + side * 58;
      const rad = ang * Math.PI / 180;
      const cx = (x + Math.cos(rad) * off).toFixed(1);
      const cy = (y + Math.sin(rad) * off).toFixed(1);
      leaflets += `<ellipse cx="${cx}" cy="${cy}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" transform="rotate(${ang.toFixed(1)} ${cx} ${cy})" fill="${fill}"/>`;
    }
  }
  const tip = q(0.99);
  return `
    <path d="M${P0[0]} ${P0[1]} Q ${P1[0]} ${P1[1]} ${P2[0]} ${P2[1]}" stroke="${fill}" stroke-width="11" stroke-linecap="round" fill="none"/>
    ${leaflets}
    <ellipse cx="${(tip.x + 10).toFixed(1)}" cy="${(tip.y - 7).toFixed(1)}" rx="17" ry="9" transform="rotate(${tip.a.toFixed(1)} ${(tip.x + 10).toFixed(1)} ${(tip.y - 7).toFixed(1)})" fill="${fill}"/>`;
};

// ——— Motif officiel (piste E) : médaillon soleil + feuille incrustée ———
export const MOTIF = `
  <circle cx="256" cy="208" r="136" fill="#f2b23d"/>
  <g transform="translate(39 42) scale(0.82)">${leafGroup('#2d6410')}</g>`;

const leaf = (bg) => `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1c3a05"/>
      <stop offset="0.5" stop-color="#2d6410"/>
      <stop offset="1" stop-color="#7a5800"/>
    </linearGradient>
  </defs>
  ${bg}
  ${MOTIF}
  <text x="256" y="430" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="54" letter-spacing="-1" fill="#ffffff">Hornafresh</text>
</svg>`;

const rounded = leaf('<rect width="512" height="512" rx="112" fill="url(#g)"/>');
const square  = leaf('<rect width="512" height="512" fill="url(#g)"/>');

const jobs = [
  { svg: rounded, size: 192, file: 'icon-192.png' },
  { svg: rounded, size: 512, file: 'icon-512.png' },
  { svg: square,  size: 512, file: 'icon-maskable-512.png' },
  { svg: square,  size: 180, file: 'apple-touch-icon.png' },
];

for (const j of jobs) {
  await sharp(Buffer.from(j.svg)).resize(j.size, j.size).png().toFile(out(j.file));
  console.log(`✓ public/${j.file} (${j.size}x${j.size})`);
}
// Marque seule (médaillon sans texte, fond transparent) pour Header/Footer/login
const mark = `<svg xmlns="http://www.w3.org/2000/svg" width="304" height="304" viewBox="104 56 304 304">${MOTIF}</svg>`;
await sharp(Buffer.from(mark)).resize(256, 256).png().toFile(out('logo-mark.png'));
console.log('✓ public/logo-mark.png (256x256)');
// Favicon moderne (app router : app/icon.png prime sur favicon.ico)
await sharp(Buffer.from(rounded)).resize(64, 64).png().toFile(join(__dirname, '..', 'app', 'icon.png'));
console.log('✓ app/icon.png (64x64)');
console.log('Icônes générées.');
