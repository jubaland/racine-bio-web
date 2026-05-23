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
  });
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const u = session.user;
        setForm(f => ({
          ...f,
          full_name: u.user_metadata?.full_name || '',
          email: u.email || '',
        }));
        const { data: req } = await supabase
          .from('producer_requests')
          .select('*')
          .eq('email', u.email)
          .maybeSingle();
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
      full_name: form.full_name.trim(),
      email: form.email.trim(),
      farm_name: form.farm_name.trim(),
      region: form.region.trim(),
      products_description: form.products_description.trim(),
    });
    if (err) { setError(err.message); setSubmitting(false); return; }
    setSubmitted(true);
    setSubmitting(false);
  };

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const inputCls = 'w-full border border-[#dde8b0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#a8c800] bg-[#f8faf0]';

  const renderContent = () => {
    if (loading) {
      return (
        <div className="text-center py-20">
          <p className="text-gray-400">{t('producer.loading', 'Chargement...')}</p>
        </div>
      );
    }

    if (existingRequest?.status === 'approved') {
      return (
        <div className="text-center py-16">
          <p className="text-6xl mb-4">✅</p>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            {t('producer.already_producer', 'Vous êtes déjà producteur !')}
          </h1>
          <p className="text-gray-400 mb-6">
            {t('producer.already_producer_msg', 'Votre demande a été approuvée. Accédez à votre espace producteur.')}
          </p>
          <Link
            href="/producer/dashboard"
            className="inline-block bg-[#a8c800] text-white px-8 py-3 rounded-full font-semibold hover:bg-[#7d9800] transition"
          >
            👨‍🌾 {t('producer.go_to_space', 'Accéder à mon espace')}
          </Link>
        </div>
      );
    }

    if (existingRequest?.status === 'pending') {
      return (
        <div className="text-center py-16">
          <p className="text-6xl mb-4">⏳</p>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            {t('producer.request_pending', 'Demande en cours d\'examen')}
          </h1>
          <p className="text-gray-400 mb-6">
            {t('producer.request_pending_msg', 'Votre demande est en cours de traitement. Nous vous contacterons par email.')}
          </p>
          <Link href="/" className="text-sm text-[#7d9800] hover:underline">
            ← {t('producer.back_home', "Retour à l'accueil")}
          </Link>
        </div>
      );
    }

    if (submitted) {
      return (
        <div className="text-center py-16">
          <p className="text-6xl mb-4">🎉</p>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            {t('producer.request_sent', 'Demande envoyée !')}
          </h1>
          <p className="text-gray-400 mb-6">
            {t('producer.request_sent_msg', 'Nous avons bien reçu votre demande. Notre équipe vous contactera dans les plus brefs délais.')}
          </p>
          <Link href="/" className="text-sm text-[#7d9800] hover:underline">
            ← {t('producer.back_home', "Retour à l'accueil")}
          </Link>
        </div>
      );
    }

    return (
      <>
        <div className="text-center mb-10">
          <p className="text-6xl mb-4">👨‍🌾</p>
          <h1 className="text-3xl font-bold text-gray-800 mb-3">
            {t('producer.become_title', 'Devenir producteur')}
          </h1>
          <p className="text-gray-400 text-lg max-w-md mx-auto">
            {t('producer.become_subtitle', 'Rejoignez Racine Bio et vendez vos produits frais directement aux consommateurs de Djibouti.')}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-10">
          {[
            { emoji: '🛒', title: t('producer.benefit_direct', 'Vente directe'), desc: t('producer.benefit_direct_desc', 'Sans intermédiaire') },
            { emoji: '📊', title: t('producer.benefit_dashboard', 'Tableau de bord'), desc: t('producer.benefit_dashboard_desc', 'Gérez vos produits') },
            { emoji: '💳', title: t('producer.benefit_payment', 'Paiement rapide'), desc: t('producer.benefit_payment_desc', 'Paiements sécurisés') },
          ].map(b => (
            <div key={b.title} className="bg-white rounded-2xl p-5 text-center border border-[#dde8b0]">
              <p className="text-3xl mb-2">{b.emoji}</p>
              <p className="text-sm font-semibold text-gray-800">{b.title}</p>
              <p className="text-xs text-gray-400 mt-1">{b.desc}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-3xl p-8 border border-[#dde8b0] shadow-sm">
          <h2 className="text-xl font-bold text-gray-800 mb-6">
            📝 {t('producer.form_title', 'Formulaire de demande')}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1.5 block">
                  {t('admin.field_full_name', 'Nom complet')} *
                </label>
                <input
                  value={form.full_name}
                  onChange={e => set('full_name', e.target.value)}
                  className={inputCls}
                  placeholder="Ahmed Ibrahim"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1.5 block">
                  {t('admin.field_email', 'Email')} *
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  className={inputCls}
                  placeholder="ahmed@email.com"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1.5 block">
                  {t('admin.field_farm_name', 'Nom de la ferme')} *
                </label>
                <input
                  value={form.farm_name}
                  onChange={e => set('farm_name', e.target.value)}
                  className={inputCls}
                  placeholder="Ferme Ibrahim"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1.5 block">
                  {t('admin.col_region', 'Région')}
                </label>
                <input
                  value={form.region}
                  onChange={e => set('region', e.target.value)}
                  className={inputCls}
                  placeholder="Ali Sabieh, Arta..."
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 mb-1.5 block">
                {t('admin.field_products_desc', 'Quels produits proposez-vous ?')}
              </label>
              <textarea
                value={form.products_description}
                onChange={e => set('products_description', e.target.value)}
                className={inputCls + ' h-28 resize-none'}
                placeholder="Légumes frais, fruits, plantes aromatiques..."
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#a8c800] text-white py-4 rounded-2xl font-semibold text-lg hover:bg-[#7d9800] transition disabled:opacity-50"
            >
              {submitting
                ? t('producer.sending', 'Envoi en cours...')
                : `📤 ${t('producer.send_request', 'Envoyer ma demande')}`}
            </button>
          </form>
        </div>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-[#f8faf0]">
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
      <Header onCartOpen={() => setCartOpen(true)} />
      <div className="max-w-2xl mx-auto px-6 py-12">
        {renderContent()}
      </div>
    </div>
  );
}
