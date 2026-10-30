import type { Metadata } from 'next';
import { AdminGate } from '@/components/staff/admin/admin-gate';
import { WishesDesk } from '@/components/staff/admin/wishes';

export const metadata: Metadata = { title: 'Wishes · Sarah & Damilare', robots: { index: false } };

export default function Page() {
  return (
    <AdminGate>
      <WishesDesk />
    </AdminGate>
  );
}
