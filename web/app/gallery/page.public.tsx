import type { Metadata } from 'next';
import { GalleryView } from '@/components/public/gallery-view';
import { cfg } from '@/lib/config';

const c = cfg.couple;
export const metadata: Metadata = {
  title: `Gallery · ${c.bride} & ${c.groom}`,
  description: `Photos of ${c.bride} and ${c.groom} on the way to the making of ${c.surname}.`,
};

export default function Page() {
  return <GalleryView />;
}
