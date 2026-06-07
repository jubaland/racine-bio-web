'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
// Ancien format (tableau simple) = considéré comme favoris invité (à fusionner une fois).
function readCache(): { uid: string | null; items: any[] } {
  try {
    const s = localStorage.getItem(LS_KEY);
    if (!s) return { uid: null, items: [] };
    const parsed = JSON.parse(s);
    if (Array.isArray(parsed)) return { uid: null, items: parsed };           // legacy
    return { uid: parsed.uid ?? null, items: Array.isArray(parsed.items) ? parsed.items : [] };
  } catch { return { uid: null, items: [] }; }
}
function writeCache(uid: string | null, items: any[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ uid, items })); } catch {}
}

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const persist = (uid: string | null, items: any[]) => {
    setFavorites(items);
    writeCache(uid, items);
  };

  // Charge depuis la base = source de vérité (aucun re-push du local → pas de résurrection)
  const loadFromDb = useCallback(async (uid: string) => {
    const { data: rows, error } = await supabase.from('favorites').select('product_id').eq('user_id', uid);
    if (error) return; // table absente / réseau → on garde l'affichage courant
    const ids = (rows || []).map((r: any) => Number(r.product_id));
    if (!ids.length) { persist(uid, []); return; }
    const { data: prods } = await supabase.from('products').select('*').in('id', ids);
    const map = new Map((prods || []).map((p: any) => [Number(p.id), p]));
    const items = ids.map(id => map.get(id)).filter(Boolean);
    persist(uid, items);
  }, []);

  // À la connexion : fusionne les favoris invité (une seule fois) puis charge la base
  const mergeGuestThenLoad = useCallback(async (uid: string, guestItems: any[]) => {
    const ids = guestItems.map((p: any) => Number(p.id)).filter(Boolean);
    if (ids.length) {
      await supabase.from('favorites').upsert(
        ids.map(id => ({ user_id: uid, product_id: id })), { onConflict: 'user_id,product_id' }
      );
    }
    await loadFromDb(uid);
  }, [loadFromDb]);

  useEffect(() => {
    const cache = readCache();
    setFavorites(cache.items); // affichage instantané

    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id || null;
      setUserId(uid);
      if (uid) {
        // Restauration de session (rechargement) : la base fait foi, jamais de
        // re-push du local → une suppression reste supprimée (pas de résurrection).
        loadFromDb(uid);
      } else {
        // Invité : n'affiche pas le miroir d'un autre utilisateur
        if (cache.uid !== null) persist(null, []);
        else writeCache(null, cache.items);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const uid = session?.user?.id || null;
      setUserId(uid);
      if (!uid) {
        if (event === 'SIGNED_OUT') persist(null, []);
        return;
      }
      if (event === 'SIGNED_IN') {
        // Vraie connexion : on fusionne les favoris ajoutés en invité (une fois), puis on charge.
        const c = readCache();
        if (c.uid === null && c.items.length) mergeGuestThenLoad(uid, c.items);
        else loadFromDb(uid);
      } else if (event === 'TOKEN_REFRESHED') {
        loadFromDb(uid); // rafraîchit depuis la base, sans fusion
      }
    });
    return () => subscription.unsubscribe();
  }, [loadFromDb, mergeGuestThenLoad]);

  // On lit la session au moment de l'écriture (fiable, indépendant de l'état React)
  const addFavorite = async (product: any) => {
    if (favorites.some(f => Number(f.id) === Number(product.id))) return;
    const next = [...favorites, product];
    setFavorites(next);
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id || null;
    setUserId(uid);
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
    setUserId(uid);
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
