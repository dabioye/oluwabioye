'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, Copy, Download, ImageDown, Link2, Mail, MessageCircle, Plus, Send, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api, ApiError } from '@/lib/api';
import { cfg, type EventKey } from '@/lib/config';
import { ago, longDate, weekday } from '@/lib/format';
import { canShareImages, cardFileName, churchCardFileName, download, preloadCard, renderCard, type CardFile } from '@/lib/card-image';
import type { Activity, EmailStatus, Guest, InviteKind, SendKind, Side, SiteSettings, WaSend, WhatsAppStatus } from '@/lib/types';
import { cn } from '@/lib/utils';
import { StaffHeader, StaffPage } from '../staff-shell';
import { GuestDialog } from './guest-dialog';
import { ImportDialog } from './import-dialog';
import { SendCardDialog } from './send-card-dialog';
import { WhatsAppSendDialog } from './whatsapp-send-dialog';
import { activityText, CHANNEL_LABEL, PILL, sendHref, whatsAppHref, type Stage, STAGES, stageOf, WA_TAG } from './model';
import { SteadyText } from '@/components/ui/steady-text';

type Data = { guests: Guest[]; activity: Activity[]; inviteUrl: string };

// Guests invited to the traditional wedding get their personalised card (with their access code) with the message;
// guests invited to the church wedding get the church card with their name. Invited to both, they get both.
const getsCard = (g: Guest) => g.events.includes('trad');
const getsChurchCard = (g: Guest) => g.events.includes('church');
const church = cfg.churchCard;
/** The invitations a guest should get: one per event they are invited to, traditional first. */
const wants = (g: Guest): InviteKind[] => (['trad', 'church'] as const).filter((k) => g.events.includes(k));
const sentId = (g: Guest, k: SendKind) => (k === 'church' ? g.waChurchMessageId : k === 'reminder' ? g.waReminderMessageId : g.waMessageId);
const waState = (g: Guest, k: InviteKind) => (k === 'church' ? g.waChurchStatus : g.waStatus);
const waError = (g: Guest, k: InviteKind) => (k === 'church' ? g.waChurchError : g.waError) || 'Delivery failed';
/** The invitations WhatsApp Business couldn't deliver to this guest. */
const failedKinds = (g: Guest) => (['trad', 'church'] as InviteKind[]).filter((k) => waState(g, k) === 'failed');

/** What Meta's failure reasons usually mean, and what to do about each. */
function failureHint(reason: string) {
  if (/no valid whatsapp number/i.test(reason)) return 'The number is missing or not a phone number. Fix it in their guest record, then retry.';
  if (/ecosystem|engagement/i.test(reason))
    return 'Meta held it back to limit marketing messages to this person. Retrying in a day or two may work; sending from your phone always does.';
  if (/undeliverable|not.*whatsapp|invalid|recipient/i.test(reason))
    return 'Usually the number isn’t on WhatsApp, or has a digit wrong. Check the number with them before retrying.';
  if (/opt|stop|block/i.test(reason)) return 'They’ve stopped marketing messages from this number. Send from your phone instead.';
  return 'Check the number, then retry, or send from your phone.';
}

const reachable = (g: Guest) => g.channel === 'whatsapp' && !!g.phone && g.rsvp !== 'no';
const EVENT_CHOICES: { label: string; events: EventKey[] }[] = [
  { label: 'Church only', events: ['church'] },
  { label: 'Traditional only', events: ['trad'] },
  { label: 'Both', events: ['church', 'trad'] },
];

async function copy(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(done);
  } catch {
    window.prompt('Copy this:', text);
  }
}

