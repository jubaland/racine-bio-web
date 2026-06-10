'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';

type Notif = {
  id: number;
  title: string;
  body: string | null;
  url: string | null;
  read: boolean;
  created_at: string;
};

export default function NotificationBell({ userId }: { userId: string }) {
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;
  const router = useRouter();
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const unread = items.filter(n => !n.read).length;

  const fetchItems = useCallback(async () => {
    const { data } = await supabase
      .from('user_notifications')
      .select('id, title, body, url, read, created_at')
      .order('created_at', { ascending: false })
      .limit(30);
    setItems((data as Notif[]) || []);
  }, []);

  useEffect(() => {
    if (!userId) return;
    fetchItems();
    const ch = supabase
      .channel('user_notifs_' + userId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_notifications', filter: `user_id=eq.${userId}` },
        () => fetchItems())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, fetchItems]);

  // Fermer au clic extérieur
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const markAllRead = async () => {
    const unreadIds = items.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length === 0) return;
    setItems(prev => prev.map(n => ({ ...n, read: true })));
    await supabase.from('user_notifications').update({ read: true }).in('id', unreadIds);
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) markAllRead();
  };

  const openItem = (n: Notif) => {
    setOpen(false);
    if (n.url) router.push(n.url);
  };

  const timeAgo = (iso: string) => {
    const d = new Date(iso);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return t('notif.now', "à l'instant");
    if (diff < 3600) return `${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={toggle}
        aria-label={t('notif.title', 'Notifications')}
        className="relative flex items-center justify-center w-9 h-9"
      >
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke={unread > 0 ? '#f97316' : '#9ca3af'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-[#f97316] text-white text-xs min-w-[18px] min-h-[18px] rounded-full flex items-center justify-center font-bold leading-none px-0.5">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed left-2 right-2 top-16 w-auto sm:absolute sm:inset-auto sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 bg-white rounded-2xl shadow-xl border border-[#e3eebf] z-50 overflow-hidden animate-tabfade">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="font-bold text-[#2d6410]">🔔 {t('notif.title', 'Notifications')}</span>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10 px-4">{t('notif.empty', 'Aucune notification pour le moment.')}</p>
            ) : (
              items.map(n => (
                <button
                  key={n.id}
                  onClick={() => openItem(n)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-[#f7fbe9] transition flex gap-3 ${n.url ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <span className={`mt-1.5 w-2 h-2 rounded-full flex-none ${n.read ? 'bg-transparent' : 'bg-[#f97316]'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-800">{n.title}</p>
                    {n.body && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>}
                    <p className="text-[11px] text-gray-300 mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
