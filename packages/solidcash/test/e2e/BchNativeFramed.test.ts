/**
 * BchNative under the framed convention: the bearer token is a category of its own, so a framed genesis creates it
 * beside the contract's and premints the reserve into the contract's container for it, while a premint of the
 * contract's own category, which a framed composition refuses (spec S2), is refused before anything is signed.
 */
import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileFile } from 'solidc';
import { describe, expect, it } from 'vitest';
import { COMPOSITION_LIMITS } from '../../../solidc/test/framed/machine.js';
import { Contract } from '../../src/Contract.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import Signer from '../../src/Signer.js';
import { getTokenContainerAddress } from '../../src/stateful/covenant-helpers.js';
import { deployStatefulContract } from '../../src/stateful/sc-deploy.js';
import { addressToLockScript } from '../../src/utils.js';
import { alicePriv } from '../fixture/vars.js';
import { fundShippedFacets } from '../framed/shapes/harness.js';

const SOURCE = new URL('../fixture/bch_native_framed_token.scash', import.meta.url);

describe('BchNative, framed', () => {
  const artifact = compileFile(SOURCE, { composition: 'framed', suppressWarnings: true });

  it('keys its reserve by its own bearer category, which the genesis creates and premints', async () => {
    expect(artifact.composition?.convention).toBe('framed');
    const wrap = artifact.abi.find((entry) => entry.name === 'wrap')!;
    expect(wrap.tokenContainerAccesses).toEqual([expect.objectContaining({
      keySource: 'state', keyStateVariable: '_nativeCategory',
    })]);

    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const alice = new Signer(alicePriv, provider);
    const fundingUtxo = { txid: 'f1'.repeat(32), vout: 0, satoshis: 3_000_000n };
    const tokenFunding = { txid: 'f2'.repeat(32), vout: 0, satoshis: 100_000n };
    await provider.addUtxo(alice.getAddress(), fundingUtxo);
    await provider.addUtxo(alice.getAddress(), tokenFunding);
    await fundShippedFacets(provider);

    const base = { provider, fundingUtxo, funder: alice.unlockP2PKH(), changeAddress: alice.getAddress() };
    await expect(deployStatefulContract(artifact, [], {
      ...base, initArgs: [hexToBin(fundingUtxo.txid)], nativeToken: { reserve: 1_000n },
    })).rejects.toThrow(/category of its own/);

    const result = await deployStatefulContract(artifact, [], {
      ...base, initArgs: [hexToBin(tokenFunding.txid)], nativeToken: { funding: tokenFunding, reserve: 1_000n },
    });
    expect(result.tx.inputs.map((input) => binToHex(input.outpointTransactionHash))).toContain(tokenFunding.txid);
    const container = addressToLockScript(getTokenContainerAddress(
      new Contract(artifact, [] as never, { provider, category: hexToBin(result.categoryId) }),
      result.categoryId, tokenFunding.txid,
    ));
    const reserve = result.tx.outputs.find((output) => binToHex(output.lockingBytecode) === binToHex(container));
    expect(reserve?.token?.amount).toBe(1_000n);
    expect(binToHex(reserve!.token!.category)).toBe(tokenFunding.txid);
    // No output carries a fungible amount of the contract's own category.
    expect(result.tx.outputs.filter((output) => output.token !== undefined
      && binToHex(output.token.category) === result.categoryId && output.token.amount > 0n)).toEqual([]);
    expect(binToHex((await result.contract.getState())._nativeCategory as Uint8Array)).toBe(tokenFunding.txid);
  });
});
