import { describe, expect, it } from 'vitest';
import { binToHex, decodeTransactionUnsafe, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { sha256, type Artifact } from '@solidcash/utils';
import { compileStringMulti } from '@solidcash/solidc';
import { Contract, type Utxo } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import * as messageBus from '../../src/message-bus/index.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import type { TransactionBuilder } from '../../src/TransactionBuilder.js';
import { validateOutput } from '../../src/utils.js';
import {
  createBareP2pkhFeeFunder, setupStatefulUtxos,
} from '../test-util.js';

/**
 * MERGE-1 route layout (docs/security/security-audit-2026-10-16.md): the consumed-master tail keeps a tokenless output slot
 * at the same index as its input, but its satoshis are pinned to the survivor. A zero-sat output is below the relay
 * dust floor and BCHN relays at most one OP_RETURN output, so each slot is a dust-paying output funded from the
 * fee tail's change. The standard-policy provider (`MockNetworkProvider` defaults to `enforceDust: false`) checks
 * both the dust floor and the relay layout.
 *
 * The second case is adversarial: it redirects the consumed masters' value or surplus fungible amount to the
 * change output and expects the route's mode-2 conservation check to refuse it.
 */
const KERNEL = {
  forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000,
} as const;

const SOURCE = `
  interface IThreads {
    function combine(bytes32 tag, int count);
  }
  contract Coordinator(address threads) {
    function run(bytes32 tag, int count) public {
      IThreads(threads).combine(tag, count);
      require(count > 0);
    }
  }
  contract Threads() {
    function combine(bytes32 tag, int count) public merge(count) {
      require(true);
    }
  }
`;

interface MergeLayout {
  readonly provider: MockNetworkProvider;
  readonly builder: TransactionBuilder;
  readonly category: string;
  readonly survivorIndex: number;
  readonly survivorSatoshis: bigint;
  readonly survivorFt: bigint;
  readonly consumedIndices: readonly number[];
  readonly consumedValue: bigint;
  readonly consumedFt: bigint;
}

async function composeMerge(): Promise<MergeLayout> {
  const provider = new MockNetworkProvider({ policy: { enforceDust: true } });
  expect(provider.policy?.enforceDust).toBe(true);
  const artifacts = compileStringMulti(SOURCE, KERNEL);

  const connect = async (
    artifact: Artifact, args: readonly unknown[] = [],
  ): Promise<{ contract: StatefulContract; category: string }> => {
    const base = new Contract(artifact, args as never[], { provider });
    const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
    return {
      contract: StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId),
      category: setup.categoryId,
    };
  };
  const threads = await connect(artifacts.Threads);
  const coordinator = await connect(artifacts.Coordinator, [
    hexToBin(threads.contract.inner.lockingBytecode),
  ]);
  const consumed = (ordinal: number, amount: bigint): Utxo => ({
    txid: ordinal.toString(16).padStart(64, '0'), vout: ordinal, satoshis: 2_000n + BigInt(ordinal),
    token: {
      category: threads.category, amount,
      nft: { capability: 'minting', commitment: ordinal.toString(16).padStart(2, '0') },
    },
  });
  const inputs = [consumed(17, 3n), consumed(18, 5n)];
  for (const input of inputs) await provider.addUtxo(threads.contract.inner.tokenAddress, input);
  const tag = sha256(new TextEncoder().encode('merge'));
  const fee = await createBareP2pkhFeeFunder(provider, 500_000n);

  const builder = await messageBus.compose({
    preparedCalls: [
      { contract: coordinator.contract, functionName: 'run', args: [tag, 2n] },
      { contract: threads.contract, functionName: 'combine', args: [tag, 2n] },
    ],
    funder: fee,
    changeAddress: fee.unlocker.generateLockingBytecode(),
    // Headroom above 1 sat/byte so a forged transaction that adds a token prefix to change still clears the relay
    // floor and the covenant, not the mempool, is what refuses it.
    feeRate: 10,
    lifecycleMerges: [{ invocationIndex: 1, consumedMasters: inputs }],
  }).build();

  const minting = builder.inputs
    .map((input, index) => ({ input, index }))
    .filter(({ input }) => input.token?.category === threads.category
      && input.token.nft?.capability === 'minting');
  expect(minting.length).toBe(inputs.length + 1);
  const [survivor, ...tails] = minting;
  return {
    provider,
    builder,
    category: threads.category,
    survivorIndex: survivor!.index,
    survivorSatoshis: survivor!.input.satoshis,
    survivorFt: survivor!.input.token?.amount ?? 0n,
    consumedIndices: tails.map((tail) => tail.index),
    consumedValue: tails.reduce((sum, tail) => sum + tail.input.satoshis, 0n),
    consumedFt: tails.reduce((sum, tail) => sum + (tail.input.token?.amount ?? 0n), 0n),
  };
}

