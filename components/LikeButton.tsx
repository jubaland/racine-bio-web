'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';

type Liker = { name: string; date: string };

export default function LikeButton({ productId, initialCount = 0 }: { productId: number; initialCount?: number }) {
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;

  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(false);
  const [eligible, setEligible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  // Liste « qui a aimé »
  const [showList, setShowList] = useState(false);
  const [likers, setLikers] = useState<Liker[] | null>(null);
  const [listLoading, setListLoading] = useState(false);

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
    if (!eligible) { setMsg(t('like.not_eligible', 'Aimez ce produit après l\'avoir reçu.')); return; }
    setLoading(true);
    const next = !liked;
    setLiked(next); setCount(c => c + (next ? 1 : -1));
    if (showList) setLikers(null); // forcera un rechargement de la liste
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

  const toggleList = async () => {
    const opening = !showList;
    setShowList(opening);
    if (opening && likers === null) {
      setListLoading(true);
      try {
        const res = await fetch(`/api/products/like?product_id=${productId}&list=1`);
        const j = await res.json();
        setLikers(j.likers || []);
      } catch { setLikers([]); }
      setListLoading(false);
    }
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
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
          <button onClick={toggleList} className="text-xs text-[#7d9800] hover:underline">
            {count > 1 ? t('like.count_plural', 'clients ont aimé') : t('like.count_one', 'client a aimé')}
            {' · '}{showList ? t('like.hide', 'masquer') : t('like.see', 'voir')}
          </button>
        )}
        {count === 0 && !msg && (
          <span className="text-xs text-[#7d9800]">🌟 {t('like.be_first', 'Goûtez-le et soyez le premier à partager votre coup de cœur !')}</span>
        )}
        {msg && <span className="text-xs text-[#f97316]">{msg}</span>}
      </div>

      {showList && (
        <div className="mt-3 rounded-xl border border-[#e3eebf] bg-[#faf7e8] p-3">
          {listLoading ? (
            <p className="text-xs text-gray-400">…</p>
          ) : !likers || likers.length === 0 ? (
            <p className="text-xs text-gray-400">{t('like.list_empty', 'Aucun détail disponible.')}</p>
          ) : (
            <ul className="space-y-2">
              {likers.map((l, i) => (
                <li key={i} className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-full bg-[#ecf4d5] text-[#526500] flex items-center justify-center text-xs font-bold flex-none">
                    {(l.name || '?').trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="text-sm text-gray-700 flex-1 min-w-0 truncate">{l.name}</span>
                  <span className="text-[11px] text-gray-400 flex-none">👍 {fmtDate(l.date)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
