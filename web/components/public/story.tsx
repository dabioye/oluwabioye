'use client';
import type { StoryMoment } from '@/lib/config';
import { useLightbox } from '@/components/wedding/lightbox';

/** Our Story milestones on a gold timeline. Photos open full size. */
export function StoryTimeline({ moments }: { moments: StoryMoment[] }) {
  const open = useLightbox();
  if (!moments.length) return null;
  return (
    <ol className="relative mx-auto mt-7 grid max-w-[34em] list-none gap-7 p-0 text-left before:absolute before:top-1.5 before:bottom-1.5 before:left-[7px] before:w-px before:bg-gradient-to-b before:from-gold-soft before:to-gold/10">
      {moments.map((m, i) => (
        <li
          key={`${m.title}-${i}`}
          className="relative pl-9 before:absolute before:top-1.5 before:left-0.5 before:size-[11px] before:rounded-full before:border-[1.5px] before:border-gold before:bg-background last:before:bg-gold"
        >
          {m.photo && (
            <button
              type="button"
              className="mb-3 block w-full cursor-zoom-in overflow-hidden rounded-[3px]"
              aria-label={`View photo: ${m.title}`}
              // eslint-disable-next-line @next/next/no-img-element
              onClick={() => open({ node: <img src={m.photo} alt={m.title} />, label: m.title, wide: true })}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={m.photo}
                alt={m.title}
                loading="lazy"
                className="block aspect-[4/3] w-full object-cover transition-transform duration-700 hover:scale-[1.03]"
              />
            </button>
          )}
          <div className="font-ui text-[0.7rem] font-semibold tracking-[0.24em] text-gold uppercase">{m.when}</div>
          <h3 className="my-1 font-display text-xl font-medium tracking-wide">{m.title}</h3>
          {m.text && <p className="m-0 whitespace-pre-line text-ivory-dim">{m.text}</p>}
        </li>
      ))}
    </ol>
  );
}
