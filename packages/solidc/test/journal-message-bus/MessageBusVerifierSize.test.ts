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
      direct: 219,
      composed: 1196,
      frameworkTax: 977,
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

  it('reads public constants directly in a generated result route', () => {
    const artifact = compileString(`contract ConstantGetterRoute(int marker) {
      string public constant name = "LP Token";
      function set(int value) public { require(value >= marker); }
    }`, { forceStateful: true, messageBus: true, solidityImportCompat: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'name')?.eligible).toBe(true);
    expect(artifact.messageBus?.verifierProgram).toBeDefined();
  });
});
