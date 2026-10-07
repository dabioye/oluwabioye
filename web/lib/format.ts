import { cfg } from './config';

// Dates are Lagos time. Noon avoids any timezone edge flipping the day.
const at = (iso: string) => new Date(`${iso}T12:00:00+01:00`);

export const weekday = (iso = cfg.date) => at(iso).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'Africa/Lagos' });
export const longDate = (iso: string) => at(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' });
export const shortDate = (iso = cfg.date) => {
  const [y, m, d] = iso.split('-');
  return `${d} · ${m} · ${y.slice(2)}`;
};
export const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' });

export const telHref = (p: string) => 'tel:' + p.replace(/[^+\d]/g, '');
export const waHref = (p: string) => 'https://wa.me/' + p.replace(/[^\d]/g, '');

export function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
