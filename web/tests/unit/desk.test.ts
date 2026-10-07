import { describe, expect, it } from 'vitest';
import { sendHref, stageOf, waNumber } from '@/components/staff/admin/model';
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
