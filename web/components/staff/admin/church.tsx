'use client';
import { useCallback, useEffect, useState } from 'react';
import { Download, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api, ApiError } from '@/lib/api';
import { cfg } from '@/lib/config';
import { ago, longDate, weekday } from '@/lib/format';
import type { ChurchRsvp } from '@/lib/types';
import { StaffHeader, StaffPage } from '../staff-shell';
import { PILL } from './model';

/**
 * Who said at /rsvp on the website that they're coming to church. Kept apart from the invitation desk,
 * whose numbers are the private (traditional wedding) invitations, so the two are never added together.
 */
export function ChurchRsvps() {
  const [rows, setRows] = useState<ChurchRsvp[] | null>(null);
  const load = useCallback(
    () =>
      api<{ church: ChurchRsvp[] }>('/api/admin/church').then(
        (d) => setRows(d.church),
        (e) => (e instanceof ApiError && e.status === 401 ? location.reload() : toast.error('Couldn’t load the church RSVPs')),
      ),
    [],
  );
  useEffect(() => {
    load();
    const i = setInterval(() => !document.hidden && load(), 30_000);
    return () => clearInterval(i);
  }, [load]);

  return (
    <StaffPage>
      <StaffHeader
        title="Church RSVPs"
        subtitle={`${cfg.events.church.name} · ${weekday()} ${longDate(cfg.date)} · from the website`}
        links={[
          { href: '/admin', label: 'Invitation desk' },
          { href: '/admin/wishes', label: 'Wishes' },
          { href: '/admin/site', label: 'Edit website' },
          { href: '/rsvp', label: 'RSVP page', external: true },
        ]}
        signOutTo="/admin"
      />
      <p className="mt-4 mb-0 max-w-[60em] text-[0.88rem] text-ivory-dim">
        Replies to the public RSVP at /rsvp on the website. These are separate from the private invitations on the invitation desk, so the numbers here don’t
        include invited guests. Open or close the RSVP in Edit website.
      </p>
      {rows ? <ChurchList rows={rows} onChanged={load} /> : <Loader2 className="mx-auto mt-16 animate-spin text-gold" aria-label="Loading" />}
    </StaffPage>
  );
}

function ChurchList({ rows, onChanged }: { rows: ChurchRsvp[]; onChanged: () => void }) {
  const [armed, setArmed] = useState<string | null>(null);
  const yes = rows.filter((r) => r.attending === 'yes');
  const people = yes.reduce((s, r) => s + (Number(r.party) || 0), 0);
  const sorted = [...rows].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return (
    <Card className="mt-4 gap-3 border-hairline-soft bg-navy-2/60 py-4">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 px-4">
        <CardTitle className="ui-caps text-[0.72rem] text-ivory-dim">Replies from the website</CardTitle>
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
                  No church RSVPs yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