export function Desk() {
  const [data, setData] = useState<Data | null>(null);
  const [stage, setStage] = useState<Stage>('all');
  const [q, setQ] = useState('');
  const [side, setSide] = useState<Side | 'any'>('any');
  const [failedOnly, setFailedOnly] = useState(false);
  const [editing, setEditing] = useState<Guest | null | undefined>(undefined); // undefined = closed, null = new
  const [importing, setImporting] = useState(false);

  const refresh = useCallback(
    () =>
      api<Data>('/api/admin/guests').then(setData, (e) => {
        if (e instanceof ApiError && e.status === 401) location.reload();
        else toast.error('Couldn’t load the guest list');
      }),
    [],
  );

  useEffect(() => void refresh(), [refresh]);

  // The traditional card the guests' personalised images are drawn on (an upload, or the built-in one on the invite site).
  const [cardSrc, setCardSrc] = useState('');
  const [nameFont, setNameFont] = useState<string | undefined>();
  useEffect(() => {
    api<SiteSettings>('/api/admin/site').then(
      (s) => {
        const src = s.invitationArt?.trad || cfg.invitationArt.trad;
        const full = src.startsWith('/img/') && s.inviteUrl ? `${s.inviteUrl}${src}` : src;
        setCardSrc(full);
        setNameFont(s.nameFont);
        preloadCard(full, s.nameFont);
        preloadCard(church.art, s.nameFont);
      },
      () => {},
    );
  }, []);
  const cardFor = useCallback(
    (g: Guest) =>
      renderCard({ src: cardSrc, name: g.name, code: g.code, nameSlot: cfg.invitationArt.nameSlot, codeSlot: cfg.invitationArt.codeSlot, font: nameFont }),
    [cardSrc, nameFont],
  );
  /** Every card this guest is sent: the traditional card, the church card, or both. */
  const cardsFor = useCallback(
    async (g: Guest): Promise<CardFile[]> => {
      const out: CardFile[] = [];
      if (cardSrc && getsCard(g)) out.push({ blob: await cardFor(g), filename: cardFileName(g.name) });
      if (getsChurchCard(g))
        out.push({
          blob: await renderCard({ src: church.art, name: g.name, nameSlot: church.nameSlot, ink: church.ink, font: nameFont }),
          filename: churchCardFileName(g.name),
        });
      return out;
    },
    [cardSrc, cardFor, nameFont],
  );
  const hasCards = (g: Guest) => (!!cardSrc && getsCard(g)) || getsChurchCard(g);
  /** One of the guest's cards, for a WhatsApp Business send. */
  const renderFor = useCallback(
    (g: Guest, kind: SendKind) =>
      kind === 'church' ? renderCard({ src: church.art, name: g.name, nameSlot: church.nameSlot, ink: church.ink, font: nameFont }) : cardFor(g),
    [cardFor, nameFont],
  );
  const [cardStep, setCardStep] = useState<Guest | null>(null);

  // WhatsApp Business: when connected, invitations go out from the couple's number without opening WhatsApp.
  const [wa, setWa] = useState<WhatsAppStatus | null>(null);
  const [mailReady, setMailReady] = useState(false);

  /** Email the guest their invitation (with their card) from the wedding's email account. */
  async function sendEmail(g: Guest) {
    try {
      await api(`/api/admin/guests/${g.id}/email`, { body: {} });
      toast.success(`Invitation emailed to ${g.name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Couldn’t send the email');
    }
    refresh();
  }
  const [waSending, setWaSending] = useState<WaSend[] | null>(null);
  useEffect(() => {
    api<WhatsAppStatus>('/api/admin/whatsapp').then(setWa, () => {});
    api<EmailStatus>('/api/admin/email').then(
      (m) => setMailReady(m.configured),
      () => {},
    );
  }, []);
  /** Can this invitation go through WhatsApp Business (its template approved, and the card ready if it needs one)? */
  const apiReady = (k: InviteKind) => (k === 'church' ? !!wa?.churchReady : !!wa?.ready && (!wa.template?.needsImage || !!cardSrc));
  /** The guest's invitations that can go through WhatsApp Business. */
  const apiKinds = (g: Guest) => (reachable(g) ? wants(g).filter(apiReady) : []);
  const viaApi = (g: Guest) => apiKinds(g).length > 0;
  const sendsFor = (list: Guest[], only?: (g: Guest, k: InviteKind) => boolean): WaSend[] =>
    list.flatMap((g) =>
      apiKinds(g)
        .filter((k) => !only || only(g, k))
        .map((kind) => ({ guest: g, kind })),
    );

  /** Download every card for this guest; says how many. */
  async function saveCards(g: Guest) {
    try {
      const cards = await cardsFor(g);
      cards.forEach((c) => download(c.blob, c.filename));
      return cards.length;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Couldn’t create the card');
      return 0;
    }
  }

  /**
   * WhatsApp with the personalised card. The guest's chat always opens with the message (as a link, which
   * can't carry an image, and WhatsApp drops the text when an image is shared). On phones the card then
   * follows from the share sheet; desktop browsers can't share images, so the card is downloaded to attach.
   */
  async function sendWithCard(g: Guest) {
    if (viaApi(g)) return setWaSending(sendsFor([g]));
    return sendFromMyWhatsApp(g);
  }

  /** WhatsApp on this device: the guest's chat opens with the message, then the card follows from the share sheet. */
  async function sendFromMyWhatsApp(g: Guest) {
    window.open(whatsAppHref(g), '_blank', 'noopener'); // open now, while the click still counts as the user's
    if (hasCards(g)) {
      if (canShareImages()) setCardStep(g);
      else if ((await saveCards(g)) > 1) toast.success('Both cards downloaded. Attach them in the WhatsApp chat that just opened.');
      else toast.success('Card downloaded. Attach it in the WhatsApp chat that just opened.');
    }
    markSent(g, 'whatsapp');
  }
  useEffect(() => {
    const i = setInterval(() => !document.hidden && editing === undefined && !importing && !cardStep && !waSending && refresh(), 60_000);
    return () => clearInterval(i);
  }, [refresh, editing, importing, cardStep, waSending]);

  const guests = useMemo(() => data?.guests ?? [], [data]);
  const counts = useMemo(() => {
    const c = Object.fromEntries(STAGES.map((s) => [s.key, 0])) as Record<Stage, number>;
    guests.forEach((g) => {
      c.all++;
      c[stageOf(g)]++;
    });
    return c;
  }, [guests]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return guests
      .filter((g) => stage === 'all' || stageOf(g) === stage)
      .filter((g) => side === 'any' || g.side === side)
      .filter((g) => !failedOnly || failedKinds(g).length > 0)
      .filter((g) => !needle || [g.name, g.phone, g.email, g.group, g.code, g.table].join(' ').toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [guests, stage, side, q, failedOnly]);

  // Invitations WhatsApp Business couldn't deliver, grouped by Meta's reason, so numbers get fixed before a resend.
  const failures = useMemo(() => {
    const byReason = new Map<string, WaSend[]>();
    guests.forEach((g) =>
      failedKinds(g).forEach((kind) => {
        const reason = waError(g, kind);
        byReason.set(reason, [...(byReason.get(reason) ?? []), { guest: g, kind }]);
      }),
    );
    return [...byReason].map(([reason, sends]) => ({ reason, sends })).sort((a, b) => b.sends.length - a.sends.length);
  }, [guests]);
  const failedGuests = useMemo(() => guests.filter((g) => failedKinds(g).length > 0).length, [guests]);

  async function markSent(g: Guest, via: string) {
    await api(`/api/admin/guests/${g.id}/sent`, { body: { via } });
    toast.success(`Marked as sent to ${g.name}`);
    refresh();
  }
  async function toggleDelivered(g: Guest) {
    const u = await api<Guest>(`/api/admin/guests/${g.id}`, { method: 'PATCH', body: { cardDelivered: !g.cardDelivered } });
    if (!g.sentAt && u.cardDelivered) await api(`/api/admin/guests/${g.id}/sent`, { body: { via: 'physical' } });
    refresh();
  }

  const unsent = rows.filter((g) => stageOf(g) === 'new' && g.channel !== 'physical' && sendHref(g));
  const waPending = sendsFor(
    [...guests].sort((a, b) => a.name.localeCompare(b.name)),
    (g, k) => !sentId(g, k) && waState(g, k) !== 'failed',
  );
  const waPendingGuests = new Set(waPending.map((s) => s.guest.id)).size;

  // Several guests at once: tick them, then change their events or resend their invitations.
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const chosen = guests.filter((g) => picked.has(g.id));
  const pick = (id: string, on: boolean) =>
    setPicked((p) => {
      const next = new Set(p);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const shownPicked = rows.filter((g) => picked.has(g.id)).length;
  const [busy, setBusy] = useState(false);

  async function setEvents(events: EventKey[], label: string) {
    setBusy(true);
    try {
      const r = await api<{ guests: Guest[] }>('/api/admin/guests/bulk', { body: { ids: chosen.map((g) => g.id), events } });
      // Invitations they are now owed (e.g. the church one for guests just added to the church wedding).
      const owed = sendsFor(r.guests, (g, k) => !sentId(g, k));
      const n = r.guests.length;
      toast.success(`${n} ${n === 1 ? 'guest' : 'guests'} set to ${label.toLowerCase()}`, {
        ...(owed.length && {
          description: `${owed.length} ${owed.length === 1 ? 'invitation hasn’t' : 'invitations haven’t'} been sent to them yet.`,
          action: { label: 'Send now', onClick: () => setWaSending(owed) },
          duration: 15_000,
        }),
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Couldn’t update the guests');
    }
    setBusy(false);
    refresh();
  }

  /** Resend the selected guests every invitation WhatsApp Business can send them. */
  function resendPicked() {
    const sends = sendsFor(chosen);
    const left = chosen.filter((g) => !apiKinds(g).length);
    const churchWaiting = chosen.some((g) => reachable(g) && g.events.includes('church')) && !apiReady('church');
    if (!sends.length) {
      toast.error(
        !wa?.ready && !wa?.churchReady
          ? 'WhatsApp Business isn’t ready, so send these one at a time with Message.'
          : 'None of these can be sent on WhatsApp Business: they need a WhatsApp number, WhatsApp as how to send, and not to have declined.',
      );
      return;
    }
    const notes = [
      left.length && `${left.length} skipped (no WhatsApp number, not sent by WhatsApp, or declined): ${left.map((g) => g.name).join(', ')}.`,
      churchWaiting && 'Church invitations can’t go on WhatsApp Business until the church template is approved, so only the traditional ones will be sent.',
    ].filter(Boolean);
    if (notes.length) toast.info(notes.join(' '), { duration: 12_000 });
    setWaSending(sends);
  }

  /** The countdown reminder, from the WhatsApp Business number, to each selected guest who can get it. */
  function remindPicked() {
    if (!wa?.reminderReady) {
      toast.error(
        wa?.reminderTemplate?.error && /No template called/.test(wa.reminderTemplate.error)
          ? `The countdown template (${wa.reminderTemplate.name}) isn’t in WhatsApp Manager yet.`
          : 'The countdown template isn’t approved yet, so reminders can’t be sent.',
      );
      return;
    }
    const to = chosen.filter(reachable);
    const left = chosen.filter((g) => !reachable(g));
    if (!to.length)
      return toast.error('None of these can get a WhatsApp reminder: they need a WhatsApp number, WhatsApp as how to send, and not to have declined.');
    if (left.length)
      toast.info(`${left.length} skipped (no WhatsApp number, not sent by WhatsApp, or declined): ${left.map((g) => g.name).join(', ')}.`, {
        duration: 12_000,
      });
    setWaSending(to.map((guest) => ({ guest, kind: 'reminder' })));
  }
  const total = guests.length || 1;
  const sent = guests.filter((g) => g.sentAt || g.cardDelivered).length;
  const opened = guests.filter((g) => g.openedAt).length;
  const yes = counts.yes + counts.in;
  const no = counts.no;
  const tiles: [Stage, string, number, number, string][] = [
    ['all', 'Guests', guests.length, 1, 'bg-gold'],
    ['sent', 'Invites sent', sent, sent / total, 'bg-gold'],
    ['opened', 'Opened', opened, opened / total, 'bg-gold'],
    ['yes', 'Attending', yes, yes / total, 'bg-ok'],
    ['no', 'Declined', no, no / total, 'bg-bad'],
    ['opened', 'Awaiting reply', guests.length - yes - no, (guests.length - yes - no) / total, 'bg-warn'],
    ['in', 'Checked in', counts.in, yes ? counts.in / yes : 0, 'bg-ok'],
  ];
  const n = (f: (g: Guest) => boolean) => guests.filter(f).length;
  const groups = [...new Set(guests.map((g) => g.group).filter(Boolean))];

  return (
    <StaffPage>
      <StaffHeader
        title="Invitation desk"
        subtitle={`${weekday()} ${longDate(cfg.date)} · RSVP by ${longDate(cfg.rsvpBy)}`}
        links={[
          { href: '/admin/church-cards', label: 'Church invitations' },
          { href: '/admin/church', label: 'Church RSVPs' },
          { href: '/admin/inbox', label: 'Inbox' },
          { href: '/admin/wishes', label: 'Wishes' },
          { href: '/admin/budget', label: 'Budget' },
          { href: '/admin/site', label: 'Edit website' },
          { href: '/', label: 'Website', external: true },
          { href: '/admin/gate-list', label: 'Gate list' },
          ...(data ? [{ href: `${data.inviteUrl}/checkin`, label: 'Gate', external: true }] : []),
        ]}
        signOutTo="/admin"
      />

      <h2 className="ui-caps mt-5 mb-0 text-[0.72rem] text-ivory-dim">Traditional wedding · private invitations</h2>
      <section aria-label="Invitation progress" className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(128px,1fr))] gap-2.5">
        {tiles.map(([k, label, num, p, bar], i) => (
          <button
            key={i}
            type="button"
            onClick={() => setStage(k)}
            className="grid cursor-pointer gap-1 rounded-md border border-hairline-soft bg-navy-2 px-3.5 pt-3 pb-2.5 text-left transition-colors hover:border-gold/50"
          >
            <span className="font-display text-[1.8rem] leading-none text-ivory tabular-nums">{num}</span>
            <span className="text-[0.68rem] tracking-[0.18em] text-ivory-dim uppercase">{label}</span>
            <span className="h-1 overflow-hidden rounded-full bg-gold/15">
              <i className={cn('block h-full', bar)} style={{ width: `${Math.round(p * 100)}%` }} />
            </span>
          </button>
        ))}
      </section>
      <p className="mt-3 mb-4 flex flex-wrap gap-x-6 gap-y-1 text-[0.82rem] text-ivory-dim [&_b]:text-ivory [&_b]:tabular-nums">
        <span>
          Bride’s side <b>{n((g) => g.side === 'bride')}</b>
        </span>
        <span>
          Groom’s side <b>{n((g) => g.side === 'groom')}</b>
        </span>
        <span>
          Shared <b>{n((g) => g.side === 'both')}</b>
        </span>
        <span>
          Driver cards <b>{n((g) => g.driverCard && g.rsvp === 'yes')}</b> of {n((g) => g.driverCard)}
        </span>
        <span>
          Printed cards handed over <b>{n((g) => g.cardDelivered)}</b>
        </span>
        <span>
          Invited guests attending church <b>{n((g) => g.events.includes('church') && g.rsvp === 'yes')}</b>
        </span>
        <span>
          Expected at reception <b>{n((g) => g.events.includes('trad') && g.rsvp === 'yes')}</b>
        </span>
      </p>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="min-w-0 gap-3 border-hairline-soft bg-navy-2/60 py-4">
          <CardContent className="grid gap-3 px-4">
            <div className="flex flex-wrap gap-2">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                type="search"
                placeholder="Search name, phone, group or code"
                aria-label="Search guests"
                className="h-10 min-w-56 flex-1"
              />
              <Select value={side} onValueChange={(v) => setSide(v as Side | 'any')}>
                <SelectTrigger className="h-10 w-40" aria-label="Filter by side">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Both sides</SelectItem>
                  <SelectItem value="bride">Bride’s side</SelectItem>
                  <SelectItem value="groom">Groom’s side</SelectItem>
                  <SelectItem value="both">Shared</SelectItem>
                </SelectContent>
              </Select>
              <Button className="h-10" onClick={() => setEditing(null)}>
                <Plus /> Add guest
              </Button>
              <Button variant="outline" className="h-10 border-gold/40 bg-transparent text-gold" onClick={() => setImporting(true)}>
                <Upload /> Import
              </Button>
              <Button asChild variant="outline" className="h-10 border-gold/40 bg-transparent text-gold">
                <a href="/api/admin/export.csv">
                  <Download /> Export
                </a>
              </Button>
            </div>

            <div role="tablist" aria-label="Filter by stage" className="flex flex-wrap gap-1.5">
              {STAGES.map((s) => (
                <button
                  key={s.key}
                  role="tab"
                  type="button"
                  aria-selected={stage === s.key}
                  onClick={() => setStage(s.key)}
                  className={cn(
                    'cursor-pointer rounded-full border border-gold/30 px-3 py-1.5 text-[0.75rem] text-ivory-dim transition-colors',
                    stage === s.key && 'border-gold bg-gold text-navy',
                  )}
                >
                  {s.label} <b className="ml-0.5 tabular-nums">{counts[s.key]}</b>
                </button>
              ))}
              {(failedGuests > 0 || failedOnly) && (
                <button
                  type="button"
                  aria-pressed={failedOnly}
                  onClick={() => setFailedOnly((on) => !on)}
                  className={cn(
                    'cursor-pointer rounded-full border border-bad/50 px-3 py-1.5 text-[0.75rem] text-bad transition-colors',
                    failedOnly && 'border-bad bg-bad text-navy',
                  )}
                >
                  WhatsApp failed <b className="ml-0.5 tabular-nums">{failedGuests}</b>
                </button>
              )}
            </div>

            {failedOnly && failures.length > 0 && (
              <section aria-label="Why WhatsApp sends failed" className="grid gap-2 rounded-md border border-bad/40 bg-bad/5 p-3 text-[0.85rem]">
                <p className="m-0 text-ivory-dim">
                  Fix numbers first: open a guest to correct it. Retry shows a preview before anything is sent, and each resend is a paid message.
                </p>
                <ul className="m-0 grid list-none gap-2 p-0">
                  {failures.map(({ reason, sends }) => (
                    <li key={reason} className="flex flex-wrap items-start justify-between gap-2 border-t border-bad/20 pt-2 first:border-0 first:pt-0">
                      <span className="min-w-0 flex-1 basis-60">
                        <b className="font-medium text-ivory [overflow-wrap:anywhere]">
                          {reason} <span className="text-bad tabular-nums">· {sends.length}</span>
                        </b>
                        <small className="block text-ivory-dim">{failureHint(reason)}</small>
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-[#1f7a4d]/60 bg-transparent text-[#5fd39a]"
                        onClick={() => setWaSending(sends)}
                        aria-label={`Retry ${sends.length} failed: ${reason}`}
                      >
                        <Send /> Retry {sends.length}
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {waPending.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-[#1f7a4d]/15 px-3 py-2.5 text-[0.85rem]">
                <span>
                  {waPendingGuests} {waPendingGuests === 1 ? 'guest hasn’t' : 'guests haven’t'} had their WhatsApp{' '}
                  {waPending.length > waPendingGuests ? `invitations yet (${waPending.length} to send)` : 'invitation yet'}
                </span>
                <Button size="sm" className="bg-[#1f7a4d] text-white hover:bg-[#25915b]" onClick={() => setWaSending(waPending)}>
                  <Send /> Send all pending via WhatsApp
                </Button>
              </div>
            )}
            {stage === 'new' && unsent.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-gold/10 px-3 py-2.5 text-[0.85rem]">
                <span>{unsent.length} ready to send</span>
                <Button
                  size="sm"
                  className="bg-[#1f7a4d] text-white hover:bg-[#25915b]"
                  onClick={() => {
                    const next = unsent[0];
                    if (next.channel === 'whatsapp') return sendWithCard(next);
                    window.open(sendHref(next), '_blank', 'noopener');
                    markSent(next, next.channel);
                  }}
                >
                  <Send /> Send next on WhatsApp
                </Button>
              </div>
            )}

            {rows.length > 0 && (
              <label className="flex w-fit cursor-pointer items-center gap-2.5 px-1 text-[0.8rem] text-ivory-dim">
                <Checkbox
                  checked={shownPicked === rows.length ? true : shownPicked ? 'indeterminate' : false}
                  onCheckedChange={(on) =>
                    setPicked((p) => {
                      const next = new Set(p);
                      rows.forEach((g) => (on === true ? next.add(g.id) : next.delete(g.id)));
                      return next;
                    })
                  }
                  className="border-gold/50"
                />
                Select all {rows.length} shown
              </label>
            )}

            <div aria-live="polite" className="grid">
              {!data ? (
                <p className="py-8 text-center text-ivory-dim">Loading guests…</p>
              ) : rows.length === 0 ? (
                <p className="py-8 text-center text-ivory-dim">
                  {guests.length ? 'No guests match this filter.' : 'No guests yet. Add your first guest or import your list from a spreadsheet.'}
                </p>
              ) : (
                rows.map((g) => (
                  <GuestRow
                    key={g.id}
                    g={g}
                    onEdit={() => setEditing(g)}
                    onSent={markSent}
                    onDelivered={toggleDelivered}
                    onSendWhatsApp={() => sendWithCard(g)}
                    onMessage={() => sendFromMyWhatsApp(g)}
                    onEmail={mailReady && g.email ? () => sendEmail(g) : undefined}
                    viaApi={viaApi(g)}
                    onCard={hasCards(g) ? () => saveCards(g) : undefined}
                    picked={picked.has(g.id)}
                    onPick={(on) => pick(g.id, on)}
                  />
                ))
              )}
            </div>

            {chosen.length > 0 && (
              <div
                role="toolbar"
                aria-label="Selected guests"
                className="sticky bottom-3 z-10 grid gap-2 rounded-md border border-gold/40 bg-navy-2 px-3 py-2.5 text-[0.85rem] shadow-lg"
              >
                <div className="flex items-center justify-between gap-2">
                  <b className="font-medium">{chosen.length} selected</b>
                  <Button size="sm" variant="ghost" className="h-7 text-ivory-dim" onClick={() => setPicked(new Set())}>
                    <X /> Clear
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mr-1 text-ivory-dim">Invite to</span>
                  {EVENT_CHOICES.map((c) => (
                    <Button
                      key={c.label}
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      className="border-gold/40 bg-transparent text-gold"
                      onClick={() => setEvents(c.events, c.label)}
                    >
                      {c.label}
                    </Button>
                  ))}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    className="border-[#1f7a4d] bg-transparent text-[#5fd39a] sm:ml-auto"
                    onClick={remindPicked}
                  >
                    <CalendarClock /> Send countdown reminder
                  </Button>
                  <Button size="sm" disabled={busy} className="bg-[#1f7a4d] text-white hover:bg-[#25915b]" onClick={resendPicked}>
                    <Send /> Resend invitations
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="gap-3 border-hairline-soft bg-navy-2/60 py-4">
          <CardHeader className="px-4">
            <CardTitle className="ui-caps text-[0.72rem] text-ivory-dim">Latest activity</CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            <ol className="m-0 grid max-h-[560px] list-none gap-2.5 overflow-y-auto p-0 text-[0.85rem]">
              {data?.activity.length ? (
                data.activity.slice(0, 40).map((a, i) => (
                  <li key={a.at + i} className="flex justify-between gap-3 border-b border-hairline-soft pb-2 last:border-0">
                    <span>{activityText(a)}</span>
                    <small className="shrink-0 text-ivory-dim">{ago(a.at)}</small>
                  </li>
                ))
              ) : (
                <li className="text-ivory-dim">Sends, opens, RSVPs and arrivals will show here.</li>
              )}
            </ol>
          </CardContent>
        </Card>
      </div>

      {wa?.configured && <WhatsAppPanel wa={wa} />}

      <GuestDialog open={editing !== undefined} guest={editing ?? null} groups={groups} onClose={() => setEditing(undefined)} onSaved={refresh} />
      {wa && <WhatsAppSendDialog sends={waSending} wa={wa} render={renderFor} onProgress={refresh} onClose={() => setWaSending(null)} />}
      <SendCardDialog guest={cardStep} render={cardsFor} onClose={() => setCardStep(null)} />
      <ImportDialog open={importing} onClose={() => setImporting(false)} onImported={refresh} />
    </StaffPage>
  );
}

function GuestRow({
  g,
  onEdit,
  onSent,
  onDelivered,
  onSendWhatsApp,
  onMessage,
  onEmail,
  viaApi,
  onCard,
  picked,
  onPick,
}: {
  g: Guest;
  onEdit: () => void;
  onSent: (g: Guest, via: string) => void;
  onDelivered: (g: Guest) => void;
  onSendWhatsApp: () => void;
  /** Send from WhatsApp on this device (message, then card) instead of WhatsApp Business. */
  onMessage: () => void;
  /** Email the invitation from the server (when email is set up and the guest has an address). */
  onEmail?: () => void;
  viaApi: boolean;
  onCard?: () => void;
  picked: boolean;
  onPick: (on: boolean) => void;
}) {
  const st = stageOf(g);
  const href = sendHref(g);
  const meta = [g.group, g.side === 'bride' ? 'Bride' : g.side === 'groom' ? 'Groom' : 'Shared', g.phone, g.code].filter(Boolean).join(' · ');
  const tags = [
    g.honour,
    g.driverCard && 'Driver',
    g.events.length === 1 && (g.events[0] === 'church' ? 'Church only' : 'Reception only'),
    g.cardDelivered && 'Card given',
    g.table && `T${g.table}`,
  ].filter(Boolean) as string[];
  return (
    <div
      className={cn(
        'grid items-center gap-3 border-t border-hairline-soft px-1 py-3 first:border-0 md:grid-cols-[minmax(0,1fr)_130px_auto]',
        picked && 'bg-gold/5',
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <Checkbox checked={picked} onCheckedChange={(on) => onPick(on === true)} aria-label={`Select ${g.name}`} className="mt-1 border-gold/50" />
        <button type="button" onClick={onEdit} className="min-w-0 flex-1 cursor-pointer border-0 bg-transparent p-0 text-left">
          <b className="block font-medium [overflow-wrap:anywhere] text-ivory">
            {g.name}
            {tags.map((t) => (
              <Badge key={t} variant="outline" className="ml-1.5 border-gold/30 align-middle text-[0.65rem] font-normal text-ivory-dim">
                {t}
              </Badge>
            ))}
          </b>
          <SteadyText text={meta} className="text-[0.78rem] [overflow-wrap:anywhere] text-ivory-dim" />
          {(
            [
              [g.waStatus, g.waError, ''],
              [g.waChurchStatus, g.waChurchError, g.waStatus ? ' (church)' : ''],
              [g.waReminderStatus, g.waReminderError, ' (reminder)'],
            ] as const
          ).map(([s, err, which]) =>
            s ? (
              <Badge key={which} variant="outline" className={cn('mt-1 mr-1 text-[0.65rem] font-normal', WA_TAG[s].className)} title={err || undefined}>
                {WA_TAG[s].label}
                {which}
                {s === 'failed' && err ? `: ${err}` : ''}
              </Badge>
            ) : null,
          )}
          {(g.emailSentAt || g.emailError) && (
            <Badge
              variant="outline"
              className={cn('mt-1 ml-1 text-[0.65rem] font-normal', g.emailError ? 'border-bad/50 text-bad' : 'border-ok/40 text-ok')}
              title={g.emailError || undefined}
            >
              {g.emailError ? `Email failed: ${g.emailError}` : 'Email sent'}
            </Badge>
          )}
        </button>
      </div>
      <div>
        <Badge variant="outline" className={cn('text-[0.7rem]', PILL[st].className)} title={g.rsvpNote || undefined}>
          {PILL[st].label}
        </Badge>
        {g.openCount > 1 && <small className="mt-1 block text-[0.72rem] text-ivory-dim">opened {g.openCount}×</small>}
      </div>
      <div className="flex flex-wrap gap-1.5 md:justify-end">
        {g.channel === 'physical' ? (
          <Button size="sm" variant="outline" className="border-gold/40 bg-transparent text-gold" onClick={() => onDelivered(g)}>
            {g.cardDelivered ? 'Card given ✓' : 'Mark card given'}
          </Button>
        ) : href && g.channel === 'whatsapp' ? (
          <Button size="sm" className="bg-[#1f7a4d] text-white hover:bg-[#25915b]" onClick={onSendWhatsApp}>
            <Send /> {(viaApi ? g.waMessageId || g.waChurchMessageId : g.sentAt) ? 'Resend' : 'Send'} · WhatsApp
          </Button>
        ) : g.channel === 'email' && onEmail ? (
          <Button size="sm" onClick={onEmail}>
            <Send /> {g.emailSentAt ? 'Resend' : 'Send'} · Email
          </Button>
        ) : href ? (
          <Button asChild size="sm">
            <a href={href} target="_blank" rel="noopener" onClick={() => onSent(g, g.channel)}>
              <Send /> {g.sentAt ? 'Resend' : 'Send'} · {CHANNEL_LABEL[g.channel]}
            </a>
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="border-gold/40 bg-transparent text-gold" onClick={onEdit}>
            Add {g.channel === 'email' ? 'email' : 'phone'}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="border-gold/40 bg-transparent text-gold"
          title={g.phone ? 'Open WhatsApp on this device with the message, then send the card' : undefined}
          onClick={async () => {
            if (g.phone) return onMessage();
            await copy(g.message, 'Message copied. Paste it into WhatsApp or SMS.');
            if (!g.sentAt) onSent(g, 'copied');
          }}
        >
          {g.phone ? <MessageCircle /> : <Copy />} Message
        </Button>
        {onEmail && g.channel !== 'email' && (
          <Button size="sm" variant="outline" className="border-gold/40 bg-transparent text-gold" onClick={onEmail} title="Email the invitation and card">
            <Mail /> Email
          </Button>
        )}
        <Button size="sm" variant="outline" className="border-gold/40 bg-transparent text-gold" onClick={() => copy(g.link, 'Invitation link copied')}>
          <Link2 /> Link
        </Button>
        {onCard && (
          <Button
            size="sm"
            variant="outline"
            className="border-gold/40 bg-transparent text-gold"
            onClick={onCard}
            title={g.events.length > 1 ? 'Download their two invitation cards (traditional and church)' : 'Download their personalised invitation card'}
          >
            <ImageDown /> {g.events.length > 1 ? 'Cards' : 'Card'}
          </Button>
        )}
      </div>
    </div>
  );
}

/** What the desk knows about the WhatsApp Business connection. */
function WhatsAppPanel({ wa }: { wa: WhatsAppStatus }) {
  const t = wa.template;
  const c = wa.churchTemplate;
  const r = wa.reminderTemplate;
  const rows: [string, string][] = [
    ['From', [wa.phone?.display_phone_number, wa.phone?.verified_name].filter(Boolean).join(' · ') || '—'],
    ['Template', t ? `${t.name} · ${t.language} · ${t.fallback ? 'not read from Meta' : `${t.category.toLowerCase()}, ${t.status.toLowerCase()}`}` : '—'],
    ['Card', t?.needsImage ? 'Each guest’s card goes with their message' : 'No image in the template'],
    [
      'Church template',
      !c
        ? '—'
        : c.error
          ? /No template called/.test(c.error)
            ? `${c.name} isn’t in WhatsApp Manager yet, so church invitations go by hand`
            : `couldn’t read ${c.name}: ${c.error}`
          : `${c.name} · ${c.language} · ${c.category.toLowerCase()}, ${c.status.toLowerCase()}${wa.churchReady ? '' : ' (church invitations go by hand until it’s approved)'}`,
    ],
    [
      'Reminder template',
      !r
        ? '—'
        : r.error
          ? /No template called/.test(r.error)
            ? `${r.name} isn’t in WhatsApp Manager yet`
            : `couldn’t read ${r.name}: ${r.error}`
          : `${r.name} · ${r.language} · ${r.category.toLowerCase()}, ${r.status.toLowerCase()}`,
    ],
    ['Number quality', wa.phone?.quality_rating ? wa.phone.quality_rating.toLowerCase() : '—'],
    ['Access token', wa.token?.error ? 'couldn’t check' : wa.token?.expiresAt ? `expires ${wa.token.expiresAt.slice(0, 10)}` : 'never expires'],
    ['Automatic sending', wa.autoSend ? 'on (Edit website)' : 'off (Edit website)'],
  ];
  return (
    <Card className="mt-4 gap-3 border-hairline-soft bg-navy-2/60 py-4">
      <CardHeader className="px-4">
        <CardTitle className="ui-caps text-[0.72rem] text-ivory-dim">
          WhatsApp Business · <span className={wa.ready ? 'text-ok' : 'text-warn'}>{wa.ready ? 'ready' : 'needs attention'}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 px-4 text-[0.85rem]">
        <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-ivory-dim">{k}</dt>
              <dd className="m-0 [overflow-wrap:anywhere]">
                <SteadyText text={v} />
              </dd>
            </div>
          ))}
        </dl>
        {!!wa.problems?.length && (
          <ul className="m-0 grid gap-1 pl-4 text-warn">
            {wa.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
