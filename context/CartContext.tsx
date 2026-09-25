'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

interface CartItem {
  id: number;
  name: string;
  price: number;
  unit: string;
  image_url: string | null;
  farm: string;
  origin_country?: string | null;
  quantity: number;
  stock_qty: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (product: any) => void;
  removeItem: (id: number) => void;
  updateQuantity: (id: number, quantity: number) => void;
  clearCart: () => void;
  count: number;
  total: number;
}

const CartContext = createContext<CartContextType>({
  items: [],
  addItem: () => {},
  removeItem: () => {},
  updateQuantity: () => {},
  clearCart: () => {},
  count: 0,
  total: 0,
});

// Panier persistant (localStorage) : survit à un rechargement, à la fermeture de la PWA et à la
// navigation entre pages. Conservé 7 jours au plus (les prix/stocks sont revalidés au checkout par l'API).
const STORAGE_KEY = 'hornafresh_cart_v1';
const MAX_AGE_MS = 7 * 86400000;

function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.items) || typeof parsed.savedAt !== 'number') return [];
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) { localStorage.removeItem(STORAGE_KEY); return []; }
    return parsed.items.filter((i: any) => i && typeof i.id === 'number' && i.quantity > 0);
  } catch { return []; }
}
function saveCart(items: CartItem[]) {
  try {
    if (items.length === 0) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify({ items, savedAt: Date.now() }));
  } catch { /* stockage indisponible (navigation privée…) : le panier reste en mémoire */ }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const hydrated = useRef(false);

  // Hydratation après montage (pas de localStorage côté serveur)
  useEffect(() => {
    const saved = loadCart();
    if (saved.length) setItems(saved);
    hydrated.current = true;
  }, []);
  // Sauvegarde à chaque changement (après hydratation, pour ne pas écraser le panier stocké avec [])
  useEffect(() => { if (hydrated.current) saveCart(items); }, [items]);

  const addItem = (product: any) => {
    const stock = Number(product.stock_qty ?? 0);
    setItems(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) {
        if (existing.quantity >= stock) return prev; // stock épuisé
        return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      if (stock <= 0) return prev; // hors stock
      return [...prev, {
        id: product.id,
        name: product.name,
        price: Number(product.price),
        unit: product.unit,
        // Panier composé sans photo : première photo de composant (panier, récapitulatif, snapshot commande)
        image_url: product.image_url || (Array.isArray(product.bundle_items) ? product.bundle_items.find((c: any) => c.image_url)?.image_url ?? null : null),
        farm: product.farm,
        quantity: 1,
        stock_qty: stock,
      }];
    });
  };

  const removeItem = (id: number) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const updateQuantity = (id: number, quantity: number) => {
    if (quantity <= 0) { removeItem(id); return; }
    setItems(prev => prev.map(i => {
      if (i.id !== id) return i;
      return { ...i, quantity: Math.min(quantity, i.stock_qty) };
    }));
  };

  const clearCart = () => setItems([]);

  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, count, total }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
