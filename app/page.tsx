import { fetchProducts, fetchCategories, fetchPromos, fetchProducers, fetchSiteSettings } from '../lib/supabase';
import HomePage from '../components/HomePage';
import SiteClosed from '../components/SiteClosed';

export const dynamic = 'force-dynamic';

export default async function Home() {
  try {
    const [products, categories, promos, producers, settings] = await Promise.all([
      fetchProducts(),
      fetchCategories(),
      fetchPromos(),
      fetchProducers(),
      fetchSiteSettings(),
    ]);

    // Boutique en pause (réglage activable depuis l'admin → Page d'accueil)
    if (settings && settings['site.closed']) return <SiteClosed />;

    return (
      <HomePage
        products={products || []}
        categories={categories || []}
        promos={promos || []}
        producers={producers || []}
        settings={settings || {}}
      />
    );
  } catch (e) {
    return (
      <HomePage
        products={[]}
        categories={[]}
        promos={[]}
        producers={[]}
        settings={{}}
      />
    );
  }
}
