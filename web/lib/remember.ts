'use client';
import { useSyncExternalStore } from 'react';

// "Remember me on this device": the guest's code is kept in this browser only (never sent anywhere else),
// so the invite site's front page can take them straight to their invitation next time.
const KEY = 'sd:guest';

export type Remembered = { code: string; name?: string };

const read = () => {
  try {
    return localStorage.getItem(KEY) || '';
  } catch {
    return '';
  }
};
const parse = (raw: string): Remembered | null => {
  try {
    const v = JSON.parse(raw || 'null');
    return v && typeof v.code === 'string' ? v : null;
  } catch {
    return null;
  }
};

export const recall = () => parse(read());

export function remember(v: Remembered) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {}
}

export function forget() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

const noop = () => () => {};
/** The remembered guest on this device, or null (always null while prerendering). */
export function useRemembered() {
  const raw = useSyncExternalStore(noop, read, () => '');
  return parse(raw);
}
