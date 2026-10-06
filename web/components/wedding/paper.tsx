'use client';
import { useEffect } from 'react';

/** Switches a page to the warm ivory "paper" look (also behind the browser's overscroll). */
export function PaperPage({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.body.classList.add('theme-paper');
    document.documentElement.style.background = '#f5f0e6';
    return () => {
      document.body.classList.remove('theme-paper');
      document.documentElement.style.background = '';
    };
  }, []);
  return (
    <div className="theme-paper -mx-4 min-h-dvh bg-[radial-gradient(ellipse_at_50%_-10%,rgb(255_255_255/0.9),transparent_58%),linear-gradient(160deg,#f7f3ea_0%,#eee6d7_100%)] px-4 text-foreground">
      {children}
    </div>
  );
}
