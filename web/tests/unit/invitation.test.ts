import { describe, expect, it } from 'vitest';
import { nameLayout } from '@/lib/invitation';

const slot = { top: 23.3, maxSize: 7.6 };

describe('guest name on the invitation card', () => {
  it('keeps short names on one line at full size', () => {
    const n = nameLayout('Tope Omidiji', slot, 'Pinyon Script');
    expect(n.lines).toEqual(['Tope Omidiji']);
    expect(n.size).toBe(7.6);
    expect(n.top).toBe(23.3);
  });
  it('splits long names into two balanced lines and shrinks them', () => {
    const n = nameLayout('Adaeze Okonkwo-Bamidele Williams', slot, 'Pinyon Script');
    expect(n.lines).toEqual(['Adaeze Okonkwo-Bamidele', 'Williams']);
    expect(n.size).toBeLessThanOrEqual(slot.maxSize * 0.55);
  });
  it('shrinks a long single word instead of overflowing', () => {
    expect(nameLayout('Oluwafunmilayoadebimpe', slot, 'Pinyon Script').size).toBeLessThan(slot.maxSize);
  });
  it('uses Cookie by default, sized up to fill the same space as Pinyon Script', () => {
    const n = nameLayout('Tope Omidiji', slot);
    expect(n.family).toBe('Cookie');
    expect(n.size).toBeCloseTo(7.6 * 1.15);
  });
});
