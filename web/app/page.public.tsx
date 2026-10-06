import type { Metadata } from 'next';
import { HomeIntro, HomeView } from '@/components/public/home-view';
import { IntroBoot } from '@/components/wedding/intro-boot';
import { cfg } from '@/lib/config';
import { longDate, weekday } from '@/lib/format';

const c = cfg.couple;
export const metadata: Metadata = {
  title: `${c.bride} & ${c.groom} · ${longDate(cfg.date)}`,
  description: `The wedding of ${c.brideFull} and ${c.groomFull}, ${weekday()} ${longDate(cfg.date)}, Lagos.`,
  openGraph: { title: `${c.bride} & ${c.groom} · ${longDate(cfg.date)}`, description: `The Making of ${c.surname}` },
};

export default function Home() {
  return (
    <>
      <HomeIntro />
      <IntroBoot storageKey="home" />
      <HomeView />
    </>
  );
}
