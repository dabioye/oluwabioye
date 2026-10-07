import { cn } from '@/lib/utils';

/** Gold hairlines with the little four-point star between them. */
export function Rule({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('mx-auto my-6 flex max-w-80 items-center justify-center gap-3 text-gold', className)}>
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-gold-soft" />
      <span className="text-[0.8rem] leading-none">✦</span>
      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-gold-soft" />
    </div>
  );
}

const LEAVES: [number, number, number][] = [
  [30, 20, 30],
  [52, 34, 50],
  [74, 50, 25],
  [94, 70, 55],
  [112, 92, 30],
  [128, 114, 60],
];

/** A leafy sprig for the corners of framed sections. */
export function Sprig({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" aria-hidden fill="none" className={cn('pointer-events-none absolute w-[clamp(100px,22vw,190px)] opacity-80', className)}>
      <path d="M6 6 C60 30 110 70 150 150" stroke="#b99662" strokeWidth="1.4" />
      {LEAVES.map(([x, y, r]) => (
        <g key={x}>
          <ellipse cx={x} cy={y - 10} rx="12" ry="4.5" transform={`rotate(${r - 70} ${x} ${y - 10})`} fill="#b99662" opacity=".75" />
          <ellipse cx={x - 6} cy={y + 10} rx="12" ry="4.5" transform={`rotate(${r + 10} ${x - 6} ${y + 10})`} fill="#d2b07a" opacity=".55" />
        </g>
      ))}
      {[
        [140, 128],
        [146, 138],
        [134, 140],
      ].map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r="3" fill="#d2b07a" />
      ))}
    </svg>
  );
}

/** A section set inside the double gold hairline frame. */
export function Frame({ className, children, id }: { className?: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className={cn('frame my-7 px-[clamp(20px,5vw,48px)] py-[clamp(28px,6vw,56px)] text-center', className)}>
      {children}
    </section>
  );
}
