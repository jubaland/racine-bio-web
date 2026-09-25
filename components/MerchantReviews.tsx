'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';

// Avis clients d'un marchand (vitrine) : moyenne, liste, formulaire pour les clients éligibles.

type Review = { name: string; rating: number; comment: string | null; date: string };
type Data = { avg: number | null; count: number; reviews: Review[]; mine: { rating: number; comment: string | null; status: string } | null; eligible: boolean };

export const Stars = ({ value, size = 'text-base' }: { value: number; size?: string }) => (
  <span className={`${size} text-[#f59e0b] tracking-tight`} aria-label={`${value}/5`}>{'★'.repeat(Math.round(value))}<span className="text-gray-300">{'★'.repeat(5 - Math.round(value))}</span></span>
);

export default function MerchantReviews({ ownerId, shopName }: { ownerId: string; shopName: string }) {
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;
  const [data, setData] = useState<Data | null>(null);
  const [logged, setLogged] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setLogged(!!session);
    const res = await fetch(`/api/merchant-reviews?owner=${ownerId}`, { headers: session ? { Authorization: `Bearer ${session.access_token}` } : {} });
    const j = await res.json();
    if (res.ok) { setData(j); if (j.mine) { setRating(j.mine.rating); setComment(j.mine.comment || ''); } }
  }, [ownerId]);
  useEffect(() => { load(); }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!rating) { setMsg('⚠️ ' + t('rev.pick_rating', 'Choisissez une note.')); return; }
    setBusy(true); setMsg('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/merchant-reviews', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` }, body: JSON.stringify({ owner_id: ownerId, rating, comment }) });
      const j = await res.json();
      if (!res.ok) setMsg('⚠️ ' + (j.error === 'not_eligible' ? t('rev.not_eligible', 'Vous pourrez noter ce marchand après avoir reçu une commande contenant ses produits.') : j.error || 'Erreur'));
      else { setMsg('✅ ' + (j.updated ? t('rev.updated', 'Avis mis à jour, merci !') : t('rev.thanks', 'Merci pour votre avis !'))); await load(); }
    } catch (err: any) { setMsg('⚠️ ' + err.message); }
    setBusy(false);
  };

  if (!data) return null;
  return (
    <section className="max-w-7xl mx-auto px-4 md:px-6 pb-12">
      <div className="bg-white rounded-2xl border border-[#d2e095] p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-xl font-bold text-gray-800">⭐ {t('rev.title', 'Avis clients')}</h2>
          {data.count > 0 ? (
            <p className="text-sm text-gray-600"><Stars value={data.avg || 0} /> <strong>{data.avg}</strong>/5 · {data.count} {t('rev.count', 'avis')}</p>
          ) : <p className="text-sm text-gray-400">{t('rev.none', 'Pas encore d\'avis.')}</p>}
        </div>

        {/* Formulaire */}
        {data.eligible ? (
          <form onSubmit={submit} className="bg-[#faf7e8] rounded-xl p-4 mb-5">
            <p className="text-sm font-semibold text-gray-700 mb-2">{data.mine ? t('rev.edit_title', 'Modifier mon avis') : t('rev.form_title', 'Votre avis sur')} {shopName}</p>
            <div className="flex gap-1 mb-2">{[1, 2, 3, 4, 5].map(n => <button key={n} type="button" onClick={() => setRating(n)} className={`text-2xl transition ${n <= rating ? 'text-[#f59e0b]' : 'text-gray-300 hover:text-[#fbbf24]'}`} aria-label={`${n}/5`}>★</button>)}</div>
            <textarea value={comment} onChange={e => setComment(e.target.value)} maxLength={600} placeholder={t('rev.comment_ph', 'Ex : produits très frais, livraison rapide')} className="w-full border border-[#d2e095] rounded-xl px-3 py-2 text-sm bg-white h-20 resize-none focus:outline-none focus:border-[#a8c800]" />
            {msg && <p className={`text-xs mt-2 ${msg.startsWith('✅') ? 'text-green-700' : 'text-red-500'}`}>{msg}</p>}
            <button type="submit" disabled={busy} className="mt-2 bg-[#a8c800] text-white text-sm font-semibold rounded-full px-5 py-2 hover:bg-[#7d9800] transition disabled:opacity-50">{busy ? '…' : data.mine ? t('rev.update', 'Mettre à jour') : t('rev.send', 'Publier mon avis')}</button>
            {data.mine?.status === 'hidden' && <p className="text-xs text-gray-400 mt-2">{t('rev.hidden_note', 'Votre avis a été masqué par Hornafresh.')}</p>}
          </form>
        ) : (
          <p className="text-xs text-gray-400 mb-4">
            {logged ? t('rev.not_eligible', 'Vous pourrez noter ce marchand après avoir reçu une commande contenant ses produits.') : <>{t('rev.login_hint', 'Connectez-vous après une commande livrée pour laisser un avis.')} <Link href="/login" className="text-[#7d9800] underline">{t('join.login', 'Se connecter')}</Link></>}
          </p>
        )}

        {/* Liste */}
        {data.reviews.length > 0 && (
          <div className="space-y-3">
            {data.reviews.map((r, i) => (
              <div key={i} className="border-b border-[#f0f4dc] last:border-0 pb-3 last:pb-0">
                <div className="flex items-center gap-2"><Stars value={r.rating} size="text-sm" /><span className="text-sm font-semibold text-gray-800">{r.name}</span><span className="text-xs text-gray-400">· {new Date(r.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
                {r.comment && <p className="text-sm text-gray-600 mt-1">{r.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
