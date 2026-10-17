/* eslint-disable max-len */
import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeTransactionUnsafe, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { Contract, SignatureTemplate } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createTestProvider, expectScriptRejection, setupStatefulUtxos } from '../test-util.js';
import { alicePriv, alicePub } from '../fixture/vars.js';

/**
 * DX-6 / DS-3 iterating-entry shape: a function with an in-loop entry slot (or a collection iteration) used to
 * skip `emitPreserveOutsideLayoutOwnMutable`, so an own-category mutable NFT co-spent past the block could be
 * dropped or re-emitted at the same lock with a different commitment. The walk now runs for those shapes and
 * admits only records at the contract's mintable locks (data, entry, chunk); any other own-category mutable
 * input past the block is preserved 1:1. This test forges a recommit at a NON-mintable lock and expects the
 * master to refuse it.
 */

const SOURCE = `contract C() {
  mapping(int => int) m;
  int untouched;
  function fill(int[] ks, int[] vs, pubkey pk, sig s) {
    require(checkSig(s, pk));
    for (int i = 0; i < ks.length; i++) { m[ks[i]] = vs[i]; }
  }
  function setUntouched(int v) { this.untouched = v; }
}`;

type Provider = ReturnType<typeof createTestProvider>;

// A P2SH32 whose redeem script is OP_TRUE (the same fixture the collection-census audit uses). It is NOT one of
// the contract's mintable locks, so the outside-layout walk must pin it.
const FORGE_LOCK = 'aa20953ccfa596a6c6d39e5980194539124fdcff116a571455a212baed811f585ee087';

interface Deployed { provider: Provider; sc: StatefulContract<any>; cat: string }

async function deploy(): Promise<Deployed> {
  const provider = createTestProvider();
  const artifact = compileString(SOURCE, { forceStateful: true });
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout, { untouched: 0n }, { saltContract: true },
  );
  return { provider, sc: StatefulContract.withCategory(contract, categoryId), cat: categoryId };
}

async function capture(provider: Provider, run: () => Promise<unknown>): Promise<string> {
  let captured = '';
  const send = provider.sendRawTransaction.bind(provider);
  (provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
    captured = hex;
    throw new Error('capture-only');
  };
  await expect(run()).rejects.toThrow('capture-only');
  (provider as any).sendRawTransaction = send;
  expect(captured).not.toBe('');
  return captured;
}

/**
 * Appends an own-category mutable NFT input at `FORGE_LOCK` and re-emits it at the same lock with a DIFFERENT
 * commitment. The fee output stays last, so the forged input/output share one index.
 */
async function recommit(
  provider: Provider, cat: string, hex: string,
): Promise<string> {
  const tx = decodeTransactionUnsafe(hexToBin(hex));
  let nonce = 0x9000;
  const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(64, '0'); };
  const forgedTxid = uid();
  const funderTxid = uid();
  await provider.addUtxo(FORGE_LOCK, {
    txid: forgedTxid, vout: 0, satoshis: 3000n,
    token: { category: cat, amount: 0n, nft: { capability: 'mutable', commitment: 'aa'.repeat(32) } },
  } as any);
  await provider.addUtxo(FORGE_LOCK, { txid: funderTxid, vout: 0, satoshis: 50000n } as any);

  const feeInput = tx.inputs.pop()!;
  tx.inputs.push({
    outpointTransactionHash: hexToBin(forgedTxid), outpointIndex: 0, sequenceNumber: 0xffffffff,
    unlockingBytecode: Uint8Array.from([0x01, 0x51]),
  });
  tx.inputs.push({
    outpointTransactionHash: hexToBin(funderTxid), outpointIndex: 0, sequenceNumber: 0xffffffff,
    unlockingBytecode: Uint8Array.from([0x01, 0x51]),
  });
  tx.inputs.push(feeInput);

  const feeOutput = tx.outputs.pop()!;
  tx.outputs.push({
    lockingBytecode: hexToBin(FORGE_LOCK), valueSatoshis: 3000n,
    token: { amount: 0n, category: hexToBin(cat),
      nft: { capability: 'mutable', commitment: 'bb'.repeat(32) } },
  } as any);
  tx.outputs.push({ lockingBytecode: hexToBin(FORGE_LOCK), valueSatoshis: 40000n } as any);
  tx.outputs.push(feeOutput);

  return binToHex(encodeTransaction(tx as any));
}

describe('iterating-entry outside-layout walk (DX-6/DS-3)', () => {
  it('refuses a re-emitted own-category mutable NFT at a non-mintable lock, then settles honestly', async () => {
    const { provider, sc, cat } = await deploy();
    await sc.fill([5n], [10n], alicePub, new SignatureTemplate(alicePriv)).send();
    await sc.setUntouched(7n).send();

    const hex = await capture(provider, () => sc.fill([5n], [11n], alicePub, new SignatureTemplate(alicePriv)).send());
    const forged = await recommit(provider, cat, hex);

    const outcome = await provider.sendRawTransaction(forged)
      .then(() => 'ACCEPTED').catch((e: Error) => e.message);
    expectScriptRejection(outcome, 0);

    await expect(provider.sendRawTransaction(hex)).resolves.toBeTypeOf('string');
  }, 300_000);
});
