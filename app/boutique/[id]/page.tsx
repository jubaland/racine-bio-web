import { notFound } from 'next/navigation';
import { fetchProducts, supabase } from '../../../lib/supabase';
import ShopPage from '../../../components/ShopPage';

export const dynamic = 'force-dynamic';

// Vitrine d'un marchand : ses produits publiés (visibles seulement si son abonnement est actif — RLS)
export default async function BoutiquePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [{ data: profile }, products] = await Promise.all([
    supabase.from('merchant_profiles').select('shop_name, rating_avg, rating_count, whatsapp').eq('user_id', id).maybeSingle(),
    fetchProducts(),
  ]);
  if (!profile) notFound();
  const mine = products.filter((p: any) => p.owner_id === id);
  const region = mine.find((p: any) => p.region)?.region || null;
  return <ShopPage shop={{ id, name: profile.shop_name, region, rating: profile.rating_avg != null ? Number(profile.rating_avg) : null, rating_count: profile.rating_count || 0, whatsapp: profile.whatsapp || null }} products={mine} />;
}
