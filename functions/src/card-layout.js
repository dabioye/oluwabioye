// Where and how big a guest's name sits on the traditional invitation card. Shared by the website
// (the card on the invitation page and the one the desk draws) and the server (cards for automatic sends),
// so all three place the name the same way. Sizes are in % of the card's width.

/**
 * Script fonts for the guest's name. `scale` evens out their sizes: each is set so its capitals stand as
 * tall as Pinyon Script's without the name running wider (measured on "Tope Omidiji").
 */
const NAME_FONTS = [
  { family: 'Cookie', scale: 1.15, file: 'cookie-latin-400-normal.woff' },
  { family: 'Pinyon Script', scale: 1, file: 'pinyon-script-latin-400-normal.woff' },
  { family: 'MonteCarlo', scale: 1.08, file: 'montecarlo-latin-400-normal.woff' },
  { family: 'Lavishly Yours', scale: 1.05, file: 'lavishly-yours-latin-400-normal.woff' },
];
const nameFont = (family) => NAME_FONTS.find((f) => f.family === family) || NAME_FONTS[0];

/** Long names go on two balanced lines so they stay legible inside the slot. */
function nameLayout(name, slot, family) {
  let lines = name ? [name] : [];
  if (name && name.length > 20 && name.includes(' ')) {
    const mid = name.length / 2;
    const spaces = [...name.matchAll(/ /g)].map((m) => m.index);
    const cut = spaces.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid))[0];
    lines = [name.slice(0, cut), name.slice(cut + 1)];
  }
  const longest = Math.max(0, ...lines.map((l) => l.length));
  // Two lines must fit between "Cordially invites" and "to", so they are smaller and set tighter.
  const cap = lines.length > 1 ? slot.maxSize * 0.55 : slot.maxSize;
  const lineHeight = lines.length > 1 ? 0.95 : 1.05;
  const size = name ? Math.min(cap, (slot.maxSize * 13) / Math.max(13, longest)) * nameFont(family).scale : 0;
  return { lines, top: slot.top, size, lineHeight, family: nameFont(family).family };
}

/** The access code is letter-spaced by this share of its font size. */
const CODE_SPACING = 0.18;
/** Ink colour and shadow of the name and code on the card. */
const INK = '#f3e6cc';

module.exports = { NAME_FONTS, nameFont, nameLayout, CODE_SPACING, INK };
