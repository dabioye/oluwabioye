'use client';
import { useState } from 'react';
import { CalendarPlus, CircleCheck, Loader2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Monogram } from '@/components/wedding/monogram';
import { Rule } from '@/components/wedding/ornaments';
import { Contacts, SiteFooter, SiteNav } from '@/components/wedding/site-chrome';
import { api } from '@/lib/api';
import { cfg } from '@/lib/config';
import { useSiteContent } from '@/lib/content';
import { longDate, weekday } from '@/lib/format';
import { cn } from '@/lib/utils';

const c = cfg.couple;
const church = cfg.events.church;
const field = 'h-12 bg-navy-2 font-ui text-base';
const label = 'ui-caps mb-1.5 text-[0.7rem] text-ivory-dim';

/** RSVP for the church wedding: records who is expected in church and how many are coming. */
export function RsvpView() {
  const { content } = useSiteContent();
  const { open, maxParty } = content.churchRsvp;
  const [f, setF] = useState({ name: '', phone: '', email: '', attending: 'yes' as 'yes' | 'no', party: 1, note: '', website: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ updated: boolean } | null>(null);
  const set = (k: 'name' | 'phone' | 'email' | 'note') => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((x) => ({ ...x, [k]: e.target.value }));
  const first = f.name.trim().split(/\s+/)[0];

  return (
    <>
      <SiteNav
        links={[
          { href: '/', label: 'Home' },
          { href: '/invitation', label: 'Invitation' },
          { href: '/our-story', label: 'Our Story' },
          { href: content.registryUrl || '/#gifts', label: 'Gift Registry', external: !!content.registryUrl },
        ]}
      />
      <main className="mx-auto max-w-[620px] pb-6">
        <header className="pt-[clamp(32px,8vw,64px)] text-center">
          <div className="eyebrow">RSVP</div>
          <Monogram className="mt-3 text-gold" />
          <p className="m-0 font-lavish text-[clamp(2.3rem,8vw,3.4rem)] leading-tight text-ivory">
            {c.bride} &amp; {c.groom}
          </p>
          <Rule />
          <h1 className="display m-0 text-[clamp(1.4rem,4.4vw,2rem)]">Will you be with us in church?</h1>
          <p className="lede mt-3">
            {church.name} · {weekday()} {longDate(cfg.date)} · {church.time}
            <br />
            {church.venue}, {church.venueLine2}
          </p>
        </header>

        {done ? (
          <section aria-live="polite" className="mt-8 rounded-lg border border-ok/50 bg-ok/10 p-6 text-center">
            <CircleCheck className="mx-auto size-10 text-ok" aria-hidden />
            <h2 className="mt-2 mb-0 font-display text-2xl font-medium">Thank you, {first}</h2>
            <p className="lede mt-2 mb-0">
              {f.attending === 'yes'
                ? `We look forward to seeing ${f.party > 1 ? `all ${f.party} of you` : 'you'} in church.`
                : 'We’ll miss you, and we’re grateful for your love and prayers.'}
              {done.updated ? ' We’ve updated your earlier reply.' : ''}
            </p>
            {f.attending === 'yes' && (
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <Button asChild className="ui-caps h-11 rounded-[2px] px-5 text-[0.72rem] tracking-[0.18em]">
                  <a href={church.mapUrl} target="_blank" rel="noopener">
                    <MapPin /> Directions
                  </a>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="ui-caps h-11 rounded-[2px] border-gold bg-transparent px-5 text-[0.72rem] tracking-[0.18em] text-gold hover:bg-gold/10 hover:text-gold"
                >
                  <a href={`/calendar/${church.key}.ics`}>
                    <CalendarPlus /> Add to calendar
                  </a>
                </Button>
              </div>
            )}
          </section>
        ) : !open ? (
          <p className="lede mt-8 rounded-lg border border-dashed border-gold/50 p-6 text-center italic">
            RSVP for the church wedding is closed. If you have a question, please contact Busayo or Hope.
          </p>
        ) : (
          <form
            className="mt-8 grid gap-5"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError('');
              try {
                setDone(await api<{ updated: boolean }>('/api/rsvp', { body: f }));
                scrollTo({ top: 0, behavior: 'smooth' });
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
              } finally {
                setBusy(false);
              }
            }}
          >
            <div role="radiogroup" aria-label="Will you attend?" className="grid grid-cols-2 gap-2.5">
              {(
                [
                  ['yes', 'Joyfully Accept'],
                  ['no', 'Regretfully Decline'],
                ] as const
              ).map(([v, text]) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={f.attending === v}
                  onClick={() => setF((x) => ({ ...x, attending: v }))}
                  className={cn(
                    'ui-caps min-h-12 cursor-pointer rounded-[2px] border px-3 py-3.5 text-[0.74rem] tracking-[0.16em] transition-colors',
                    f.attending === v ? 'border-gold bg-gold text-navy' : 'border-gold/50 bg-transparent text-ivory hover:border-gold',
                  )}
                >
                  {text}
                </button>
              ))}
            </div>
            <div>
              <Label htmlFor="name" className={label}>
                Your name
              </Label>
              <Input id="name" value={f.name} onChange={set('name')} maxLength={120} required autoComplete="name" className={field} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="phone" className={label}>
                  Phone / WhatsApp
                </Label>
                <Input id="phone" type="tel" value={f.phone} onChange={set('phone')} maxLength={30} autoComplete="tel" className={field} />
              </div>
              <div>
                <Label htmlFor="email" className={label}>
                  Email (optional)
                </Label>
                <Input id="email" type="email" value={f.email} onChange={set('email')} maxLength={120} autoComplete="email" className={field} />
              </div>
            </div>
            {f.attending === 'yes' && (
              <div className="sm:max-w-[50%]">
                <Label htmlFor="party" className={label}>
                  How many of you, including you?
                </Label>
                <select
                  id="party"
                  value={f.party}
                  onChange={(e) => setF((x) => ({ ...x, party: Number(e.target.value) }))}
                  className={cn(field, 'w-full rounded-md border border-input px-3 text-ivory')}
                >
                  {Array.from({ length: maxParty }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n === 1 ? 'Just me' : `${n} people`}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <Label htmlFor="note" className={label}>
                A note for {c.bride} &amp; {c.groom} (optional)
              </Label>
              <Textarea id="note" value={f.note} onChange={set('note')} rows={3} maxLength={500} className="bg-navy-2 font-body text-lg" />
            </div>
            <input
              type="text"
              name="website"
              value={f.website}
              onChange={(e) => setF((x) => ({ ...x, website: e.target.value }))}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden
              className="hidden"
            />
            {error && (
              <p role="alert" className="m-0 text-center font-ui text-sm text-bad">
                {error}
              </p>
            )}
            <div className="flex justify-center">
              <Button type="submit" size="lg" disabled={busy} className="ui-caps h-12 rounded-[2px] px-8 text-[0.76rem] tracking-[0.22em]">
                {busy && <Loader2 className="animate-spin" />} Send RSVP
              </Button>
            </div>
            <p className="m-0 text-center font-ui text-[0.78rem] text-ivory-dim">
              Add a phone number or email so we can reach you. Replying again from the same number updates your RSVP. See our{' '}
              <a href="/privacy" className="text-gold">
                privacy policy
              </a>
              .
            </p>
          </form>
        )}

        <section className="pt-10 text-center">
          <div className="eyebrow">Questions</div>
          <Contacts />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
