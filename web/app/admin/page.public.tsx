import type { Metadata } from 'next';
import { AdminGate } from '@/components/staff/admin/admin-gate';
import { Desk } from '@/components/staff/admin/desk';

export const metadata: Metadata = { title: 'Invitation desk · Sarah & Damilare', robots: { index: false } };

export default function Page() {
  return (
    <AdminGate>
      <Desk />
    </AdminGate>
  );
}
