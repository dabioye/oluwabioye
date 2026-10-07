'use client';
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Dialog as D } from 'radix-ui';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

type Item = { node: React.ReactNode; label: string; wide?: boolean };
const Ctx = createContext<(item: Item) => void>(() => {});

/** Full-screen viewer for photos and invitation cards. Tap to zoom in, tap again to zoom out. */
export function LightboxProvider({ children }: { children: React.ReactNode }) {
  const [item, setItem] = useState<Item | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const open = useCallback((i: Item) => {
    setZoomed(false);
    setItem(i);
  }, []);

  function toggleZoom(e: React.MouseEvent) {
    if (e.target === stage.current) return setItem(null);
    const r = stage.current!.getBoundingClientRect();
    const next = !zoomed;
    setZoomed(next);
    if (next) {
      // Keep the tapped point under the finger.
      requestAnimationFrame(() => {
        const s = stage.current!;
        s.scrollLeft = (s.scrollWidth - r.width) * ((e.clientX - r.left) / r.width);
        s.scrollTop = (s.scrollHeight - r.height) * ((e.clientY - r.top) / r.height);
      });
    }
  }

  return (
    <Ctx.Provider value={open}>
      {children}
      <D.Root open={!!item} onOpenChange={(o) => !o && setItem(null)}>
        <D.Portal>
          <D.Overlay className="fixed inset-0 z-50 bg-[#060a14]/95 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <D.Content className="fixed inset-0 z-50 outline-none" aria-describedby={undefined}>
            <D.Title className="sr-only">{item?.label}</D.Title>
            <div
              ref={stage}
              onClick={toggleZoom}
              className={cn('grid size-full overflow-auto px-4 pt-14 pb-10', zoomed ? 'place-items-start' : 'place-items-center')}
            >
              <div
                className={cn(
                  'cursor-zoom-in [&_img]:block [&_img]:h-auto [&_img]:w-full',
                  zoomed ? 'w-[max(200vw,900px)] cursor-zoom-out' : item?.wide ? 'w-[min(92vw,720px)]' : 'w-[min(92vw,calc((100dvh-110px)*0.59))]',
                )}
              >
                {item?.node}
              </div>
            </div>
            <D.Close className="fixed top-[calc(10px+env(safe-area-inset-top))] right-3 grid size-11 place-items-center rounded-full border border-gold/50 bg-navy/80 text-gold">
              <X className="size-5" />
              <span className="sr-only">Close</span>
            </D.Close>
            <p className="ui-caps pointer-events-none fixed inset-x-0 bottom-[calc(12px+env(safe-area-inset-bottom))] text-center text-[0.68rem] text-ivory-dim">
              Tap the image to zoom
            </p>
          </D.Content>
        </D.Portal>
      </D.Root>
    </Ctx.Provider>
  );
}

export const useLightbox = () => useContext(Ctx);
