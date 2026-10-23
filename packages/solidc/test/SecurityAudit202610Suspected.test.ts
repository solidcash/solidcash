/**
 * Shipped-path decisions for the October 2026 suspected rows.
 * A passing test is the observation that the named attack does not occur.
 */
import { describe, expect, it } from 'vitest';
import { asmToScript, scriptToBytecode, type Script } from '@solidcash/utils';
import { compileString } from '../src/index.js';

const P = 'pragma solidcash ^0.14.0;';

/** Byte offset of each top-level script element. */
function elementStarts(script: Script): number[] {
  const starts: number[] = [];
  let offset = 0;
  for (const element of script) {
    starts.push(offset);
    offset += scriptToBytecode([element]).length;
  }
  return starts;
}

function categoryElement(source: string, options: { sortedMappings?: string[] } = {}): {
  element: Uint8Array | number; patterns: number;
} {
  const artifact = compileString(source, { composition: 'framed', ...options });
  const offset = artifact.composition?.placeholders.categoryOffset;
  if (offset === undefined) throw new Error('framed master published no category slot');
  const script = asmToScript(artifact.bytecode);
  const bytes = scriptToBytecode(script);
  const needle = new Uint8Array(33);
  needle[0] = 32;
  let patterns = 0;
  for (let index = 0; index + needle.length <= bytes.length; index += 1) {
    if (bytes.subarray(index, index + needle.length).every((byte, at) => byte === needle[at])) patterns += 1;
  }
  const starts = elementStarts(script);
  const index = starts.indexOf(offset);
  if (index < 0) {
    throw new Error(`category offset ${offset} is not a top-level push (${patterns} zero patterns)`);
  }
  return { element: script[index], patterns };
}

describe('OPT-1 framed placeholder pooling', () => {
  it('keeps the category slot a top-level 32-byte push beside a sorted-mapping head check', () => {
    const source = `${P} contract C { enumerable mapping(bytes32 => int) totals;`
      + ' function spend() { int s = 0; for (int v of this.totals) { s = s + v; } require(s >= 0); } }';
    const slot = categoryElement(source, { sortedMappings: ['totals'] });
    expect(slot.patterns).toBeGreaterThan(1);
    expect(slot.element).toEqual(new Uint8Array(32));
  });

  it('keeps the category slot a top-level 32-byte push beside bytes32(0)', () => {
    const source = `${P} contract C { function spend(bytes32 k) {`
      + ' require(k == bytes32(0)); require(k == bytes32(0)); } }';
    const slot = categoryElement(source);
    expect(slot.patterns).toBeGreaterThan(1);
    expect(slot.element).toEqual(new Uint8Array(32));
  });
});
