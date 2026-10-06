import type { Activity, Guest } from '@/lib/types';

export type Stage = 'all' | 'new' | 'sent' | 'opened' | 'yes' | 'no' | 'in';

export const STAGES: { key: Stage; label: string }[] = [
  { key: 'all', label: 'All guests' },
  { key: 'new', label: 'Not sent' },
  { key: 'sent', label: 'Sent, not opened' },
  { key: 'opened', label: 'Opened, no reply' },
  { key: 'yes', label: 'Attending' },
  { key: 'no', label: 'Declined' },
  { key: 'in', label: 'Checked in' },
];

export const PILL: Record<Exclude<Stage, 'all'>, { label: string; className: string }> = {
  new: { label: 'Not sent', className: 'border-ivory-dim/40 text-ivory-dim' },
  sent: { label: 'Sent', className: 'border-gold/50 text-gold' },
  opened: { label: 'Opened', className: 'border-warn/60 text-warn' },
  yes: { label: 'Attending', className: 'border-ok/60 bg-ok/10 text-ok' },
  no: { label: 'Declined', className: 'border-bad/60 bg-bad/10 text-bad' },
  in: { label: 'Checked in', className: 'border-ok bg-ok text-navy' },
};

export function stageOf(g: Guest): Exclude<Stage, 'all'> {
  if (g.checkedInAt) return 'in';
  if (g.rsvp === 'yes') return 'yes';
  if (g.rsvp === 'no') return 'no';
  if (g.openedAt) return 'opened';
  if (g.sentAt) return 'sent';
  return 'new';
}

/** Nigerian local numbers (0803…) become international for WhatsApp links. */
export function waNumber(phone: string) {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.startsWith('0') && d.length === 11) d = '234' + d.slice(1);
  return d;
}

/** The link that opens WhatsApp / SMS / email with the invitation message ready to send. */
export function sendHref(g: Guest) {
  const text = encodeURIComponent(g.message);
  if (g.channel === 'email' && g.email) return `mailto:${g.email}?subject=${encodeURIComponent('Invitation · Sarah & Damilare')}&body=${text}`;
  if (g.channel === 'sms' && g.phone) return `sms:${g.phone}?&body=${text}`;
  if (!g.phone) return '';
  return `https://wa.me/${waNumber(g.phone)}?text=${text}`;
}

export const CHANNEL_LABEL = { whatsapp: 'WhatsApp', sms: 'SMS', email: 'Email', physical: 'Printed card' } as const;

export function activityText(a: Activity) {
  const t: Record<string, string> = {
    added: `${a.name} added`,
    removed: `${a.name} removed`,
    sent: `Invite sent to ${a.name}${a.extra ? ` (${a.extra})` : ''}`,
    opened: `${a.name} opened their invitation`,
    rsvp: `${a.name} ${a.extra === 'yes' ? 'is attending' : a.extra === 'no' ? 'can’t attend' : 'reset to awaiting reply'}`,
    checkin: `${a.name} arrived`,
    church: `${a.name} replied to the church RSVP (${a.extra})`,
  };
  return t[a.type] || a.type;
}
