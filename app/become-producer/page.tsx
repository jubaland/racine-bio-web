'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import Header from '../../components/Header';
import CartDrawer from '../../components/CartDrawer';
import { useLanguage } from '../../context/LanguageContext';

// Onboarding « Devenir marchand » — modèle hub : le marchand publie (validation Hornafresh), le client
// commande et paie sur Hornafresh, Hornafresh prépare et livre, le marchand est reversé à 100 % du prix
// de ses articles livrés. Abonnement seul (plan actif de merchant_plans), pas de commission.
// La demande nécessite un compte (elle est rattachée au compte qui deviendra marchand).

type Plan = { name: string; price_fdj: number; duration_days: number };
type Req = { id: string; status: string; farm_name: string; created_at: string; admin_note: string | null };

export default function BecomeMerchantPage() {
  const [cartOpen, setCartOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [request, setRequest] = useState<Req | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [reapply, setReapply] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ full_name: '', farm_name: '', phone: '', region: '', products_description: '' });
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;
  const fdj = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} Fdj`;

  useEffect(() => {
    (async () => {
      const [{ data: { session } }, { data: plans }] = await Promise.all([
        supabase.auth.getSession(),
        supabase.from('merchant_plans').select('name, price_fdj, duration_days').eq('is_active', true).order('price_fdj').limit(1),
      ]);
      setPlan(plans?.[0] || null);
      if (session) {
        const u = session.user;
        setUser(u);
        setForm(f => ({ ...f, full_name: u.user_metadata?.full_name || '', phone: u.user_metadata?.phone || '' }));
        const { data: req } = await supabase.from('producer_requests').select('id, status, farm_name, created_at, admin_note')
          .eq('email', u.email).order('created_at', { ascending: false }).limit(1).maybeSingle();
        setRequest(req || null);
      }
      setLoading(false);
    })();
  }, []);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const isMerchant = user?.user_metadata?.role === 'producer';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.full_name.trim() || !form.farm_name.trim() || !form.phone.trim() || !form.products_description.trim()) {
      setError(t('join.err_required', 'Merci de remplir tous les champs marqués *.')); return;
    }
    setSubmitting(true); setError('');
    const { error: err } = await supabase.from('producer_requests').insert({
      user_id: user.id, email: user.email, full_name: form.full_name.trim(), farm_name: form.farm_name.trim(),
      phone: form.phone.trim(), region: form.region.trim() || null, products_description: form.products_description.trim(), status: 'pending',
    });
    if (err) { setError(err.message); setSubmitting(false); return; }
    // Alerte admin (cloche + push) — non bloquante
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch('/api/merchant-request/notify', { method: 'POST', headers: { Authorization: `Bearer ${session?.access_token}` } });
    } catch { /* ignore */ }
    setSubmitted(true); setSubmitting(false);
  };

  const inputCls = 'w-full border border-[#d2e095] rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:border-[#a8c800] bg-white';
  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen bg-[#faf7e8]">
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
      <Header onCartOpen={() => setCartOpen(true)} />
      {children}
    </div>
  );

  if (loading) return <div className="min-h-screen bg-[#faf7e8] flex items-center justify-center"><p className="text-gray-400">{t('producer.loading', 'Chargement...')}</p></div>;

  const HOW = [
    { emoji: '🥬', title: t('join.how1_title', 'Vous publiez vos produits'), desc: t('join.how1_desc', 'Nom, prix, photo, stock. Hornafresh valide chaque fiche avant sa mise en ligne.') },
    { emoji: '🛒', title: t('join.how2_title', 'Les clients commandent sur Hornafresh'), desc: t('join.how2_desc', 'Ils paient sur la plateforme (Waafi, espèces, cagnotte). Vous êtes prévenu de chaque commande avec la liste à fournir.') },
    { emoji: '🚚', title: t('join.how3_title', 'Hornafresh prépare et livre'), desc: t('join.how3_desc', 'Vous fournissez vos articles, nous assurons la préparation, la livraison et le service client.') },
    { emoji: '💸', title: t('join.how4_title', 'Vous êtes reversé à 100 %'), desc: t('join.how4_desc', 'Le prix de chaque article livré vous revient intégralement. Relevé et historique des reversements dans votre espace.') },
  ];
  const STEPS = [
    { emoji: '👤', title: t('join.step1', 'Créez votre compte'), desc: t('join.step1_desc', 'Le même compte servira à gérer votre boutique.') },
    { emoji: '📝', title: t('join.step2', 'Déposez votre demande'), desc: t('join.step2_desc', 'Enseigne, contact, produits envisagés : 2 minutes.') },
    { emoji: '✅', title: t('join.step3', 'Validation sous 48 h'), desc: t('join.step3_desc', 'Nous vous rappelons pour finaliser et répondre à vos questions.') },
    { emoji: '💳', title: t('join.step4', 'Activez votre abonnement'), desc: t('join.step4_desc', 'Réglez l\'abonnement, publiez vos produits, recevez vos commandes.') },
  ];
  const RULES = [
    t('join.rule1', 'Produits frais, locaux ou régionaux, conformes à la charte Hornafresh.'),
    t('join.rule2', 'Photos réelles et stock tenu à jour : un produit à zéro n\'est plus commandable.'),
    t('join.rule3', 'Articles fournis à Hornafresh dans les délais de préparation annoncés.'),
    t('join.rule4', 'Toute modification sensible d\'une fiche (prix, nom, photo…) repasse en validation.'),
  ];

  // ── Statuts existants ──
  if (isMerchant || request?.status === 'approved') {
    return <Shell><div className="max-w-lg mx-auto px-6 py-24 text-center">
      <p className="text-6xl mb-4">🏪</p>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">{t('join.approved_title', 'Vous êtes marchand partenaire !')}</h1>
      <p className="text-gray-400 mb-8">{t('join.approved_msg', 'Votre demande a été acceptée. Activez votre abonnement pour rendre vos produits visibles, puis publiez votre catalogue.')}</p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link href="/producer/subscription" className="inline-block bg-[#a8c800] text-white px-8 py-3 rounded-full font-semibold hover:bg-[#7d9800] transition">💳 {t('producer.nav_subscription', 'Mon abonnement')}</Link>
        <Link href="/producer/dashboard" className="inline-block border border-[#d2e095] text-[#526500] px-8 py-3 rounded-full font-semibold hover:bg-[#ecf4d5] transition">🏪 {t('producer.go_to_space', 'Accéder à mon espace')}</Link>
      </div>
    </div></Shell>;
  }
  if (request?.status === 'pending' || submitted) {
    return <Shell><div className="max-w-lg mx-auto px-6 py-24 text-center">
      <p className="text-6xl mb-4">{submitted ? '🎉' : '⏳'}</p>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">{submitted ? t('producer.request_sent', 'Candidature envoyée !') : t('producer.request_pending', 'Demande en cours d\'examen')}</h1>
      <p className="text-gray-500 mb-2">{t('join.pending_msg', 'Notre équipe examine votre demande et vous rappelle sous 48 h au numéro indiqué.')}</p>
      {request?.created_at && !submitted && <p className="text-xs text-gray-400 mb-6">{t('join.sent_on', 'Envoyée le')} {new Date(request.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>}
      <p className="text-sm text-gray-400 mb-8">{t('join.pending_next', 'Dès l\'acceptation, vous serez notifié et pourrez activer votre abonnement.')}</p>
      <Link href="/" className="text-sm text-[#7d9800] hover:underline">← {t('producer.back_home', 'Retour à l\'accueil')}</Link>
    </div></Shell>;
  }

  return (
    <Shell>
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#1c3a05] via-[#2d6410] to-[#7a5800] text-white py-12 md:py-20 px-4 md:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-block bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full mb-5">🏪 {t('join.tag', 'Marchands partenaires')}</span>
          <h1 className="text-2xl md:text-4xl font-bold mb-4 leading-tight">{t('join.title1', 'Vendez vos produits frais')}<br /><span className="text-[#c8e050]">{t('join.title2', 'sur Hornafresh')}</span></h1>
          <p className="text-white/75 text-base md:text-lg max-w-xl mx-auto mb-7 leading-relaxed">{t('join.desc', 'Vous fournissez, nous vendons, préparons et livrons. Vous gardez 100 % du prix de vos articles, pour un abonnement fixe et sans commission.')}</p>
          <a href="#candidature" className="inline-block bg-[#c8e050] text-[#1c3a05] px-6 md:px-8 py-3.5 rounded-full font-bold text-base md:text-lg hover:bg-[#d4f060] transition">📤 {t('join.cta', 'Déposer ma demande')}</a>
        </div>
      </section>

      {/* Comment ça marche */}
      <section className="max-w-5xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <div className="text-center mb-10"><h2 className="text-2xl font-bold text-gray-800">{t('join.how_title', 'Comment ça marche')}</h2><p className="text-gray-400 mt-2">{t('join.how_sub', 'Hornafresh est votre point de vente, votre préparateur et votre livreur.')}</p></div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {HOW.map((b, i) => (
            <div key={b.title} className="bg-white rounded-2xl p-5 border border-[#d2e095] hover:shadow-md transition">
              <div className="flex items-center gap-2 mb-2"><span className="text-2xl">{b.emoji}</span><span className="text-[11px] font-bold text-[#a8c800] uppercase tracking-widest">{i + 1}</span></div>
              <h3 className="text-sm font-bold text-gray-800 mb-1.5">{b.title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tarif */}
      <section className="bg-white border-y border-[#d2e095] py-10 px-4 md:px-6">
        <div className="max-w-4xl mx-auto grid md:grid-cols-[1.2fr_1fr] gap-8 items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-3">{t('join.price_title', 'Un abonnement, zéro commission')}</h2>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>✅ {t('join.price_l1', '100 % du prix de vos articles livrés vous est reversé (Waafi ou espèces).')}</li>
              <li>✅ {t('join.price_l2', 'Vitrine publique à votre enseigne, produits mis en avant sur le marché.')}</li>
              <li>✅ {t('join.price_l3', 'Espace marchand : produits, commandes, ventes par produit, relevés de reversements.')}</li>
              <li>✅ {t('join.price_l4', 'Sans engagement : chaque période est réglée d\'avance, vous renouvelez quand vous voulez.')}</li>
            </ul>
          </div>
          <div className="bg-gradient-to-br from-[#f6f9e6] to-white border-2 border-[#a8c800] rounded-3xl p-6 text-center">
            <p className="text-xs font-semibold text-[#7d9800] uppercase tracking-widest">{plan?.name || 'Mensuel'}</p>
            <p className="text-4xl font-bold text-[#526500] my-2">{plan ? fdj(plan.price_fdj) : '5 000 Fdj'}</p>
            <p className="text-sm text-gray-500">{t('join.price_per', 'pour')} {plan?.duration_days || 30} {t('join.price_days', 'jours')}</p>
            <p className="text-xs text-gray-400 mt-3">{t('join.price_note', 'Paiement Waafi ou espèces, activé après vérification par Hornafresh.')}</p>
          </div>
        </div>
      </section>

      {/* Étapes + engagements */}
      <section className="max-w-5xl mx-auto px-4 md:px-6 py-10 md:py-16 grid md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-5">{t('join.steps_title', 'Les 4 étapes')}</h2>
          <ol className="space-y-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-3">
                <span className="w-10 h-10 rounded-full bg-[#ecf4d5] flex items-center justify-center text-xl flex-none">{s.emoji}</span>
                <div><p className="text-sm font-bold text-gray-800">{i + 1}. {s.title}</p><p className="text-xs text-gray-500">{s.desc}</p></div>
              </li>
            ))}
          </ol>
        </div>
        <div className="bg-white rounded-2xl border border-[#d2e095] p-5">
          <h2 className="text-xl font-bold text-gray-800 mb-4">{t('join.rules_title', 'Vos engagements')}</h2>
          <ul className="space-y-2 text-sm text-gray-600">{RULES.map(r => <li key={r} className="flex gap-2"><span>🤝</span><span>{r}</span></li>)}</ul>
        </div>
      </section>

      {/* Demande */}
      <section id="candidature" className="max-w-2xl mx-auto px-4 md:px-6 pb-16 md:pb-20">
        <div className="bg-white rounded-3xl p-5 sm:p-8 border border-[#d2e095] shadow-sm">
          <h2 className="text-xl font-bold text-gray-800 mb-1">📝 {t('join.form_title', 'Demande d\'adhésion')}</h2>
          {!user ? (
            <div className="text-center py-6">
              <p className="text-sm text-gray-500 mb-5">{t('join.need_account', 'La demande est rattachée à votre compte Hornafresh : c\'est lui qui deviendra votre espace marchand.')}</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/login?redirect=/become-producer" className="bg-[#a8c800] text-white px-6 py-3 rounded-full font-semibold hover:bg-[#7d9800] transition">👤 {t('join.login', 'Se connecter')}</Link>
                <Link href="/login?mode=register&redirect=/become-producer" className="border border-[#d2e095] text-[#526500] px-6 py-3 rounded-full font-semibold hover:bg-[#ecf4d5] transition">✨ {t('join.signup', 'Créer un compte')}</Link>
              </div>
            </div>
          ) : request?.status === 'rejected' && !reapply ? (
            <div className="py-4">
              <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-[#b45309] mb-4">
                <p className="font-semibold">🚫 {t('join.rejected_title', 'Votre précédente demande n\'a pas été retenue')}{request.created_at ? ` (${new Date(request.created_at).toLocaleDateString('fr-FR')})` : ''}</p>
                {request.admin_note && <p className="mt-1">{t('join.rejected_reason', 'Motif')} : {request.admin_note}</p>}
              </div>
              <p className="text-sm text-gray-500 mb-4">{t('join.rejected_hint', 'Vous pouvez déposer une nouvelle demande en tenant compte du motif, ou nous appeler au 77 43 26 15.')}</p>
              <button onClick={() => setReapply(true)} className="bg-[#a8c800] text-white px-6 py-3 rounded-full font-semibold hover:bg-[#7d9800] transition">📤 {t('join.reapply', 'Déposer une nouvelle demande')}</button>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-400 mb-6">{t('join.form_hint', 'Compte')} : <strong>{user.email}</strong> · {t('bp.form_required', 'Tous les champs marqués * sont obligatoires.')}</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div><label className="text-sm font-medium text-gray-600 mb-1.5 block">{t('join.field_shop', 'Nom de votre enseigne')} *</label><input value={form.farm_name} onChange={e => set('farm_name', e.target.value)} className={inputCls} placeholder={t('join.shop_ph', 'Ex : Boutique Zak')} maxLength={60} /></div>
                  <div><label className="text-sm font-medium text-gray-600 mb-1.5 block">{t('bp.field_fullname', 'Nom complet')} *</label><input value={form.full_name} onChange={e => set('full_name', e.target.value)} className={inputCls} placeholder={t('join.name_ph', 'Ex : Ahmed Ibrahim')} /></div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div><label className="text-sm font-medium text-gray-600 mb-1.5 block">{t('bp.field_phone', 'Téléphone')} *</label><input value={form.phone} onChange={e => set('phone', e.target.value)} className={inputCls} placeholder={t('join.phone_ph', 'Ex : 77 00 00 00')} /></div>
                  <div><label className="text-sm font-medium text-gray-600 mb-1.5 block">{t('bp.field_region', 'Région')}</label><input value={form.region} onChange={e => set('region', e.target.value)} className={inputCls} placeholder={t('producer.region_ph', 'Ex : Ali Sabieh')} /></div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 mb-1.5 block">{t('join.field_products', 'Quels produits souhaitez-vous vendre ?')} *</label>
                  <textarea value={form.products_description} onChange={e => set('products_description', e.target.value)} className={inputCls + ' h-28 resize-none'} placeholder={t('bp.field_products_placeholder', 'Ex : Légumes frais, fruits, plantes aromatiques, œufs…')} maxLength={600} />
                </div>
                <div className="bg-[#f8fdf0] border border-[#d2e095] rounded-xl p-4 text-sm text-gray-500">🔒 {t('bp.privacy_note', 'Vos informations sont confidentielles et ne seront utilisées que pour traiter votre candidature.')}</div>
                <button type="submit" disabled={submitting} className="w-full bg-[#a8c800] text-white py-4 rounded-2xl font-semibold text-base hover:bg-[#7d9800] transition disabled:opacity-50">{submitting ? t('producer.sending', 'Envoi en cours...') : `📤 ${t('join.submit', 'Envoyer ma demande')}`}</button>
              </form>
            </>
          )}
        </div>
        <div className="text-center mt-6"><Link href="/" className="text-sm text-gray-400 hover:text-[#7d9800]">← {t('producer.back_home', 'Retour à l\'accueil')}</Link></div>
      </section>
    </Shell>
  );
}
