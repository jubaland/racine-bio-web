import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { LanguageProvider } from '../context/LanguageContext';
import { CartProvider } from '../context/CartContext';
import { FavoritesProvider } from '../context/FavoritesContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Hornafresh — Le marché premium, frais, bio, local et régional de Djibouti',
  description: 'Produits frais bio et locaux livrés à Djibouti',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" style={{ colorScheme: 'only light' }}>
      <body className={inter.className}>
        <LanguageProvider>
          <CartProvider>
            <FavoritesProvider>
              {children}
            </FavoritesProvider>
          </CartProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
