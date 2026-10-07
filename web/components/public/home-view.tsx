'use client';
import { BookOpen, CalendarPlus, Camera, Gift, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Countdown } from '@/components/wedding/countdown';
import { EventDetails } from '@/components/wedding/event-details';
import { Intro } from '@/components/wedding/intro';
import { Monogram } from '@/components/wedding/monogram';
import { Wordmark } from '@/components/wedding/wordmark';
import { Frame, Sprig } from '@/components/wedding/ornaments';
import { Contacts, Dock, SiteFooter, SiteNav } from '@/components/wedding/site-chrome';
import { cfg } from '@/lib/config';
import { useSiteContent } from '@/lib/content';
import { longDate, weekday } from '@/lib/format';
import { Gallery } from './gallery';
import { Registry } from './registry';
import { StoryTimeline } from './story';

const c = cfg.couple;
const church = cfg.events.church;

function CoupleLockup({ onPhoto = false }: { onPhoto?: boolean }) {
  const name = (role: string, short: string, full: string) => (
    <div className="grid min-w-0 justify-items-center gap-1">
      <span className="font-ui text-[0.64rem] font-medium tracking-[0.2em] text-gold uppercase">{role}</span>
      <strong
        className={`font-body text-[clamp(2rem,8.4vw,4.5rem)] leading-[0.98] font-medium tracking-[-0.025em] [overflow-wrap:anywhere] ${onPhoto ? 'text-white [text-shadow:0_2px_20px_rgb(0_0_0/0.4)]' : 'text-ivory'}`}
      >
        {short}
      </strong>
      <small className={`max-w-full text-[clamp(0.78rem,2.5vw,1rem)] leading-tight ${onPhoto ? 'text-white/80' : 'text-ivory-dim'}`}>{full}</small>
    </div>
  );
  return (
    <div className="mx-auto mt-5 mb-5 grid w-full max-w-[740px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-[clamp(6px,3vw,28px)]">
      {name('The bride', c.bride, c.brideFull)}
      <span aria-hidden className="font-script text-[clamp(2.4rem,9vw,4.4rem)] leading-none text-gold">
        &amp;
      </span>
      {name('The groom', c.groom, c.groomFull)}
    </div>
  );
}

const dateLine = `${weekday()} · ${longDate(cfg.date)} · Lagos`;

const introName = 'font-lavish text-[clamp(2rem,9vw,3.4rem)] leading-none whitespace-nowrap text-ivory [text-shadow:0_2px_10px_rgb(0_0_0/0.6)]';

/** The wax-seal envelope for the home page (the couple can switch it off in the website editor). */
export function HomeIntro() {
  const { content } = useSiteContent();
  return (
    <Intro
      storageKey="home"
      enabled={content.intro.home}
      beside={[
        <span key="s" className={introName}>
          {c.bride}
        </span>,
        <span key="d" className={introName}>
          {c.groom}
        </span>,
      ]}
    >
      <p className="ui-caps m-0 text-[0.78rem] tracking-[0.3em] text-gold [text-shadow:0_2px_8px_rgb(0_0_0/0.7)]">The Making of</p>
      <Wordmark embossed className="mb-1 w-[min(80vw,440px)] [filter:drop-shadow(0_3px_10px_rgb(0_0_0/0.55))]" />
    </Intro>
  );
}

