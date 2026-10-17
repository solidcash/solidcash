import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import {
  createBareP2pkhFeeFunder, createTestProvider, expectScriptRejection, setupStatefulUtxos,
} from '../test-util.js';

/**
 * WT-1/WT-2 (docs/security-audit-2026-10-16.md): the direct outside-layout walk must inspect every own-category
 * mutable input outside `[master, master + blockSize)`, including one placed at an index BELOW the master. The
 * earlier relative walk started at `blockSize`, so a record at input 0 was never inspected when the master sat at
 * input 1, and its commitment could be rewritten beside a call that did not name it.
 *
 * The record here sits at a lock nothing in the contract counts (a P2SH32 lock whose redeem is OP_1), carries this
 * contract's category as a mutable NFT, and is preserved at output 0. The direct entry's own collection census does
 * not see it, so only the outside-layout walk can hold it. The SDK pins the master at input 0 in its own layout, so
 * the test prepends the record through the real stateful call builder; every unlocking script is regenerated for
 * the shifted coordinates.
 */
const SOURCE = `contract ReadCensus {
  mapping(int => int) m;
  function set(int k, int v) external { m[k] = v; require(true); }
  function check(int k, int expected) external { require(m[k] == expected); }
}`;

/** P2SH32(hash256(OP_1)): an arbitrary lock the contract has no census for. */
const FOREIGN_LOCK = 'aa20953ccfa596a6c6d39e5980194539124fdcff116a571455a212baed811f585ee087';
const FOREIGN_REDEEM = '51';

describe('direct convention: an outside-layout record below the master is preserved 1:1', () => {
  it('refuses a rewritten record placed at input 0, and settles the same spend preserved', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE, { forceStateful: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, {}, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);
    await sc.getFunction('set')(7n, 50n).send();

    const originalCommitment = 'cc'.repeat(32);
    const forgedCommitment = 'cd'.repeat(32);
    const record = {
      txid: 'fd'.repeat(32), vout: 0, satoshis: 5_000n,
      token: {
        category: categoryId, amount: 0n,
        nft: { capability: 'mutable' as const, commitment: originalCommitment },
      },
    };
    await (provider as any).addUtxo(FOREIGN_LOCK, record);
    const recordUnlocker = {
      generateLockingBytecode: (): Uint8Array => hexToBin(FOREIGN_LOCK),
      generateUnlockingBytecode: (): Uint8Array => Uint8Array.from([0x01, ...hexToBin(FOREIGN_REDEEM)]),
    };

    // Build the real stateful call, then prepend the record and its output at index 0. Rebuilding through the
    // builder regenerates every unlocking script for the master's shifted index.
    const build = async (commitment: string): Promise<string> => {
      const builder = await sc.getFunction('check')(7n, 50n).build();
      builder.inputs.unshift({ ...record, unlocker: recordUnlocker as never });
      builder.outputs.unshift({
        to: hexToBin(FOREIGN_LOCK),
        amount: record.satoshis,
        token: {
          category: categoryId, amount: 0n,
          nft: { capability: 'mutable', commitment },
        },
      });
      // The prepended input adds a redeem script to the unlocking size; a dedicated funder pays for it.
      const funder = await createBareP2pkhFeeFunder(provider, 50_000n);
      builder.addInput(funder.utxo, funder.unlocker);
      return builder.build();
    };

    // Forged first: its inputs are still unspent when it is refused.
    const forged = await build(forgedCommitment);
    const outcome = await provider.sendRawTransaction(forged)
      .then(() => 'ACCEPTED').catch((error: Error) => error.message);
    expectScriptRejection(outcome, 1);

    // The same record, unchanged, is a legitimate co-spend and the call settles.
    const honest = await build(originalCommitment);
    await expect(provider.sendRawTransaction(honest)).resolves.toBeTypeOf('string');
  }, 300_000);
});
