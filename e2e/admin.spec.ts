import { test, expect, type Page } from '@playwright/test';
import { expectNoOverflow, trackErrors, settle } from './helpers';

// Panneau d'administration (session admin par lien magique) — lecture seule : on ouvre les modules
// et les formulaires, on n'enregistre rien.
test.use({ storageState: 'e2e/.auth/admin.json' });

// Bandeau « Installez l'app » masqué : il recouvre le bas de l'écran sur mobile et intercepte les clics
test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem('hf_install_dismissed', '1')); });

async function openModule(page: Page, name: RegExp, heading: RegExp) {
  await page.goto('/admin'); await settle(page);
  await page.getByRole('button', { name }).first().click();
  await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
}

const MODULES: [RegExp, RegExp][] = [
  [/Produits/,   /Produits/],
  [/Commandes/,  /Commandes/],
  [/Marchands/,  /Marchands/],
  [/Finances/,   /Finances/],
  [/Promotions/, /Promotions/],
  [/Entreprises/, /Entreprises/],
];

for (const [button, heading] of MODULES) {
  test(`admin › ${heading.source} : charge sans erreur ni débordement`, async ({ page }) => {
    const errors = trackErrors(page);
    await openModule(page, button, heading);
    await expectNoOverflow(page, `admin › ${heading.source}`);
    expect(errors).toEqual([]);
  });
}

test('admin › Marchands : tous les onglets', async ({ page }) => {
  await openModule(page, /Marchands/, /Marchands/);
  for (const tab of ['Marchands', 'Reversements', 'Avis', 'Plans', 'À traiter']) {
    await page.getByRole('button', { name: new RegExp(tab) }).first().click();
    await page.waitForTimeout(1000);
    await expectNoOverflow(page, `Marchands › ${tab}`);
  }
});

test('admin › Produits › Paniers : formulaire de création (sans enregistrer)', async ({ page }) => {
  const errors = trackErrors(page);
  await openModule(page, /Produits/, /Produits/);
  await page.getByRole('button', { name: /Paniers/ }).first().click();
  await page.getByRole('button', { name: /Créer un panier/ }).click();
  await expect(page.getByRole('heading', { name: /Créer un panier/ })).toBeVisible();
  await expect(page.getByText(/Composition/).first()).toBeVisible();
  await expectNoOverflow(page, 'formulaire panier');
  await page.getByRole('button', { name: 'Annuler' }).click();
  await expect(page.getByRole('heading', { name: /Créer un panier/ })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('admin › Promotions › Prix promo produits', async ({ page }) => {
  await openModule(page, /Promotions/, /Promotions/);
  await page.getByRole('button', { name: /Prix promo produits/ }).click();
  await expect(page.getByText(/Nouvelle promotion/).first()).toBeVisible();
  await expectNoOverflow(page, 'Prix promo produits');
});

test('admin › Entreprises : onglets et réglage de la recharge minimale', async ({ page }) => {
  await openModule(page, /Entreprises/, /Entreprises/);
  for (const tab of ['Sociétés', 'Réglages', 'À traiter']) {
    await page.getByRole('button', { name: new RegExp(tab) }).first().click();
    await page.waitForTimeout(600);
    await expectNoOverflow(page, `Entreprises › ${tab}`);
  }
  await page.getByRole('button', { name: /Réglages/ }).first().click();
  await expect(page.getByRole('heading', { name: /Recharge minimale des sociétés/ })).toBeVisible();
});
