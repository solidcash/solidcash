import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

/**
 * Kernel route admission for a handler whose emit sits inside a branch or a loop. These shapes cannot take the
 * top-level runtime effect stream (its records are planned one per top-level site), so a WIDE emit is refused by
 * name and a NARROW emit keeps its event window. This pins the exact boundary while the conditional/looped stream
 * remains deferred.
 */
const KERNEL = { forceStateful: true, messageBus: true, messageBusKernel: true } as const;

describe('kernel route conditional/looped emit admission boundary', () => {
  it('refuses a wide event emitted inside an if branch', () => {
    const artifact = compileString(`contract C() {
      event Wide(bytes32 a, bytes32 b, bytes32 c, bytes32 d, bytes32 e);
      int count;
      function fire(bytes32 a, bool take) public {
        if (take) emit Wide(a, a, a, a, a);
        require(true);
      }
    }`, KERNEL);
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'fire');
    expect(handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });

  it('keeps a window for a narrow event emitted inside an if branch', () => {
    const artifact = compileString(`contract C() {
      event Narrow(int value);
      int count;
      function fire(int value, bool take) public {
        if (take) emit Narrow(value);
        require(true);
      }
    }`, KERNEL);
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'fire');
    expect(handler).toMatchObject({ eligible: true });
    expect(handler?.emits).toBeDefined();
    expect(handler?.runtimeLoopEvents).toBeUndefined();
  });

  it('refuses a wide event emitted inside a loop', () => {
    const artifact = compileString(`contract C() {
      event Wide(bytes32 a, bytes32 b, bytes32 c, bytes32 d, bytes32 e);
      int count;
      function fire(bytes32 a, int n) public {
        for (int i = 0; i < n; i = i + 1) { emit Wide(a, a, a, a, a); }
        require(true);
      }
    }`, KERNEL);
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'fire');
    expect(handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });

  it('lowers a narrow event emitted inside a loop to a runtime counter-loop event', () => {
    const artifact = compileString(`contract C() {
      event Narrow(int value);
      int count;
      function fire(int n) public {
        for (int i = 0; i < n; i = i + 1) { emit Narrow(i); }
        require(true);
      }
    }`, KERNEL);
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'fire');
    expect(handler).toMatchObject({ eligible: true });
    expect(handler?.emits).toBeUndefined();
    expect(handler?.runtimeLoopEvents?.length).toBeGreaterThan(0);
  });
});
