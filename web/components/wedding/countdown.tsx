'use client';
import { useEffect, useState } from 'react';

function parts(at: number) {
  const s = Math.max(0, Math.floor((at - Date.now()) / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60) };
}

/** Days, hours and minutes to the ceremony. Renders dashes until the browser knows the time. */
export function Countdown({ startsAt }: { startsAt: string }) {
  const at = new Date(startsAt).getTime();
  const [t, setT] = useState<ReturnType<typeof parts> | null>(null);
  useEffect(() => {
    const tick = () => setT(parts(at));
    tick();
    const i = setInterval(tick, 30_000);
    return () => clearInterval(i);
  }, [at]);
  const cells: [keyof NonNullable<typeof t>, string][] = [
    ['d', 'Days'],
    ['h', 'Hours'],
    ['m', 'Minutes'],
  ];
  return (
    <div className="mt-7 flex justify-center gap-[clamp(14px,5vw,40px)] tabular-nums" aria-label="Time until the ceremony">
      {cells.map(([k, label]) => (
        <div key={k} className="grid min-w-16 gap-1">
          <b className="font-display text-[clamp(1.9rem,6vw,2.7rem)] leading-none font-medium text-gold">{t ? t[k] : '—'}</b>
          <small className="ui-caps text-[0.68rem] text-ivory-dim">{label}</small>
        </div>
      ))}
    </div>
  );
}
