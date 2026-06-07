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

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  // Met à jour l'état + le cache local (affichage instantané, hors-ligne)
  const persistLocal = (items: any[]) => {
    setFavorites(items);
    try { localStorage.setItem(LS_KEY, JSON.stringify(items)); } catch {}
  };

  // Synchronise avec la base pour un utilisateur connecté :
  // 1) remonte les favoris locaux absents en base, 2) charge l'union (multi-appareils).
  const syncWithDb = useCallback(async (uid: string, localItems: any[]) => {
    const { data: rows, error } = await supabase.from('favorites').select('product_id').eq('user_id', uid);
    if (error) return; // table absente ou souci réseau → on garde le local
    const dbIds = new Set((rows || []).map((r: any) => Number(r.product_id)));

    const localIds = localItems.map((p: any) => Number(p.id)).filter(Boolean);
    const toAdd = localIds.filter(id => !dbIds.has(id));
    if (toAdd.length) {
      await supabase.from('favorites').upsert(
        toAdd.map(id => ({ user_id: uid, product_id: id })), { onConflict: 'user_id,product_id' }
      );
      toAdd.forEach(id => dbIds.add(id));
    }

    const ids = [...dbIds];
    if (!ids.length) { persistLocal([]); return; }

    const { data: prods } = await supabase.from('products').select('*').in('id', ids);
    const map = new Map((prods || []).map((p: any) => [Number(p.id), p]));
    const merged = ids
      .map(id => map.get(id) || localItems.find((p: any) => Number(p.id) === id))
      .filter(Boolean);
    persistLocal(merged);
  }, []);

  useEffect(() => {
    // Charge le cache local immédiatement (UX instantanée)
    let local: any[] = [];
    try { const s = localStorage.getItem(LS_KEY); if (s) local = JSON.parse(s); } catch {}
    setFavorites(local);

    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id || null;
      setUserId(uid);
      if (uid) syncWithDb(uid, local);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      const uid = session?.user?.id || null;
      setUserId(uid);
      if (uid) {
        let cur: any[] = [];
        try { const s = localStorage.getItem(LS_KEY); if (s) cur = JSON.parse(s); } catch {}
        syncWithDb(uid, cur);
      }
    });
    return () => subscription.unsubscribe();
  }, [syncWithDb]);

  const addFavorite = (product: any) => {
    if (favorites.find(f => Number(f.id) === Number(product.id))) return;
    persistLocal([...favorites, product]);
    if (userId) {
      void supabase.from('favorites').upsert(
        { user_id: userId, product_id: product.id }, { onConflict: 'user_id,product_id' }
      );
    }
  };

  const removeFavorite = (productId: number) => {
    persistLocal(favorites.filter(f => Number(f.id) !== Number(productId)));
    if (userId) {
      void supabase.from('favorites').delete().eq('user_id', userId).eq('product_id', productId);
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
