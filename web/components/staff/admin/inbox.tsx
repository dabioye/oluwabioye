'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, CheckCheck, Clock, Loader2, Send, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { api, ApiError } from '@/lib/api';
import { ago, clock } from '@/lib/format';
import type { InboxConversation, InboxMessage, InboxThread } from '@/lib/types';
import { cn } from '@/lib/utils';
import { StaffHeader, StaffPage } from '../staff-shell';

const threadFromUrl = () => (typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('thread'));
const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' });

/** How long free-text replies are still allowed, in words. */
function windowLeft(until: string | null) {
  if (!until) return null;
  const ms = new Date(until).getTime() - Date.now();
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3600e3);
  return h >= 1 ? `${h} hour${h === 1 ? '' : 's'}` : `${Math.max(1, Math.round(ms / 60e3))} minutes`;
}

/** Guests' WhatsApp replies, and answers typed here while their 24-hour window is open. */
export function Inbox() {
  const [threads, setThreads] = useState<InboxThread[] | null>(null);
  const [configured, setConfigured] = useState(true);
  const [open, setOpen] = useState<string | null>(threadFromUrl);

  const loadThreads = useCallback(
    () =>
      api<{ threads: InboxThread[]; configured: boolean }>('/api/admin/inbox').then(
        (d) => {
          setThreads(d.threads);
          setConfigured(d.configured);
        },
        (e) => (e instanceof ApiError && e.status === 401 ? location.reload() : toast.error('Couldn’t load the inbox')),
      ),
    [],
  );
  useEffect(() => {
    loadThreads();
    const i = setInterval(() => !document.hidden && loadThreads(), 15_000);
    return () => clearInterval(i);
  }, [loadThreads]);

  function select(thread: string | null) {
    setOpen(thread);
    history.replaceState(null, '', thread ? `?thread=${encodeURIComponent(thread)}` : location.pathname);
  }

  const unread = threads?.reduce((n, t) => n + t.unread, 0) ?? 0;
  return (
    <StaffPage>
      <StaffHeader
        title="Inbox"
        subtitle={unread ? `${unread} unread ${unread === 1 ? 'reply' : 'replies'}` : 'Guests’ WhatsApp replies'}
        links={[
          { href: '/admin', label: 'Invitation desk' },
          { href: '/admin/site', label: 'Edit website' },
        ]}
        signOutTo="/admin"
      />
      {!configured && (
        <p className="mt-4 rounded-md bg-warn/10 px-3 py-2 text-[0.85rem] text-warn">
          WhatsApp API isn’t connected, so new replies won’t arrive and you can’t answer from here.
        </p>
      )}
      <div className="mt-4 grid items-start gap-4 md:grid-cols-[320px_minmax(0,1fr)]">
        <Card className={cn('gap-0 border-hairline-soft bg-navy-2/60 py-0', open && 'max-md:hidden')}>
          <CardContent className="p-0">
            {!threads ? (
              <p className="p-6 text-center text-ivory-dim">Loading…</p>
            ) : threads.length === 0 ? (
              <p className="p-6 text-center text-ivory-dim">No replies yet. When a guest answers their WhatsApp invitation, it shows up here.</p>
            ) : (
              <ul className="m-0 list-none p-0" aria-label="Conversations">
                {threads.map((t) => (
                  <li key={t.thread} className="border-b border-hairline-soft last:border-0">
                    <button
                      type="button"
                      onClick={() => select(t.thread)}
                      aria-current={open === t.thread}
                      className={cn(
                        'grid w-full cursor-pointer gap-0.5 border-0 bg-transparent px-4 py-3 text-left hover:bg-gold/5',
                        open === t.thread && 'bg-gold/10',
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <b className={cn('truncate font-medium text-ivory', t.unread && 'text-gold')}>{t.name}</b>
                        <small className="shrink-0 text-[0.72rem] text-ivory-dim">{ago(t.last.at)}</small>
                      </span>
                      <span className="flex items-center justify-between gap-2">
                        <small className="truncate text-[0.8rem] text-ivory-dim">
                          {t.last.dir === 'out' && 'You: '}
                          {t.last.text}
                        </small>
                        {t.unread > 0 && <Badge className="h-5 min-w-5 justify-center bg-gold px-1.5 text-navy">{t.unread}</Badge>}
                      </span>
                      {!t.guestId && <small className="text-[0.7rem] text-warn">Not on the guest list · +{t.phone}</small>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {open ? (
          <Conversation key={open} thread={open} onBack={() => select(null)} onChanged={loadThreads} />
        ) : (
          <p className="text-center text-ivory-dim max-md:hidden md:pt-16">Choose a conversation.</p>
        )}
      </div>
    </StaffPage>
  );
}

function Conversation({ thread, onBack, onChanged }: { thread: string; onBack: () => void; onChanged: () => void }) {
  const [c, setC] = useState<InboxConversation | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const count = c?.messages.length ?? 0;

  const load = useCallback(
    () =>
      api<InboxConversation>(`/api/admin/inbox/${encodeURIComponent(thread)}`).then(
        (d) => {
          setC(d);
          onChanged();
        },
        (e) => toast.error(e instanceof Error ? e.message : 'Couldn’t load the conversation'),
      ),
    [thread, onChanged],
  );
  useEffect(() => {
    load();
    const i = setInterval(() => !document.hidden && load(), 10_000);
    return () => clearInterval(i);
  }, [load]);
  useEffect(() => end.current?.scrollIntoView({ block: 'end' }), [count]);

  async function send(e?: { preventDefault: () => void }) {
    e?.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      const m = await api<InboxMessage>(`/api/admin/inbox/${encodeURIComponent(thread)}/reply`, { body: { text } });
      setC((x) => (x ? { ...x, messages: [...x.messages, m] } : x));
      setText('');
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t send');
    } finally {
      setSending(false);
    }
  }

  const left = windowLeft(c?.windowUntil ?? null);
  return (
    <Card role="region" className="gap-0 border-hairline-soft bg-navy-2/60 py-0" aria-label={c ? `Conversation with ${c.name}` : 'Conversation'}>
      <div className="flex items-center gap-3 border-b border-hairline-soft px-4 py-3">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack} aria-label="Back to conversations">
          <ArrowLeft />
        </Button>
        <div className="min-w-0">
          <h1 className="m-0 truncate font-display text-lg font-medium text-gold">{c?.name ?? '…'}</h1>
          {c && (
            <small className="text-[0.78rem] text-ivory-dim">
              +{c.phone}
              {c.guest && (
                <>
                  {' · '}code {c.guest.code} · {c.guest.rsvp === 'yes' ? 'attending' : c.guest.rsvp === 'no' ? 'not attending' : 'no RSVP yet'}
                </>
              )}
            </small>
          )}
        </div>
      </div>

      <div className="grid max-h-[60vh] min-h-64 content-start gap-2 overflow-y-auto bg-[#0b141a] px-3 py-4" role="log" aria-label="Messages">
        {!c ? (
          <Loader2 role="img" className="mx-auto animate-spin text-gold" aria-label="Loading" />
        ) : (
          c.messages.map((m, i) => (
            <div key={m.id} className="contents">
              {(i === 0 || day(c.messages[i - 1].at) !== day(m.at)) && (
                <small className="mx-auto my-1 rounded bg-white/5 px-2 py-0.5 text-[0.7rem] text-ivory-dim">{day(m.at)}</small>
              )}
              <Bubble m={m} />
            </div>
          ))
        )}
        <div ref={end} />
      </div>

      <form onSubmit={send} className="grid gap-2 border-t border-hairline-soft p-3">
        {c && !left ? (
          <p className="m-0 text-[0.82rem] text-ivory-dim">
            {c.windowUntil
              ? 'The 24-hour window has closed. WhatsApp only allows a template until they write again, so answer from your phone if it can’t wait.'
              : 'They haven’t written yet. You can reply once they message you.'}
          </p>
        ) : (
          <>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(e);
              }}
              rows={2}
              placeholder="Write a reply"
              aria-label="Reply"
              disabled={!c || sending}
            />
            <div className="flex items-center justify-between gap-3">
              <small className="text-[0.75rem] text-ivory-dim">{left && `You can reply freely for ${left} more.`}</small>
              <Button type="submit" disabled={!text.trim() || sending} className="bg-[#1f7a4d] text-white hover:bg-[#25915b]">
                {sending ? <Loader2 className="animate-spin" /> : <Send />} Send
              </Button>
            </div>
          </>
        )}
      </form>
    </Card>
  );
}

function Bubble({ m }: { m: InboxMessage }) {
  const out = m.dir === 'out';
  const Tick = m.status === 'read' || m.status === 'delivered' ? CheckCheck : m.status === 'sent' ? Check : m.status === 'failed' ? TriangleAlert : Clock;
  return (
    <div
      className={cn(
        'max-w-[80%] rounded-lg px-2.5 py-1.5 text-[0.88rem] text-[#e9edef]',
        out ? 'ml-auto rounded-tr-none bg-[#005c4b]' : 'mr-auto rounded-tl-none bg-[#202c33]',
      )}
    >
      <p className="m-0 whitespace-pre-wrap [overflow-wrap:anywhere]">{m.text}</p>
      <small className="mt-0.5 flex items-center justify-end gap-1 text-[0.68rem] text-[#e9edef]/60">
        {clock(m.at)}
        {out && (
          <Tick className={cn('size-3.5', m.status === 'read' && 'text-[#53bdeb]', m.status === 'failed' && 'text-bad')} role="img" aria-label={m.status} />
        )}
      </small>
      {m.status === 'failed' && m.error && <small className="block text-[0.7rem] text-bad">{m.error}</small>}
    </div>
  );
}
