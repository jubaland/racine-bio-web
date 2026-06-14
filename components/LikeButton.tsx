'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';

export default function LikeButton({ productId, initialCount = 0 }: { productId: number; initialCount?: number }) {
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;

  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(false);
  const [eligible, setEligible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let on = true;
    (async () => {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(`/api/products/like?product_id=${productId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok || !on) return;
      const j = await res.json();
      setCount(j.count); setLiked(j.liked); setEligible(j.eligible);
    })();
    return () => { on = false; };
  }, [productId]);

  const toggle = async () => {
    if (loading) return;
    setMsg('');
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) { setMsg(t('like.login', 'Connectez-vous pour aimer ce produit.')); return; }
    if (!eligible) { setMsg(t('like.not_eligible', 'Aimez ce produit après l\'avoir reçu (commande livrée).')); return; }
    setLoading(true);
    // Optimiste
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
    <div className="flex items-center gap-2">
      <button
        onClick={toggle}
        disabled={loading}
        aria-pressed={liked}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-semibold transition disabled:opacity-60
          ${liked
            ? 'bg-[#ecf4d5] border-[#a8c800] text-[#526500]'
            : 'bg-white border-[#d2e095] text-gray-600 hover:bg-[#faf7e8]'}`}
      >
        <span className="text-base leading-none">👍</span>
        <span>{count}</span>
      </button>
      {count > 0 && (
        <span className="text-xs text-gray-400">
          {count > 1 ? t('like.count_plural', "clients ont aimé") : t('like.count_one', 'client a aimé')}
        </span>
      )}
      {msg && <span className="text-xs text-[#f97316]">{msg}</span>}
    </div>
  );
}
