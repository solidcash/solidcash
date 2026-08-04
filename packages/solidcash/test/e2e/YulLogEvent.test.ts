import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract, StatefulContract } from '../../src/index.js';
import { parsePushdataCommitment } from '@solidcash/utils';
import { createTestProvider, getTxOutputs, setupStatefulUtxos } from '../test-util.js';

// Yul log0-log4 are the EVM LOG opcodes = EVENT emission (every `emit E(..)` lowers to a LOGn), NOT diagnostics.
// LowerInlineAssembly wires them to SolidCash's anonymous event NFT: `log*(p,n,topics...)` emits an anonymous
// `__YulLog(bytes)` carrying the topics (each a 32-byte word) concatenated with the data region mem[p:p+n].
const LOG1_CONTRACT = `
pragma solidcash >=0.8.0;
contract YulLog() {
  bigint counter;
  function bump() {
    this.counter = this.counter + 1;
    assembly {
      mstore(0, 42)
      log1(0, 0x20, 7)
    }
  }
}
`;

// log0 carries NO topics but still emits its data region - it is not a no-op.
const LOG0_CONTRACT = `
pragma solidcash >=0.8.0;
contract YulLog0() {
  bigint counter;
  function bump() {
    this.counter = this.counter + 1;
    assembly {
      mstore(0, 99)
      log0(0, 0x20)
    }
  }
}
`;

describe('Yul log0-log4 -> anonymous event NFT', () => {
  const provider = createTestProvider();

  const eventOutputs = (tx: unknown, categoryId: string): unknown[] => {
    const txOutputs = getTxOutputs(tx as never);
    // An emitted event is an immutable (capability 'none') NFT of the contract's category, distinct from the
    // data NFT at index 1.
    return txOutputs.filter(
      (o) => o.token?.nft?.capability === 'none' && o.token?.category === categoryId && o !== txOutputs[1],
    );
  };

  it('log1 emits an event NFT (topic + data region)', async () => {
    const artifact = compileString(LOG1_CONTRACT);
    expect(artifact.events?.some((e) => e.name === '__YulLog')).toBe(true);

    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { counter: 0n }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);
    const tx = await sc.bump().send();

    expect(tx.txid).toBeDefined();
    const txOutputs = getTxOutputs(tx);
    expect(parsePushdataCommitment(txOutputs[1].token!.nft!.commitment, artifact.stateLayout!, 0).counter).toBe(1n);
    expect(eventOutputs(tx, categoryId).length).toBeGreaterThanOrEqual(1);
  });

  it('log0 (no topics) still emits its data region - not a no-op', async () => {
    const artifact = compileString(LOG0_CONTRACT);
    expect(artifact.events?.some((e) => e.name === '__YulLog')).toBe(true);

    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { counter: 0n }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);
    const tx = await sc.bump().send();

    expect(tx.txid).toBeDefined();
    expect(eventOutputs(tx, categoryId).length).toBeGreaterThanOrEqual(1);
  });
});
