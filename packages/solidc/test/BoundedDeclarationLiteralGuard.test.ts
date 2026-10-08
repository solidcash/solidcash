import { describe, expect, it } from 'vitest';
import type { Artifact } from '@solidcash/utils';
import { compileString } from '../src/index.js';

/**
 * A bounded integer declaration initialized from a bare integer literal must not emit a runtime range guard.
 * The type checker already rejects an out-of-range literal against the declared type (the only place it does
 * so), so a guard on the resulting store can only ever pass and merely bloats the emitted code; the
 * compiler-generated message-bus route declares its row temporaries as `int256 x = 0` and paid that cost at
 * every row. A declaration initialized from a computed expression still needs the guard: `uint8 x = 200 + 100`
 * keeps the generic `int` type and can carry an out-of-range value.
 */

const P = 'pragma solidcash ^0.13.0;';
const declaration = (source: string): Artifact =>
  compileString(`${P} contract C { function f() public { ${source} require(true); } }`, { messageBus: false });

describe('a bounded declaration from a bare integer literal', () => {
  it('emits exactly the uninitialized declaration, with no runtime range guard', () => {
    // The literal carries the same zero the uninitialized form stores, so the only difference a guard could
    // introduce is extra ops; the bytecode must stay identical.
    expect(declaration('int256 x = 0;').bytecode).toBe(declaration('int256 x;').bytecode);
    expect(declaration('uint8 y = 0;').bytecode).toBe(declaration('uint8 y;').bytecode);
  });
});

describe('a bounded declaration from a computed expression', () => {
  it('keeps the runtime range guard that a bare literal does not need', () => {
    // Same declared type and no other difference from the uninitialized form except the computed initializer.
    expect(declaration('uint8 y = 200 + 100;').bytecode.length)
      .toBeGreaterThan(declaration('uint8 y;').bytecode.length);
  });
});
