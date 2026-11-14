import type { Metadata } from 'next';
import { AdminGate } from '@/components/staff/admin/admin-gate';
import { ChurchCards } from '@/components/staff/admin/church-cards';

export const metadata: Metadata = { title: 'Church invitations · Sarah & Damilare', robots: { index: false } };

export default function Page() {
  return (
    <AdminGate>
      <ChurchCards />
    </AdminGate>
  );
}
