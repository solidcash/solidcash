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
  it('routes unbounded chunk-packable T[] to a chunk-backed dynamic state var', () => {
    // fixed-width (flat-stream) AND simple variable-width leaf types (single-blob framed): int/string/bytes
    for (const t of ['uint256[]', 'bytes20[]', 'bool[]', 'bytes200[]', 'bigint[]', 'string[]', 'bytes[]']) {
      const a = compileString(src(`${t} a;`), { chunkedArrays: true });
      expect(isCollection(a, 'a')).toBe(false);
      const v = stateVar(a, 'a');
      expect(v?.type).toBe(t);
      expect(v?.dynamic).toBe(true); // uint32 A$len header + chunk UTXOs
    }
  });

  it('keeps bounded arrays on the collection model; struct elements are chunk-packed', () => {
    // uint256[5] is bounded -> collection. A struct element IS chunk-packable: fixed-width structs use the
    // flat-stream layout, variable-width structs (a string/bytes/bigint field) use the framed layout.
    const structSrc = (decl: string): string =>
      `pragma solidcash >=0.8.0; struct P { int x; string note; } contract C(){ ${decl} int counter; constructor(){}`
      + ' function f(){ require(this.counter >= 0); } }';
    for (const t of ['uint256[5]', 'int[5]']) {
      const a = compileString(src(`${t} a;`), { chunkedArrays: true });
      expect(isCollection(a, 'a')).toBe(true);
    }
    // variable-width struct array is now chunk-packed (dynamic), not a collection
    const sa = compileString(structSrc('P[] people;'), { chunkedArrays: true });
    expect(isCollection(sa, 'people')).toBe(false);
    expect(stateVar(sa, 'people')?.dynamic).toBe(true);
  });

  it('routes unbounded fixed-width T[] to chunk-packed by DEFAULT (flag now defaults on)', () => {
    const a = compileString(src('uint256[] a;'));
    expect(isCollection(a, 'a')).toBe(false);
    expect(stateVar(a, 'a')?.dynamic).toBe(true);
  });

  it('can be turned off explicitly: chunkedArrays:false keeps fixed-width T[] a collection', () => {
    const a = compileString(src('uint256[] a;'), { chunkedArrays: false });
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

  // Codegen step #13 (.length): count = A$len / elementWidth - read cheaply from the header (persisted) or
  // OP_SIZE(blob)/width (read-after-write), without reassembling the whole array.
  it('compiles .length on a chunk-packed array (persisted and read-after-write)', () => {
    expect(() => compileString(
      'pragma solidcash >=0.8.0; contract C(){ uint256[] a; function f(){ require(this.a.length == 3); } }',
      { chunkedArrays: true },
    )).not.toThrow();
    expect(() => compileString(
      'pragma solidcash >=0.8.0; contract C(){ bytes20[] a;'
      + ' function f(bytes20 x, pubkey pk, sig s){ require(checkSig(s, pk)); this.a = [x]; require(this.a.length == 1); } }',
      { chunkedArrays: true },
    )).not.toThrow();
  });

  // Codegen step #13 (whole-array read): reassemble the tight blob (read loop / on-stack value) and prepend
  // the count -> the on-stack array form, usable wherever an array value is. Round-trip proven by e2e at #15.
  it('compiles a whole-array read (persisted and read-after-write)', () => {
    expect(() => compileString(
      'pragma solidcash >=0.8.0; contract C(){ bytes20[] a; bytes20[] packed b;'
      + ' function f(){ this.b = this.a; } }',
      { chunkedArrays: true },
    )).not.toThrow();
    expect(() => compileString(
      'pragma solidcash >=0.8.0; contract C(){ bytes20[] a; bytes20[] packed b;'
      + ' function f(bytes20 x, pubkey pk, sig s){ require(checkSig(s, pk)); this.a = [x]; this.b = this.a; } }',
      { chunkedArrays: true },
    )).not.toThrow();
  });
});

// Phase-1 coexistence limits (docs/dynamic-storage.md). Lifting these is the phase-2 shared-trailing-counter
// work; until then a function may touch dynamic storage in only limited ways, enforced as clean compile errors.
describe('dynamic-storage phase-1 coexistence guards', () => {
  // W5: two DISTINCT written dynamic vars both emit chunk outputs at the fixed blockSize+i offset while the
  // SDK places the second at an accumulated offset -> runtime collision. Guard until phase-2 lands.
  it('rejects writing two distinct dynamic vars in one function (W5)', () => {
    expect(() => compileString(
      'pragma solidcash >=0.8.0; contract C(){ string a; string b;'
      + ' function f(string x, string y, pubkey pk, sig s){ require(checkSig(s, pk)); this.a = x; this.b = y; } }',
    )).toThrow(/more than one dynamic-storage var/);
  });
});
