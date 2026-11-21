import { describe, expect, it } from 'vitest';
import { needsNudge, nudgeMessage, sendHref, stageOf, waNumber } from '@/components/staff/admin/model';
import type { Guest } from '@/lib/types';

const guest = (p: Partial<Guest> = {}): Guest => ({
  id: '1',
  code: 'ABC234',
  name: 'Tope',
  phone: '0803 123 4567',
  email: '',
  side: 'both',
  group: '',
  events: ['church', 'trad'],
  driverCard: false,
  channel: 'whatsapp',
  table: '',
  notes: '',
  cardDelivered: false,
  sentAt: null,
  openedAt: null,
  openCount: 0,
  rsvp: 'pending',
  rsvpAt: null,
  rsvpNote: '',
  checkedInAt: null,
  createdAt: '',
  link: 'https://x/i/ABC234',
  message: 'Dear Tope',
  ...p,
});

describe('invitation desk', () => {
  it('turns Nigerian local numbers into WhatsApp numbers', () => {
    expect(waNumber('0803 123 4567')).toBe('2348031234567');
    expect(waNumber('+234 803 123 4567')).toBe('2348031234567');
  });
  it('builds the send link for each channel', () => {
    expect(sendHref(guest())).toBe('https://wa.me/2348031234567?text=Dear%20Tope');
    expect(sendHref(guest({ channel: 'email', email: 'a@b.c' }))).toMatch(/^mailto:a@b\.c\?subject=/);
    expect(sendHref(guest({ phone: '' }))).toBe('');
  });
  it('puts each guest in the furthest stage they reached', () => {
    expect(stageOf(guest())).toBe('new');
    expect(stageOf(guest({ sentAt: 'x' }))).toBe('sent');
    expect(stageOf(guest({ sentAt: 'x', openedAt: 'x' }))).toBe('opened');
    expect(stageOf(guest({ rsvp: 'no' }))).toBe('no');
    expect(stageOf(guest({ rsvp: 'yes', checkedInAt: 'x' }))).toBe('in');
  });
});

describe('RSVP reminders', () => {
  const sent = { sentAt: '2026-11-01T10:00:00Z', link: 'https://oluwabioye.dabioye.com/i/ABC234' };
  it('go to reception guests who were sent their invitation and haven’t replied', () => {
    expect(needsNudge(guest(sent))).toBe(true);
    expect(needsNudge(guest({ ...sent, rsvp: 'yes' }))).toBe(false);
    expect(needsNudge(guest({ ...sent, rsvp: 'no' }))).toBe(false);
    expect(needsNudge(guest())).toBe(false); // not sent yet
    expect(needsNudge(guest({ ...sent, events: ['church'] }))).toBe(false); // church guests reply on the website
    expect(needsNudge(guest({ ...sent, phone: '' }))).toBe(false);
    expect(needsNudge(guest({ cardDelivered: true }))).toBe(true); // a printed card counts as sent
  });
  it('ask for a reply by the RSVP date, or as soon as they can once it has passed', () => {
    const before = nudgeMessage(guest(sent), '2026-11-21');
    expect(before).toMatch(/^Dear Tope,/);
    expect(before).toContain('Kindly RSVP by Monday, 30 November 2026');
    expect(before).toContain('https://oluwabioye.dabioye.com/i/ABC234');
    expect(nudgeMessage(guest(sent), '2026-12-02')).toContain('Kindly RSVP as soon as you can');
  });
});
