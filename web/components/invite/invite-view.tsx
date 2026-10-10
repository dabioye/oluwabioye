'use client';
import { useEffect, useState } from 'react';
import { CalendarPlus, CreditCard, Mail, MapPin, ScrollText } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AccessCard } from '@/components/wedding/access-card';
import { EventDetails } from '@/components/wedding/event-details';
import { Intro } from '@/components/wedding/intro';
import { InvitationArt } from '@/components/wedding/invitation-art';
import { Monogram } from '@/components/wedding/monogram';
import { Frame, Rule } from '@/components/wedding/ornaments';
import { Contacts, Dock, SiteFooter, SiteNav } from '@/components/wedding/site-chrome';
import { Wordmark } from '@/components/wedding/wordmark';
import { api, ApiError } from '@/lib/api';
import { codeFromPath } from '@/lib/code';
import { cfg } from '@/lib/config';
import { longDate } from '@/lib/format';
import { forget, recall, remember, useRemembered } from '@/lib/remember';
import type { InviteData, InviteGuest } from '@/lib/types';
import { RsvpForm } from './rsvp-form';

const c = cfg.couple;
const trad = cfg.events.trad;
const church = cfg.events.church;

type State = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; data: InviteData };

function useInvite() {
  const [state, setState] = useState<State>({ kind: 'loading' });
  useEffect(() => {
    const code = codeFromPath(location.pathname) || new URLSearchParams(location.search).get('code') || '';
    if (!code) {
      location.replace('/');
      return;
    }
    api<InviteData>(`/api/invite/${encodeURIComponent(code)}`)
      .then((data) => {
        setState({ kind: 'ready', data });
        document.title = `Invitation for ${data.guest.name} · ${c.bride} & ${c.groom}`;
        // Keep the remembered name fresh so the front page can greet them next time.
        if (recall()?.code === data.guest.code) remember({ code: data.guest.code, name: data.guest.name });
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404 && recall()?.code === code) forget();
        setState({
          kind: 'error',
          message: e instanceof ApiError ? e.message : 'We couldn’t load your invitation. Please check your connection and try again.',
        });
      });
  }, []);
  return [state, setState] as const;
}

