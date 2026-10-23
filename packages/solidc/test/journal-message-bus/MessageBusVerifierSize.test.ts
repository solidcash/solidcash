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
    // listed the slots they act on in one classifying pass per side: direct +46 B, composed +104 B. Again after the
    // atomic bus stage 2 (no PUSHDATA4 carrier arm under a 10,000 B blob bound, shared stack helpers): composed -56 B.
    // composed -25 B after the trailing batch-width binding moved the width witness out of the scalar verifier.
    // +16 B in both conventions after the direct entry's message-bus-eligibility census widened.
    // +10 B direct / +5 B composed after the October reaudit/hardening set; re-pinned to the current emission.
    // composed -154 B after the route dropped its redundant positional batch self-check (the caller-side blob
    // covenant and the verifier binding digest still authenticate the frame).
    // direct -7 B, composed -27 B once the token container covenant lost its merge path (efba0f1ef) and the keep
    // of an unnamed container refused a minting NFT (306318a0b). The master pin's destroy arm (3fc5969bd) added
    // +44 / +46 B until 3ca6b0a42 kept it to contracts that can selfdestruct.
    // +35 B direct / +97 B composed for the C3 record pin: the own-category count holds each record at its own
    // index, and the route pins its records past the block, skipping its verifier by the bound index.
    // +8 B composed once the route binds its participant's physical size and claims only that block.
    expect({ direct, composed, frameworkTax: composed - direct }).toEqual({
      direct: 657,
      composed: 1805,
      frameworkTax: 1148,
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
