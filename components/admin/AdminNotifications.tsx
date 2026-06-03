'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface AdminNotif {
  id: string;
  title: string;
  body: string | null;
  url: string | null;
  read: boolean;
  created_at: string;
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'À l\'instant';
  if (mins < 60) return `il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `il y a ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `il y a ${days}j`;
}

export default function AdminNotifications() {
  const [notifs, setNotifs] = useState<AdminNotif[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase
      .from('admin_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    setNotifs(data || []);
    setLoading(false);
  };

  const markRead = async (id: string) => {
    await supabase.from('admin_notifications').update({ read: true }).eq('id', id);
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = async () => {
    await supabase.from('admin_notifications').update({ read: true }).eq('read', false);
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('admin_notifs_panel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_notifications' },
        payload => setNotifs(prev => [payload.new as AdminNotif, ...prev])
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const unread = notifs.filter(n => !n.read).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800">🔔 Notifications</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {notifs.length === 0
              ? 'Aucune notification'
              : unread > 0
                ? `${unread} non lue${unread > 1 ? 's' : ''}`
                : 'Tout est lu'}
          </p>
        </div>
        {unread > 0 && (
          <button
            onClick={markAllRead}
            className="text-sm text-[#7d9800] hover:underline font-medium"
          >
            Tout marquer comme lu
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <span className="animate-pulse text-3xl">🔔</span>
        </div>
      ) : notifs.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-5xl mb-3 opacity-20">🔔</p>
          <p className="text-gray-400 text-sm">Aucune notification pour l'instant</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifs.map(n => (
            <div
              key={n.id}
              onClick={() => {
                if (!n.read) markRead(n.id);
                if (n.url) window.location.href = n.url;
              }}
              className={`flex items-start gap-4 p-4 rounded-2xl border transition cursor-pointer ${
                n.read
                  ? 'bg-white border-[#e8f0d0] hover:bg-[#fafff5]'
                  : 'bg-[#f4f9e8] border-[#a8c800] shadow-sm hover:bg-[#ecf4d5]'
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold leading-snug ${n.read ? 'text-gray-500' : 'text-gray-800'}`}>
                  {n.title}
                </p>
                {n.body && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{n.body}</p>
                )}
                <p className="text-xs text-gray-300 mt-1.5">{timeAgo(n.created_at)}</p>
              </div>
              {!n.read && (
                <span className="w-2.5 h-2.5 rounded-full bg-[#a8c800] flex-none mt-1" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
