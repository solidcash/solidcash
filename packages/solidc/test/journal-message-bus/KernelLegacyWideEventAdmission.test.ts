import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

/**
 * Legacy message-bus routes (`messageBusKernel: false`) have no runtime effect stream, so a wide event cannot
 * stream: the handler that emits it is refused and never admitted. A narrow event keeps the route's per-row event
 * window band (8 rows for the legacy convention). This pins the remaining legacy-route wide-event boundary.
 */
const LEGACY = { forceStateful: true, messageBus: true, messageBusKernel: false } as const;

describe('legacy route wide-event admission boundary', () => {
  it('does not admit a handler that emits a wide event on a legacy route', () => {
    const artifact = compileString(`contract C() {
      event Wide(bytes32 a, bytes32 b, bytes32 c, bytes32 d, bytes32 e);
      int count;
      function fire(bytes32 a) public {
        emit Wide(a, a, a, a, a);
        require(true);
      }
    }`, LEGACY);
    const admitted = (artifact.messageBus?.handlers ?? [])
      .filter((candidate) => candidate.eligible !== false);
    expect(admitted.find((candidate) => candidate.name === 'fire')).toBeUndefined();
  });

  it('keeps the per-row event band for a narrow event on a legacy route', () => {
    const artifact = compileString(`contract C() {
      event Narrow(int value);
      int count;
      function fire(int value) public {
        emit Narrow(value);
        require(true);
      }
    }`, LEGACY);
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'fire');
    expect(handler).toMatchObject({ eligible: true });
    expect(handler?.emits).toBeDefined();
    expect(handler?.runtimeLoopEvents).toBeUndefined();
    expect(artifact.messageBus?.route.blockLayout?.slots.filter((slot) => slot.kind === 'event').length)
      .toBeGreaterThan(0);
  });
});
