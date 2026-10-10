'use client';
import { useState } from 'react';
import { ExternalLink, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { cfg, type EventKey } from '@/lib/config';
import { ago, clock } from '@/lib/format';
import type { Channel, Guest, Rsvp, Side, WhatsAppResult } from '@/lib/types';

type Form = {
  name: string;
  phone: string;
  email: string;
  side: Side;
  group: string;
  channel: Channel;
  table: string;
  notes: string;
  events: EventKey[];
  driverCard: boolean;
  cardDelivered: boolean;
  rsvp: Rsvp;
};

const blank: Form = {
  name: '',
  phone: '',
  email: '',
  side: 'both',
  group: '',
  channel: 'whatsapp',
  table: '',
  notes: '',
  events: ['church', 'trad'],
  driverCard: false,
  cardDelivered: false,
  rsvp: 'pending',
};

function Field({ label, htmlFor, children, wide }: { label: string; htmlFor?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'grid gap-1.5 sm:col-span-2' : 'grid gap-1.5'}>
      <Label htmlFor={htmlFor} className="text-[0.72rem] tracking-[0.12em] text-ivory-dim uppercase">
        {label}
      </Label>
      {children}
    </div>
  );
}

type Props = { open: boolean; guest: Guest | null; groups: string[]; onClose: () => void; onSaved: () => void };

/** Add or edit a guest. `guest` null = add. The form starts fresh each time it opens. */
export function GuestDialog(props: Props) {
  return <GuestForm key={props.open ? (props.guest?.id ?? 'new') : 'closed'} {...props} />;
}

