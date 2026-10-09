'use client';

import { useState } from 'react';
import Link from 'next/link';
import Header from '../../components/Header';
import CartDrawer from '../../components/CartDrawer';
import { useLanguage } from '../../context/LanguageContext';
import { HORNAFRESH_PHONE } from '../../lib/payments';

// Politique de confidentialité — page publique exigée par Google Play (fiche + Sécurité des données),
// avec une ancre #suppression pour le lien « demande de suppression de compte » de la Play Console.
export default function PrivacyPage() {
  const [cartOpen, setCartOpen] = useState(false);
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;
  const phone = `+253 ${HORNAFRESH_PHONE}`;

  const SECTIONS: { id?: string; title: string; body: string[] }[] = [
    {
      title: t('privacy.s1_t', 'Qui sommes-nous ?'),
      body: [
        t('privacy.s1_d', 'Hornafresh exploite le site et l\'application www.hornafresh.com, un marché de produits frais livrés à Djibouti. Pour toute question concernant vos données, contactez-nous sur WhatsApp au {phone}.').replace('{phone}', phone),
      ],
    },
    {
      title: t('privacy.s2_t', 'Les données que nous collectons'),
      body: [
        t('privacy.s2_d1', 'Votre compte : nom, adresse e-mail, numéro de téléphone et adresses de livraison que vous renseignez.'),
        t('privacy.s2_d2', 'Vos commandes : articles, montants, historique, et le cas échéant le solde de votre cagnotte ou de votre carnet de crédit.'),
        t('privacy.s2_d3', 'Vos préférences : langue choisie, produits favoris, panier en cours.'),
        t('privacy.s2_d4', 'Des données techniques minimales (journaux d\'erreurs) pour maintenir le service en bon état.'),
      ],
    },
    {
      title: t('privacy.s3_t', 'Ce que nous en faisons'),
      body: [
        t('privacy.s3_d1', 'Préparer et livrer vos commandes, gérer votre cagnotte et votre crédit, vous informer du statut de vos commandes et améliorer le service.'),
        t('privacy.s3_d2', 'Nous ne vendons jamais vos données et n\'affichons aucune publicité tierce.'),
      ],
    },
    {
      title: t('privacy.s4_t', 'E-mails et notifications'),
      body: [
        t('privacy.s4_d1', 'Nous envoyons des e-mails liés à vos commandes, et parfois des annonces : chaque annonce contient un lien de désinscription en un clic.'),
        t('privacy.s4_d2', 'Les notifications push ne sont activées que si vous les acceptez, et restent désactivables à tout moment dans les réglages de votre téléphone ou navigateur.'),
      ],
    },
    {
      title: t('privacy.s5_t', 'Cookies et stockage local'),
      body: [
        t('privacy.s5_d', 'Nous utilisons uniquement le stockage nécessaire au fonctionnement : votre session de connexion, votre panier et votre langue. Aucun cookie publicitaire, aucun traceur tiers.'),
      ],
    },
    {
      title: t('privacy.s6_t', 'Avec qui nous les partageons'),
      body: [
        t('privacy.s6_d1', 'Uniquement nos prestataires techniques : hébergement du site (Vercel), base de données (Supabase) et envoi d\'e-mails. Ils traitent les données pour notre compte, rien d\'autre.'),
        t('privacy.s6_d2', 'Nos livreurs reçoivent seulement le nom, l\'adresse et le téléphone nécessaires à votre livraison.'),
      ],
    },
    {
      title: t('privacy.s7_t', 'Combien de temps nous les gardons'),
      body: [
        t('privacy.s7_d', 'Votre compte est conservé tant qu\'il est actif. Les commandes sont conservées pour nos obligations comptables.'),
      ],
    },
    {
      title: t('privacy.s8_t', 'Vos droits'),
      body: [
        t('privacy.s8_d', 'Vous pouvez consulter et corriger vos informations à tout moment depuis votre profil, et demander une copie ou la suppression de vos données en nous contactant.'),
      ],
    },
    {
      id: 'suppression',
      title: t('privacy.s9_t', 'Supprimer votre compte'),
      body: [
        t('privacy.s9_d1', 'Envoyez-nous simplement « Supprimer mon compte » sur WhatsApp au {phone}, depuis le numéro associé à votre compte, ou par e-mail depuis l\'adresse de votre compte.').replace('{phone}', phone),
        t('privacy.s9_d2', 'Nous supprimons alors votre compte et vos données personnelles sous 30 jours. Les lignes de commandes déjà livrées sont conservées de façon anonymisée pour la comptabilité. Tout solde de cagnotte vous est remboursé avant la suppression.'),
      ],
    },
    {
      title: t('privacy.s10_t', 'Sécurité'),
      body: [
        t('privacy.s10_d', 'Les échanges avec le site sont chiffrés (HTTPS) et l\'accès aux données est limité aux personnes qui en ont besoin pour vous servir.'),
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-[#fdfcf7]">
      <Header onCartOpen={() => setCartOpen(true)} />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />

      <main className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold text-[#1c3a05]">{t('privacy.title', 'Politique de confidentialité')}</h1>
        <p className="text-sm text-gray-400 mt-2">{t('privacy.updated', 'Dernière mise à jour :')} 09/10/2026</p>
        <p className="mt-4 text-gray-600">
          {t('privacy.intro', 'Votre confiance compte autant que la fraîcheur de nos produits. Cette page explique simplement quelles données nous collectons, pourquoi, et comment les contrôler.')}
        </p>

        {SECTIONS.map((s, i) => (
          <section key={i} id={s.id} className="mt-8 scroll-mt-24">
            <h2 className="text-xl font-semibold text-[#526500]">{s.title}</h2>
            {s.body.map((p, j) => (
              <p key={j} className="mt-2 text-gray-600 leading-relaxed">{p}</p>
            ))}
          </section>
        ))}

        <p className="mt-10 text-sm text-gray-400">
          {t('privacy.changes', 'Si cette politique évolue, la nouvelle version sera publiée sur cette page.')}
        </p>
        <div className="mt-8">
          <Link href="/" className="text-sm text-[#7d9800] hover:underline">← {t('privacy.back', 'Retour à l\'accueil')}</Link>
        </div>
      </main>
    </div>
  );
}
