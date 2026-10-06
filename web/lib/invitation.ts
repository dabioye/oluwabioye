// Where and how big the guest's name sits on the traditional invitation card.
export type NameSlot = { top: number; maxSize: number };

/** Long names go on two balanced lines so they stay legible inside the slot. Size is in % of card width. */
export function nameLayout(name: string, slot: NameSlot) {
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
  const size = name ? Math.min(cap, (slot.maxSize * 13) / Math.max(13, longest)) : 0;
  return { lines, top, size, lineHeight };
}
