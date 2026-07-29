import { describe, expect, it } from 'vitest';
import { binToHex, encodeTransactionBch, hexToBin } from '@bitauth/libauth';
import { OpcodesBch2026 as Op } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-opcodes.js';
import { MockNetworkProvider } from '../src/index.js';
import type { ConsensusLimits, NetworkPolicy } from '../src/network/NetworkProvider.js';

/**
 * X58: MockNetworkProvider forwarded only `hashDigestIterationsPerByteNonstandard` to the mem-cash verifier,
 * so a profile's standard-regime allowance never reached libauth. mem-cash builds its primary VM with
 * `standard = policy.enforceDust`, so a dust-enforcing mock ran under libauth's real 0.5/byte standard
 * allowance however relaxed its own profile claimed to be.
 *
 * Measured shape of these fixtures: a 1-byte unlocking script gives a density control length of 42 bytes, so
 * the real standard allowance is 42 * 0.5 = 21 iterations. Each OP_HASH256 costs 2, so 10 hashes were accepted
 * and 11 were not - against a profile declaring 10,000,000 iterations per byte.
 */

const PARENT_TXID = 'ee'.repeat(32);

/** Spend one UTXO through `hashCount` OP_HASH256 operations. Two outputs keep the tx over the 65-byte floor. */
async function buildHashingTx(provider: MockNetworkProvider, hashCount: number): Promise<string> {
  const locking = Uint8Array.from([...Array.from({ length: hashCount }, () => Op.OP_HASH256), Op.OP_DROP, Op.OP_1]);
  await provider.addUtxo(binToHex(locking), { txid: PARENT_TXID, vout: 0, satoshis: 100_000n });
  return binToHex(encodeTransactionBch({
    version: 2,
    inputs: [{
      outpointTransactionHash: hexToBin(PARENT_TXID), outpointIndex: 0,
      sequenceNumber: 0xffffffff, unlockingBytecode: Uint8Array.of(Op.OP_1),
    }],
    outputs: [
      { lockingBytecode: Uint8Array.of(Op.OP_1), valueSatoshis: 60_000n },
      { lockingBytecode: Uint8Array.of(Op.OP_1), valueSatoshis: 30_000n },
    ],
    locktime: 0,
  }));
}

function makeProvider(limits: Partial<ConsensusLimits>, policy: Partial<NetworkPolicy>): MockNetworkProvider {
  return new MockNetworkProvider({ consensusLimits: limits, policy });
}

/** Broadcast `hashCount` OP_HASH256 operations, reporting acceptance and any rejection reason. */
async function sendHashing(
  limits: Partial<ConsensusLimits>, policy: Partial<NetworkPolicy>, hashCount: number,
): Promise<{ ok: boolean; reason: string }> {
  const provider = makeProvider(limits, policy);
  const raw = await buildHashingTx(provider, hashCount);
  try {
    await provider.sendRawTransaction(raw);
    return { ok: true, reason: '' };
  } catch (error) {
    return { ok: false, reason: (error as Error).message };
  }
}

const RELAXED = { hashDigestIterationsPerByte: 10_000_000 };

describe('X58 mock hash-regime plumbing reaches mem-cash', () => {
  // POSITIVE CONTROL. Dust enforcement selects mem-cash's standard VM, which reads the standard allowance.
  // Before the fix that stayed at 0.5/byte: "Maximum hash digest iterations: 21 (density control length: 42)".
  it('honours the relaxed standard allowance when dust enforcement selects the standard VM', async () => {
    const result = await sendHashing(RELAXED, { enforceDust: true }, 60);
    expect(result.reason).not.toMatch(/hash digest iterations/);
    expect(result.ok).toBe(true);
  });

  // The measured pre-fix boundary, now well inside the profile's budget.
  it('accepts hashing on both sides of the old 0.5/byte standard boundary', async () => {
    expect((await sendHashing(RELAXED, { enforceDust: true }, 10)).ok).toBe(true);
    expect((await sendHashing(RELAXED, { enforceDust: true }, 11)).ok).toBe(true);
  });

  // GUARD (negative control): with dust off, mem-cash runs the NONSTANDARD VM, which the single pre-existing
  // write already covered. Green here credits nothing to the fix; it only shows the fix broke nothing.
  it('still passes with dust disabled, where the nonstandard write already applied', async () => {
    expect((await sendHashing(RELAXED, { enforceDust: false }, 200)).ok).toBe(true);
  });

  // The regimes must be independently selectable, and the policy flag must pick the right one. Standard is set
  // high and nonstandard low, so each arm can only pass or fail for one reason.
  it('applies the standard field under dust enforcement and the nonstandard field without it', async () => {
    const split = {
      hashDigestIterationsPerByte: 1,
      hashDigestIterationsPerByteStandard: 10_000_000,
      hashDigestIterationsPerByteNonstandard: 1,
    };
    // Standard VM reads the high field: accepted. (Before the fix the field was dropped, leaving 0.5/byte.)
    expect((await sendHashing(split, { enforceDust: true }, 60)).ok).toBe(true);
    // Nonstandard VM reads the low field: 42 * 1 = 42 iterations, and 60 hashes cost 120.
    const consensusArm = await sendHashing(split, { enforceDust: false }, 60);
    expect(consensusArm.ok).toBe(false);
    expect(consensusArm.reason).toMatch(/hash digest iterations/);
  });

  // Plumbing pin: the field now reaches mem-cash, which rejects non-integers. The real BCH standard allowance
  // is 0.5, so ORDINARY_LIMITS-shaped profiles are NOT expressible on this provider. Loud, not silent.
  it('surfaces mem-cash\'s integer constraint instead of dropping the value', () => {
    expect(() => makeProvider({ hashDigestIterationsPerByteStandard: 0.5 }, {}))
      .toThrow(/hashDigestIterationsPerByteStandard must be a positive safe integer/);
    // Pre-existing and unchanged: the shared field has always been forwarded, so it has always had to be an
    // integer. The fix extends an existing constraint rather than introducing a new class of failure.
    expect(() => makeProvider({ hashDigestIterationsPerByte: 3.5 }, {}))
      .toThrow(/must be a positive safe integer/);
  });

  it('leaves the default profile constructible and unchanged', () => {
    const provider = new MockNetworkProvider();
    expect(provider.consensusLimits.hashDigestIterationsPerByte).toBe(10_000_000);
    expect(provider.consensusLimits.hashDigestIterationsPerByteStandard).toBeUndefined();
    expect(provider.consensusLimits.hashDigestIterationsPerByteNonstandard).toBeUndefined();
  });
});
