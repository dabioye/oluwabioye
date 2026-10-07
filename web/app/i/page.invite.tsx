import type { Metadata } from 'next';
import { InviteView } from '@/components/invite/invite-view';
import { IntroBoot } from '@/components/wedding/intro-boot';
import { cfg } from '@/lib/config';

export const metadata: Metadata = {
  title: `Your invitation · ${cfg.couple.bride} & ${cfg.couple.groom}`,
  description: 'Your personal wedding invitation',
};

// One static page serves every /i/CODE link (Firebase Hosting rewrites /i/** here); the code is read in the browser.
export default function Page() {
  return (
    <>
      <InviteView />
      <IntroBoot storageKey="invite" />
    </>
  );
}
