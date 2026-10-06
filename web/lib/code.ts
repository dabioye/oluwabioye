// Invitation codes: 6 characters from an alphabet without look-alikes (no 0/O, 1/I/L).
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;
export const CODE_PATTERN = `^[${CODE_ALPHABET}]+$`;

/** Upper-cases, drops spaces/dashes and anything that can never be part of a code. */
export function normalizeCode(input: string) {
  return input
    .toUpperCase()
    .split('')
    .filter((c) => CODE_ALPHABET.includes(c))
    .join('')
    .slice(0, CODE_LENGTH);
}

/** Pulls a code out of pasted text: a link like https://…/i/ABC234, a whole message, or the bare code. */
export function codeFromText(text: string) {
  const link = /\/[ic]\/([A-Za-z0-9]+)/.exec(text);
  if (link) return normalizeCode(link[1]);
  // A six-character word (optionally split 3+3 by a space or dash) made only of code characters.
  const words = text.toUpperCase().match(/(?<![A-Z0-9])[A-Z0-9]{3}[\s-]?[A-Z0-9]{3}(?![A-Z0-9])/g) || [];
  const hit = words
    .map((w) => w.replace(/[\s-]/g, ''))
    .filter((w) => [...w].every((c) => CODE_ALPHABET.includes(c)))
    .pop();
  return hit ?? normalizeCode(text);
}

/** The code in the current address (/i/ABC234 or /c/ABC234). */
export function codeFromPath(pathname: string) {
  const m = /^\/[ic]\/([^/?#]+)/.exec(pathname);
  return m ? normalizeCode(decodeURIComponent(m[1])) : '';
}
