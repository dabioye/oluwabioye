'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, Check, Download, KeyRound, Loader2, Lock, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api, ApiError } from '@/lib/api';
import { longDate } from '@/lib/format';
import type { BudgetData, BudgetItem } from '@/lib/types';
import { cn } from '@/lib/utils';
import { StaffHeader, StaffPage } from '../staff-shell';

const naira = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });
const money = (n: number) => naira.format(n || 0);
/** What a line is expected to cost: the agreed price once known, the estimate until then. */
const cost = (b: BudgetItem) => b.actual || b.estimate;
const owed = (b: BudgetItem) => Math.max(cost(b) - b.paid, 0);
const today = () => new Date().toISOString().slice(0, 10);
const daysTo = (iso: string) => Math.round((new Date(`${iso}T00:00:00`).getTime() - new Date(`${today()}T00:00:00`).getTime()) / 864e5);

// Two steps of the gold ramp (checked for contrast on the navy card): paid, then still to pay.
const PAID = '#e0bd83';
const TO_PAY = '#7a6340';

/**
 * The couple's private wedding budget. The admin password opens the invitation desk; this page also needs
 * the couple's own passcode, so the planning team can use the desk without seeing it.
 */
export function Budget() {
  const [status, setStatus] = useState<{ passcodeSet: boolean; unlocked: boolean } | null>(null);
  const check = useCallback(
    () =>
      api<{ passcodeSet: boolean; unlocked: boolean }>('/api/budget/status').then(setStatus, (e) =>
        e instanceof ApiError && e.status === 401 ? location.reload() : toast.error('Couldn’t reach the budget'),
      ),
    [],
  );
  useEffect(() => {
    check();
  }, [check]);

  return (
    <StaffPage>
      <StaffHeader
        title="Wedding budget"
        subtitle="Private to Sarah & Damilare"
        links={[
          { href: '/admin', label: 'Invitation desk' },
          { href: '/admin/inbox', label: 'Inbox' },
        ]}
        signOutTo="/admin"
      />
      {!status ? (
        <Loader2 className="mx-auto mt-16 animate-spin text-gold" aria-label="Loading" />
      ) : status.unlocked ? (
        <BudgetView onLocked={check} />
      ) : (
        <PasscodeForm firstTime={!status.passcodeSet} onUnlocked={check} />
      )}
    </StaffPage>
  );
}

