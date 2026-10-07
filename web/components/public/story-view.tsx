'use client';
import { Button } from '@/components/ui/button';
import { Monogram } from '@/components/wedding/monogram';
import { Wordmark } from '@/components/wedding/wordmark';
import { Frame, Rule } from '@/components/wedding/ornaments';
import { PaperPage } from '@/components/wedding/paper';
import { SiteFooter, SiteNav } from '@/components/wedding/site-chrome';
import { cfg } from '@/lib/config';
import { useSiteContent } from '@/lib/content';
import { longDate } from '@/lib/format';
import { StoryTimeline } from './story';

const c = cfg.couple;

export function StoryView() {
  const { content } = useSiteContent();
  return (
    <PaperPage>
      <SiteNav
        links={[
          { href: '/', label: 'Home' },
          { href: '/invitation', label: 'Invitation' },
          { href: '/#gifts', label: 'Gift Registry' },
        ]}
      />
      <main className="mx-auto max-w-[900px]">
        <header className="relative overflow-hidden px-4 pt-[clamp(34px,8vw,72px)] pb-[clamp(38px,8vw,76px)] text-center">
          <div className="eyebrow">Our story</div>
          <Monogram className="mt-3 mb-1 text-[#16243d]" />
          <p className="m-0 font-lavish text-[clamp(2.3rem,8vw,3.4rem)] leading-tight text-[#82663d]">
            {c.bride} &amp; {c.groom}
          </p>
          <Rule />
          <h1 className="m-0 grid justify-items-center gap-3 font-display text-[clamp(1.2rem,4.4vw,2rem)] leading-tight font-medium tracking-[0.2em] text-[#82663d] uppercase">
            The Making of
            <Wordmark className="w-[min(86vw,620px)] text-[#16243d]" />
          </h1>
          <p className="mx-0 mt-5 mb-0 text-[clamp(1.2rem,4vw,1.55rem)] leading-snug text-muted-foreground italic">Two lives. Two families. One new chapter.</p>
        </header>

        <Frame className="mx-auto max-w-[720px]">
          <div className="eyebrow">A beginning, together</div>
          <p className="lede mt-5 text-[clamp(1.15rem,3.4vw,1.42rem)]">
            Every union carries a story larger than the day itself. The Making of Oluwabioye celebrates Sarah and Damilare, the families who shaped them, and
            the future they begin together.
          </p>
          <p className="lede mt-5 text-[clamp(1.15rem,3.4vw,1.42rem)]">
            On {longDate(cfg.date)}, we gather in Lagos to witness this new chapter and celebrate all that brought us here.
          </p>
          <StoryTimeline moments={content.story} />
          <p className="mx-0 mt-8 mb-0 font-lavish text-[clamp(2.3rem,8vw,3.4rem)] leading-tight text-[#82663d]">
            With love,
            <br />
            {c.bride} &amp; {c.groom}
          </p>
        </Frame>

        <section className="px-3 pt-4 pb-14 text-center">
          <div className="eyebrow">Join us for the celebration</div>
          <p className="lede mt-2">{longDate(cfg.date)} · Lagos, Nigeria</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="ui-caps h-12 rounded-[2px] px-6 text-[0.74rem] tracking-[0.2em]">
              <a href="/invitation">View the invitation</a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="ui-caps h-12 rounded-[2px] border-[#16243d] bg-transparent px-6 text-[0.74rem] tracking-[0.2em] text-[#16243d] hover:bg-[#16243d]/5"
            >
              <a href="/">Back to the wedding</a>
            </Button>
          </div>
        </section>
      </main>
      <SiteFooter />
    </PaperPage>
  );
}
