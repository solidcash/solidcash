import { binToHex } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { layer3 } from '../src/index.js';

const SOURCE = `pragma solidcash >=0.8.0;
contract Layer3HiddenBatch() {
  int counter;
  function add(int n) public { this.counter = this.counter + n; require(n >= 0); }
  function clear() public { this.counter = 0; require(true); }
}`;

const RETURN_SOURCE = `pragma solidcash >=0.8.0;
contract Layer3ReturningBatch() {
  function twice(int n) public pure returns (int) { return n * 2; }
  function plusOne(int n) public pure returns (int) { return n + 1; }
}`;

const artifact = compileString(SOURCE, {
  forceStateful: true,
  experimentalHiddenBatch: true,
});

describe('layer3.encodeHiddenBatch', () => {
  it('encodes real compiler handlers in canonical execution order', () => {
    const encoded = layer3.encodeHiddenBatch(artifact, [
      { function: 'add', args: [2n] },
      { function: 'clear' },
    ]);
    const add = artifact.hiddenBatch!.handlers.find((handler) => handler.name === 'add')!;
    const clear = artifact.hiddenBatch!.handlers.find((handler) => handler.name === 'clear')!;
    const hex = binToHex(encoded.blob);

    expect(encoded.rowCount).toBe(2);
    expect(encoded.routeWitnesses).toEqual([]);
    expect(encoded.results).toEqual([]);
    expect(hex.startsWith(`53434231010002${add.selector}000000000000`)).toBe(true);
    expect(hex).toContain(`${clear.selector}0100000000000000`);
  });

  it('carries the compiler-authored result schema for authenticated return-event decoding', () => {
    const returning = compileString(RETURN_SOURCE, {
      forceStateful: true,
      experimentalHiddenBatch: true,
    });
    const encoded = layer3.encodeHiddenBatch(returning, [
      { function: 'twice', args: [3n] },
      { function: 'plusOne', args: [8n] },
    ]);
    expect(encoded.results).toEqual([
      { row: 0, types: ['int256'] },
      { row: 1, types: ['int256'] },
    ]);
    expect(returning.hiddenBatch!.route.outputs).toEqual([{ type: 'bytes' }]);
  });

  it('rejects non-advertised, ineligible, and malformed invocation plans', () => {
    expect(() => layer3.encodeHiddenBatch(
      compileString('pragma solidcash >=0.8.0; contract Plain() { function f() { require(true); } }'),
      [{ function: 'f' }],
    )).toThrow(/does not advertise/);
    expect(() => layer3.encodeHiddenBatch(artifact, [])).toThrow(/row count/);
    expect(() => layer3.encodeHiddenBatch(artifact, [{ function: 'missing' }])).toThrow(/Unknown/);
    expect(() => layer3.encodeHiddenBatch(artifact, [{ function: 'add' }])).toThrow(/number of arguments/);
  });
});
