import { describe, expect, it } from 'vitest';
import { compileString } from '../../../src/compiler.js';

const SOURCE = `pragma solidcash ^0.14.0;
  interface IReader { function first(address holder) returns (bool); function second(string label) returns (bool); }
  contract Guarded {
    function run(address target, address holder) { validate(holder, target); require(true); }
    function gated(address optionalHolder, address holder, address target) {
      if (optionalHolder != address(0)) { validate(holder, target); }
      require(true);
    }
    function afterEarlyReturn(address target, address holder) { guardedTail(holder, target); require(true); }
    function guardedTail(address optionalHolder, address target) internal {
      if (optionalHolder == address(0)) { return; }
      require(IReader(target).first(optionalHolder));
    }
    function validate(address optionalHolder, address target) internal {
      if (optionalHolder != address(0)) { require(IReader(target).first(optionalHolder)); }
      require(IReader(target).second("DV"));
    }
  }
`;

describe('inlined helper call activation', () => {
  it('publishes a typed guard using the reordered caller argument', () => {
    const artifact = compileString(SOURCE, { composition: 'framed' });
    const calls = artifact.abi.find((entry) => entry.name === 'run')!.externalCalls!;
    expect(calls[0].condition).toMatchObject({ kind: 'binary', operator: '!=',
      left: { kind: 'source', source: { kind: 'forward', paramIndex: 1 } } });
    expect(calls[1].condition).toBeUndefined();
    const entry = artifact.composition!.stopSites!.entries.find((row) => row.functionName === 'Guarded.run()')!;
    expect(entry.sites.sites[0]).toMatchObject({ kind: 'call', conditional: true });
  });

  it('publishes the fallthrough condition after a helper early return', () => {
    const artifact = compileString(SOURCE, { composition: 'framed' });
    const call = artifact.abi.find((entry) => entry.name === 'afterEarlyReturn')!.externalCalls![0];
    expect(call.condition).toMatchObject({ kind: 'unary', operator: '!',
      expression: { kind: 'binary', operator: '==',
        left: { kind: 'source', source: { kind: 'forward', paramIndex: 1 } } } });
  });

  it('keeps an inherited caller guard distinct from an identically named helper parameter', () => {
    const artifact = compileString(SOURCE, { composition: 'framed' });
    const calls = artifact.abi.find((entry) => entry.name === 'gated')!.externalCalls!;
    expect(calls[0].condition).toMatchObject({ kind: 'binary', operator: '&&',
      left: { kind: 'binary', operator: '!=',
        left: { kind: 'source', source: { kind: 'forward', paramIndex: 0 } } },
      right: { kind: 'binary', operator: '!=',
        left: { kind: 'source', source: { kind: 'forward', paramIndex: 1 } } } });
    expect(calls[1].condition).toMatchObject({ kind: 'binary', operator: '!=',
      left: { kind: 'source', source: { kind: 'forward', paramIndex: 0 } } });
  });
});
