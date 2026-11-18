'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Copy, ImageDown, Loader2, MessageCircle, Pencil, Plus, Send, Trash2, Undo2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api, ApiError } from '@/lib/api';
import { canShareImages, cardFileName, download, preloadCard, renderCard } from '@/lib/card-image';
import { cfg } from '@/lib/config';
import { ago, longDate, weekday } from '@/lib/format';
import type { ChurchCard, ChurchCardArt, SiteSettings, WaSend, WhatsAppStatus } from '@/lib/types';
import { StaffHeader, StaffPage } from '../staff-shell';
import { waNumber } from './model';
import { SendCardDialog } from './send-card-dialog';
import { WhatsAppSendDialog } from './whatsapp-send-dialog';
import { SteadyText } from '@/components/ui/steady-text';

type Data = { cards: ChurchCard[]; card: ChurchCardArt };

// Sends from the couple's WhatsApp Business number go through these, with the church template.
const churchUrls = {
  preview: (s: WaSend<ChurchCard>) => `/api/admin/church-cards/${s.guest.id}/whatsapp`,
  send: (s: WaSend<ChurchCard>) => `/api/admin/church-cards/${s.guest.id}/whatsapp`,
};
/** How far a WhatsApp Business send got, for the badge. */
const WA_STATUS: Record<string, string> = { accepted: 'queued', sent: 'sent', delivered: 'delivered', read: 'read' };

/** "Name, phone" on each line; the phone is optional. */
function parseLines(text: string) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(.*?)[,;\t]\s*(\+?[\d\s()-]{7,})$/);
      return m ? { name: m[1].trim(), phone: m[2].trim() } : { name: line, phone: '' };
    });
}

/**
 * Church invitations for people and groups: their name written on the church card, sent from the couple's
 * WhatsApp like the traditional invitations, but with no code or private link (the church wedding is open).
 */
