/**
 * Fence #9 residual negatives: multi-op / early-return chunkable mixed streams.
 *
 * Former untransported helper/loop mixes now admit (see KernelAdmission retargets);
 * residuals below remain KERNEL_LAYOUT until non-overlapping span descriptors exist.
 */
import { compileString } from '../../src/compiler.js';
import { describe, expect, it } from 'vitest';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
} as const;

describe('Fence #9 mixed-stream residuals', () => {
  it('keeps two pooled pushes outside the single-push capability behind KERNEL_LAYOUT', () => {
    const artifact = compileString(`contract C() {
      mapping(uint => bytes32[]) values;
      function mutate(uint key, bytes32 value) public {
        this.values[key].push(value);
        this.values[key].push(value);
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'mutate'))
      .toMatchObject({
        eligible: false,
        rejectionReason: 'KERNEL_LAYOUT',
        rejectionCode: 'MESSAGE_BUS_UNSUPPORTED_CONSTRUCT',
      });
  });

  it('keeps push+pop outside the pooled direct-push capability behind KERNEL_LAYOUT', () => {
    const artifact = compileString(`contract C() {
      mapping(uint => bytes32[]) values;
      function mutate(uint key, bytes32 value) public {
        this.values[key].push(value);
        this.values[key].pop();
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'mutate'))
      .toMatchObject({
        eligible: false,
        rejectionReason: 'KERNEL_LAYOUT',
        rejectionCode: 'MESSAGE_BUS_UNSUPPORTED_CONSTRUCT',
      });
  });

  it('keeps a conditional second push (multi-op chunkable) behind KERNEL_LAYOUT', () => {
    const artifact = compileString(`contract C() {
      mapping(uint => bytes32[]) values;
      function mutate(uint key, bytes32 value, bool twice) public {
        this.values[key].push(value);
        if (twice) this.values[key].push(value);
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'mutate'))
      .toMatchObject({
        eligible: false,
        rejectionReason: 'KERNEL_LAYOUT',
        rejectionCode: 'MESSAGE_BUS_UNSUPPORTED_CONSTRUCT',
      });
  });

  it('keeps early-return bypass of a chunkable write beside dynamic bytes behind KERNEL_LAYOUT', () => {
    const artifact = compileString(`contract C() {
      bytes note;
      mapping(uint => bytes) values;
      function set(uint key, bytes value, bytes n, bool skip) public {
        this.note = n;
        if (skip) return;
        this.values[key] = value;
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'set'))
      .toMatchObject({
        eligible: false,
        rejectionReason: 'KERNEL_LAYOUT',
        rejectionCode: 'MESSAGE_BUS_UNSUPPORTED_CONSTRUCT',
      });
  });

  it('admits independently indexed bytes beside an int mapping (admitted #9 subset)', () => {
    const artifact = compileString(`contract C() {
      bytes note;
      mapping(int => int) scores;
      function set(bytes n, int k, int v) public {
        note = n;
        scores[k] = v;
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'set'))
      .toMatchObject({ eligible: true });
  });

  it('admits an untransported-style chunkable helper beside a transported loop (former residual)', () => {
    const artifact = compileString(`contract C() {
      mapping(uint => bytes32[]) values;
      function appendFixed(uint key, bytes32 value) internal {
        this.values[key].push(value);
      }
      function mixedHelper(uint count, uint fixedKey, bytes32 value) public {
        for (uint i = 0; i < count; i = i + 1) {
          this.values[i].push(value);
        }
        appendFixed(fixedKey, value);
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'mixedHelper'))
      .toMatchObject({ eligible: true });
  });
});
