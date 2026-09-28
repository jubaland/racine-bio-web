'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';

// Carte de fidélité du client (profil) : une case par commande livrée, récompense créditée sur la
// cagnotte quand la carte est pleine. Masquée si le programme est en pause.
type Card = { enabled: boolean; orders_required: number; reward_amount: number; min_order: number; stamps: number; remaining: number; rewards: { id: number; amount: number; created_at: string }[]; total_rewarded: number };
const fdj = (n: number) => `${Math.round(Number(n)).toLocaleString('fr-FR')} Fdj`;

export default function LoyaltyCard() {
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;
  const [card, setCard] = useState<Card | null>(null);

  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const token = (await supabase.auth.getSession()).data.session?.access_token;
        if (!token) return;
        const res = await fetch('/api/loyalty', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok && on) setCard(await res.json());
      } catch { /* ignore */ }
    })();
    return () => { on = false; };
  }, []);

  if (!card || !card.enabled) return null;
  const boxes = Array.from({ length: card.orders_required }, (_, i) => i < card.stamps);
  const cols = card.orders_required <= 5 ? card.orders_required : Math.ceil(card.orders_required / 2);

  return (
    <div className="bg-white rounded-3xl border border-[#d2e095] shadow-sm p-5 mb-5">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-[#7d9800]">🎁 {t('loy.title', 'Ma carte de fidélité')}</p>
          <p className="text-sm text-gray-600 mt-0.5">
            {card.remaining === 0
              ? t('loy.full', 'Carte complète : votre récompense arrive avec la prochaine livraison.')
              : card.remaining === 1
                ? <>{t('loy.one_left', 'Plus qu\'une commande livrée avant')} <strong className="text-[#526500]">{fdj(card.reward_amount)}</strong> {t('loy.on_wallet', 'sur votre cagnotte')}</>
                : <>{t('loy.left_before', 'Encore')} <strong>{card.remaining}</strong> {t('loy.left_after', 'commandes livrées avant')} <strong className="text-[#526500]">{fdj(card.reward_amount)}</strong> {t('loy.on_wallet', 'sur votre cagnotte')}</>}
          </p>
        </div>
        <span className="text-sm font-bold text-[#526500] bg-[#ecf4d5] px-3 py-1 rounded-full whitespace-nowrap">{card.stamps} / {card.orders_required}</span>
      </div>

      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {boxes.map((done, i) => (
          <div key={i} className={`aspect-square rounded-xl border-2 flex items-center justify-center text-lg sm:text-xl transition ${done ? 'bg-[#a8c800] border-[#7d9800] text-white shadow-sm' : i === card.orders_required - 1 ? 'border-dashed border-[#f59e0b] bg-amber-50' : 'border-dashed border-[#d2e095] bg-[#faf7e8]'}`}>
            {done ? '✓' : i === card.orders_required - 1 ? '🎁' : <span className="text-xs text-gray-300 font-semibold">{i + 1}</span>}
          </div>
        ))}
      </div>

      <p className="text-[11px] text-gray-400 mt-3">
        {t('loy.rule', 'Un tampon par commande livrée')}{card.min_order > 0 ? ` ${t('loy.rule_min', 'd\'au moins')} ${fdj(card.min_order)} ${t('loy.rule_excl', '(hors livraison)')}` : ''}, {t('loy.rule_day', 'un par jour au maximum.')}
        {card.total_rewarded > 0 && <> · {t('loy.earned', 'Déjà gagné')} : <strong className="text-[#526500]">{fdj(card.total_rewarded)}</strong></>}
      </p>
    </div>
  );
}
