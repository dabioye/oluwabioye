'use client';
import { useMemo, useState } from 'react';
import { MessageCircle, SkipForward } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { SteadyText } from '@/components/ui/steady-text';
import { api } from '@/lib/api';
import { ago } from '@/lib/format';
import type { Guest } from '@/lib/types';
import { nudgeMessage, waNumber } from './model';

/**
 * Reminds guests who haven't replied to RSVP, one at a time from the couple's own WhatsApp (free, and it comes from
 * a number they know): each guest's chat opens with their reminder ready, and they're marked as reminded.
 */
export function NudgeDialog({
  guests,
  onClose,
  onChanged,
  onBusiness,
}: {
  guests: Guest[];
  onClose: () => void;
  onChanged: () => void;
  /** Send the approved countdown reminder to them all from the Business number instead, when it's available. */
  onBusiness?: (guests: Guest[]) => void;
}) {
  // The list as it was when the dialog opened, so sending a reminder doesn't reshuffle it.
  const [initial] = useState(guests);
  const [skipReminded, setSkipReminded] = useState(true);
  const queue = useMemo(() => initial.filter((g) => !skipReminded || !g.nudgedAt), [initial, skipReminded]);
  const [done, setDone] = useState<Set<string>>(new Set());
  const left = queue.filter((g) => !done.has(g.id));
  const g = left[0];
  const [edits, setEdits] = useState<Record<string, string>>({});
  const text = g ? (edits[g.id] ?? nudgeMessage(g)) : '';

  async function send() {
    if (!g) return;
    window.open(`https://wa.me/${waNumber(g.phone)}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    setDone((d) => new Set(d).add(g.id));
    try {
      await api(`/api/admin/guests/${g.id}/nudged`, { body: {} });
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Couldn’t mark them as reminded');
    }
  }

  const total = queue.length;
  const position = total - left.length + 1;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Remind guests to RSVP</DialogTitle>
          <DialogDescription>
            Each guest’s chat opens on your WhatsApp with their reminder ready; press send there, then come back for the next. It’s free, and it comes from a
            number they know.
          </DialogDescription>
        </DialogHeader>

        <label className="flex cursor-pointer items-center justify-between gap-3 text-[0.85rem]">
          <span>
            Skip guests already reminded <span className="text-ivory-dim">({initial.filter((x) => x.nudgedAt).length})</span>
          </span>
          <Switch checked={skipReminded} onCheckedChange={setSkipReminded} aria-label="Skip guests already reminded" />
        </label>

        {g ? (
          <div className="grid gap-2 rounded-md border border-hairline-soft p-3" aria-live="polite">
            <p className="m-0 text-[0.75rem] tracking-[0.12em] text-ivory-dim uppercase">
              {position} of {total}
            </p>
            <p className="m-0">
              <b className="font-medium text-ivory">{g.name}</b>
              <small className="block text-ivory-dim">
                <SteadyText text={g.phone} />
                {g.openedAt ? ' · opened their invitation, no reply' : ' · hasn’t opened their invitation'}
                {g.nudgedAt ? ` · reminded ${ago(g.nudgedAt)}` : ''}
              </small>
            </p>
            <Label htmlFor="nudge-text" className="sr-only">
              Reminder for {g.name}
            </Label>
            <Textarea id="nudge-text" rows={9} value={text} onChange={(e) => setEdits((x) => ({ ...x, [g.id]: e.target.value }))} />
          </div>
        ) : (
          <p className="m-0 rounded-md border border-hairline-soft p-4 text-center text-ivory-dim">
            {total ? `All ${total} reminded. Replies show on the desk as they come in.` : 'Everyone has been reminded already.'}
          </p>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {onBusiness ? (
            <Button variant="ghost" className="text-gold" onClick={() => onBusiness(queue)} disabled={!queue.length}>
              Send all {queue.length} the countdown reminder instead
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            {g ? (
              <>
                <Button variant="outline" onClick={() => setDone((d) => new Set(d).add(g.id))}>
                  <SkipForward /> Skip
                </Button>
                <Button onClick={send} className="bg-[#1f7a4d] text-white hover:bg-[#25915b]">
                  <MessageCircle /> Open WhatsApp
                </Button>
              </>
            ) : (
              <Button onClick={onClose}>Done</Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
