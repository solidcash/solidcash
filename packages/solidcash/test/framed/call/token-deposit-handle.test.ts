import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { compileFileSplit } from '@solidcash/solidc';
import type { FunctionSplitBundle } from '@solidcash/utils';
import { Signer } from '../../../src/index.js';
import type { Utxo } from '../../../src/interfaces.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import type { StatefulContract } from '../../../src/stateful/StatefulContract.js';
import { FramedCallError, type FramedFunctionCall } from '../../../src/framed/call/index.js';
import { framedTokenContainerLockingBytecode } from '../../../src/framed/call/token-containers.js';
import { aliceAddress, alicePkh, alicePriv, aliceTokenAddress } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A handle's call carries the CashTokens a BchNative `wrap` reads as its reserve's growth (`withTokenDeposits`), as
 * `callFramedEntry` takes them, so a page that holds only a handle and a signer can wrap: before, the handle's call
 * offered value alone, and a wrap had to compose `callFramedEntry` by hand.
 */

const SOURCE = new URL('../../../contracts/examples/FramedNativeToken.scash', import.meta.url);

describe('a framed call made through a handle with token deposits', () => {
  const bundle = compileFileSplit(SOURCE, {
    split: 'func', composition: 'framed', suppressWarnings: true,
  }) as unknown as FunctionSplitBundle;

  it('wraps the deposited units and returns the coin\'s remainder', async () => {
    const provider = new MockNetworkProvider();
    const alice = new Signer(alicePriv, provider);
    const aliceLock = encodeLockingBytecodeP2pkh(alicePkh);
    const fundingUtxo = { txid: 'e1'.repeat(32), vout: 0, satoshis: 5_000_000n };
    const tokenFunding = { txid: 'e2'.repeat(32), vout: 0, satoshis: 100_000n };
    await provider.addUtxo(binToHex(aliceLock), fundingUtxo);
    await provider.addUtxo(binToHex(aliceLock), tokenFunding);
    await provider.addUtxo(binToHex(aliceLock), { txid: 'e3'.repeat(32), vout: 0, satoshis: 900_000n });
    await fundShippedFacets(provider);
    const category = tokenFunding.txid;
    const deployed = await deployStatefulContract(bundle.logical, [], {
      provider, fundingUtxo, funder: alice.unlockP2PKH(), changeAddress: aliceAddress,
      functionSplit: bundle, initArgs: [hexToBin(category)],
      nativeToken: { funding: tokenFunding, bearer: { amount: 1_000n, to: aliceTokenAddress } },
    });
    const vout = deployed.tx.outputs.findIndex((output) => output.token !== undefined
      && binToHex(output.token.category) === category);
    const bearer: Utxo = {
      txid: deployed.tx.txid, vout, satoshis: deployed.tx.outputs[vout]!.valueSatoshis,
      token: { category, amount: 1_000n },
    };
    const calls = (deployed.contract as StatefulContract).connect(alice).call as unknown as {
      readonly wrap: (amount: bigint) => FramedFunctionCall;
      readonly balanceOf: (owner: Uint8Array) => FramedFunctionCall;
    };

    expect(() => calls.wrap(600n).withTokenDeposits([{ utxo: bearer, unlocker: alice.unlockP2PKH(), amount: 1_001n }]))
      .toThrow(FramedCallError);
    await calls.wrap(600n).withTokenDeposits([{ utxo: bearer, unlocker: alice.unlockP2PKH(), amount: 600n }]).send();

    expect(await calls.balanceOf(aliceLock)).toBe(600n);
    const tokensAt = async (lock: Uint8Array): Promise<bigint> => (await provider.getUtxosForLockingBytecode(lock))
      .filter((utxo) => utxo.token?.category === category)
      .reduce((sum, utxo) => sum + utxo.token!.amount, 0n);
    expect(await tokensAt(framedTokenContainerLockingBytecode(deployed.categoryId, category))).toBe(600n);
    expect(await tokensAt(aliceLock)).toBe(400n);
  }, 900_000);
});
