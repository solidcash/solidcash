import { describe, expect, it } from 'vitest';
import { binToHex, decodeAuthenticationInstructions, decodeTransactionUnsafe,
  encodeTransaction, hexToBin } from '@bitauth/libauth';
import { buildEcrecoverComputeRedeem, ecrecoverComputeLockingBytecode } from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, expectScriptRejection, setupStatefulUtxos } from '../test-util.js';

/**
 * ECR-1 (docs/security/security-audit-2026-10-16.md): a width-0 recovery's B3 reads its running checkpoint from the OUTPUT
 * one before it and only checks that output's commitment. Any input could stand in for the middle covenant M, so a
 * spender chose the checkpoint B3 ladders from and thereby the recovered key. The contract now requires the input
 * before B3 to reveal the M covenant, and the input before that to be this call's own A input.
 *
 * The contract below deliberately does NOT compare the recovered key with a stored owner: the only thing that can
 * refuse the forged transaction is the covenant chain itself, which is what the audit finding is about.
 */
const SIDECAR_CAT = 'ee'.repeat(32);

// The same measured width-0 signature the 3-way test uses (its GLV ladder has no 2-covenant split).
const WIDTH0 = {
  digest: '398eed067d4a815e6ba5220239bf7ebf7b4fcf2c51faee52f0db375644c0aa67',
  v: 27,
  r: 'd94a22918b3e004b321a8d499c70d153be8a3bd7c85591c5709bf8013e8af39c',
  s: '6a8ff1cd7003b7480a579bbd9d5ba68e17a04e0d3842226b6cb651176def9d32',
};

const SOURCE = `
contract AnySigner {
    int count;
    function bump(bytes32 h, int v, bytes32 r, bytes32 s) {
        ecrecoverPubKey(h, v, r, s);
        this.count = this.count + 1;
    }
}`;

const leBytes = (h: string): Uint8Array => hexToBin(h.replace(/^0x/, '')).slice().reverse();

type Provider = ReturnType<typeof createTestProvider>;
type Tx = ReturnType<typeof decodeTransactionUnsafe>;

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

describe('ECR-1: B3 only ladders from a genuine middle covenant', () => {
  it('refuses a width-0 recovery whose B-1 input is not the M covenant, and settles honestly', async () => {
    const artifact = compileString(SOURCE);
    const provider = createTestProvider();
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { count: 0n }, { saltContract: true },
    );
    const salt = hexToBin(categoryId).slice().reverse();
    const sidecarLock = (role: 'A' | 'M' | 'B3'): string =>
      binToHex(ecrecoverComputeLockingBytecode(salt, role));
    for (const role of ['A', 'B', 'M', 'B3'] as const) {
      await provider.addUtxo(sidecarLock(role), {
        ...randomUtxo({ satoshis: 100_000n }),
        token: { category: SIDECAR_CAT, amount: 0n, nft: { capability: 'mutable', commitment: '' } },
      });
    }

    const sc = StatefulContract.withCategory(contract, categoryId);
    const h = leBytes(WIDTH0.digest), r = leBytes(WIDTH0.r), s = leBytes(WIDTH0.s);
    const args = (): [Uint8Array, bigint, Uint8Array, Uint8Array] => [h, BigInt(WIDTH0.v), r, s];

    await sc.bump(...args()).send();
    expect((await sc.getState()).count).toBe(1n);

    // Capture the second honest call, then substitute the M input with an anyone-can-spend input that carries an
    // attacker-chosen mutable NFT. B3's C2 push is rewritten to the same committed value, so the pre-fix check
    // (`hash256(argBlob || shared || C2) == output[B-1].commitment`) still passes and B3 ladders from a checkpoint
    // the attacker chose. Only the M-covenant authentication can refuse it.
    const hex = await capture(provider, () => sc.bump(...args()).send());
    const tx = decodeTransactionUnsafe(hexToBin(hex)) as Tx;
    // A decoded input carries no locking bytecode; the side-car identity is the redeem push it reveals.
    const redeemOf = (input: Tx['inputs'][number]): string => {
      const instructions = decodeAuthenticationInstructions(input.unlockingBytecode);
      return binToHex(instructions[instructions.length - 1]!.data ?? new Uint8Array());
    };
    const mIndex = tx.inputs.findIndex((input) => redeemOf(input) === binToHex(buildEcrecoverComputeRedeem(salt, 'M')));
    const bIndex = tx.inputs.findIndex((input) => redeemOf(input) === binToHex(buildEcrecoverComputeRedeem(salt, 'B3')));
    expect(mIndex).toBeGreaterThanOrEqual(0);
    expect(bIndex).toBeGreaterThan(0);
    expect(bIndex).toBe(mIndex + 1);

    const fake = { ...randomUtxo({ satoshis: 100_000n }), vout: 0 };
    await provider.addUtxo('51', {
      ...fake,
      token: { category: SIDECAR_CAT, amount: 0n, nft: { capability: 'mutable', commitment: '' } },
    });
    const honestMUnlocking = tx.inputs[mIndex]!.unlockingBytecode.slice();
    tx.inputs[mIndex] = {
      outpointTransactionHash: hexToBin(fake.txid),
      outpointIndex: 0,
      sequenceNumber: 0xffffffff,
      unlockingBytecode: new Uint8Array(),
    };
    const outcome = await provider.sendRawTransaction(binToHex(encodeTransaction(tx)))
      .then(() => 'ACCEPTED').catch((error: Error) => error.message);
    expect(outcome).not.toBe('ACCEPTED');
    expectScriptRejection(outcome, 0);
    expect((await sc.getState()).count).toBe(1n);

    // Public-push bypass: the same bare OP_1 lock, but the unlocking publishes the genuine M redeem bytes. The
    // hash of those bytes matches, so only binding the hash to the predecessor's locking script can refuse it.
    tx.inputs[mIndex] = {
      outpointTransactionHash: hexToBin(fake.txid),
      outpointIndex: 0,
      sequenceNumber: 0xffffffff,
      unlockingBytecode: honestMUnlocking,
    };
    const bypassOutcome = await provider.sendRawTransaction(binToHex(encodeTransaction(tx)))
      .then(() => 'ACCEPTED').catch((error: Error) => error.message);
    expect(bypassOutcome).not.toBe('ACCEPTED');
    expectScriptRejection(bypassOutcome, 0);
    expect((await sc.getState()).count).toBe(1n);

    // The honest transaction built on the same outpoint still settles.
    await expect(provider.sendRawTransaction(hex)).resolves.toBeTypeOf('string');
    expect((await sc.getState()).count).toBe(2n);
  }, 300_000);
});
