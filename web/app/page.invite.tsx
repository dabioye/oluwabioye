import type { Metadata } from 'next';
import { CodeEntry } from '@/components/invite/code-entry';
import { Monogram } from '@/components/wedding/monogram';
import { Frame, Rule } from '@/components/wedding/ornaments';
import { Contacts, SiteFooter } from '@/components/wedding/site-chrome';
import { cfg } from '@/lib/config';

const c = cfg.couple;
export const metadata: Metadata = { title: `The Making of ${c.surname}`, description: 'Strictly by invitation.' };

// Front page of the invite-only site. Reveals nothing about the event to people without a code.
export default function InviteHome() {
  return (
    <>
      <main className="mx-auto max-w-[620px] pt-[clamp(32px,10vh,100px)]">
        <Frame>
          <Monogram className="text-gold motion-safe:animate-rise" />
          <Rule />
          <div className="eyebrow">Strictly by invitation</div>
          <h1 className="display mt-2.5 text-[clamp(1.7rem,5.5vw,2.6rem)]">The Making of {c.surname}</h1>
          <p className="lede mt-3.5">This celebration is private. Open the personal link we sent you, or enter your invitation code.</p>
          <CodeEntry />
        </Frame>
        <section className="pb-4 text-center">
          <div className="eyebrow">Can’t find your code?</div>
          <Contacts />
        </section>
      </main>
      <SiteFooter>
        {c.bride} &amp; {c.groom}
      </SiteFooter>
    </>
  );
}
