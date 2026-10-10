'use client';
import { useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cfg } from '@/lib/config';
import type { InviteGuest } from '@/lib/types';

/**
 * The answer, then an optional note for the couple (it reaches their inbox). "Joyfully Accept" sends at once,
 * with the note if one was written; "Regretfully Decline" sends the note as the reason, so it asks for one first.
 */
export function RsvpForm({
  guest,
  onSubmit,
  onCancel,
  footnote,
}: {
  guest: InviteGuest;
  onSubmit: (r: 'yes' | 'no', note: string) => Promise<void>;
  onCancel?: () => void;
  /** A short line under the note box. */
  footnote?: string;
}) {
  const [note, setNote] = useState(guest.rsvpNote || '');
  const [busy, setBusy] = useState<'yes' | 'no' | null>(null);
  const [error, setError] = useState('');
  const box = useRef<HTMLTextAreaElement>(null);

  async function send(response: 'yes' | 'no') {
    if (response === 'no' && !note.trim()) {
      setError('Kindly tell us why in the note below, then tap Regretfully Decline.');
      box.current?.focus();
      return;
    }
    setBusy(response);
    setError('');
    try {
      await onSubmit(response, note.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <form className="mx-auto mt-5 max-w-[440px] text-left" onSubmit={(e) => e.preventDefault()}>
      <div className="grid grid-cols-2 gap-2.5">
        <Button
          type="button"
          size="lg"
          disabled={!!busy}
          onClick={() => send('yes')}
          className="ui-caps h-auto min-h-12 rounded-[2px] px-3 py-3.5 text-[0.74rem] leading-snug tracking-[0.16em] whitespace-normal"
        >
          {busy === 'yes' && <Loader2 className="animate-spin" />} Joyfully Accept
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          disabled={!!busy}
          onClick={() => send('no')}
          className="ui-caps h-auto min-h-12 rounded-[2px] border-gold/60 bg-transparent px-3 py-3.5 text-[0.74rem] leading-snug tracking-[0.16em] whitespace-normal text-ivory hover:bg-gold/10 hover:text-ivory"
        >
          {busy === 'no' && <Loader2 className="animate-spin" />} Regretfully Decline
        </Button>
      </div>
      {error && (
        <p id="rsvp-error" role="alert" className="mt-2.5 text-center font-ui text-sm text-bad">
          {error}
        </p>
      )}
      <Label htmlFor="note" className="ui-caps mt-6 mb-1.5 text-[0.7rem] text-ivory-dim">
        A note for {cfg.couple.bride} &amp; {cfg.couple.groom}
      </Label>
      <Textarea
        ref={box}
        id="note"
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          if (error) setError('');
        }}
        rows={3}
        maxLength={500}
        placeholder="Share your wishes, or let us know why you can’t make it"
        aria-describedby={error ? 'rsvp-error' : undefined}
        className="bg-navy-2 font-body text-lg"
      />
      {footnote && <p className="mt-3 mb-0 text-center font-ui text-[0.82rem] leading-snug text-ivory-dim italic">{footnote}</p>}
      {onCancel && (
        <div className="mt-3 text-center">
          <Button type="button" variant="ghost" onClick={onCancel} className="ui-caps h-10 text-[0.72rem]">
            Keep my response
          </Button>
        </div>
      )}
    </form>
  );
}
