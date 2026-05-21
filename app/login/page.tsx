'use client';

import { useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (isRegister) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setSuccess('Compte créé ! Vérifiez votre email pour confirmer.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = '/';
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8faf0] flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-6xl">🌿</span>
          <h1 className="text-2xl font-bold text-[#526500] mt-3">Racine Bio</h1>
          <p className="text-gray-400 text-sm mt-1">Le marché bio de Djibouti</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl p-8 border border-[#dde8b0] shadow-sm">
          <h2 className="text-xl font-semibold text-gray-800 mb-6 text-center">
            {isRegister ? '✨ Créer un compte' : '👋 Connexion'}
          </h2>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl mb-4">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-600 text-sm px-4 py-3 rounded-xl mb-4">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-600 mb-1 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="ton@email.com"
                required
                className="w-full border border-[#dde8b0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#a8c800] bg-[#f8faf0]"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 mb-1 block">Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full border border-[#dde8b0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#a8c800] bg-[#f8faf0]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#a8c800] text-white py-3 rounded-xl font-semibold text-sm hover:bg-[#7d9800] transition disabled:opacity-50"
            >
              {loading ? '⏳ Chargement...' : isRegister ? '✅ Créer mon compte' : '🔑 Se connecter'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => { setIsRegister(!isRegister); setError(''); setSuccess(''); }}
              className="text-sm text-[#7d9800] hover:underline"
            >
              {isRegister ? 'Déjà un compte ? Se connecter' : 'Pas de compte ? S\'inscrire'}
            </button>
          </div>
        </div>

        <div className="text-center mt-6">
          <a href="/" className="text-sm text-gray-400 hover:text-gray-600">← Retour à l'accueil</a>
        </div>
      </div>
    </div>
  );
}