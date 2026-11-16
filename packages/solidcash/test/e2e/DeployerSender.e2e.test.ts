/**
 * A4.3 step 8, A6 rules 1 to 3: a constructor's `msg.sender` is the contract whose `new` created it.
 *
 * The factory's `make` creates a child whose constructor stores `msg.sender`. The child must store the factory's
 * master lock, not the wallet that built the transaction. The SDK fills the factory's created-children digest and
 * the child's creator input, list and position; `create` checks them against the factory's unlocking and code.
 */
import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { SignatureTemplate } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { compileStringMulti } from '../direct-compile.js';
import { alicePkh, alicePriv } from '../fixture/vars.js';
import type { Utxo } from '../../src/interfaces.js';

const SENDER = `
contract Child {
    address owner;
    constructor() { owner = msg.sender; }
    function touch() { this.owner = this.owner; }
}
contract Factory() {
    int childCount;
    function make() {
        new Child();
        this.childCount = this.childCount + 1;
    }
}
`;

describe('A4.3 step 8: a child created by a factory sees the factory as msg.sender', () => {
  it('stores the factory master lock, not the wallet', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const funder = new SignatureTemplate(alicePriv).unlockP2PKH();
    const artifacts = compileStringMulti(SENDER, { allowUnsafeOperations: true } as never);
    const factoryArtifact = artifacts.Factory;
    const childArtifact = artifacts.Child;
    expect(factoryArtifact.childDeployers?.Child?.constructorReadsSender).toBe(true);

    const deploymentFunding: Utxo = { txid: 'e1'.repeat(32), vout: 0, satoshis: 100000n };
    await provider.seedUtxo(binToHex(authorLock), deploymentFunding);
    const deployed = await StatefulContract.deploy(factoryArtifact, [], {
      provider,
      fundingUtxo: deploymentFunding,
      funder,
      initialState: { childCount: 0n }, initialBalance: 5000n,
      changeAddress: change.address,
      senderLockingBytecode: authorLock,
    });

    const prepFunding: Utxo = { txid: 'e2'.repeat(32), vout: 0, satoshis: 100000n };
    await provider.seedUtxo(binToHex(authorLock), prepFunding);
    const result = await StatefulContract.deployFrom({
      provider,
      factory: deployed.contract,
      deployFunctionName: 'make',
      deployFunctionArgs: [],
      childArtifact,
      childConstructorArgs: [],
      fundingUtxo: prepFunding,
      funder,
      changeAddress: change.address,
    });

    const factoryLock = (deployed.contract as unknown as { inner: { lockingBytecode: string } }).inner.lockingBytecode;
    const state = await result.child.getState() as { owner?: Uint8Array | string };
    const owner = typeof state.owner === 'string' ? state.owner : binToHex(state.owner ?? new Uint8Array());
    expect(owner).toBe(factoryLock);
    expect(owner).not.toBe(binToHex(authorLock));
    const factoryState = await result.factory.getState();
    expect((factoryState as { childCount?: bigint }).childCount).toBe(1n);
  }, 600_000);
});
