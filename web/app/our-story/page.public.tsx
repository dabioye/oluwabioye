import type { Metadata } from 'next';
import { StoryView } from '@/components/public/story-view';
import { cfg } from '@/lib/config';

const c = cfg.couple;
export const metadata: Metadata = {
  title: `Our Story · The Making of ${c.surname}`,
  description: `The story of ${c.bride} and ${c.groom}, and the making of ${c.surname}.`,
};

export default function Page() {
  return <StoryView />;
}
