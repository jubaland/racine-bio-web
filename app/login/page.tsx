'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../context/LanguageContext';

type Mode = 'login' | 'register';

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { ui } = useLanguage();
  const t = (key: string, fallback: string) => ui[key] || fallback;
  const [redirect, setRedirect] = useState('/');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRedirect(params.get('redirect') || '/');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (mode === 'register') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (error) throw error;
        setSuccess(t('login.register_success', 'Compte créé ! Vérifiez votre email pour confirmer.'));
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = redirect;
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}` },
    });
    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setError('');
    setSuccess('');
  };

  return (
    <div className="min-h-screen bg-[#faf7e8] flex">

      {/* Panneau gauche — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#1c3a05] via-[#2d6410] to-[#7a5800] flex-col justify-between p-12 text-white">
        <Link href="/" className="flex items-center gap-3">
          <span className="text-4xl">🌿</span>
          <div>
            <p className="text-xl font-bold">Hornafresh</p>
            <p className="text-xs text-white/60">{t('footer', 'Le marché premium, frais, bio, local et régional de Djibouti')}</p>
          </div>
        </Link>

        <div>
          <h2 className="text-4xl font-bold leading-tight mb-4">
            {t('login.panel_title', 'Des produits frais,')}<br />
            <span className="text-[#f5d020]">{t('login.panel_accent', 'directement des fermes')}</span>
          </h2>
          <p className="text-white/70 text-lg mb-10">
            {t('login.panel_sub', 'Bio, local, livré en 48h depuis les producteurs djiboutiens.')}
          </p>

          <div className="space-y-4">
            {[
              { emoji: '🌿', text: t('login.feature_bio', 'Produits certifiés bio et locaux') },
              { emoji: '🚚', text: t('login.feature_delivery', 'Livraison en 48h à Djibouti') },
              { emoji: '👨‍🌾', text: t('login.feature_producers', 'Directement des producteurs') },
              { emoji: '💳', text: t('login.feature_payment', 'Paiement Waafi, D-Money ou cash') },
            ].map(f => (
              <div key={f.text} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                  <span>{f.emoji}</span>
                </div>
                <p className="text-sm text-white/80">{f.text}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-white/30">© 2025 Hornafresh · {t('rights', 'Tous droits réservés')}</p>
      </div>

      {/* Panneau droit — formulaire */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">

        {/* Logo mobile */}
        <div className="lg:hidden text-center mb-8">
          <span className="text-5xl">🌿</span>
          <h1 className="text-xl font-bold text-[#526500] mt-2">Hornafresh</h1>
          <p className="text-xs text-gray-400">{t('footer', 'Le marché premium, frais, bio, local et régional de Djibouti')}</p>
        </div>

        <div className="w-full max-w-md">

          {/* Tabs */}
          <div className="flex bg-white border border-[#d2e095] rounded-2xl p-1 mb-8 shadow-sm">
            <button
              onClick={() => switchMode('login')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${
                mode === 'login'
                  ? 'bg-[#a8c800] text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t('login.tab_signin', 'Connexion')}
            </button>
            <button
              onClick={() => switchMode('register')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${
                mode === 'register'
                  ? 'bg-[#a8c800] text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t('login.tab_register', 'Inscription')}
            </button>
          </div>

          {/* Titre */}
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            {mode === 'login'
              ? t('login.signin', '👋 Bon retour !')
              : t('login.create_account', '✨ Créer un compte')}
          </h2>
          <p className="text-sm text-gray-400 mb-8">
            {mode === 'login'
              ? t('login.signin_sub', 'Connectez-vous pour accéder à votre compte.')
              : t('login.register_sub', 'Rejoignez le marché bio de Djibouti.')}
          </p>

          {/* Messages */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl mb-5 flex items-center gap-2">
              <span>⚠️</span> {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-xl mb-5 flex items-center gap-2">
              <span>✅</span> {success}
            </div>
          )}

          {/* Bouton Google */}
          <button
            onClick={handleGoogle}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 rounded-2xl py-3.5 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition shadow-sm disabled:opacity-50 mb-6"
          >
            {googleLoading ? (
              <span className="text-base">⏳</span>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            {t('login.google', 'Continuer avec Google')}
          </button>

          {/* Séparateur */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">{t('login.or', 'ou')}</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Formulaire email */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1.5 block">
                  {t('login.name', 'Nom complet')}
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder={t('login.name_placeholder', 'Ahmed Hassan')}
                  className="w-full border border-[#d2e095] rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:border-[#a8c800] focus:ring-2 focus:ring-[#a8c800]/20 bg-[#faf7e8] transition"
                />
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-600 mb-1.5 block">
                {t('login.email', 'Email')}
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={t('login.email_placeholder', 'ton@email.com')}
                required
                className="w-full border border-[#d2e095] rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:border-[#a8c800] focus:ring-2 focus:ring-[#a8c800]/20 bg-[#faf7e8] transition"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-gray-600">
                  {t('login.password', 'Mot de passe')}
                </label>
                {mode === 'login' && (
                  <button type="button" className="text-xs text-[#7d9800] hover:underline">
                    {t('login.forgot_password', 'Mot de passe oublié ?')}
                  </button>
                )}
              </div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full border border-[#d2e095] rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:border-[#a8c800] focus:ring-2 focus:ring-[#a8c800]/20 bg-[#faf7e8] transition"
              />
              {mode === 'register' && (
                <p className="text-xs text-gray-400 mt-1">{t('login.password_hint', 'Minimum 6 caractères')}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#a8c800] text-white py-3.5 rounded-2xl font-semibold text-sm hover:bg-[#7d9800] transition disabled:opacity-50 shadow-sm"
            >
              {loading
                ? t('login.loading', '⏳ Chargement...')
                : mode === 'register'
                  ? t('login.create_btn', '✅ Créer mon compte')
                  : t('login.signin_btn', '🔑 Se connecter')}
            </button>
          </form>

          {/* Switch mode */}
          <p className="text-center text-sm text-gray-500 mt-6">
            {mode === 'login'
              ? t('login.no_account', "Pas de compte ?")
              : t('login.already_account', 'Déjà un compte ?')}{' '}
            <button
              onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
              className="text-[#7d9800] font-semibold hover:underline"
            >
              {mode === 'login'
                ? t('login.tab_register', "S'inscrire")
                : t('login.tab_signin', 'Se connecter')}
            </button>
          </p>

          <div className="text-center mt-8">
            <Link href="/" className="text-sm text-gray-400 hover:text-gray-500 transition">
              {t('login.back_home', "← Retour à l'accueil")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
