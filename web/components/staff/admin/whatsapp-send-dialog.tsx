'use client';
import { useEffect, useRef, useState } from 'react';
import { Loader2, Send, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api, ApiError } from '@/lib/api';
import type { Guest, InviteKind, WaSend, WhatsAppStatus } from '@/lib/types';

type Phase = 'confirm' | 'sending' | 'done';
const PAUSE_MS = 600; // a steady pace keeps the number in good standing with WhatsApp

/**
 * Sends invitations through WhatsApp Business from the couple's number: a preview of the first one's card
 * and message, then one send per invitation (with the card when the template starts with an image). A guest
 * invited to both weddings gets two: the traditional invitation, then the church one.
 */
export function WhatsAppSendDialog({
  sends,
  wa,
  render,
  onProgress,
  onClose,
}: {
  sends: WaSend[] | null;
  wa: WhatsAppStatus;
  render: (g: Guest, kind: InviteKind) => Promise<Blob>;
  onProgress: () => void;
  onClose: () => void;
}) {
  const tpl = (k: InviteKind) => (k === 'church' ? wa.churchTemplate : wa.template);
  const head = sends?.[0] ?? null;
  const first = head?.guest ?? null;
  const kind = head?.kind ?? 'trad';
  const needsCard = !!tpl(kind)?.needsImage;
  const [preview, setPreview] = useState<{ id: string; text: string; card: string } | null>(null);
  const [phase, setPhase] = useState<Phase>('confirm');
  const [sent, setSent] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  const stop = useRef(false);
  const shown = preview && first && preview.id === first.id ? preview : null;

  useEffect(() => {
    if (!first) return;
    let live = true;
    let url = '';
    Promise.all([
      api<WhatsAppStatus>(`/api/admin/whatsapp?guest=${encodeURIComponent(first.id)}&kind=${kind}`).then(
        (s) => s.preview || '',
        () => '',
      ),
      needsCard
        ? render(first, kind).then(
            (b) => (url = URL.createObjectURL(b)),
            () => '',
          )
        : Promise.resolve(''),
    ]).then(([text, card]) => live && setPreview({ id: first.id, text, card }));
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [first, kind, needsCard, render]);

  async function sendAll() {
    if (!sends) return;
    stop.current = false;
    setPhase('sending');
    setSent(0);
    setFailed([]);
    for (const [i, { guest: g, kind: k }] of sends.entries()) {
      if (stop.current) break;
      try {
        const card = tpl(k)?.needsImage ? await render(g, k) : undefined;
        await api(`/api/admin/guests/${g.id}/whatsapp?kind=${k}`, { method: 'POST', raw: card, type: 'image/jpeg' });
        setSent((n) => n + 1);
      } catch (e) {
        const who = `${g.name}${k === 'church' ? ' (church)' : ''}`;
        setFailed((f) => [...f, e instanceof ApiError ? e.message : `${who}: ${e instanceof Error ? e.message : 'couldn’t send'}`]);
      }
      if ((i + 1) % 10 === 0) onProgress();
      if (i < sends.length - 1) await new Promise((r) => setTimeout(r, PAUSE_MS));
    }
    onProgress();
    setPhase('done');
  }

  function close() {
    stop.current = true;
    setPhase('confirm');
    setPreview(null);
    onClose();
  }

  const n = sends?.length ?? 0;
  const people = new Set(sends?.map((s) => s.guest.id)).size;
  const many = n > 1;
  const kinds = new Set(sends?.map((s) => s.kind));
  const from = wa.phone?.display_phone_number || 'your WhatsApp Business number';
  const title =
    people > 1
      ? `Send ${n} invitations to ${people} guests on WhatsApp`
      : many
        ? `Send ${first?.name}’s two invitations on WhatsApp`
        : `Send ${first?.name}’s ${kind === 'church' ? 'church ' : ''}invitation on WhatsApp`;
  return (
    <Dialog open={!!sends} onOpenChange={(o) => !o && phase !== 'sending' && close()}>
      <DialogContent className="max-h-[92vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            From {from}, with the {[...kinds].map((k) => `“${tpl(k)?.name}”`).join(' and ')} {kinds.size > 1 ? 'templates' : 'template'}.{' '}
            {kinds.size > 1
              ? `Guests invited to both weddings get both, traditional first. Here is ${first?.name}’s ${kind === 'church' ? 'church' : 'traditional'} one.`
              : many
                ? `Here is ${first?.name}’s; each guest gets their own.`
                : 'This is what they’ll receive.'}
          </DialogDescription>
        </DialogHeader>

        {phase === 'confirm' && (
          <div role="group" className="grid gap-2 rounded-md bg-[#0b141a] p-3" aria-label="Message preview">
            <div className="ml-auto grid max-w-[85%] gap-1.5 rounded-lg rounded-tr-none bg-[#005c4b] p-1.5 text-[0.85rem] text-[#e9edef]">
              {needsCard &&
                (shown?.card ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={shown.card}
                    alt={`${kind === 'church' ? 'Church invitation' : 'Invitation'} card for ${first?.name}`}
                    className="w-full rounded-md"
                  />
                ) : (
                  <div className="grid aspect-[2/3] w-full place-items-center rounded-md bg-black/20">
                    <Loader2 role="img" className="animate-spin" aria-label="Preparing the card" />
                  </div>
                ))}
              <p className="m-0 px-1.5 pb-1 whitespace-pre-wrap">{shown ? shown.text || tpl(kind)?.body : 'Preparing…'}</p>
              {tpl(kind)?.buttons.map((b) => (
                <span key={b.text} className="border-t border-white/15 pt-1.5 text-center text-[#53bdeb]">
                  {b.text}
                </span>
              ))}
            </div>
          </div>
        )}

        {phase !== 'confirm' && (
          <div className="grid gap-2" aria-live="polite">
            <div className="h-2 overflow-hidden rounded-full bg-gold/15">
              <i className="block h-full bg-ok transition-[width]" style={{ width: `${((sent + failed.length) / n) * 100}%` }} />
            </div>
            <p className="m-0 text-sm">
              {phase === 'sending' ? 'Sending… ' : 'Done. '}
              <b>{sent}</b> sent{failed.length ? `, ${failed.length} failed` : ''} of {n}.
            </p>
            {failed.length > 0 && (
              <ul className="m-0 grid max-h-40 list-none gap-1 overflow-y-auto p-0 text-[0.8rem] text-bad">
                {failed.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {phase === 'confirm' && (
            <>
              <Button variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button onClick={sendAll} disabled={!shown} className="bg-[#1f7a4d] text-white hover:bg-[#25915b]">
                <Send /> {many ? `Send all ${n}` : 'Send now'}
              </Button>
            </>
          )}
          {phase === 'sending' && (
            <Button variant="outline" onClick={() => (stop.current = true)}>
              <Square /> Stop
            </Button>
          )}
          {phase === 'done' && <Button onClick={close}>Done</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
