'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, Download, ImageDown, Link2, MessageCircle, Plus, Send, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api, ApiError } from '@/lib/api';
import { cfg } from '@/lib/config';
import { ago, longDate, weekday } from '@/lib/format';
import { canShareImages, cardFileName, download, preloadCard, renderCard } from '@/lib/card-image';
import type { Activity, ChurchRsvp, Guest, Side, SiteSettings, WhatsAppStatus } from '@/lib/types';
import { cn } from '@/lib/utils';
import { StaffHeader, StaffPage } from '../staff-shell';
import { GuestDialog } from './guest-dialog';
import { ImportDialog } from './import-dialog';
import { SendCardDialog } from './send-card-dialog';
import { WhatsAppSendDialog } from './whatsapp-send-dialog';
import { activityText, CHANNEL_LABEL, PILL, sendHref, whatsAppHref, type Stage, STAGES, stageOf, WA_TAG } from './model';

type Data = { guests: Guest[]; activity: Activity[]; church: ChurchRsvp[]; inviteUrl: string };

// Guests invited to the traditional wedding get their personalised card image with the message.
const getsCard = (g: Guest) => g.events.includes('trad');

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
      },
      () => {},
    );
  }, []);
  const cardFor = useCallback(
    (g: Guest) =>
      renderCard({ src: cardSrc, name: g.name, code: g.code, nameSlot: cfg.invitationArt.nameSlot, codeSlot: cfg.invitationArt.codeSlot, font: nameFont }),
    [cardSrc, nameFont],
  );
  const [cardStep, setCardStep] = useState<Guest | null>(null);

  // WhatsApp Business: when connected, invitations go out from the couple's number without opening WhatsApp.
  const [wa, setWa] = useState<WhatsAppStatus | null>(null);
  const [waSending, setWaSending] = useState<Guest[] | null>(null);
  useEffect(() => {
    api<WhatsAppStatus>('/api/admin/whatsapp').then(setWa, () => {});
  }, []);
  /** Can this guest's invitation go through WhatsApp Business (with their card, if the template needs one)? */
  const viaApi = (g: Guest) =>
    !!wa?.ready && g.channel === 'whatsapp' && !!g.phone && g.rsvp !== 'no' && (!wa.template?.needsImage || (!!cardSrc && getsCard(g)));

  async function saveCard(g: Guest) {
    try {
      download(await cardFor(g), cardFileName(g.name));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Couldn’t create the card');
    }
  }

  /**
   * WhatsApp with the personalised card. The guest's chat always opens with the message (as a link, which
   * can't carry an image, and WhatsApp drops the text when an image is shared). On phones the card then
   * follows from the share sheet; desktop browsers can't share images, so the card is downloaded to attach.
   */
  async function sendWithCard(g: Guest) {
    if (viaApi(g)) return setWaSending([g]);
    return sendFromMyWhatsApp(g);
  }

  /** WhatsApp on this device: the guest's chat opens with the message, then the card follows from the share sheet. */
  async function sendFromMyWhatsApp(g: Guest) {
    window.open(whatsAppHref(g), '_blank', 'noopener'); // open now, while the click still counts as the user's
    if (cardSrc && getsCard(g)) {
      if (canShareImages()) setCardStep(g);
      else {
        await saveCard(g);
        toast.success('Card downloaded. Attach it in the WhatsApp chat that just opened.');
      }
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
      .filter((g) => !needle || [g.name, g.phone, g.email, g.group, g.code, g.table].join(' ').toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [guests, stage, side, q]);

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
  const waPending = guests.filter((g) => viaApi(g) && !g.waMessageId && g.waStatus !== 'failed').sort((a, b) => a.name.localeCompare(b.name));
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
          { href: '/admin/inbox', label: 'Inbox' },
          { href: '/admin/site', label: 'Edit website' },
          { href: '/', label: 'Website', external: true },
          { href: '#church', label: 'Church RSVPs' },
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
          Expected at church <b>{n((g) => g.events.includes('church') && g.rsvp === 'yes')}</b>
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
            </div>

            {waPending.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-[#1f7a4d]/15 px-3 py-2.5 text-[0.85rem]">
                <span>
                  {waPending.length} {waPending.length === 1 ? 'guest hasn’t' : 'guests haven’t'} had their WhatsApp invitation yet
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
                    viaApi={viaApi(g)}
                    onCard={cardSrc && getsCard(g) ? () => saveCard(g) : undefined}
                  />
                ))
              )}
            </div>
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

      <ChurchRsvps rows={data?.church ?? []} onChanged={refresh} />

      <GuestDialog open={editing !== undefined} guest={editing ?? null} groups={groups} onClose={() => setEditing(undefined)} onSaved={refresh} />
      {wa && <WhatsAppSendDialog guests={waSending} wa={wa} render={cardFor} onProgress={refresh} onClose={() => setWaSending(null)} />}
      <SendCardDialog guest={cardStep} render={cardFor} onClose={() => setCardStep(null)} />
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
  viaApi,
  onCard,
}: {
  g: Guest;
  onEdit: () => void;
  onSent: (g: Guest, via: string) => void;
  onDelivered: (g: Guest) => void;
  onSendWhatsApp: () => void;
  /** Send from WhatsApp on this device (message, then card) instead of WhatsApp Business. */
  onMessage: () => void;
  viaApi: boolean;
  onCard?: () => void;
}) {
  const st = stageOf(g);
  const href = sendHref(g);
  const meta = [g.group, g.side === 'bride' ? 'Bride' : g.side === 'groom' ? 'Groom' : 'Shared', g.phone, g.code].filter(Boolean).join(' · ');
  const tags = [
    g.driverCard && 'Driver',
    g.events.length === 1 && (g.events[0] === 'church' ? 'Church only' : 'Reception only'),
    g.cardDelivered && 'Card given',
    g.table && `T${g.table}`,
  ].filter(Boolean) as string[];
  return (
    <div className="grid items-center gap-3 border-t border-hairline-soft px-1 py-3 first:border-0 md:grid-cols-[minmax(0,1fr)_130px_auto]">
      <button type="button" onClick={onEdit} className="min-w-0 cursor-pointer border-0 bg-transparent p-0 text-left">
        <b className="block font-medium [overflow-wrap:anywhere] text-ivory">
          {g.name}
          {tags.map((t) => (
            <Badge key={t} variant="outline" className="ml-1.5 border-gold/30 align-middle text-[0.65rem] font-normal text-ivory-dim">
              {t}
            </Badge>
          ))}
        </b>
        <small className="text-[0.78rem] [overflow-wrap:anywhere] text-ivory-dim">{meta}</small>
        {g.waStatus && (
          <Badge variant="outline" className={cn('mt-1 text-[0.65rem] font-normal', WA_TAG[g.waStatus].className)} title={g.waError || undefined}>
            {WA_TAG[g.waStatus].label}
            {g.waStatus === 'failed' && g.waError ? `: ${g.waError}` : ''}
          </Badge>
        )}
      </button>
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
            <Send /> {(viaApi ? g.waMessageId : g.sentAt) ? 'Resend' : 'Send'} · WhatsApp
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
        <Button size="sm" variant="outline" className="border-gold/40 bg-transparent text-gold" onClick={() => copy(g.link, 'Invitation link copied')}>
          <Link2 /> Link
        </Button>
        {onCard && (
          <Button
            size="sm"
            variant="outline"
            className="border-gold/40 bg-transparent text-gold"
            onClick={onCard}
            title="Download their personalised invitation card"
          >
            <ImageDown /> Card
          </Button>
        )}
      </div>
    </div>
  );
}

