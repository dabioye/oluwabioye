'use client';
import { useEffect, useState } from 'react';
import { CreditCard, Mail, MapPin, ScrollText } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { AccessCard } from '@/components/wedding/access-card';
import { EventBlock } from '@/components/wedding/event-block';
import { Intro } from '@/components/wedding/intro';
import { InvitationArt } from '@/components/wedding/invitation-art';
import { Monogram } from '@/components/wedding/monogram';
import { Frame, Rule, Sprig } from '@/components/wedding/ornaments';
import { Contacts, Dock, SiteFooter } from '@/components/wedding/site-chrome';
import { api, ApiError } from '@/lib/api';
import { codeFromPath } from '@/lib/code';
import { cfg } from '@/lib/config';
import { longDate, weekday } from '@/lib/format';
import { forget, recall, remember, useRemembered } from '@/lib/remember';
import type { InviteData, InviteGuest } from '@/lib/types';
import { RsvpForm } from './rsvp-form';

const c = cfg.couple;
const trad = cfg.events.trad;

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
        <p className="ui-caps m-0 text-[0.7rem] tracking-[0.25em] text-gold">The making of {c.surname}</p>
        <span className="eyebrow !text-ivory">An invitation for</span>
        <span className="min-h-[1.3em] font-script text-[clamp(2.2rem,9vw,3.2rem)] leading-tight text-gold-bright [text-shadow:0_2px_10px_rgb(0_0_0/0.6)]">
          {guest ? guest.name : 'you'}
        </span>
      </Intro>

      <main className="mx-auto max-w-[760px]">
        {state.kind === 'loading' && <LoadingInvite />}
        {state.kind === 'error' && <InviteError message={state.message} />}
        {data && guest && (
          <>
            <section id="invitation" className="pt-[clamp(20px,5vw,40px)] text-center">
              <InvitationArt
                src={data.invite.art}
                name={guest.name}
                slot={data.invite.nameSlot}
                alt={`Invitation for ${guest.name} to The Making of ${c.surname}, traditional wedding, ${longDate(cfg.date)}, ${trad.time}, ${trad.venue}.`}
              />
            </section>

            <Frame id="details" className="overflow-hidden">
              <Sprig className="top-0 -left-2" />
              <Monogram className="text-gold" />
              <div className="ui-caps mt-1.5 text-[0.95rem] tracking-[0.4em] text-ivory">
                {c.bride} &nbsp;+&nbsp; {c.groom}
              </div>
              <Rule />
              <div className="eyebrow">Cordially invite</div>
              <p className="my-2 font-script text-[clamp(2rem,7vw,3rem)] leading-tight">{guest.name}</p>
              <div className="eyebrow">to</div>
              <div className="eyebrow mt-3.5">The making of</div>
              <h1 className="display text-[clamp(2.4rem,9vw,4.6rem)]">{c.surname}</h1>
              <p className="lede mt-4">
                Together with their families,
                <br />
                {cfg.families.bride}
                <br />
                and {cfg.families.groom}
              </p>
              <div className="mt-2.5 font-display tracking-[0.18em]">
                {weekday()} · {longDate(cfg.date)}
              </div>
              <div className="mt-7">
                {guest.events.map((k) => (
                  <EventBlock key={k} ev={cfg.events[k]} />
                ))}
              </div>
              <ul className="mx-auto mt-5 grid max-w-[34em] list-none gap-3 p-0 text-left">
                {data.invite.notes.map((n) => (
                  <li key={n} className="grid grid-cols-[20px_1fr] gap-2.5 before:pt-1.5 before:text-[0.8rem] before:text-gold before:content-['✦']">
                    {n}
                  </li>
                ))}
              </ul>
              <div className="eyebrow mt-6">Colours of the day · {cfg.colours.map((x) => x.name).join(' & ')}</div>
            </Frame>

            <Frame id="respond">
              <h2 className="display mb-3 text-[clamp(1.25rem,3.6vw,1.6rem)]">
                {guest.rsvp === 'pending' ? `Will you join us, ${guest.name.split(/\s+/)[0]}?` : 'Your RSVP'}
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
        <div className="eyebrow">Kindly respond by {longDate(rsvpBy)}</div>
        <RsvpForm guest={guest} onSubmit={save} />
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
