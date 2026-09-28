# Tests avant déploiement

À lancer en local avant tout commit destiné à la production.

```bash
npm run dev          # dans un premier terminal (port 3000)
npm run test:api     # 14 suites : règles métier, sécurité (RLS), commandes, paniers, stock, réassort…
npm run test:e2e     # parcours navigateur, en mobile 375 px et en desktop
npm test             # les deux à la suite
```

## Ce que couvrent les parcours navigateur (`e2e/`)

| Fichier | Compte | Contenu |
|---|---|---|
| `public.spec.ts` | visiteur | accueil, pages publiques, fiche produit, panier, checkout jusqu'au récapitulatif |
| `merchant.spec.ts` | marchand de test | les 6 pages de l'espace marchand, profil client (tous les onglets), commande modèle |
| `admin.spec.ts` | admin | modules Produits, Commandes, Marchands, Finances, Promotions, formulaire panier |

Chaque test vérifie : la page s'affiche, aucune erreur JavaScript, **aucun débordement horizontal**
(règle PWA : tout doit tenir à 375 px).

## Règles

- **Lecture seule.** La base est celle de production : aucun test navigateur ne confirme de commande
  ni n'enregistre de formulaire. Les tests d'API créent leurs propres données temporaires et les
  suppriment ; les préparateurs sont mis en pause le temps des tests qui créent des commandes.
- **Pas de mot de passe.** Les sessions admin et marchand sont ouvertes par lien magique
  (`e2e/global-setup.ts`, clé service de `.env.local`). Comptes : variables `E2E_ADMIN_EMAIL` et
  `E2E_MERCHANT_EMAIL` (défaut : comptes de test habituels). Fichiers de session dans `e2e/.auth/`, ignorés par git.
- **Un test à la fois** (`workers: 1`) pour ne pas se marcher dessus sur la base partagée.

## Utile

```bash
npx playwright test public --project=mobile     # un fichier, un format
npx playwright test --headed                    # voir le navigateur
npx playwright show-trace test-results/…/trace.zip   # rejouer un échec
node scripts/run_api_tests.mjs bundles          # une seule suite d'API
```

Toute nouvelle page doit recevoir son test (au minimum : chargement + `expectNoOverflow`).
