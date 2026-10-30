'use client';
import { useCallback, useEffect, useState } from 'react';
import { Check, EyeOff, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { api, ApiError } from '@/lib/api';
import { ago } from '@/lib/format';
import type { Wish } from '@/lib/types';
import { cn } from '@/lib/utils';
import { StaffHeader, StaffPage } from '../staff-shell';

type Tab = Wish['status'];
const TABS: { key: Tab; label: string }[] = [
  { key: 'pending', label: 'Waiting' },
  { key: 'approved', label: 'On the website' },
  { key: 'hidden', label: 'Hidden' },
];
const PILL: Record<Tab, string> = {
  pending: 'border-warn/60 text-warn',
  approved: 'border-ok/60 bg-ok/10 text-ok',
  hidden: 'border-ivory-dim/40 text-ivory-dim',
};

/** Wishes left on the public website: approve them to show them there, hide them, or delete them. */
export function WishesDesk() {
  const [wishes, setWishes] = useState<Wish[] | null>(null);
  const [tab, setTab] = useState<Tab>('pending');
  const [busy, setBusy] = useState<string | null>(null);
  const [armed, setArmed] = useState<string | null>(null);

  const load = useCallback(
    () =>
      api<{ wishes: Wish[] }>('/api/admin/wishes').then(
        (d) => setWishes(d.wishes),
        (e) => (e instanceof ApiError && e.status === 401 ? location.reload() : toast.error('Couldn’t load the wishes')),
      ),
    [],
  );
  useEffect(() => {
    load();
    const i = setInterval(() => !document.hidden && load(), 30_000);
    return () => clearInterval(i);
  }, [load]);

  async function act(w: Wish, action: Tab | 'delete') {
    setBusy(w.id + action);
    try {
      if (action === 'delete') await api(`/api/admin/wishes/${encodeURIComponent(w.id)}`, { method: 'DELETE' });
      else await api(`/api/admin/wishes/${encodeURIComponent(w.id)}`, { method: 'PATCH', body: { status: action } });
      toast.success(
        action === 'approved'
          ? `${w.name}’s wish is on the website`
          : action === 'hidden'
            ? 'Hidden from the website'
            : action === 'delete'
              ? 'Deleted'
              : 'Moved back to waiting',
      );
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Couldn’t save that');
    } finally {
      setBusy(null);
      setArmed(null);
    }
  }

  const count = (t: Tab) => wishes?.filter((w) => w.status === t).length ?? 0;
  const list = wishes?.filter((w) => w.status === tab) ?? [];
  const pending = count('pending');

  return (
    <StaffPage>
      <StaffHeader
        title="Wishes"
        subtitle={pending ? `${pending} waiting for approval` : 'Messages from the website'}
        links={[
          { href: '/admin', label: 'Invitation desk' },
          { href: '/admin/church', label: 'Church RSVPs' },
          { href: '/admin/inbox', label: 'Inbox' },
          { href: '/#wishes', label: 'View on website', external: true },
        ]}
        signOutTo="/admin"
      />
      <p className="mt-4 mb-0 max-w-[60em] text-[0.88rem] text-ivory-dim">
        Guests leave these at the bottom of the home page. A wish only shows on the website after you approve it, and it appears there within about a minute.
      </p>
      <div role="tablist" aria-label="Wishes" className="mt-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'cursor-pointer rounded-full border px-4 py-2 font-ui text-[0.84rem] transition-colors',
              tab === t.key ? 'border-gold bg-gold text-navy' : 'border-gold/40 bg-transparent text-ivory hover:border-gold',
            )}
          >
            {t.label} <b className="tabular-nums">{count(t.key)}</b>
          </button>
        ))}
      </div>

      {!wishes ? (
        <Loader2 className="mx-auto mt-16 animate-spin text-gold" aria-label="Loading" />
      ) : list.length === 0 ? (
        <p className="mt-10 text-center text-ivory-dim">
          {tab === 'pending' ? 'No wishes waiting. New ones will appear here.' : tab === 'approved' ? 'No wishes on the website yet.' : 'Nothing hidden.'}
        </p>
      ) : (
        <ul className="mt-4 grid list-none gap-3 p-0">
          {list.map((w) => (
            <li key={w.id}>
              <Card className="gap-3 border-hairline-soft bg-navy-2/60 py-4">
                <CardContent className="grid gap-3 px-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <b className="text-ivory">{w.name}</b>
                    <span className="flex items-center gap-2 text-[0.8rem] text-ivory-dim">
                      <Badge variant="outline" className={PILL[w.status]}>
                        {TABS.find((t) => t.key === w.status)?.label}
                      </Badge>
                      {ago(w.createdAt)}
                    </span>
                  </div>
                  <p className="m-0 font-body text-lg leading-snug whitespace-pre-line text-ivory">{w.message}</p>
                  <div className="flex flex-wrap gap-2">
                    {w.status !== 'approved' && (
                      <Button size="sm" disabled={!!busy} onClick={() => act(w, 'approved')}>
                        {busy === w.id + 'approved' ? <Loader2 className="animate-spin" /> : <Check />} Approve
                      </Button>
                    )}
                    {w.status !== 'hidden' && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!!busy}
                        className="border-gold/40 bg-transparent text-gold"
                        onClick={() => act(w, 'hidden')}
                      >
                        <EyeOff /> Hide
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={!!busy}
                      className="text-bad hover:bg-bad/10 hover:text-bad"
                      aria-label={armed === w.id ? `Confirm deleting ${w.name}’s wish` : `Delete ${w.name}’s wish`}
                      onClick={() => {
                        if (armed !== w.id) {
                          setArmed(w.id);
                          setTimeout(() => setArmed((a) => (a === w.id ? null : a)), 3000);
                          return;
                        }
                        act(w, 'delete');
                      }}
                    >
                      <Trash2 /> {armed === w.id ? 'Confirm' : 'Delete'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </StaffPage>
  );
}
