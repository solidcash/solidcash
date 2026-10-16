import { describe, expect, it } from 'vitest';
import type { ExternalCallAbi } from '@solidcash/utils';
import { compileString } from './direct-compile.js';

/**
 * DS/direct-composition boundary for STATICCALL commitment preservation. The compiler's
 * `emitStaticCallCommitmentPreservation` pins the callee master plus every `requiredDataNftIndices` entry the
 * CALLER's declared type publishes. A bare interface (no state declarations) therefore pins only the master, while
 * a state-declaring interface pins the master and its data NFTs. A plain view/pure declaration runs REGULAR (no
 * static preservation at all), which is the gap the deferrals entry records.
 */

const SOURCE = `pragma solidcash >=0.8.0;
interface IBare { function bump() external; }
interface IStateful { public int counter; function bump() external; }
contract Caller(address bare, address stateful) {
  function viaBare() public { IBare(bare).bump.staticcall(); require(true); }
  function viaStateful() public { IStateful(stateful).bump.staticcall(); require(true); }
  function viaBarePlain() public { IBare(bare).bump(); require(true); }
}`;

describe('direct staticcall commitment preservation', () => {
  it('pins only the master for a bare interface and master+data NFTs for a state-declaring one', () => {
    const artifact = compileString(SOURCE, { forceStateful: true });
    const call = (name: string): ExternalCallAbi => artifact.abi
      .find((fn) => fn.name === name)!.externalCalls![0];

    const viaBare = call('viaBare');
    expect(viaBare.callMode).toBe('staticcall');
    expect(viaBare.requiredDataNftIndices).toEqual([]);

    const viaStateful = call('viaStateful');
    expect(viaStateful.callMode).toBe('staticcall');
    expect(viaStateful.requiredDataNftIndices).toEqual([0]);
  });

  it('runs a plain view/pure declaration in REGULAR mode with no static preservation', () => {
    const artifact = compileString(SOURCE, { forceStateful: true });
    const plain = artifact.abi.find((fn) => fn.name === 'viaBarePlain')!.externalCalls![0];
    expect(plain.callMode).toBeUndefined();
  });
});
