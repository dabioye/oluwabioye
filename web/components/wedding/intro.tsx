'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { WaxSeal } from './wax-seal';

/**
 * The wax-seal envelope that opens to reveal the page. Without JavaScript the page simply shows.
 * `enabled` can switch off later (the couple can turn it off in the website editor).
 */
export function Intro({
  storageKey,
  enabled = true,
  children,
  beside,
}: {
  storageKey: string;
  enabled?: boolean;
  children: React.ReactNode;
  /** Shown either side of the seal, e.g. the bride by the S of the monogram and the groom by the D. */
  beside?: [React.ReactNode, React.ReactNode];
}) {
  const ref = useRef<HTMLDivElement>(null);
  // The boot script has already un-hidden the envelope if it should show; read that once on hydration.
  // 'idle' keeps the (hidden) element so server and browser markup match.
  const [state, setState] = useState<'idle' | 'shown' | 'opening' | 'gone'>(() =>
    typeof document !== 'undefined' && document.getElementById('intro')?.hidden === false ? 'shown' : 'idle',
  );

  const finish = useCallback(() => setState('gone'), []);

  const open = useCallback(() => {
    setState((s) => {
      if (s !== 'shown') return s;
      try {
        sessionStorage.setItem(`opened:${storageKey}`, '1');
      } catch {}
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      setTimeout(finish, reduce ? 320 : 1150);
      return 'opening';
    });
  }, [storageKey, finish]);

  // Switched off in the website editor (known only after the content loads): drop the envelope.
  const current = !enabled && state !== 'opening' ? 'gone' : state;
  useEffect(() => {
    if (current === 'gone') document.documentElement.classList.remove('intro-on');
  }, [current]);

  useEffect(() => {
    if (current !== 'shown') return;
    const onKey = (e: KeyboardEvent) => {
      if (['Enter', ' ', 'Escape'].includes(e.key)) {
        e.preventDefault();
        open();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [current, open]);

  if (current === 'gone') return null;
  return (
    <div
      ref={ref}
      id="intro"
      hidden
      suppressHydrationWarning
      data-opening={current === 'opening' ? '' : undefined}
      onClick={(e) => (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('intro-door')) && open()}
      className="intro fixed inset-0 z-50 grid place-items-center [perspective:1400px]"
    >
      <div className="intro-door l left-0 origin-left" />
      <div className="intro-door r right-0 origin-right" />
      <div className="intro-ribbon" aria-hidden />
      <div className="intro-inner relative z-10 grid justify-items-center gap-3.5 px-4 text-center transition-[opacity,transform] duration-500 before:pointer-events-none before:absolute before:-inset-x-10 before:-inset-y-16 before:-z-10 before:rounded-full before:bg-[radial-gradient(closest-side,rgb(8_16_30/0.82),rgb(8_16_30/0.55)_55%,transparent)]">
        {children}
        <div className={beside ? 'grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-[clamp(4px,2.5vw,24px)]' : 'contents'}>
          {beside && <div className="justify-self-end text-right">{beside[0]}</div>}
          <button
            type="button"
            onClick={open}
            aria-label="Open the invitation"
            className="w-[clamp(124px,34vw,170px)] cursor-pointer rounded-full border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-gold-bright/70 focus-visible:ring-offset-4 focus-visible:ring-offset-transparent [filter:drop-shadow(0_12px_22px_rgb(0_0_0/0.55))_drop-shadow(0_0_14px_rgb(231_203_143/0.25))] motion-safe:animate-seal-glow"
          >
            <WaxSeal />
          </button>
          {beside && <div className="justify-self-start text-left">{beside[1]}</div>}
        </div>
        <p className="ui-caps m-0 text-[0.76rem] tracking-[0.26em] text-gold [text-shadow:0_2px_8px_rgb(0_0_0/0.7)]">Tap the seal to open</p>
      </div>
    </div>
  );
}
