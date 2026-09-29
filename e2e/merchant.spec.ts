import { test, expect } from '@playwright/test';
import { expectNoOverflow, trackErrors, settle } from './helpers';

// Espace marchand + espace client, avec le compte marchand de test (session par lien magique).
test.use({ storageState: 'e2e/.auth/merchant.json' });

// Bandeau « Installez l'app » masqué : il recouvre le bas de l'écran sur mobile et intercepte les clics
test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem('hf_install_dismissed', '1')); });

const MERCHANT_PAGES: [string, RegExp][] = [
  ['/producer/dashboard',    /Tableau de bord/],
  ['/producer/products',     /Mes produits/],
  ['/producer/orders',       /Mes commandes/],
  ['/producer/promotions',   /Mes promotions/],
  ['/producer/statement',    /Mes reversements/],
  ['/producer/subscription', /Ma formule/],
];

for (const [path, heading] of MERCHANT_PAGES) {
  test(`marchand ${path} : charge sans erreur ni débordement`, async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(path); await settle(page);
    await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
    await expectNoOverflow(page, path);
    expect(errors).toEqual([]);
  });
}

test('marchand › Ma formule : historique présent, aucune erreur', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/producer/subscription'); await settle(page);
  await expect(page.getByRole('heading', { name: /Historique/ })).toBeVisible();
  await expectNoOverflow(page, '/producer/subscription');
  expect(errors).toEqual([]);
});

test('marchand : réglage WhatsApp de la boutique présent', async ({ page }) => {
  await page.goto('/producer/dashboard'); await settle(page);
  await expect(page.getByRole('heading', { name: /WhatsApp de la boutique/ })).toBeVisible();
});

test('client : profil, tous les onglets sans débordement', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/profile'); await settle(page);
  await expect(page.getByText(/Bonjour/).first()).toBeVisible();
  for (const tab of ['Cagnotte', 'Abonnement', 'Commandes', 'Favoris', 'Adresses', 'Réglages', 'Accueil']) {
    await page.getByRole('button', { name: new RegExp(tab) }).first().click();
    await page.waitForTimeout(800);
    await expectNoOverflow(page, `profil › ${tab}`);
  }
  expect(errors).toEqual([]);
});

test('client : ma commande modèle', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/abonnement'); await settle(page);
  await expect(page.getByRole('heading', { name: /Ma commande modèle/ })).toBeVisible();
  await expect(page.getByText(/Ma cagnotte/i).first()).toBeVisible();
  await expectNoOverflow(page, '/abonnement');
  expect(errors).toEqual([]);
});

test('client sans société : « Mon entreprise » renvoie vers la présentation', async ({ page }) => {
  await page.goto('/entreprise');
  await page.waitForURL(/\/entreprises/, { timeout: 30_000 });
  await settle(page);
  await expect(page.getByText(/Nom de l'établissement/).first()).toBeVisible();
  await expectNoOverflow(page, '/entreprises (connecté)');
});

test('client : carte de fidélité visible dans le profil', async ({ page }) => {
  await page.goto('/profile'); await settle(page);
  await expect(page.getByText(/Ma carte de fidélité/)).toBeVisible();
  await expectNoOverflow(page, 'profil › carte de fidélité');
});

test('client : recommander une commande ouvre le récapitulatif (sans commander)', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/profile'); await settle(page);
  await page.getByRole('button', { name: /Commandes/ }).first().click();
  await page.waitForTimeout(1500);
  const again = page.getByRole('button', { name: /Recommander/ }).first();
  test.skip(!(await again.isVisible().catch(() => false)), 'ce compte de test n\'a aucune commande');
  await again.click();
  const dialog = page.getByRole('dialog', { name: /Commander à nouveau/ });
  await expect(dialog).toBeVisible();
  // Le récapitulatif se charge : un total, ou le message « aucun article disponible »
  await expect(dialog.getByText(/hors livraison|n'est disponible actuellement/).first()).toBeVisible({ timeout: 30_000 });
  await expectNoOverflow(page, 'profil › recommander');
  await dialog.getByRole('button', { name: /Fermer/ }).click();
  await expect(dialog).toHaveCount(0);
  expect(errors).toEqual([]);
});

