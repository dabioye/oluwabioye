'use client';
import { useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';

/** Paste rows from Excel / Google Sheets or pick a CSV file. */
export function ImportDialog({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return setResult('Paste some rows or choose a file first.');
    setBusy(true);
    try {
      const r = await api<{ added: number; skipped: string[] }>('/api/admin/import', { body: { csv: text } });
      setResult(`Added ${r.added} guest${r.added === 1 ? '' : 's'}.` + (r.skipped.length ? ` Skipped ${r.skipped.length} already on the list.` : ''));
      setText('');
      onImported();
    } catch (err) {
      setResult(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setResult('');
          onClose();
        }
      }}
    >
      <DialogContent className="border-hairline bg-navy-2 font-ui sm:max-w-xl">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-medium text-gold">Import guests</DialogTitle>
            <DialogDescription className="text-ivory-dim">
              Paste from Excel or Google Sheets, or choose a .csv file. The first row should be headers. Recognised columns:{' '}
              <code className="text-gold">name, phone, email, side, group, events, driverCard, channel, table, notes</code>. Only{' '}
              <code className="text-gold">name</code> is required. Duplicates (same name and phone) are skipped.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="imp-file" className="text-[0.72rem] tracking-[0.12em] text-ivory-dim uppercase">
              CSV file
            </Label>
            <Input
              id="imp-file"
              type="file"
              accept=".csv,text/csv,.tsv,.txt"
              onChange={async (e) => e.target.files?.[0] && setText(await e.target.files[0].text())}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="imp-text" className="text-[0.72rem] tracking-[0.12em] text-ivory-dim uppercase">
              Or paste rows
            </Label>
            <Textarea
              id="imp-text"
              rows={8}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={'name,phone,side,group,driverCard\nTope Omidiji,08031234567,groom,Friends,yes'}
              className="font-mono text-sm"
            />
          </div>
          {result && (
            <p role="status" className="m-0 text-sm text-ivory">
              {result}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" className="border-gold/40 bg-transparent" onClick={onClose}>
              Close
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Upload />} Import
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
