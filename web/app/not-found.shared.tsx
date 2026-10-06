import { Monogram } from '@/components/wedding/monogram';
import { Frame, Rule } from '@/components/wedding/ornaments';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-[560px] pt-[clamp(40px,12vh,120px)]">
      <Frame>
        <Monogram className="w-24 text-gold" />
        <Rule />
        <h1 className="display text-2xl">Page not found</h1>
        <p className="lede mt-3">That page doesn’t exist.</p>
        <a href="/" className="ui-caps mt-4 inline-block text-[0.74rem]">
          Back to the start
        </a>
      </Frame>
    </main>
  );
}
