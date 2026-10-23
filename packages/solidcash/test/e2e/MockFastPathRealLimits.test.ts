/**
 * A mock at the real BCH-2026 size limits evaluates on the SDK's fast VM paths: its `simulator` flag selects them,
 * not a relaxed input size. Those paths still enforce the limits the mock publishes.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  binToHex, encodeDataPush, encodeTransaction, flattenBinArray, hash256, hashTransactionUiOrder, hexToBin,
  type Output,
} from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { getContractFactory } from '../../src/stateful/index.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import type NetworkProvider from '../../src/network/NetworkProvider.js';
import type { PreparedTransaction } from '../../src/network/NetworkProvider.js';
import { usesFastVmPaths } from '../../src/network/createVirtualMachine.js';
import {
  consumePreparedCovenantValidation, rememberPreparedCovenantValidation, type CovenantSourceOutput,
} from '../../src/network/prepared-covenant-receipt.js';
import { framedComposerCounts, resetFramedComposerCounts } from '../../src/framed/composer/counters.js';
import type { Utxo } from '../../src/interfaces.js';
import { randomUtxo } from '../../src/utils.js';

const REAL_LIMITS = { maximumInputBytes: 10_000, maximumStackItemBytes: 10_000, maximumNftCommitmentBytes: 128 };
const realLimitsProvider = (): MockNetworkProvider => new MockNetworkProvider({ consensusLimits: REAL_LIMITS });

const COUNTER = `pragma solidcash ^0.14.0;
contract C() {
  bigint n;
  function set(bigint v) { this.n = v; }
  function chk(bigint e) { require(this.n == e); }
}`;

// P2SH32 of `OP_2DROP OP_1`: any two pushes before the redeem script unlock it.
const REDEEM = Uint8Array.of(0x6d, 0x51);
const LOCK = Uint8Array.of(0xaa, 0x20, ...hash256(REDEEM), 0x87);
const CATEGORY = 'ee'.repeat(31) + '11';

async function fund(provider: MockNetworkProvider, withNft = false): Promise<Utxo> {
  const token = { category: CATEGORY, amount: 0n, nft: { capability: 'mutable' as const, commitment: '' } };
  const utxo: Utxo = { ...randomUtxo({ satoshis: 1_000_000n }), ...(withNft ? { token } : {}) };
  await provider.addUtxo(binToHex(LOCK), utxo);
  return utxo;
}

/** A spend of `utxo` to one output, in the prepared form an SDK builder hands to the provider. */
function prepare(utxo: Utxo, pushes: readonly Uint8Array[], token?: Output['token']): PreparedTransaction {
  const transaction = {
    version: 2,
    inputs: [{
      outpointTransactionHash: hexToBin(utxo.txid),
      outpointIndex: utxo.vout,
      sequenceNumber: 0xffffffff,
      unlockingBytecode: flattenBinArray([...pushes, REDEEM].map((item) => encodeDataPush(item))),
    }],
    outputs: [{ lockingBytecode: LOCK, valueSatoshis: utxo.satoshis - 100_000n, ...(token ? { token } : {}) }],
    locktime: 0,
  };
  const rawBytes = encodeTransaction(transaction);
  return { rawHex: binToHex(rawBytes), rawBytes, transaction };
}

const nft = (length: number): Output['token'] => ({
  category: hexToBin(CATEGORY),
  amount: 0n,
  nft: { capability: 'mutable', commitment: new Uint8Array(length).fill(7) },
});

describe('a mock at the real BCH-2026 limits', () => {
  const previousCounts = process.env.SOLIDC_DEBUG_FRAMED_COUNTS;
  beforeAll(() => { process.env.SOLIDC_DEBUG_FRAMED_COUNTS = '1'; });
  afterAll(() => {
    if (previousCounts === undefined) delete process.env.SOLIDC_DEBUG_FRAMED_COUNTS;
    else process.env.SOLIDC_DEBUG_FRAMED_COUNTS = previousCounts;
  });

  it('settles a stateful spend on the fast VM paths', async () => {
    const provider = realLimitsProvider();
    expect(provider.simulator).toBe(true);
    expect(usesFastVmPaths(provider)).toBe(true);
    // The same limits without the flag are a live profile, which keeps libauth's paths.
    expect(usesFastVmPaths({ consensusLimits: provider.consensusLimits } as unknown as NetworkProvider)).toBe(false);
    const [signer] = await provider.getSigners(1, { fundingUtxos: 1, satoshis: 1_000_000n });
    const sc = await getContractFactory(compileString(COUNTER, { forceStateful: true }), signer).deploy() as any;
    resetFramedComposerCounts();
    await expect(sc.set(7n)).resolves.toBeDefined();
    expect(framedComposerCounts().phaseRuns).toBeGreaterThan(0);
    await expect(sc.chk(7n)).resolves.toBeDefined();
    await expect(sc.chk(8n)).rejects.toThrow();
  });

  it('refuses an unlocking bytecode over 10,000 bytes', async () => {
    const provider = realLimitsProvider();
    // Each push is under the 10,000-byte stack item limit, so only the input size can refuse the second spend.
    const under = prepare(await fund(provider), [new Uint8Array(4_900).fill(1), new Uint8Array(4_900).fill(2)]);
    expect(under.transaction.inputs[0]!.unlockingBytecode.length).toBeLessThanOrEqual(10_000);
    await expect(provider.sendPreparedTransaction(under)).resolves.toMatch(/^[0-9a-f]{64}$/);
    const over = prepare(await fund(provider), [new Uint8Array(5_100).fill(1), new Uint8Array(5_100).fill(2)]);
    expect(over.transaction.inputs[0]!.unlockingBytecode.length).toBeGreaterThan(10_000);
    resetFramedComposerCounts();
    await expect(provider.sendPreparedTransaction(over)).rejects.toThrow(/exceeds the maximum bytecode length/);
    expect(framedComposerCounts().phaseRuns).toBeGreaterThan(0);
  });

  it('refuses a commitment over 128 bytes, a covenant receipt included', async () => {
    const provider = realLimitsProvider();
    const pushes = [Uint8Array.of(), Uint8Array.of()];
    await expect(provider.sendPreparedTransaction(prepare(await fund(provider, true), pushes, nft(128))))
      .resolves.toMatch(/^[0-9a-f]{64}$/);
    await expect(provider.sendPreparedTransaction(prepare(await fund(provider, true), pushes, nft(129))))
      .rejects.toThrow(/excessive token commitment length/);
    // A receipt vouches for the inputs' evaluation only: the verifier takes it and still applies the token rules.
    const utxo = await fund(provider, true);
    const over = prepare(utxo, pushes, nft(129));
    const sources: CovenantSourceOutput[] = [{ lockingBytecode: LOCK, valueSatoshis: utxo.satoshis, token: nft(0) }];
    rememberPreparedCovenantValidation(provider, over.transaction, sources);
    await expect(provider.sendPreparedTransaction(over)).rejects.toThrow(/excessive token commitment length/);
    const txid = binToHex(hashTransactionUiOrder(over.rawBytes));
    expect(consumePreparedCovenantValidation(provider, over, sources, txid)).toBe(false);
  });
});
