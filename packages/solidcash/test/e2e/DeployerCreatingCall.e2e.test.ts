/**
 * B9.5: a creating call through Deploy<C>.
 *
 * The factory's `createChild` binds the child's deployer at its `deploy` slot. `deployFrom` builds and broadcasts
 * the prep, then spends the prep's deployer coin with the child's `create` unlocking and the author coin beside
 * it, so the child is born inside the factory's call.
 */
import { describe, expect, it } from 'vitest';
import { encodeLockingBytecodeP2pkh, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { SignatureTemplate } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { compileStringMulti } from '../direct-compile.js';
import { alicePkh, alicePriv } from '../fixture/vars.js';
import type { Utxo } from '../../src/interfaces.js';

const FACTORY = `
contract Child(bytes20 owner) {
    int counter;
    function increment() { require(owner != bytes20(0)); this.counter = this.counter + 1; }
}
contract Factory() {
    int childCount;
    function createChild(bytes20 owner, int fundingInputIndex) {
        new Child(owner);
        require(tx.inputs[fundingInputIndex].outpointTransactionHash != 0x0000000000000000000000000000000000000000000000000000000000000000);
        this.childCount = this.childCount + 1;
    }
}
`;

describe('B9.5: a creating call through Deploy<C>', () => {
  it('deploys a child inside the factory call under the production VM', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const funder = new SignatureTemplate(alicePriv).unlockP2PKH();
    const artifacts = compileStringMulti(FACTORY, { allowUnsafeOperations: true, __deployerNew: true } as never);
    const factoryArtifact = artifacts.Factory;
    const childArtifact = artifacts.Child;
    expect(factoryArtifact.childDeployers?.Child).toBeDefined();

    const deploymentFunding: Utxo = { txid: 'd1'.repeat(32), vout: 0, satoshis: 100000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), deploymentFunding);
    const deployed = await StatefulContract.deploy(factoryArtifact, [], {
      provider,
      fundingUtxo: deploymentFunding,
      funder,
      initialState: { childCount: 0n },
      changeAddress: change.address,
      senderLockingBytecode: authorLock,
    });

    const prepFunding: Utxo = { txid: 'd2'.repeat(32), vout: 0, satoshis: 100000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), prepFunding);
    const createChild = factoryArtifact.abi.find((fn) => fn.name === 'createChild')!;
    const requiredNftCount = createChild.requiredNftIndices?.length ?? factoryArtifact.stateLayout!.dataNftCount;
    const fundingInputIndex = 1 + requiredNftCount;

    const result = await StatefulContract.deployFrom({
      provider,
      factory: deployed.contract,
      deployFunctionName: 'createChild',
      deployFunctionArgs: [alicePkh, BigInt(fundingInputIndex)],
      childArtifact,
      childConstructorArgs: [alicePkh],
      childInitialState: { counter: 0n },
      fundingUtxo: prepFunding,
      funder,
      changeAddress: change.address,
    });

    expect(result.prepTransactions).toHaveLength(1);
    expect(result.childCategoryId).not.toBe(prepFunding.txid);
    expect(result.child.categoryId).toBe(result.childCategoryId);
    const state = await result.child.getState();
    expect((state as { counter?: bigint }).counter).toBe(0n);
    const factoryState = await result.factory.getState();
    expect((factoryState as { childCount?: bigint }).childCount).toBe(1n);
  });
});
