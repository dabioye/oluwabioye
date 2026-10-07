import { ExternalLink, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Frame } from '@/components/wedding/ornaments';
import { cfg } from '@/lib/config';
import type { PublicContent } from '@/lib/types';

/** Gift registry: the couple's message, a big button to the (external) registry and any bank accounts from config. */
export function Registry({ content }: { content: PublicContent }) {
  return (
    <Frame id="gifts" className="bg-[linear-gradient(145deg,rgb(210_176_122/0.08),transparent_58%)]">
      <Gift className="mx-auto mb-2 size-7 stroke-[1.3] text-gold" aria-hidden />
      <div className="eyebrow">Gift registry</div>
      <h2 className="display mt-2.5 text-[clamp(1.25rem,3.6vw,1.6rem)]">Celebrate our new chapter</h2>
      <p className="lede mt-2.5">{content.giftsMessage}</p>
      {content.registryUrl ? (
        <Button
          asChild
          className="mx-auto mt-7 flex h-auto w-full max-w-[440px] flex-col gap-1 rounded-[3px] px-6 py-5 shadow-[0_10px_28px_rgb(0_0_0/0.25)] transition-transform hover:-translate-y-0.5"
        >
          <a href={content.registryUrl} target="_blank" rel="noopener">
            <span className="ui-caps inline-flex items-center gap-2.5 text-[0.95rem] tracking-[0.24em]">
              <Gift className="size-5" aria-hidden /> Send us a gift
            </span>
            <span className="inline-flex items-center gap-1.5 font-ui text-[0.78rem] font-normal tracking-wide opacity-80">
              Opens our gift registry <ExternalLink className="size-3.5" aria-hidden />
            </span>
          </a>
        </Button>
      ) : (
        <p className="ui-caps mx-auto mt-7 max-w-[440px] rounded-[3px] border border-dashed border-gold/50 px-6 py-5 text-[0.8rem] tracking-[0.2em] text-gold">
          Registry link coming soon
        </p>
      )}
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
