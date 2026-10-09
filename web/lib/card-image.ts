'use client';
import { CARD_INK, CODE_SPACING, nameFont, nameLayout, type CodeSlot, type NameSlot } from './invitation';

// Draws a guest's personalised traditional invitation (card + name + access code) as a JPEG,
// placed exactly like the card on their invitation page, so it can be sent with the WhatsApp message.

const images = new Map<string, Promise<HTMLImageElement>>();

function loadImage(src: string) {
  let p = images.get(src);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous'; // the default card is served from the invite site
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Couldn’t load the invitation card image.'));
      img.src = src;
    });
    images.set(src, p);
    p.catch(() => images.delete(src));
  }
  return p;
}

const fontsReady = (family = 'Pinyon Script') =>
  Promise.all([document.fonts.load(`400 48px "${family}"`), document.fonts.load('500 48px "Bodoni Moda"')]).catch(() => []);

/** Load the card image and fonts ahead of time so sending is instant. */
export function preloadCard(src: string, font?: string) {
  if (!src) return;
  loadImage(src).catch(() => {});
  fontsReady(nameFont(font).family);
}

export type CardInput = { src: string; name: string; code: string; nameSlot: NameSlot; codeSlot: CodeSlot; font?: string };

export async function renderCard({ src, name, code, nameSlot, codeSlot, font }: CardInput): Promise<Blob> {
  const [img] = await Promise.all([loadImage(src), fontsReady(nameFont(font).family)]);
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d')!;
  x.drawImage(img, 0, 0, W, H);
  x.fillStyle = CARD_INK;
  x.textAlign = 'center';
  x.textBaseline = 'middle';

  // Guest name: same sizes as the web card (sizes are % of card width).
  const n = nameLayout(name, nameSlot, font);
  const namePx = (n.size / 100) * W;
  x.font = `400 ${namePx}px "${n.family}", cursive`;
  x.shadowColor = 'rgba(0,0,0,0.5)';
  x.shadowBlur = namePx * 0.08;
  x.shadowOffsetY = namePx * 0.03;
  const step = namePx * n.lineHeight;
  const first = (n.top / 100) * H - ((n.lines.length - 1) * step) / 2;
  n.lines.forEach((line, i) => x.fillText(line, W / 2, first + i * step));

  // Access code, letter-spaced like the web card.
  const codePx = (codeSlot.size / 100) * W;
  x.font = `500 ${codePx}px "Bodoni Moda", serif`;
  x.textAlign = 'left';
  const gap = codePx * CODE_SPACING;
  const widths = [...code].map((ch) => x.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + gap * code.length;
  let cx = (codeSlot.left / 100) * W - total / 2;
  const cy = (codeSlot.top / 100) * H;
  [...code].forEach((ch, i) => {
    x.fillText(ch, cx, cy);
    cx += widths[i] + gap;
  });

  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('Couldn’t create the card image.'))), 'image/jpeg', 0.9));
}

export const cardFileName = (name: string) => `Invitation - ${name.replace(/[\\/:*?"<>|]+/g, '').trim()}.jpg`;

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Phones can share an image together with text to WhatsApp; most desktop browsers can't. */
export function canShareImages() {
  try {
    return !!navigator.canShare?.({ files: [new File([''], 'card.jpg', { type: 'image/jpeg' })] });
  } catch {
    return false;
  }
}
