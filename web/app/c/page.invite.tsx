import type { Metadata } from 'next';
import { ScanView } from '@/components/staff/scan-view';

export const metadata: Metadata = { title: 'Access card · Sarah & Damilare' };

// One static page serves every /c/CODE access-card QR (Firebase Hosting rewrites /c/** here).
export default function Page() {
  return <ScanView />;
}
