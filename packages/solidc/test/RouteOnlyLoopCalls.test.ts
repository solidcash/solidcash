import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';

// A looped call to a fixed target compiles direct: the entry's own body binds it and counts its call ordinal at run
// time. A call through an internal pointer to a helper that makes an external call is refused.
const IFACE = 'interface IT { function small(uint256 v); function other(uint256 v); }';
const LOOP = 'for (uint256 i = 0; i < v; i = i + 1) { IT(a).small(i); }';
const source = (body: string, state = 'bigint n;'): string =>
  `pragma solidcash >=0.8.0;\n${IFACE}\ncontract C(address a) {\n  ${state}\n${body}\n}`;
const quiet = { suppressWarnings: true };

describe('a looped call to a fixed target', () => {
  it('compiles direct, binding the loop in the entry body with a call ordinal', () => {
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
