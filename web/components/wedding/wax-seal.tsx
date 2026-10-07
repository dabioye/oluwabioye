import { useId } from 'react';
import { MONOGRAM_PATH, WAX_PATH, WAX_VIEWBOX } from '@/lib/art-paths';
import { cn } from '@/lib/utils';

// Monogram is 1150×1110; fit it in a ~118px box at the centre of the 240px seal.
const MONO = 'translate(59 63) scale(0.1065)';

/**
 * A bronze wax seal pressed with the SD monogram, drawn in SVG: crisp on every screen and with
 * no square photo background around it.
 */
export function WaxSeal({ className, title }: { className?: string; title?: string }) {
  const id = useId().replace(/:/g, '');
  const g = (n: string) => `${id}-${n}`;
  return (
    <svg
      viewBox={WAX_VIEWBOX}
      className={cn('block h-auto w-full overflow-visible', className)}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <radialGradient id={g('wax')} cx="38%" cy="32%" r="78%">
          <stop offset="0" stopColor="#e9c99a" />
          <stop offset="0.35" stopColor="#c69a63" />
          <stop offset="0.75" stopColor="#9a6e3f" />
          <stop offset="1" stopColor="#6d4a28" />
        </radialGradient>
        <radialGradient id={g('well')} cx="42%" cy="38%" r="70%">
          <stop offset="0" stopColor="#d7b282" />
          <stop offset="0.7" stopColor="#b48650" />
          <stop offset="1" stopColor="#8c6236" />
        </radialGradient>
        <linearGradient id={g('rim')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f4dcb3" stopOpacity="0.9" />
          <stop offset="0.5" stopColor="#f4dcb3" stopOpacity="0" />
          <stop offset="1" stopColor="#3f2a15" stopOpacity="0.55" />
        </linearGradient>
        <filter id={g('grain')} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.25  0 0 0 0 0.16  0 0 0 0 0.08  0 0 0 0.16 0" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
      </defs>

      {/* wax body with a soft drop shadow */}
      <path d={WAX_PATH} fill="#000" opacity="0.35" transform="translate(3 6)" style={{ filter: 'blur(5px)' }} />
      <path d={WAX_PATH} fill={`url(#${g('wax')})`} />
      <path d={WAX_PATH} fill={`url(#${g('rim')})`} opacity="0.55" />
      <path d={WAX_PATH} fill="#fff" filter={`url(#${g('grain')})`} />

      {/* the pressed well and its raised rim */}
      <circle cx="120" cy="120" r="78" fill={`url(#${g('well')})`} />
      <circle cx="120" cy="120" r="78" fill="none" stroke="#5c3d1f" strokeOpacity="0.45" strokeWidth="2.5" />
      <circle cx="120" cy="120" r="81.5" fill="none" stroke="#f6dfb8" strokeOpacity="0.55" strokeWidth="1.6" />
      <circle cx="120" cy="120" r="70" fill="none" stroke="#5c3d1f" strokeOpacity="0.25" strokeWidth="1" />

      {/* embossed monogram: light edge, shadow edge, then the face */}
      <g transform={MONO}>
        <path d={MONOGRAM_PATH} fill="#fbe8c6" opacity="0.75" transform="translate(-14 -14)" />
        <path d={MONOGRAM_PATH} fill="#4a3017" opacity="0.6" transform="translate(16 18)" />
        <path d={MONOGRAM_PATH} fill="#b88a55" />
      </g>
    </svg>
  );
}
