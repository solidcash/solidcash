import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import {
  createBareP2pkhFeeFunder, createTestProvider, expectScriptRejection, setupStatefulUtxos,
} from '../test-util.js';

/**
 * C3 on the delegatecall proxy path (docs/security/SECURITY-AUDIT.md C3). On the path where a conditional delegatecall
 * is not taken, nothing authorizes a change to the proxy's records, so the proxy pins every co-spent own-category
 * mutable input to its index. The pin compared commitment and category only. An entry or chunk spent on its flag=1
 * path pins nothing about its output, so such a record could come back at its index under another lock while the
 * count balanced. The pin now compares the lock too.
 *
 * The record here sits at a lock whose redeem is OP_1, standing in for that flag=1 spend, and carries this proxy's
 * category as a mutable NFT. The test prepends it, and its output, to the real not-taken call.
 */
const SOURCE = `contract CondProxy() {
  mapping(int => int) m;
  function set(int k, int v) external { m[k] = v; require(true); }
  function forward(bytes input) external {
    address impl = address(0x76a91489abcdefabbaabbaabbaabbaabbaabbaabbaabba88ac);
    if (input.length > 1) { impl.delegatecall(input); }
    require(input.length > 0);
  }
}`;

/** P2SH32(hash256(OP_1)): the record's lock. */
const RECORD_LOCK = 'aa20953ccfa596a6c6d39e5980194539124fdcff116a571455a212baed811f585ee087';
const RECORD_REDEEM = '51';
/** Any other lock. */
const OTHER_LOCK = `76a914${'11'.repeat(20)}88ac`;

describe('C3 on the delegatecall proxy path: a not-taken call keeps each record at its lock', () => {
  // A record kept at its lock settles the same call.
  it.skipIf(Boolean(process.env.TESTS_USE_REGTEST))('refuses a record moved to another lock', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE, { forceStateful: true, allowUnsafeOperations: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, {}, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);

    const commitment = 'cc'.repeat(32);
    const record = {
      txid: 'fc'.repeat(32), vout: 0, satoshis: 5_000n,
      token: { category: categoryId, amount: 0n, nft: { capability: 'mutable' as const, commitment } },
    };
    await (provider as any).addUtxo(RECORD_LOCK, record);
    const recordUnlocker = {
      generateLockingBytecode: (): Uint8Array => hexToBin(RECORD_LOCK),
      generateUnlockingBytecode: (): Uint8Array => Uint8Array.from([0x01, ...hexToBin(RECORD_REDEEM)]),
    };

    // The real not-taken call, with the record and its output prepended at index 0.
    const build = async (lock: string): Promise<string> => {
      const builder = await sc.getFunction('forward')(hexToBin('01')).build();
      builder.inputs.unshift({ ...record, unlocker: recordUnlocker as never });
      builder.outputs.unshift({
        to: hexToBin(lock),
        amount: record.satoshis,
        token: { category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment } },
      });
      const funder = await createBareP2pkhFeeFunder(provider, 50_000n);
      builder.addInput(funder.utxo, funder.unlocker);
      return builder.build();
    };

    // Same commitment and category at the same index, another lock: refused at the proxy master (input 1).
    const moved = await build(OTHER_LOCK);
    const outcome = await provider.sendRawTransaction(moved)
      .then(() => 'ACCEPTED').catch((error: Error) => error.message);
    expectScriptRejection(outcome, 1);

    // The record kept at its lock is a legitimate co-spend and the call settles.
    const kept = await build(RECORD_LOCK);
    await expect(provider.sendRawTransaction(kept)).resolves.toBeTypeOf('string');
  }, 300_000);
});
