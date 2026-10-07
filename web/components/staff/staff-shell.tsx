'use client';
import { useState } from 'react';
import { Loader2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Monogram } from '@/components/wedding/monogram';
import { WaxSeal } from '@/components/wedding/wax-seal';
import { api, ApiError } from '@/lib/api';
import type { Role } from '@/lib/types';
import { cn } from '@/lib/utils';
import { signOut } from './session';

/** Password (couple) or PIN (ushers) sign-in card. */
export function StaffLogin({ kind, onSignedIn }: { kind: 'admin' | 'checkin'; onSignedIn: (r: Role) => void }) {
  const admin = kind === 'admin';
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <main className="mx-auto grid min-h-dvh max-w-[440px] place-items-center py-10">
      <Card className="w-full border-hairline bg-navy-2/60 py-8 text-center shadow-[0_24px_60px_rgb(0_0_0/0.35)]">
        <CardContent className="grid gap-4">
          <Monogram className="mx-auto w-24 text-gold" />
          <h1 className="display m-0 text-2xl">{admin ? 'Invitation desk' : 'Gate check-in'}</h1>
          <p className="lede m-0 text-lg">
            {admin ? 'For Sarah, Damilare and the planning team.' : 'For ushers at the entrance. Ask the planning team for the PIN.'}
          </p>
          <form
            className="mt-2 grid gap-3 text-left"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError('');
              try {
                const r = await api<{ role: Role }>('/api/login', { body: { kind, password } });
                onSignedIn(r.role);
              } catch (err) {
                setError(err instanceof ApiError ? err.message : 'Couldn’t sign in. Check your connection.');
              } finally {
                setBusy(false);
              }
            }}
          >
            <Label htmlFor="password" className="ui-caps text-[0.7rem] text-ivory-dim">
              {admin ? 'Password' : 'PIN'}
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              inputMode={admin ? undefined : 'numeric'}
              required
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!error}
              className="h-12 bg-navy font-ui text-base"
            />
            <Button type="submit" size="lg" disabled={busy} className="ui-caps h-12 text-[0.76rem] tracking-[0.2em]">
              {busy && <Loader2 className="animate-spin" />} Sign in
            </Button>
            {error && (
              <p role="alert" className="m-0 font-ui text-sm text-bad">
                {error}
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

/** Header bar for staff screens: seal, title, subtitle and links. */
export function StaffHeader({
  title,
  subtitle,
  links = [],
  signOutTo = '/',
}: {
  title: string;
  subtitle?: React.ReactNode;
  links?: { href: string; label: string; external?: boolean }[];
  signOutTo?: string;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline-soft pt-4 pb-4">
      <div className="flex items-center gap-3">
        <WaxSeal className="w-11" />
        <div>
          <b className="block font-display text-lg leading-tight font-medium tracking-wide text-gold">{title}</b>
          {subtitle && <small className="font-ui text-[0.8rem] text-ivory-dim">{subtitle}</small>}
        </div>
      </div>
      <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 font-ui text-[0.78rem] tracking-[0.12em] uppercase">
        {links.map((l) => (
          <a
            key={l.href}
            href={l.href}
            {...(l.external ? { target: '_blank', rel: 'noopener' } : {})}
            className="py-1.5 text-ivory-dim no-underline hover:text-gold"
          >
            {l.label}
          </a>
        ))}
        <button
          type="button"
          onClick={() => signOut(signOutTo)}
          className="inline-flex cursor-pointer items-center gap-1.5 border-0 bg-transparent py-1.5 font-ui text-[0.78rem] tracking-[0.12em] text-ivory-dim uppercase hover:text-gold"
        >
          <LogOut className="size-3.5" /> Sign out
        </button>
      </nav>
    </header>
  );
}

export function StaffPage({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('mx-auto max-w-[1180px] pb-16 font-ui text-[0.95rem] leading-normal', className)}>{children}</div>;
}

export function Checking() {
  return (
    <div className="grid min-h-dvh place-items-center" aria-busy="true">
      <Loader2 className="size-6 animate-spin text-gold" aria-label="Loading" />
    </div>
  );
}
