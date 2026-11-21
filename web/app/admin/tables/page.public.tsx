import type { Metadata } from 'next';
import { AdminGate } from '@/components/staff/admin/admin-gate';
import { Tables } from '@/components/staff/admin/tables';

export const metadata: Metadata = { title: 'Table plan · Sarah & Damilare', robots: { index: false } };

export default function Page() {
  return (
    <AdminGate>
      <Tables />
    </AdminGate>
  );
}
