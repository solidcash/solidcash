import { describe, it, expect } from 'vitest';
import { compileString } from '../src/index.js';

// Phase-2 chunk-packed arrays (docs/arrays.md). Behind the `chunkedArrays` compiler flag (default off)
// until the codegen/SDK land. This covers the layout/desugar step: an unbounded fixed-width `T[]` becomes
// a dense chunk-backed dynamic state variable; everything else keeps the existing collection model.
const src = (decl: string): string =>
  `pragma solidcash >=0.8.0; contract C(){ ${decl} int counter; constructor(){} function f(){ require(this.counter >= 0); } }`;

const isCollection = (a: ReturnType<typeof compileString>, name: string): boolean =>
  (a.stateLayout?.collections ?? []).some((c) => c.name === name);
const stateVar = (a: ReturnType<typeof compileString>, name: string): { type: string; dynamic?: boolean } | undefined =>
  (a.stateLayout?.variables ?? []).find((v) => v.name === name);

describe('chunk-packed arrays: layout/desugar (chunkedArrays flag)', () => {
  it('routes unbounded fixed-width T[] to a chunk-backed dynamic state var when the flag is on', () => {
    for (const t of ['uint256[]', 'bytes20[]', 'bool[]', 'bytes200[]']) {
      const a = compileString(src(`${t} a;`), { chunkedArrays: true });
      expect(isCollection(a, 'a')).toBe(false);
      const v = stateVar(a, 'a');
      expect(v?.type).toBe(t);
      expect(v?.dynamic).toBe(true); // uint32 A$len header + chunk UTXOs
    }
  });

  it('keeps variable-width / bounded arrays on the collection model even with the flag on', () => {
    // plain int is variable-width; string[] is variable-width; uint256[5] is bounded
    for (const t of ['int[]', 'string[]', 'uint256[5]']) {
      const a = compileString(src(`${t} a;`), { chunkedArrays: true });
      expect(isCollection(a, 'a')).toBe(true);
    }
  });

  it('is a no-op when the flag is off (default): fixed-width T[] stays a collection', () => {
    const a = compileString(src('uint256[] a;'));
    expect(isCollection(a, 'a')).toBe(true);
    expect(stateVar(a, 'a')).toBeUndefined();
  });

  // Codegen step #13 (write): `this.a = [..]` stores only the tight element blob in chunks (the count
  // prefix is stripped; count = A$len/width). Compiles + stack-balances through the shipped dynamic write
  // loop. Round-trip is covered by e2e once the SDK store/read (#15) lands.
  it('compiles a whole-array write through the dynamic chunk write loop', () => {
    expect(() => compileString(
      'pragma solidcash >=0.8.0; contract C(){ bytes20[] a;'
      + ' function f(bytes20 x, bytes20 y, pubkey pk, sig s){ require(checkSig(s, pk)); this.a = [x, y]; } }',
      { chunkedArrays: true },
    )).not.toThrow();
    expect(() => compileString(
      'pragma solidcash >=0.8.0; contract C(){ bool[] a;'
      + ' function f(pubkey pk, sig s){ require(checkSig(s, pk)); this.a = [true, false, true]; } }',
      { chunkedArrays: true },
    )).not.toThrow();
  });
});
