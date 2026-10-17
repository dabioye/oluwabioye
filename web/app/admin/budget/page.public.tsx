import type { Metadata } from 'next';
import { AdminGate } from '@/components/staff/admin/admin-gate';
import { Budget } from '@/components/staff/admin/budget';

export const metadata: Metadata = { title: 'Budget · Sarah & Damilare', robots: { index: false } };

export default function Page() {
  return (
    <AdminGate>
      <Budget />
    </AdminGate>
  );
}
