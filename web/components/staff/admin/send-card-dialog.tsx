'use client';
import { useEffect, useState } from 'react';
import { ImageDown, Loader2, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cardFileName, download, type CardFile } from '@/lib/card-image';

/**
 * Second step of a WhatsApp send from a phone. The message has already gone out through the guest's chat
 * (a WhatsApp link can carry text but not an image), so this shares the card (or cards) on their own; the guest
 * is then at the top of WhatsApp's recent chats. Sharing needs a fresh tap, which is why it is a separate button.
 */
export function SendCardDialog<T extends { id: string; name: string }>({
  guest,
  render,
  onClose,
  title,
  description,
}: {
  guest: T | null;
  /** One card, or several (a guest invited to both weddings gets both cards). */
  render: (g: T) => Promise<Blob | CardFile[]>;
  onClose: () => void;
  /** Instead of the "now send the card" wording, e.g. when only the card is being shared. */
  title?: string;
  description?: React.ReactNode;
}) {
  const [cards, setCards] = useState<{ id: string; files: { file: File; url: string }[] } | null>(null);
  const ready = cards && guest && cards.id === guest.id ? cards.files : null;

  useEffect(() => {
    if (!guest) return;
    let urls: string[] = [];
    let live = true;
    render(guest).then(
      (out) => {
        if (!live) return;
        const list = out instanceof Blob ? [{ blob: out, filename: cardFileName(guest.name) }] : out;
        const files = list.map((c) => ({ file: new File([c.blob], c.filename, { type: 'image/jpeg' }), url: URL.createObjectURL(c.blob) }));
        urls = files.map((f) => f.url);
        setCards({ id: guest.id, files });
      },
      (e) => toast.error(e instanceof Error ? e.message : 'Couldn’t create the card'),
    );
    return () => {
      live = false;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [guest, render]);

  async function share() {
    if (!ready) return;
    try {
      await navigator.share({ files: ready.map((c) => c.file) });
      onClose();
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast.error(e instanceof Error ? e.message : 'Couldn’t share the card');
    }
  }

  const first = guest?.name.split(/\s+/)[0];
  const many = (ready?.length ?? 0) > 1;
  return (
    <Dialog open={!!guest} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title ?? `Now send ${first}’s ${many ? 'cards' : 'card'}`}</DialogTitle>
          <DialogDescription>
            {description ?? (
              <>
                Send the message in the WhatsApp chat that opened, then come back here. Tap <b>{many ? 'Share cards' : 'Share card'}</b>, choose WhatsApp, then{' '}
                {guest?.name} (at the top of your recent chats).
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center gap-2">
          {ready ? (
            ready.map((c) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={c.url}
                src={c.url}
                alt={`${c.file.name.replace(/\.jpg$/, '').replace(' - ', ' card for ')}`}
                className={many ? 'max-h-[36vh] w-[48%] rounded-[3px] object-contain shadow-md' : 'max-h-[42vh] w-auto rounded-[3px] shadow-md'}
              />
            ))
          ) : (
            <div className="grid aspect-[2/3] h-[42vh] max-h-72 place-items-center rounded-[3px] bg-navy-2">
              <Loader2 className="animate-spin text-gold" aria-label="Preparing the card" />
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" disabled={!ready} onClick={() => ready?.forEach((c) => download(c.file, c.file.name))}>
            <ImageDown /> {many ? 'Save images' : 'Save image'}
          </Button>
          <Button disabled={!ready} onClick={share} className="bg-[#1f7a4d] text-white hover:bg-[#25915b]">
            <Share2 /> {many ? 'Share cards' : 'Share card'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