function PasscodeForm({ firstTime, onUnlocked }: { firstTime: boolean; onUnlocked: () => void }) {
  const [passcode, setPasscode] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (firstTime && passcode !== confirm) return setError('The two passcodes don’t match.');
    setBusy(true);
    setError('');
    try {
      await api(firstTime ? '/api/budget/passcode' : '/api/budget/unlock', { body: { passcode } });
      onUnlocked();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="mx-auto mt-10 max-w-[420px] border-hairline-soft bg-navy-2/60 py-7">
      <CardContent className="grid gap-4 px-6 text-center">
        <KeyRound className="mx-auto size-8 text-gold" aria-hidden />
        <h1 className="display m-0 text-2xl">{firstTime ? 'Choose a budget passcode' : 'Budget passcode'}</h1>
        <p className="m-0 font-ui text-[0.88rem] text-ivory-dim">
          {firstTime
            ? 'Only the two of you should know it. The planning team can keep using the invitation desk with the admin password, but can’t open the budget.'
            : 'The budget is kept separate from the invitation desk.'}
        </p>
        <form onSubmit={submit} className="grid gap-3 text-left">
          <Label htmlFor="passcode" className="text-[0.72rem] tracking-[0.12em] text-ivory-dim uppercase">
            Passcode
          </Label>
          <Input
            id="passcode"
            type="password"
            autoComplete={firstTime ? 'new-password' : 'current-password'}
            required
            minLength={firstTime ? 6 : undefined}
            autoFocus
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            className="h-12 text-base"
          />
          {firstTime && (
            <>
              <Label htmlFor="confirm" className="text-[0.72rem] tracking-[0.12em] text-ivory-dim uppercase">
                Type it again
              </Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="h-12 text-base"
              />
            </>
          )}
          {error && (
            <p role="alert" className="m-0 font-ui text-sm text-bad">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" disabled={busy} className="mt-1 h-12">
            {busy ? <Loader2 className="animate-spin" /> : <Lock />} {firstTime ? 'Set passcode and open' : 'Open the budget'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function BudgetView({ onLocked }: { onLocked: () => void }) {
  const [data, setData] = useState<BudgetData | null>(null);
  const [editing, setEditing] = useState<Partial<BudgetItem> | null>(null);
  const [category, setCategory] = useState('all');

  const load = useCallback(
    () =>
      api<BudgetData>('/api/budget').then(setData, (e) =>
        e instanceof ApiError && (e.status === 401 || e.status === 403) ? onLocked() : toast.error('Couldn’t load the budget'),
      ),
    [onLocked],
  );
  useEffect(() => {
    load();
  }, [load]);

  const items = useMemo(() => data?.items ?? [], [data]);
  const totals = useMemo(() => {
    const expected = items.reduce((s, b) => s + cost(b), 0);
    const paid = items.reduce((s, b) => s + Math.min(b.paid, cost(b) || b.paid), 0);
    return { expected, paid, toPay: Math.max(expected - paid, 0), estimated: items.reduce((s, b) => s + b.estimate, 0) };
  }, [items]);
  const byCategory = useMemo(() => {
    const m = new Map<string, { expected: number; paid: number; lines: number }>();
    for (const b of items) {
      const c = m.get(b.category) ?? { expected: 0, paid: 0, lines: 0 };
      c.expected += cost(b);
      c.paid += Math.min(b.paid, cost(b) || b.paid);
      c.lines++;
      m.set(b.category, c);
    }
    return [...m.entries()].sort((a, b) => b[1].expected - a[1].expected);
  }, [items]);
  const upcoming = useMemo(
    () =>
      items
        .filter((b) => b.due && owed(b) > 0)
        .sort((a, b) => a.due.localeCompare(b.due))
        .slice(0, 6),
    [items],
  );

  if (!data) return <Loader2 className="mx-auto mt-16 animate-spin text-gold" aria-label="Loading" />;
  const target = data.settings.total;
  const left = target - totals.expected;
  const shown = category === 'all' ? items : items.filter((b) => b.category === category);
  const maxCategory = Math.max(1, ...byCategory.map(([, c]) => c.expected));

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <Button className="h-10" onClick={() => setEditing({ category: data.categories[0] })}>
          <Plus /> Add a line
        </Button>
        <Button asChild variant="outline" className="h-10 border-gold/40 bg-transparent text-gold">
          <a href="/api/budget/export.csv">
            <Download /> Export
          </a>
        </Button>
        <Button
          variant="outline"
          className="h-10 border-gold/40 bg-transparent text-gold"
          onClick={async () => {
            await api('/api/budget/lock', { method: 'POST' });
            onLocked();
          }}
        >
          <Lock /> Lock
        </Button>
      </div>

      <section aria-label="Totals" className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">
        <BudgetTarget total={target} onSaved={load} />
        <Tile
          label="Expected cost"
          value={money(totals.expected)}
          note={target ? `${Math.round((totals.expected / target) * 100)}% of the budget` : 'Agreed prices, or estimates'}
        />
        <Tile
          label="Paid so far"
          value={money(totals.paid)}
          note={totals.expected ? `${Math.round((totals.paid / totals.expected) * 100)}% of the cost` : undefined}
        />
        <Tile label="Still to pay" value={money(totals.toPay)} note={upcoming[0] ? `next due ${longDate(upcoming[0].due)}` : undefined} />
        <Tile
          label={left < 0 ? 'Over budget' : 'Left in budget'}
          value={money(Math.abs(left))}
          tone={target ? (left < 0 ? 'bad' : 'ok') : undefined}
          note={target ? undefined : 'Set a budget to see this'}
        />
      </section>

      {target > 0 && (
        <div className="mt-4" aria-label={`Paid ${money(totals.paid)} and still to pay ${money(totals.toPay)} of a ${money(target)} budget`} role="img">
          <div className="flex h-3 gap-[2px] overflow-hidden rounded-full bg-gold/10">
            <i
              className="block h-full rounded-l-full"
              style={{ width: `${Math.min((totals.paid / Math.max(target, totals.expected)) * 100, 100)}%`, background: PAID }}
            />
            <i className="block h-full" style={{ width: `${Math.min((totals.toPay / Math.max(target, totals.expected)) * 100, 100)}%`, background: TO_PAY }} />
          </div>
          <Legend />
        </div>
      )}

      <div className="mt-5 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="min-w-0 gap-0 border-hairline-soft bg-navy-2/60 py-0">
          <div className="flex flex-wrap gap-1.5 border-b border-hairline-soft px-4 py-3" role="tablist" aria-label="Filter by category">
            {['all', ...byCategory.map(([c]) => c)].map((c) => (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={category === c}
                onClick={() => setCategory(c)}
                className={cn(
                  'cursor-pointer rounded-full border border-gold/30 px-3 py-1.5 text-[0.75rem] text-ivory-dim',
                  category === c && 'border-gold bg-gold text-navy',
                )}
              >
                {c === 'all' ? `All lines (${items.length})` : c}
              </button>
            ))}
          </div>
          {shown.length === 0 ? (
            <p className="p-8 text-center text-ivory-dim">
              {items.length ? 'Nothing in this category.' : 'No lines yet. Add the first one: the venue, catering, attire and so on.'}
            </p>
          ) : (
            <ul className="m-0 list-none p-0" aria-label="Budget lines">
              {shown.map((b) => (
                <Line key={b.id} b={b} onEdit={() => setEditing(b)} />
              ))}
            </ul>
          )}
        </Card>

        <div className="grid gap-4">
          <Card className="gap-3 border-hairline-soft bg-navy-2/60 py-4">
            <CardHeader className="px-4">
              <CardTitle className="ui-caps text-[0.72rem] text-ivory-dim">By category</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 px-4">
              {byCategory.length === 0 && <p className="m-0 text-sm text-ivory-dim">Categories appear as you add lines.</p>}
              {byCategory.map(([c, v]) => (
                <div key={c} className="grid gap-1" title={`${c}: paid ${money(v.paid)} of ${money(v.expected)}`}>
                  <div className="flex justify-between gap-2 text-[0.82rem]">
                    <span className="truncate">{c}</span>
                    <span className="shrink-0 text-ivory-dim tabular-nums">{money(v.expected)}</span>
                  </div>
                  <div className="flex h-2 gap-[2px]" style={{ width: `${(v.expected / maxCategory) * 100}%` }} aria-hidden>
                    {v.paid > 0 && <i className="block h-full rounded-l-[4px]" style={{ width: `${(v.paid / v.expected) * 100}%`, background: PAID }} />}
                    {v.expected - v.paid > 0 && (
                      <i className="block h-full flex-1 rounded-r-[4px]" style={{ background: TO_PAY, borderRadius: v.paid ? undefined : 4 }} />
                    )}
                  </div>
                  <small className="text-[0.72rem] text-ivory-dim">
                    {money(v.paid)} paid · {v.lines} {v.lines === 1 ? 'line' : 'lines'}
                  </small>
                </div>
              ))}
              {byCategory.length > 0 && <Legend />}
            </CardContent>
          </Card>

          <Card className="gap-3 border-hairline-soft bg-navy-2/60 py-4">
            <CardHeader className="px-4">
              <CardTitle className="ui-caps text-[0.72rem] text-ivory-dim">Payments coming up</CardTitle>
            </CardHeader>
            <CardContent className="px-4">
              {upcoming.length === 0 ? (
                <p className="m-0 text-sm text-ivory-dim">Add a due date to a line with a balance and it shows here.</p>
              ) : (
                <ol className="m-0 grid list-none gap-2.5 p-0 text-[0.85rem]">
                  {upcoming.map((b) => (
                    <li key={b.id} className="flex justify-between gap-3 border-b border-hairline-soft pb-2 last:border-0">
                      <span className="min-w-0">
                        <b className="block truncate font-medium">{b.item}</b>
                        <Due iso={b.due} />
                      </span>
                      <span className="shrink-0 tabular-nums">{money(owed(b))}</span>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {editing && <LineDialog key={editing.id || 'new'} line={editing} categories={data.categories} onClose={() => setEditing(null)} onSaved={load} />}
    </>
  );
}

function Legend() {
  return (
    <p className="m-0 mt-2 flex gap-4 text-[0.72rem] text-ivory-dim">
      <span className="inline-flex items-center gap-1.5">
        <i className="size-2.5 rounded-sm" style={{ background: PAID }} /> Paid
      </span>
      <span className="inline-flex items-center gap-1.5">
        <i className="size-2.5 rounded-sm" style={{ background: TO_PAY }} /> Still to pay
      </span>
    </p>
  );
}

function Tile({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: 'ok' | 'bad' }) {
  return (
    <div className="grid content-start gap-1 rounded-md border border-hairline-soft bg-navy-2 px-3.5 pt-3 pb-2.5">
      <span className="text-[0.68rem] tracking-[0.18em] text-ivory-dim uppercase">{label}</span>
      <span className="inline-flex items-center gap-1.5 font-display text-[1.45rem] leading-tight text-ivory tabular-nums">
        {tone === 'bad' && <AlertTriangle className="size-4 shrink-0 text-bad" aria-label="Warning" />}
        {value}
      </span>
      {note && <small className={cn('text-[0.72rem] text-ivory-dim', tone === 'bad' && 'text-bad')}>{note}</small>}
    </div>
  );
}

function BudgetTarget({ total, onSaved }: { total: number; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  return (
    <div className="grid content-start gap-1 rounded-md border border-gold/40 bg-navy-2 px-3.5 pt-3 pb-2.5">
      <span className="text-[0.68rem] tracking-[0.18em] text-ivory-dim uppercase">Our budget</span>
      {open ? (
        <form
          className="flex gap-1.5"
          onSubmit={async (e) => {
            e.preventDefault();
            await api('/api/budget/settings', { method: 'PUT', body: { total: value } });
            setOpen(false);
            onSaved();
          }}
        >
          <Input autoFocus inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} aria-label="Total budget in naira" className="h-9" />
          <Button type="submit" size="icon" className="size-9 shrink-0" aria-label="Save budget">
            <Check />
          </Button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => {
            setValue(total ? String(total) : '');
            setOpen(true);
          }}
          className="inline-flex cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-left font-display text-[1.45rem] leading-tight text-ivory tabular-nums hover:text-gold"
        >
          {total ? money(total) : 'Set it'} <Pencil className="size-3.5 text-gold" aria-label="Change the budget" />
        </button>
      )}
    </div>
  );
}

function Due({ iso }: { iso: string }) {
  const d = daysTo(iso);
  return (
    <small className={cn('inline-flex items-center gap-1 text-[0.72rem] text-ivory-dim', d < 0 && 'text-bad', d >= 0 && d <= 14 && 'text-warn')}>
      <CalendarClock className="size-3" aria-hidden />
      {d < 0 ? `Overdue since ${longDate(iso)}` : d === 0 ? 'Due today' : d <= 14 ? `Due in ${d} day${d === 1 ? '' : 's'}` : `Due ${longDate(iso)}`}
    </small>
  );
}

function Line({ b, onEdit }: { b: BudgetItem; onEdit: () => void }) {
  const c = cost(b);
  const state = c && b.paid >= c ? 'paid' : b.paid > 0 ? 'part' : 'unpaid';
  return (
    <li className="border-b border-hairline-soft last:border-0">
      <button
        type="button"
        onClick={onEdit}
        className="grid w-full cursor-pointer gap-1 border-0 bg-transparent px-4 py-3 text-left hover:bg-gold/5 sm:grid-cols-[minmax(0,1fr)_auto]"
      >
        <span className="min-w-0">
          <b className="block font-medium [overflow-wrap:anywhere] text-ivory">
            {b.item}
            <Badge
              variant="outline"
              className={cn(
                'ml-2 align-middle text-[0.65rem] font-normal',
                state === 'paid' ? 'border-ok/50 text-ok' : state === 'part' ? 'border-warn/50 text-warn' : 'border-ivory-dim/40 text-ivory-dim',
              )}
            >
              {state === 'paid' ? 'Paid' : state === 'part' ? 'Part paid' : 'Not paid'}
            </Badge>
          </b>
          <small className="block text-[0.78rem] text-ivory-dim">{[b.category, b.vendor].filter(Boolean).join(' · ')}</small>
          {b.due && owed(b) > 0 && <Due iso={b.due} />}
        </span>
        <span className="grid justify-items-start text-[0.85rem] tabular-nums sm:justify-items-end">
          <span className="font-medium">{money(c)}</span>
          <small className="text-[0.75rem] text-ivory-dim">
            {b.actual && b.estimate && b.actual !== b.estimate ? `estimated ${money(b.estimate)} · ` : ''}
            {state === 'paid' ? 'all paid' : `${money(b.paid)} paid, ${money(owed(b))} to pay`}
          </small>
        </span>
      </button>
    </li>
  );
}

type Form = { category: string; item: string; vendor: string; estimate: string; actual: string; paid: string; due: string; notes: string };
const num = (n?: number) => (n ? String(n) : '');

function LineDialog({ line, categories, onClose, onSaved }: { line: Partial<BudgetItem>; categories: string[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Form>({
    category: line.category || '',
    item: line.item || '',
    vendor: line.vendor || '',
    estimate: num(line.estimate),
    actual: num(line.actual),
    paid: num(line.paid),
    due: line.due || '',
    notes: line.notes || '',
  });
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const field = (k: keyof Form, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`b-${k}`} className="text-[0.72rem] tracking-[0.12em] text-ivory-dim uppercase">
        {label}
      </Label>
      <Input id={`b-${k}`} value={f[k]} onChange={set(k)} className="h-10" {...props} />
    </div>
  );

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (line.id) await api(`/api/budget/items/${line.id}`, { method: 'PATCH', body: f });
      else await api('/api/budget/items', { body: f });
      toast.success(line.id ? 'Saved' : 'Added');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{line.id ? 'Edit line' : 'Add a line'}</DialogTitle>
          <DialogDescription>Amounts in naira. Leave the agreed price empty until you have a quote.</DialogDescription>
        </DialogHeader>
        <form id="budget-line" onSubmit={save} className="grid gap-3 sm:grid-cols-2">
          {field('category', 'Category', { list: 'budget-categories', required: true })}
          <datalist id="budget-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          {field('item', 'What it is', { required: true, placeholder: 'e.g. Hall rental' })}
          {field('vendor', 'Vendor', { placeholder: 'Optional' })}
          {field('due', 'Balance due', { type: 'date' })}
          {field('estimate', 'Estimate (₦)', { inputMode: 'numeric', placeholder: '0' })}
          {field('actual', 'Agreed price (₦)', { inputMode: 'numeric', placeholder: 'When known' })}
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="b-paid" className="text-[0.72rem] tracking-[0.12em] text-ivory-dim uppercase">
              Paid so far (₦)
            </Label>
            <div className="flex gap-2">
              <Input id="b-paid" value={f.paid} onChange={set('paid')} inputMode="numeric" placeholder="0" className="h-10" />
              <Button
                type="button"
                variant="outline"
                className="h-10 shrink-0 border-gold/40 bg-transparent text-gold"
                onClick={() => setF((x) => ({ ...x, paid: x.actual || x.estimate }))}
              >
                <Check /> Paid in full
              </Button>
            </div>
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="b-notes" className="text-[0.72rem] tracking-[0.12em] text-ivory-dim uppercase">
              Notes
            </Label>
            <Textarea id="b-notes" value={f.notes} onChange={set('notes')} rows={2} placeholder="Account details, what’s included, contact…" />
          </div>
        </form>
        <DialogFooter className="gap-2 sm:justify-between">
          {line.id ? (
            <Button type="button" variant="ghost" className="text-bad hover:text-bad" onClick={() => setConfirmDelete(true)}>
              <Trash2 /> Delete
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" form="budget-line" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />} {line.id ? 'Save' : 'Add'}
          </Button>
        </DialogFooter>
        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete “{line.item}”?</AlertDialogTitle>
              <AlertDialogDescription>This can’t be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep it</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  await api(`/api/budget/items/${line.id}`, { method: 'DELETE' });
                  toast.success('Deleted');
                  onSaved();
                  onClose();
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
