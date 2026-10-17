import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

/**
 * Kernel route admission for a handler whose emit sits in a PRIVATE helper it calls. Private helpers are inlined
 * into the handler body before admission, so a top-level-called helper emit streams exactly like an own top-level
 * emit: wide payloads chunk, narrow payloads stay compact.
 */
const KERNEL = { forceStateful: true, messageBus: true, messageBusKernel: true } as const;

describe('kernel route helper-emit admission', () => {
  it('streams a wide event emitted only in a top-level-called private helper, chunked', () => {
    const artifact = compileString(`contract C() {
      event Wide(bytes32 a, bytes32 b, bytes32 c, bytes32 d, bytes32 e);
      int count;
      function doEmit(bytes32 a) private {
        this.count = this.count + 1;
        emit Wide(a, a, a, a, a);
      }
      function fire(bytes32 a) public {
        doEmit(a);
        require(true);
      }
    }`, KERNEL);
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'fire');
    expect(handler).toMatchObject({ eligible: true });
    expect(handler?.emits).toBeUndefined();
    expect(handler?.runtimeLoopEvents).toEqual([
      { repeatCount: 1, eventSignatures: [artifact.events![0]!.signature], stream: true, chunked: true },
    ]);
  });

  it('streams a narrow event emitted only in a top-level-called private helper, compact', () => {
    const artifact = compileString(`contract C() {
      event Narrow(int value);
      int count;
      function doEmit(int value) private {
        this.count = this.count + value;
        emit Narrow(value);
      }
      function fire(int value) public {
        doEmit(value);
        require(true);
      }
    }`, KERNEL);
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'fire');
    expect(handler).toMatchObject({ eligible: true });
    expect(handler?.emits).toBeUndefined();
    expect(handler?.runtimeLoopEvents).toEqual([
      { repeatCount: 1, eventSignatures: [artifact.events![0]!.signature], stream: true },
    ]);
    expect((handler?.runtimeLoopEvents as { chunked?: true }[])[0].chunked).toBeUndefined();
  });

  it('refuses a wide event emitted through a conditionally-called helper (emit lands in a branch)', () => {
    const artifact = compileString(`contract C() {
      event Wide(bytes32 a, bytes32 b, bytes32 c, bytes32 d, bytes32 e);
      int count;
      function doEmit(bytes32 a) private {
        this.count = this.count + 1;
        emit Wide(a, a, a, a, a);
      }
      function fire(bytes32 a, bool take) public {
        if (take) doEmit(a);
        require(true);
      }
    }`, KERNEL);
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'fire');
    expect(handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });

  it('keeps a window for a narrow event emitted through a conditionally-called helper', () => {
    const artifact = compileString(`contract C() {
      event Narrow(int value);
      int count;
      function doEmit(int value) private {
        this.count = this.count + value;
        emit Narrow(value);
      }
      function fire(int value, bool take) public {
        if (take) doEmit(value);
        require(true);
      }
    }`, KERNEL);
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'fire');
    expect(handler).toMatchObject({ eligible: true });
    expect(handler?.emits).toBeDefined();
    expect(handler?.runtimeLoopEvents).toBeUndefined();
  });
});
