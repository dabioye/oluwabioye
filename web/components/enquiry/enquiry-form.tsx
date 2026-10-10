'use client';
import { useState } from 'react';
import { CircleCheck, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { EVENTS, FEATURES } from '@/lib/leads';
import { cn } from '@/lib/utils';

const CONTACT = ['WhatsApp', 'Phone call', 'Email'] as const;
const field = 'h-12 bg-navy-2 font-ui text-base';
const label = 'ui-caps mb-1.5 text-[0.7rem] text-ivory-dim';

function Chip({ on, children, onClick, role = 'radio' }: { on: boolean; children: React.ReactNode; onClick: () => void; role?: 'radio' | 'checkbox' }) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={on}
      onClick={onClick}
      className={cn(
        'cursor-pointer rounded-full border px-4 py-2.5 font-ui text-[0.88rem] transition-colors',
        on ? 'border-gold bg-gold text-navy' : 'border-gold/40 bg-transparent text-ivory hover:border-gold',
      )}
    >
      {children}
    </button>
  );
}

/** The enquiry: who they are, the event, what they'd like on the site. Sent to the team by email. */
export function EnquiryForm() {
  const [f, setF] = useState({
    name: '',
    email: '',
    phone: '',
    contactBy: 'WhatsApp',
    event: '',
    otherEvent: '',
    date: '',
    location: '',
    guests: '',
    features: [] as string[],
    budget: '',
    details: '',
    website: '', // bot trap: hidden from people
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  if (done)
    return (
      <section aria-live="polite" className="mt-10 rounded-lg border border-ok/50 bg-ok/10 p-6 text-center">
        <CircleCheck className="mx-auto size-10 text-ok" aria-hidden />
        <h2 className="mt-2 mb-0 font-display text-2xl font-medium">Thank you, {f.name.split(/\s+/)[0]}</h2>
        <p className="lede mt-2 mb-0">
          We’ve received your enquiry and will be in touch soon{f.contactBy ? ` by ${f.contactBy.toLowerCase()}` : ''}.
          {f.email ? ' A copy is on its way to your inbox.' : ''}
        </p>
      </section>
    );

  return (
    <form
      className="mt-9 grid gap-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
          await api('/api/leads', { body: { ...f, from: location.hostname } });
          setDone(true);
          scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset className="grid gap-3">
        <legend className={label}>What are you celebrating?</legend>
        <div role="radiogroup" aria-label="Kind of event" className="flex flex-wrap gap-2">
          {EVENTS.map((ev) => (
            <Chip key={ev} on={f.event === ev} onClick={() => setF((x) => ({ ...x, event: ev }))}>
              {ev === 'Other' ? 'Other (tell us)' : ev}
            </Chip>
          ))}
        </div>
        {f.event === 'Other' && (
          <div>
            <Label htmlFor="otherEvent" className={label}>
              What’s the event?
            </Label>
            <Input
              id="otherEvent"
              value={f.otherEvent}
              onChange={set('otherEvent')}
              maxLength={120}
              placeholder="e.g. 50th anniversary, house warming"
              className={field}
            />
          </div>
        )}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="date" className={label}>
            Event date
          </Label>
          <Input id="date" type="date" value={f.date} onChange={set('date')} className={field} />
        </div>
        <div>
          <Label htmlFor="location" className={label}>
            Location
          </Label>
          <Input id="location" value={f.location} onChange={set('location')} maxLength={160} placeholder="City or venue" className={field} />
        </div>
        <div>
          <Label htmlFor="guests" className={label}>
            Expected guests
          </Label>
          <Input id="guests" type="number" min={0} inputMode="numeric" value={f.guests} onChange={set('guests')} placeholder="e.g. 200" className={field} />
        </div>
      </div>

      <fieldset className="grid gap-3">
        <legend className={label}>What would you like on your site?</legend>
        <div className="flex flex-wrap gap-2">
          {FEATURES.map((ft) => (
            <Chip
              key={ft}
              role="checkbox"
              on={f.features.includes(ft)}
              onClick={() => setF((x) => ({ ...x, features: x.features.includes(ft) ? x.features.filter((y) => y !== ft) : [...x.features, ft] }))}
            >
              {ft}
            </Chip>
          ))}
        </div>
      </fieldset>

      <div>
        <Label htmlFor="details" className={label}>
          Tell us about your event
        </Label>
        <Textarea
          id="details"
          value={f.details}
          onChange={set('details')}
          rows={4}
          maxLength={3000}
          placeholder="Who it’s for, the style or colours you have in mind, anything else we should know"
          className="bg-navy-2 font-body text-lg"
        />
      </div>
      <div className="sm:max-w-[50%]">
        <Label htmlFor="budget" className={label}>
          Budget (optional)
        </Label>
        <Input id="budget" value={f.budget} onChange={set('budget')} maxLength={80} placeholder="A rough figure or range" className={field} />
      </div>

      <fieldset className="grid gap-4 border-t border-hairline-soft pt-6">
        <legend className="sr-only">Your details</legend>
        <div>
          <Label htmlFor="name" className={label}>
            Your name
          </Label>
          <Input id="name" value={f.name} onChange={set('name')} maxLength={120} required autoComplete="name" className={field} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="email" className={label}>
              Email
            </Label>
            <Input id="email" type="email" value={f.email} onChange={set('email')} maxLength={160} autoComplete="email" className={field} />
          </div>
          <div>
            <Label htmlFor="phone" className={label}>
              Phone / WhatsApp
            </Label>
            <Input id="phone" type="tel" value={f.phone} onChange={set('phone')} maxLength={40} autoComplete="tel" className={field} />
          </div>
        </div>
        <div className="grid gap-2">
          <span id="contact-label" className={label}>
            Best way to reach you
          </span>
          <div role="radiogroup" aria-labelledby="contact-label" className="flex flex-wrap gap-2">
            {CONTACT.map((c) => (
              <Chip key={c} on={f.contactBy === c} onClick={() => setF((x) => ({ ...x, contactBy: c }))}>
                {c}
              </Chip>
            ))}
          </div>
        </div>
      </fieldset>

      <input type="text" name="website" value={f.website} onChange={set('website')} tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />

      {error && (
        <p role="alert" className="m-0 text-center font-ui text-sm text-bad">
          {error}
        </p>
      )}
      <div className="flex justify-center">
        <Button type="submit" size="lg" disabled={busy} className="ui-caps h-12 rounded-[2px] px-8 text-[0.76rem] tracking-[0.22em]">
          {busy ? <Loader2 className="animate-spin" /> : <Send />} Send enquiry
        </Button>
      </div>
      <p className="m-0 text-center font-ui text-[0.78rem] text-ivory-dim">
        We only use these details to reply to you. See our{' '}
        <a href="/privacy" className="text-gold">
          privacy policy
        </a>
        .
      </p>
    </form>
  );
}
