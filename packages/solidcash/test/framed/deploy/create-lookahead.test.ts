import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { validatorAddress } from '@solidcash/utils';
import { compileString } from '../../../../solidc/src/compiler.js';
import { buildValidatorProgram } from '../../../../solidc/src/framed/validator/index.js';
import { COMPOSITION_LIMITS } from '../../../../solidc/test/framed/machine.js';
import { Signer } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { selectGenesisFundingUtxo } from '../../../src/stateful/ContractFactory.js';
import {
  CreateAddressError, CreateLookahead, deployMaster,
} from '../../../src/framed/deploy/index.js';

/**
 * Predicting the address of a contract another contract creates.
 *
 * A `CREATE` frame's child lands at `addrV(category)`, and the category is the txid of the genesis-eligible UTXO
 * the child's own genesis spends. So the deployment side reserves those UTXOs up front and answers with the address
 * the i-th reserved UTXO's category derives. The cases below drive the shipped path: the reservation is the
 * shipped selection, and the deployed child's real address is read back from the category it actually minted.
 */

const VALIDATOR_PROGRAM = buildValidatorProgram();
const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Child {'
  + '   int public total;'
  + '   constructor(int seed) { this.total = seed + 1; }'
  + '   function check(int v) { require(this.total == v); }'
  + ' }';
const artifact = compileString(SOURCE, { composition: 'framed' });

const key = (utxo: { txid: string; vout: number }): string => `${utxo.txid}:${utxo.vout}`;

/** A signer over the relaxed mock, funded with `count` fresh vout-0 token-free UTXOs (each its own txid). */
async function fundedSigner(
  count: number, fill: number,
): Promise<{ signer: Signer; provider: MockNetworkProvider }> {
  const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signer = new Signer(new Uint8Array(32).fill(fill), provider);
  for (let index = 0; index < count; index += 1) {
    await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
  }
  return { signer, provider };
}

describe('predicting a create address from reserved genesis UTXOs', () => {
  it('answers addrV of the i-th reserved UTXO\'s category, without broadcasting anything', async () => {
    const { signer, provider } = await fundedSigner(3, 0xa1);
    const lookahead = CreateLookahead.open({ signer, artifact });
    try {
      await lookahead.reserve(3);
      expect(lookahead.getReservedCount()).toBe(3);
      expect(lookahead.getBaseNonce()).toBe(0);

      for (let i = 0; i < 3; i += 1) {
        const utxo = lookahead.getFundingUtxo(i);
        const expected = validatorAddress(new Uint8Array(hexToBin(utxo.txid)), VALIDATOR_PROGRAM);
        expect([...lookahead.getCreateAddress(i)]).toStrictEqual([...expected]);
      }
      // A prediction is off-chain: no transaction was sent, so the reserved coins are still live.
      expect((await provider.getUtxos(signer.getAddress())).length).toBe(3);
    } finally {
      lookahead.release();
    }
  });

  it('deploys through the shipped path at exactly the predicted address', async () => {
    const { signer, provider } = await fundedSigner(2, 0xa2);
    const lookahead = CreateLookahead.open({ signer, artifact });
    try {
      await lookahead.reserve(2);
      const fundingUtxo = lookahead.getFundingUtxo(1);
      const predicted = lookahead.getCreateAddress(1);

      const { categoryId } = await StatefulContract.deploy(artifact, [5n], {
        provider,
        fundingUtxo,
        funder: signer.unlockP2PKH(),
        changeAddress: signer.getAddress(),
      });

      // The reserved outpoint became the child's category, so its address rule answers the predicted address.
      expect(categoryId).toBe(fundingUtxo.txid);
      const deployedAddress = deployMaster(
        artifact, new Uint8Array(hexToBin(categoryId)), VALIDATOR_PROGRAM,
      ).address;
      expect([...deployedAddress]).toStrictEqual([...predicted]);
      expect([...predicted]).toStrictEqual(
        [...validatorAddress(new Uint8Array(hexToBin(categoryId)), VALIDATOR_PROGRAM)],
      );

      // The address is real: the genesis funded a UTXO there, carrying the category the child minted.
      const atPredicted = await provider.getUtxosForLockingBytecode(predicted);
      expect(atPredicted.some((utxo) => utxo.token?.category?.toLowerCase() === categoryId.toLowerCase()))
        .toBe(true);

      // The genesis spent the reserved outpoint: it is gone from the account.
      const remaining = await provider.getUtxos(signer.getAddress());
      expect(remaining.some((utxo) => key(utxo) === key(fundingUtxo))).toBe(false);
    } finally {
      lookahead.release();
    }
  });

  it('holds reserved UTXOs out of a later genesis funding selection', async () => {
    const { signer } = await fundedSigner(2, 0xa3);
    const lookahead = CreateLookahead.open({ signer, artifact });
    try {
      const reserved = new Set((await lookahead.reserve(2)).map(key));

      // Every coin the account holds is reserved, so a later genesis selection must not take one: it cannot fan
      // out either, because the only coins it could spend are the reserved ones.
      await expect(selectGenesisFundingUtxo(signer, artifact)).rejects.toThrow(/insufficient funds/);

      const after = await signer.getUtxos();
      expect(after.filter((utxo) => reserved.has(key(utxo))).length).toBe(2);
    } finally {
      lookahead.release();
    }
  });

  it('refuses a nonce beyond the reserved creates, naming the reservation and the documentation', async () => {
    const { signer } = await fundedSigner(2, 0xa4);
    const lookahead = CreateLookahead.open({ signer, artifact });
    try {
      await lookahead.reserve(2);

      // One more than was reserved: refused by name, pointing at what a caller must do.
      expect(() => lookahead.getCreateAddress(2)).toThrow(CreateAddressError);
      expect(() => lookahead.getCreateAddress(2)).toThrow(/contract-creation\.md/);
      expect(() => lookahead.getFundingUtxo(2)).toThrow(CreateAddressError);

      const error = (() => {
        try { lookahead.getCreateAddress(2); return undefined; } catch (thrown) { return thrown as Error; }
      })();
      expect(error?.name).toBe('CreateAddressError');
      expect(error?.message).toMatch(/2 genesis-eligible UTXO\(s\) are reserved/);
    } finally {
      lookahead.release();
    }
  });

  it('refuses to predict before anything is reserved', () => {
    const signer = new Signer(new Uint8Array(32).fill(0xa5), new MockNetworkProvider());
    const lookahead = CreateLookahead.open({ signer, artifact });
    expect(() => lookahead.getCreateAddress(0)).toThrow(CreateAddressError);
    expect(() => lookahead.getBaseNonce()).toThrow(CreateAddressError);
  });
});
