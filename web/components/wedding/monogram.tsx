import { MONOGRAM_PATH, MONOGRAM_VIEWBOX } from '@/lib/art-paths';
import { cn } from '@/lib/utils';

/** The intertwined S & D, as a vector so it stays crisp at any size. Takes the current text colour. */
export function Monogram({ className, title = 'Sarah and Damilare’s intertwined monogram' }: { className?: string; title?: string }) {
  return (
    <svg viewBox={MONOGRAM_VIEWBOX} role="img" aria-label={title} className={cn('inline-block h-auto w-[clamp(96px,28vw,150px)] fill-current', className)}>
      <path d={MONOGRAM_PATH} />
    </svg>
  );
}
