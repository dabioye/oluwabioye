import { useId } from 'react';
import { WORDMARK_PATH, WORDMARK_VIEWBOX } from '@/lib/art-paths';
import { cn } from '@/lib/utils';

/**
 * The OLUWABIOYE logo. Flat, it takes the text colour (ivory on navy, navy on ivory); `embossed` gives
 * it the wax-seal gold with a pressed light and shadow edge. Read out as "Oluwabioye" unless `decorative`.
 */
export function Wordmark({ className, embossed = false, decorative = false }: { className?: string; embossed?: boolean; decorative?: boolean }) {
  const id = useId().replace(/:/g, '');
  const label = decorative ? { 'aria-hidden': true as const } : { role: 'img', 'aria-label': 'Oluwabioye' };
  return (
    <svg viewBox={WORDMARK_VIEWBOX} className={cn('block h-auto w-full overflow-visible', className)} {...label}>
      {embossed ? (
        <>
          <defs>
            <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ecd2a6" />
              <stop offset="0.45" stopColor="#c69a63" />
              <stop offset="1" stopColor="#8f643a" />
            </linearGradient>
          </defs>
          <path d={WORDMARK_PATH} fillRule="evenodd" fill="#fbe8c6" opacity="0.55" transform="translate(-5 -6)" />
          <path d={WORDMARK_PATH} fillRule="evenodd" fill="#2a1a0b" opacity="0.7" transform="translate(6 8)" />
          <path d={WORDMARK_PATH} fillRule="evenodd" fill={`url(#${id}-gold)`} />
        </>
      ) : (
        <path d={WORDMARK_PATH} fillRule="evenodd" fill="currentColor" />
      )}
    </svg>
  );
}
