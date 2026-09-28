import { test, expect } from '@playwright/test';
import { expectNoOverflow, trackErrors, settle } from './helpers';

// Parcours public (visiteur non connecté) — lecture seule : aucune commande n'est confirmée.

// Bandeau « Installez l'app » masqué : il recouvre le bas de l'écran sur mobile et intercepte les clics
test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem('hf_install_dismissed', '1')); });

test('accueil : catalogue visible, sans erreur ni débordement', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/'); await settle(page);
  await expect(page.getByRole('heading', { name: /Tous les produits/ })).toBeVisible();
  expect(await page.locator('a[href^="/product/"]').count()).toBeGreaterThan(0);
  await expect(page.locator('a[href^="https://wa.me/253"]').first()).toBeAttached(); // WhatsApp Hornafresh
  await expectNoOverflow(page, '/');
  expect(errors).toEqual([]);
});

for (const path of ['/become-producer', '/entreprises', '/about', '/login', '/favorites']) {
  test(`page publique ${path} : sans débordement`, async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(path); await settle(page);
    await expectNoOverflow(page, path);
    expect(errors).toEqual([]);
  });
}

test('pages réservées : redirection vers la connexion', async ({ page }) => {
  await page.goto('/abonnement');
  await page.waitForURL(/\/login/, { timeout: 30_000 });
  await page.goto('/entreprise');
  await page.waitForURL(/\/login/, { timeout: 30_000 });
});

test('entreprises : présentation et invitation à se connecter', async ({ page }) => {
  await page.goto('/entreprises'); await settle(page);
  await expect(page.getByRole('heading', { name: /Ouvrir un compte entreprise/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Se connecter/ }).first()).toBeVisible();
});

test('fiche produit → panier → checkout (4 étapes, sans confirmer)', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/'); await settle(page);

  // Premier produit en stock de la grille « Tous les produits »
  const card = page.locator('#produits a[href^="/product/"]').filter({ has: page.locator('button:not([disabled])', { hasText: '+' }) }).first();
  await expect(card).toBeVisible();
  const href = await card.getAttribute('href');
  await page.goto(href!); await settle(page);
  await expectNoOverflow(page, 'fiche produit');
  await expect(page.locator('a[href^="https://wa.me/"]').first()).toBeAttached();

  await page.getByRole('button', { name: /Ajouter au panier/ }).click();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('hornafresh_cart_v1') || '{"items":[]}').items.length);
  expect(stored).toBe(1);

  await page.goto('/checkout'); await settle(page);
  await expect(page.getByRole('heading', { name: /Finaliser la commande/ })).toBeVisible();
  await expectNoOverflow(page, 'checkout étape 1');

  await page.getByRole('button', { name: /Continuer.*Livraison/ }).click();
  await page.getByPlaceholder(/Ahmed Hassan/).fill('Test Parcours');
  // Visiteur : téléphone à saisir deux fois (confirmation)
  const phones = page.getByPlaceholder('XX XX XX');
  for (let i = 0; i < await phones.count(); i++) await phones.nth(i).fill('000000');
  await page.getByPlaceholder(/Quartier 4/).fill('Test adresse, Djibouti');
  await expectNoOverflow(page, 'checkout étape 2');

  await page.getByRole('button', { name: /Continuer.*Paiement/ }).click();
  // Visiteur : l'étape paiement commence par « Se connecter » ou « Continuer sans compte »
  await page.getByRole('button', { name: /Continuer sans compte/ }).click();
  await expect(page.getByText('Mode de paiement').first()).toBeVisible();
  await expectNoOverflow(page, 'checkout étape 3');

  await page.getByRole('button', { name: /^Continuer/ }).last().click();
  await expect(page.getByText(/Récapitulatif de votre commande/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Confirmer la commande/ })).toBeVisible();
  await expectNoOverflow(page, 'checkout étape 4');
  // ⚠️ On s'arrête ici : la commande n'est jamais confirmée (base de production).

  await page.evaluate(() => localStorage.removeItem('hornafresh_cart_v1'));
  expect(errors).toEqual([]);
});
