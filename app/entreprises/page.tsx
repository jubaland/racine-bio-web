'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../context/LanguageContext';
import Header from '../../components/Header';
import CartDrawer from '../../components/CartDrawer';
import WhatsAppButton from '../../components/WhatsAppButton';
import { HORNAFRESH_WHATSAPP } from '../../lib/whatsapp';

// « Hornafresh Entreprises » : présentation du compte entreprise (prépayé, mêmes prix) + demande d'ouverture.
// Réservée aux comptes connectés ; la demande est validée par l'équipe (admin › Entreprises).

export default function CompaniesLandingPage() {
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;
  const [cartOpen, setCartOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [state, setState] = useState<any>(null);       // réponse de /api/company
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', activity: '', contact_name: '', phone: '', email: '', address: '', tax_id: '' });
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const tokenOf = async () => (await supabase.auth.getSession()).data.session?.access_token;
  const load = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setUser(session?.user || null);
    if (session) {
      setForm(f => ({ ...f, contact_name: f.contact_name || session.user.user_metadata?.full_name || '', email: f.email || session.user.email || '', phone: f.phone || String(session.user.user_metadata?.phone || '').replace(/\D/g, '').slice(-8) }));
      try { const res = await fetch('/api/company', { headers: { Authorization: `Bearer ${session.access_token}` } }); if (res.ok) setState(await res.json()); } catch { /* ignore */ }
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const phoneOk = form.phone.replace(/\D/g, '').length === 8;
  const valid = form.name.trim() && form.contact_name.trim() && form.address.trim() && phoneOk;

  const submit = async () => {
    setShowErrors(true); setError('');
    if (!valid) return;
    setSaving(true);
    const res = await fetch('/api/company', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await tokenOf()}` }, body: JSON.stringify({ action: 'request', ...form }) });
    const j = await res.json();
    setSaving(false);
    if (!res.ok) { setError(j.error === 'already_member' ? t('co.err_already', 'Vous appartenez déjà à une société.') : t('co.err_generic', 'La demande n\'a pas pu être envoyée. Vérifiez les champs et réessayez.')); return; }
    window.location.href = '/entreprise';
  };
  const invite = async (action: 'accept_invite' | 'decline_invite', invite_id: number) => {
    await fetch('/api/company', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await tokenOf()}` }, body: JSON.stringify({ action, invite_id }) });
    if (action === 'accept_invite') window.location.href = '/entreprise'; else load();
  };

  const FOR_WHO: [string, string, string][] = [
    ['🍽️', t('co.who_resto', 'Restaurants, cafés, traiteurs, hôtels'), t('co.who_resto_d', 'Des produits frais chaque jour, livrés à l\'heure.')],
    ['🏫', t('co.who_canteen', 'Cantines, écoles, cliniques'), t('co.who_canteen_d', 'Des volumes réguliers, un budget maîtrisé.')],
    ['🏢', t('co.who_office', 'Bureaux, ONG, ambassades'), t('co.who_office_d', 'Corbeilles de fruits, plusieurs sites, un seul compte.')],
    ['🛒', t('co.who_shop', 'Épiceries et revendeurs'), t('co.who_shop_d', 'Réassort simple, commandes récurrentes.')],
  ];
  const HOW: [string, string][] = [
    [t('co.how1', 'Un compte pour toute l\'équipe'), t('co.how1_d', 'Le gérant invite ses collaborateurs : acheteurs pour commander, comptable pour suivre.')],
    [t('co.how2', 'Une cagnotte prépayée'), t('co.how2_d', 'Vous rechargez la cagnotte de la société (Waafi, espèces, virement ou chèque) ; chaque commande y est débitée. Aucun crédit, aucune surprise.')],
    [t('co.how3', 'Vos sites de livraison'), t('co.how3_d', 'Enregistrez vos adresses une fois : cuisine, bureau, annexe… et choisissez à chaque commande.')],
    [t('co.how4', 'Validation et commandes récurrentes'), t('co.how4_d', 'Fixez un montant au-delà duquel le gérant valide, et programmez vos livraisons régulières.')],
  ];
  const inputCls = 'w-full border border-[#d2e095] rounded-xl px-4 py-2.5 text-sm bg-[#faf7e8] focus:outline-none focus:border-[#a8c800]';
  const errCls = (bad: boolean) => showErrors && bad ? ' !border-[#f97316]' : '';

  const member = state?.membership;
  const invites: any[] = state?.invites || [];

  return (
    <div className="min-h-screen bg-[#faf7e8]">
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
      <Header onCartOpen={() => setCartOpen(true)} />

      <section className="bg-gradient-to-br from-[#1c3a05] via-[#2d6410] to-[#7a5800] text-white px-4 md:px-6 py-10 md:py-14">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs uppercase tracking-widest text-[#c8e050] mb-2">🏢 Hornafresh {t('co.brand', 'Entreprises')}</p>
          <h1 className="text-2xl md:text-4xl font-bold leading-tight">{t('co.hero_title', 'Les fruits et légumes frais de votre établissement, sur un seul compte')}</h1>
          <p className="text-sm md:text-base text-white/80 mt-3 max-w-2xl">{t('co.hero_sub', 'Restaurants, cantines, bureaux, épiceries : commandez à plusieurs, payez avec la cagnotte de la société, faites-vous livrer sur tous vos sites. Mêmes prix que sur le marché Hornafresh.')}</p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 space-y-8">
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">{t('co.who_title', 'Pour qui ?')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FOR_WHO.map(([emoji, title, desc]) => (
              <div key={title} className="bg-white rounded-2xl border border-[#d2e095] p-4 flex gap-3">
                <span className="w-11 h-11 rounded-full bg-[#ecf4d5] flex items-center justify-center text-2xl flex-none">{emoji}</span>
                <div><p className="text-sm font-semibold text-gray-800">{title}</p><p className="text-xs text-gray-500 mt-0.5">{desc}</p></div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">{t('co.how_title', 'Comment ça marche')}</h2>
          <div className="grid gap-3">
            {HOW.map(([title, desc], i) => (
              <div key={title} className="bg-white rounded-2xl border border-[#d2e095] p-4 flex gap-3">
                <span className="w-8 h-8 rounded-full bg-[#526500] text-white text-sm font-bold flex items-center justify-center flex-none">{i + 1}</span>
                <div><p className="text-sm font-semibold text-gray-800">{title}</p><p className="text-xs text-gray-500 mt-0.5">{desc}</p></div>
              </div>
            ))}
          </div>
        </section>

        <section id="demande" className="bg-white rounded-3xl border border-[#d2e095] shadow-sm p-5 md:p-7">
          <h2 className="text-lg font-semibold text-gray-800 mb-1">📝 {t('co.form_title', 'Ouvrir un compte entreprise')}</h2>
          {loading ? <p className="text-sm text-gray-400 py-6">{t('admin.loading', 'Chargement...')}</p>
          : member ? (
            <div className="text-sm text-gray-600 py-3">
              <p>{t('co.already_member', 'Vous faites partie de la société')} <strong>{state.company?.name}</strong>.</p>
              <Link href="/entreprise" className="inline-block mt-3 bg-[#a8c800] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#7d9800]">🏢 {t('nav.company_short', 'Mon entreprise')}</Link>
            </div>
          ) : !user ? (
            <div className="text-sm text-gray-600 py-3">
              <p>{t('co.login_first', 'Connectez-vous ou créez un compte Hornafresh : le gérant de la société fait la demande avec son compte.')}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Link href="/login?redirect=/entreprises%23demande" className="bg-[#a8c800] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#7d9800]">🔑 {t('co.login', 'Se connecter')}</Link>
                <Link href="/login?mode=register&redirect=/entreprises%23demande" className="border border-[#d2e095] text-[#526500] px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#ecf4d5]">{t('co.register', 'Créer un compte')}</Link>
              </div>
            </div>
          ) : (
            <>
              {invites.length > 0 && (
                <div className="mb-5 space-y-2">
                  {invites.map(i => (
                    <div key={i.id} className="bg-[#ecf4d5] border border-[#d2e095] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm text-[#526500]">📨 {t('co.invited_to', 'Vous êtes invité(e) à rejoindre')} <strong>{i.companies?.name}</strong></p>
                      <div className="flex gap-2">
                        <button onClick={() => invite('accept_invite', i.id)} className="bg-[#526500] text-white text-xs font-semibold px-4 py-2 rounded-xl">✅ {t('co.accept', 'Accepter')}</button>
                        <button onClick={() => invite('decline_invite', i.id)} className="border border-[#d2e095] text-gray-500 text-xs font-semibold px-4 py-2 rounded-xl bg-white">{t('co.decline', 'Refuser')}</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-400 mb-4">{t('co.form_hint', 'Votre demande est étudiée par notre équipe. Une fois le compte ouvert, vous pourrez ajouter vos sites, inviter vos collaborateurs et recharger la cagnotte.')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="sm:col-span-2 text-sm text-gray-600">{t('co.f_name', 'Nom de l\'établissement')} *
                  <input value={form.name} onChange={e => set('name', e.target.value)} className={inputCls + errCls(!form.name.trim()) + ' mt-1'} placeholder={t('co.f_name_ph', 'Ex : Restaurant Le Palmier')} />
                </label>
                <label className="text-sm text-gray-600">{t('co.f_activity', 'Activité')}
                  <select value={form.activity} onChange={e => set('activity', e.target.value)} className={inputCls + ' mt-1'}>
                    <option value="">{t('co.f_activity_pick', '— Choisir —')}</option>
                    {[t('co.a_resto', 'Restaurant / café / traiteur'), t('co.a_hotel', 'Hôtel'), t('co.a_canteen', 'Cantine / école / clinique'), t('co.a_office', 'Bureau / ONG / ambassade'), t('co.a_shop', 'Épicerie / revente'), t('co.a_other', 'Autre')].map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </label>
                <label className="text-sm text-gray-600">{t('co.f_contact', 'Nom du gérant')} *
                  <input value={form.contact_name} onChange={e => set('contact_name', e.target.value)} className={inputCls + errCls(!form.contact_name.trim()) + ' mt-1'} placeholder={t('co.f_contact_ph', 'Ex : Ahmed Hassan')} />
                </label>
                <label className="text-sm text-gray-600">{t('co.f_phone', 'Téléphone')} *
                  <input value={form.phone} onChange={e => set('phone', e.target.value)} inputMode="tel" className={inputCls + errCls(!phoneOk) + ' mt-1'} placeholder={t('producer.wa_ph', 'Ex : 77 12 34 56')} />
                </label>
                <label className="text-sm text-gray-600">{t('co.f_email', 'E-mail')}
                  <input value={form.email} onChange={e => set('email', e.target.value)} className={inputCls + ' mt-1'} placeholder={t('co.f_email_ph', 'Ex : contact@palmier.dj')} />
                </label>
                <label className="sm:col-span-2 text-sm text-gray-600">{t('co.f_address', 'Adresse de livraison principale')} *
                  <input value={form.address} onChange={e => set('address', e.target.value)} className={inputCls + errCls(!form.address.trim()) + ' mt-1'} placeholder={t('co.f_address_ph', 'Ex : Quartier 4, rue de la Paix, Djibouti-Ville')} />
                </label>
                <label className="sm:col-span-2 text-sm text-gray-600">{t('co.f_tax', 'Numéro d\'identification (facultatif)')}
                  <input value={form.tax_id} onChange={e => set('tax_id', e.target.value)} className={inputCls + ' mt-1'} placeholder={t('co.f_tax_ph', 'Ex : NIF, registre du commerce — si vous en avez un')} />
                </label>
              </div>
              {showErrors && !valid && <p className="text-xs text-[#f97316] mt-3">⚠️ {t('co.err_required', 'Renseignez le nom, le gérant, le téléphone (8 chiffres) et l\'adresse.')}</p>}
              {error && <p className="text-xs text-[#f97316] mt-3">⚠️ {error}</p>}
              <button onClick={submit} disabled={saving} className="mt-5 w-full bg-[#a8c800] text-white py-3.5 rounded-2xl font-semibold hover:bg-[#7d9800] transition disabled:opacity-50">
                {saving ? t('admin.saving', 'Enregistrement...') : t('co.submit', 'Envoyer la demande')}
              </button>
            </>
          )}
        </section>

        <div className="text-center text-sm text-gray-500">
          <WhatsAppButton variant="link" phone={HORNAFRESH_WHATSAPP} text={t('co.wa_text', 'Bonjour Hornafresh, je souhaite ouvrir un compte entreprise. ')} label={t('co.wa', 'Une question ? Écrivez-nous sur WhatsApp')} />
        </div>
      </div>
    </div>
  );
}
