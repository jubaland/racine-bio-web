import { createClient } from '@supabase/supabase-js';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// Ouvre les sessions de test par lien magique (API admin Supabase) et les écrit en « storage state »
// Playwright. Aucun mot de passe n'est saisi ni stocké. Fichiers ignorés par git (e2e/.auth/).
const ACCOUNTS: Record<string, string> = {
  admin:    process.env.E2E_ADMIN_EMAIL    || 'wilsandj@hotmail.com',
  merchant: process.env.E2E_MERCHANT_EMAIL || 'zak@yahoo.fr',
};

export default async function globalSetup() {
  const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; }));
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const ref = new URL(url).hostname.split('.')[0];
  const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const anon = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const origin = process.env.E2E_BASE_URL || 'http://localhost:3000';
  const dir = path.join('e2e', '.auth');
  mkdirSync(dir, { recursive: true });

  for (const [name, email] of Object.entries(ACCOUNTS)) {
    const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    if (error) throw new Error(`session ${name}: ${error.message}`);
    const { data: v, error: e2 } = await anon.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: 'magiclink' });
    if (e2 || !v.session) throw new Error(`session ${name}: ${e2?.message}`);
    const s = v.session;
    const token = { access_token: s.access_token, token_type: 'bearer', expires_in: s.expires_in, expires_at: s.expires_at, refresh_token: s.refresh_token, user: s.user };
    writeFileSync(path.join(dir, `${name}.json`), JSON.stringify({
      cookies: [],
      origins: [{ origin, localStorage: [
        { name: `sb-${ref}-auth-token`, value: JSON.stringify(token) },
        { name: 'hf_view_site', value: '1' },
      ] }],
    }));
  }
}
