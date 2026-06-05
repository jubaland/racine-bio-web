'use client';

import { useLanguage } from '../../context/LanguageContext';

// Bordereau de préparation : affichable sur mobile + imprimable (window.print()).
// L'impression n'affiche que .prep-slip (voir @media print dans globals.css).
export default function PrepSlip({ order, onClose }: { order: any; onClose: () => void }) {
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;

  const items = order.order_items || [];
  const shortId = String(order.id).slice(0, 8).toUpperCase();
  const ordered = new Date(order.created_at);
  const deadline = new Date(ordered.getTime() + 24 * 3600 * 1000); // livraison sous 24h
  const overdue = deadline.getTime() < Date.now();
  const fmt = (d: Date) => d.toLocaleString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' });
  const isCash = order.payment_method === 'cash';

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-start justify-center overflow-y-auto p-3 md:p-6">
      <div className="prep-slip bg-white rounded-2xl w-full max-w-md my-2 shadow-2xl">
        <div className="p-6">
          {/* En-tête */}
          <div className="flex items-center justify-between border-b-2 border-[#526500] pb-3 mb-4">
            <div>
              <p className="text-lg font-extrabold text-[#526500] leading-none">🌿 Hornafresh</p>
              <p className="text-xs text-gray-500 mt-1">{t('slip.title', 'Bordereau de préparation')}</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-sm font-bold text-gray-800">#{shortId}</p>
              <p className="text-xs text-gray-400">{meta(order.status)}</p>
            </div>
          </div>

          {/* Délai de livraison */}
          <div className={`rounded-xl p-3 mb-4 border ${overdue ? 'bg-orange-50 border-orange-300' : 'bg-[#ecf4d5] border-[#a8c800]'}`}>
            <p className="text-xs text-gray-500 uppercase tracking-wide">⏰ {t('slip.deliver_before', 'À livrer avant')}</p>
            <p className={`text-base font-bold ${overdue ? 'text-[#f97316]' : 'text-[#526500]'}`}>
              {fmt(deadline)}{overdue && ` — ${t('slip.overdue', 'EN RETARD')}`}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{t('slip.ordered_at', 'Commandée le')} {fmt(ordered)}</p>
          </div>

          {/* Client */}
          <div className="mb-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">{t('slip.customer', 'Client')}</p>
            <p className="text-sm font-semibold text-gray-800">{order.customer_name || '—'}</p>
            {order.phone   && <p className="text-sm text-gray-600">📞 {order.phone}</p>}
            {order.address && <p className="text-sm text-gray-600">📍 {order.address}</p>}
            {order.email   && <p className="text-sm text-gray-600">✉️ {order.email}</p>}
          </div>

          {/* Articles */}
          <div className="mb-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
              {t('slip.items', 'Articles à préparer')} ({items.length})
            </p>
            <div className="space-y-2">
              {items.map((it: any) => {
                const name = it.product_name || `Produit #${it.product_id}`;
                const unit = it.product_unit || '';
                const farm = it.product_farm || null;
                return (
                  <div key={it.id} className="flex items-start gap-3 border-b border-gray-100 pb-2">
                    <span className="w-5 h-5 border-2 border-gray-400 rounded flex-none mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">
                        <span className="text-[#526500]">{it.quantity} {unit}</span> — {name}
                      </p>
                      {farm && <p className="text-xs text-gray-400">🌱 {farm}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Demande spéciale */}
          {order.special_instructions && (
            <div className="mb-4 bg-amber-50 border border-amber-300 rounded-xl p-3">
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-1">📝 {t('slip.special', 'Demande spéciale')}</p>
              <p className="text-sm text-amber-900 leading-relaxed">{order.special_instructions}</p>
            </div>
          )}

          {/* Paiement */}
          <div className="border-t-2 border-[#526500] pt-3">
            {order.delivery_option_name && (
              <p className="text-sm text-gray-600 mb-1">🚚 {t('slip.delivery_mode', 'Livraison')} : {order.delivery_option_name}</p>
            )}
            {isCash ? (
              <p className="text-base font-bold text-[#526500]">💵 {t('slip.to_collect', 'À encaisser')} : {Number(order.total).toLocaleString()} Fdj</p>
            ) : (
              <p className="text-base font-bold text-[#526500]">
                📱 {t('slip.paid_waafi', 'Payé via Waafi (à vérifier)')} — {Number(order.total).toLocaleString()} Fdj
              </p>
            )}
          </div>
        </div>

        {/* Actions (non imprimées) */}
        <div className="no-print flex gap-3 p-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition">
            {t('slip.close', 'Fermer')}
          </button>
          <button onClick={() => window.print()} className="flex-1 py-2.5 bg-[#526500] text-white rounded-xl text-sm font-semibold hover:bg-[#3f4f00] transition">
            🖨️ {t('slip.print', 'Imprimer')}
          </button>
        </div>
      </div>
    </div>
  );

  function meta(s: string) {
    const labels: Record<string, string> = {
      pending: t('admin.status_pending', '⏳ En attente'),
      processing: t('admin.status_processing', '🚚 En cours'),
      shipping: t('admin.status_shipping', '📦 Expédié'),
      delivered: t('admin.status_delivered', '✅ Livré'),
      cancelled: t('admin.status_cancelled', '❌ Annulé'),
    };
    return labels[s] || s;
  }
}
