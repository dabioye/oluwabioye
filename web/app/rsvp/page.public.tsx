import type { Metadata } from 'next';
import { RsvpView } from '@/components/public/rsvp-view';
import { cfg } from '@/lib/config';
import { longDate } from '@/lib/format';

const c = cfg.couple;
export const metadata: Metadata = {
  title: `RSVP · ${c.bride} & ${c.groom}`,
  description: `Let ${c.bride} and ${c.groom} know if you’ll be attending their wedding on ${longDate(cfg.date)}.`,
};

export default function Page() {
  return <RsvpView />;
}
