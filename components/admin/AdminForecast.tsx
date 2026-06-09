'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { supabase } from '../../lib/supabase';

interface AggRow { product_id: number; name: string; unit: string; quantity: number; stock: number; shortfall: number; }
interface Delivery { user_id: string; name: string | null; email: string | null; frequency: string; items: { product_id: number; name: string; unit: string; quantity: number }[]; fee: number; total: number; balance: number; insufficient: boolean; }
interface Day { date: string; dow: number; deliveries: Delivery[]; }

export default function AdminForecast() {
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;

  const [data, setData] = useState<{ from: string; to: string; totalDeliveries: number; days: Day[]; aggregate: AggRow[] } | null>(null);
  const [loading, setLoading] = useState(true);

  const DAYS = [
    t('sub.day_0', 'Dimanche'), t('sub.day_1', 'Lundi'), t('sub.day_2', 'Mardi'),
    t('sub.day_3', 'Mercredi'), t('sub.day_4', 'Jeudi'), t('sub.day_5', 'Vendredi'), t('sub.day_6', 'Samedi'),
  ];
  const FREQ_LABEL: Record<string, string> = {
    weekly:      t('sub.freq_weekly', 'Hebdomadaire'),
    fortnightly: t('sub.freq_fortnightly', 'Quinzaine'),
    monthly:     t('sub.freq_monthly', 'Mensuelle'),
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const tk = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch('/api/admin/forecast', { headers: { Authorization: `Bearer ${tk}` } });
      const json = await res.json();
      setData(json);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const fmtDate = (s: string) => {
    const d = new Date(s + 'T00:00:00');
    return `${DAYS[d.getDay()]} ${d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}`;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">🗓️ {t('admin.nav_forecast', 'Planning abonnements')}</h1>
        {data && <span className="text-sm text-gray-400">{data.totalDeliveries} {t('admin.fc_deliveries', 'livraison(s)')}</span>}
      </div>
      <p className="text-sm text-gray-500 mb-5">
        {t('admin.fc_hint', 'Projection des livraisons d\'abonnement des 7 prochains jours (commandes non encore créées). Sert à anticiper l\'approvisionnement et la préparation.')}
      </p>

      {loading ? (
        <div className="flex items-center justify-center h-48"><p className="text-gray-400">{t('admin.loading', 'Chargement...')}</p></div>
      ) : !data || data.totalDeliveries === 0 ? (
        <div className="text-center py-12 text-gray-400 bg-white rounded-2xl border border-[#d2e095]">{t('admin.fc_none', 'Aucune livraison d\'abonnement prévue cette semaine.')}</div>
      ) : (
        <>
          {/* Liste d'appro consolidée */}
          <div className="bg-white rounded-2xl border border-[#d2e095] overflow-hidden mb-6">
            <div className="px-4 py-3 bg-[#ecf4d5] border-b border-[#d2e095]">
              <p className="font-semibold text-[#526500]">🧺 {t('admin.fc_aggregate', 'À approvisionner pour la semaine')}</p>
              <p className="text-xs text-gray-500">{fmtDate(data.from)} → {fmtDate(data.to)}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-[#faf7e8] border-b border-[#d2e095]">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">{t('admin.fc_product', 'Produit')}</th>
                    <th className="text-right px-4 py-3 text-gray-500 font-medium">{t('admin.fc_needed', 'Besoin semaine')}</th>
                    <th className="text-right px-4 py-3 text-gray-500 font-medium">{t('admin.fc_stock', 'Stock actuel')}</th>
                    <th className="text-right px-4 py-3 text-gray-500 font-medium">{t('admin.fc_shortfall', 'Manque')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.aggregate.map(a => (
                    <tr key={a.product_id} className={a.shortfall > 0 ? 'bg-orange-50' : ''}>
                      <td className="px-4 py-3 font-medium text-gray-800">{a.name}</td>
                      <td className="px-4 py-3 text-right font-semibold text-[#526500]">{a.quantity} {a.unit?.replace(/^\//, '')}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{a.stock} {a.unit?.replace(/^\//, '')}</td>
                      <td className="px-4 py-3 text-right">
                        {a.shortfall > 0
                          ? <span className="text-[#f97316] font-bold">⚠️ {a.shortfall} {a.unit?.replace(/^\//, '')}</span>
                          : <span className="text-green-600">✓</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Détail par jour */}
          <div className="space-y-4">
            {data.days.map(day => (
              <div key={day.date} className="bg-white rounded-2xl border border-[#d2e095] overflow-hidden">
                <div className="px-4 py-2.5 bg-[#faf7e8] border-b border-[#d2e095] flex items-center justify-between">
                  <p className="font-semibold text-gray-700 capitalize">{fmtDate(day.date)}</p>
                  <span className="text-xs text-gray-400">{day.deliveries.length} {t('admin.fc_deliveries', 'livraison(s)')}</span>
                </div>
                {day.deliveries.length === 0 ? (
                  <p className="px-4 py-4 text-sm text-gray-300">{t('admin.fc_day_empty', '—')}</p>
                ) : (
                  <div className="divide-y divide-[#f0f7e0]">
                    {day.deliveries.map((d, i) => (
                      <div key={`${d.user_id}-${d.frequency}-${i}`} className="px-4 py-3">
                        <div className="flex items-center justify-between gap-3 mb-1">
                          <div className="min-w-0">
                            <span className="font-medium text-gray-800">{d.name || d.email || t('admin.unknown', 'Inconnu')}</span>
                            <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-[#ecf4d5] text-[#526500]">{FREQ_LABEL[d.frequency] || d.frequency}</span>
                          </div>
                          <span className="text-sm font-bold text-[#526500] flex-none">{Number(d.total).toLocaleString()} Fdj</span>
                        </div>
                        <p className="text-xs text-gray-500">
                          {d.items.map(it => `${it.name} ×${it.quantity}`).join(' · ')}
                          {d.fee > 0 && <span className="text-gray-400"> · 🚚 {Number(d.fee).toLocaleString()} Fdj</span>}
                        </p>
                        {d.insufficient && (
                          <p className="text-xs text-[#f97316] mt-1">⚠️ {t('admin.fc_insufficient', 'Cagnotte insuffisante')} ({Number(d.balance).toLocaleString()} Fdj) — {t('admin.fc_will_pause', 'risque de mise en pause')}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
