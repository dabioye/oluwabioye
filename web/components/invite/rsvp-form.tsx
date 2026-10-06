'use client';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import type { InviteGuest } from '@/lib/types';
import { cn } from '@/lib/utils';

const CHOICES = [
  { value: 'yes', label: 'Joyfully accept' },
  { value: 'no', label: 'Regretfully decline' },
] as const;

/** Accept / decline with an optional note for the couple. */
export function RsvpForm({
  guest,
  onSubmit,
  onCancel,
}: {
  guest: InviteGuest;
  onSubmit: (r: 'yes' | 'no', note: string) => Promise<void>;
  onCancel?: () => void;
}) {
  const [response, setResponse] = useState<'yes' | 'no'>(guest.rsvp === 'no' ? 'no' : 'yes');
  const [note, setNote] = useState(guest.rsvpNote || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  return (
    <form
      className="mx-auto mt-4 max-w-[420px] text-left"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
          await onSubmit(response, note);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <RadioGroup value={response} onValueChange={(v) => setResponse(v as 'yes' | 'no')} aria-label="Your response" className="my-4 grid grid-cols-2 gap-2.5">
        {CHOICES.map((c) => (
          <Label
            key={c.value}
            htmlFor={`rsvp-${c.value}`}
            className={cn(
              'ui-caps flex min-h-12 cursor-pointer items-center justify-center rounded-[2px] border border-gold/40 px-2.5 py-3.5 text-center text-[0.74rem] leading-snug tracking-[0.14em] text-ivory transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold/60',
              response === c.value && 'border-gold bg-gold text-navy',
            )}
          >
            <RadioGroupItem id={`rsvp-${c.value}`} value={c.value} className="sr-only" />
            {c.label}
          </Label>
        ))}
      </RadioGroup>
      <Label htmlFor="note" className="ui-caps mb-1.5 text-[0.7rem] text-ivory-dim">
        A note for the couple (optional)
      </Label>
      <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} className="bg-navy-2 font-body text-lg" />
      {error && (
        <p role="alert" className="mt-2.5 font-ui text-sm text-bad">
          {error}
        </p>
      )}
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} className="ui-caps h-12 text-[0.74rem]">
            Cancel
          </Button>
        )}
        <Button type="submit" size="lg" disabled={busy} className="ui-caps h-12 rounded-[2px] px-8 text-[0.76rem] tracking-[0.22em]">
          {busy && <Loader2 className="animate-spin" />} Send RSVP
        </Button>
      </div>
    </form>
  );
}
