'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Role } from '@/lib/types';

/** Who is signed in on this site (the cookie is per domain). undefined while checking. */
export function useSession() {
  const [role, setRole] = useState<Role | undefined>(undefined);
  const refresh = useCallback(() => {
    api<{ role: Role }>('/api/session')
      .then((r) => setRole(r.role))
      .catch(() => setRole(null));
  }, []);
  useEffect(refresh, [refresh]);
  return { role, setRole, refresh };
}

export async function signOut(to = '/') {
  await api('/api/logout', { method: 'POST' }).catch(() => {});
  location.assign(to);
}
