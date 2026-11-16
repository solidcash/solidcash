/**
 * A8: a payment to a lock passed as `bytes` that is a stateful contract's master lock.
 *
 * The master lock starts with pin(X), so a coin there without X's minting NFT can never be spent. The compiler cannot
 * tell such a lock from any other `bytes`; the SDK refuses the call that would pay it, naming the satoshi container to
 * pay instead. A container payment, a wallet payment and a payment to a script that holds a minting NFT but binds no
 * SolidCash record or container all go through, and the container's coin is spent by the contract's next call.
 */
import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { SignatureTemplate, Signer } from '../../src/index.js';
import { StatefulContract, StatefulMasterPaymentError } from '../../src/stateful/index.js';
import { getSatoshiContainerAddress } from '../../src/stateful/covenant-helpers.js';
import { addressToLockScript } from '../../src/utils.js';
import { compileString } from '../direct-compile.js';
import { alicePkh, alicePriv, bobPkh } from '../fixture/vars.js';
import type { Utxo } from '../../src/interfaces.js';

const aliceLock = encodeLockingBytecodeP2pkh(alicePkh);
const alice = new SignatureTemplate(alicePriv);

const TARGET = `contract Target {
    int x;
    function spend(address to, int amount) public { this.transfer(to, amount); this.x = this.x + 1; }
}`;
const PAYER = `contract Payer {
    int n;
    function pay(bytes to, int amount) public { this.transfer(to, amount); this.n = this.n + 1; }
}`;

describe('a payment to a stateful master lock passed as bytes (A8)', () => {
  it('is refused with the container to pay; the container, a wallet and a foreign script are paid', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const change = lockingBytecodeToCashAddress({ bytecode: aliceLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const deploy = async (
      source: string, initialState: Record<string, bigint>, balance: bigint, txid: string,
    ): Promise<{ contract: any; categoryId: string }> => {
      const funding: Utxo = { txid: txid.repeat(32), vout: 0, satoshis: 200_000n };
      await provider.seedUtxo(binToHex(aliceLock), funding);
      return StatefulContract.deploy(compileString(source, { suppressWarnings: true } as never), [], {
        provider, fundingUtxo: funding, funder: alice.unlockP2PKH(), initialState, initialBalance: balance,
        changeAddress: change.address, senderLockingBytecode: aliceLock,
      } as never);
    };
    const target = await deploy(TARGET, { x: 0n }, 2_000n, 'a1');
    const payerDeployment = await deploy(PAYER, { n: 0n }, 50_000n, 'a2');
    for (const txid of ['a3', 'a4', 'a5', 'a6']) {
      await provider.seedUtxo(binToHex(aliceLock), { txid: txid.repeat(32), vout: 0, satoshis: 300_000n });
    }
    const signer = new Signer(alicePriv, provider);
    const payer = payerDeployment.contract.connect(signer) as any;
    const masterLock = hexToBin(target.contract.inner.lockingBytecode);
    const containerAddress = getSatoshiContainerAddress(target.contract.inner, target.categoryId);
    const containerLock = addressToLockScript(containerAddress);

    // The master lock: refused before anything is broadcast, naming the container.
    const refused = payer.pay(masterLock, 6_000n).send();
    await expect(refused).rejects.toThrow(StatefulMasterPaymentError);
    await expect(payer.pay(masterLock, 6_000n).send()).rejects.toThrow(containerAddress);
    expect((await provider.getUtxosForLockingBytecode(masterLock))
      .filter((coin) => coin.token?.nft?.capability !== 'minting')).toHaveLength(0);

    // The container: paid, and the target's next call spends that coin, the larger of its two.
    const paid = await payer.pay(containerLock, 6_000n).send();
    const coin = (await provider.getUtxosForLockingBytecode(containerLock)).find((utxo) => utxo.satoshis === 6_000n)!;
    expect(coin.txid).toBe(paid.txid);
    const spent = await (target.contract.connect(signer) as any).spend(bobPkh, 5_000n).send();
    expect(spent.inputs.some((input: any) => binToHex(input.outpointTransactionHash) === coin.txid
      && input.outpointIndex === coin.vout)).toBe(true);

    // A wallet, and a script holding a minting NFT with no SolidCash record or container bound to it: paid.
    await expect(payer.pay(encodeLockingBytecodeP2pkh(bobPkh), 6_000n).send()).resolves.toBeDefined();
    const foreign = Uint8Array.from([0xaa, 0x20, ...new Uint8Array(32).fill(0x5c), 0x87]);
    await provider.seedUtxo(binToHex(foreign), {
      txid: 'a7'.repeat(32), vout: 0, satoshis: 1_000n,
      token: { category: 'c7'.repeat(32), amount: 0n, nft: { capability: 'minting', commitment: '' } },
    });
    await expect(payer.pay(foreign, 6_000n).send()).resolves.toBeDefined();
  }, 600_000);
});
