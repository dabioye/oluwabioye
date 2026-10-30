'use client';
import { useEffect, useState } from 'react';
import { CircleCheck, Heart, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Frame } from '@/components/wedding/ornaments';
import { api } from '@/lib/api';
import { cfg } from '@/lib/config';
import type { PublicWish } from '@/lib/types';

const c = cfg.couple;
const label = 'ui-caps mb-1.5 text-[0.7rem] text-ivory-dim';
const SHOWN = 6;

/** Wishes for the couple: the approved ones, then a form to leave one (it shows once Sarah or Damilare approve it). */
export function Wishes() {
  const [wishes, setWishes] = useState<PublicWish[] | null>(null);
  const [all, setAll] = useState(false);
  const [f, setF] = useState({ name: '', message: '', website: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  useEffect(() => {
    api<{ wishes: PublicWish[] }>('/api/wishes').then(
      (r) => setWishes(r.wishes),
      () => setWishes([]),
    );
  }, []);

  const list = wishes ?? [];
  const shown = all ? list : list.slice(0, SHOWN);

  return (
    <Frame id="wishes">
      <Heart className="mx-auto mb-2 size-7 stroke-[1.3] text-gold" aria-hidden />
      <div className="eyebrow">Wishes</div>
      <h2 className="display mt-2.5 text-[clamp(1.25rem,3.6vw,1.6rem)]">Leave a wish for the couple</h2>
      <p className="lede mt-2.5">
        A prayer, a blessing or a few kind words for {c.bride} &amp; {c.groom}. Messages appear here once they have read them.
      </p>

      {shown.length > 0 && (
        <ul className="mx-auto mt-7 grid max-w-[620px] list-none gap-3 p-0 text-left">
          {shown.map((w) => (
            <li key={w.id} className="border border-gold/25 bg-navy-2/40 px-5 py-4">
              <p className="m-0 text-lg leading-snug whitespace-pre-line text-ivory">{w.message}</p>
              <p className="ui-caps mt-2.5 mb-0 text-[0.68rem] tracking-[0.18em] text-gold">{w.name}</p>
            </li>
          ))}
        </ul>
      )}
      {list.length > SHOWN && !all && (
        <Button type="button" variant="ghost" onClick={() => setAll(true)} className="ui-caps mt-3 h-10 text-[0.72rem] text-gold hover:text-gold">
          See all {list.length} wishes
        </Button>
      )}

      {done ? (
        <div aria-live="polite" className="mx-auto mt-8 max-w-[480px] rounded-lg border border-ok/50 bg-ok/10 p-5">
          <CircleCheck className="mx-auto size-8 text-ok" aria-hidden />
          <p className="mt-2 mb-0 font-display text-xl font-medium">Thank you, {done}</p>
          <p className="lede mt-1.5 mb-0">
            Your wish will appear here once {c.bride} or {c.groom} have read it.
          </p>
        </div>
      ) : (
        <form
          className="mx-auto mt-8 grid max-w-[480px] gap-4 text-left"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            try {
              await api('/api/wishes', { body: f });
              setDone(f.name.trim().split(/\s+/)[0]);
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <div>
            <Label htmlFor="wish-name" className={label}>
              Your name
            </Label>
            <Input
              id="wish-name"
              value={f.name}
              onChange={(e) => setF((x) => ({ ...x, name: e.target.value }))}
              maxLength={80}
              required
              autoComplete="name"
              className="h-12 bg-navy-2 font-ui text-base"
            />
          </div>
          <div>
            <Label htmlFor="wish-message" className={label}>
              Your wish
            </Label>
            <Textarea
              id="wish-message"
              value={f.message}
              onChange={(e) => setF((x) => ({ ...x, message: e.target.value }))}
              rows={4}
              maxLength={600}
              required
              placeholder={`Congratulations, ${c.bride} & ${c.groom}!`}
              className="bg-navy-2 font-body text-lg"
            />
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
            <Button type="submit" size="lg" disabled={busy} className="ui-caps h-12 rounded-[2px] px-7 text-[0.76rem] tracking-[0.22em]">
              {busy ? <Loader2 className="animate-spin" /> : <Send />} Send your wish
            </Button>
          </div>
        </form>
      )}
    </Frame>
  );
}
