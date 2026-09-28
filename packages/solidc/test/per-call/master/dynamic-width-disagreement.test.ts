import { describe, expect, it } from 'vitest';
import { compileStringMulti } from '../../../src/compiler.js';
import { publishedRefusals } from './refused-entry.js';

/**
 * A per-call master whose dynamic-value bodies place the chunk run at different layout widths.
 *
 * The head parks the frame's record block base once, and each body adds its own layout width to reach the run, so
 * bodies whose layouts differ share the one parked base rather than refusing each other by name. The two bodies
 * here differ by the mapping read one of them makes: that read reserves a block coordinate the other does not, so
 * `blockInputSize` differs between them.
 */

const SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Cache {'
  + '   string public name;'
  + '   mapping(bytes20 => int) public seen;'
  + '   function writeName() { this.name = "hi"; require(true); }'
  + '   function readThenWriteName(bytes20 key) {'
  + '     int prior = this.seen[key];'
  + '     this.name = string.concat(this.name, "!");'
  + '     require(prior >= 0);'
  + '   }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'per-call' });
const artifact = artifacts.Cache!;

describe('a per-call master whose dynamic-value bodies disagree on the chunk run width', () => {
  it('serves every body rather than refusing the widths that differ', () => {
    expect(publishedRefusals({ Cache: artifact as unknown as { composition?: unknown } })).toStrictEqual([]);
    expect(artifact.composition?.convention).toBe('per-call');
  });

  it('keeps both entries in the ABI and the dispatcher', () => {
    expect(artifact.abi.map((entry) => entry.name).sort()).toStrictEqual(['readThenWriteName', 'writeName']);
  });
});
