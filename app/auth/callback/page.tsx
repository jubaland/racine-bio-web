'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

export default function AuthCallback() {
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get('error');
    const errorDescription = params.get('error_description');
    const redirectTo = params.get('redirect') || '/';

    if (errorParam) {
      setError(errorDescription || errorParam);
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
        window.location.href = redirectTo;
      }
    });

    const fallback = setTimeout(() => {
      window.location.href = redirectTo;
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(fallback);
    };
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-[#faf7e8] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <p className="text-5xl mb-4">❌</p>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Erreur de connexion</h2>
          <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3 mb-6 break-words">{error}</p>
          <a href="/login" className="bg-[#a8c800] text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-[#7d9800] transition">
            Réessayer
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf7e8] flex items-center justify-center">
      <div className="text-center">
        <p className="text-5xl mb-4 animate-pulse">🌿</p>
        <p className="text-gray-500 text-sm">Connexion en cours...</p>
      </div>
    </div>
  );
}
