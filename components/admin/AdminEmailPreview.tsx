'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { supabase } from '../../lib/supabase';

// Admin › Aperçu des e-mails : chaque e-mail envoyé aux clients et aux marchands, dans chaque langue,
// avec des données d'exemple. Rien n'est envoyé.

type Kind = { id: string; group: 'customer' | 'merchant' | 'company' };
const LANGS: [string, string][] = [['fr', '🇫🇷 Français'], ['en', '🇬🇧 English'], ['zh', '🇨🇳 中文'], ['so', '🇩🇯 Soomaali'], ['am', '🇪🇹 አማርኛ']];

export default function AdminEmailPreview() {
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;
  const [kinds, setKinds] = useState<Kind[]>([]);
  const [kind, setKind] = useState('order');
  const [lang, setLang] = useState('fr');
  const [mail, setMail] = useState<{ subject: string; html: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const token = async () => {
    let { data: { session } } = await supabase.auth.getSession();
    if (!session || (session.expires_at && session.expires_at * 1000 < Date.now() + 60000)) session = (await supabase.auth.refreshSession()).data.session;
    return session?.access_token;
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/email-preview?list=1', { headers: { Authorization: `Bearer ${await token()}` } });
        const j = await res.json();
        if (res.ok) setKinds(j.kinds || []);
      } catch { /* ignore */ }
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/admin/email-preview?kind=${encodeURIComponent(kind)}&lang=${lang}`, { headers: { Authorization: `Bearer ${await token()}` } });
      const j = await res.json();
      if (res.ok) setMail({ subject: j.subject, html: j.html }); else { setMail(null); setError(j.error || 'Erreur'); }
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }, [kind, lang]);
  useEffect(() => { load(); }, [load]);

  const NAME: Record<string, string> = {
    order: t('mailp.order', 'Confirmation de commande'),
    status_processing: t('mailp.status_processing', 'Commande en préparation'),
    status_shipping: t('mailp.status_shipping', 'Commande expédiée'),
    status_delivered: t('mailp.status_delivered', 'Commande livrée'),
    status_cancelled: t('mailp.status_cancelled', 'Commande annulée'),
    topup: t('mailp.topup', 'Cagnotte rechargée'),
    paused: t('mailp.paused', 'Commande modèle en pause'),
    remind_missing: t('mailp.remind_missing', 'Rappel : solde insuffisant'),
    remind_empty: t('mailp.remind_empty', 'Rappel : panier indisponible'),
    resumed: t('mailp.resumed', 'Commande modèle reprise'),
    expired: t('mailp.expired', 'Commande modèle à renouveler'),
    digest: t('mailp.digest', 'Récapitulatif quotidien du marchand'),
  };
  const GROUP: Record<Kind['group'], string> = { customer: t('mailp.g_customer', 'Clients'), merchant: t('mailp.g_merchant', 'Marchands'), company: t('mailp.g_company', 'Entreprises') };
  const nameOf = (id: string) => NAME[id] || id.replace(/^merchant:/, '');

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-bold text-[#2d6410]">✉️ {t('admin.nav_emails', 'Aperçu des e-mails')}</h2>
        <p className="text-sm text-gray-500 mt-1">{t('mailp.subtitle', 'Les e-mails tels que vos clients et vos marchands les reçoivent, avec des données d\'exemple. Rien n\'est envoyé.')}</p>
      </div>

      <div className="bg-white rounded-2xl border-2 border-[#d2e095] p-4 mb-4 grid sm:grid-cols-[1fr_auto] gap-3 items-end">
        <label className="text-xs font-semibold text-gray-600">{t('mailp.which', 'E-mail')}
          <select value={kind} onChange={e => setKind(e.target.value)} className="block w-full border border-[#d2e095] rounded-xl px-3 py-2 text-sm mt-1 bg-white font-normal">
            {(['customer', 'merchant', 'company'] as const).map(g => {
              const list = kinds.filter(k => k.group === g);
              return list.length ? <optgroup key={g} label={GROUP[g]}>{list.map(k => <option key={k.id} value={k.id}>{nameOf(k.id)}</option>)}</optgroup> : null;
            })}
            {kinds.length === 0 && <option value="order">{NAME.order}</option>}
          </select>
        </label>
        <div className="flex flex-wrap gap-1.5">
          {LANGS.map(([code, label]) => (
            <button key={code} onClick={() => setLang(code)} className={`px-3 py-2 rounded-xl text-xs font-semibold border-2 transition ${lang === code ? 'border-[#a8c800] bg-[#f6f9e6] text-[#526500]' : 'border-[#e3eebf] text-gray-500 hover:border-[#a8c800]'}`}>{label}</button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-500 mb-3">⚠️ {error}</p>}
      {mail && (
        <div className="bg-white rounded-2xl border-2 border-[#d2e095] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#e3eebf]">
            <p className="text-[11px] text-gray-400">{t('mailp.subject', 'Objet')}</p>
            <p className="text-sm font-semibold text-gray-800 break-words">{mail.subject}</p>
          </div>
          {/* Cadre isolé : le contenu de l'e-mail ne peut ni exécuter de script ni agir sur l'admin */}
          <iframe title={t('admin.nav_emails', 'Aperçu des e-mails')} sandbox="" srcDoc={mail.html} className={`w-full h-[70vh] bg-[#f8faf0] ${loading ? 'opacity-50' : ''}`} />
        </div>
      )}
      {!mail && loading && <p className="text-center text-gray-400 py-16">⏳</p>}
    </div>
  );
}
