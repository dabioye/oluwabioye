'use client';
import { CalendarPlus, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InvitationArt } from '@/components/wedding/invitation-art';
import { Rule } from '@/components/wedding/ornaments';
import { PaperPage } from '@/components/wedding/paper';
import { SiteFooter, SiteNav } from '@/components/wedding/site-chrome';
import { cfg } from '@/lib/config';
import { useSiteContent } from '@/lib/content';
import { longDate, weekday } from '@/lib/format';

const c = cfg.couple;
const ev = cfg.events.church;

export function InvitationView() {
  const { content } = useSiteContent();
  return (
    <PaperPage>
      <SiteNav
        links={[
          { href: '/', label: 'Home' },
          { href: '/our-story', label: 'Our Story' },
          { href: '/#gifts', label: 'Gift Registry' },
        ]}
      />
      <main className="mx-auto max-w-[820px] py-[clamp(22px,5vw,50px)]">
        <article className="relative mx-auto overflow-hidden bg-[radial-gradient(ellipse_at_50%_0%,rgb(255_255_255/0.86),transparent_65%),#fffdf7] px-[clamp(24px,8vw,76px)] py-[clamp(44px,9vw,84px)] text-center text-[#243047] shadow-[0_24px_80px_rgb(0_0_0/0.18),inset_0_0_0_1px_rgb(185_150_98/0.72),inset_0_0_0_8px_#fffdf7,inset_0_0_0_9px_rgb(185_150_98/0.38)] before:pointer-events-none before:absolute before:inset-[13px] before:border before:border-[rgb(185_150_98/0.42)] sm:before:inset-[18px] motion-safe:animate-rise">
          <div aria-hidden className="mb-5 text-2xl text-[#aa8753]">
            ✦
          </div>
          <div className="eyebrow !text-[#796749]">Together with their families</div>
          <p className="mx-0 mt-4 mb-6 text-[clamp(1rem,3vw,1.22rem)] leading-relaxed">
            {cfg.families.bride}
            <br />
            and
            <br />
            {cfg.families.groom}
          </p>
          <p className="mx-0 mt-0 mb-4 text-[clamp(1rem,3vw,1.2rem)] leading-relaxed text-[#6f6659] italic">
            request the pleasure of your company
            <br />
            at the wedding ceremony of
          </p>
          <h1 className="m-0 grid justify-items-center gap-1 font-display text-[clamp(1.6rem,6vw,2.7rem)] leading-tight font-medium text-[#16243d]">
            <span>{c.brideFull}</span>
            <i className="font-script text-[1.15em] leading-none font-normal text-[#a88a58] not-italic">&amp;</i>
            <span>{c.groomFull}</span>
          </h1>
          <Rule className="text-[#aa8753]" />
          <div className="eyebrow !tracking-[0.24em] !text-[#9a7642]">The Making of {c.surname}</div>
          <p className="mx-0 mt-5 mb-0 text-lg leading-relaxed text-[#5e574c]">
            {weekday()}
            <br />
            <strong className="font-display text-[clamp(1.15rem,4vw,1.45rem)] font-medium text-[#16243d]">{longDate(cfg.date)}</strong>
          </p>
          <p className="my-4 font-display text-[1.05rem] tracking-[0.12em] text-[#16243d]">{ev.time}</p>
          <div className="text-[1.05rem] leading-relaxed text-[#4f4a41]">
            <strong className="text-xl text-[#16243d]">{ev.venue}</strong>
            <br />
            {ev.venueLine2}
            <br />
            <span className="mt-1 inline-block">{ev.address}</span>
          </div>
          <div className="relative mt-6 flex flex-wrap justify-center gap-2.5">
            <Button asChild size="lg" className="ui-caps h-12 rounded-[2px] px-6 text-[0.74rem] tracking-[0.2em]">
              <a href={ev.mapUrl} target="_blank" rel="noopener">
                <MapPin /> Open live map
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
          </div>
          <p className="mx-0 mt-7 mb-0 text-[1.15rem] text-[#796749] italic">We look forward to celebrating with you.</p>
        </article>

        {content.invitationArt.church && (
          <section className="mt-12 text-center">
            <div className="eyebrow">The printed invitation</div>
            <InvitationArt
              src={content.invitationArt.church}
              alt={`Printed invitation to the wedding ceremony of ${c.brideFull} and ${c.groomFull}, ${longDate(cfg.date)}, ${ev.time}.`}
            />
          </section>
        )}
      </main>
      <SiteFooter />
    </PaperPage>
  );
}