/** What the desk knows about the WhatsApp Business connection. */
function WhatsAppPanel({ wa }: { wa: WhatsAppStatus }) {
  const t = wa.template;
  const rows: [string, string][] = [
    ['From', [wa.phone?.display_phone_number, wa.phone?.verified_name].filter(Boolean).join(' · ') || '—'],
    ['Template', t ? `${t.name} · ${t.language} · ${t.fallback ? 'not read from Meta' : `${t.category.toLowerCase()}, ${t.status.toLowerCase()}`}` : '—'],
    ['Card', t?.needsImage ? 'Each guest’s card goes with their message' : 'No image in the template'],
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
              <dd className="m-0 [overflow-wrap:anywhere]">{v}</dd>
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

function ChurchRsvps({ rows, onChanged }: { rows: ChurchRsvp[]; onChanged: () => void }) {
  const [armed, setArmed] = useState<string | null>(null);
  const yes = rows.filter((r) => r.attending === 'yes');
  const people = yes.reduce((s, r) => s + (Number(r.party) || 0), 0);
  const sorted = [...rows].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return (
    <Card id="church" className="mt-4 scroll-mt-4 gap-3 border-hairline-soft bg-navy-2/60 py-4">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 px-4">
        <CardTitle className="ui-caps text-[0.72rem] text-ivory-dim">Church wedding · public RSVPs</CardTitle>
        <Button asChild size="sm" variant="outline" className="border-gold/40 bg-transparent text-gold">
          <a href="/api/admin/church.csv">
            <Download /> Export
          </a>
        </Button>
      </CardHeader>
      <CardContent className="grid gap-2 px-4">
        <p className="m-0 flex flex-wrap gap-x-6 text-[0.82rem] text-ivory-dim [&_b]:text-ivory">
          <span>
            Replies <b>{rows.length}</b>
          </span>
          <span>
            Attending <b>{yes.length}</b>
          </span>
          <span>
            Expected people <b>{people}</b>
          </span>
          <span>
            Declined <b>{rows.length - yes.length}</b>
          </span>
        </p>
        <Table>
          <TableHeader>
            <TableRow className="border-hairline-soft">
              {['Name', 'Phone', 'Reply', 'Party', 'Note', 'When', ''].map((h) => (
                <TableHead key={h} className="text-[0.7rem] tracking-[0.14em] text-ivory-dim uppercase">
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length ? (
              sorted.map((r) => (
                <TableRow key={r.id} className="border-hairline-soft">
                  <TableCell>
                    {r.name}
                    {r.email && <small className="block text-ivory-dim">{r.email}</small>}
                  </TableCell>
                  <TableCell className="tabular-nums">{r.phone}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={r.attending === 'yes' ? PILL.yes.className : PILL.no.className}>
                      {r.attending === 'yes' ? 'Attending' : 'Declined'}
                    </Badge>
                  </TableCell>
                  <TableCell className="tabular-nums">{r.attending === 'yes' ? r.party : '–'}</TableCell>
                  <TableCell className="max-w-[260px] whitespace-normal text-ivory-dim">{r.note}</TableCell>
                  <TableCell className="text-ivory-dim">{ago(r.updatedAt || r.createdAt)}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-bad hover:bg-bad/10 hover:text-bad"
                      aria-label={`Remove ${r.name}`}
                      onClick={async () => {
                        if (armed !== r.id) {
                          setArmed(r.id);
                          setTimeout(() => setArmed((a) => (a === r.id ? null : a)), 3000);
                          return;
                        }
                        await api(`/api/admin/church/${encodeURIComponent(r.id)}`, { method: 'DELETE' });
                        toast.success('Removed');
                        onChanged();
                      }}
                    >
                      <Trash2 /> {armed === r.id ? 'Confirm' : 'Remove'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="py-6 text-center text-ivory-dim">
                  No church RSVPs. The public RSVP is switched off, so guests reply on their private invitations.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
