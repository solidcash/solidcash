import { describe, expect, it, vi } from 'vitest';

// The shim imports the SDK by package name, which resolves to the built output; point every entry it uses at the
// sources so the session registry the test opens and the session registry the shim reads are the same one. The
// subpath entries matter: before the package-root split everything came from `solidcash` and one mock sufficed.
vi.mock('solidcash', () => import('../../../src/index.js'));
vi.mock('solidcash/stateful', () => import('../../../src/stateful/index.js'));
vi.mock('solidcash/framed', () => import('../../../src/framed/index.js'));

import { binToHex, hexToBin } from '@bitauth/libauth';
import { validatorAddress } from '@solidcash/utils';
import { compileString } from '../../../../solidc/src/compiler.js';
import { buildValidatorProgram } from '../../../../solidc/src/framed/validator/index.js';
import { COMPOSITION_LIMITS } from '../../../../solidc/test/framed/machine.js';
import { Signer } from '../../../src/index.js';
import {
  deriveLogicalCreateAddress,
  StatefulContract,
} from '../../../src/stateful/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { CreateAddressError, deployMaster } from '../../../src/framed/deploy/index.js';
import {
  createLookaheadForAddress, openCreateLookahead, predictCreateAddress, takeReservedGenesisFunding,
} from '../../../src/framed/deploy/create-lookahead-session.js';
import { getCreateAddress } from '../../../../testing/src/ethers-shim.js';

/**
 * Predicting a create address from a running session.
 *
 * A create address is `addrV(category)` of the genesis-eligible UTXO a deployment will spend, so it can only be
 * answered while that UTXO is reserved. Reading a signer's nonce reserves a window of those UTXOs; the address for
 * nonce `n` is then `addrV` of the reserved coin's txid, and the deployment takes the same coin so the two agree.
 * The cases below drive the shipped path: the reservation is the shipped selection and the deployed child's real
 * category is read back from the deployment.
 */

const VALIDATOR_PROGRAM = buildValidatorProgram();
const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Child {'
  + '   int public total;'
  + '   constructor(int seed) { this.total = seed + 1; }'
  + '   function check(int v) { require(this.total == v); }'
  + ' }';
const artifact = compileString(SOURCE, { composition: 'framed' });

/** A signer over the relaxed mock, funded with `count` fresh vout-0 token-free UTXOs (each its own txid). */
async function fundedSigner(
  count: number, fill: number,
): Promise<{ signer: Signer; provider: MockNetworkProvider }> {
  const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signer = new Signer(new Uint8Array(32).fill(fill), provider);
  for (let index = 0; index < count; index += 1) {
    await provider.addUtxo(signer.getAddress(), {
      txid: (fill * 0x100 + index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
  }
  return { signer, provider };
}

describe('a session answers a create address a nonce read reserved', () => {
  it('reserves the window on a nonce read and predicts every nonce in it', async () => {
    const { signer } = await fundedSigner(5, 0xb1);
    const base = Number(await signer.getNonce());
    const address = signer.getAddress();

    const lookahead = createLookaheadForAddress(address);
    expect(lookahead).toBeDefined();
    expect(lookahead!.getReservedCount()).toBe(4);
    // A signer and the account's lock-script hex reach the same session.
    expect(openCreateLookahead(signer)).toBe(lookahead);
    expect(createLookaheadForAddress(binToHex(signer.getLockingBytecode()))).toBe(lookahead);

    for (let index = 0; index < 4; index += 1) {
      const utxo = lookahead!.getFundingUtxo(base + index);
      const expected = validatorAddress(new Uint8Array(hexToBin(utxo.txid)), VALIDATOR_PROGRAM);
      expect([...predictCreateAddress(address, base + index)]).toStrictEqual([...expected]);
    }
  });

  it('hands the reserved coin to the deployment, which mints its txid and lands where predicted', async () => {
    const { signer, provider } = await fundedSigner(5, 0xb2);
    const base = Number(await signer.getNonce());
    const predicted = predictCreateAddress(signer.getAddress(), base);

    const lookahead = createLookaheadForAddress(signer.getAddress())!;
    const reserved = lookahead.getFundingUtxo(base);
    const fundingUtxo = takeReservedGenesisFunding(signer);
    expect(fundingUtxo).toStrictEqual(reserved);
    // The coin is spent by the deployment, and a second take cannot hand it out again.
    expect(takeReservedGenesisFunding(signer)).toBeUndefined();

    const { categoryId } = await StatefulContract.deploy(artifact, [5n], {
      provider,
      fundingUtxo: fundingUtxo!,
      funder: signer.unlockP2PKH(),
      changeAddress: signer.getAddress(),
    });

    expect(categoryId).toBe(reserved.txid);
    const deployedAddress = deployMaster(
      artifact, new Uint8Array(hexToBin(categoryId)), VALIDATOR_PROGRAM,
    ).address;
    expect([...deployedAddress]).toStrictEqual([...predicted]);
    expect([...predicted]).toStrictEqual(
      [...validatorAddress(new Uint8Array(hexToBin(categoryId)), VALIDATOR_PROGRAM)],
    );
  });

  it('predicts what a short pool holds and refuses the nonce beyond it', async () => {
    const { signer } = await fundedSigner(1, 0xb3);
    const base = Number(await signer.getNonce());
    const address = signer.getAddress();

    expect(createLookaheadForAddress(address)!.getReservedCount()).toBe(1);
    expect(() => predictCreateAddress(address, base)).not.toThrow();
    expect(() => predictCreateAddress(address, base + 1)).toThrow(CreateAddressError);
    expect(() => predictCreateAddress(address, base + 1)).toThrow(/contract-creation\.md/);
  });

  it('refuses to predict for an account with no session', () => {
    const signer = new Signer(new Uint8Array(32).fill(0xb4), new MockNetworkProvider());
    expect(() => predictCreateAddress(signer.getAddress(), 0)).toThrow(CreateAddressError);
  });

  it('answers an open session with the reserved address and everything else with the legacy address', async () => {
    const { signer } = await fundedSigner(5, 0xb5);
    await signer.getNonce();
    const address = signer.getAddress();

    expect(getCreateAddress({ from: address, nonce: 0 })).toBe(binToHex(predictCreateAddress(address, 0)));

    const bare = new Signer(new Uint8Array(32).fill(0xb6), new MockNetworkProvider());
    expect(getCreateAddress({ from: bare.getAddress(), nonce: 0 }))
      .toBe(deriveLogicalCreateAddress(bare.getAddress(), 0));
  });
});
