'use client';

import { useState } from 'react';
import Link from 'next/link';
import Header from '../../components/Header';
import CartDrawer from '../../components/CartDrawer';
import { useLanguage } from '../../context/LanguageContext';

export default function AboutPage() {
  const [cartOpen, setCartOpen] = useState(false);
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;

  const PROMISES = [
    {
      emoji: '📍',
      title: 'Où vous voulez',
      desc: 'À domicile, au bureau, ou à l\'adresse de votre choix à Djibouti. Vous choisissez, on s\'occupe du reste.',
    },
    {
      emoji: '🕐',
      title: 'Quand vous voulez',
      desc: 'Commandez à tout moment. Nous organisons la livraison selon vos disponibilités, à l\'heure qui vous convient.',
    },
    {
      emoji: '✅',
      title: 'Sélectionnés pour vous',
      desc: 'Chaque produit est inspecté et validé par notre équipe avant d\'arriver chez vous. Qualité garantie à chaque commande.',
    },
    {
      emoji: '🌱',
      title: 'Local & bio en priorité',
      desc: 'Quand c\'est possible, nous choisissons d\'abord le local et le bio. C\'est notre boussole — aujourd\'hui et demain.',
    },
  ];

  const STEPS = [
    {
      emoji: '🛒',
      n: '1',
      title: 'Vous choisissez',
      desc: 'Parcourez notre catalogue et sélectionnez vos fruits et légumes préférés en quelques clics.',
    },
    {
      emoji: '🔍',
      n: '2',
      title: 'On sélectionne',
      desc: 'Notre équipe choisit pour vous les meilleurs produits du marché — mûrs à point, sans défaut.',
    },
    {
      emoji: '🚚',
      n: '3',
      title: 'On livre',
      desc: 'Vos produits arrivent frais à l\'adresse et à l\'heure de votre choix, emballés avec soin.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#faf7e8]">
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
      <Header onCartOpen={() => setCartOpen(true)} />

      {/* Hero */}
      <section className="bg-gradient-to-br from-[#1c3a05] via-[#2d6410] to-[#7a5800] text-white py-16 md:py-24 px-4 md:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-block bg-white/20 text-white text-xs font-semibold px-4 py-1.5 rounded-full mb-6 tracking-wider uppercase">
            🌿 Hornafresh — Djibouti
          </span>
          <h1 className="text-3xl md:text-5xl font-bold mb-6 leading-tight">
            Livré <span className="text-[#c8e050]">où vous voulez,</span><br />
            quand vous voulez.
          </h1>
          <p className="text-base md:text-xl text-white/80 leading-relaxed max-w-2xl mx-auto">
            Des produits frais — fruits et légumes — sélectionnés pour leur qualité par nos équipes
            et livrés directement chez vous à Djibouti.
            Locaux quand c'est possible, bio quand c'est disponible.
          </p>
          <div className="mt-10 flex flex-wrap gap-4 justify-center">
            <Link
              href="/#produits"
              className="bg-[#c8e050] text-[#1c3a05] px-7 py-3.5 rounded-full font-bold hover:bg-[#d4f060] transition"
            >
              🛒 Commander maintenant
            </Link>
            <Link
              href="/#producteurs"
              className="border border-white/40 text-white px-7 py-3.5 rounded-full font-medium hover:bg-white/10 transition"
            >
              👨‍🌾 Nos producteurs locaux
            </Link>
          </div>
        </div>
      </section>

      {/* Nos 4 promesses */}
      <section className="max-w-5xl mx-auto px-4 md:px-6 py-14 md:py-20">
        <div className="text-center mb-12">
          <span className="text-xs font-bold text-[#a8c800] uppercase tracking-widest">Ce qu'on vous promet</span>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mt-3">
            La fraîcheur, sans compromis
          </h2>
          <p className="text-gray-400 mt-2 text-sm max-w-xl mx-auto">
            Hornafresh, c'est une promesse simple : recevoir chez vous des produits frais, triés et vérifiés —
            exactement quand et où vous le souhaitez.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-5">
          {PROMISES.map((p, i) => (
            <div key={i} className="bg-white rounded-2xl p-6 border border-[#d2e095] hover:shadow-md transition text-center">
              <span className="text-4xl">{p.emoji}</span>
              <h3 className="text-sm font-bold text-gray-800 mt-4 mb-2">{p.title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Local & bio : notre ADN */}
      <section className="bg-white border-y border-[#d2e095] py-14 md:py-20 px-4 md:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <span className="text-xs font-bold text-[#a8c800] uppercase tracking-widest">Notre philosophie</span>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mt-3 mb-5 leading-snug">
                Le local et le bio,<br />c'est notre cap.
              </h2>
              <div className="space-y-4 text-gray-600 leading-relaxed text-sm md:text-base">
                <p>
                  Chez Hornafresh, chaque produit que nous proposons est sélectionné avec soin.
                  Quand un producteur local cultive à proximité, nous le privilégions —
                  circuit plus court, produit plus frais, économie locale renforcée.
                </p>
                <p>
                  Quand une exploitation locale s'engage vers l'agriculture biologique,
                  nous la soutenons et mettons ses produits en avant.
                  Ce n'est pas encore la majorité de notre catalogue,
                  mais c'est clairement la direction que nous traçons ensemble.
                </p>
                <p className="font-medium text-[#526500]">
                  Notre conviction : le bio et le local ne sont pas un luxe à Djibouti.
                  Ce sont des choix d'avenir — pour la santé, pour les terres, pour les agriculteurs.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { emoji: '🏡', text: 'Producteurs locaux', sub: 'En priorité, toujours' },
                { emoji: '🌱', text: 'Bio quand disponible', sub: 'Progrès saison après saison' },
                { emoji: '🚜', text: 'Circuit court', sub: 'Du champ à votre table' },
                { emoji: '💚', text: 'Santé & prévention', sub: 'Manger frais, c\'est se soigner' },
              ].map(v => (
                <div key={v.text} className="bg-[#faf7e8] border border-[#d2e095] rounded-2xl p-5 text-center hover:shadow-sm transition">
                  <span className="text-3xl">{v.emoji}</span>
                  <p className="text-sm font-semibold text-gray-700 mt-2">{v.text}</p>
                  <p className="text-xs text-gray-400 mt-1">{v.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Comment ça marche */}
      <section className="max-w-4xl mx-auto px-4 md:px-6 py-14 md:py-20">
        <div className="text-center mb-12">
          <span className="text-xs font-bold text-[#a8c800] uppercase tracking-widest">Simple et rapide</span>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mt-3">
            Comment ça marche ?
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6 relative">
          {STEPS.map((s, i) => (
            <div key={i} className="flex flex-col items-center text-center relative">
              <div className="w-16 h-16 bg-[#ecf4d5] rounded-full flex items-center justify-center text-3xl border-4 border-white shadow-sm relative z-10">
                {s.emoji}
              </div>
              {i < STEPS.length - 1 && (
                <span className="hidden md:block absolute top-8 left-[calc(50%+2rem)] w-[calc(100%-4rem)] h-0.5 bg-[#d2e095] z-0" />
              )}
              <div className="mt-5">
                <span className="inline-block bg-[#a8c800] text-white text-xs font-bold w-5 h-5 rounded-full text-center leading-5 mb-2">{s.n}</span>
                <h3 className="text-sm font-bold text-gray-800 mb-2">{s.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* La sélection qualité */}
      <section className="bg-white border-y border-[#d2e095] py-14 md:py-20 px-4 md:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-r from-[#ecf4d5] to-[#faf7e8] rounded-3xl p-8 md:p-12 border border-[#d2e095]">
            <div className="max-w-2xl mx-auto text-center">
              <span className="text-5xl">🔍</span>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mt-5 mb-4">
                Notre équipe sélectionne pour vous
              </h2>
              <p className="text-gray-600 leading-relaxed text-sm md:text-base mb-6">
                Pas besoin de passer des heures au marché à trier les produits un à un.
                Notre équipe le fait pour vous. Chaque fruit, chaque légume est inspecté
                — couleur, texture, maturité, provenance — avant d'être emballé et livré.
                <br /><br />
                Et quand un produit local ou bio est disponible à qualité équivalente,
                c'est lui qui remplit votre panier en premier.
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                {['Maturité vérifiée', 'Sans défaut visible', 'Pesée précise', 'Local prioritaire', 'Bio mis en avant', 'Emballage soigné'].map(tag => (
                  <span key={tag} className="bg-white border border-[#d2e095] text-[#526500] text-xs font-semibold px-4 py-2 rounded-full">
                    ✓ {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Vision */}
      <section className="bg-gradient-to-br from-[#1c3a05] via-[#2d5c0a] to-[#1c3a05] text-white py-14 md:py-20 px-4 md:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <span className="text-4xl">🌟</span>
          <h2 className="text-2xl md:text-3xl font-bold mt-4 mb-5">
            Aujourd'hui frais. Demain local et bio.
          </h2>
          <p className="text-white/75 text-base md:text-lg leading-relaxed mb-8">
            Hornafresh, c'est d'abord un service de livraison de produits frais et de qualité —
            accessibles à tous, partout à Djibouti. Mais c'est aussi un projet de fond :
            accompagner les producteurs locaux, développer les filières bio de la région
            et faire en sorte que dans les années à venir, le local et le bio soient
            la norme dans votre panier, pas l'exception.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/#produits"
              className="bg-[#c8e050] text-[#1c3a05] px-7 py-3.5 rounded-full font-bold hover:bg-[#d4f060] transition"
            >
              🛒 Découvrir nos produits
            </Link>
            <Link
              href="/become-producer"
              className="border border-white/40 text-white px-7 py-3.5 rounded-full font-medium hover:bg-white/10 transition"
            >
              👨‍🌾 Rejoindre le réseau
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-[#d2e095] py-6 px-4 md:px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌿</span>
            <span className="font-bold text-[#526500]">Hornafresh</span>
            <span className="text-gray-400 text-sm">— Livraison de produits frais à Djibouti</span>
          </div>
          <Link href="/" className="text-sm text-gray-400 hover:text-[#7d9800]">
            ← Retour à l'accueil
          </Link>
        </div>
      </footer>
    </div>
  );
}
