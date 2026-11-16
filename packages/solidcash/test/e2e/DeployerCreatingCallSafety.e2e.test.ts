/**
 * A10, decision f, A14 item 4: a creating call broadcasts its preps only with a creation that passes the VM.
 *
 * A child whose constructor refuses its argument cannot be created. The failed call must broadcast nothing and
 * release every coin its preps reserved, so the same funding coin creates the child with a valid argument.
 */
import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { SignatureTemplate } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { compileStringMulti } from '../direct-compile.js';
import { alicePkh, alicePriv } from '../fixture/vars.js';
import type { Utxo } from '../../src/interfaces.js';

const FACTORY = `
contract Child(int x) {
    int n;
    constructor() { require(x > 0); n = x; }
    function bump() { this.n = this.n + 1; }
}
contract Factory() {
    int childCount;
    function make(int x) {
        new Child{args: (x)}();
        this.childCount = this.childCount + 1;
    }
}
`;

describe('A creating call broadcasts nothing until its creation passes the VM', () => {
  it('leaves the funding coin spendable after a refused creation', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const funder = new SignatureTemplate(alicePriv).unlockP2PKH();
    const artifacts = compileStringMulti(FACTORY, { allowUnsafeOperations: true } as never);

    const deploymentFunding: Utxo = { txid: 'f1'.repeat(32), vout: 0, satoshis: 100000n };
    await provider.seedUtxo(binToHex(authorLock), deploymentFunding);
    const deployed = await StatefulContract.deploy(artifacts.Factory, [], {
      provider, fundingUtxo: deploymentFunding, funder,
      initialState: { childCount: 0n }, initialBalance: 5000n,
      changeAddress: change.address, senderLockingBytecode: authorLock,
    });

    const prepFunding: Utxo = { txid: 'f2'.repeat(32), vout: 0, satoshis: 100000n };
    await provider.seedUtxo(binToHex(authorLock), prepFunding);
    const make = (x: bigint) => StatefulContract.deployFrom({
      provider,
      factory: deployed.contract,
      deployFunctionName: 'make',
      deployFunctionArgs: [x],
      childArtifact: artifacts.Child,
      childConstructorArgs: [],
      fundingUtxo: prepFunding,
      funder,
      changeAddress: change.address,
    });

    await expect(make(0n)).rejects.toThrow();
    const coins = await provider.getUtxos(change.address);
    expect(coins.some((coin) => coin.txid === prepFunding.txid && coin.vout === 0)).toBe(true);

    const result = await make(5n);
    const state = await result.child.getState() as { n?: bigint };
    expect(state.n).toBe(5n);
    expect(result.prepTransactions).toHaveLength(1);
  }, 600_000);
});
