'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../context/LanguageContext';

export default function ResetPasswordPage() {
  const { ui } = useLanguage();
  const t = (k: string, f: string) => ui[k] || f;

  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false);     // session de récupération détectée
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Le lien de l'e-mail établit une session de récupération (traitée par supabase-js).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setReady(true); setChecking(false);
      }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
      // Laisse un court délai au cas où la session arrive via l'URL
      setTimeout(() => setChecking(false), 1200);
    });
    const tmo = setTimeout(() => setChecking(false), 4000);
    return () => { subscription.unsubscribe(); clearTimeout(tmo); };
  }, []);

  const submit = async () => {
    setError('');
    if (password.length < 8) { setError(t('reset.too_short', 'Minimum 8 caractères.')); return; }
    if (password !== confirm) { setError(t('reset.mismatch', 'Les mots de passe ne correspondent pas.')); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) { setError(error.message); return; }
    setDone(true);
    setTimeout(() => { window.location.href = '/profile'; }, 2500);
  };

  return (
    <div className="min-h-screen bg-[#faf7e8] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-3xl border border-[#d2e095] shadow-sm p-6 md:p-8">
        <div className="text-center mb-6">
          <p className="text-4xl mb-2">🔐</p>
          <h1 className="text-xl font-bold text-gray-800">{t('reset.title', 'Nouveau mot de passe')}</h1>
        </div>

        {checking ? (
          <p className="text-center text-gray-400 text-sm py-8 animate-pulse">{t('reset.checking', 'Vérification du lien...')}</p>
        ) : done ? (
          <div className="text-center py-4">
            <p className="text-4xl mb-3">✅</p>
            <p className="text-[#526500] font-semibold mb-1">{t('reset.success', 'Mot de passe mis à jour !')}</p>
            <p className="text-sm text-gray-400">{t('reset.redirecting', 'Redirection...')}</p>
          </div>
        ) : !ready ? (
          <div className="text-center py-4">
            <p className="text-sm text-gray-600 mb-1 font-medium">{t('reset.invalid_title', 'Lien invalide ou expiré')}</p>
            <p className="text-sm text-gray-400 mb-6">{t('reset.invalid_desc', 'Demandez un nouveau lien de réinitialisation depuis la page de connexion.')}</p>
            <a href="/login" className="inline-block bg-[#a8c800] text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-[#7d9800] transition">
              {t('reset.back_login', 'Retour à la connexion')}
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-500 mb-1">{t('reset.subtitle', 'Choisissez un nouveau mot de passe pour votre compte.')}</p>
            <input
              type="password" autoComplete="new-password" value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={t('reset.new_password', 'Nouveau mot de passe')}
              className="w-full border border-[#d2e095] rounded-xl px-4 py-3 text-sm bg-[#faf7e8] focus:outline-none focus:border-[#a8c800]"
            />
            <input
              type="password" autoComplete="new-password" value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder={t('reset.confirm_password', 'Confirmer le mot de passe')}
              onKeyDown={e => e.key === 'Enter' && submit()}
              className="w-full border border-[#d2e095] rounded-xl px-4 py-3 text-sm bg-[#faf7e8] focus:outline-none focus:border-[#a8c800]"
            />
            {error && <p className="text-xs text-[#f97316]">⚠️ {error}</p>}
            <button
              onClick={submit}
              disabled={saving || !password || !confirm}
              className="w-full bg-[#a8c800] text-white py-3 rounded-xl font-semibold hover:bg-[#7d9800] transition disabled:opacity-50"
            >
              {saving ? t('reset.saving', 'Enregistrement...') : `🔒 ${t('reset.submit', 'Réinitialiser le mot de passe')}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
