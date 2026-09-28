import { defineConfig, devices } from '@playwright/test';

// Tests de parcours (navigateur) — à lancer avant chaque déploiement : npm run test:e2e
// La base est celle de production : les tests sont en lecture seule (aucune commande confirmée,
// aucun enregistrement), exécutés un par un. Sessions admin / marchand ouvertes par lien magique
// (e2e/global-setup.ts), jamais par mot de passe.
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'fr-FR',
  },
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: 'npm run dev', url: 'http://localhost:3000', reuseExistingServer: true, timeout: 180_000,
  },
  projects: [
    { name: 'mobile',  use: { ...devices['Pixel 5'], viewport: { width: 375, height: 812 } } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
});
