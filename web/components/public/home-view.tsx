'use client';
import { BookOpen, Camera, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Countdown } from '@/components/wedding/countdown';
import { EventBlock } from '@/components/wedding/event-block';
import { Intro } from '@/components/wedding/intro';
import { Monogram } from '@/components/wedding/monogram';
import { Frame, Rule, Sprig } from '@/components/wedding/ornaments';
import { Contacts, Dock, SiteFooter, SiteNav } from '@/components/wedding/site-chrome';
import { cfg } from '@/lib/config';
import { useSiteContent } from '@/lib/content';
import { longDate, weekday } from '@/lib/format';
import { Gallery } from './gallery';
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

/** The wax-seal envelope for the home page (the couple can switch it off in the website editor). */
export function HomeIntro() {
  const { content } = useSiteContent();
  return (
    <Intro storageKey="home" enabled={content.intro.home}>
      <p className="ui-caps m-0 text-[0.7rem] tracking-[0.25em] text-gold">The making of {c.surname}</p>
      <p className="m-0 mb-1 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-[clamp(6px,2vw,16px)] [text-shadow:0_2px_10px_rgb(0_0_0/0.6)]">
        <span className="font-script text-[clamp(2rem,8vw,3.1rem)] leading-none whitespace-nowrap text-ivory">{c.bride}</span>
        <span className="font-script text-[clamp(1.8rem,7vw,2.6rem)] text-gold-bright">&amp;</span>
        <span className="font-script text-[clamp(2rem,8vw,3.1rem)] leading-none whitespace-nowrap text-ivory">{c.groom}</span>
      </p>
    </Intro>
  );
}

export function HomeView() {
  const { content } = useSiteContent();
  const photo = content.hero.photo;
  const hasGallery = content.gallery.length > 0;

  return (
    <>
      <SiteNav
        links={[
          { href: '/invitation', label: 'Invitation' },
          { href: '/our-story', label: 'Our Story' },
          ...(hasGallery ? [{ href: '#gallery', label: 'Gallery' }] : []),
          { href: '#gifts', label: 'Gift Registry' },
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
            <h1 className="mx-auto max-w-[18ch] font-display text-[clamp(1.25rem,5vw,2rem)] leading-tight font-medium tracking-[0.08em] text-ivory uppercase">
              The Making of {c.surname}
            </h1>
            <div className="font-display text-[clamp(0.8rem,3.4vw,1.05rem)] tracking-[0.16em] text-ivory">{dateLine}</div>
            {content.hero.note && <p className="m-0 max-w-[30em] text-xl text-ivory italic">{content.hero.note}</p>}
            <Countdown startsAt={church.startsAt} />
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
          <Rule />
          <h1 className="mx-auto max-w-[18ch] font-display text-[clamp(1.55rem,5.5vw,2.7rem)] leading-tight font-medium tracking-[0.08em] text-gold uppercase motion-safe:animate-rise [animation-delay:160ms]">
            The Making of
            <span className="mt-1 block font-script text-[clamp(2.3rem,8vw,4.6rem)] leading-[1.08] tracking-normal text-ivory normal-case">{c.surname}</span>
          </h1>
          <div className="mt-5 font-display text-[clamp(0.95rem,3vw,1.15rem)] tracking-[0.18em] text-ivory">{dateLine}</div>
          {content.hero.note && <p className="lede mt-4 italic">{content.hero.note}</p>}
          <Countdown startsAt={church.startsAt} />
          <Sprig className="-right-2 -bottom-24 rotate-180" />
        </header>
      )}

      <main className="mx-auto max-w-[760px]">
        <section id="invitation" className="pt-5 text-center">
          <div className="eyebrow">You are invited</div>
          <h2 className="display mt-2.5 text-[clamp(1.25rem,3.6vw,1.6rem)]">The Making of {c.surname}</h2>
          <p className="m-0 mt-2 font-script text-[clamp(2rem,7vw,3rem)] leading-tight">
            {c.bride} &amp; {c.groom}
          </p>
          <div className="mt-6 flex justify-center">
            <Button asChild size="lg" className="ui-caps h-12 rounded-[2px] px-7 text-[0.78rem] tracking-[0.22em]">
              <a href="/invitation">Read the invitation</a>
            </Button>
          </div>
        </section>

        <Frame id="day">
          <div className="eyebrow">Together with their families</div>
          <p className="lede mt-2">
            {cfg.families.bride}
            <br />
            and {cfg.families.groom}
          </p>
          <div className="eyebrow mt-3.5">invite you to the wedding ceremony</div>
          <div className="mt-7">
            <EventBlock ev={church} />
          </div>
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
          <h2 className="display mt-2.5 text-[clamp(1.25rem,3.6vw,1.6rem)]">The Making of {c.surname}</h2>
          <p className="mx-0 mt-2.5 mb-3.5 font-script text-[clamp(2rem,7vw,3rem)] leading-tight">
            {c.bride} &amp; {c.groom}
          </p>
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

        {hasGallery && (
          <Frame id="gallery">
            <div className="eyebrow">Gallery</div>
            <h2 className="display mt-2.5 text-[clamp(1.25rem,3.6vw,1.6rem)]">Moments so far</h2>
            <Gallery photos={content.gallery} />
          </Frame>
        )}

        <Frame id="gifts" className="bg-[linear-gradient(145deg,rgb(210_176_122/0.08),transparent_58%)]">
          <Gift className="mx-auto mb-2 size-7 stroke-[1.3] text-gold" aria-hidden />
          <div className="eyebrow">Gift registry</div>
          <h2 className="display mt-2.5 text-[clamp(1.25rem,3.6vw,1.6rem)]">Celebrate our new chapter</h2>
          <p className="lede mt-2.5">{content.giftsMessage}</p>
          {content.registryUrl ? (
            <div className="mt-6 flex justify-center">
              <Button asChild size="lg" className="ui-caps h-12 rounded-[2px] px-7 text-[0.78rem] tracking-[0.22em]">
                <a href={content.registryUrl} target="_blank" rel="noopener">
                  View our registry on Joy
                </a>
              </Button>
            </div>
          ) : null}
          {cfg.gifts.accounts.length > 0 && (
            <div className="mt-5 grid gap-2.5">
              {cfg.gifts.accounts.map((a) => (
                <div key={a.number} className="border border-gold/30 px-4 py-3">
                  <b>{a.bank}</b>
                  <br />
                  {a.name}
                  <br />
                  <span className="tabular-nums">{a.number}</span>
                </div>
              ))}
            </div>
          )}
        </Frame>

        <section className="pt-2.5 pb-5 text-center">
          <div className="eyebrow">Questions</div>
          <Contacts />
        </section>
      </main>
      <SiteFooter />
      <Dock
        items={[
          { href: '/our-story', icon: BookOpen, label: 'Our story' },
          hasGallery && { href: '#gallery', icon: Camera, label: 'Gallery' },
          content.registryUrl
            ? { href: content.registryUrl, icon: Gift, label: 'Registry', external: true }
            : { href: '#gifts', icon: Gift, label: 'Registry' },
        ]}
      />
    </>
  );
}
