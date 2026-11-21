'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { cfg } from '@/lib/config';
import { longDate, weekday } from '@/lib/format';
import type { Guest } from '@/lib/types';
import { cn } from '@/lib/utils';
import { StaffHeader, StaffPage } from '../staff-shell';

type Who = 'invited' | 'attending';
const UNASSIGNED = '';

/** Table names in the order people expect: 1, 2, … 10, then named tables ("High table") A to Z. */
const byTable = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });
const label = (t: string) => (/^\d+$/.test(t) ? `Table ${t}` : t);

/**
 * The reception seating: every guest invited to the reception who hasn't declined, by table, with who is still
 * to be placed. A guest's table can be changed right here; the gate and their access card show it.
 */
export function Tables() {
  const [guests, setGuests] = useState<Guest[] | null>(null);
  const [who, setWho] = useState<Who>('invited');

  const load = useCallback(() => api<{ guests: Guest[] }>('/api/admin/guests').then((d) => setGuests(d.guests)), []);
  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(
    () => (guests ?? []).filter((g) => g.events.includes('trad') && g.rsvp !== 'no' && (who === 'invited' || g.rsvp === 'yes')),
    [guests, who],
  );
  const tables = useMemo(() => {
    const by = new Map<string, Guest[]>();
    shown.forEach((g) => {
      const t = g.table.trim();
      by.set(t, [...(by.get(t) ?? []), g]);
    });
    by.forEach((gs) => gs.sort((a, b) => a.name.localeCompare(b.name)));
    return [...by]
      .filter(([t]) => t !== UNASSIGNED)
      .sort(([a], [b]) => byTable(a, b))
      .map(([table, gs]) => ({ table, guests: gs }));
  }, [shown]);
  const unassigned = shown.filter((g) => !g.table.trim()).sort((a, b) => a.name.localeCompare(b.name));
  const names = tables.map((t) => t.table);

  async function move(g: Guest, table: string) {
    const t = table.trim().slice(0, 20);
    if (t === g.table.trim()) return;
    try {
      await api(`/api/admin/guests/${g.id}`, { method: 'PATCH', body: { table: t } });
      toast.success(t ? `${g.name} → ${label(t)}` : `${g.name} unassigned`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Couldn’t change the table');
    }
  }

  return (
    <StaffPage>
      <StaffHeader
        title="Table plan"
        subtitle={`${cfg.events.trad.name} · ${weekday()} ${longDate(cfg.date)}`}
        links={[
          { href: '/admin', label: 'Invitation desk' },
          { href: '/admin/gate-list', label: 'Gate list' },
        ]}
        signOutTo="/admin"
      />

      {!guests ? (
        <Loader2 className="mx-auto mt-16 animate-spin text-gold" aria-label="Loading" />
      ) : (
        <>
          <div className="no-print mt-4 flex flex-wrap items-center gap-3">
            <p className="m-0 mr-auto text-[0.88rem] text-ivory-dim">
              <b className="text-ivory">{tables.length}</b> tables · <b className="text-ivory">{shown.length - unassigned.length}</b> invitations seated ·{' '}
              <b className={unassigned.length ? 'text-warn' : 'text-ivory'}>{unassigned.length}</b> still to place. Counts are invitations, not people: a couple
              on one invitation is one line.
            </p>
            <div role="radiogroup" aria-label="Who to show" className="inline-flex rounded-md border border-gold/30 p-0.5">
              {(
                [
                  ['invited', 'All not declined'],
                  ['attending', 'Attending only'],
                ] as const
              ).map(([k, text]) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={who === k}
                  onClick={() => setWho(k)}
                  className={cn('cursor-pointer rounded border-0 px-3 py-1.5 text-[0.8rem]', who === k ? 'bg-gold text-navy' : 'bg-transparent text-ivory-dim')}
                >
                  {text}
                </button>
              ))}
            </div>
            <Button variant="outline" className="border-gold/40 bg-transparent text-gold" onClick={() => window.print()}>
              <Printer /> Print
            </Button>
          </div>

          <datalist id="table-names">
            {names.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>

          {unassigned.length > 0 && (
            <Card className="mt-4 gap-0 border-warn/40 bg-navy-2/60 py-0" aria-label="Still to place">
              <CardHeader className="border-b border-hairline-soft px-4 py-3 [.border-b]:pb-3">
                <CardTitle className="ui-caps text-[0.72rem] text-warn">Still to place ({unassigned.length})</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-0 p-0">
                {unassigned.map((g) => (
                  <SeatRow key={g.id} g={g} onMove={move} />
                ))}
              </CardContent>
            </Card>
          )}

          <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3 print:grid-cols-3">
            {tables.map(({ table, guests: gs }) => {
              const yes = gs.filter((g) => g.rsvp === 'yes').length;
              return (
                <Card key={table} className="gap-0 border-hairline-soft bg-navy-2/60 py-0 break-inside-avoid" aria-label={label(table)}>
                  <CardHeader className="border-b border-hairline-soft px-4 py-3 [.border-b]:pb-3">
                    <CardTitle className="flex items-baseline justify-between gap-2">
                      <span className="font-display text-lg font-medium text-gold">{label(table)}</span>
                      <small className="text-[0.75rem] text-ivory-dim tabular-nums">
                        {gs.length} · {yes} attending
                      </small>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-0 p-0">
                    {gs.map((g) => (
                      <SeatRow key={g.id} g={g} onMove={move} />
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {tables.length === 0 && !unassigned.length && <p className="mt-8 text-center text-ivory-dim">No reception guests yet.</p>}
        </>
      )}
    </StaffPage>
  );
}

function SeatRow({ g, onMove }: { g: Guest; onMove: (g: Guest, table: string) => void }) {
  const [value, setValue] = useState(g.table);
  return (
    <div className="flex items-center justify-between gap-2 border-b border-hairline-soft px-4 py-2 last:border-0">
      <span className="min-w-0">
        <span className="block [overflow-wrap:anywhere] text-ivory">{g.name}</span>
        <small className="flex flex-wrap gap-1.5 text-[0.72rem] text-ivory-dim">
          {g.rsvp === 'yes' ? 'Attending' : 'No reply'}
          {g.honour && (
            <Badge variant="outline" className="border-gold/50 text-[0.65rem] font-normal text-gold">
              {g.honour}
            </Badge>
          )}
        </small>
      </span>
      <form
        className="no-print shrink-0"
        onSubmit={(e) => {
          e.preventDefault();
          onMove(g, value);
        }}
      >
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => onMove(g, value)}
          list="table-names"
          maxLength={20}
          placeholder="Table"
          aria-label={`Table for ${g.name}`}
          className="h-8 w-24 text-center text-[0.85rem]"
        />
      </form>
    </div>
  );
}
