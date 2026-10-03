'use client';

import { useLanguage } from '../context/LanguageContext';

// « Mon crédit » : encours, disponible, prochaine échéance, retard, journal — pour un client (profil)
// ou une société (espace entreprise). Données : GET /api/credit.
export type CreditView = {
  id: number; holder_type: 'user' | 'company'; credit_limit: number; term: 'month_end' | 'days'; term_days: number | null;
  status: 'active' | 'suspended'; auto_suspended: boolean; suspended_reason: string | null;
  outstanding: number; overdue: number; overdue_since: string | null; available: number; next_due: string | null; next_due_amount: number;
  usable: boolean; due_if_ordered_today: string;
  open: { id: number; order_id: number | null; created_at: string; due_at: string; amount: number; paid_amount: number; remaining: number }[];
  entries: { id: number; type: string; amount: number; order_id: number | null; due_at: string | null; method: string | null; note: string | null; created_at: string }[];
};

const fdj = (n: number) => `${Math.round(Number(n) || 0).toLocaleString()} Fdj`;

export default function CreditPanel({ credit }: { credit: CreditView }) {
  const { ui, currentLang } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;
  const loc = currentLang === 'fr' ? 'fr-FR' : currentLang;
  const dateFmt = (d: string) => new Date(d.length === 10 ? d + 'T00:00:00Z' : d).toLocaleDateString(loc, { day: 'numeric', month: 'long', year: 'numeric', timeZone: d.length === 10 ? 'UTC' : undefined });
  const TYPE: Record<string, string> = {
    charge: t('credit.e_charge', 'Commande'), payment: t('credit.e_payment', 'Paiement reçu'), refund: t('credit.e_refund', 'Avoir'), adjustment: t('credit.e_adjust', 'Ajustement'),
  };
  const METHOD: Record<string, string> = { cash: t('credit.m_cash', 'espèces'), waafi: 'Waafi', dmoney: 'D-Money', other: t('credit.m_other', 'autre') };
  const used = Math.max(0, credit.outstanding);
  const pct = credit.credit_limit > 0 ? Math.min(100, Math.round(used / credit.credit_limit * 100)) : 0;

  return (
    <div className="bg-white rounded-3xl p-6 border border-[#d2e095] shadow-sm mb-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-widest text-[#7d9800]">💳 {credit.holder_type === 'company' ? t('credit.title_company', 'Crédit de la société') : t('credit.title', 'Mon crédit')}</p>
          <p className="text-2xl font-extrabold text-[#526500] mt-0.5">{fdj(used)} <span className="text-sm font-semibold text-gray-400">{t('credit.to_pay', 'à régler')}</span></p>
          <p className="text-xs text-gray-500 mt-0.5">{t('credit.available', 'Disponible')} : <strong className="text-gray-700">{fdj(credit.available)}</strong> {t('credit.of_limit', 'sur un plafond de')} {fdj(credit.credit_limit)}</p>
        </div>
        <span className={`text-xs font-bold px-3 py-1 rounded-full ${credit.status === 'active' ? (credit.overdue > 0 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700') : 'bg-red-100 text-red-700'}`}>
          {credit.status !== 'active' ? t('credit.st_suspended', 'Suspendu') : credit.overdue > 0 ? t('credit.st_overdue', 'Retard de paiement') : t('credit.st_active', 'Actif')}
        </span>
      </div>
      <div className="h-2 bg-[#ecf4d5] rounded-full mt-3 overflow-hidden"><div className={`h-full ${pct >= 90 ? 'bg-orange-400' : 'bg-[#a8c800]'}`} style={{ width: `${pct}%` }} /></div>

      {credit.overdue > 0 && credit.overdue_since && (
        <p className="mt-3 text-sm text-[#b45309] bg-orange-50 border border-orange-200 rounded-xl px-3 py-2">⚠️ {t('credit.overdue_msg', '{amount} en retard depuis le {date}. Réglez auprès d\'Hornafresh pour continuer à commander à crédit.').replace('{amount}', fdj(credit.overdue)).replace('{date}', dateFmt(credit.overdue_since))}</p>
      )}
      {credit.status !== 'active' && (
        <p className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">🛑 {credit.auto_suspended ? t('credit.suspended_auto', 'Crédit suspendu pour retard : il sera réactivé dès le règlement.') : t('credit.suspended_msg', 'Crédit suspendu par Hornafresh.')}{credit.suspended_reason ? ` ${credit.suspended_reason}` : ''}</p>
      )}
      {credit.next_due && credit.next_due_amount > 0 && (
        <p className="mt-3 text-sm text-gray-700">🗓️ {t('credit.next_due', 'Prochaine échéance')} : <strong>{fdj(credit.next_due_amount)}</strong> {t('credit.before', 'avant le')} <strong>{dateFmt(credit.next_due)}</strong></p>
      )}
      <p className="mt-1 text-xs text-gray-400">{t('credit.term_hint', 'Une commande passée aujourd\'hui serait à régler le {date}.').replace('{date}', dateFmt(credit.due_if_ordered_today))} {t('credit.pay_how', 'Règlement en espèces, par Waafi ou D-Money auprès d\'Hornafresh.')}</p>

      {credit.open.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{t('credit.open_title', 'Commandes à régler')}</p>
          <div className="space-y-1">
            {credit.open.map(c => (
              <div key={c.id} className="flex justify-between text-sm border-b border-[#f0f7e0] py-1">
                <span className="text-gray-600">#{c.order_id ?? '-'} · {dateFmt(c.created_at)} <span className="text-gray-400">→ {dateFmt(c.due_at)}</span></span>
                <span className="font-semibold text-gray-800">{fdj(c.remaining)}{c.paid_amount > 0 && <span className="text-[11px] text-gray-400 font-normal"> / {fdj(c.amount)}</span>}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {credit.entries.length > 0 && (
        <details className="mt-4">
          <summary className="text-xs font-semibold text-[#526500] cursor-pointer">{t('credit.history', 'Historique')}</summary>
          <div className="space-y-1 mt-2">
            {credit.entries.slice(0, 30).map(e => (
              <div key={e.id} className="flex justify-between text-xs py-1 border-b border-[#f0f7e0]">
                <span className="text-gray-600">{dateFmt(e.created_at)} · {TYPE[e.type] || e.type}{e.order_id ? ` #${e.order_id}` : ''}{e.method ? ` (${METHOD[e.method] || e.method})` : ''}{e.note && e.type !== 'charge' ? ` — ${e.note}` : ''}</span>
                <span className={`font-semibold ${e.type === 'charge' || e.type === 'adjustment' ? 'text-gray-800' : 'text-green-700'}`}>{e.type === 'charge' || e.type === 'adjustment' ? '+' : '−'}{fdj(e.amount)}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
