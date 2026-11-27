/**
 * B6.5 (first half): a record-publishing entry takes the constructor genesis call.
 *
 * The parameter is empty for every ordinary call, and the entry requires exactly that. The tagged form and its
 * (X, 0) and value checks arrive with Deploy<C>, the only tag supplier (B6.5's remaining half).
 */
import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';

const P = 'pragma solidcash ^0.53.0;';
const SOURCE = `${P} contract C { int calls; function hit(int amount) { calls = calls + amount; } }`;

describe('B6.5: the genesis call parameter', () => {
  it('follows the return-carrier witness in the ABI of every record-publishing entry', () => {
    const artifact = compileString(SOURCE, { genesisCalls: true });
    const entry = artifact.abi.find((candidate) => candidate.name === 'hit')!;
    const names = entry.inputs.map((input) => input.name);
    // The unlocking pushes the ABI in reverse, so the parameter that follows the carrier witness in the source
    // order sits below it; the compiler's model and the SDK agree on this order (see the commit message). The reader
    // a record names sits between them.
    expect(names.indexOf('__internal__genesisCall')).toBe(names.indexOf('__internal__callRecordReader') - 1);
    expect(names.indexOf('__internal__callRecordReader')).toBe(names.indexOf('__internal__returnOutputIdx') - 1);
  });

  it('a contract with a delegate entry is not record-sound and takes no parameter', () => {
    const source = `${P} contract C { int calls; function hit(int amount) { calls = calls + amount; }
      function d() public delegate { calls = calls + 1; } }`;
    const artifact = compileString(source, { genesisCalls: true });
    const entry = artifact.abi.find((candidate) => candidate.name === 'hit')!;
    expect(entry.inputs.some((input) => input.name === '__internal__genesisCall')).toBe(false);
  });

  it('is absent when genesisCalls is off', () => {
    const artifact = compileString(SOURCE, { genesisCalls: false });
    const entry = artifact.abi.find((candidate) => candidate.name === 'hit')!;
    expect(entry.inputs.some((input) => input.name === '__internal__genesisCall')).toBe(false);
    expect(artifact.genesisCalls).toBe(false);
  });

});
