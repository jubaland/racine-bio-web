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

// Logo Hornafresh — dégradé du hero (vert -> orange crépusculaire) + feuille
// lime + mot « Hornafresh ». Composition centrée (zone sûre maskable).
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
  <path d="M256 135 C 298 170, 318 215, 314 258 C 310 290, 286 312, 256 316 C 226 312, 202 290, 198 258 C 194 215, 214 170, 256 135 Z" fill="#c8e050"/>
  <g stroke="#2d6410" stroke-width="9" stroke-linecap="round" fill="none">
    <path d="M256 158 L256 305"/>
    <path d="M256 222 L298 200"/>
    <path d="M256 222 L214 200"/>
    <path d="M256 266 L300 246"/>
    <path d="M256 266 L212 246"/>
  </g>
  <text x="256" y="382" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="54" letter-spacing="-1" fill="#ffffff">Hornafresh</text>
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