function GuestForm({ open, guest, groups, onClose, onSaved }: Props) {
  const [f, setF] = useState<Form>(() => (guest ? { ...blank, ...guest } : blank));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const toggleEvent = (k: EventKey, on: boolean) => set('events', on ? [...new Set([...f.events, k])] : f.events.filter((e) => e !== k));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.events.length) return setError('Pick at least one event.');
    setBusy(true);
    setError('');
    const body = {
      name: f.name,
      phone: f.phone,
      email: f.email,
      side: f.side,
      group: f.group,
      channel: f.channel,
      table: f.table,
      notes: f.notes,
      events: f.events,
      driverCard: f.driverCard,
      cardDelivered: f.cardDelivered,
    };
    try {
      if (guest) {
        await api(`/api/admin/guests/${guest.id}`, { method: 'PATCH', body });
        if (f.rsvp !== guest.rsvp) await api(`/api/admin/guests/${guest.id}/rsvp`, { body: { rsvp: f.rsvp } });
        toast.success('Saved');
      } else {
        const g = await api<Guest & { whatsapp: WhatsAppResult | null; email: WhatsAppResult | null }>('/api/admin/guests', { body });
        const wa = g.whatsapp ? (g.whatsapp.ok ? ' · WhatsApp invite sent' : ` · WhatsApp failed: ${g.whatsapp.error}`) : '';
        const mail = g.email ? (g.email.ok ? ' · Email sent' : ` · Email failed: ${g.email.error}`) : '';
        (g.whatsapp?.ok === false || g.email?.ok === false ? toast.warning : toast.success)(`${g.name} added · code ${g.code}${wa}${mail}`);
      }
      onClose();
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t save');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!guest) return;
    await api(`/api/admin/guests/${guest.id}`, { method: 'DELETE' });
    setConfirm(false);
    onClose();
    toast.success('Guest removed');
    onSaved();
  }

  const meta = guest
    ? [
        `Code ${guest.code}`,
        guest.sentAt && `sent ${ago(guest.sentAt)}`,
        guest.openedAt && `opened ${ago(guest.openedAt)}${guest.openCount > 1 ? ` (${guest.openCount}×)` : ''}`,
        guest.rsvpAt && `replied ${ago(guest.rsvpAt)}`,
        guest.rsvpNote && `note: “${guest.rsvpNote}”`,
        guest.checkedInAt && `arrived ${clock(guest.checkedInAt)}`,
      ].filter(Boolean)
    : [];

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto border-hairline bg-navy-2 font-ui sm:max-w-xl">
          <form onSubmit={save} className="grid gap-4">
            <DialogHeader>
              <DialogTitle className="font-display text-xl font-medium text-gold">{guest ? 'Edit guest' : 'Add guest'}</DialogTitle>
              <DialogDescription className="text-ivory-dim">
                {guest ? (
                  <>
                    {meta.join(' · ')} ·{' '}
                    <a href={guest.link} target="_blank" rel="noopener" className="inline-flex items-center gap-1">
                      Preview invitation <ExternalLink className="size-3" />
                    </a>
                  </>
                ) : (
                  'A private invitation code is created when you save.'
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3.5 sm:grid-cols-2">
              <Field label="Full name" htmlFor="g-name" wide>
                <Input id="g-name" required autoFocus value={f.name} onChange={(e) => set('name', e.target.value)} />
              </Field>
              <Field label="WhatsApp / phone" htmlFor="g-phone">
                <Input id="g-phone" inputMode="tel" placeholder="0803 000 0000" value={f.phone} onChange={(e) => set('phone', e.target.value)} />
              </Field>
              <Field label="Email" htmlFor="g-email">
                <Input id="g-email" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} />
              </Field>
              <Field label="Side">
                <Select value={f.side} onValueChange={(v) => set('side', v as Side)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bride">Bride</SelectItem>
                    <SelectItem value="groom">Groom</SelectItem>
                    <SelectItem value="both">Shared</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Group" htmlFor="g-group">
                <Input id="g-group" list="groups" placeholder="Family, Church, Work…" value={f.group} onChange={(e) => set('group', e.target.value)} />
                <datalist id="groups">
                  {groups.map((g) => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
              </Field>
              <Field label="Send via">
                <Select value={f.channel} onValueChange={(v) => set('channel', v as Channel)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="physical">Printed card</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Table" htmlFor="g-table">
                <Input id="g-table" value={f.table} onChange={(e) => set('table', e.target.value)} />
              </Field>
              <fieldset className="grid gap-2 sm:col-span-2">
                <legend className="mb-1 text-[0.72rem] tracking-[0.12em] text-ivory-dim uppercase">Invited to</legend>
                {(['church', 'trad'] as EventKey[]).map((k) => (
                  <label key={k} className="flex items-center gap-2.5 text-ivory">
                    <Checkbox checked={f.events.includes(k)} onCheckedChange={(v) => toggleEvent(k, v === true)} />
                    {cfg.events[k].name} ({cfg.events[k].time})
                  </label>
                ))}
              </fieldset>
              <fieldset className="grid gap-2 sm:col-span-2">
                <legend className="mb-1 text-[0.72rem] tracking-[0.12em] text-ivory-dim uppercase">Cards</legend>
                <label className="flex items-center gap-2.5 text-ivory">
                  <Checkbox checked={f.driverCard} onCheckedChange={(v) => set('driverCard', v === true)} /> Driver meal card
                </label>
                <label className="flex items-center gap-2.5 text-ivory">
                  <Checkbox checked={f.cardDelivered} onCheckedChange={(v) => set('cardDelivered', v === true)} /> Printed access card handed over
                </label>
              </fieldset>
              <Field label="Notes" htmlFor="g-notes" wide>
                <Textarea id="g-notes" rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} />
              </Field>
              {guest && (
                <Field label="RSVP (set it yourself if they replied by phone)" wide>
                  <Select value={f.rsvp} onValueChange={(v) => set('rsvp', v as Rsvp)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Awaiting reply</SelectItem>
                      <SelectItem value="yes">Attending</SelectItem>
                      <SelectItem value="no">Not attending</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              )}
            </div>

            {error && (
              <p role="alert" className="m-0 text-sm text-bad">
                {error}
              </p>
            )}
            <DialogFooter className="gap-2 sm:justify-between">
              {guest ? (
                <Button type="button" variant="ghost" className="text-bad hover:bg-bad/10 hover:text-bad" onClick={() => setConfirm(true)}>
                  <Trash2 /> Remove guest
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="border-gold/40 bg-transparent" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy && <Loader2 className="animate-spin" />} Save
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent className="border-hairline bg-navy-2 font-ui">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-ivory">Remove {guest?.name}?</AlertDialogTitle>
            <AlertDialogDescription>Their invitation link and code will stop working.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-bad text-navy hover:bg-bad/90" onClick={remove}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
