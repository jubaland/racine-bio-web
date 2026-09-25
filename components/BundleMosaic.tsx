'use client';

// Visuel par défaut d'un panier composé sans photo : mosaïque des photos de ses composants
// (1 à 4 vignettes, mise en page CSS — rien n'est généré ni stocké). Remplacé par la vraie
// photo du panier dès qu'elle est renseignée dans la fiche.
export default function BundleMosaic({ items, className = '' }: { items: { image_url?: string | null; name?: string }[]; className?: string }) {
  const imgs = (items || []).filter(i => i.image_url).slice(0, 4);
  if (!imgs.length) return <div className={`w-full h-full flex items-center justify-center text-5xl opacity-20 ${className}`}>🧺</div>;
  if (imgs.length === 1) return <img src={imgs[0].image_url!} alt={imgs[0].name || ''} className={`w-full h-full object-cover ${className}`} />;
  const cols = imgs.length === 2 ? 'grid-cols-2 grid-rows-1' : 'grid-cols-2 grid-rows-2';
  return (
    <div className={`grid ${cols} gap-0.5 w-full h-full bg-white ${className}`}>
      {imgs.map((im, i) => (
        <img key={`${im.image_url}-${i}`} src={im.image_url!} alt={im.name || ''} className={`w-full h-full object-cover min-h-0 ${imgs.length === 3 && i === 0 ? 'row-span-2' : ''}`} />
      ))}
    </div>
  );
}
