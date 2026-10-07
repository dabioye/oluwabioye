import { describe, expect, it } from 'vitest';
import { codeFromPath, codeFromText, normalizeCode } from '@/lib/code';

describe('invitation codes', () => {
  it('is forgiving about case, spaces and dashes', () => {
    expect(normalizeCode(' ab3-xy7 ')).toBe('AB3XY7');
  });
  it('drops look-alike characters that codes never use', () => {
    expect(normalizeCode('O0I1L2')).toBe('2');
  });
  it('stops at six characters', () => {
    expect(normalizeCode('ABCDEFGH')).toBe('ABCDEF');
  });
  it('pulls the code out of a pasted link', () => {
    expect(codeFromText('https://oluwabioye.dabioye.com/i/kx7p2m?x=1')).toBe('KX7P2M');
    expect(codeFromText('Your code: KX7 P2M')).toBe('KX7P2M');
  });
  it('reads the code from /i/ and /c/ addresses', () => {
    expect(codeFromPath('/i/KX7P2M')).toBe('KX7P2M');
    expect(codeFromPath('/c/kx7p2m/')).toBe('KX7P2M');
    expect(codeFromPath('/admin')).toBe('');
  });
});
