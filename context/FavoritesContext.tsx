'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
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

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<any[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('racine_bio_favorites');
    if (saved) {
      try { setFavorites(JSON.parse(saved)); } catch {}
    }
  }, []);

  const save = (items: any[]) => {
    setFavorites(items);
    localStorage.setItem('racine_bio_favorites', JSON.stringify(items));
  };

  const addFavorite = (product: any) => {
    if (!favorites.find(f => f.id === product.id)) {
      save([...favorites, product]);
    }
  };

  const removeFavorite = (productId: number) => {
    save(favorites.filter(f => f.id !== productId));
  };

  const isFavorite = (productId: number) => {
    return favorites.some(f => f.id === productId);
  };

  return (
    <FavoritesContext.Provider value={{
      favorites, addFavorite, removeFavorite, isFavorite, count: favorites.length
    }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export const useFavorites = () => useContext(FavoritesContext);