'use client';
import { CalendarPlus, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EventDetails } from '@/components/wedding/event-details';
import { InvitationArt } from '@/components/wedding/invitation-art';
import { PaperPage } from '@/components/wedding/paper';
import { SiteFooter, SiteNav } from '@/components/wedding/site-chrome';
import { cfg } from '@/lib/config';
import { useSiteContent } from '@/lib/content';
import { longDate } from '@/lib/format';
import { Registry } from './registry';

const c = cfg.couple;
const ev = cfg.events.church;

/** The church invitation: the printed card, then date, time and place with directions and calendar, then the gift registry. */
export function InvitationView() {
  const { content } = useSiteContent();
  return (
    <PaperPage>
      <SiteNav
        links={[
          { href: '/', label: 'Home' },
          { href: '/our-story', label: 'Our Story' },
          { href: content.registryUrl || '#gifts', label: 'Gift Registry', external: !!content.registryUrl },
        ]}
      />
      <main className="mx-auto max-w-[820px] pt-[clamp(16px,4vw,40px)] pb-6">
        <h1 className="sr-only">
          Invitation to the wedding ceremony of {c.brideFull} and {c.groomFull}
        </h1>
        <section className="text-center motion-safe:animate-rise">
          <InvitationArt
            src={content.invitationArt.church}
            alt={`Invitation: together with their families, ${cfg.families.bride} and ${cfg.families.groom} invite you to the wedding of ${c.brideFull} and ${c.groomFull}, ${longDate(cfg.date)} at ${ev.time}, ${ev.venue}, ${ev.venueLine2}, ${ev.address}.`}
          />
        </section>

        <EventDetails ev={ev} date={cfg.date}>
          <Button asChild size="lg" className="ui-caps h-12 rounded-[2px] px-6 text-[0.74rem] tracking-[0.2em]">
            <a href={ev.mapUrl} target="_blank" rel="noopener">
              <MapPin /> Directions
            </a>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="ui-caps h-12 rounded-[2px] border-[#16243d] bg-transparent px-6 text-[0.74rem] tracking-[0.2em] text-[#16243d] hover:bg-[#16243d]/5"
          >
            <a href={`/calendar/${ev.key}.ics`}>
              <CalendarPlus /> Add to calendar
            </a>
          </Button>
        </EventDetails>

        <Registry content={content} />
      </main>
      <SiteFooter />
    </PaperPage>
  );
}
