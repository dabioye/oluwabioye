'use client';
import { nameLayout, type CodeSlot, type NameSlot } from '@/lib/invitation';
import { cn } from '@/lib/utils';
import { useLightbox } from './lightbox';

type CardProps = { src: string; alt: string; name?: string; slot?: NameSlot; font?: string; code?: string; codeSlot?: CodeSlot; className?: string };

function Card({ src, alt, name, slot, font, code, codeSlot, className }: CardProps) {
  const n = name && slot ? nameLayout(name, slot, font) : null;
  return (
    <div className={cn('relative [container-type:inline-size]', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} width={600} height={1010} decoding="async" className="block h-auto w-full" />
      {n && (
        <span
          className="pointer-events-none absolute inset-x-[6%] -translate-y-1/2 text-center leading-[1.05] whitespace-nowrap text-[#f3e6cc] [text-shadow:0_1px_3px_rgb(0_0_0/0.5)]"
          style={{ top: `${n.top}%`, fontSize: `${n.size.toFixed(2)}cqw`, lineHeight: n.lineHeight, fontFamily: `"${n.family}", cursive` }}
        >
          {n.lines.map((l, i) => (
            <span key={i} className="block">
              {l}
            </span>
          ))}
        </span>
      )}
      {code && codeSlot && (
        <span
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 font-display font-medium tracking-[0.18em] whitespace-nowrap text-[#f3e6cc] [text-shadow:0_1px_3px_rgb(0_0_0/0.5)]"
          style={{ top: `${codeSlot.top}%`, left: `${codeSlot.left}%`, fontSize: `${codeSlot.size}cqw` }}
        >
          {code}
        </span>
      )}
    </div>
  );
}

/** The designed invitation card, with the guest's name (and access code) set into it when given. Opens full size on tap. */
export function InvitationArt(props: Omit<CardProps, 'className'>) {
  const open = useLightbox();
  if (!props.src) return null;
  return (
    <figure className="mx-auto my-4 max-w-[460px]">
      <button
        type="button"
        onClick={() => open({ node: <Card {...props} />, label: props.alt })}
        className="block w-full cursor-zoom-in overflow-hidden rounded-[4px] shadow-[0_24px_60px_rgb(0_0_0/0.5),0_0_0_1px_rgb(210_176_122/0.25)] transition-transform duration-500 hover:-translate-y-1 motion-reduce:transition-none"
        aria-label="View the invitation full size"
      >
        <Card {...props} />
      </button>
      <figcaption className="ui-caps mt-3 text-[0.7rem] text-ivory-dim">Tap the card to view it full size</figcaption>
    </figure>
  );
}
