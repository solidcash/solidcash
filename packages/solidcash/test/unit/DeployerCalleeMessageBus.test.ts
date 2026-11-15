/**
 * A7 and A14 item 5: a constructor calls only a direct contract. A callee compiled for the message bus is never
 * record-sound, also where its route admits no handler, and the SDK refuses it before building anything, naming the
 * option in the way.
 */
import { describe, expect, it } from 'vitest';
import { compileString } from '@solidcash/solidc';
import { DeployerCalleeError, assertDeployerCallee } from '../../src/stateful/deployer.js';

const P = 'pragma solidcash ^0.50.0;';

// A route admits `f`.
const ROUTED = `${P} contract T { int calls;
  function f(int x) external returns (bool) { calls = calls + x; return true; } }`;

// The kernel fences the recursion, so the route admits neither entry and the master keeps no route arm.
const UNROUTED = `${P} interface ISink { function note(int v) external; }
contract T(ISink sink) {
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

describe('a constructor callee compiled for the message bus', () => {
  it.each([
    ['a route that admits the function', ROUTED, 'f', true],
    ['a route that admits nothing', UNROUTED, 'ping', false],
  ] as const)('is refused before building, naming messageBus: false, with %s', (_name, source, fn, routed) => {
    const bus = compileString(source, { messageBus: true, suppressWarnings: true });
    expect(bus.messageBus?.routeInBytecode).toBe(routed);
    expect(bus.recordSound).toBe(false);
    expect(() => assertDeployerCallee('T', bus, fn)).toThrow(DeployerCalleeError);
    expect(() => assertDeployerCallee('T', bus, fn)).toThrow(/message-bus build.*messageBus: false/);
    const direct = compileString(source, { messageBus: false, suppressWarnings: true });
    expect(direct.recordSound).toBe(true);
    expect(() => assertDeployerCallee('T', direct, fn)).not.toThrow();
  });
});
