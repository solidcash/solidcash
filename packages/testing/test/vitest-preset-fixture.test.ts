import { describe, expect, it } from 'vitest';
import { solidcashHardhatPreset } from '../src/vitest-preset.js';

describe('solidcashHardhatPreset snapshot fixtures', () => {
  it('serializes selectors while preserving test environment values', () => {
    const config = solidcashHardhatPreset({
      solidcash: { snapshotBeforeEach: ['**/large.test.ts', '**/integration/*.test.ts'] },
      test: { env: { EXISTING: 'preserved' } },
    });
    expect(config.solidcash).toBeUndefined();
    expect(config.test?.env).toEqual({
      EXISTING: 'preserved',
      SOLIDCASH_SNAPSHOT_BEFORE_EACH: JSON.stringify(['**/large.test.ts', '**/integration/*.test.ts']),
    });
  });
});
