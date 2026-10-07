'use client';
import { useEffect, useRef, useState } from 'react';
import { REGEXP_ONLY_DIGITS_AND_CHARS } from 'input-otp';
import { ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from '@/components/ui/input-otp';
import { Label } from '@/components/ui/label';
import { api, ApiError } from '@/lib/api';
import { CODE_LENGTH, codeFromText, normalizeCode } from '@/lib/code';
import { remember, useRemembered } from '@/lib/remember';

/** Six boxes for the invitation code. Forgiving: lower case, spaces, dashes and pasted links all work. */
export function CodeEntry() {
  const [code, setCode] = useState('');
  const [keep, setKeep] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitted = useRef('');
  const known = useRemembered();
  const returning = known ? known.name?.split(/\s+/)[0] || '' : null;

  // Remembered on this device? Go straight to the invitation.
  useEffect(() => {
    if (known) location.replace(`/i/${known.code}`);
  }, [known]);

  async function submit(value = code) {
    const c = normalizeCode(value);
    if (c.length !== CODE_LENGTH || busy || submitted.current === c) return;
    submitted.current = c;
    setBusy(true);
    setError('');
    try {
      const r = await api<{ code: string }>('/api/invite/lookup', { body: { code: c } });
      if (keep) remember({ code: r.code });
      // A full page load: every /i/CODE is served by one static page that reads the code from the address.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      location.assign(`/i/${r.code}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'We couldn’t check that code just now. Please try again.');
      setBusy(false);
      submitted.current = '';
    }
  }

  if (returning !== null) {
    return (
      <p className="lede mt-6 inline-flex items-center gap-2" role="status">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Welcome back{returning ? `, ${returning}` : ''}. Opening your invitation…
      </p>
    );
  }

  return (
    <form
      className="mx-auto mt-7 grid max-w-sm justify-items-center gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Label htmlFor="code" className="eyebrow !text-gold">
        Enter your invitation code
      </Label>
      <InputOTP
        id="code"
        maxLength={CODE_LENGTH}
        value={code}
        autoFocus
        inputMode="text"
        autoComplete="one-time-code"
        pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
        pasteTransformer={codeFromText}
        onChange={(v) => {
          setCode(normalizeCode(v));
          // Codes never use look-alike characters, so typing one is always a misread.
          setError(/[01oil]/i.test(v) ? 'Codes never use O, 0, I, 1 or L. Please check your message again.' : '');
        }}
        onComplete={(v: string) => submit(v)}
        aria-invalid={!!error}
        aria-describedby="code-help code-error"
        containerClassName="justify-center"
      >
        <InputOTPGroup>
          {[0, 1, 2].map((i) => (
            <InputOTPSlot key={i} index={i} className="size-12 bg-navy-2 font-display text-2xl text-gold uppercase sm:size-14" />
          ))}
        </InputOTPGroup>
        <InputOTPSeparator className="text-gold/60" />
        <InputOTPGroup>
          {[3, 4, 5].map((i) => (
            <InputOTPSlot key={i} index={i} className="size-12 bg-navy-2 font-display text-2xl text-gold uppercase sm:size-14" />
          ))}
        </InputOTPGroup>
      </InputOTP>
      <p id="code-help" className="m-0 font-ui text-[0.82rem] text-ivory-dim">
        It’s the 6 letters and numbers at the end of the link we sent you.
      </p>
      <p id="code-error" role="alert" aria-live="assertive" className="m-0 min-h-5 font-ui text-sm text-bad">
        {error}
      </p>
      <div className="flex items-center gap-2.5">
        <Checkbox id="keep" checked={keep} onCheckedChange={(v) => setKeep(v === true)} className="border-gold/60 data-[state=checked]:bg-gold" />
        <Label htmlFor="keep" className="font-ui text-[0.9rem] font-normal text-ivory">
          Remember me on this device
        </Label>
      </div>
      <Button
        type="submit"
        size="lg"
        disabled={busy || code.length !== CODE_LENGTH}
        className="ui-caps h-12 w-full rounded-[2px] text-[0.76rem] tracking-[0.22em]"
      >
        {busy ? <Loader2 className="animate-spin" /> : <ArrowRight />} Open my invitation
      </Button>
    </form>
  );
}
