import type { Metadata } from 'next';
import { AdminGate } from '@/components/staff/admin/admin-gate';
import { Inbox } from '@/components/staff/admin/inbox';

export const metadata: Metadata = { title: 'Inbox · Sarah & Damilare', robots: { index: false } };

export default function Page() {
  return (
    <AdminGate>
      <Inbox />
    </AdminGate>
  );
}
