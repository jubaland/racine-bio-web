'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface FavoritesContextType {
  favorites: any[];
  addFavorite: (product: any) => void;
  removeFavorite: (productId: number) => void;
  isFavorite: (productId: number) => boolean;
  count: number;
}

const FavoritesContext = createContext<FavoritesContextType>({
  favorites: [],
  addFavorite: () => {},
  removeFavorite: () => {},
  isFavorite: () => false,
  count: 0,
});

const LS_KEY = 'racine_bio_favorites';

// Cache local au format { uid, items }. uid = propriétaire du miroir (null = invité).
// Ancien format (tableau simple) = favoris invité (fusion une fois à la connexion).
function readCache(): { uid: string | null; items: any[] } {
  try {
    const s = localStorage.getItem(LS_KEY);
    if (!s) return { uid: null, items: [] };
    const parsed = JSON.parse(s);
    if (Array.isArray(parsed)) return { uid: null, items: parsed };
    return { uid: parsed.uid ?? null, items: Array.isArray(parsed.items) ? parsed.items : [] };
  } catch { return { uid: null, items: [] }; }
}
function writeCache(uid: string | null, items: any[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ uid, items })); } catch {}
}

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const uidRef = useRef<string | null>(null);
  const channelRef = useRef<any>(null);

  const persist = (uid: string | null, items: any[]) => {
    setFavorites(items);
    writeCache(uid, items);
  };

  // Charge depuis la base = source de vérité
  const loadFromDb = useCallback(async (uid: string) => {
    const { data: rows, error } = await supabase.from('favorites').select('product_id').eq('user_id', uid);
    if (error) return;
    const ids = (rows || []).map((r: any) => Number(r.product_id));
    if (!ids.length) { persist(uid, []); return; }
    const { data: prods } = await supabase.from('products').select('*').in('id', ids);
    const map = new Map((prods || []).map((p: any) => [Number(p.id), p]));
    const items = ids.map(id => map.get(id)).filter(Boolean);
    persist(uid, items);
  }, []);

  const mergeGuestThenLoad = useCallback(async (uid: string, guestItems: any[]) => {
    const ids = guestItems.map((p: any) => Number(p.id)).filter(Boolean);
    if (ids.length) {
      await supabase.from('favorites').upsert(
        ids.map(id => ({ user_id: uid, product_id: id })), { onConflict: 'user_id,product_id' }
      );
    }
    await loadFromDb(uid);
  }, [loadFromDb]);

  // Abonnement temps réel : toute modif des favoris de cet utilisateur recharge la liste
  const subscribeRealtime = useCallback((uid: string) => {
    if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
    const ch = supabase
      .channel(`favorites:${uid}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'favorites', filter: `user_id=eq.${uid}` },
        () => { loadFromDb(uid); })
      .subscribe();
    channelRef.current = ch;
  }, [loadFromDb]);

  // Active une session connectée : auth realtime + chargement + abonnement
  const activate = useCallback((uid: string, accessToken?: string) => {
    uidRef.current = uid;
    setUserId(uid);
    try { if (accessToken) supabase.realtime.setAuth(accessToken); } catch {}
    subscribeRealtime(uid);
  }, [subscribeRealtime]);

  useEffect(() => {
    const cache = readCache();
    setFavorites(cache.items);

    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id || null;
      if (uid) {
        activate(uid, session?.access_token);
        loadFromDb(uid);
      } else {
        if (cache.uid !== null) persist(null, []);
        else writeCache(null, cache.items);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const uid = session?.user?.id || null;
      if (!uid) {
        uidRef.current = null;
        setUserId(null);
        if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
        if (event === 'SIGNED_OUT') persist(null, []);
        return;
      }
      if (event === 'SIGNED_IN') {
        activate(uid, session?.access_token);
        const c = readCache();
        if (c.uid === null && c.items.length) mergeGuestThenLoad(uid, c.items);
        else loadFromDb(uid);
      } else if (event === 'TOKEN_REFRESHED') {
        activate(uid, session?.access_token);
        loadFromDb(uid);
      }
    });

    // Repli : au retour sur l'app (onglet/PWA réactivé), on resynchronise depuis la base
    const onVisible = () => {
      if (document.visibilityState === 'visible' && uidRef.current) {
        loadFromDb(uidRef.current);
        subscribeRealtime(uidRef.current); // reconnecte le temps réel si la socket a été coupée
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
      if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
    };
  }, [activate, loadFromDb, mergeGuestThenLoad, subscribeRealtime]);

  // Écriture : session lue au moment de l'action (fiable)
  const addFavorite = async (product: any) => {
    if (favorites.some(f => Number(f.id) === Number(product.id))) return;
    const next = [...favorites, product];
    setFavorites(next);
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id || null;
    writeCache(uid, next);
    if (uid) {
      const { error } = await supabase.from('favorites').upsert(
        { user_id: uid, product_id: product.id }, { onConflict: 'user_id,product_id' }
      );
      if (error) console.error('[favorites] add error:', error.message);
    }
  };

  const removeFavorite = async (productId: number) => {
    const next = favorites.filter(f => Number(f.id) !== Number(productId));
    setFavorites(next);
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id || null;
    writeCache(uid, next);
    if (uid) {
      const { error } = await supabase.from('favorites').delete().eq('user_id', uid).eq('product_id', productId);
      if (error) console.error('[favorites] remove error:', error.message);
    }
  };

  const isFavorite = (productId: number) => favorites.some(f => Number(f.id) === Number(productId));

  return (
    <FavoritesContext.Provider value={{
      favorites, addFavorite, removeFavorite, isFavorite, count: favorites.length
    }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export const useFavorites = () => useContext(FavoritesContext);
