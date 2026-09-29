'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '../context/LanguageContext';

// Accueil : achats groupés ouverts. Invisible s'il n'y en a aucun.
const fdj = (n: number) => `${Math.round(Number(n)).toLocaleString('fr-FR')} Fdj`;
const FLAG: Record<string, string> = { SO: '🇸🇴', ET: '🇪🇹', DJ: '🇩🇯', OTHER: '🌍' };

export default function GroupBuyingTeaser() {
  const { ui, currentLang } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;
  const [list, setList] = useState<any[]>([]);

  useEffect(() => {
    let on = true;
    fetch('/api/campaigns').then(r => r.ok ? r.json() : null).then(j => { if (on && j) setList((j.campaigns || []).filter((c: any) => c.status === 'open').slice(0, 3)); }).catch(() => {});
    return () => { on = false; };
  }, []);
  if (!list.length) return null;
  const tr = (c: any, k: string) => c?.translations?.[currentLang]?.[k] || c?.[k] || '';

  return (
    <section className="max-w-7xl mx-auto px-4 md:px-6 py-6">
      <div className="flex flex-wrap items-end justify-between gap-2 mb-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800">🌍 {t('gb.title', 'Achats groupés')}</h2>
          <p className="text-xs text-gray-500">{t('gb.teaser', 'Commandez à plusieurs directement chez un producteur de la région.')}</p>
        </div>
        <Link href="/achats-groupes" className="text-xs font-semibold text-[#7d9800] hover:underline">{t('gb.see_all', 'Tout voir')} →</Link>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {list.map(c => (
          <Link key={c.id} href={`/achats-groupes/${c.id}`} className="bg-white rounded-2xl border-2 border-[#d2e095] p-3 flex gap-3 hover:border-[#a8c800] hover:shadow-md transition">
            <div className="w-20 h-20 rounded-xl overflow-hidden bg-[#ecf4d5] flex-none flex items-center justify-center">{c.image_url ? <img src={c.image_url} alt="" className="w-full h-full object-cover" /> : <span className="text-3xl opacity-40">🌍</span>}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">{tr(c, 'title')}</p>
              <p className="text-[11px] text-gray-500 truncate">{FLAG[c.supplier?.country] || '🌍'} {c.supplier?.name}</p>
              <p className="text-sm font-bold text-[#526500]">{fdj(c.price_djf)} <span className="text-[11px] font-normal text-gray-400">/ {tr(c, 'unit_label')}</span></p>
              <div className="h-1.5 rounded-full bg-[#ecf4d5] overflow-hidden mt-1"><div className={`h-full ${c.progress.reached ? 'bg-[#526500]' : 'bg-[#a8c800]'}`} style={{ width: `${c.progress.pct}%` }} /></div>
              <p className="text-[11px] text-gray-400 mt-0.5">{c.progress.units} / {c.progress.min}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
