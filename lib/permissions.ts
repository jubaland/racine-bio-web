// Modèle de rôles et de permissions (partagé client + serveur).

export type Role = 'client' | 'producer' | 'manager' | 'admin';
export const ROLES: Role[] = ['client', 'producer', 'manager', 'admin'];

// Modules du panneau admin et actions possibles par module.
// 'view' = accès à la page ; create/edit/delete = actions dans le module.
export const MODULES: { key: string; actions: string[] }[] = [
  { key: 'products',      actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'categories',    actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'promos',        actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'producers',     actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'orders',        actions: ['view', 'edit'] },
  { key: 'preparers',     actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'requests',      actions: ['view', 'edit'] },
  { key: 'wallets',       actions: ['view', 'edit'] },
  { key: 'subscriptions', actions: ['view', 'edit'] },
  { key: 'forecast',      actions: ['view'] },
  { key: 'users',         actions: ['view', 'edit'] },
  { key: 'delivery',      actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'homepage',      actions: ['view', 'edit'] },
  { key: 'notifications', actions: ['view'] },
];

export type Permissions = Record<string, string[]>;

// Détermine le rôle depuis les user_metadata (rétro-compat avec is_admin).
export function roleOf(meta: any): Role {
  const r = meta?.role;
  if (r === 'client' || r === 'producer' || r === 'manager' || r === 'admin') return r;
  if (meta?.is_admin === true) return 'admin';
  return 'client';
}

// Le compte a-t-il le droit `action` sur le `module` ?
export function hasPerm(meta: any, module: string, action: string = 'view'): boolean {
  const role = roleOf(meta);
  if (role === 'admin') return true;          // admin = tous les droits
  if (role !== 'manager') return false;       // client / producteur : aucun accès admin
  const perms: Permissions = meta?.permissions || {};
  return Array.isArray(perms[module]) && perms[module].includes(action);
}

// Accès au panneau d'administration (au moins un module visible).
export function canAccessAdmin(meta: any): boolean {
  const role = roleOf(meta);
  if (role === 'admin') return true;
  if (role !== 'manager') return false;
  return MODULES.some(m => hasPerm(meta, m.key, 'view'));
}