export function ChurchCards() {
  const [data, setData] = useState<Data | null>(null);
  const [font, setFont] = useState<string | undefined>();
  const load = useCallback(
    () =>
      api<Data>('/api/admin/church-cards').then(setData, (e) =>
        e instanceof ApiError && e.status === 401 ? location.reload() : toast.error('Couldn’t load the church invitations'),
      ),
    [],
  );
  // With the church template approved, invitations with a number go from the couple's WhatsApp Business number.
  const [wa, setWa] = useState<WhatsAppStatus | null>(null);
  const [business, setBusiness] = useState<WaSend<ChurchCard>[] | null>(null);
  useEffect(() => {
    load();
    api<WhatsAppStatus>('/api/admin/whatsapp').then(setWa, () => {});
    api<SiteSettings>('/api/admin/site').then(
      (s) => setFont(s.nameFont),
      () => {},
    );
  }, [load]);
  const art = data?.card;
  useEffect(() => {
    if (art) preloadCard(art.art, font);
  }, [art, font]);

  const render = useCallback((c: { name: string }) => renderCard({ src: art!.art, name: c.name, nameSlot: art!.nameSlot, ink: art!.ink, font }), [art, font]);
  const [sharing, setSharing] = useState<{ card: ChurchCard; after: boolean } | null>(null);

  async function markSent(c: ChurchCard, sent = true) {
    await api(`/api/admin/church-cards/${c.id}`, { method: 'PATCH', body: { sent } });
    load();
  }

  /** As for the traditional invitations: the chat opens with the message, then the card follows. */
  async function sendOnWhatsApp(c: ChurchCard) {
    const to = c.phone ? waNumber(c.phone) : '';
    window.open(`https://wa.me/${to}?text=${encodeURIComponent(c.message)}`, '_blank', 'noopener');
    if (canShareImages()) setSharing({ card: c, after: true });
    else {
      await saveCard(c);
      toast.success('Card downloaded. Attach it in the WhatsApp chat that just opened.');
    }
    markSent(c);
  }
  async function saveCard(c: ChurchCard) {
    try {
      download(await render(c), cardFileName(c.name));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Couldn’t create the card');
    }
  }
  async function copyMessage(c: ChurchCard) {
    try {
      await navigator.clipboard.writeText(c.message);
      toast.success('Message copied');
    } catch {
      window.prompt('Copy this:', c.message);
    }
  }

  const cards = useMemo(() => data?.cards ?? [], [data]);
  const sent = cards.filter((c) => c.sentAt).length;
  const viaBusiness = (c: ChurchCard) => !!wa?.churchReady && !!waNumber(c.phone);
  const unsent = cards.filter((c) => viaBusiness(c) && !c.sentAt);
  const sendBusiness = (list: ChurchCard[]) => setBusiness(list.map((guest) => ({ guest, kind: 'church' as const })));

  return (
    <StaffPage>
      <StaffHeader
        title="Church invitations"
        subtitle={`${cfg.events.church.name} · ${weekday()} ${longDate(cfg.date)} · ${cfg.events.church.time}`}
        links={[
          { href: '/admin', label: 'Invitation desk' },
          { href: '/admin/church', label: 'Church RSVPs' },
        ]}
        signOutTo="/admin"
      />
      <p className="mt-4 mb-0 max-w-[60em] text-[0.88rem] text-ivory-dim">
        Put a person’s or a group’s name on the church invitation card and send it on WhatsApp. With a number, it goes from your WhatsApp Business number;
        groups without one go from your phone, where you choose the chat. There’s no code, as the church wedding is open to all: the message points to the
        website and its RSVP. These aren’t added to the invitation desk.
      </p>

      {!data ? (
        <Loader2 className="mx-auto mt-16 animate-spin text-gold" aria-label="Loading" />
      ) : (
        <div className="mt-4 grid items-start gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          <AddCards onAdded={load} />
          <Card className="min-w-0 gap-0 border-hairline-soft bg-navy-2/60 py-0">
            <CardHeader className="border-b border-hairline-soft px-4 py-3 [.border-b]:pb-3">
              <CardTitle className="ui-caps text-[0.72rem] text-ivory-dim">
                Invitations ({cards.length}) · {sent} sent
              </CardTitle>
              {unsent.length > 0 && (
                <Button size="sm" onClick={() => sendBusiness(unsent)} className="mt-2 w-fit bg-[#1f7a4d] text-white hover:bg-[#25915b]">
                  <Send /> Send the {unsent.length} not sent via WhatsApp
                </Button>
              )}
            </CardHeader>
            {cards.length === 0 ? (
              <p className="p-8 text-center text-ivory-dim">No one yet. Add a name, e.g. “Mr & Mrs Adeyemi” or “RCCG Youth Choir”.</p>
            ) : (
              <ul className="m-0 list-none p-0" aria-label="Church invitations">
                {cards.map((c) => (
                  <Row
                    key={c.id}
                    c={c}
                    business={viaBusiness(c)}
                    onBusiness={() => sendBusiness([c])}
                    onSend={() => sendOnWhatsApp(c)}
                    onCard={() => (canShareImages() ? setSharing({ card: c, after: false }) : saveCard(c))}
                    onCopy={() => copyMessage(c)}
                    onUnsend={() => markSent(c, false)}
                    onChanged={load}
                    onRemoved={load}
                  />
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {art && (
        <SendCardDialog
          guest={sharing?.card ?? null}
          render={render}
          onClose={() => setSharing(null)}
          {...(sharing && !sharing.after
            ? { title: `${sharing.card.name}’s card`, description: 'Tap Share card, choose WhatsApp, then the chat. Or save the image.' }
            : {})}
        />
      )}
      {wa && art && (
        <WhatsAppSendDialog sends={business} wa={wa} render={(c) => render(c)} urls={churchUrls} onProgress={load} onClose={() => setBusiness(null)} />
      )}
    </StaffPage>
  );
}

function AddCards({ onAdded }: { onAdded: () => void }) {
  const [many, setMany] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [lines, setLines] = useState('');
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const list = many ? parseLines(lines) : [{ name, phone }];
    setBusy(true);
    try {
      const r = await api<{ cards: ChurchCard[] }>('/api/admin/church-cards', { body: { cards: list } });
      toast.success(r.cards.length === 1 ? `Added ${r.cards[0].name}` : `Added ${r.cards.length} invitations`);
      // Clear only what was sent, so text typed meanwhile in the other box stays.
      if (many) setLines('');
      else {
        setName('');
        setPhone('');
      }
      onAdded();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t add');
    } finally {
      setBusy(false);
    }
  }

  const label = 'text-[0.72rem] tracking-[0.12em] text-ivory-dim uppercase';
  return (
    <Card className="gap-3 border-hairline-soft bg-navy-2/60 py-4">
      <CardHeader className="px-4">
        <CardTitle className="ui-caps text-[0.72rem] text-ivory-dim">Add a person or group</CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        <form onSubmit={add} className="grid gap-3">
          {many ? (
            <div className="grid gap-1.5">
              <Label htmlFor="cc-lines" className={label}>
                One per line: name, phone
              </Label>
              <Textarea
                id="cc-lines"
                rows={7}
                value={lines}
                onChange={(e) => setLines(e.target.value)}
                placeholder={'RCCG Youth Choir\nMr & Mrs Adeyemi, 0803 123 4567\nThe Bello Family, 0805 765 4321'}
              />
            </div>
          ) : (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="cc-name" className={label}>
                  Name on the card
                </Label>
                <Input id="cc-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mr & Mrs Adeyemi" className="h-11" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cc-phone" className={label}>
                  WhatsApp number (optional)
                </Label>
                <Input
                  id="cc-phone"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Leave empty for a group chat"
                  className="h-11"
                />
              </div>
            </>
          )}
          <Button type="submit" disabled={busy} className="h-11">
            {busy ? <Loader2 className="animate-spin" /> : <Plus />} Add
          </Button>
          <button type="button" onClick={() => setMany((m) => !m)} className="cursor-pointer border-0 bg-transparent p-0 text-[0.82rem] text-gold underline">
            {many ? 'Add one at a time' : 'Add several at once'}
          </button>
        </form>
      </CardContent>
    </Card>
  );
}

function Row({
  c,
  business,
  onBusiness,
  onSend,
  onCard,
  onCopy,
  onUnsend,
  onChanged,
  onRemoved,
}: {
  c: ChurchCard;
  /** Can go from the couple's WhatsApp Business number (template approved, and a number to send to). */
  business: boolean;
  onBusiness: () => void;
  onSend: () => void;
  onCard: () => void;
  onCopy: () => void;
  onUnsend: () => void;
  onChanged: () => void;
  onRemoved: () => void;
}) {
  const [armed, setArmed] = useState(false);
  const [editing, setEditing] = useState(false);
  if (editing) return <EditRow c={c} onDone={(changed) => (setEditing(false), changed && onChanged())} />;
  return (
    <li className="grid gap-2 border-b border-hairline-soft px-4 py-3 last:border-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <span className="min-w-0">
        <b className="block font-medium [overflow-wrap:anywhere] text-ivory">
          {c.name}
          <Badge
            variant="outline"
            className={`ml-2 align-middle text-[0.65rem] font-normal ${c.sentAt ? 'border-gold/50 text-gold' : 'border-ivory-dim/40 text-ivory-dim'}`}
          >
            {c.sentAt ? `Sent ${ago(c.sentAt)}` : 'Not sent'}
            {c.waStatus && c.waStatus !== 'failed' && ` · ${WA_STATUS[c.waStatus]}`}
          </Badge>
          {c.waStatus === 'failed' && (
            <Badge variant="outline" className="ml-1.5 border-bad/50 align-middle text-[0.65rem] font-normal text-bad" title={c.waError}>
              WhatsApp failed
            </Badge>
          )}
        </b>
        <small className="block text-[0.78rem] text-ivory-dim">
          <SteadyText text={c.phone || 'No number: you choose the chat in WhatsApp'} />
        </small>
      </span>
      <span className="flex flex-wrap gap-1.5">
        {business ? (
          <>
            <Button size="sm" onClick={onBusiness} className="bg-[#1f7a4d] text-white hover:bg-[#25915b]">
              <Send /> Send · WhatsApp
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onSend}
              className="border-gold/40 bg-transparent text-gold"
              title="Send it from WhatsApp on this device instead"
            >
              <MessageCircle /> Message
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={onSend} className="bg-[#1f7a4d] text-white hover:bg-[#25915b]">
            <MessageCircle /> WhatsApp
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={onCard} className="border-gold/40 bg-transparent text-gold">
          <ImageDown /> Card
        </Button>
        <Button size="icon" variant="ghost" onClick={() => setEditing(true)} className="size-8 text-gold" aria-label={`Edit ${c.name}`}>
          <Pencil />
        </Button>
        <Button size="icon" variant="ghost" onClick={onCopy} className="size-8 text-gold" aria-label={`Copy the message for ${c.name}`}>
          <Copy />
        </Button>
        {c.sentAt && (
          <Button size="icon" variant="ghost" onClick={onUnsend} className="size-8 text-ivory-dim" aria-label={`Mark ${c.name} as not sent`}>
            <Undo2 />
          </Button>
        )}
        <Button
          size={armed ? 'sm' : 'icon'}
          variant="ghost"
          className={armed ? 'text-bad hover:text-bad' : 'size-8 text-ivory-dim'}
          aria-label={armed ? undefined : `Remove ${c.name}`}
          onBlur={() => setArmed(false)}
          onClick={async () => {
            if (!armed) return setArmed(true);
            await api(`/api/admin/church-cards/${c.id}`, { method: 'DELETE' });
            onRemoved();
          }}
        >
          <Trash2 /> {armed && 'Remove'}
        </Button>
      </span>
    </li>
  );
}

/** The row as a small form: change the name on the card or the WhatsApp number, in place. */
function EditRow({ c, onDone }: { c: ChurchCard; onDone: (changed: boolean) => void }) {
  const [name, setName] = useState(c.name);
  const [phone, setPhone] = useState(c.phone);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error('Type the name of the person or group.');
    if (name.trim() === c.name && phone.trim() === c.phone) return onDone(false);
    setBusy(true);
    try {
      await api(`/api/admin/church-cards/${c.id}`, { method: 'PATCH', body: { name, phone } });
      toast.success(c.sentAt ? 'Saved. Send it again so they get the new card.' : 'Saved');
      onDone(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t save');
      setBusy(false);
    }
  }

  return (
    <li className="border-b border-hairline-soft px-4 py-3 last:border-0">
      <form
        onSubmit={save}
        onKeyDown={(e) => e.key === 'Escape' && onDone(false)}
        className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,14em)_auto] sm:items-center"
        aria-label={`Edit ${c.name}`}
      >
        <Input autoFocus required value={name} onChange={(e) => setName(e.target.value)} aria-label="Name on the card" maxLength={80} className="h-9" />
        <Input
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          aria-label="WhatsApp number"
          placeholder="No number"
          maxLength={30}
          className="h-9"
        />
        <span className="flex gap-1.5">
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Check />} Save
          </Button>
          <Button type="button" size="icon" variant="ghost" onClick={() => onDone(false)} className="size-8 text-ivory-dim" aria-label="Cancel">
            <X />
          </Button>
        </span>
      </form>
    </li>
  );
}