export function HomeView() {
  const { content } = useSiteContent();
  const photo = content.hero.photo;

  return (
    <>
      <SiteNav
        links={[
          { href: '/invitation', label: 'Invitation' },
          { href: '/our-story', label: 'Our Story' },
          { href: '#gallery', label: 'Gallery' },
          { href: content.registryUrl || '#gifts', label: 'Gift Registry', external: !!content.registryUrl },
        ]}
      />

      {photo ? (
        <header
          className="relative -mx-4 grid min-h-[min(calc(100svh-150px),860px)] items-end bg-cover bg-[center_30%] text-center"
          style={{
            backgroundImage: `linear-gradient(180deg, rgb(15 26 46 / .1) 0%, rgb(15 26 46 / .15) 40%, rgb(15 26 46 / .85) 78%, var(--navy) 100%), url('${photo}')`,
          }}
        >
          <div className="grid justify-items-center gap-2.5 px-4 pb-[clamp(28px,6vh,56px)]">
            <CoupleLockup onPhoto />
            {content.hero.note && <p className="m-0 max-w-[30em] text-xl text-ivory italic">{content.hero.note}</p>}
          </div>
        </header>
      ) : (
        <header className="relative mx-auto max-w-[760px] pt-[clamp(40px,10vw,90px)] pb-5 text-center">
          <Sprig className="top-0 -left-2" />
          <div className="motion-safe:animate-rise">
            <Monogram className="text-gold" />
          </div>
          <div className="motion-safe:animate-rise [animation-delay:80ms]">
            <CoupleLockup />
          </div>
          {content.hero.note && <p className="lede mt-4 italic">{content.hero.note}</p>}
          <Sprig className="-right-2 -bottom-24 rotate-180" />
        </header>
      )}

      <main className="mx-auto max-w-[760px]">
        <section id="invitation" className="pt-8 text-center">
          <div className="eyebrow">You are invited to</div>
          <h1 className="mt-3 mb-0 grid justify-items-center gap-3 font-display text-[clamp(1rem,3.4vw,1.25rem)] font-medium tracking-[0.22em] text-gold uppercase">
            The Making of
            <Wordmark className="w-[min(84vw,460px)] text-ivory" />
          </h1>
          <div className="mt-5 font-display text-[clamp(0.9rem,3.2vw,1.1rem)] tracking-[0.16em] text-ivory">{dateLine}</div>
          <Countdown startsAt={church.startsAt} />
          <div className="mt-6 flex justify-center">
            <Button asChild size="lg" className="ui-caps h-12 rounded-[2px] px-7 text-[0.78rem] tracking-[0.22em]">
              <a href="/invitation">Read the invitation</a>
            </Button>
          </div>
        </section>

        <Frame id="day">
          <div className="eyebrow">Together with their families</div>
          <p className="mx-auto mt-3 mb-0 max-w-[30em] font-display text-[clamp(1.25rem,4.2vw,1.65rem)] leading-snug font-medium tracking-[0.04em] text-ivory">
            {cfg.families.bride}
            <span className="my-1 block font-body text-[0.8em] text-gold italic">and</span>
            {cfg.families.groom}
          </p>
          <div className="eyebrow mt-3.5">invite you to the wedding ceremony</div>
          <EventDetails ev={church} date={cfg.date} className="mt-8 border-y border-hairline-soft py-7">
            <Button asChild size="lg" className="ui-caps h-12 rounded-[2px] px-6 text-[0.74rem] tracking-[0.2em]">
              <a href={church.mapUrl} target="_blank" rel="noopener">
                <MapPin /> Directions
              </a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="ui-caps h-12 rounded-[2px] border-gold bg-transparent px-6 text-[0.74rem] tracking-[0.2em] text-gold hover:bg-gold/10 hover:text-gold"
            >
              <a href={`/calendar/${church.key}.ics`}>
                <CalendarPlus /> Add to calendar
              </a>
            </Button>
          </EventDetails>
          {content.publicNotes.length > 0 && (
            <ul className="mx-auto mt-5 grid max-w-[34em] list-none gap-3 p-0 text-left">
              {content.publicNotes.map((n) => (
                <li key={n} className="grid grid-cols-[20px_1fr] gap-2.5 before:pt-1.5 before:text-[0.8rem] before:text-gold before:content-['✦']">
                  {n}
                </li>
              ))}
            </ul>
          )}
          <div className="eyebrow mt-6">Colours of the day</div>
          <div className="mt-4 flex flex-wrap justify-center gap-6">
            {cfg.colours.map((x) => (
              <div key={x.name} className="ui-caps grid justify-items-center gap-2 text-[0.7rem] text-ivory-dim">
                <i className="block size-16 rounded-full border border-gold/60 shadow-[inset_0_2px_6px_rgb(0_0_0/0.3)]" style={{ background: x.hex }} />
                {x.name}
              </div>
            ))}
          </div>
        </Frame>

        <Frame id="story">
          <div className="eyebrow">Our story</div>
          <h2 className="display mt-2.5 mb-3.5 text-[clamp(1.25rem,3.6vw,1.6rem)]">Two lives, one new chapter</h2>
          <p className="lede">A new chapter begins as Sarah and Damilare bring their families, promises and futures together under one name: Oluwabioye.</p>
          {content.story.length ? (
            <StoryTimeline moments={content.story} />
          ) : (
            <p className="lede mt-4 italic">This is the beginning of our story. More moments will be shared here as the celebration draws near.</p>
          )}
          <div className="mt-6 flex justify-center">
            <Button
              asChild
              variant="outline"
              className="ui-caps h-11 rounded-[2px] border-gold bg-transparent px-6 text-[0.74rem] tracking-[0.2em] text-gold hover:bg-gold/10 hover:text-gold"
            >
              <a href="/our-story">Read our story</a>
            </Button>
          </div>
        </Frame>

        <Frame id="gallery">
          <div className="eyebrow">Gallery</div>
          <h2 className="display mt-2.5 text-[clamp(1.25rem,3.6vw,1.6rem)]">Moments so far</h2>
          {content.gallery.length ? (
            <Gallery photos={content.gallery} />
          ) : (
            <p className="lede mt-4 italic">Photos are coming soon. Check back as the celebration draws near.</p>
          )}
        </Frame>

        <Registry content={content} />

        <section className="pt-2.5 pb-5 text-center">
          <div className="eyebrow">Questions</div>
          <Contacts />
        </section>
      </main>
      <SiteFooter />
      <Dock
        items={[
          { href: '/our-story', icon: BookOpen, label: 'Our story' },
          { href: '#gallery', icon: Camera, label: 'Gallery' },
          content.registryUrl
            ? { href: content.registryUrl, icon: Gift, label: 'Registry', external: true }
            : { href: '#gifts', icon: Gift, label: 'Registry' },
        ]}
      />
    </>
  );
}
