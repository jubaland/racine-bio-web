'use client';

import React, { createContext, useContext } from 'react';
import { hasPerm, roleOf, type Role } from '../lib/permissions';

const Ctx = createContext<{ meta: any }>({ meta: null });

export function AdminPermsProvider({ meta, children }: { meta: any; children: React.ReactNode }) {
  return <Ctx.Provider value={{ meta }}>{children}</Ctx.Provider>;
}

// Hook : can(module, action) selon le rôle/droits du compte courant.
export function useCan() {
  const { meta } = useContext(Ctx);
  const can = (module: string, action: string = 'view') => hasPerm(meta, module, action);
  const role: Role = roleOf(meta);
  return { can, role, isAdmin: role === 'admin' };
}
