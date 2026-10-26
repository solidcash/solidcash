import { disassembleBytecodeBch, hexToBin } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';

// A message-bus build binds a looped call to a fixed target only on its route: the entry's own body checks no
// callee for it. The route re-derives the loop row by row and never runs the entry body, so the entry body's
// per-iteration branch fails closed: a direct spend of the entry's own selector runs only with an empty loop
// (no callee), while one that enters the loop is rejected. A default build whose route does not serve the entry
// compiles direct (binding the loop there), and an explicit one refuses the entry.
const IFACE = 'interface IT { function small(uint256 v); function other(uint256 v); }';
const LOOP = 'for (uint256 i = 0; i < v; i = i + 1) { IT(a).small(i); }';
const source = (body: string, state = 'bigint n;'): string =>
  `pragma solidcash >=0.8.0;\n${IFACE}\ncontract C(address a) {\n  ${state}\n${body}\n}`;
const quiet = { suppressWarnings: true };

describe('a looped call in a message-bus build', () => {
  it('runs an empty-loop direct spend but guards the loop body against a direct spend', () => {
    const artifact = compileString(source(`  function fire(uint256 v) { ${LOOP} this.n = this.n + 1; }`),
      { messageBus: true, ...quiet });
    const fire = artifact.abi.find((entry) => entry.name === 'fire')!;
    expect(fire.routeOnly).toBe(true);
    expect(artifact.messageBus?.admittedHandlerIds).toContain('fire');
    // The dispatcher no longer refuses the entry's own selector, so a zero-iteration direct spend reaches the body.
    expect(artifact.bytecode).not.toContain(`OP_DUP ${fire.selector} OP_EQUAL OP_NOT OP_VERIFY`);
    // The entry body's per-iteration branch fails closed instead: a direct run that enters the loop is rejected.
    const tokens = artifact.bytecode.split(' ');
    const defineAt = tokens.findIndex((token, at) => token === 'OP_DEFINE' && tokens[at - 1] === fire.selector);
    expect(defineAt).toBeGreaterThan(1);
    expect(disassembleBytecodeBch(hexToBin(tokens[defineAt - 2]!))).toContain('OP_LESSTHAN OP_IF OP_0 OP_VERIFY');
  });

  it('compiles direct by default when the route does not serve the entry, binding the loop there', () => {
    const artifact = compileString(source(`  function fire(uint256 v) { ${LOOP} this.n = this.n + 1; }
  function poke(uint256 v) { IT(a).other(v); this.n = this.n + 2; }`), quiet);
    expect(artifact.compiler.options?.messageBus).toBe(false);
    const fire = artifact.abi.find((entry) => entry.name === 'fire')!;
    expect(fire.routeOnly).toBeUndefined();
    expect(fire.externalCalls![0]!.callOrdinal).toBeDefined();
  });

  it('refuses an entry the route does not serve in an explicit build', () => {
    // No state, so no route: the entry is the whole program, and that program fails.
    const artifact = compileString(source(`  function fire(uint256 v) { ${LOOP} }`, ''), { messageBus: true, ...quiet });
    expect(artifact.refusedFunctions).toEqual([
      { functionName: 'C.fire()', reason: expect.stringMatching(/^ROUTE_ONLY_ENTRY_UNSERVED: .*IT\.small/) },
    ]);
    expect(artifact.bytecode.endsWith('OP_0 OP_VERIFY')).toBe(true);
  });

  it('refuses a call through an internal pointer to a helper that makes an external call', () => {
    const body = `  function h(uint256 v) internal { IT(a).small(v); }
  function h2(uint256 v) internal { IT(a).other(v); }
  function fire(bool k, uint256 v) { function(uint256) internal g = k ? h : h2; g(v); this.n = this.n + 1; }`;
    for (const options of [{}, { messageBus: true }]) {
      expect(() => compileString(source(body), { ...options, ...quiet })).toThrow(/EXTERNAL_CALL_IN_SUBROUTINE/);
    }
  });
});
