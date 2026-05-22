import { fetchProducts } from '../../../lib/supabase';
import ProductDetail from '../../../components/ProductDetail';

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const products = await fetchProducts();
  const product = products.find((p: any) => String(p.id) === String(id));

  if (!product) {
    return (
      <div className="min-h-screen bg-[#f8faf0] flex items-center justify-center">
        <div className="text-center">
          <p className="text-5xl mb-4">🌿</p>
          <p className="text-gray-400 text-lg">Produit non trouvé</p>
          <a href="/" className="mt-4 inline-block text-sm text-[#7d9800] hover:underline">← Retour à l'accueil</a>
        </div>
      </div>
    );
  }

  return <ProductDetail product={product} allProducts={products} />;
}