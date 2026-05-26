import { fetchProducts, fetchCategories, fetchPromos, fetchProducers } from '../lib/supabase';
import HomePage from '../components/HomePage';

export const dynamic = 'force-dynamic';

export default async function Home() {
  try {
    const [products, categories, promos, producers] = await Promise.all([
      fetchProducts(),
      fetchCategories(),
      fetchPromos(),
      fetchProducers(),
    ]);

    return (
      <HomePage
        products={products || []}
        categories={categories || []}
        promos={promos || []}
        producers={producers || []}
      />
    );
  } catch (e) {
    return (
      <HomePage
        products={[]}
        categories={[]}
        promos={[]}
        producers={[]}
      />
    );
  }
}