import type { Metadata } from 'next';
import { InvitationView } from '@/components/public/invitation-view';
import { cfg } from '@/lib/config';
import { longDate } from '@/lib/format';

const c = cfg.couple;
export const metadata: Metadata = {
  title: `Wedding Invitation · ${c.bride} & ${c.groom}`,
  description: `Invitation to the wedding ceremony of ${c.brideFull} and ${c.groomFull}, ${longDate(cfg.date)} at ${cfg.events.church.address}.`,
};

export default function Page() {
  return <InvitationView />;
}
