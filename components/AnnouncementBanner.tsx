'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';

type Announcement = { id: number; title: string; body: string | null; url: string | null };

export default function AnnouncementBanner() {
  const [ann, setAnn] = useState<Announcement | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data } = await supabase
        .from('announcements')
        .select('id, title, body, url')
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(1);
      const a = data?.[0];
      if (!a || !mounted) return;
      // Masqué si l'utilisateur l'a déjà fermé (par id)
      try {
        if (localStorage.getItem('hf_ann_dismissed') === String(a.id)) return;
      } catch { /* ignore */ }
      setAnn(a as Announcement);
    };
    load();

    // Temps réel : une nouvelle annonce apparaît sans rechargement
    const ch = supabase
      .channel('announcements_banner')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => load())
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, []);

  if (!ann) return null;

  const dismiss = () => {
    try { localStorage.setItem('hf_ann_dismissed', String(ann.id)); } catch { /* ignore */ }
    setAnn(null);
  };

  const Inner = (
    <div className="flex items-center gap-3 max-w-7xl mx-auto pl-4 pr-3 py-2.5">
      <span className="text-lg shrink-0">📣</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-tight truncate">{ann.title}</p>
        {ann.body && <p className="text-xs text-white/80 leading-tight truncate">{ann.body}</p>}
      </div>
      {ann.url && (
        <span className="shrink-0 bg-white text-[#2d6410] text-xs font-bold px-4 py-1.5 rounded-full shadow-sm">→</span>
      )}
    </div>
  );

  return (
    <div className="bg-gradient-to-r from-[#2d6410] via-[#3f7d12] to-[#526500] text-white relative">
      {ann.url ? <Link href={ann.url} className="block hover:opacity-95 transition">{Inner}</Link> : Inner}
      <button
        onClick={dismiss}
        aria-label="Fermer"
        className="absolute top-1/2 -translate-y-1/2 right-1 text-white/60 hover:text-white transition text-base leading-none font-bold px-2"
      >
        ✕
      </button>
    </div>
  );
}
