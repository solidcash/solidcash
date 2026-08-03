import { asmToBytecode } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { compileString } from '../src/compiler.js';

const bytes = (source: string, hiddenBatch: boolean): number => asmToBytecode(compileString(source, {
  forceStateful: true,
  hiddenBatch,
}).bytecode).length;

describe('controllerless verifier bytecode specialization', () => {
  it('keeps the scalar SCB1 framework tax below 4.9 KB', () => {
    const source = `contract ScalarVerifierSize(int minimum) {
      function set(int value) public { require(value >= minimum); }
    }`;
    const direct = bytes(source, false);
    const composed = bytes(source, true);
    expect({ direct, composed, frameworkTax: composed - direct }).toEqual({
      direct: 219,
      composed: 5044,
      frameworkTax: 4825,
    });
    expect(composed - direct).toBeLessThanOrEqual(4900);
  });

  it('does not bake mapping, event, or value-effect validators into a pure returning sink', () => {
    const source = `contract ReturningVerifierSize(int marker) {
      function run(int value) public pure returns (int) { require(value >= 0); return value; }
    }`;
    const direct = bytes(source, false);
    const composed = bytes(source, true);
    expect(composed - direct).toBeLessThanOrEqual(5400);
  });
});
