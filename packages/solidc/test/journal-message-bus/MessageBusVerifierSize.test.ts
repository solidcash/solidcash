import { asmToBytecode, messageBusVerifierCovenantBytecode } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

const bytes = (source: string, messageBus: boolean): number => asmToBytecode(compileString(source, {
  forceStateful: true,
  messageBus,
}).bytecode).length;

describe('atomic verifier bytecode specialization', () => {
  it('moves the global verifier out of the scalar master and keeps both covenants deployable', () => {
    const source = `contract ScalarVerifierSize(int minimum) {
      function set(int value) public { require(value >= minimum); }
    }`;
    const direct = bytes(source, false);
    const composed = bytes(source, true);
    const artifact = compileString(source, { forceStateful: true, messageBus: true });
    const verifierProgram = artifact.messageBus?.verifierProgram;
    expect(verifierProgram).toBeDefined();
    const sidecar = messageBusVerifierCovenantBytecode(verifierProgram!).length;
    // Moved 1094 -> 1105 (tax 974 -> 985) when MINIMUM_WINDOW_ELEMENTS rose 7 -> 12 to keep the C2
    // entry-write derivation readable; see the constant's note. The BOUNDS below are the actual
    // contract and both still hold with room - this pair is a tripwire on drift, not a limit.
    expect({ direct, composed, frameworkTax: composed - direct }).toEqual({
      direct: 120,
      composed: 1105,
      frameworkTax: 985,
    });
    expect(composed).toBeLessThanOrEqual(1200);
    expect(composed - direct).toBeLessThanOrEqual(1000);
    expect(sidecar).toBeLessThanOrEqual(10_000);
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
