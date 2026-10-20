/**
 * A direct contract that declares `split` can spend several of its masters in one transaction, so a body reads a token
 * container's amount as the master it runs on holds it (security GROWTH-3), as a framed body does: the containers
 * whose unlocking names that master, and, for the output side, a new container only when no other master of the
 * contract is spent beside it owning none. One thread wraps into a new container, wraps again into it, and unwraps.
 */
import { hexToBin } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract, SignatureTemplate } from '../../src/index.js';
import { StatefulContract, getTokenContainerAddress } from '../../src/stateful/index.js';
import type { Utxo } from '../../src/interfaces.js';
import { addressToLockScript } from '../../src/utils.js';
import { createTestProvider } from '../test-util.js';
import { alicePkh, alicePriv, alicePub, bobAddress } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

const SOURCE = `
pragma solidcash >=0.8.0;

contract ThreadedReserve(pubkey admin) {
    bigint wrapped;

    function fork(bigint n, sig s) split(n) {
        require(n >= 1);
        require(checkSig(s, admin));
    }

    function wrap(bytes32 category, int amount) {
        require(this.outState.tokens[category].tokenAmount >= this.tokens[category].tokenAmount + amount);
        this.wrapped = this.wrapped + amount;
    }

    function unwrap(bytes32 category, bytes to, int amount) {
        require(this.wrapped >= amount);
        this.wrapped = this.wrapped - amount;
        this.tokens[category].transfer(to, amount);
    }
}
`;

describe('a direct contract with threads reads its token containers per master', () => {
  it('wraps into a new container, wraps into it again, and unwraps', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE);
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const alice = new SignatureTemplate(alicePriv);
    const funding: Utxo = { txid: 'c1'.repeat(32), vout: 0, satoshis: 300_000n };
    await provider.addUtxo(p2pkh.address, funding);
    const { contract, categoryId } = await StatefulContract.deploy(artifact, [alicePub], {
      provider, fundingUtxo: funding, funder: p2pkh.unlock.spend(alicePub, alice),
      initialState: { wrapped: 0n }, changeAddress: p2pkh.address,
    });
    const category = 'c2'.repeat(32);
    const bearer = async (txid: string, amount: bigint): Promise<Utxo> => {
      const utxo: Utxo = { txid: txid.repeat(32), vout: 0, satoshis: 100_000n, token: { category, amount } };
      await provider.addUtxo(p2pkh.tokenAddress, utxo);
      return utxo;
    };
    const fee = async (txid: string): Promise<void> => {
      await provider.addUtxo(p2pkh.address, { txid: txid.repeat(32), vout: 0, satoshis: 200_000n });
    };
    const container = addressToLockScript(getTokenContainerAddress(contract.inner, categoryId, category));
    const reserve = async (): Promise<bigint> => (await provider.getUtxosForLockingBytecode(container))
      .filter((utxo) => utxo.token?.category === category)
      .reduce((sum, utxo) => sum + utxo.token!.amount, 0n);
    const unlocker = p2pkh.unlock.spend(alicePub, alice);

    await fee('c3');
    await contract.call.wrap(hexToBin(category), 60n)
      .addInput(await bearer('c4', 60n), unlocker).tokenContainerDeposit(category, 60n).send();
    expect((await contract.getState()).wrapped).toBe(60n);
    expect(await reserve()).toBe(60n);

    await fee('c5');
    await contract.call.wrap(hexToBin(category), 40n)
      .addInput(await bearer('c6', 40n), unlocker).tokenContainerDeposit(category, 40n).send();
    expect((await contract.getState()).wrapped).toBe(100n);
    expect(await reserve()).toBe(100n);

    await fee('c7');
    const bobLock = addressToLockScript(bobAddress);
    await contract.call.unwrap(hexToBin(category), bobLock, 30n).send();
    expect((await contract.getState()).wrapped).toBe(70n);
    expect(await reserve()).toBe(70n);
    expect((await provider.getUtxosForLockingBytecode(bobLock))
      .filter((utxo) => utxo.token?.category === category).map((utxo) => utxo.token!.amount)).toEqual([30n]);
  }, 300_000);
});
