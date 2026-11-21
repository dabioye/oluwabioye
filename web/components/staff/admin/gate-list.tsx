'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { cfg } from '@/lib/config';
import { clock, longDate, weekday } from '@/lib/format';
import type { Guest } from '@/lib/types';
import { cn } from '@/lib/utils';

type Who = 'attending' | 'invited';

/** The first letter a name is filed under, ignoring titles, so "Mr. Tunde Bello" is under T. */
const TITLES =
  /^(mr|mrs|ms|miss|dr|prof|chief|pastor|rev|deacon|dcn|engr|alhaji|alhaja|hon|barr|sir|lady|elder|evang|arc|pst)\.?\s+(&\s*(mr|mrs|ms|dr)\.?\s+)?/i;
const fileUnder = (name: string) => (name.replace(TITLES, '').trim()[0] || '#').toUpperCase();
const sortKey = (name: string) => name.replace(TITLES, '').trim().toLowerCase();

/**
 * The paper fallback for the gate: everyone invited to the reception, A to Z, with their code, table and
 * driver card, and a box to tick. Printed the night before, it lets ushers carry on if phones or the
 * connection fail.
 */
export function GateList() {
  const [guests, setGuests] = useState<Guest[] | null>(null);
  const [error, setError] = useState('');
  const [who, setWho] = useState<Who>('invited');
  const [printedAt, setPrintedAt] = useState('');

  useEffect(() => {
    api<{ guests: Guest[] }>('/api/admin/guests').then(
      (d) => {
        setGuests(d.guests);
        setPrintedAt(new Date().toISOString());
      },
      (e) => setError(e instanceof Error ? e.message : 'Couldn’t load the guest list'),
    );
  }, []);

  const list = useMemo(
    () =>
      (guests ?? [])
        .filter((g) => g.events.includes('trad') && g.rsvp !== 'no' && (who === 'invited' || g.rsvp === 'yes'))
        .sort((a, b) => sortKey(a.name).localeCompare(sortKey(b.name))),
    [guests, who],
  );
  const groups = useMemo(() => {
    const out: { letter: string; guests: Guest[] }[] = [];
    for (const g of list) {
      const letter = fileUnder(g.name);
      if (out.at(-1)?.letter !== letter) out.push({ letter, guests: [] });
      out.at(-1)!.guests.push(g);
    }
    return out;
  }, [list]);
  const attending = list.filter((g) => g.rsvp === 'yes').length;
  const drivers = list.filter((g) => g.driverCard).length;

  return (
    <div className="gate-list min-h-screen bg-[#f6f3ec] text-[#1b1b1b] print:bg-white">
      <div className="no-print sticky top-0 z-10 border-b border-black/10 bg-[#f6f3ec]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[900px] flex-wrap items-center gap-2 px-4 py-3 font-ui">
          <Link href="/admin" className="mr-auto inline-flex items-center gap-1.5 text-[0.9rem] text-[#1b1b1b] no-underline hover:underline">
            <ArrowLeft className="size-4" /> Invitation desk
          </Link>
          <div role="radiogroup" aria-label="Who to list" className="inline-flex rounded-md border border-black/20 p-0.5">
            {(
              [
                ['invited', 'All not declined'],
                ['attending', 'Attending only'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={who === k}
                onClick={() => setWho(k)}
                className={cn(
                  'cursor-pointer rounded border-0 px-3 py-1.5 text-[0.85rem]',
                  who === k ? 'bg-[#14213a] text-white' : 'bg-transparent text-[#1b1b1b]',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <Button onClick={() => window.print()} disabled={!guests} className="bg-[#14213a] text-white hover:bg-[#22345a]">
            <Printer /> Print
          </Button>
        </div>
      </div>

      <main className="mx-auto max-w-[900px] px-4 py-6 print:max-w-none print:p-0">
        <header className="mb-4 border-b-2 border-black pb-3">
          <h1 className="m-0 font-ui text-[1.5rem] font-semibold">Gate list · {cfg.events.trad.name}</h1>
          <p className="m-0 mt-1 font-ui text-[0.9rem]">
            {weekday()} {longDate(cfg.date)} · {cfg.events.trad.time} · {cfg.events.trad.venue}
          </p>
          {guests && (
            <p className="m-0 mt-1 font-ui text-[0.85rem] text-black/70">
              {list.length} guests{who === 'invited' ? ` (${attending} attending, ${list.length - attending} no reply yet)` : ''} · {drivers} with a driver card
              · printed {longDate(printedAt.slice(0, 10))} at {clock(printedAt)}. Tick the box as each guest arrives; check the code on their access card.
            </p>
          )}
        </header>

        {error ? (
          <p role="alert" className="font-ui text-[#b3261e]">
            {error}
          </p>
        ) : !guests ? (
          <Loader2 className="mx-auto mt-16 animate-spin" aria-label="Loading" />
        ) : list.length === 0 ? (
          <p className="font-ui">No one to list yet.</p>
        ) : (
          <table className="w-full border-collapse font-ui text-[0.9rem] print:text-[10pt]" aria-label="Gate list">
            <thead>
              <tr className="border-b border-black text-left text-[0.75rem] tracking-wide uppercase">
                <th className="w-8 py-1.5" aria-label="Arrived" />
                <th className="py-1.5">Name</th>
                <th className="py-1.5">Code</th>
                <th className="py-1.5">Table</th>
                <th className="py-1.5">RSVP</th>
                <th className="py-1.5">Notes</th>
              </tr>
            </thead>
            {groups.map(({ letter, guests: gs }) => (
              <tbody key={letter} className="break-inside-avoid-page">
                <tr>
                  <th colSpan={6} scope="rowgroup" className="pt-3 pb-1 text-left text-[1.05rem] font-semibold">
                    {letter}
                  </th>
                </tr>
                {gs.map((g) => (
                  <tr key={g.id} className="break-inside-avoid border-b border-black/15">
                    <td className="py-1.5 align-top">
                      <span aria-hidden className="inline-block size-4 border-[1.5px] border-black align-middle" />
                    </td>
                    <td className="py-1.5 pr-2 align-top font-medium">{g.name}</td>
                    <td className="py-1.5 pr-2 align-top font-mono tracking-wider">{g.code}</td>
                    <td className="py-1.5 pr-2 align-top">{g.table || '—'}</td>
                    <td className="py-1.5 pr-2 align-top">{g.rsvp === 'yes' ? 'Attending' : 'No reply'}</td>
                    <td className="py-1.5 align-top text-[0.85em]">
                      {[g.honour && `${g.honour}, please escort`, g.driverCard && 'Driver card', g.checkedInAt && `Arrived ${clock(g.checkedInAt)}`]
                        .filter(Boolean)
                        .join(' · ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        )}
      </main>
    </div>
  );
}
