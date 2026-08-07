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
    expect({ direct, composed, frameworkTax: composed - direct }).toEqual({
      direct: 176,
      composed: 1150,
      frameworkTax: 974,
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
