'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { supabase } from '../../lib/supabase';

// Accueil de l'admin : ce qu'il y a à traiter maintenant. Un clic ouvre le module concerné.

type Item = { key: string; module: string; count: number; amount?: number; level: 'urgent' | 'todo' | 'info' };
type Data = { items: Item[]; today: { orders: number; revenue: number } | null; low_threshold: number | null; generated_at: string };

const fdj = (n: number) => `${Math.round(Number(n)).toLocaleString('fr-FR')} Fdj`;

export default function AdminToday({ onOpen }: { onOpen: (module: string) => void }) {
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setFailed(false);
    try {
      let { data: { session } } = await supabase.auth.getSession();
      if (!session || (session.expires_at && session.expires_at * 1000 < Date.now() + 60000)) session = (await supabase.auth.refreshSession()).data.session;
      const res = await fetch('/api/admin/today', { headers: { Authorization: `Bearer ${session?.access_token}` } });
      if (res.ok) setData(await res.json()); else setFailed(true);
    } catch { setFailed(true); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const LABEL: Record<string, { emoji: string; text: string }> = {
    orders_pending:    { emoji: '🛍️', text: t('today.orders_pending', 'commande(s) à confirmer') },
    orders_processing: { emoji: '🧑‍🍳', text: t('today.orders_processing', 'commande(s) à préparer') },
    orders_shipping:   { emoji: '🚚', text: t('today.orders_shipping', 'commande(s) en livraison') },
    cancel_requests:   { emoji: '🛑', text: t('today.cancel_requests', 'demande(s) d\'annulation') },
    change_requests:   { emoji: '🧾', text: t('today.change_requests', 'demande(s) de modification') },
    refunds:           { emoji: '💸', text: t('today.refunds', 'remboursement(s) à effectuer') },
    deposits:          { emoji: '💰', text: t('today.deposits', 'recharge(s) de cagnotte à valider') },
    merchant_payments: { emoji: '💳', text: t('today.merchant_payments', 'paiement(s) marchand à confirmer') },
    merchant_products: { emoji: '🥬', text: t('today.merchant_products', 'produit(s) marchand à valider') },
    merchant_requests: { emoji: '📨', text: t('today.merchant_requests', 'demande(s) d\'adhésion marchand') },
    merchant_payouts:  { emoji: '🏪', text: t('today.merchant_payouts', 'marchand(s) à reverser') },
    company_requests:  { emoji: '🏢', text: t('today.company_requests', 'demande(s) de compte entreprise') },
    company_deposits:  { emoji: '🏦', text: t('today.company_deposits', 'recharge(s) entreprise à valider') },
    stock_out:         { emoji: '⛔', text: t('today.stock_out', 'produit(s) en rupture') },
    stock_low:         { emoji: '⚠️', text: t('today.stock_low', 'produit(s) en stock bas') },
    campaign_payments:       { emoji: '🌍', text: t('today.campaign_payments', 'paiement(s) d\'achat groupé à confirmer') },
    campaigns_to_order:      { emoji: '🎯', text: t('today.campaigns_to_order', 'achat(s) groupé(s) à commander au producteur') },
    campaigns_to_distribute: { emoji: '📦', text: t('today.campaigns_to_distribute', 'achat(s) groupé(s) à distribuer') },
    campaigns_in_transit:    { emoji: '🚚', text: t('today.campaigns_in_transit', 'achat(s) groupé(s) en route') },
    errors:            { emoji: '🚨', text: t('today.errors', 'erreur(s) du site à examiner') },
  };
  const STYLE: Record<Item['level'], string> = {
    urgent: 'border-orange-300 bg-orange-50 hover:border-orange-400',
    todo:   'border-[#d2e095] bg-white hover:border-[#a8c800]',
    info:   'border-gray-200 bg-white hover:border-gray-300',
  };
  const COUNT: Record<Item['level'], string> = { urgent: 'text-[#ea580c]', todo: 'text-[#526500]', info: 'text-gray-500' };

  return (
    <section className="bg-white rounded-3xl border-2 border-[#d2e095] shadow-sm p-4 sm:p-5 mb-5" aria-label={t('today.title', 'À traiter aujourd\'hui')}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="text-base font-bold text-[#2d6410]">📌 {t('today.title', 'À traiter aujourd\'hui')}</h2>
        <div className="flex items-center gap-3">
          {data?.today && <p className="text-xs text-gray-500">{t('today.today', 'Aujourd\'hui')} : <b className="text-[#526500]">{data.today.orders}</b> {t('today.orders', 'commande(s)')} · <b className="text-[#526500]">{fdj(data.today.revenue)}</b></p>}
          <button onClick={load} disabled={loading} title={t('today.refresh', 'Actualiser')} aria-label={t('today.refresh', 'Actualiser')} className="text-xs border border-[#d2e095] text-[#526500] rounded-full px-2.5 py-1 hover:bg-[#ecf4d5] disabled:opacity-50">🔄</button>
        </div>
      </div>
      {loading && !data ? <p className="text-center text-gray-400 py-6">⏳</p>
        : failed ? <p className="text-sm text-gray-400 py-4 text-center">{t('today.failed', 'Le tableau de bord n\'a pas pu être chargé.')}</p>
        : !data || data.items.length === 0 ? <p className="text-sm text-gray-500 bg-[#f6f9e6] rounded-xl px-4 py-5 text-center">🌿 {t('today.nothing', 'Rien à traiter pour le moment.')}</p>
        : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {data.items.map(it => {
              const l = LABEL[it.key] || { emoji: '•', text: it.key };
              return (
                <button key={it.key} onClick={() => onOpen(it.module)} className={`text-left rounded-2xl border-2 px-3 py-2.5 transition flex items-center gap-3 ${STYLE[it.level]}`}>
                  <span className="text-2xl flex-none">{l.emoji}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-gray-800 leading-tight"><b className={`text-lg ${COUNT[it.level]}`}>{it.count}</b> {l.text}</span>
                    {it.amount != null && it.amount > 0 && <span className="block text-[11px] text-gray-500">{fdj(it.amount)}</span>}
                  </span>
                  <span className="flex-none text-gray-300">›</span>
                </button>
              );
            })}
          </div>
        )}
    </section>
  );
}
