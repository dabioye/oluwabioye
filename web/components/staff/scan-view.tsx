'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { codeFromPath } from '@/lib/code';
import { Checking, StaffPage } from './staff-shell';
import { GateResultPanel, type GateResult } from './gate-result';

/**
 * Where the access-card QR points (/c/CODE). A signed-in usher gets the check-in result straight away;
 * anyone else (a guest scanning their own card) is taken to their invitation.
 */
export function ScanView() {
  const [res, setRes] = useState<GateResult | null>(null);
  useEffect(() => {
    const code = codeFromPath(location.pathname);
    api<{ role: string | null }>('/api/session')
      .then(async ({ role }) => {
        if (!role) return location.replace(code ? `/i/${code}` : '/');
        setRes(await api<GateResult>('/api/checkin', { body: { code } }));
      })
      .catch(() => location.replace(code ? `/i/${code}` : '/'));
  }, []);
  if (!res) return <Checking />;
  return (
    <StaffPage className="max-w-[560px] pt-10">
      <GateResultPanel res={res} />
      <div className="mt-6 text-center">
        <Button asChild size="lg" className="h-12">
          <a href="/checkin">Scan next guest</a>
        </Button>
      </div>
    </StaffPage>
  );
}
