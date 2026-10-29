import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/readNight.js';

describe('readNight', () => {
  it('reads 2026-10-28 as 5 jobs and 1 bad line', () => {
    const { rows, badLines } = readNight('runs', '2026-10-28');
    expect(badLines).toBe(1);
    expect(rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(rows).toHaveLength(5);
  });
});
