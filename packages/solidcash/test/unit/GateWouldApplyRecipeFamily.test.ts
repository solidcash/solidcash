import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  gateWouldApplyRepairsIfRecipe,
  getMaterializationMode,
  setMaterializationMode,
} from '../../src/message-bus/materialization-mode.js';

/**
 * unified would-apply recipe gate: resource / value / dyn would-apply recipe gates share one family helper so
 * refuse semantics cannot drift across converge surfaces.
 */
describe('unified would-apply recipe gate gateWouldApplyRepairsIfRecipe family', () => {
  const previous = getMaterializationMode();
  afterEach(() => setMaterializationMode(previous));

  it('family helper refuses would-apply counts under recipe and allows under devOracle', () => {
    setMaterializationMode('recipe');
    expect(gateWouldApplyRepairsIfRecipe(0)).toBe(0);
    expect(() => gateWouldApplyRepairsIfRecipe(1)).toThrow(/forbids/);

    setMaterializationMode('devOracle');
    expect(gateWouldApplyRepairsIfRecipe(3)).toBe(3);
  });

  it('resource/value/dyn domain gates funnel through gateWouldApplyRepairsIfRecipe', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const preflight = readFileSync(join(here, '../../src/message-bus/preflight.ts'), 'utf8');
    const value = readFileSync(join(here, '../../src/message-bus/computed-value-chunks.ts'), 'utf8');
    const dyn = readFileSync(join(here, '../../src/message-bus/computed-dynamic-chunks.ts'), 'utf8');

    expect(preflight).toContain('gateWouldApplyRepairsIfRecipe');
    expect(value).toContain('gateWouldApplyRepairsIfRecipe');
    expect(dyn).toContain('gateWouldApplyRepairsIfRecipe');

    // Domain wrappers must not call refuseVmExtractedRepairsIfRecipe directly.
    const stripComments = (src: string): string => src
      .split('\n')
      .filter((line) => {
        const t = line.trim();
        return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
      })
      .join('\n');
    expect(stripComments(preflight)).not.toMatch(
      /gateWouldApplyResourceRepairsIfRecipe[\s\S]*?refuseVmExtractedRepairsIfRecipe\(/,
    );
    expect(stripComments(value)).not.toMatch(
      /gateWouldApplyValueChunkRepairsIfRecipe[\s\S]*?refuseVmExtractedRepairsIfRecipe\(/,
    );
    expect(stripComments(dyn)).not.toMatch(
      /gateWouldApplyDynamicChunkRepairsIfRecipe[\s\S]*?refuseVmExtractedRepairsIfRecipe\(/,
    );
  });
});
