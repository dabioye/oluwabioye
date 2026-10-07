'use client';
import { useEffect, useState } from 'react';
import { ImageDown, Loader2, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cardFileName, download } from '@/lib/card-image';
import type { Guest } from '@/lib/types';

/**
 * Second step of a WhatsApp send from a phone. The message has already gone out through the guest's chat
 * (a WhatsApp link can carry text but not an image), so this shares the card on its own; the guest is then
 * at the top of WhatsApp's recent chats. Sharing needs a fresh tap, which is why it is a separate button.
 */
export function SendCardDialog({ guest, render, onClose }: { guest: Guest | null; render: (g: Guest) => Promise<Blob>; onClose: () => void }) {
  const [card, setCard] = useState<{ id: string; file: File; url: string } | null>(null);
  const ready = card && guest && card.id === guest.id ? card : null;

  useEffect(() => {
    if (!guest) return;
    let url = '';
    let live = true;
    render(guest).then(
      (blob) => {
        if (!live) return;
        url = URL.createObjectURL(blob);
        setCard({ id: guest.id, file: new File([blob], cardFileName(guest.name), { type: 'image/jpeg' }), url });
      },
      (e) => toast.error(e instanceof Error ? e.message : 'Couldn’t create the card'),
    );
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [guest, render]);

  async function share() {
    if (!ready) return;
    try {
      await navigator.share({ files: [ready.file] });
      onClose();
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast.error(e instanceof Error ? e.message : 'Couldn’t share the card');
    }
  }

  const first = guest?.name.split(/\s+/)[0];
  return (
    <Dialog open={!!guest} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Now send {first}’s card</DialogTitle>
          <DialogDescription>
            Send the message in the WhatsApp chat that opened, then come back here. Tap <b>Share card</b>, choose WhatsApp, then {guest?.name} (at the top of
            your recent chats).
          </DialogDescription>
        </DialogHeader>
        <div className="grid place-items-center">
          {ready ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ready.url} alt={`Invitation card for ${guest?.name}`} className="max-h-[42vh] w-auto rounded-[3px] shadow-md" />
          ) : (
            <div className="grid aspect-[2/3] h-[42vh] max-h-72 place-items-center rounded-[3px] bg-navy-2">
              <Loader2 className="animate-spin text-gold" aria-label="Preparing the card" />
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" disabled={!ready} onClick={() => ready && download(ready.file, ready.file.name)}>
            <ImageDown /> Save image
          </Button>
          <Button disabled={!ready} onClick={share} className="bg-[#1f7a4d] text-white hover:bg-[#25915b]">
            <Share2 /> Share card
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
