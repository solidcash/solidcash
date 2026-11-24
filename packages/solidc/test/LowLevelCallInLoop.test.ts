import { describe, expect, it } from 'vitest';
import { compileString } from './direct-compile.js';

// The direct convention pins each low-level call's callee as one co-spent input, which every turn of a loop reads:
// one run of the callee would answer each turn of a `call`. A call a loop may make more than once is refused by name;
// over a parameter array of targets it used to crash codegen ("reading 'elementType'"). A loop of one turn compiles.
const OPTIONS = { evmCompat: true, primaryContractName: 'R' } as const;

const withCaller = (body: string): string => `pragma solidcash ^0.51.0;
  interface IT { function set(int h, int c) external; }
  contract T { int height; int clock; int calls;
    function set(int h, int c) external { height = h; clock = c; calls = calls + 1; } }
  contract R { int runs; ${body} }`;
const call = (target: string): string => `(bool ok, bytes memory data) = ${target}.call{value: 0}(`
  + 'abi.encodeWithSelector(IT.set.selector, 3, 3)); require(ok);';

describe('a low-level call in a loop, in the direct convention', () => {
  it('refuses one over a parameter array of targets by name', () => {
    expect(() => compileString(withCaller(`function f(address[] memory ts) external {
      for (uint i = 0; i < ts.length; i++) { ${call('ts[i]')} } runs = runs + 1; }`), OPTIONS))
      .toThrow(/LOW_LEVEL_CALL_IN_LOOP.*Function 'f' makes low-level call 0 in a loop that may turn more than once/);
  });

  it('refuses one to a fixed target in a loop of run-time turns by name', () => {
    expect(() => compileString(withCaller(`function f(address t, uint n) external {
      for (uint i = 0; i < n; i++) { ${call('t')} } runs = runs + 1; }`), OPTIONS))
      .toThrow(/LOW_LEVEL_CALL_IN_LOOP/);
  });

  it('compiles one in a loop of one turn', () => {
    const artifact = compileString(withCaller(`function f(address t, uint n) external {
      for (uint i = 0; i < 1; i++) { if (n > 0) { ${call('t')} } } runs = runs + 1; }`), OPTIONS);
    expect(artifact.abi.find((fn) => fn.name === 'f')?.lowLevelCalls?.[0])
      .toMatchObject({ callMode: 'call', occurrence: 'loop', maximumOccurrences: 1 });
  });
});
