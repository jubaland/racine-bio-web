'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useCart } from '../context/CartContext';
import { fetchProducts } from '../lib/supabase';
import { planReorder, type PastItem, type ReorderPlan } from '../lib/reorder';

// Recommander une commande passée : récapitulatif de ce qui est disponible aujourd'hui (quantité,
// prix actuel), puis ajout au panier ou remplacement du panier. Rien n'est commandé ici.

const fdj = (n: number) => `${Math.round(Number(n)).toLocaleString('fr-FR')} Fdj`;

export default function ReorderDialog({ orderId, items, onClose }: { orderId: number | string; items: PastItem[]; onClose: () => void }) {
  const { ui, productTranslations } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;
  const { items: cart, setLines } = useCart();
  const [plan, setPlan] = useState<ReorderPlan | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let on = true;
    (async () => {
      try { const catalog = await fetchProducts(); if (on) setPlan(planReorder(items, catalog)); }
      catch { if (on) setFailed(true); }
    })();
    return () => { on = false; };
  }, [items]);

  const nameOf = (l: { product_id: number; name: string }) => productTranslations[l.product_id]?.name || l.name;
  const go = (replace: boolean) => {
    if (!plan) return;
    setLines(plan.lines.filter(l => l.product).map(l => ({ product: l.product, quantity: l.quantity })), replace);
    window.location.href = '/checkout';
  };

  const STATUS = {
    ok:          { cls: 'text-green-700', text: '' },
    reduced:     { cls: 'text-amber-700', text: t('reorder.reduced', 'quantité réduite (stock)') },
    unavailable: { cls: 'text-red-500',   text: t('reorder.unavailable', 'indisponible') },
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={t('reorder.title', 'Commander à nouveau')}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[88vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-[#d2e095] flex items-center justify-between gap-3">
          <h3 className="font-bold text-gray-800">🔁 {t('reorder.title', 'Commander à nouveau')} <span className="text-xs font-normal text-gray-400">#{String(orderId).slice(0, 8).toUpperCase()}</span></h3>
          <button onClick={onClose} aria-label={t('install.close', 'Fermer')} className="text-gray-400 hover:text-gray-600 text-2xl leading-none w-8 h-8 flex items-center justify-center">×</button>
        </div>

        {failed ? <p className="p-6 text-sm text-center text-gray-500">{t('profile.reorder_err', 'Erreur, réessayez.')}</p>
          : !plan ? <p className="p-10 text-center text-gray-400">⏳</p>
          : (
            <>
              <div className="overflow-y-auto p-3 space-y-1.5">
                {plan.lines.map(l => (
                  <div key={l.product_id} className={`flex items-center gap-3 rounded-xl px-3 py-2 ${l.status === 'unavailable' ? 'bg-gray-50 opacity-70' : 'bg-[#faf7e8]'}`}>
                    <div className="w-10 h-10 rounded-lg overflow-hidden flex-none bg-[#ecf4d5] flex items-center justify-center">
                      {l.image_url ? <img src={l.image_url} alt="" className="w-full h-full object-cover" /> : <span>🥬</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{nameOf(l)}</p>
                      <p className={`text-[11px] ${STATUS[l.status].cls}`}>
                        {l.status === 'unavailable' ? STATUS.unavailable.text : `${l.quantity} ${l.unit}${l.status === 'reduced' ? ` · ${STATUS.reduced.text} (${l.wanted})` : ''}`}
                      </p>
                    </div>
                    {l.price != null && (
                      <div className="text-right flex-none">
                        <p className="text-sm font-semibold text-[#526500] whitespace-nowrap">{fdj(l.price * l.quantity)}</p>
                        {l.price !== l.old_price && <p className="text-[10px] text-gray-400 whitespace-nowrap">{t('reorder.was', 'avant')} {fdj(l.old_price)} / {l.unit}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="p-4 border-t border-[#d2e095] space-y-2">
                {plan.available === 0 ? (
                  <p className="text-sm text-[#f97316] bg-[#fff3e8] rounded-xl px-3 py-2">{t('profile.reorder_none', 'Aucun article de cette commande n\'est disponible actuellement.')}</p>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">{plan.available} {t('reorder.items', 'article(s)')}{plan.unavailable ? ` · ${plan.unavailable} ${t('reorder.unavailable', 'indisponible')}` : ''} · {t('reorder.excl_delivery', 'hors livraison')}</span>
                      <span className="text-base font-bold text-[#526500]">{fdj(plan.total)}</span>
                    </div>
                    {plan.price_changed && <p className="text-[11px] text-gray-400">{t('reorder.price_note', 'Les prix sont ceux d\'aujourd\'hui.')}</p>}
                    <button onClick={() => go(true)} className="w-full py-3 rounded-xl bg-[#a8c800] text-white text-sm font-semibold hover:bg-[#7d9800] transition">
                      🛒 {cart.length ? t('reorder.replace', 'Remplacer mon panier et commander') : t('reorder.order', 'Commander ces articles')}
                    </button>
                    {cart.length > 0 && (
                      <button onClick={() => go(false)} className="w-full py-2.5 rounded-xl border border-[#d2e095] text-[#526500] text-sm font-semibold hover:bg-[#ecf4d5] transition">
                        ➕ {t('reorder.add', 'Ajouter à mon panier actuel')}
                      </button>
                    )}
                  </>
                )}
              </div>
            </>
          )}
      </div>
    </div>
  );
}
