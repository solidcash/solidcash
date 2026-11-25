import { describe, expect, it } from 'vitest';
import { lowLevelCallTurnInputsInput, lowLevelCallTurnRecordBaseInput } from '@solidcash/utils';
import { compileString } from './direct-compile.js';

// A low-level `call` a loop may make more than once binds each turn to a callee run of its own (perTurn): the turn's
// callee input comes from a list witness, strictly increasing, and a caller that keeps state reads each turn's record
// at a record base plus the turn. Over a parameter array of targets it used to crash codegen ("reading
// 'elementType'"), then was refused by name (LOW_LEVEL_CALL_IN_LOOP). A loop of one turn is a single call.
const OPTIONS = { evmCompat: true, primaryContractName: 'R' } as const;

const withCaller = (body: string, state = 'int runs;'): string => `pragma solidcash ^0.52.0;
  interface IT { function set(int h, int c) external; }
  contract T { int height; int clock; int calls;
    function set(int h, int c) external { height = h; clock = c; calls = calls + 1; } }
  contract R { ${state} ${body} }`;
const call = (target: string): string => `(bool ok, bytes memory data) = ${target}.call{value: 0}(`
  + 'abi.encodeWithSelector(IT.set.selector, 3, 3)); require(ok);';

const inputsOf = (artifact: ReturnType<typeof compileString>, name: string): string[] => artifact.abi
  .find((fn) => fn.name === name)!.inputs.map((input) => input.name);

describe('a low-level call in a loop, in the direct convention', () => {
  it('binds each turn of one over a parameter array of targets to a callee run and its record', () => {
    const artifact = compileString(withCaller(`function f(address[] memory ts) external {
      for (uint i = 0; i < ts.length; i++) { ${call('ts[i]')} } runs = runs + 1; }`), OPTIONS);
    expect(artifact.abi.find((fn) => fn.name === 'f')?.lowLevelCalls?.[0])
      .toMatchObject({ callMode: 'call', occurrence: 'loop', perTurn: true });
    const inputs = inputsOf(artifact, 'f');
    expect(inputs).toContain(lowLevelCallTurnInputsInput(0));
    expect(inputs).toContain(lowLevelCallTurnRecordBaseInput(0));
    expect(inputs.some((name) => name.startsWith('__internal__callInputIndex'))).toBe(false);
  });

  it('binds each turn of one to a fixed target in a loop of run-time turns', () => {
    const artifact = compileString(withCaller(`function f(address t, uint n) external {
      for (uint i = 0; i < n; i++) { ${call('t')} } runs = runs + 1; }`), OPTIONS);
    expect(artifact.abi.find((fn) => fn.name === 'f')?.lowLevelCalls?.[0]).toMatchObject({ perTurn: true });
  });

  it('takes no record base in a caller that keeps no state', () => {
    const artifact = compileString(withCaller(`function f(address[] memory ts) external {
      for (uint i = 0; i < ts.length; i++) { ${call('ts[i]')} } require(ts.length > 0); }`, ''), OPTIONS);
    const inputs = inputsOf(artifact, 'f');
    expect(inputs).toContain(lowLevelCallTurnInputsInput(0));
    expect(inputs).not.toContain(lowLevelCallTurnRecordBaseInput(0));
  });

  it('compiles one in a loop of one turn as a single call', () => {
    const artifact = compileString(withCaller(`function f(address t, uint n) external {
      for (uint i = 0; i < 1; i++) { if (n > 0) { ${call('t')} } } runs = runs + 1; }`), OPTIONS);
    const row = artifact.abi.find((fn) => fn.name === 'f')?.lowLevelCalls?.[0];
    expect(row).toMatchObject({ callMode: 'call', occurrence: 'loop', maximumOccurrences: 1 });
    expect(row?.perTurn).toBeUndefined();
  });
});
