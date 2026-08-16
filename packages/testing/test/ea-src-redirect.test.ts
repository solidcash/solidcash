import { describe, expect, it } from 'vitest';
import { redirectEffectiveAccelerationSrc } from '../../../vitest.marketplace.config.ts';

describe('marketplace EA src redirect', () => {
  it('rewrites the Ethereum symlink src onto the BCH-aware copy', () => {
    const redirected = redirectEffectiveAccelerationSrc(
      '/Code/effectiveacceleration.ai/contract/src/utils/decodeEvents.ts',
    );
    expect(redirected?.replace(/\\/g, '/')).toMatch(/examples\/effectiveacceleration\/src\/utils\/decodeEvents\.ts$/);
  });

  it('rewrites relative marketplace project src paths', () => {
    const redirected = redirectEffectiveAccelerationSrc(
      '/Code/cashscript/.worktrees/effectiveacceleration-marketplace/.marketplace/project/src/utils/ui.ts',
    );
    expect(redirected?.replace(/\\/g, '/')).toMatch(/examples\/effectiveacceleration\/src\/utils\/ui\.ts$/);
  });

  it('leaves unrelated paths alone', () => {
    expect(redirectEffectiveAccelerationSrc('/tmp/other/src/utils/ui.ts')).toBeUndefined();
  });
});
