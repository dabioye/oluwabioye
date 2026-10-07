import type { Metadata } from 'next';
import { AdminGate } from '@/components/staff/admin/admin-gate';
import { SiteEditor } from '@/components/staff/admin/site-editor';

export const metadata: Metadata = { title: 'Edit website · Sarah & Damilare', robots: { index: false } };

export default function Page() {
  return (
    <AdminGate>
      <SiteEditor />
    </AdminGate>
  );
}
