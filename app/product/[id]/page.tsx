import { fetchProducts } from '../../../lib/supabase';
import ProductDetail from '../../../components/ProductDetail';
import { notFound } from 'next/navigation';

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const products = await fetchProducts();
  const product = products.find((p: any) => String(p.id) === String(id));

  if (!product) notFound();

  return <ProductDetail product={product} allProducts={products} />;
}
