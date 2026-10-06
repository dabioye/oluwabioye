'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { api, ApiError } from '@/lib/api';
import { clock } from '@/lib/format';
import { Checking, StaffHeader, StaffLogin, StaffPage } from './staff-shell';
import { GateResultPanel, type GateResult } from './gate-result';
import { useSession } from './session';

type Stats = { checkedIn: number; expected: number; recent: { name: string; at: string; table?: string }[] };
type Match = { name: string; code: string; rsvp: string; checkedInAt: string | null; table?: string };
type Scanner = { start: (...a: unknown[]) => Promise<unknown>; stop: () => Promise<void>; clear: () => void };

export function GateView() {
  const { role, setRole } = useSession();
  if (role === undefined) return <Checking />;
  if (!role) return <StaffLogin kind="checkin" onSignedIn={setRole} />;
  return <Gate />;
}

function Gate() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [result, setResult] = useState<GateResult | null>(null);
  const [q, setQ] = useState('');
  const [matches, setMatches] = useState<Match[]>([]);
  const [camOn, setCamOn] = useState(false);
  const scanner = useRef<Scanner | null>(null);
  const busy = useRef(false);
  const last = useRef({ code: '', at: 0 });

  const loadStats = useCallback(
    () =>
      api<Stats>('/api/checkin/stats').then(setStats, (e) => {
        if (e instanceof ApiError && e.status === 401) location.reload();
      }),
    [],
  );

  useEffect(() => {
    void loadStats();
    const i = setInterval(() => !document.hidden && loadStats(), 30_000);
    return () => clearInterval(i);
  }, [loadStats]);

  const check = useCallback(
    async (code: string, undo = false) => {
      if (busy.current) return;
      busy.current = true;
      try {
        const r = await api<GateResult>('/api/checkin', { body: { code, undo } });
        setResult(r);
        navigator.vibrate?.(r.status === 'ok' ? 80 : [60, 60, 60]);
        loadStats();
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) location.reload();
      } finally {
        busy.current = false;
      }
    },
    [loadStats],
  );

  // Name search as you type; a 6-character code or a scanned link checks in directly.
  const term = q.trim();
  const searching = term.length >= 2 && !/^[A-Za-z0-9]{6}$/.test(term);
  useEffect(() => {
    if (!searching) return;
    const t = setTimeout(
      () =>
        api<Match[]>(`/api/checkin/search?q=${encodeURIComponent(term)}`)
          .then(setMatches)
          .catch(() => {}),
      250,
    );
    return () => clearTimeout(t);
  }, [term, searching]);
  const shown = searching ? matches : [];

  async function toggleCamera() {
    if (scanner.current) {
      await scanner.current.stop().catch(() => {});
      scanner.current.clear();
      scanner.current = null;
      setCamOn(false);
      return;
    }
    const { Html5Qrcode } = await import('html5-qrcode');
    const s = new Html5Qrcode('reader') as unknown as Scanner;
    try {
      await s.start({ facingMode: 'environment' }, { fps: 10, qrbox: 240 }, (text: string) => {
        const now = Date.now();
        // Ignore the same card held in front of the lens.
        if (text === last.current.code && now - last.current.at < 4000) return;
        last.current = { code: text, at: now };
        check(text);
      });
      scanner.current = s;
      setCamOn(true);
    } catch (err) {
      alert(`Camera unavailable: ${err}. Type the code instead.`);
    }
  }

  useEffect(() => () => void scanner.current?.stop().catch(() => {}), []);

  return (
    <StaffPage className="max-w-[640px]">
      <StaffHeader title="Gate check-in" subtitle={stats ? `${stats.checkedIn} arrived of ${stats.expected} expected` : 'Loading…'} />
      <Card className="mt-4 border-hairline-soft bg-navy-2/60">
        <CardContent className="grid gap-3">
          <div id="reader" className="overflow-hidden rounded-md bg-black/30 empty:hidden [&_video]:rounded-md" />
          <Button size="lg" onClick={toggleCamera} className="h-12">
            {camOn ? <CameraOff /> : <Camera />} {camOn ? 'Stop camera' : 'Scan access card'}
          </Button>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const v = q.trim();
              if (/^[A-Za-z0-9]{6}$/.test(v) || v.includes('/c/')) {
                check(v);
                setQ('');
                setMatches([]);
              }
            }}
          >
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              maxLength={80}
              placeholder="Code or guest name"
              aria-label="Invitation code or guest name"
              autoComplete="off"
              className="h-12 bg-navy font-ui text-base"
            />
            <Button type="submit" size="lg" variant="outline" className="h-12 border-gold/50 bg-transparent text-gold" aria-label="Check in">
              <Search />
            </Button>
          </form>
          {shown.length > 0 && (
            <div className="grid gap-1.5">
              {shown.map((g) => (
                <button
                  key={g.code}
                  type="button"
                  onClick={() => {
                    check(g.code);
                    setQ('');
                    setMatches([]);
                  }}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-hairline-soft bg-navy px-3 py-2.5 text-left text-ivory hover:border-gold/50"
                >
                  <span>{g.name}</span>
                  <small className="text-ivory-dim">
                    {g.checkedInAt ? `arrived ${clock(g.checkedInAt)}` : g.rsvp === 'yes' ? 'attending' : g.rsvp === 'no' ? 'declined' : 'no reply'}
                    {g.table ? ` · T${g.table}` : ''}
                  </small>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {result && <GateResultPanel res={result} onUndo={result.guest ? () => check(result.guest!.code, true) : undefined} />}

      <Card className="mt-4 border-hairline-soft bg-navy-2/60">
        <CardHeader>
          <CardTitle className="ui-caps text-[0.72rem] text-ivory-dim">Just arrived</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="m-0 grid list-none gap-2 p-0">
            {stats?.recent.length ? (
              stats.recent.map((x) => (
                <li key={x.name + x.at} className="flex justify-between gap-3 border-b border-hairline-soft pb-2 last:border-0">
                  <span>
                    {x.name}
                    {x.table ? ` · T${x.table}` : ''}
                  </span>
                  <small className="text-ivory-dim tabular-nums">{clock(x.at)}</small>
                </li>
              ))
            ) : (
              <li className="text-ivory-dim">No arrivals yet.</li>
            )}
          </ol>
        </CardContent>
      </Card>
    </StaffPage>
  );
}
