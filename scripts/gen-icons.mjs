#!/usr/bin/env node
/**
 * Génère les icônes PWA de Hornafresh dans public/ à partir d'un SVG de marque.
 *   node scripts/gen-icons.mjs
 * Remplace simplement le SVG ci-dessous (ou les PNG générés) par ton vrai logo
 * quand tu l'auras, puis relance.
 */
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = (f) => join(__dirname, '..', 'public', f);

// Feuille Hornafresh — fond vert dégradé + feuille lime + nervures.
const leaf = (bg) => `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2d6410"/>
      <stop offset="1" stop-color="#1c3a05"/>
    </linearGradient>
  </defs>
  ${bg}
  <path d="M256 108 C 320 168, 352 240, 346 314 C 340 374, 300 412 256 420 C 212 412, 172 374, 166 314 C 160 240, 192 168, 256 108 Z" fill="#c8e050"/>
  <g stroke="#2d6410" stroke-width="14" stroke-linecap="round" fill="none">
    <path d="M256 150 L256 404"/>
    <path d="M256 248 L320 212"/>
    <path d="M256 248 L192 212"/>
    <path d="M256 320 L328 286"/>
    <path d="M256 320 L184 286"/>
  </g>
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
console.log('Icônes générées.');