describe('MERGE-1 route layout under standard dust policy', () => {
  it('composes and relays an honest merge with standard dust-paying tail slots', async () => {
    const merge = await composeMerge();
    // No more than one OP_RETURN (BCHN's multi-op-return policy) and every output clears the dust floor.
    const opReturns = merge.builder.outputs.filter((output) =>
      typeof output.to !== 'string' && output.to[0] === 0x6a);
    expect(opReturns.length).toBeLessThanOrEqual(1);
    for (const output of merge.builder.outputs) {
      expect(() => validateOutput(output, true)).not.toThrow();
    }
    // The survivor carries its own value plus every consumed master's.
    const transaction = decodeTransactionUnsafe(hexToBin(merge.builder.build()));
    expect(transaction.outputs[merge.survivorIndex]!.valueSatoshis)
      .toBe(merge.survivorSatoshis + merge.consumedValue);
    expect(transaction.outputs[merge.survivorIndex]!.token?.amount)
      .toBe(merge.survivorFt + merge.consumedFt);

    await expect(merge.provider.sendRawTransaction(merge.builder.build()))
      .resolves.toMatch(/^[0-9a-f]{64}$/);
  }, 300_000);

  it('refuses a routed merge that redirects consumed value or surplus FT to change', async () => {
    const merge = await composeMerge();
    const honestHex = merge.builder.build();
    const honest = decodeTransactionUnsafe(hexToBin(honestHex)) as ReturnType<typeof decodeTransactionUnsafe>;
    const changeIndex = honest.outputs.length - 1;

    // Redirect the consumed masters' satoshis to change while the survivor keeps only its own value.
    const valueRedirect = decodeTransactionUnsafe(hexToBin(honestHex)) as ReturnType<typeof decodeTransactionUnsafe>;
    valueRedirect.outputs[merge.survivorIndex]!.valueSatoshis = merge.survivorSatoshis;
    valueRedirect.outputs[changeIndex]!.valueSatoshis += merge.consumedValue;
    const valueOutcome = await merge.provider.sendRawTransaction(
      binToHex(encodeTransaction(valueRedirect)),
    ).then(() => 'ACCEPTED').catch((error: Error) => error.message);
    expect(valueOutcome).toContain('mandatory-script-verify-flag-failed');

    // Redirect the surplus fungible amount to change while the survivor keeps only its own FT.
    const ftRedirect = decodeTransactionUnsafe(hexToBin(honestHex)) as ReturnType<typeof decodeTransactionUnsafe>;
    ftRedirect.outputs[merge.survivorIndex]!.token!.amount = merge.survivorFt;
    ftRedirect.outputs[changeIndex]!.token = {
      category: hexToBin(merge.category),
      amount: merge.consumedFt,
    };
    const ftOutcome = await merge.provider.sendRawTransaction(
      binToHex(encodeTransaction(ftRedirect)),
    ).then(() => 'ACCEPTED').catch((error: Error) => error.message);
    expect(ftOutcome).toContain('mandatory-script-verify-flag-failed');

    // The untouched composition still settles.
    await expect(merge.provider.sendRawTransaction(honestHex)).resolves.toMatch(/^[0-9a-f]{64}$/);
  }, 300_000);
});