export function InviteView() {
  const [state, setState] = useInvite();
  const data = state.kind === 'ready' ? state.data : null;
  const guest = data?.guest;

  function updateGuest(g: InviteGuest) {
    if (state.kind === 'ready') setState({ kind: 'ready', data: { ...state.data, guest: g } });
  }

  return (
    <>
      <Intro storageKey="invite" enabled={state.kind !== 'error' && data?.invite.intro !== false}>
        <p className="ui-caps m-0 text-[0.78rem] tracking-[0.3em] text-gold [text-shadow:0_2px_8px_rgb(0_0_0/0.7)]">The Making of</p>
        <Wordmark embossed className="w-[min(80vw,440px)] [filter:drop-shadow(0_3px_10px_rgb(0_0_0/0.55))]" />
        <span className="eyebrow mt-2 !text-ivory">An invitation for</span>
        <span className="min-h-[1.3em] font-script text-[clamp(2.2rem,9vw,3.2rem)] leading-tight text-gold-bright [text-shadow:0_2px_10px_rgb(0_0_0/0.6)]">
          {guest ? guest.name : 'you'}
        </span>
      </Intro>

      {data && guest && (
        <SiteNav
          links={[
            { href: '#respond', label: 'RSVP' },
            { href: `${data.publicUrl}/our-story`, label: 'Our Story', external: true },
            { href: data.invite.registryUrl || `${data.publicUrl}/invitation#gifts`, label: 'Gift Registry', external: true },
          ]}
        />
      )}
      <main className="mx-auto max-w-[760px]">
        {state.kind === 'loading' && <LoadingInvite />}
        {state.kind === 'error' && <InviteError message={state.message} />}
        {data && guest && (
          <>
            <h1 className="sr-only">
              {c.bride} and {c.groom} invite {guest.name} to The Making of {c.surname}
            </h1>

            {/* The RSVP comes first: it's what a guest opening the seal needs to do. */}
            <Frame id="respond" className="mt-[clamp(12px,3vw,24px)] scroll-mt-16">
              <h2 className="display mb-3 text-[clamp(1.25rem,3.6vw,1.6rem)] tracking-[0.18em] uppercase">
                {guest.rsvp === 'pending' ? 'Send RSVP' : 'Your RSVP'}
              </h2>
              <RsvpBlock
                guest={guest}
                qrSvg={data.qrSvg}
                rsvpBy={data.invite.rsvpBy}
                onSaved={(g) => {
                  updateGuest(g);
                  toast.success(g.rsvp === 'yes' ? 'Thank you! Your access card is ready below.' : 'Thank you for letting us know.');
                  if (g.rsvp === 'yes') setTimeout(() => document.getElementById('card')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
                }}
              />
            </Frame>

            <section id="invitation" className="scroll-mt-4 pt-[clamp(16px,4vw,32px)] text-center">
              <InvitationArt
                src={data.invite.art}
                name={guest.name}
                slot={data.invite.nameSlot}
                font={data.invite.nameFont}
                code={guest.code}
                codeSlot={data.invite.codeSlot}
                alt={`Invitation for ${guest.name}, access code ${guest.code}: The Making of ${c.surname}, traditional wedding, strictly by invitation, ${longDate(cfg.date)}, ${trad.time}, ${trad.venue}. No children allowed.`}
              />
            </section>

            <EventDetails ev={trad} date={cfg.date}>
              <Button asChild size="lg" className="ui-caps h-12 rounded-[2px] px-7 text-[0.74rem] tracking-[0.2em]">
                <a href={trad.mapUrl} target="_blank" rel="noopener">
                  <MapPin /> Directions
                </a>
              </Button>
            </EventDetails>

            {guest.events.includes('church') && (
              <EventDetails ev={church} date={cfg.date} className="mt-10 border-t border-hairline-soft pt-9">
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
            )}

            <p className="text-center">
              <a href={data.publicUrl} className="ui-caps text-[0.74rem] no-underline hover:underline">
                Visit our wedding website
              </a>
            </p>
            <NotYou code={guest.code} />
          </>
        )}
      </main>
      <SiteFooter>Questions? {cfg.contacts.map((p) => `${p.name} ${p.phone}`).join(' · ')}</SiteFooter>
      {guest && (
        <Dock
          items={[
            { href: '#invitation', icon: ScrollText, label: 'Invitation' },
            { href: '#respond', icon: Mail, label: guest.rsvp === 'pending' ? 'RSVP' : 'My RSVP' },
            guest.rsvp === 'yes' && { href: '#card', icon: CreditCard, label: 'Access card' },
            { href: trad.mapUrl, icon: MapPin, label: 'Directions', external: true },
          ]}
        />
      )}
    </>
  );
}

function RsvpBlock({ guest, qrSvg, rsvpBy, onSaved }: { guest: InviteGuest; qrSvg: string; rsvpBy: string; onSaved: (g: InviteGuest) => void }) {
  const [changing, setChanging] = useState(false);
  const save = async (response: 'yes' | 'no', note: string) => {
    const r = await api<{ guest: InviteGuest }>(`/api/invite/${guest.code}/rsvp`, { body: { response, note } });
    setChanging(false);
    onSaved(r.guest);
  };

  if (guest.rsvp === 'pending')
    return (
      <>
        <p className="lede mx-auto mt-1 max-w-[30em]">Dear {guest.name.split(/\s+/)[0]}, will you join us?</p>
        <div className="eyebrow mt-3">Kindly respond by {longDate(rsvpBy)}</div>
        <RsvpForm guest={guest} onSubmit={save} footnote="Your response helps us properly plan for you as our most esteemed guest." />
      </>
    );

  return (
    <>
      <span
        className={`inline-block rounded-full px-3 py-2 font-ui text-[0.72rem] font-semibold tracking-[0.2em] uppercase ${guest.rsvp === 'yes' ? 'bg-ok/15 text-ok' : 'bg-bad/15 text-bad'}`}
      >
        {guest.rsvp === 'yes' ? 'Attending' : 'Not attending'}
      </span>
      {guest.rsvp === 'yes' ? (
        <>
          <p className="lede mt-3.5">You’re on the list. Save this card to your phone (a screenshot works) and show it at the entrance.</p>
          <div id="card" className="scroll-mt-24">
            <AccessCard name={guest.name} code={guest.code} qrSvg={qrSvg} />
          </div>
          {guest.driverCard && <AccessCard name={guest.name} code={guest.code} driver />}
        </>
      ) : (
        <p className="lede mt-3.5">We’ll miss you, and thank you for letting us know.</p>
      )}
      <div className="mt-6">
        {changing ? (
          <RsvpForm guest={guest} onSubmit={save} onCancel={() => setChanging(false)} />
        ) : (
          <button
            type="button"
            onClick={() => setChanging(true)}
            className="ui-caps cursor-pointer border-0 bg-transparent text-[0.74rem] text-ivory-dim underline-offset-4 hover:text-gold hover:underline"
          >
            Change my response
          </button>
        )}
      </div>
    </>
  );
}

function NotYou({ code }: { code: string }) {
  const known = useRemembered();
  if (known?.code !== code) return null;
  return (
    <p className="mt-2 text-center font-ui text-[0.8rem] text-ivory-dim">
      Remembered on this device.{' '}
      <button
        type="button"
        className="cursor-pointer border-0 bg-transparent p-0 text-gold underline-offset-4 hover:underline"
        onClick={() => {
          forget();
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          location.assign('/');
        }}
      >
        Not you? Use a different code
      </button>
    </p>
  );
}

function LoadingInvite() {
  return (
    <div className="grid justify-items-center gap-4 pt-10" aria-busy="true" aria-label="Loading your invitation">
      <Skeleton className="aspect-[600/1010] w-full max-w-[460px] rounded-[4px] bg-navy-2" />
      <Skeleton className="h-6 w-56 bg-navy-2" />
      <Skeleton className="h-4 w-72 bg-navy-2" />
    </div>
  );
}

function InviteError({ message }: { message: string }) {
  return (
    <div className="pt-[clamp(32px,10vh,100px)]">
      <Frame>
        <Monogram className="w-24 text-gold" />
        <Rule />
        <h1 className="display text-2xl">Invitation not found</h1>
        <p className="lede mt-3">{message}</p>
        <a href="/" className="ui-caps mt-4 inline-block text-[0.74rem]">
          Enter your invitation code
        </a>
      </Frame>
      <section className="text-center">
        <div className="eyebrow">Need help?</div>
        <Contacts />
      </section>
    </div>
  );
}
