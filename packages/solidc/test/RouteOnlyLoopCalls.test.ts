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
  it('compiles direct by default when the route does not serve the entry, binding the loop there', () => {
    const artifact = compileString(source(`  function fire(uint256 v) { ${LOOP} this.n = this.n + 1; }
  function poke(uint256 v) { IT(a).other(v); this.n = this.n + 2; }`), quiet);
    const fire = artifact.abi.find((entry) => entry.name === 'fire')!;
    expect(fire.externalCalls![0]!.callOrdinal).toBeDefined();
  });

  it('refuses a call through an internal pointer to a helper that makes an external call', () => {
    const body = `  function h(uint256 v) internal { IT(a).small(v); }
  function h2(uint256 v) internal { IT(a).other(v); }
  function fire(bool k, uint256 v) { function(uint256) internal g = k ? h : h2; g(v); this.n = this.n + 1; }`;
    for (const options of [{}]) {
      expect(() => compileString(source(body), { ...options, ...quiet })).toThrow(/EXTERNAL_CALL_IN_SUBROUTINE/);
    }
  });
});
