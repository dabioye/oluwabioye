import { CircleAlert, CircleCheck, CircleX, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { clock } from '@/lib/format';
import { cn } from '@/lib/utils';

export type GateGuest = { name: string; code: string; table?: string; driverCard?: boolean };
export type GateResult = { status: 'ok' | 'repeat' | 'declined' | 'missing' | 'undone'; guest?: GateGuest; already?: string; code?: string };

const TONE = {
  ok: ['border-ok/60 bg-ok/15', 'text-ok', CircleCheck],
  repeat: ['border-warn/60 bg-warn/15', 'text-warn', CircleAlert],
  undone: ['border-warn/60 bg-warn/15', 'text-warn', Undo2],
  declined: ['border-bad/60 bg-bad/15', 'text-bad', CircleX],
  missing: ['border-bad/60 bg-bad/15', 'text-bad', CircleX],
} as const;

/** The big coloured answer the usher sees after a scan. */
export function GateResultPanel({ res, onUndo }: { res: GateResult; onUndo?: () => void }) {
  const g = res.guest;
  const extra = g ? [g.table && `Table ${g.table}`, g.driverCard && 'Driver meal card'].filter(Boolean).join(' · ') : '';
  const [box, text, Icon] = TONE[res.status];
  const title = { ok: 'Welcome', repeat: 'Already checked in', declined: 'Declined invitation', missing: 'Not on the list', undone: 'Check-in undone' }[
    res.status
  ];
  const body = {
    ok: g?.name,
    repeat: `${g?.name} came in at ${res.already ? clock(res.already) : 'an earlier time'}. This card may have been shared. Check ID before admitting.`,
    declined: `${g?.name} said they would not attend. Call the planning team before admitting.`,
    missing: `No invitation matches “${res.code}”.`,
    undone: g?.name,
  }[res.status];
  return (
    <section aria-live="assertive" className={cn('mt-4 rounded-lg border-2 p-5 text-center motion-safe:animate-in motion-safe:zoom-in-95', box)}>
      <Icon className={cn('mx-auto size-10', text)} aria-hidden />
      <b className={cn('mt-2 block font-display text-[1.7rem] font-medium', text)}>{title}</b>
      <p className="m-0 mt-1 text-lg text-ivory">{body}</p>
      {res.status === 'ok' && extra && <p className="m-0 mt-1 text-ivory-dim">{extra}</p>}
      {res.status === 'ok' && onUndo && (
        <Button variant="outline" size="sm" className="mt-3 border-gold/50 bg-transparent text-gold" onClick={onUndo}>
          <Undo2 /> Undo
        </Button>
      )}
    </section>
  );
}
