import type { Metadata, Viewport } from 'next';
import { Toaster } from '@/components/ui/sonner';
import { LightboxProvider } from '@/components/wedding/lightbox';
import { cfg } from '@/lib/config';
import './globals.css';

const site = process.env.NEXT_PUBLIC_SITE;

export const metadata: Metadata = {
  title: `${cfg.couple.bride} & ${cfg.couple.groom}`,
  description: `The wedding of ${cfg.couple.brideFull} and ${cfg.couple.groomFull}.`,
  icons: { icon: '/icon.svg' },
  // The invite site is private: keep every page of it out of search engines.
  robots: site === 'invite' ? { index: false, follow: false } : undefined,
};

export const viewport: Viewport = {
  themeColor: '#0f1a2e',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh px-4">
        <LightboxProvider>{children}</LightboxProvider>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
