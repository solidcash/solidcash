/**
 * A7 on a message-bus compile. A constructor calls only a direct master: the SDK lays a callee's spend out through the
 * arm it calls, never through a route. So a compile that builds the message-bus route takes no genesis call and is
 * never record-sound: `messageBus: true` with the kernel or without, and each bus rung that automatic selection tries
 * for a contract with an external call. That holds also where the route admits no handler and the master keeps no
 * route arm, so whether a contract can answer a constructor does not depend on what its route admits. The code of
 * such a compile is the code `genesisCalls: false` gives; the same source compiled direct is record-sound.
 *
 * Before, a bus compile whose route admitted nothing gave its record-publishing entries the genesis call. A public
 * function that calls itself then forwarded that parameter from an internal body that does not hold it, every rung
 * threw `forwarded-witness-not-carried-by-caller`, and the compile fell back to the direct convention.
 */
import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

type Artifact = ReturnType<typeof compileString>;

const KERNEL = {
  forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000,
} as const;

const genesisEntries = (artifact: Artifact): string[] => artifact.abi
  .filter((fn) => fn.inputs.some((input) => input.name === '__internal__genesisCall')).map((fn) => fn.name);

const handlers = (artifact: Artifact): unknown[] => (artifact.messageBus?.handlers ?? [])
  .map((handler) => [handler.name, handler.eligible, handler.rejectionReason]);

// A record master whose public `walk` calls itself. The kernel fences the recursion, so the route admits nothing.
const WALK = `contract C() {
  mapping(int => int) values;
  function walk(int cursor) public returns (int) {
    if (cursor == 0) return 0;
    int result = walk(cursor / 2);
    this.values[cursor] = result;
    return result;
  }
}`;

// The same recursion behind an entry that makes an external call, which keeps automatic selection on the bus.
const PING_WALK = `interface ISink { function note(int v) external; }
contract C(ISink sink) {
  mapping(int => int) values;
  function walk(int cursor) public returns (int) {
    if (cursor == 0) return 0;
    int result = walk(cursor / 2);
    this.values[cursor] = result;
    return result;
  }
  function ping(int cursor) public returns (int) {
    sink.note(cursor);
    return walk(cursor);
  }
}`;

describe('a message-bus compile takes no genesis call', () => {
  it('keeps a recursive record master on the kernel bus, with the code genesisCalls: false gives', () => {
    const artifact = compileString(WALK, KERNEL);
    expect(artifact.messageBus).toMatchObject({ convention: 'kernel-row-loop', routeInBytecode: false });
    expect(handlers(artifact)).toEqual([['walk', false, 'KERNEL_LAYOUT']]);
    expect(artifact.recordSound).toBe(false);
    expect(genesisEntries(artifact)).toEqual([]);
    expect(artifact.bytecode).toBe(compileString(WALK, { ...KERNEL, genesisCalls: false }).bytecode);
  });

  it('keeps automatic selection on the bus, as at 07552ad33, and the direct build record-sound', () => {
    const artifact = compileString(PING_WALK, { suppressWarnings: true });
    expect(artifact.messageBus).toMatchObject({ routeInBytecode: false, available: false });
    expect(handlers(artifact)).toEqual([['walk', false, 'KERNEL_LAYOUT'], ['ping', false, 'KERNEL_LAYOUT']]);
    expect(artifact.recordSound).toBe(false);
    expect(genesisEntries(artifact)).toEqual([]);
    expect(artifact.bytecode).toBe(compileString(PING_WALK, { suppressWarnings: true, genesisCalls: false }).bytecode);
    const direct = compileString(PING_WALK, { suppressWarnings: true, messageBus: false });
    expect(direct.messageBus).toBeUndefined();
    expect(direct.recordSound).toBe(true);
    expect(genesisEntries(direct)).toEqual(['walk', 'ping']);
  });

  it('gives a route the code genesisCalls: false gives', () => {
    const source = `contract C() {
      int count;
      function bump(int by) public returns (int) { this.count = this.count + by; return this.count; }
    }`;
    const artifact = compileString(source, { suppressWarnings: true, messageBus: true });
    expect(artifact.messageBus).toMatchObject({ routeInBytecode: true, available: true });
    expect(artifact.recordSound).toBe(false);
    expect(genesisEntries(artifact)).toEqual([]);
    expect(artifact.bytecode)
      .toBe(compileString(source, { suppressWarnings: true, messageBus: true, genesisCalls: false }).bytecode);
  });
});
