import { Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Frame } from '@/components/wedding/ornaments';
import { cfg } from '@/lib/config';
import type { PublicContent } from '@/lib/types';

/** Gift registry: the couple's message, the Joy registry button and any bank accounts from config. */
export function Registry({ content }: { content: PublicContent }) {
  return (
    <Frame id="gifts" className="bg-[linear-gradient(145deg,rgb(210_176_122/0.08),transparent_58%)]">
      <Gift className="mx-auto mb-2 size-7 stroke-[1.3] text-gold" aria-hidden />
      <div className="eyebrow">Gift registry</div>
      <h2 className="display mt-2.5 text-[clamp(1.25rem,3.6vw,1.6rem)]">Celebrate our new chapter</h2>
      <p className="lede mt-2.5">{content.giftsMessage}</p>
      {content.registryUrl ? (
        <div className="mt-6 flex justify-center">
          <Button asChild size="lg" className="ui-caps h-12 rounded-[2px] px-7 text-[0.78rem] tracking-[0.22em]">
            <a href={content.registryUrl} target="_blank" rel="noopener">
              View our registry on Joy
            </a>
          </Button>
        </div>
      ) : null}
      {cfg.gifts.accounts.length > 0 && (
        <div className="mt-5 grid gap-2.5">
          {cfg.gifts.accounts.map((a) => (
            <div key={a.number} className="border border-gold/30 px-4 py-3">
              <b>{a.bank}</b>
              <br />
              {a.name}
              <br />
              <span className="tabular-nums">{a.number}</span>
            </div>
          ))}
        </div>
      )}
    </Frame>
  );
}
