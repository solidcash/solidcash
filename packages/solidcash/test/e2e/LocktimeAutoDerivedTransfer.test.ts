/**
 * A stateful entry that checks `tx.time` and then pays from its satoshi container, sent with `.setLocktime()` and no
 * manual `.transfer()`. The first derivation probe runs before the call's overrides are applied, so it stops at the
 * CLTV check without reaching the payment. The re-derivation that follows, with the locktime applied, must derive the
 * transfer too; otherwise the call fails and the caller has to pass `.transfer()` by hand.
 */
import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { SignatureTemplate, Signer } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import type { Utxo } from '../../src/interfaces.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';

const SOURCE = `pragma solidcash ^0.52.0;
contract TimedPayout(pubkey owner, int unlockAt) {
  int paid;
  function deposit() public payable { require(msg.value > 0); this.paid += msg.value; }
  function withdraw(sig s, int amount) public {
    require(checkSig(s, owner));
    require(tx.time >= unlockAt);
    this.paid -= amount;
    this.transfer(new LockingBytecodeP2PKH(hash160(owner)), amount);
  }
}`;

describe('an auto-derived satoshi transfer behind a tx.time check', () => {
  const setup = async (): Promise<{ wallet: any; contract: StatefulContract; unlockAt: number }> => {
    const provider = new MockNetworkProvider();
    const ownerLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: ownerLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const fundingUtxo: Utxo = { txid: '7d'.repeat(32), vout: 0, satoshis: 2_000_000n };
    await provider.seedUtxo(binToHex(ownerLock), fundingUtxo);
    const unlockAt = (await provider.getBlockHeight()) + 5;
    const artifact = compileString(SOURCE);
    const { contract } = await StatefulContract.deploy(artifact, [alicePub, BigInt(unlockAt)], {
      provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
      changeAddress: change.address, senderLockingBytecode: ownerLock, initialState: { paid: 0n },
    } as never);
    const signer = new Signer(alicePriv, provider);
    for (let index = 0; index < 4; index += 1) {
      await provider.seedUtxo(signer.getAddress(), {
        txid: `${(0xb0 + index).toString(16)}`.repeat(32), vout: 0, satoshis: 200_000n,
      });
    }
    const wallet = contract.connect(signer) as any;
    await wallet.call.deposit().withValue(20_000n).send();
    await provider.mineUpTo(unlockAt);
    return { wallet, contract, unlockAt };
  };

  it('derives the payment once the locktime is applied', async () => {
    const { wallet, contract, unlockAt } = await setup();
    const details = await wallet.call.withdraw(new SignatureTemplate(alicePriv), 5_000n)
      .setLocktime(unlockAt)
      .send();
    const ownerLock = binToHex(encodeLockingBytecodeP2pkh(alicePkh));
    const paidToOwner = details.outputs.filter((output: any) => {
      const lock = output.lockingBytecode ?? output.to;
      return (typeof lock === 'string' ? lock : binToHex(Uint8Array.from(lock))) === ownerLock;
    }).map((output: any) => BigInt(output.valueSatoshis ?? output.amount));
    expect(paidToOwner).toContain(5_000n);
    expect(((await contract.getState()) as { paid?: bigint }).paid).toBe(15_000n);
  }, 300_000);

  it('still refuses a locktime below the check', async () => {
    const { wallet, unlockAt } = await setup();
    await expect(wallet.call.withdraw(new SignatureTemplate(alicePriv), 5_000n)
      .setLocktime(unlockAt - 1)
      .send()).rejects.toThrow(/locktime/i);
  }, 300_000);
});
