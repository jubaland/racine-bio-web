import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { LanguageProvider } from '../context/LanguageContext';
import { CartProvider } from '../context/CartContext';
import { FavoritesProvider } from '../context/FavoritesContext';
import ServiceWorkerRegister from '../components/ServiceWorkerRegister';
import InstallAppPrompt from '../components/InstallAppPrompt';
import AnnouncementBanner from '../components/AnnouncementBanner';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Hornafresh — Le marché premium, frais, bio, local et régional de Djibouti',
  description: 'Produits frais bio et locaux livrés à Djibouti',
  applicationName: 'Hornafresh',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Hornafresh' },
  icons: {
    icon: '/icon-192.png',
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#526500',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" style={{ colorScheme: 'only light' }}>
      <body className={`${inter.className} overflow-x-hidden`}>
        <script dangerouslySetInnerHTML={{ __html: "window.__bip=null;addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__bip=e;});" }} />
        <ServiceWorkerRegister />
        <LanguageProvider>
          <CartProvider>
            <FavoritesProvider>
              <AnnouncementBanner />
              {children}
              <InstallAppPrompt />
            </FavoritesProvider>
          </CartProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
