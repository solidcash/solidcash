/**
 * A creating call that makes two children in a loop derives each child's records for its own category.
 *
 * The child's constructor stores `this.category`, so the two children's records differ. The SDK derives the records
 * once per child; reusing the first child's would make the second child's `create` refuse its record.
 * (Genesis-mode `this.category` comes with the genesis-pins work; this case runs on the merged tree.)
 */
import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { SignatureTemplate } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { compileStringMulti } from '../direct-compile.js';
import { alicePkh, alicePriv } from '../fixture/vars.js';
import type { Utxo } from '../../src/interfaces.js';

describe('a loop of two children with records of their own', () => {
  it('derives each child\'s records for its own category', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const funder = new SignatureTemplate(alicePriv).unlockP2PKH();
    const artifacts = compileStringMulti(`
      contract Child { bytes32 me; constructor() { me = this.category; } function touch() { this.me = this.me; } }
      contract LoopFactory { int childCount;
        function makeTwo() {
          for (int i = 0; i < 2; i = i + 1) { new Child(); }
          childCount = childCount + 2;
        }
      }`, { allowUnsafeOperations: true } as never);

    const deploymentFunding: Utxo = { txid: 'a7'.repeat(32), vout: 0, satoshis: 100000n };
    await provider.seedUtxo(binToHex(authorLock), deploymentFunding);
    const deployed = await StatefulContract.deploy(artifacts.LoopFactory, [], {
      provider, fundingUtxo: deploymentFunding, funder,
      initialState: { childCount: 0n }, changeAddress: change.address, senderLockingBytecode: authorLock,
    });
    const prepOne: Utxo = { txid: 'a8'.repeat(32), vout: 0, satoshis: 100000n };
    const prepTwo: Utxo = { txid: 'a9'.repeat(32), vout: 0, satoshis: 100000n };
    await provider.seedUtxo(binToHex(authorLock), prepOne);
    await provider.seedUtxo(binToHex(authorLock), prepTwo);

    const result = await StatefulContract.deployFrom({
      provider, factory: deployed.contract, deployFunctionName: 'makeTwo',
      deployFunctionArgs: [], childArtifact: artifacts.Child, childConstructorArgs: [],
      fundingUtxos: [prepOne, prepTwo], deployments: 2,
      funder, changeAddress: change.address,
    });
    expect(result.children).toHaveLength(2);
    for (const child of result.children!) {
      const state = await child.getState() as { me?: Uint8Array | string };
      const me = typeof state.me === 'string' ? state.me : binToHex(state.me ?? new Uint8Array());
      expect(me).toBe(child.categoryId);
    }
  }, 600_000);
});
