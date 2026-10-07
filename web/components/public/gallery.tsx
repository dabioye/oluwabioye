'use client';
import type { GalleryPhoto } from '@/lib/config';
import { useLightbox } from '@/components/wedding/lightbox';

/** Photo grid; the first photo shows large. Tap to view full size. */
export function Gallery({ photos }: { photos: GalleryPhoto[] }) {
  const open = useLightbox();
  return (
    <div className="mt-5 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
      {photos.map((g, i) => {
        const alt = g.caption || `Sarah and Damilare, photo ${i + 1}`;
        return (
          <button
            key={g.src}
            type="button"
            className="group relative aspect-square cursor-zoom-in overflow-hidden bg-navy-2 first:col-span-2 first:row-span-2"
            aria-label={`View photo ${i + 1}${g.caption ? `: ${g.caption}` : ''}`}
            // eslint-disable-next-line @next/next/no-img-element
            onClick={() => open({ node: <img src={g.src} alt={alt} />, label: alt, wide: true })}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={g.src} alt={alt} loading="lazy" className="block size-full object-cover transition-transform duration-500 group-hover:scale-105" />
            {g.caption && (
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#080e1a]/85 to-transparent px-2 pt-5 pb-1.5 text-left font-ui text-[0.7rem] tracking-[0.08em] text-ivory">
                {g.caption}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
