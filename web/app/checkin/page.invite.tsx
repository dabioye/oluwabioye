import type { Metadata } from 'next';
import { GateView } from '@/components/staff/gate-view';

export const metadata: Metadata = { title: 'Gate check-in · Sarah & Damilare' };

export default function Page() {
  return <GateView />;
}
