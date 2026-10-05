'use client';

import { useState, useEffect, useCallback } from 'react';
import { ask } from './Dialog';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';
import Header from './Header';
import CartDrawer from './CartDrawer';

// Achats groupés à l'import — côté client.
//   <GroupBuying />            liste des campagnes et « mes réservations »
//   <GroupBuying id={12} />    une campagne : avancement, réservation, groupe
// Le client paie à la réservation. Si la quantité minimale n'est pas atteinte à la date limite,
// il est remboursé sur sa cagnotte.

const fdj = (n: number) => `${Math.round(Number(n)).toLocaleString('fr-FR')} Fdj`;
const FLAG: Record<string, string> = { SO: '🇸🇴', ET: '🇪🇹', DJ: '🇩🇯', OTHER: '🌍' };
const SITE = 'https://www.hornafresh.com';

export default function GroupBuying({ id }: { id?: number }) {
  const { ui, currentLang } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;
  const [cartOpen, setCartOpen] = useState(false);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [logged, setLogged] = useState(false);
  const [group, setGroup] = useState<string | null>(null);
  // Formulaire de réservation
  const [units, setUnits] = useState(1);
  const [mode, setMode] = useState<'pickup' | 'delivery' | 'group'>('pickup');
  const [method, setMethod] = useState<'wallet' | 'waafi' | 'company_wallet'>('wallet');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ status: string; amount: number } | null>(null);
  const [copied, setCopied] = useState(false);

  const locale = currentLang === 'fr' ? 'fr-FR' : currentLang;
  const day = (d: string) => new Date(d.length === 10 ? d + 'T00:00:00' : d).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  const dayTime = (d: string) => new Date(d).toLocaleString(locale, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  const tr = (c: any, k: 'title' | 'description' | 'unit_label') => c?.translations?.[currentLang]?.[k] || c?.[k] || '';

  const token = async () => {
    let { data: { session } } = await supabase.auth.getSession();
    if (session && session.expires_at && session.expires_at * 1000 < Date.now() + 60000) session = (await supabase.auth.refreshSession()).data.session;
    return session?.access_token || null;
  };
  const load = useCallback(async (g?: string | null) => {
    try {
      const tk = await token();
      setLogged(!!tk);
      const qs = id ? `?id=${id}${g ? `&g=${encodeURIComponent(g)}` : ''}` : '';
      const res = await fetch(`/api/campaigns${qs}`, { headers: tk ? { Authorization: `Bearer ${tk}` } : {} });
      if (res.status === 404) { setNotFound(true); return; }
      const j = await res.json();
      if (res.ok) setData(j);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => {
    const g = id ? new URLSearchParams(window.location.search).get('g') : null;
    setGroup(g);
    if (g) setMode('group');
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const m = session?.user?.user_metadata || {};
      setPhone(m.phone || ''); setAddress(m.address || '');
    })();
    load(g);
  }, [id, load]);

  const c = id ? data?.campaign : null;
  useEffect(() => {
    if (!c) return;
    if (mode === 'pickup' && !c.allow_pickup) setMode(c.allow_delivery ? 'delivery' : 'pickup');
    if (mode === 'delivery' && !c.allow_delivery) setMode('pickup');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c?.id]);

  const ERR: Record<string, string> = {
    insufficient: t('gb.err_insufficient', 'Le solde de la cagnotte est insuffisant. Rechargez-la ou payez par Waafi.'),
    full: t('gb.err_full', 'Il ne reste pas assez d\'unités disponibles.'), client_limit: t('gb.err_limit', 'Vous dépassez la quantité maximale par client.'),
    closed: t('gb.err_closed', 'Les réservations sont closes pour cette campagne.'), reference_required: t('producer.sub_ref_required', 'Indiquez la référence de votre transaction Waafi.'),
    address_required: t('gb.err_address', 'Indiquez l\'adresse de livraison.'), phone_required: t('gb.err_phone', 'Indiquez un numéro de téléphone.'),
    pro_only: t('gb.err_pro', 'Cette campagne est réservée aux comptes entreprise.'), group_not_found: t('gb.err_group', 'Ce groupe n\'existe pas encore : son créateur doit d\'abord réserver.'),
    too_late: t('gb.err_too_late', 'La campagne est clôturée : la marchandise est commandée, l\'annulation n\'est plus possible.'),
    company_forbidden: t('gb.err_company', 'Votre rôle dans la société ne permet pas de commander.'), unauthorized: t('gb.err_login', 'Connectez-vous pour réserver.'),
  };
  const post = async (payload: any) => {
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` }, body: JSON.stringify(payload) });
      const j = await res.json();
      if (!res.ok) { setError(`${ERR[j.error] || j.error || 'Erreur'}${j.available != null ? ` (${j.available} ${t('gb.available', 'disponible(s)')})` : ''}`); return null; }
      return j;
    } catch (e: any) { setError(e.message); return null; }
    finally { setBusy(false); }
  };
  const reserve = async () => {
    if (!c) return;
    const total = units * c.price_djf + (mode === 'delivery' ? Number(c.delivery_fee) : 0);
    if (!(await ask({ text: `${t('gb.confirm', 'Confirmer la réservation ?')}\n${units} × ${tr(c, 'unit_label')} = ${fdj(total)}\n${t('gb.confirm_note', 'Si la quantité minimale n\'est pas atteinte, vous serez remboursé sur votre cagnotte.')}` }))) return;
    const j = await post({ action: 'reserve', campaign_id: c.id, units, delivery_mode: mode, payment_method: method, reference, address, phone, group: mode === 'group' ? group : (group || undefined), lang: currentLang });
    if (j) { setDone({ status: j.status, amount: j.amount }); setReference(''); await load(group); }
  };
  const cancel = async (orderId: number) => {
    if (!(await ask({ danger: true, text: t('gb.cancel_confirm', 'Annuler cette réservation ? Le montant sera recrédité sur votre cagnotte.') }))) return;
    if (await post({ action: 'cancel', order_id: orderId })) await load(group);
  };
  const invite = async () => {
    if (!c) return;
    let code = group;
    if (!code) { const j = await post({ action: 'new_group', campaign_id: c.id }); if (!j) return; code = j.code; setGroup(code); window.history.replaceState(null, '', `/achats-groupes/${c.id}?g=${code}`); await load(code); }
    const url = `${SITE}/achats-groupes/${c.id}?g=${code}`;
    const text = `${t('gb.invite_text', 'Je commande en groupe sur Hornafresh :')} ${tr(c, 'title')} — ${fdj(c.price_djf)} / ${tr(c, 'unit_label')}. ${t('gb.invite_join', 'Rejoins-moi :')} ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');   // le client choisit ses destinataires
  };
  const copyLink = async () => {
    if (!c || !group) return;
    try { await navigator.clipboard.writeText(`${SITE}/achats-groupes/${c.id}?g=${group}`); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  };

  const STATUS: Record<string, string> = {
    open: t('gb.st_open', 'Réservations ouvertes'), closed: t('gb.st_closed', 'Quantité atteinte, commande en cours'), ordered: t('gb.st_ordered', 'Commandé au producteur'),
    in_transit: t('gb.st_transit', 'En route vers Djibouti'), arrived: t('gb.st_arrived', 'Arrivé à Djibouti'), distributing: t('gb.st_distributing', 'Distribution en cours'),
    done: t('gb.st_done', 'Terminé'), failed: t('gb.st_failed', 'Quantité minimale non atteinte'), cancelled: t('gb.st_cancelled', 'Annulé'),
  };
  const ORDER: Record<string, { label: string; cls: string }> = {
    pending_payment: { label: t('gb.o_pending', 'Paiement en attente de confirmation'), cls: 'bg-amber-100 text-amber-800' },
    paid:            { label: t('gb.o_paid', 'Réservée et payée'), cls: 'bg-green-100 text-green-700' },
    delivered:       { label: t('gb.o_delivered', 'Remise'), cls: 'bg-green-100 text-green-700' },
    refunded:        { label: t('gb.o_refunded', 'Remboursée'), cls: 'bg-gray-100 text-gray-600' },
    cancelled:       { label: t('gb.o_cancelled', 'Annulée'), cls: 'bg-gray-100 text-gray-500' },
  };

  const Bar = ({ p }: { p: any }) => (
    <div>
      <div className="h-2.5 rounded-full bg-[#ecf4d5] overflow-hidden"><div className={`h-full rounded-full ${p.reached ? 'bg-[#526500]' : 'bg-[#a8c800]'}`} style={{ width: `${p.pct}%` }} /></div>
      <p className="text-xs text-gray-500 mt-1">{p.reached ? `🎯 ${t('gb.reached', 'Quantité minimale atteinte')} · ${p.units}` : `${p.units} / ${p.min} · ${t('gb.missing', 'encore')} ${p.missing}`}</p>
    </div>
  );
  const Orders = ({ list }: { list: any[] }) => (
    <div className="space-y-2">
      {list.map(o => {
        const st = ORDER[o.status] || { label: o.status, cls: 'bg-gray-100 text-gray-500' };
        const cc = o.campaigns || c;
        return (
          <div key={o.id} className="bg-[#faf7e8] rounded-xl px-3 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link href={`/achats-groupes/${o.campaign_id}`} className="text-sm font-semibold text-gray-800 hover:underline">{tr(cc, 'title')}</Link>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{o.final_units != null && o.final_units !== o.units ? `${o.final_units} / ${o.units}` : o.units} {tr(cc, 'unit_label')} · {fdj(o.amount)}{Number(o.refunded) > 0 ? ` · ${t('gb.refunded', 'remboursé')} ${fdj(o.refunded)}` : ''} · {STATUS[cc?.status] || ''}</p>
            {['paid', 'pending_payment'].includes(o.status) && cc?.status === 'open' && <button onClick={() => cancel(o.id)} disabled={busy} className="mt-1 text-xs text-gray-400 hover:text-red-500 underline disabled:opacity-50">{t('gb.cancel', 'Annuler ma réservation')}</button>}
          </div>
        );
      })}
    </div>
  );

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen bg-[#faf7e8]">
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
      <Header onCartOpen={() => setCartOpen(true)} />
      <main className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-10">{children}</main>
    </div>
  );

  if (loading) return <Shell><p className="text-center text-gray-400 py-24">⏳</p></Shell>;
  if (notFound) return <Shell><div className="text-center py-24"><p className="text-5xl mb-3">🌍</p><p className="text-gray-500 mb-4">{t('gb.not_found', 'Cette campagne n\'existe pas ou n\'est plus disponible.')}</p><Link href="/achats-groupes" className="text-sm text-[#7d9800] hover:underline">← {t('gb.all', 'Tous les achats groupés')}</Link></div></Shell>;

  // ── Liste ──────────────────────────────────────────────────────────────────
  if (!id) {
    const open = (data?.campaigns || []).filter((x: any) => x.status === 'open');
    const running = (data?.campaigns || []).filter((x: any) => x.status !== 'open');
    return (
      <Shell>
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">🌍 {t('gb.title', 'Achats groupés')}</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">{t('gb.subtitle', 'Commandez à plusieurs directement chez un producteur de la région. La commande part quand la quantité minimale est atteinte ; sinon vous êtes remboursé.')}</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-2 mb-6">
          {([['1', '🛒', t('gb.how1', 'Vous réservez et payez votre quantité')], ['2', '🎯', t('gb.how2', 'La quantité minimale est atteinte : nous commandons')], ['3', '📦', t('gb.how3', 'La marchandise arrive, contrôlée, puis vous est remise')]] as [string, string, string][]).map(([n, e, txt]) => (
            <div key={n} className="bg-white rounded-2xl border border-[#d2e095] px-4 py-3 flex items-center gap-3"><span className="text-2xl">{e}</span><p className="text-xs text-gray-600"><b className="text-[#a8c800]">{n}</b> · {txt}</p></div>
          ))}
        </div>

        {data?.mine?.length > 0 && (
          <section className="bg-white rounded-2xl border-2 border-[#d2e095] p-4 mb-6">
            <h2 className="font-bold text-gray-800 mb-2">🧾 {t('gb.mine', 'Mes réservations')}</h2>
            {error && <p className="text-sm text-red-500 mb-2">⚠️ {error}</p>}
            <Orders list={data.mine} />
          </section>
        )}

        {open.length === 0 && running.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#d2e095] px-4 py-12 text-center"><p className="text-4xl mb-2">🌱</p><p className="text-sm text-gray-500">{t('gb.none', 'Aucun achat groupé en cours. Revenez bientôt.')}</p></div>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {open.map((x: any) => (
                <Link key={x.id} href={`/achats-groupes/${x.id}`} className="bg-white rounded-2xl border-2 border-[#d2e095] overflow-hidden hover:border-[#a8c800] hover:shadow-md transition flex flex-col">
                  <div className="h-36 bg-[#ecf4d5] flex items-center justify-center overflow-hidden">{x.image_url ? <img src={x.image_url} alt="" className="w-full h-full object-cover" /> : <span className="text-5xl opacity-40">🌍</span>}</div>
                  <div className="p-4 flex-1 flex flex-col gap-2">
                    <p className="font-semibold text-gray-800 leading-tight">{tr(x, 'title')}</p>
                    <p className="text-xs text-gray-500">{FLAG[x.supplier?.country] || '🌍'} {x.supplier?.name}{x.supplier?.region ? ` · ${x.supplier.region}` : ''}</p>
                    <p className="text-lg font-bold text-[#526500]">{fdj(x.price_djf)} <span className="text-xs font-normal text-gray-400">/ {tr(x, 'unit_label')}</span></p>
                    <Bar p={x.progress} />
                    <p className="text-[11px] text-gray-400 mt-auto">⏳ {t('gb.until', 'Jusqu\'au')} {dayTime(x.closes_at)}{x.audience === 'pro' ? ` · 🏢 ${t('gb.pro', 'Comptes entreprise')}` : ''}</p>
                  </div>
                </Link>
              ))}
            </div>
            {running.length > 0 && (
              <section className="mt-8">
                <h2 className="font-bold text-gray-800 mb-2">🚚 {t('gb.running', 'En cours d\'acheminement')}</h2>
                <div className="space-y-2">{running.map((x: any) => (
                  <Link key={x.id} href={`/achats-groupes/${x.id}`} className="block bg-white rounded-xl border border-[#d2e095] px-4 py-3 hover:border-[#a8c800] transition">
                    <p className="text-sm font-semibold text-gray-800">{tr(x, 'title')}</p>
                    <p className="text-xs text-gray-500">{STATUS[x.status]}{x.eta_date ? ` · ${t('gb.eta', 'arrivée estimée')} ${day(x.eta_date)}` : ''}</p>
                  </Link>
                ))}</div>
              </section>
            )}
          </>
        )}
      </Shell>
    );
  }

  // ── Une campagne ───────────────────────────────────────────────────────────
  if (!c) return <Shell><p className="text-center text-gray-400 py-24">⏳</p></Shell>;
  const fee = mode === 'delivery' ? Number(c.delivery_fee) || 0 : 0;
  const total = units * Number(c.price_djf) + fee;
  const maxUnits = Math.max(1, Math.min(c.available_units ?? 9999, c.max_units_per_client ?? 9999));
  const pro = data?.me?.pro && ['manager', 'buyer'].includes(data.me.company?.role);

  return (
    <Shell>
      <Link href="/achats-groupes" className="text-sm text-[#7d9800] hover:underline">← {t('gb.all', 'Tous les achats groupés')}</Link>
      <div className="grid md:grid-cols-[1.1fr_1fr] gap-6 mt-4">
        <div>
          <div className="rounded-3xl overflow-hidden bg-[#ecf4d5] h-52 md:h-72 flex items-center justify-center">{c.image_url ? <img src={c.image_url} alt="" className="w-full h-full object-cover" /> : <span className="text-7xl opacity-40">🌍</span>}</div>
          <h1 className="text-2xl font-bold text-gray-800 mt-4">{tr(c, 'title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{FLAG[c.supplier?.country] || '🌍'} {c.supplier?.name}{c.supplier?.region ? ` · ${c.supplier.region}` : ''}</p>
          {tr(c, 'description') && <p className="text-sm text-gray-600 mt-3 leading-relaxed">{tr(c, 'description')}</p>}
          <div className="bg-white rounded-2xl border border-[#d2e095] p-4 mt-4 space-y-2 text-sm text-gray-600">
            <p>📦 {t('gb.sold_by', 'Vendu par')} <b>{tr(c, 'unit_label')}</b>{c.unit_weight_kg ? ` · ${c.unit_weight_kg} kg` : ''}</p>
            <p>⏳ {t('gb.until', 'Jusqu\'au')} <b>{dayTime(c.closes_at)}</b></p>
            {c.eta_date && <p>🗓️ {t('gb.eta', 'Arrivée estimée')} : <b>{day(c.eta_date)}</b></p>}
            {c.allow_pickup && c.pickup_place && <p>📍 {t('gb.pickup_at', 'Retrait')} : {c.pickup_place}</p>}
            {c.allow_delivery && <p>🚚 {t('gb.delivery', 'Livraison')} : {Number(c.delivery_fee) > 0 ? fdj(c.delivery_fee) : t('free', 'Offerte')}</p>}
            <p className="text-xs text-gray-400 pt-1">{t('gb.guarantee', 'Marchandise contrôlée à l\'arrivée. S\'il en manque, votre quantité est ajustée et la différence remboursée.')}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-3xl border-2 border-[#d2e095] p-5">
            <p className="text-3xl font-bold text-[#526500]">{fdj(c.price_djf)} <span className="text-sm font-normal text-gray-400">/ {tr(c, 'unit_label')}</span></p>
            <p className="text-xs font-semibold text-[#7d9800] mt-1 mb-3">{STATUS[c.status]}</p>
            <Bar p={c.progress} />
            <p className="text-[11px] text-gray-400 mt-1">{c.buyers} {t('gb.buyers', 'acheteur(s)')}{c.available_units != null ? ` · ${c.available_units} ${t('gb.available', 'disponible(s)')}` : ''}{c.pending_units ? ` · ${c.pending_units} ${t('gb.pending', 'en attente de paiement')}` : ''}</p>

            {done && <p className="mt-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2">✅ {done.status === 'paid' ? t('gb.done_paid', 'Réservation enregistrée et payée.') : t('gb.done_pending', 'Réservation enregistrée. Elle sera confirmée après vérification de votre paiement Waafi.')} {fdj(done.amount)}</p>}

            {c.can_reserve ? (!logged ? (
              <Link href={`/login?redirect=${encodeURIComponent(`/achats-groupes/${c.id}${group ? `?g=${group}` : ''}`)}`} className="mt-4 block text-center bg-[#a8c800] text-white font-semibold rounded-full px-6 py-3 hover:bg-[#7d9800] transition">🔐 {t('gb.login', 'Se connecter pour réserver')}</Link>
            ) : (
              <div className="mt-4 space-y-3">
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-1">{t('gb.quantity', 'Quantité')} ({tr(c, 'unit_label')})</p>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setUnits(u => Math.max(1, u - 1))} aria-label="−" className="w-10 h-10 rounded-full border-2 border-[#d2e095] text-xl text-[#526500] hover:bg-[#ecf4d5]">−</button>
                    <span className="text-xl font-bold text-gray-800 w-10 text-center">{units}</span>
                    <button onClick={() => setUnits(u => Math.min(maxUnits, u + 1))} aria-label="+" className="w-10 h-10 rounded-full border-2 border-[#d2e095] text-xl text-[#526500] hover:bg-[#ecf4d5]">+</button>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-1">{t('gb.how_receive', 'Comment recevoir votre commande')}</p>
                  <div className="flex flex-wrap gap-2">
                    {([...(c.allow_pickup ? [['pickup', `📍 ${t('gb.m_pickup', 'Retrait')}`]] : []), ...(c.allow_delivery ? [['delivery', `🚚 ${t('gb.m_delivery', 'Livraison')}`]] : []), ...(group ? [['group', `👥 ${t('gb.m_group', 'Avec mon groupe')}`]] : [])] as [typeof mode, string][]).map(([m, label]) => (
                      <button key={m} onClick={() => setMode(m)} className={`px-3 py-2 rounded-xl border-2 text-xs font-semibold transition ${mode === m ? 'border-[#a8c800] bg-[#f6f9e6] text-[#526500]' : 'border-[#e3eebf] text-gray-500 hover:border-[#a8c800]'}`}>{label}</button>
                    ))}
                  </div>
                  {mode === 'delivery' && <input value={address} onChange={e => setAddress(e.target.value)} maxLength={300} placeholder={t('gb.address_ph', 'Ex : quartier, rue, repère')} className="w-full border border-[#d2e095] rounded-xl px-3 py-2 text-sm mt-2" />}
                  {mode === 'group' && <p className="text-[11px] text-gray-500 mt-1">{t('gb.group_hint', 'Votre commande sera remise avec celle du groupe, sans frais de livraison supplémentaires.')}</p>}
                  <input value={phone} onChange={e => setPhone(e.target.value)} maxLength={40} inputMode="tel" placeholder={t('gb.phone_ph', 'Ex : numéro de téléphone')} className="w-full border border-[#d2e095] rounded-xl px-3 py-2 text-sm mt-2" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-1">{t('gb.payment', 'Paiement')}</p>
                  <div className="flex flex-wrap gap-2">
                    {([['wallet', `💰 ${t('gb.pm_wallet', 'Ma cagnotte')}`], ['waafi', '📱 Waafi'], ...(pro ? [['company_wallet', `🏢 ${data.me.company.name}`]] : [])] as [typeof method, string][]).map(([m, label]) => (
                      <button key={m} onClick={() => setMethod(m)} className={`px-3 py-2 rounded-xl border-2 text-xs font-semibold transition ${method === m ? 'border-[#a8c800] bg-[#f6f9e6] text-[#526500]' : 'border-[#e3eebf] text-gray-500 hover:border-[#a8c800]'}`}>{label}</button>
                    ))}
                  </div>
                  {method === 'waafi' && (
                    <div className="bg-[#f0f8e8] rounded-xl p-3 mt-2">
                      <p className="text-xs text-gray-600">{t('gb.waafi_hint', 'Envoyez le montant au numéro ci-dessous, puis saisissez la référence de la transaction.')}</p>
                      <p className="text-2xl font-bold text-[#526500] tracking-widest text-center my-1">{data.payment.waafi_number}</p>
                      <p className="text-[11px] text-gray-400 text-center mb-2">{data.payment.waafi_holder}</p>
                      <input value={reference} onChange={e => setReference(e.target.value)} maxLength={80} placeholder={t('producer.sub_ref_ph', 'Ex : référence de transaction Waafi')} className="w-full border border-[#d2e095] rounded-xl px-3 py-2 text-sm bg-white" />
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between bg-[#f6f9e6] rounded-xl px-4 py-3">
                  <span className="text-xs text-gray-600">{units} × {fdj(c.price_djf)}{fee ? ` + ${fdj(fee)}` : ''}</span>
                  <span className="text-lg font-bold text-[#526500]">{fdj(total)}</span>
                </div>
                {error && <p className="text-sm text-red-500">⚠️ {error}</p>}
                <button onClick={reserve} disabled={busy} className="w-full bg-[#a8c800] text-white font-semibold rounded-full px-6 py-3 hover:bg-[#7d9800] transition disabled:opacity-50">{busy ? '…' : `✅ ${t('gb.reserve', 'Réserver et payer')}`}</button>
                <p className="text-[11px] text-gray-400">{t('gb.refund_note', 'Quantité minimale non atteinte à la date limite : remboursement automatique sur votre cagnotte.')}</p>
              </div>
            )) : c.status === 'open' && c.audience === 'pro' ? (
              <p className="mt-4 text-sm text-gray-500 bg-[#f6f9e6] rounded-xl px-3 py-3">🏢 {ERR.pro_only} <Link href="/entreprises" className="text-[#7d9800] underline">{t('gb.pro_link', 'Ouvrir un compte entreprise')}</Link></p>
            ) : null}
          </div>

          {c.status === 'open' && logged && (
            <div className="bg-white rounded-2xl border border-[#d2e095] p-4">
              <p className="font-semibold text-gray-800 text-sm">👥 {t('gb.group_title', 'Commander à plusieurs')}</p>
              <p className="text-xs text-gray-500 mt-0.5 mb-2">{t('gb.group_desc', 'Invitez vos voisins, votre famille ou vos collègues : chacun paie sa part, et tout est remis au même endroit.')}</p>
              {data.group?.members?.length > 0 && (
                <div className="bg-[#faf7e8] rounded-xl px-3 py-2 mb-2">
                  <p className="text-xs font-semibold text-gray-700">{t('gb.group_members', 'Dans ce groupe')} · {data.group.units} {tr(c, 'unit_label')}</p>
                  {data.group.members.map((m: any, i: number) => <p key={i} className="text-xs text-gray-600">{m.name} · {m.units}{!m.paid ? ` · ${t('gb.pending', 'en attente de paiement')}` : ''}</p>)}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button onClick={invite} disabled={busy} className="text-xs font-semibold bg-[#25D366] text-white rounded-full px-4 py-2 hover:opacity-90 disabled:opacity-50">💬 {t('gb.invite', 'Inviter par WhatsApp')}</button>
                {group && <button onClick={copyLink} className="text-xs font-semibold border border-[#d2e095] text-[#526500] rounded-full px-4 py-2 hover:bg-[#ecf4d5]">{copied ? `✅ ${t('gb.copied', 'Lien copié')}` : `🔗 ${t('gb.copy', 'Copier le lien')}`}</button>}
              </div>
            </div>
          )}

          {data.mine?.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#d2e095] p-4">
              <p className="font-semibold text-gray-800 text-sm mb-2">🧾 {t('gb.mine', 'Mes réservations')}</p>
              <Orders list={data.mine} />
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}
