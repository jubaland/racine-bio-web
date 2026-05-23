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

  const PILLARS = [
    {
      emoji: '🩺',
      title: t('about.pillar1_title', 'La santé par l\'alimentation'),
      desc: t('about.pillar1_desc', 'En Afrique, la prévention est le meilleur remède. Nous croyons profondément que manger des fruits, légumes et produits laitiers frais, sans pesticides, est le premier geste de santé publique. Hornafresh, c\'est de la médecine préventive dans votre assiette.'),
    },
    {
      emoji: '🌍',
      title: t('about.pillar2_title', 'L\'écologie comme boussole'),
      desc: t('about.pillar2_desc', 'Nous promouvons une agriculture biologique, responsable et respectueuse des terres et de la nature. Moins de pesticides, plus de vie dans les sols. Chaque producteur partenaire s\'engage dans une démarche agricole durable, et nous les accompagnons à chaque étape.'),
    },
    {
      emoji: '🔄',
      title: t('about.pillar3_title', 'Une économie circulaire'),
      desc: t('about.pillar3_desc', 'Le producteur nous vend ses produits. Nous lui fournissons engrais biologiques, conseils agronomiques et accès à un marché direct. Les fruits et légumes invendus sont transformés — compotes, yaourts, conserves — pour zéro gaspillage. L\'argent reste dans la communauté locale.'),
    },
  ];

  const CYCLE = [
    { emoji: '👨‍🌾', label: t('about.cycle1', 'Le producteur cultive'), desc: t('about.cycle1_desc', 'Agriculture bio, sans pesticides') },
    { emoji: '🛒', label: t('about.cycle2', 'Hornafresh achète'), desc: t('about.cycle2_desc', 'Prix juste, paiement rapide') },
    { emoji: '🚚', label: t('about.cycle3', 'Vous recevez'), desc: t('about.cycle3_desc', 'Frais, local, en 48h') },
    { emoji: '🌱', label: t('about.cycle4', 'On réinvestit'), desc: t('about.cycle4_desc', 'Engrais bio, conseils, formation') },
  ];

  return (
    <div className="min-h-screen bg-[#faf7e8]">
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
      <Header onCartOpen={() => setCartOpen(true)} />

      {/* Hero */}
      <section className="bg-gradient-to-br from-[#1c3a05] via-[#2d6410] to-[#7a5800] text-white py-16 md:py-24 px-4 md:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-block bg-white/20 text-white text-xs font-semibold px-4 py-1.5 rounded-full mb-6 tracking-wider uppercase">
            🌿 {t('about.tag', 'Notre mission')}
          </span>
          <h1 className="text-3xl md:text-5xl font-bold mb-6 leading-tight">
            {t('about.hero_title', 'Nourrir mieux,')} <br />
            <span className="text-[#c8e050]">{t('about.hero_title2', 'pour vivre mieux')}</span>
          </h1>
          <p className="text-base md:text-xl text-white/80 leading-relaxed max-w-2xl mx-auto">
            {t('about.hero_desc', 'Hornafresh est né d\'une conviction simple : en Afrique, la première médecine c\'est ce qu\'on mange. Nous construisons une économie circulaire autour du vivant — pour les producteurs, pour les consommateurs, pour la planète.')}
          </p>
        </div>
      </section>

      {/* Notre histoire */}
      <section className="max-w-4xl mx-auto px-4 md:px-6 py-14 md:py-20">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div>
            <span className="text-xs font-bold text-[#a8c800] uppercase tracking-widest">
              {t('about.story_tag', 'Notre histoire')}
            </span>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mt-3 mb-5 leading-snug">
              {t('about.story_title', 'Un projet social et écologique, avant tout')}
            </h2>
            <div className="space-y-4 text-gray-600 leading-relaxed text-sm md:text-base">
              <p>
                {t('about.story_p1', 'À Djibouti, comme dans beaucoup de pays africains, le système de santé reste sous pression. Pourtant, une grande partie des maladies chroniques — diabète, hypertension, maladies cardiovasculaires — peuvent être prévenues par une alimentation saine et naturelle.')}
              </p>
              <p>
                {t('about.story_p2', 'Hornafresh est né de cette conviction : accéder à des fruits, légumes et produits laitiers frais, locaux et sans pesticides ne devrait pas être un luxe. C\'est un droit. Et un acte de prévention.')}
              </p>
              <p>
                {t('about.story_p3', 'Nous voulons aussi sensibiliser les populations à l\'importance de respecter les terres et de consommer des produits cultivés avec le moins d\'intrants chimiques possible. Pour les générations futures autant que pour aujourd\'hui.')}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { emoji: '🥦', text: t('about.value1', 'Sans pesticides') },
              { emoji: '🌱', text: t('about.value2', 'Agriculture bio') },
              { emoji: '💚', text: t('about.value3', 'Santé préventive') },
              { emoji: '🤝', text: t('about.value4', 'Commerce équitable') },
            ].map(v => (
              <div key={v.text} className="bg-white border border-[#d2e095] rounded-2xl p-5 text-center hover:shadow-md transition">
                <span className="text-3xl">{v.emoji}</span>
                <p className="text-sm font-semibold text-gray-700 mt-2">{v.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3 piliers */}
      <section className="bg-white border-y border-[#d2e095] py-14 md:py-20 px-4 md:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-[#a8c800] uppercase tracking-widest">
              {t('about.pillars_tag', 'Nos engagements')}
            </span>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mt-3">
              {t('about.pillars_title', 'Trois piliers, une vision')}
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {PILLARS.map((p, i) => (
              <div key={i} className="bg-[#faf7e8] rounded-2xl p-6 border border-[#d2e095]">
                <span className="text-4xl">{p.emoji}</span>
                <h3 className="text-base font-bold text-gray-800 mt-4 mb-3">{p.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Économie circulaire */}
      <section className="max-w-4xl mx-auto px-4 md:px-6 py-14 md:py-20">
        <div className="text-center mb-12">
          <span className="text-xs font-bold text-[#a8c800] uppercase tracking-widest">
            {t('about.cycle_tag', 'Le modèle Hornafresh')}
          </span>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mt-3">
            {t('about.cycle_title', 'Une économie qui tourne en boucle')}
          </h2>
          <p className="text-gray-400 mt-2 text-sm">
            {t('about.cycle_sub', 'Chaque achat renforce le cycle — les producteurs, les consommateurs et la nature en bénéficient.')}
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {CYCLE.map((c, i) => (
            <div key={i} className="flex flex-col items-center text-center">
              <div className="relative">
                <div className="w-16 h-16 bg-[#ecf4d5] rounded-full flex items-center justify-center text-3xl border-4 border-white shadow-sm">
                  {c.emoji}
                </div>
                {i < CYCLE.length - 1 && (
                  <span className="hidden md:block absolute top-1/2 -right-6 -translate-y-1/2 text-[#a8c800] text-xl font-bold">→</span>
                )}
              </div>
              <p className="text-sm font-semibold text-gray-800 mt-3">{c.label}</p>
              <p className="text-xs text-gray-400 mt-1">{c.desc}</p>
            </div>
          ))}
        </div>

        {/* Anti-gaspi */}
        <div className="mt-10 bg-gradient-to-r from-[#ecf4d5] to-[#faf7e8] rounded-2xl p-6 border border-[#d2e095] flex items-start gap-4">
          <span className="text-3xl flex-none">♻️</span>
          <div>
            <p className="font-bold text-gray-800 mb-1">{t('about.antigaspi_title', 'Zéro gaspillage')}</p>
            <p className="text-sm text-gray-500 leading-relaxed">
              {t('about.antigaspi_desc', 'Les fruits et légumes invendus ne partent pas à la poubelle. Nous les transformons en compotes, yaourts, conserves et autres produits à valeur ajoutée — réduisant les pertes et créant de nouveaux revenus pour les producteurs.')}
            </p>
          </div>
        </div>
      </section>

      {/* Vision */}
      <section className="bg-gradient-to-br from-[#1c3a05] via-[#2d5c0a] to-[#1c3a05] text-white py-14 md:py-20 px-4 md:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <span className="text-4xl">🌟</span>
          <h2 className="text-2xl md:text-3xl font-bold mt-4 mb-5">
            {t('about.vision_title', 'Notre vision à long terme')}
          </h2>
          <p className="text-white/75 text-base md:text-lg leading-relaxed mb-8">
            {t('about.vision_desc', 'Faire de Djibouti un modèle d\'économie alimentaire circulaire et biologique pour la région. Que chaque famille ait accès à des produits sains. Que chaque agriculteur puisse vivre dignement de son travail en respectant la terre. Que la prévention par l\'alimentation devienne un réflexe culturel.')}
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/#produits"
              className="bg-[#c8e050] text-[#1c3a05] px-7 py-3.5 rounded-full font-bold hover:bg-[#d4f060] transition"
            >
              🛒 {t('about.cta_shop', 'Découvrir nos produits')}
            </Link>
            <Link
              href="/become-producer"
              className="border border-white/40 text-white px-7 py-3.5 rounded-full font-medium hover:bg-white/10 transition"
            >
              👨‍🌾 {t('about.cta_producer', 'Rejoindre le réseau')}
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
            <span className="text-gray-400 text-sm">— Le marché premium, frais, bio, local et régional de Djibouti</span>
          </div>
          <Link href="/" className="text-sm text-gray-400 hover:text-[#7d9800]">
            ← {t('about.back_home', 'Retour à l\'accueil')}
          </Link>
        </div>
      </footer>
    </div>
  );
}
