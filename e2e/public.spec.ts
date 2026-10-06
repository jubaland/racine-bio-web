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

for (const path of ['/become-producer', '/entreprises', '/about', '/login', '/favorites', '/achats-groupes']) {
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

  // Accueil : le bandeau parle d'un « panier en attente » (pas d'une commande : rien n'a été commandé)
  await page.goto('/'); await settle(page);
  await expect(page.getByText(/Vous avez un panier en attente/)).toBeVisible();
  await expect(page.getByText(/Vous avez une commande en cours/)).toHaveCount(0);

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
  // Un seul champ pour les codes promo et parrainage ; un code inconnu est refusé par le serveur
  await expect(page.getByText(/Code promo ou parrainage/)).toBeVisible();
  await page.getByPlaceholder(/R4K7NP/).fill('ZZZZ99INCONNU');
  await page.getByRole('button', { name: /Appliquer/ }).click();
  await expect(page.getByText(/Code invalide/)).toBeVisible();
  await expectNoOverflow(page, 'checkout étape 3');
  await page.screenshot({ path: test.info().outputPath('checkout-paiement.png'), fullPage: true });

  await page.getByRole('button', { name: /^Continuer/ }).last().click();
  await expect(page.getByText(/Récapitulatif de votre commande/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Confirmer la commande/ })).toBeVisible();
  await expectNoOverflow(page, 'checkout étape 4');
  // ⚠️ On s'arrête ici : la commande n'est jamais confirmée (base de production).

  await page.evaluate(() => localStorage.removeItem('hornafresh_cart_v1'));
  expect(errors).toEqual([]);
});

test("installer l'app : lien du pied de page → instructions (sans installer)", async ({ page }) => {
  await page.goto('/'); await settle(page);
  // Navigateur de test : pas d'invitation native → le lien ouvre les instructions
  await page.getByRole('button', { name: /Installer l'app/ }).first().click();
  await expect(page.getByRole('heading', { name: /Installer l'application/ })).toBeVisible();
  await page.getByRole('button', { name: /Compris/ }).click();
  await expect(page.getByRole('heading', { name: /Installer l'application/ })).toHaveCount(0);
});

test('devenir marchand : les formules viennent des réglages', async ({ page, request }) => {
  const offer = await (await request.get('/api/merchant-offer')).json();
  await page.addInitScript(() => localStorage.setItem('hf_install_dismissed', '1'));
  await page.goto('/become-producer'); await settle(page);
  if (offer.commission?.available) await expect(page.getByText(`${offer.commission.rate} %`).first()).toBeVisible();
  if (offer.plans?.length) await expect(page.getByText(new RegExp(String(offer.plans[0].duration_days))).first()).toBeVisible();
  await expect(page.getByText(/zéro commission/i)).toHaveCount(0);
  await expectNoOverflow(page, '/become-producer');
});

// Régression : l'API ne renvoie que 1 000 lignes par requête ; les traductions sont lues par pages.
// Sans cela, les clés au-delà de la millième restaient en français (blocs non traduits).
for (const lang of ['en', 'zh', 'am', 'so']) {
  test(`accueil en « ${lang} » : aucun bloc resté en français`, async ({ page }) => {
    await page.addInitScript((l) => { localStorage.setItem('lang', l); localStorage.setItem('hf_install_dismissed', '1'); }, lang);
    await page.goto('/'); await settle(page);
    await expect(page.getByText('Reversements suivis')).toHaveCount(0, { timeout: 20_000 });
    for (const fr of ['Rupture de stock', 'Marchands partenaires', 'Vendez sur Hornafresh', 'Votre vitrine', 'Espèces', 'Tous droits réservés', 'Hornafresh est de retour'])
      await expect(page.getByText(fr, { exact: false })).toHaveCount(0);
    await expectNoOverflow(page, `accueil (${lang})`);
  });
}

test("titre de l'onglet et langue de la page suivent la langue choisie", async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('lang', 'en'); localStorage.setItem('hf_install_dismissed', '1'); });
  await page.goto('/'); await settle(page);
  await expect(page).toHaveTitle(/The premium, fresh/, { timeout: 20_000 });
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.goto('/about'); await settle(page);
  await expect(page).toHaveTitle(/The premium, fresh/, { timeout: 20_000 });   // conservé après navigation
});

test('recherche tolérante : faute de frappe et autre langue', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('hf_install_dismissed', '1'));
  await page.goto('/'); await settle(page);
  const box = page.getByPlaceholder(/Rechercher/).first();
  const cards = page.locator('a[href^="/product/"]');
  const all = await cards.count();
  await box.fill('tomatte');                                  // faute de frappe
  await expect(page.getByText('Tomate', { exact: true }).first()).toBeVisible({ timeout: 20_000 });
  expect(await cards.count()).toBeLessThan(all);
  await box.fill('watermelon');                               // mot anglais, site en français
  await expect(page.getByText('Pastèque', { exact: true }).first()).toBeVisible({ timeout: 20_000 });
  await box.fill('zzzzqqqq');
  await expect(page.getByText('Tomate', { exact: true })).toHaveCount(0);
  await expectNoOverflow(page, 'accueil (recherche)');
});

test('achats groupés : page de présentation et campagne inconnue', async ({ page }) => {
  const errors = trackErrors(page);
  await page.addInitScript(() => localStorage.setItem('hf_install_dismissed', '1'));
  await page.goto('/achats-groupes'); await settle(page);
  await expect(page.getByRole('heading', { name: /Achats groupés/ }).first()).toBeVisible();
  await expect(page.getByText(/Vous réservez et payez votre quantité/)).toBeVisible();
  await page.goto('/achats-groupes/999999999'); await settle(page);
  await expect(page.getByText(/n'existe pas ou n'est plus disponible/)).toBeVisible({ timeout: 20_000 });
  await expectNoOverflow(page, '/achats-groupes/inconnue');
  expect(errors.filter(e => !/404/.test(e))).toEqual([]);
});

