import { cfg } from '@/lib/config';
import { longDate, telHref, waHref } from '@/lib/format';
import { cn } from '@/lib/utils';
import { MessageCircle, Phone } from 'lucide-react';

/** Sticky top navigation with small-caps links. */
export function SiteNav({ links, className }: { links: { href: string; label: string }[]; className?: string }) {
  return (
    <nav
      aria-label="Sections"
      className={cn('no-print sticky top-0 z-30 -mx-4 border-b border-hairline-soft bg-background/90 px-4 backdrop-blur-md', className)}
    >
      <div className="ui-caps mx-auto flex max-w-[760px] flex-wrap justify-center gap-x-6 gap-y-1 py-3.5 text-[0.74rem] tracking-[0.24em]">
        {links.map((l) => (
          <a key={l.href} href={l.href} className="py-1.5 text-ivory-dim no-underline transition-colors hover:text-gold">
            {l.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

export type DockItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; external?: boolean };

/** Bottom quick-link bar on phones. */
export function Dock({ items }: { items: (DockItem | false | null | undefined)[] }) {
  const list = items.filter(Boolean) as DockItem[];
  if (!list.length) return null;
  return (
    <>
      <div className="h-[calc(76px+env(safe-area-inset-bottom))] md:hidden" aria-hidden />
      <nav
        aria-label="Quick links"
        className="no-print fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-hairline-soft bg-[#0c1526]/95 px-2 pt-2 pb-[calc(8px+env(safe-area-inset-bottom))] backdrop-blur-md md:hidden"
      >
        {list.map(({ href, label, icon: Icon, external }) => (
          <a
            key={label}
            href={href}
            {...(external ? { target: '_blank', rel: 'noopener' } : {})}
            className="grid min-w-16 justify-items-center gap-1 px-1 py-1.5 font-ui text-[0.62rem] font-medium tracking-[0.12em] text-ivory-dim uppercase no-underline hover:text-gold"
          >
            <Icon className="size-6 stroke-[1.4] text-gold" />
            {label}
          </a>
        ))}
      </nav>
    </>
  );
}

export function SiteFooter({ children }: { children?: React.ReactNode }) {
  return (
    <footer className="px-4 pt-8 pb-12 text-center font-ui text-[0.8rem] tracking-[0.1em] text-ivory-dim">
      {children ?? (
        <>
          {cfg.couple.bride} &amp; {cfg.couple.groom} · {longDate(cfg.date)}
        </>
      )}
    </footer>
  );
}

/** Busayo and Hope, with call and WhatsApp links. */
export function Contacts() {
  return (
    <div className="mt-3 flex flex-wrap justify-center gap-x-10 gap-y-4">
      {cfg.contacts.map((p) => (
        <div key={p.name} className="grid justify-items-center gap-1">
          <b className="font-display text-base font-medium tracking-[0.08em]">{p.name}</b>
          <a href={telHref(p.phone)} className="inline-flex items-center gap-1.5 tabular-nums no-underline">
            <Phone className="size-3.5" aria-hidden /> {p.phone}
          </a>
          <a href={waHref(p.phone)} target="_blank" rel="noopener" className="ui-caps inline-flex items-center gap-1.5 text-[0.68rem] no-underline">
            <MessageCircle className="size-3.5" aria-hidden /> WhatsApp
          </a>
        </div>
      ))}
    </div>
  );
}
