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
    // The integrated route also carries authenticated logical-caller and local effect-frame support. Those
    // facilities produce the default kernel participant below; the exact pair remains a drift tripwire,
    // while the bounds retain deliberate headroom below BCH's deployment limit. Re-pinned after the October
    // hardening (feat/parity and the reaudit, whose stateful entries now also sum their satoshi container and
    // scan for foreign containers): +357 B in both conventions, and the bus tax grew 39 B. Again when those scans
    // listed the slots they act on in one classifying pass per side: direct +46 B, composed +104 B.
    expect({ direct, composed, frameworkTax: composed - direct }).toEqual({
      direct: 543,
      composed: 1881,
      frameworkTax: 1338,
    });
    expect(composed).toBeLessThanOrEqual(1900);
    expect(composed - direct).toBeLessThanOrEqual(1360);
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

  it('keeps a graph verifier frame independent from sibling compute side-cars', () => {
    const artifact = compileString(`contract GraphVerifierCompute {
      bytes32 digest;
      function set(bytes payload) public {
        this.digest = keccak256(payload);
        require(payload.length > 0);
      }
    }`, {
      forceStateful: true,
      messageBus: true,
      messageBusGraphContext: true,
      maximumInputBytes: 1_000_000,
      optimizeForCompilationSpeed: true,
    });
    expect(artifact.messageBus?.verifierProgram?.inputs.map((input) => input.name)).toEqual([
      'activeInputIndex',
      'expectedLocalRows',
      'localBatch',
      'suppliedFixedSize',
      'suppliedBlockSize',
      'suppliedEmissions',
      'suppliedCallers',
      'suppliedSettlementBoundary',
      'suppliedCompletionPositions',
      'suppliedSettlementTable',
    ]);
    // A participant with no typed child-deployment site rejects active kind-5 rows directly. It must not carry
    // the general deployment descriptor/materialization verifier, which is over a kilobyte after codegen.
    expect(messageBusVerifierCovenantBytecode(artifact.messageBus!.verifierProgram!, 1_000_000).length)
      .toBeLessThanOrEqual(7_500);
  });
});
