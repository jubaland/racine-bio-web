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
  [/Achats groupés/, /Achats groupés/],
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

test('admin › Commandes : boutons de quantité et journal des modifications (sans enregistrer)', async ({ page }) => {
  const errors = trackErrors(page);
  await openModule(page, /Commandes/, /Commandes/);
  // Journal global (traçabilité) : visible pour l'admin, s'ouvre sans erreur
  await page.getByRole('button', { name: /Commandes modifiées/ }).click();
  await expect(page.getByText(/Toutes les modifications de quantités/)).toBeVisible();
  await expectNoOverflow(page, 'Commandes › journal des modifications');
  await page.getByRole('button', { name: /Commandes modifiées/ }).click();
  // La molette de quantité existe sur les commandes non annulées ; +/− n'appellent pas le serveur
  const qty = page.getByRole('spinbutton', { name: /Quantité/ }).first();
  if (await qty.isVisible().catch(() => false)) {
    const before = await qty.inputValue();
    await qty.locator('xpath=following-sibling::button[1]').click();          // « + » : brouillon local
    await expect(page.getByRole('button', { name: /Appliquer \(/ }).first()).toBeVisible();
    await page.getByRole('button', { name: /^✕$|Annuler/ }).first().click(); // ✕ : brouillon abandonné
    await expect(qty).toHaveValue(before);
    await expect(page.getByRole('button', { name: /Appliquer \(/ })).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test('admin › Promotions › Prix promo produits', async ({ page }) => {
  await openModule(page, /Promotions/, /Promotions/);
  await page.getByRole('button', { name: /Prix promo produits/ }).click();
  await expect(page.getByText(/Nouvelle promotion/).first()).toBeVisible();
  await expectNoOverflow(page, 'Prix promo produits');
});

test('admin › Promotions › Codes promo : seuil automatique et formulaire (sans enregistrer)', async ({ page }) => {
  const errors = trackErrors(page);
  await openModule(page, /Promotions/, /Promotions/);
  await page.getByRole('button', { name: /Codes promo/ }).click();
  await expect(page.getByText(/Livraison offerte automatique/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByLabel(/Seuil d'achat/)).toBeVisible();
  await expectNoOverflow(page, 'Codes promo');
  await page.getByRole('button', { name: /Nouveau code/ }).click();
  await page.getByRole('button', { name: /Générer/ }).click();
  await expect(page.getByLabel(/^Code/)).toHaveValue(/^[A-Z0-9]{8}$/);
  for (const label of [/Plafond de la remise/, /Panier minimum/, /Nombre total d'utilisations/, /Utilisations par client/, /Réservé à un client/, /Valable jusqu'au/]) {
    await expect(page.getByLabel(label)).toBeVisible();
  }
  await expect(page.getByRole('checkbox', { name: /Réservé à une première commande/ })).not.toBeChecked();
  // Type de remise : un pourcentage demande une valeur, un plafond et les articles concernés
  await page.getByLabel(/Type de remise/).selectOption('percent');
  await expect(page.getByLabel(/Pourcentage \(%\)/)).toBeVisible();
  await expect(page.getByLabel(/Articles concernés/)).toBeVisible();
  await expect(page.getByText(/Obligatoire pour un pourcentage/)).toBeVisible();
  await page.getByLabel(/Type de remise/).selectOption('free_delivery');
  await expect(page.getByLabel(/Pourcentage \(%\)/)).toHaveCount(0);
  await expectNoOverflow(page, 'Codes promo › nouveau code');
  await page.screenshot({ path: test.info().outputPath('codes-promo.png'), fullPage: true });
  await page.getByRole('button', { name: /Annuler/ }).click();
  await expect(page.getByLabel(/Plafond de la remise/)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('admin › Commandes : formulaire de remise (sans enregistrer)', async ({ page }) => {
  await openModule(page, /Commandes/, /Commandes/);
  const btn = page.getByRole('button', { name: /Accorder une remise/ }).first();
  await btn.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => null);   // la liste se charge après l'ouverture du module
  test.skip(!(await btn.isVisible().catch(() => false)), 'aucune commande non annulée à l\'écran');
  await btn.click();
  await expect(page.getByText(/Nouveau prix sur un article/).first()).toBeVisible();
  await expect(page.getByPlaceholder(/négocié par téléphone/).first()).toBeVisible();
  // Bouton d'envoi inactif tant que motif et article/prix ne sont pas renseignés
  await expect(page.getByRole('button', { name: /Accorder la remise/ }).first()).toBeDisabled();
  await page.getByText(/Montant sur toute la commande/).first().click();
  await expect(page.getByPlaceholder(/montant de la remise en Fdj/).first()).toBeVisible();
  await expectNoOverflow(page, 'Commandes › remise');
  await page.screenshot({ path: test.info().outputPath('remise-commande.png'), fullPage: false });
  await page.getByRole('button', { name: /^Annuler$/ }).first().click();
  await expect(page.getByText(/Nouveau prix sur un article/)).toHaveCount(0);
});

test('admin › Crédit clients : indicateurs, formulaire d\'activation, réglages (sans enregistrer)', async ({ page }) => {
  const errors = trackErrors(page);
  await openModule(page, /Crédit clients/, /Crédit clients/);
  await expect(page.getByText(/Encours total/)).toBeVisible({ timeout: 30_000 });
  await expectNoOverflow(page, 'Crédit clients');
  await page.getByRole('button', { name: /Activer un crédit/ }).click();
  await expect(page.getByLabel(/E-mail du compte client/)).toBeVisible();
  await page.getByLabel(/Titulaire/).selectOption('company');
  await expect(page.getByLabel(/^Société/)).toBeVisible();
  await page.getByLabel(/Échéance/).selectOption('days');
  await expect(page.getByLabel(/^jours$/)).toBeVisible();
  await expectNoOverflow(page, 'Crédit clients › activation');
  await page.screenshot({ path: test.info().outputPath('credit-admin.png'), fullPage: true });
  await page.getByRole('button', { name: /^Annuler$/ }).click();
  await page.getByRole('button', { name: /Réglages/ }).click();
  await expect(page.getByLabel(/Rappel avant l'échéance/)).toBeVisible();
  await expect(page.getByLabel(/Suspension automatique/)).toBeVisible();
  await expectNoOverflow(page, 'Crédit clients › réglages');
  expect(errors).toEqual([]);
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
  await expect(page.getByRole('button', { name: /Traduire automatiquement/ })).toBeVisible();   // non cliqué : quota du service préservé
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

test('admin › Achats groupés : onglets, fiche de coût calculée (sans enregistrer)', async ({ page }) => {
  await openModule(page, /Achats groupés/, /Achats groupés/);
  // La liste se charge vraiment (ni sablier sans fin, ni erreur), et un brouillon dont la date limite
  // est passée est signalé au lieu de proposer un bouton « Ouvrir » sans effet
  await expect(page.getByText(/Nouvelle campagne|Ajoutez d'abord un producteur/).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Chargement impossible|session a expiré/)).toHaveCount(0);
  const stale = page.getByText(/Date limite dépassée/);
  if (await stale.count()) await expect(stale.first()).toBeVisible();
  for (const tab of ['Producteurs', 'Réglages', 'Campagnes']) {
    await page.getByRole('button', { name: new RegExp(tab) }).first().click();
    await page.waitForTimeout(600);
    await expectNoOverflow(page, `Achats groupés › ${tab}`);
  }
  await page.getByRole('button', { name: /Producteurs/ }).first().click();
  await page.getByRole('button', { name: /Nouveau producteur/ }).click();
  await expect(page.getByText(/Moyen de paiement du producteur/)).toBeVisible();
  await expectNoOverflow(page, 'Achats groupés › nouveau producteur');
  await page.getByRole('button', { name: /Annuler/ }).click();

  // La fiche de coût se calcule à la saisie (s'il existe un producteur pour créer une campagne)
  await page.getByRole('button', { name: /Campagnes/ }).first().click();
  const create = page.getByRole('button', { name: /Nouvelle campagne/ });
  test.skip(!(await create.isVisible().catch(() => false)), 'aucun producteur actif : pas de campagne à créer');
  await create.click();
  await page.getByLabel(/Prix du producteur/).fill('20');
  await page.getByLabel(/Taux de change/).fill('178');
  await page.getByLabel(/Transport/).fill('400');
  await expect(page.getByText(/coût de revient/)).toBeVisible();
  await page.getByText(/Traductions \(facultatif\)/).click();
  await expect(page.getByRole('button', { name: /Traduire automatiquement/ })).toBeVisible();
  await page.getByLabel(/Marge visée/).fill('20');
  await expect(page.getByText(/Prix conseillé/)).toBeVisible();
  await expectNoOverflow(page, 'Achats groupés › nouvelle campagne');
  await page.getByRole('button', { name: /Annuler/ }).click();
});

test('admin › Annonces : canal e-mail, délai minimal, aperçu (rien n\'est diffusé)', async ({ page }) => {
  const errors = trackErrors(page);
  await openModule(page, /Annonces/, /Diffuser une annonce/);
  // Case « Envoyer aussi par e-mail » décochée par défaut (l'e-mail est un choix explicite à chaque annonce)
  const email = page.getByRole('checkbox', { name: /Envoyer aussi par e-mail/ });
  await expect(email).toBeVisible();
  await expect(email).not.toBeChecked();
  await expect(page.getByText(/Délai minimal entre deux e-mails/)).toBeVisible();
  await expect(page.getByPlaceholder(/nombre d'heures/)).toBeVisible();
  // Aperçu par langue (dry) : compte les destinataires de l'e-mail sans rien envoyer
  await page.getByPlaceholder(/Oranges Bio de Somalie/).fill('TEST e2e — aperçu seulement');
  await page.getByRole('button', { name: /Aperçu par langue/ }).click();
  await expect(page.getByText(/destinataire\(s\)/)).toBeVisible({ timeout: 30_000 });
  await expectNoOverflow(page, 'Annonces');
  await page.screenshot({ path: test.info().outputPath('annonces.png'), fullPage: true });
  expect(errors).toEqual([]);
});

