# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # dev server (localhost:3000)
npm run build    # production build
npm run lint     # ESLint
```

No test suite exists in this project.

## Architecture

**Racine Bio / Hornafresh** — marketplace de produits bio livrés à Djibouti. Next.js 16.2.6 (App Router), React 19, Tailwind CSS v4, Supabase (auth + DB). Déployé sur Vercel à hornafresh.com.

### Data flow

La page d'accueil (`app/page.tsx`) est un **Server Component** avec `export const dynamic = 'force-dynamic'` (pas de cache Vercel, données toujours fraîches). Elle fetch en parallèle depuis Supabase et passe les données à `<HomePage>` (Client Component). Toutes les autres pages sont `'use client'` et fetchen directement avec le client Supabase public.

Les deux clients Supabase ont des rôles distincts :
- `lib/supabase.ts` — client public (anon key, soumis aux RLS). Utilisé côté client dans les pages et contextes.
- `lib/supabase-admin.ts` — client service role (bypass RLS total). **Serveur uniquement**, importé uniquement dans `app/api/`.

### API Routes

Seulement deux routes API existent, car Supabase est appelé directement depuis le client partout ailleurs :
- `POST /api/orders` — crée une commande avec vérification et décrémentation du stock
- `PATCH /api/orders` — change le statut, restaure le stock si annulation
- `GET /api/orders` — toutes les commandes (admin uniquement, non protégé côté API)
- `GET /api/orders/mine` — commandes de l'utilisateur authentifié (vérifie le JWT)

### Contexts (state global)

Trois contextes wrappent l'app dans `app/layout.tsx` :
- `LanguageContext` — langue courante + toutes les traductions (UI, produits, catégories, promos) chargées depuis Supabase à chaque changement de langue. French (`fr`) = valeurs par défaut, les autres langues fetchen leurs overrides.
- `CartContext` — panier en mémoire (pas de persistance localStorage). Respecte `stock_qty` à l'ajout et à la mise à jour.
- `FavoritesContext` — favoris persistés dans localStorage.

### Traductions

Toutes les strings UI passent par le helper `t(key, fallback)` dans chaque composant :
```tsx
const { ui } = useLanguage();
const t = (key: string, fallback: string) => ui[key] || fallback;
```
Le fallback en français est **la source de vérité** — `ui[key]` est vide pour `fr`. Les traductions sont gérées dans les tables Supabase `ui_translations`, `product_translations`, `category_translations`, `promo_translations`. Les scripts SQL de référence sont dans `scripts/`.

### Snapshot order_items

À la création d'une commande, le checkout copie le nom, l'image, l'unité et la ferme du produit dans `order_items` (`product_name`, `product_image_url`, `product_unit`, `product_farm`). Cela garantit que les commandes historiques restent correctes même si un produit est modifié. L'API et les composants ont un fallback sur un join `products` pour la rétrocompatibilité. Le script de migration est dans `scripts/migrate_order_items_snapshot.sql`.

### Paiement

Deux méthodes actives dans le checkout : **Waafi** et **Espèces**. D-Money est désactivé.

**Waafi** — paiement manuel : le client envoie le montant au numéro marchand `77432615` depuis son app Waafi. La commande est créée en `pending`. L'admin vérifie le paiement et met à jour le statut manuellement dans `/admin` → Commandes.

L'intégration API WaafiPay automatique (endpoint `https://api.waafipay.com/asm`, `API_PURCHASE`) est prévue mais en attente des credentials (`WAAFI_MERCHANT_UID`, `WAAFI_API_USER_ID`, `WAAFI_API_KEY` dans `.env.local` et variables Vercel). Ne pas recréer la route `/api/pay/waafi` avant d'avoir ces trois variables.

**Champ téléphone checkout** — préfixe `77` fixe (div + span) + input pour les 6 chiffres restants. Format `XX XX XX` à la perte de focus via `onBlur`/`onFocus`. State : `phoneDigits` (chiffres bruts), `phoneFocused` (bool). Soumission : `'77' + phoneDigits`.

### Admin

`/admin` — protégé côté client par `user.user_metadata.is_admin === true`. Pour donner l'accès : Supabase Dashboard → Authentication → Users → éditer les métadonnées de l'utilisateur. La page charge un sous-composant selon la section active (sidebar) : `AdminDashboard`, `AdminProducts`, `AdminCategories`, `AdminPromos`, `AdminProducers`, `AdminOrders`, `AdminRequests`, `AdminUsers`.

### Espace producteur

`/producer/dashboard`, `/producer/products`, `/producer/orders` — protégés par une vérification que l'utilisateur a un enregistrement dans la table `producers` (matchant sur `user_id`). Le composant `ProducerLayout` gère ce check et la navigation.

### Design system

- Fond principal : `#faf7e8` / `#f8faf0`
- Vert primaire : `#526500`
- Vert accent / CTA : `#a8c800`
- Bordures : `#d2e095`
- Tailwind v4 : pas de fichier `tailwind.config.js`, la config se fait via `@theme inline` dans `globals.css`.

### Base de données Supabase

Tables principales : `products`, `categories`, `promos`, `producers`, `languages`, `ui_translations`, `product_translations`, `category_translations`, `promo_translations`, `orders`, `order_items`, `producer_requests` (optionnelle).

Les IDs des orders sont des **UUID strings**, pas des numbers.
