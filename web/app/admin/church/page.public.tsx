import type { Metadata } from 'next';
import { AdminGate } from '@/components/staff/admin/admin-gate';
import { ChurchRsvps } from '@/components/staff/admin/church';

export const metadata: Metadata = { title: 'Church RSVPs · Sarah & Damilare', robots: { index: false } };

export default function Page() {
  return (
    <AdminGate>
      <ChurchRsvps />
    </AdminGate>
  );
}
