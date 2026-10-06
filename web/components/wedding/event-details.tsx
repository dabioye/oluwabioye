import type { WeddingEvent } from '@/lib/config';
import { longDate, weekday } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Date, time, event and venue, centred under an invitation card, with its buttons below. */
export function EventDetails({ ev, date, children, className }: { ev: WeddingEvent; date: string; children?: React.ReactNode; className?: string }) {
  return (
    <section aria-label={`${ev.name}: date, time and place`} className={cn('mx-auto mt-6 max-w-[460px] text-center', className)}>
      <div className="eyebrow">
        {weekday(date)} · {longDate(date)}
      </div>
      <div className="mt-3 font-display text-[clamp(1.5rem,5vw,1.9rem)] leading-none text-gold">{ev.time}</div>
      <h2 className="mt-2 mb-0 font-display text-[clamp(1.2rem,4vw,1.45rem)] font-medium tracking-wide">{ev.name}</h2>
      <p className="mx-0 mt-2 mb-0 leading-snug text-ivory-dim">
        <span className="text-foreground">{ev.venue}</span>
        <br />
        {ev.venueLine2}
        <br />
        {ev.address}
      </p>
      {children && <div className="mt-6 flex flex-wrap justify-center gap-3">{children}</div>}
    </section>
  );
}
