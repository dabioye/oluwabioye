// Where and how big the guest's name sits on the traditional invitation card.
export type NameSlot = { top: number; maxSize: number };
export type CodeSlot = { top: number; left: number; size: number };

/**
 * Script fonts for the guest's name. `scale` evens out their sizes: each is set so its capitals stand as
 * tall as Pinyon Script's without the name running wider (measured on "Tope Omidiji").
 */
export const NAME_FONTS = [
  { family: 'Pinyon Script', scale: 1 },
  { family: 'Cookie', scale: 1.15 },
  { family: 'MonteCarlo', scale: 1.08 },
  { family: 'Lavishly Yours', scale: 1.05 },
] as const;
export const nameFont = (family?: string) => NAME_FONTS.find((f) => f.family === family) ?? NAME_FONTS[0];

/** Long names go on two balanced lines so they stay legible inside the slot. Size is in % of card width. */
export function nameLayout(name: string, slot: NameSlot, family?: string) {
  let lines = name ? [name] : [];
  if (name && name.length > 20 && name.includes(' ')) {
    const mid = name.length / 2;
    const spaces = [...name.matchAll(/ /g)].map((m) => m.index!);
    const cut = spaces.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid))[0];
    lines = [name.slice(0, cut), name.slice(cut + 1)];
  }
  const longest = Math.max(0, ...lines.map((l) => l.length));
  // Two lines must fit between "Cordially invites" and "to", so they are smaller and set tighter.
  const cap = lines.length > 1 ? slot.maxSize * 0.55 : slot.maxSize;
  const top = slot.top;
  const lineHeight = lines.length > 1 ? 0.95 : 1.05;
  const size = name ? Math.min(cap, (slot.maxSize * 13) / Math.max(13, longest)) * nameFont(family).scale : 0;
  return { lines, top, size, lineHeight, family: nameFont(family).family };
}
