'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import Header from '../../components/Header';
import CartDrawer from '../../components/CartDrawer';
import { useLanguage } from '../../context/LanguageContext';

export default function BecomeProducerPage() {
  const [cartOpen, setCartOpen] = useState(false);
  const [existingRequest, setExistingRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    full_name: '', email: '', farm_name: '', region: '', products_description: '',
    phone: '', farm_size: '', experience_years: '',
  });
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;

  const BENEFITS = [
    { emoji: '🛒', title: t('bp.b1_title', 'Vente directe'),            desc: t('bp.b1_desc', 'Accédez à des milliers de consommateurs sans intermédiaire. Vous fixez vos prix, vous gardez vos marges.') },
    { emoji: '🌱', title: t('bp.b2_title', 'Semences bio certifiées'),   desc: t('bp.b2_desc', 'Approvisionnement en semences de qualité à tarifs préférentiels négociés avec nos partenaires agricoles.') },
    { emoji: '🎓', title: t('bp.b3_title', 'Conseil agronomique'),       desc: t('bp.b3_desc', 'Accompagnement technique personnalisé : rotation des cultures, agriculture bio, gestion de l\'eau.') },
    { emoji: '🚜', title: t('bp.b4_title', 'Matériel agricole partagé'), desc: t('bp.b4_desc', 'Accès à du matériel mutualisé entre producteurs partenaires — location, prêt, maintenance collective.') },
    { emoji: '💬', title: t('bp.b5_title', 'Espace d\'échange'),         desc: t('bp.b5_desc', 'Rejoignez une communauté active de producteurs. Partagez vos expériences, construisez ensemble.') },
    { emoji: '📊', title: t('bp.b6_title', 'Tableau de bord complet'),   desc: t('bp.b6_desc', 'Gérez vos produits, stocks et commandes en temps réel depuis votre espace producteur.') },
  ];

  const STATS = [
    { value: '100%', label: t('bp.stat1', 'Produits vérifiés et traçables') },
    { value: '48h',  label: t('bp.stat2', 'Délai de traitement des candidatures') },
    { value: '0%',   label: t('bp.stat3', 'Commission sur les 3 premiers mois') },
  ];

  const STEPS = [
    { step: '1', emoji: '📝', title: t('bp.step1_title', 'Déposez votre candidature'), desc: t('bp.step1_desc', 'Remplissez le formulaire en bas de page. C\'est rapide — 2 minutes suffisent.') },
    { step: '2', emoji: '🤝', title: t('bp.step2_title', 'Entretien avec notre équipe'), desc: t('bp.step2_desc', 'Nous vous contactons sous 48h pour valider votre profil et répondre à vos questions.') },
    { step: '3', emoji: '🚀', title: t('bp.step3_title', 'Commencez à vendre'), desc: t('bp.step3_desc', 'Votre espace est activé. Ajoutez vos produits et recevez vos premières commandes.') },
  ];

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const u = session.user;
        setForm(f => ({ ...f, full_name: u.user_metadata?.full_name || '', email: u.email || '' }));
        const { data: req } = await supabase
          .from('producer_requests').select('*').eq('email', u.email).maybeSingle();
        setExistingRequest(req || null);
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name || !form.email || !form.farm_name) return;
    setSubmitting(true);
    setError('');
    const { error: err } = await supabase.from('producer_requests').insert({
      full_name: form.full_name.trim(), email: form.email.trim(),
      farm_name: form.farm_name.trim(), region: form.region.trim(),
      products_description: form.products_description.trim(),
    });
    if (err) { setError(err.message); setSubmitting(false); return; }
    setSubmitted(true);
    setSubmitting(false);
  };

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const inputCls = 'w-full border border-[#d2e095] rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:border-[#a8c800] bg-white';

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf7e8] flex items-center justify-center">
        <p className="text-gray-400">{t('producer.loading', 'Chargement...')}</p>
      </div>
    );
  }

  if (existingRequest?.status === 'approved') {
    return (
      <div className="min-h-screen bg-[#faf7e8]">
        <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
        <Header onCartOpen={() => setCartOpen(true)} />
        <div className="max-w-lg mx-auto px-6 py-24 text-center">
          <p className="text-6xl mb-4">✅</p>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">{t('producer.already_producer', 'Vous êtes déjà producteur !')}</h1>
          <p className="text-gray-400 mb-8">{t('producer.already_producer_msg', 'Votre demande a été approuvée. Accédez à votre espace producteur.')}</p>
          <Link href="/producer/dashboard" className="inline-block bg-[#a8c800] text-white px-8 py-3 rounded-full font-semibold hover:bg-[#7d9800] transition">
            👨‍🌾 {t('producer.go_to_space', 'Accéder à mon espace')}
          </Link>
        </div>
      </div>
    );
  }

  if (existingRequest?.status === 'pending') {
    return (
      <div className="min-h-screen bg-[#faf7e8]">
        <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
        <Header onCartOpen={() => setCartOpen(true)} />
        <div className="max-w-lg mx-auto px-6 py-24 text-center">
          <p className="text-6xl mb-4">⏳</p>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">{t('producer.request_pending', "Demande en cours d'examen")}</h1>
          <p className="text-gray-400 mb-8">{t('producer.request_pending_msg', 'Votre demande est en cours de traitement. Nous vous contacterons par email sous 48h.')}</p>
          <Link href="/" className="text-sm text-[#7d9800] hover:underline">← {t('producer.back_home', "Retour à l'accueil")}</Link>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#faf7e8]">
        <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
        <Header onCartOpen={() => setCartOpen(true)} />
        <div className="max-w-lg mx-auto px-6 py-24 text-center">
          <p className="text-6xl mb-4">🎉</p>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">{t('producer.request_sent', 'Candidature envoyée !')}</h1>
          <p className="text-gray-500 mb-2">{t('producer.request_sent_msg', 'Nous avons bien reçu votre demande.')}</p>
          <p className="text-gray-400 text-sm mb-8">
            {t('bp.contact_email_prefix', 'Notre équipe vous contactera à')} <strong>{form.email}</strong> {t('bp.contact_email_suffix', 'dans les 48h.')}
          </p>
          <Link href="/" className="text-sm text-[#7d9800] hover:underline">← {t('producer.back_home', "Retour à l'accueil")}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf7e8]">
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
      <Header onCartOpen={() => setCartOpen(true)} />

      {/* Hero */}
      <section className="bg-gradient-to-br from-[#1c3a05] via-[#2d6410] to-[#1c3a05] text-white py-12 md:py-20 px-4 md:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-block bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full mb-5 md:mb-6">
            👨‍🌾 {t('bp.hero_tag', 'Programme Producteurs Partenaires')}
          </span>
          <h1 className="text-2xl md:text-4xl font-bold mb-4 md:mb-5 leading-tight">
            {t('bp.hero_title1', 'Vendez mieux,')}<br />
            <span className="text-[#c8e050]">{t('bp.hero_title2', 'cultivez avec nous')}</span>
          </h1>
          <p className="text-white/75 text-base md:text-lg max-w-xl mx-auto mb-7 md:mb-8 leading-relaxed">
            {t('bp.hero_desc', "Hornafresh vous ouvre l'accès à un marché direct, mais aussi à des ressources concrètes pour développer votre activité agricole.")}
          </p>
          <a href="#candidature" className="inline-block bg-[#c8e050] text-[#1c3a05] px-6 md:px-8 py-3.5 md:py-4 rounded-full font-bold text-base md:text-lg hover:bg-[#d4f060] transition">
            📤 {t('bp.hero_cta', 'Déposer ma candidature')}
          </a>
        </div>
      </section>

      {/* Ce qu'on vous offre */}
      <section className="max-w-5xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold text-gray-800">{t('bp.benefits_title', 'Ce que vous gagnez en rejoignant Hornafresh')}</h2>
          <p className="text-gray-400 mt-2">{t('bp.benefits_sub', "Bien plus qu'une plateforme de vente")}</p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {BENEFITS.map(b => (
            <div key={b.title} className="bg-white rounded-2xl p-6 border border-[#d2e095] hover:shadow-md transition">
              <span className="text-3xl">{b.emoji}</span>
              <h3 className="text-base font-bold text-gray-800 mt-3 mb-2">{b.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Chiffres */}
      <section className="bg-white border-y border-[#d2e095] py-10 px-6">
        <div className="max-w-3xl mx-auto grid grid-cols-3 gap-6 text-center">
          {STATS.map(s => (
            <div key={s.label}>
              <p className="text-3xl font-bold text-[#526500]">{s.value}</p>
              <p className="text-sm text-gray-400 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Comment rejoindre */}
      <section className="max-w-4xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold text-gray-800">{t('bp.steps_title', 'Comment rejoindre le réseau ?')}</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {STEPS.map((s, i) => (
            <div key={s.step} className="flex flex-col items-center text-center relative">
              {i < STEPS.length - 1 && (
                <div className="hidden md:block absolute top-9 left-1/2 w-full h-0.5 bg-[#d2e095]" />
              )}
              <div className="w-16 h-16 bg-[#ecf4d5] rounded-full flex items-center justify-center text-3xl mb-4 border-4 border-[#faf7e8] z-10">
                {s.emoji}
              </div>
              <span className="text-xs font-bold text-[#a8c800] uppercase tracking-widest mb-1">
                {t('bp.step_label', 'Étape')} {s.step}
              </span>
              <h3 className="text-base font-bold text-gray-800 mb-2">{s.title}</h3>
              <p className="text-sm text-gray-500">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Formulaire */}
      <section id="candidature" className="max-w-2xl mx-auto px-4 md:px-6 pb-16 md:pb-20">
        <div className="bg-white rounded-3xl p-5 sm:p-8 border border-[#d2e095] shadow-sm">
          <h2 className="text-xl font-bold text-gray-800 mb-1">📝 {t('bp.form_title', 'Formulaire de candidature')}</h2>
          <p className="text-sm text-gray-400 mb-6">{t('bp.form_required', 'Tous les champs marqués * sont obligatoires.')}</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>}

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1.5 block">{t('bp.field_fullname', 'Nom complet')} *</label>
                <input value={form.full_name} onChange={e => set('full_name', e.target.value)} className={inputCls} placeholder="Ahmed Ibrahim" required />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1.5 block">{t('bp.field_email', 'Email')} *</label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className={inputCls} placeholder="ahmed@email.com" required />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1.5 block">{t('bp.field_phone', 'Téléphone')}</label>
                <input value={form.phone} onChange={e => set('phone', e.target.value)} className={inputCls} placeholder="+253 77 00 00 00" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1.5 block">{t('bp.field_region', 'Région')}</label>
                <input value={form.region} onChange={e => set('region', e.target.value)} className={inputCls} placeholder="Ali Sabieh, Arta..." />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1.5 block">{t('bp.field_farm_name', 'Nom de la ferme')} *</label>
                <input value={form.farm_name} onChange={e => set('farm_name', e.target.value)} className={inputCls} placeholder="Ferme Ibrahim" required />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1.5 block">{t('bp.field_farm_size', 'Surface cultivée')}</label>
                <input value={form.farm_size} onChange={e => set('farm_size', e.target.value)} className={inputCls} placeholder="ex: 2 hectares" />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-600 mb-1.5 block">{t('bp.field_experience', "Années d'expérience en agriculture")}</label>
              <select value={form.experience_years} onChange={e => set('experience_years', e.target.value)} className={inputCls}>
                <option value="">— {t('bp.select_placeholder', 'Sélectionner')} —</option>
                <option value="0-2">{t('bp.exp_0_2', 'Moins de 2 ans')}</option>
                <option value="2-5">{t('bp.exp_2_5', '2 à 5 ans')}</option>
                <option value="5-10">{t('bp.exp_5_10', '5 à 10 ans')}</option>
                <option value="10+">{t('bp.exp_10', 'Plus de 10 ans')}</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-600 mb-1.5 block">{t('bp.field_products', 'Quels produits proposez-vous ?')}</label>
              <textarea
                value={form.products_description}
                onChange={e => set('products_description', e.target.value)}
                className={inputCls + ' h-28 resize-none'}
                placeholder={t('bp.field_products_placeholder', 'Légumes frais, fruits, plantes aromatiques, œufs...')}
              />
            </div>

            <div className="bg-[#f8fdf0] border border-[#d2e095] rounded-xl p-4 text-sm text-gray-500">
              🔒 {t('bp.privacy_note', 'Vos informations sont confidentielles et ne seront utilisées que pour traiter votre candidature.')}
            </div>

            <button type="submit" disabled={submitting} className="w-full bg-[#a8c800] text-white py-4 rounded-2xl font-semibold text-base hover:bg-[#7d9800] transition disabled:opacity-50">
              {submitting ? t('producer.sending', 'Envoi en cours...') : `📤 ${t('bp.submit', 'Envoyer ma candidature')}`}
            </button>
          </form>
        </div>

        <div className="text-center mt-6">
          <Link href="/" className="text-sm text-gray-400 hover:text-[#7d9800]">← {t('producer.back_home', "Retour à l'accueil")}</Link>
        </div>
      </section>
    </div>
  );
}
