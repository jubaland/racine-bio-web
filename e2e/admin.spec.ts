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
  [/Fidélité/, /Fidélité/],
  [/Surveillance/, /Surveillance/],
  [/Aperçu des e-mails/, /Aperçu des e-mails/],
];

for (const [button, heading] of MODULES) {
  test(`admin › ${heading.source} : charge sans erreur ni débordement`, async ({ page }) => {
    const errors = trackErrors(page);
    await openModule(page, button, heading);
    await expectNoOverflow(page, `admin › ${heading.source}`);
    expect(errors).toEqual([]);
  });
}

test('admin › Marchands › Plans : réglage de la formule commission', async ({ page }) => {
  await openModule(page, /Marchands/, /Marchands/);
  await page.getByRole('button', { name: /Plans/ }).first().click();
  await expect(page.getByText(/Formule commission/).first()).toBeVisible();
  await expect(page.getByText(/Taux général/).first()).toBeVisible();
  await expect(page.getByText(/Plans d'abonnement/).first()).toBeVisible();
  await expect(page.getByText(/Rappels et délais/).first()).toBeVisible();
  await expect(page.getByText(/Prolongation rapide/).first()).toBeVisible();
  await expectNoOverflow(page, 'Marchands › Plans');
});

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

test('admin › Fidélité : réglages de la carte (sans enregistrer)', async ({ page }) => {
  await openModule(page, /Fidélité/, /Fidélité/);
  await expect(page.getByRole('heading', { name: /Réglages de la carte/ })).toBeVisible();
  await expect(page.getByText(/Récompense versée sur la cagnotte/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enregistrer' })).toBeVisible();
  await expectNoOverflow(page, 'Fidélité');
});

test('admin › Produits : éditeur de traductions (sans enregistrer)', async ({ page }) => {
  await openModule(page, /Produits/, /Produits/);
  await page.getByRole('button', { name: /Traductions/ }).first().click();
  await expect(page.getByRole('heading', { name: /Traductions du produit/ })).toBeVisible();
  await expect(page.getByText(/Texte français \(référence\)/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('🇬🇧 English')).toBeVisible();
  await expectNoOverflow(page, 'Produits › Traductions');
  await page.getByRole('button', { name: /Annuler/ }).click();
  await expect(page.getByRole('heading', { name: /Traductions du produit/ })).toHaveCount(0);
});

test('admin › accueil : tableau de bord du jour', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/admin'); await settle(page);
  const today = page.getByRole('region', { name: /À traiter aujourd'hui/ });
  await expect(today).toBeVisible();
  // Soit des éléments à traiter, soit le message « rien à traiter » : jamais un panneau vide ou en erreur
  await expect(today.getByText(/Rien à traiter pour le moment|›/).first()).toBeVisible({ timeout: 30_000 });
  await expect(today.getByText(/n'a pas pu être chargé/)).toHaveCount(0);
  await expectNoOverflow(page, 'admin › accueil');
  expect(errors).toEqual([]);
});

test('admin › Surveillance : onglets et réglages (sans enregistrer)', async ({ page }) => {
  await openModule(page, /Surveillance/, /Surveillance/);
  for (const tab of ['Résolues', 'Réglages', 'À traiter']) {
    await page.getByRole('button', { name: new RegExp(tab) }).first().click();
    await page.waitForTimeout(800);
    await expectNoOverflow(page, `Surveillance › ${tab}`);
  }
  await page.getByRole('button', { name: /Réglages/ }).first().click();
  await expect(page.getByText(/Délai entre deux alertes/)).toBeVisible();
  await expect(page.getByText(/Conservation du journal/)).toBeVisible();
});

test('admin › Aperçu des e-mails : e-mail affiché, changement de langue', async ({ page }) => {
  await openModule(page, /Aperçu des e-mails/, /Aperçu des e-mails/);
  await expect(page.getByText(/Commande #1234 confirmée/)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('iframe')).toBeVisible();
  await page.getByRole('button', { name: /English/ }).click();
  await expect(page.getByText(/Order #1234 confirmed/)).toBeVisible({ timeout: 30_000 });
  await expectNoOverflow(page, 'Aperçu des e-mails');
});

