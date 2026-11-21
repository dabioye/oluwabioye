import type { Metadata } from 'next';
import { AdminGate } from '@/components/staff/admin/admin-gate';
import { GateList } from '@/components/staff/admin/gate-list';

export const metadata: Metadata = { title: 'Gate list · Sarah & Damilare', robots: { index: false } };

export default function Page() {
  return (
    <AdminGate>
      <GateList />
    </AdminGate>
  );
}
