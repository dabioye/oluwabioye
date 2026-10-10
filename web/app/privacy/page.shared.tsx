import type { Metadata } from 'next';
import { Monogram } from '@/components/wedding/monogram';
import { Rule } from '@/components/wedding/ornaments';
import { Contacts, SiteFooter } from '@/components/wedding/site-chrome';
import { cfg } from '@/lib/config';
import { longDate } from '@/lib/format';

const c = cfg.couple;
const UPDATED = '10 October 2026';

export const metadata: Metadata = {
  title: `Privacy policy · ${c.bride} & ${c.groom}`,
  description: `How ${c.bride} and ${c.groom} use guests’ information for their wedding invitations, RSVPs and WhatsApp messages.`,
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-9">
      <h2 className="m-0 font-display text-[clamp(1.15rem,3.4vw,1.35rem)] font-medium tracking-wide text-gold">{title}</h2>
      <div className="mt-3 grid gap-3 text-ivory-dim [&_b]:font-medium [&_b]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_ul]:m-0 [&_ul]:grid [&_ul]:gap-1.5 [&_ul]:p-0">
        {children}
      </div>
    </section>
  );
}

// Plain, server-rendered page (readable without JavaScript) so Meta's reviewers and crawler can read it.
export default function Privacy() {
  return (
    <>
      <main className="mx-auto max-w-[720px] pt-[clamp(32px,8vw,64px)] text-[1.08rem] leading-relaxed">
        <header className="text-center">
          <Monogram className="mx-auto w-20 text-gold" />
          <Rule />
          <h1 className="display m-0 text-[clamp(1.6rem,5vw,2.3rem)]">Privacy policy</h1>
          <p className="mt-2 font-ui text-[0.8rem] tracking-[0.1em] text-ivory-dim uppercase">Last updated {UPDATED}</p>
        </header>

        <p className="mt-8 text-ivory-dim">
          This policy covers the wedding websites of {c.brideFull.split(' ')[0]} {c.bride} and {c.groomFull.split(' ')[0]} {c.groom} (
          <b className="font-medium text-foreground">sarahanddamilare.dabioye.com</b> and <b className="font-medium text-foreground">oluwabioye.dabioye.com</b>
          ), and the WhatsApp messages we send from our WhatsApp Business number about our wedding on {longDate(cfg.date)}. It is a private, non-commercial
          event: we use your information only to invite you, receive your RSVP and welcome you on the day. We never sell it, share it for advertising or use it
          for marketing anything.
        </p>

        <Section title="What we keep about guests">
          <ul>
            <li>
              <b>Your details</b> as we entered them on our guest list: name, phone number, email (if given), which events you are invited to, and notes such as
              your table or a driver’s meal card.
            </li>
            <li>
              <b>Your invitation code</b>, and when your invitation was sent, delivered, read and opened.
            </li>
            <li>
              <b>Your RSVP</b> and any note you write with it.
            </li>
            <li>
              <b>WhatsApp messages</b> between you and our WhatsApp Business number, including your replies.
            </li>
            <li>
              <b>Your arrival</b>, when ushers scan your access card at the gate.
            </li>
          </ul>
        </Section>

        <Section title="What the websites record">
          <ul>
            <li>
              If you tick <b>Remember me on this device</b>, your invitation code is kept in your own browser so the invitation opens straight away. “Not you?”
              on the invitation clears it.
            </li>
            <li>
              To stop people guessing invitation codes, wrong codes are counted against a scrambled (hashed) form of your internet address for 15 minutes. The
              address itself is not stored.
            </li>
            <li>
              The only cookie is a sign-in cookie for the couple and the ushers. Guests don’t get cookies, and there are no analytics, advertising or tracking
              tools.
            </li>
          </ul>
        </Section>

        <Section title="If you ask us to build your event site">
          <p className="m-0">
            The <b>Let Us Create Your Own Event Site</b> form sends us your name, contact details and what you tell us about your event, by email. We keep it
            only to reply to you and discuss your site, and delete it on request.
          </p>
        </Section>

        <Section title="Who handles it for us">
          <ul>
            <li>
              <b>Google Firebase</b> hosts the websites and stores the guest list and messages (in Google’s European data centres).
            </li>
            <li>
              <b>Meta (WhatsApp)</b> delivers the WhatsApp messages and tells us whether they were delivered and read. WhatsApp’s own privacy policy applies to
              your use of WhatsApp.
            </li>
            <li>
              Links to <b>Google Maps</b>, calendar files and our <b>gift registry</b> open those services, which have their own privacy policies.
            </li>
          </ul>
          <p className="m-0">Only the couple and the people helping us plan the wedding can see the guest list, RSVPs and messages.</p>
        </Section>

        <Section title="How long we keep it">
          <p className="m-0">
            We keep it only to organise and host the wedding, and delete the guest list, RSVPs and WhatsApp messages within three months after{' '}
            {longDate(cfg.date)}.
          </p>
        </Section>

        <Section title="Your choices, and deleting your data">
          <p className="m-0">
            You can ask us at any time to show, correct or delete what we hold about you, or to stop sending you WhatsApp messages (or just reply “Stop” to our
            WhatsApp number). Message Busayo or Hope below and we will do it within 7 days. Deleting your details also cancels your invitation link and access
            card.
          </p>
        </Section>

        <Section title="Contact">
          <p className="m-0">For any question about this policy or your information:</p>
        </Section>
        <div className="mt-2">
          <Contacts />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
