'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';

// Bouton « J'aime » compact pour les cartes produit (accueil).
// Contrôlé : l'état liked/eligible est fourni par le parent (1 seule requête
// groupée), donc pas d'appel réseau par carte au chargement.
export default function CardLike({
  productId, initialCount = 0, initiallyLiked = false, eligible = false,
}: { productId: number; initialCount?: number; initiallyLiked?: boolean; eligible?: boolean }) {
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;

  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(initiallyLiked);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { setLiked(initiallyLiked); }, [initiallyLiked]);
  useEffect(() => { setCount(initialCount); }, [initialCount]);

  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    if (loading) return;
    setMsg('');
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) { setMsg(t('like.login', 'Connectez-vous pour aimer ce produit.')); return; }
    if (!eligible) { setMsg(t('like.not_eligible', "Aimez ce produit après l'avoir reçu (commande livrée).")); return; }
    setLoading(true);
    const next = !liked;
    setLiked(next); setCount(c => c + (next ? 1 : -1));
    try {
      const res = await fetch('/api/products/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ product_id: productId }),
      });
      const j = await res.json();
      if (res.ok) { setLiked(j.liked); setCount(j.count); }
      else { setLiked(!next); setCount(c => c + (next ? -1 : 1)); }
    } catch {
      setLiked(!next); setCount(c => c + (next ? -1 : 1));
    }
    setLoading(false);
  };

  return (
    <div className="mt-2">
      <div className="flex items-center gap-2">
        <button
          onClick={toggle}
          disabled={loading}
          aria-pressed={liked}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-bold transition disabled:opacity-60
            ${liked ? 'bg-[#ecf4d5] border-[#a8c800] text-[#526500]' : 'bg-white border-[#d2e095] text-gray-500 hover:bg-[#faf7e8]'}`}
        >
          <span className="leading-none">👍</span>
          <span>{count}</span>
        </button>
        {count > 0 && (
          <span className="text-[11px] text-gray-400 truncate">
            {count > 1 ? t('like.count_plural', 'clients ont aimé') : t('like.count_one', 'client a aimé')}
          </span>
        )}
      </div>
      {count === 0 && !msg && (
        <p className="flex items-start gap-1 text-[11px] text-[#7d9800] mt-1 leading-snug">
          <span className="flex-none">🌟</span>
          <span>{t('like.be_first_short', "Soyez le premier à l'aimer !")}</span>
        </p>
      )}
      {msg && (
        <p className="flex items-start gap-1 text-[11px] text-[#f97316] mt-1 leading-snug">
          <span className="flex-none">⚠️</span>
          <span>{msg}</span>
        </p>
      )}
    </div>
  );
}
