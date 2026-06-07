import { fetchProducts, fetchCategories, fetchPromos, fetchProducers, fetchSiteSettings } from '../lib/supabase';
import HomePage from '../components/HomePage';

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
