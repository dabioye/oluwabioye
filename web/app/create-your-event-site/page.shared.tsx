import type { Metadata } from 'next';
import { EnquiryForm } from '@/components/enquiry/enquiry-form';
import { Monogram } from '@/components/wedding/monogram';
import { Rule } from '@/components/wedding/ornaments';
import { SiteFooter } from '@/components/wedding/site-chrome';

export const metadata: Metadata = {
  title: 'Let us create your own event site',
  description: 'Weddings, birthdays, burials, baby showers and more: tell us about your event and we’ll build its website, invitations and RSVPs.',
};

export default function CreateYourEventSite() {
  return (
    <>
      <main className="mx-auto max-w-[680px] pt-[clamp(32px,8vw,64px)]">
        <header className="text-center">
          <Monogram className="mx-auto w-20 text-gold" />
          <Rule />
          <div className="eyebrow">Let us create your own event site</div>
          <h1 className="display mt-2.5 mb-0 text-[clamp(1.6rem,5vw,2.3rem)]">Your celebration, beautifully online</h1>
          <p className="lede mx-auto mt-3 max-w-[32em]">
            Liked this website? We create sites like it for weddings, birthdays, burials, baby showers and every kind of gathering: personalised invitations,
            RSVPs, WhatsApp and email invites, access cards and gate check-in. Tell us about your event and we’ll get back to you.
          </p>
        </header>
        <EnquiryForm />
      </main>
      <SiteFooter />
    </>
  );
}
