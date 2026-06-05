import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Hornafresh — Marché frais de Djibouti',
    short_name: 'Hornafresh',
    description: 'Produits frais, bio et locaux livrés à Djibouti.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#faf7e8',
    theme_color: '#526500',
    lang: 'fr',
    dir: 'ltr',
    orientation: 'portrait',
    categories: ['shopping', 'food'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
