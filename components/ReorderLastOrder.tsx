'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';
import ReorderDialog from './ReorderDialog';

// Accueil : raccourci « Commander à nouveau » vers la dernière commande du client connecté.
// Invisible pour un visiteur, un client sans commande, ou s'il a fermé le bandeau pour cette commande.
type Order = { id: number | string; status: string; created_at: string; order_items: any[] };
const KEY = 'hf_reorder_dismissed';

export default function ReorderLastOrder() {
  const { ui, currentLang, productTranslations } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;
  const [order, setOrder] = useState<Order | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const res = await fetch('/api/orders/mine', { headers: { Authorization: `Bearer ${session.access_token}` } });
        if (!res.ok) return;
        const j = await res.json();
        const last = (j.orders || []).find((o: Order) => o.status !== 'cancelled' && (o.order_items || []).length > 0);
        if (!last || !on) return;
        try { if (localStorage.getItem(KEY) === String(last.id)) return; } catch { /* ignore */ }
        setOrder(last);
      } catch { /* le raccourci est facultatif */ }
    })();
    return () => { on = false; };
  }, []);

  if (!order) return null;
  const names = order.order_items.map(i => productTranslations[i.product_id]?.name || i.product_name).filter(Boolean);
  const date = new Date(order.created_at).toLocaleDateString(currentLang === 'fr' ? 'fr-FR' : currentLang, { day: 'numeric', month: 'long' });
  const dismiss = () => { try { localStorage.setItem(KEY, String(order.id)); } catch { /* ignore */ } setOrder(null); };

  return (
    <>
      <div className="bg-[#f6f9e6] border-b border-[#d2e095]">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-2.5 flex items-center gap-3">
          <span className="text-xl flex-none">🔁</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#2d6410] leading-tight">{t('reorder.last_title', 'Votre dernière commande')} · {date}</p>
            <p className="text-xs text-gray-500 truncate">{names.join(', ')}</p>
          </div>
          <button onClick={() => setOpen(true)} className="flex-none bg-[#a8c800] text-white text-xs font-semibold px-4 py-2 rounded-full hover:bg-[#7d9800] transition">{t('reorder.title', 'Commander à nouveau')}</button>
          <button onClick={dismiss} aria-label={t('install.close', 'Fermer')} className="flex-none text-gray-400 hover:text-gray-600 text-lg leading-none px-1">✕</button>
        </div>
      </div>
      {open && <ReorderDialog orderId={order.id} items={order.order_items} onClose={() => setOpen(false)} />}
    </>
  );
}
