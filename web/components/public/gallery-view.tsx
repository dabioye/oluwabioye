'use client';
import { Button } from '@/components/ui/button';
import { Monogram } from '@/components/wedding/monogram';
import { Rule } from '@/components/wedding/ornaments';
import { SiteFooter, SiteNav } from '@/components/wedding/site-chrome';
import { cfg } from '@/lib/config';
import { useSiteContent } from '@/lib/content';
import { Gallery } from './gallery';

const c = cfg.couple;

/** Every photo the couple has added in the website editor, on a page of its own. */
export function GalleryView() {
  const { content } = useSiteContent();
  return (
    <>
      <SiteNav
        links={[
          { href: '/', label: 'Home' },
          { href: '/invitation', label: 'Invitation' },
          { href: '/our-story', label: 'Our Story' },
          { href: content.registryUrl || '/#gifts', label: 'Gift Registry', external: !!content.registryUrl },
        ]}
      />
      <main className="mx-auto max-w-[980px] pb-6">
        <header className="pt-[clamp(32px,8vw,64px)] text-center">
          <div className="eyebrow">Gallery</div>
          <Monogram className="mt-3 text-gold" />
          <p className="m-0 font-lavish text-[clamp(2.3rem,8vw,3.4rem)] leading-tight text-ivory">
            {c.bride} &amp; {c.groom}
          </p>
          <Rule />
          <h1 className="display m-0 text-[clamp(1.4rem,4.4vw,2rem)]">Moments so far</h1>
        </header>
        {content.gallery.length ? (
          <Gallery photos={content.gallery} />
        ) : (
          <p className="lede mt-6 text-center italic">Photos are coming soon. Check back as the celebration draws near.</p>
        )}
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" className="ui-caps h-12 rounded-[2px] px-6 text-[0.74rem] tracking-[0.2em]">
            <a href="/invitation">View the invitation</a>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="ui-caps h-12 rounded-[2px] border-gold bg-transparent px-6 text-[0.74rem] tracking-[0.2em] text-gold hover:bg-gold/10 hover:text-gold"
          >
            <a href="/">Back to the wedding</a>
          </Button>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
