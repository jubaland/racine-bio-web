import { fetchProducts, fetchCategories, fetchPromos, fetchProducers } from '../lib/supabase';

const ORIGINS: Record<string, { flag: string; label: string }> = {
  DJ: { flag: '🇩🇯', label: 'Djibouti' },
  ET: { flag: '🇪🇹', label: 'Éthiopie' },
  SO: { flag: '🇸🇴', label: 'Somalie' },
  YE: { flag: '🇾🇪', label: 'Yémen' },
  FR: { flag: '🇫🇷', label: 'France' },
};

export default async function Home() {
  const [products, categories, promos, producers] = await Promise.all([
    fetchProducts(),
    fetchCategories(),
    fetchPromos(),
    fetchProducers(),
  ]);

  const localProducts = products.filter((p: any) => p.is_local);

  return (
    <div className="min-h-screen bg-[#f8faf0]">
      <header className="bg-white border-b border-[#dde8b0] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🌿</span>
            <div>
              <h1 className="text-xl font-bold text-[#526500]">Racine Bio</h1>
              <p className="text-xs text-gray-400">Le marché bio de Djibouti</p>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#produits" className="text-sm font-medium text-gray-600 hover:text-[#7d9800]">Produits</a>
            <a href="#producteurs" className="text-sm font-medium text-gray-600 hover:text-[#7d9800]">Producteurs</a>
            <a href="#promos" className="text-sm font-medium text-gray-600 hover:text-[#7d9800]">Promos</a>
          </nav>
          <button className="bg-[#a8c800] text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-[#7d9800] transition">
            📱 Télécharger l'app
          </button>
        </div>
      </header>

      <section className="bg-gradient-to-br from-[#2a4f08] to-[#5a9a18] text-white py-20 px-6">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-4 py-1 text-sm mb-6">
              🇩🇯 Produits frais de Djibouti et de la région
            </div>
            <h2 className="text-5xl font-bold mb-6 leading-tight">
              Trouvez vos <span className="italic text-[#c4e025]">légumes</span> et fruits du jour
            </h2>
            <p className="text-lg text-white/80 mb-8">
              Bio, conventionnel, local — tous les produits frais livrés directement depuis les fermes djiboutiennes.
            </p>
            <div className="flex gap-4">
              <button className="bg-white text-[#526500] px-6 py-3 rounded-full font-semibold hover:bg-[#f8faf0] transition">
                🛒 Commander maintenant
              </button>
              <button className="border border-white/40 text-white px-6 py-3 rounded-full font-medium hover:bg-white/10 transition">
                En savoir plus
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {localProducts.slice(0, 4).map((p: any) => (
              <div key={p.id} className="bg-white/10 rounded-2xl overflow-hidden backdrop-blur">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-full h-32 object-cover" />
                ) : (
                  <div className="w-full h-32 flex items-center justify-center text-5xl bg-white/10">📷</div>
                )}
                <div className="p-3">
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-white/60">{p.farm}</p>
                  <p className="text-sm font-bold text-[#c4e025] mt-1">{Number(p.price).toLocaleString()} Fdj</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white border-b border-[#dde8b0]">
        <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { emoji: "🥬", label: "Produits frais", value: products.length + "+" },
            { emoji: "👨‍🌾", label: "Producteurs", value: producers.length + "+" },
            { emoji: "🇩🇯", label: "Produits locaux", value: localProducts.length + "+" },
            { emoji: "🚚", label: "Livraison rapide", value: "48h" },
          ].map(stat => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl mb-2">{stat.emoji}</div>
              <div className="text-2xl font-bold text-[#526500]">{stat.value}</div>
              <div className="text-sm text-gray-500">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {promos.length > 0 && (
        <section id="promos" className="max-w-7xl mx-auto px-6 py-12">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">🔥 Promos du moment</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {promos.map((promo: any) => (
              <div key={promo.id} className="rounded-2xl p-6 text-white relative overflow-hidden" style={{ backgroundColor: promo.color_start || '#2a4f08' }}>
                <div className="absolute -top-4 -right-4 text-8xl opacity-20">{promo.emoji}</div>
                <span className="bg-white/25 text-xs font-semibold px-3 py-1 rounded-full inline-block mb-3">{promo.badge}</span>
                <h3 className="text-lg font-semibold mb-1">{promo.title}</h3>
                <p className="text-sm text-white/75">{promo.sub}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {localProducts.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 py-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">🇩🇯 Produits de Djibouti</h2>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {localProducts.map((p: any) => (
              <div key={p.id} className="flex-none w-48 bg-white rounded-2xl overflow-hidden border border-[#dde8b0] hover:shadow-md transition">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-full h-36 object-cover" />
                ) : (
                  <div className="w-full h-36 bg-[#f0f7e8] flex items-center justify-center text-4xl opacity-30">📷</div>
                )}
                <div className="p-3">
                  <p className="text-sm font-medium text-gray-800">{p.name}</p>
                  <p className="text-xs text-gray-400 mt-1">🌱 {p.farm}</p>
                  <p className="text-sm font-bold text-[#7d9800] mt-2">{Number(p.price).toLocaleString()} Fdj</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section id="produits" className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-gray-800">🛒 Tous les produits</h2>
          <span className="text-sm text-gray-400">{products.length} produits</span>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-4 mb-6">
          {[{ id: 'all', label: 'Tout', emoji: '🌿' }, ...categories].map((cat: any) => (
            <button key={cat.id} className="flex-none flex items-center gap-2 bg-white border border-[#dde8b0] rounded-full px-4 py-2 text-sm font-medium text-gray-600 hover:bg-[#f0f7e8] hover:border-[#a8c800] transition">
              <span>{cat.emoji}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {products.map((product: any) => {
            const origin = ORIGINS[product.origin_country] || { flag: '🌍', label: product.origin_country };
            const isBio = product.product_type === 'bio';
            return (
              <div key={product.id} className="bg-white rounded-2xl overflow-hidden border border-[#dde8b0] hover:shadow-lg transition group">
                <div className="relative h-44 bg-[#f0f7e8]">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-5xl opacity-20">📷</div>
                  )}
                  <div className={`absolute top-2 left-2 text-xs font-bold px-2 py-1 rounded-md ${isBio ? 'bg-[#eef5b0] text-[#526500]' : 'bg-orange-100 text-orange-700'}`}>
                    {isBio ? '🌿 Bio' : '🥕 Conv.'}
                  </div>
                  <div className="absolute top-2 right-2 bg-white/90 rounded-full px-2 py-1 text-xs">
                    {origin.flag}
                  </div>
                </div>
                <div className="p-3">
                  <h3 className="text-sm font-semibold text-gray-800 truncate">{product.name}</h3>
                  <p className="text-xs text-gray-400 mt-1">🌱 {product.farm}</p>
                  <div className="flex items-center justify-between mt-3">
                    <div>
                      {(product.old_price || product.oldPrice) && (
                        <p className="text-xs text-red-400 line-through">{Number(product.old_price || product.oldPrice).toLocaleString()} Fdj</p>
                      )}
                      <p className="text-sm font-bold text-[#7d9800]">{Number(product.price).toLocaleString()} Fdj <span className="text-xs font-normal text-gray-400">{product.unit}</span></p>
                    </div>
                    <button className="w-8 h-8 bg-[#a8c800] rounded-full flex items-center justify-center text-white text-lg font-bold hover:bg-[#7d9800] transition">+</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {producers.length > 0 && (
        <section id="producteurs" className="max-w-7xl mx-auto px-6 py-12">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">👨‍🌾 Nos producteurs</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {producers.map((p: any) => (
              <div key={p.id} className="bg-white rounded-2xl p-6 text-center border border-[#dde8b0] hover:shadow-md transition">
                <div className="text-4xl mb-3">{p.emoji}</div>
                <h3 className="font-semibold text-gray-800 text-sm">{p.name}</h3>
                <p className="text-xs text-gray-400 mt-1">{p.region}</p>
                <p className="text-xs text-amber-500 mt-2">{'★'.repeat(Math.round(p.rating))} {p.rating}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="bg-gradient-to-br from-[#2a4f08] to-[#5a9a18] text-white py-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">📱 Téléchargez l'application</h2>
          <p className="text-white/80 mb-8">Commandez vos produits frais depuis votre téléphone. Disponible sur Android.</p>
          <button className="bg-white text-[#526500] px-8 py-4 rounded-full font-bold text-lg hover:bg-[#f8faf0] transition">
            📥 Télécharger sur Play Store
          </button>
        </div>
      </section>

      <footer className="bg-white border-t border-[#dde8b0] py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌿</span>
            <span className="font-bold text-[#526500]">Racine Bio</span>
            <span className="text-gray-400 text-sm">— Le marché bio de Djibouti</span>
          </div>
          <p className="text-sm text-gray-400">© 2026 Racine Bio. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}