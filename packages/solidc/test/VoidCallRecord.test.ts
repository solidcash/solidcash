/**
 * B6.2, B6.3 (the deployer-coins spec): which entries publish a call record, and the void entry's record.
 *
 * A void entry's record is the digest and the form byte `01`, settled at the same carrier witness a returning
 * entry uses. The `callRecords` option is recorded on the artifact: `'all'` marks void entries as publishing,
 * `'returning'` keeps today's ABI, and a framed compile refuses `'all'`.
 */
import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';

const P = 'pragma solidcash ^0.52.0;';
const VOID_AND_RETURNING = `${P} contract C {
    int s;
    function v(int x) { s = s + x; }
    function r() returns (int) { return s; }
}`;

describe('B6.2/B6.3: void call records', () => {
  it('a void entry publishes a record under callRecords: all, and says so in the ABI', () => {
    const artifact = compileString(VOID_AND_RETURNING, { callRecords: 'all' });
    const voidEntry = artifact.abi.find((entry) => entry.name === 'v')!;
    const returning = artifact.abi.find((entry) => entry.name === 'r')!;
    expect(voidEntry.callRecord).toBe(true);
    expect(returning.callRecord).toBe(true);
    // The record is settled at the same carrier witness a returning entry uses.
    expect(voidEntry.inputs.some((input) => input.name === '__internal__returnOutputIdx')).toBe(true);
    expect(artifact.callRecords).toBe('all');
  });

  it('under returning, a void entry keeps its inputs but is not published as a record', () => {
    const artifact = compileString(VOID_AND_RETURNING);
    expect(artifact.abi.find((entry) => entry.name === 'v')!.callRecord).toBeUndefined();
    expect(artifact.callRecords).toBe('returning');
  });

  it('a returning compile is byte-identical with genesisCalls on and off when the contract is not record-sound', () => {
    const source = `${P} contract C { int s; function v(int x) unsafe { s = s + x; } }`;
    const on = compileString(source, { genesisCalls: true });
    const off = compileString(source, { genesisCalls: false });
    expect(on.bytecode).toBe(off.bytecode);
  });

  it('refuses callRecords: all on a framed compile', () => {
    expect(() => compileString(VOID_AND_RETURNING, { composition: 'framed', callRecords: 'all' }))
      .toThrow(/callRecords: 'all' is not available on a framed compile/);
  });

  it('a void record is a run of a record-publishing entry: the contract is record-sound', () => {
    const artifact = compileString(`${P} contract C { int s; function v(int x) { s = s + x; } }`, {
      callRecords: 'all', genesisCalls: true,
    });
    expect(artifact.recordSound).toBe(true);
    expect(artifact.genesisCalls).toBe(true);
  });
});
