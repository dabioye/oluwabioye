// Draws a guest's personalised traditional invitation (card + name + access code) as a JPEG on the server,
// for WhatsApp sends that don't come from the invitation desk (automatic sends, Send all pending).
// It follows the desk's canvas drawing (web/lib/card-image.ts) step by step: the text is turned into
// outlines with the same fonts and laid over the card, so both cards look the same.
const path = require('path');
const fs = require('fs');
const opentype = require('opentype.js');
const sharp = require('sharp');
const { nameFont, nameLayout, CODE_SPACING, INK } = require('./card-layout');

const FONTS = path.join(__dirname, '..', 'fonts');
const loaded = new Map();
function font(file) {
  if (!loaded.has(file)) {
    const b = fs.readFileSync(path.join(FONTS, file));
    loaded.set(file, opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)));
  }
  return loaded.get(file);
}
const CODE_FONT = 'bodoni-moda-latin-500-normal.woff';

// Canvas "middle" baseline, as Chrome draws it: the font's ascent and descent are scaled to fill the
// em box, and that box is centred on y (checked against Chrome's pixels for all five fonts).
const baselineFor = (f, px, y) => y + ((f.ascender + f.descender) / (2 * (f.ascender - f.descender))) * px;
const width = (f, text, px) => f.getAdvanceWidth(text, px, { kerning: true });

/** SVG path data for one line of text, centred on (cx, cy) like canvas textAlign center + middle. */
function centred(f, text, px, cx, cy) {
  return f.getPath(text, cx - width(f, text, px) / 2, baselineFor(f, px, cy), px, { kerning: true }).toPathData(2);
}

/** The access code, letter by letter, spaced like the desk's card and centred on (cx, cy). */
function spaced(f, code, px, cx, cy) {
  const gap = px * CODE_SPACING;
  const chars = [...code];
  const widths = chars.map((ch) => width(f, ch, px));
  let x = cx - (widths.reduce((a, b) => a + b, 0) + gap * chars.length) / 2;
  const y = baselineFor(f, px, cy);
  return chars
    .map((ch, i) => {
      const d = f.getPath(ch, x, y, px).toPathData(2);
      x += widths[i] + gap;
      return d;
    })
    .join(' ');
}

/** The card as JPEG, with the guest's name and code set into it. `image` is the card artwork. */
async function renderCard({ image, name, code, nameSlot, codeSlot, font: family }) {
  const base = sharp(image).rotate();
  const { width: W, height: H } = await base.metadata();

  const n = nameLayout(name, nameSlot, family);
  const namePx = (n.size / 100) * W;
  const nf = font(nameFont(family).file);
  const step = namePx * n.lineHeight;
  const first = (n.top / 100) * H - ((n.lines.length - 1) * step) / 2;
  const nameD = n.lines.map((line, i) => centred(nf, line, namePx, W / 2, first + i * step)).join(' ');

  const codeD = code ? spaced(font(CODE_FONT), code, (codeSlot.size / 100) * W, (codeSlot.left / 100) * W, (codeSlot.top / 100) * H) : '';

  // The desk sets one soft shadow (sized from the name) and keeps it for the code too.
  const blur = (namePx * 0.08) / 2;
  const dy = namePx * 0.03;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs><filter id="s" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="${blur.toFixed(2)}"/></filter></defs>
  <g fill="#000" fill-opacity="0.5" filter="url(#s)" transform="translate(0 ${dy.toFixed(2)})"><path d="${nameD}"/><path d="${codeD}"/></g>
  <g fill="${INK}"><path d="${nameD}"/><path d="${codeD}"/></g>
</svg>`;
  return base.composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
}

module.exports = { renderCard };
