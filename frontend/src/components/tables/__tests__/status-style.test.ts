import { describe, expect, it } from 'vitest';
import { dotClass, tileClass } from '@/components/tables/status-style';

describe('tileClass / dotClass', () => {
  it('gives a distinct class for each table status', () => {
    const statuses = ['free', 'occupied', 'reserved', 'cleaning'] as const;
    const tiles = statuses.map(tileClass);
    const dots = statuses.map(dotClass);

    expect(new Set(tiles).size).toBe(statuses.length);
    expect(new Set(dots).size).toBe(statuses.length);
  });

  it('free is emerald-toned, occupied is amber-toned', () => {
    expect(tileClass('free')).toContain('emerald');
    expect(dotClass('free')).toContain('emerald');
    expect(tileClass('occupied')).toContain('amber');
    expect(dotClass('occupied')).toContain('amber');
  });
});
