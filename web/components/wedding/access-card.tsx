import { cfg } from '@/lib/config';
import { shortDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { WaxSeal } from './wax-seal';

/** The guest's access card (with the QR the ushers scan), or the driver's meal card. */
export function AccessCard({ name, code, qrSvg, driver = false }: { name: string; code: string; qrSvg?: string; driver?: boolean }) {
  return (
    <div
      className={cn(
        'relative mx-auto mt-5 w-full max-w-[380px] rounded-xl border border-gold-soft px-5 pt-6 pb-5 text-center shadow-[0_18px_40px_rgb(0_0_0/0.35)]',
        driver ? 'bg-navy-3' : 'bg-navy-2',
      )}
    >
      <WaxSeal className="mx-auto w-16" />
      <div className="eyebrow mt-3">The making of</div>
      <div className="display text-2xl">{cfg.couple.surname}</div>
      <div className="eyebrow mt-1">{shortDate()}</div>
      <div className="mt-3 font-ui text-[0.78rem] font-semibold tracking-[0.3em] text-gold uppercase">{driver ? 'Driver’s meal card' : 'Access card'}</div>
      <div className="mt-2 font-display text-xl leading-tight font-medium">{driver ? `Driver of ${name}` : name}</div>
      {driver ? (
        <p className="mt-2 mb-0 font-ui text-[0.78rem] text-ivory-dim">Present at the drivers’ meal point</p>
      ) : (
        <>
          <div
            data-qr
            role="img"
            aria-label={`Entry QR code for ${name}`}
            className="mx-auto mt-4 mb-2 w-[200px] rounded-md bg-ivory p-3 [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
            dangerouslySetInnerHTML={{ __html: qrSvg || '' }}
          />
          <div className="font-display text-[1.3rem] tracking-[0.3em] text-gold">{code}</div>
          <p className="mt-2 mb-0 font-ui text-[0.78rem] text-ivory-dim">Admits one guest · Show at the entrance</p>
        </>
      )}
    </div>
  );
}
