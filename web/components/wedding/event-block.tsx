import { CalendarPlus, MapPin } from 'lucide-react';
import type { WeddingEvent } from '@/lib/config';

/** One line of the order of the day: time, name, venue and quick links. */
export function EventBlock({ ev }: { ev: WeddingEvent }) {
  return (
    <div className="grid gap-1 border-t border-hairline-soft py-5 text-left last:border-b sm:grid-cols-[96px_1fr] sm:gap-5">
      <div className="pt-1 font-display text-[1.05rem] leading-tight text-gold">{ev.time}</div>
      <div>
        <h3 className="m-0 mb-1 font-display text-xl font-medium tracking-wide">{ev.name}</h3>
        <p className="m-0 text-ivory-dim">
          {ev.venue}
          <br />
          {ev.venueLine2}
          <br />
          {ev.address}
        </p>
        <div className="ui-caps mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[0.72rem]">
          <a href={ev.mapUrl} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 no-underline hover:underline">
            <MapPin className="size-3.5" aria-hidden /> Directions
          </a>
          <a href={`/calendar/${ev.key}.ics`} className="inline-flex items-center gap-1.5 no-underline hover:underline">
            <CalendarPlus className="size-3.5" aria-hidden /> Add to calendar
          </a>
        </div>
      </div>
    </div>
  );
}
