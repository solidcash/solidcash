import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { sha256, type Artifact } from '@solidcash/utils';
import { compileStringMulti } from 'solidc';
import { Contract, type Utxo } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import * as messageBus from '../../src/message-bus/index.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../test-util.js';

/**
 * MERGE-1 route SDK (docs/security-audit-2026-10-16.md): the consumed-master tail keeps a tokenless output slot at
 * the same index as its input, but its satoshis are pinned to the survivor. A zero-sat output at the caller's
 * change address is below the relay dust floor, so a standard-policy provider refused to compose or relay the
 * merge. The placeholder is now an OP_RETURN output, which is dust-exempt.
 *
 * This mirrors the kernel merge lifecycle composition under a provider that enforces the standard dust policy
 * (`MockNetworkProvider` defaults to `enforceDust: false`).
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

describe('MERGE-1 route layout under standard dust policy', () => {
  it('composes and relays an honest merge with OP_RETURN tail placeholders', async () => {
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
    // The standard indexer needs each source output; the semantic kernel profile evaluates against builder inputs.
    for (const input of inputs) await provider.addUtxo(threads.contract.inner.tokenAddress, input);
    const tag = sha256(new TextEncoder().encode('merge'));
    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);

    const composed = await messageBus.compose({
      preparedCalls: [
        { contract: coordinator.contract, functionName: 'run', args: [tag, 2n] },
        { contract: threads.contract, functionName: 'combine', args: [tag, 2n] },
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
      lifecycleMerges: [{ invocationIndex: 1, consumedMasters: inputs }],
    }).build();

    // Every zero-value tail slot is an OP_RETURN output, not a dust P2PKH output.
    const zeroValue = composed.outputs.filter((output) => output.amount === 0n);
    expect(zeroValue.length).toBeGreaterThanOrEqual(inputs.length);
    for (const output of zeroValue) {
      const lock = typeof output.to === 'string' ? undefined : output.to;
      expect(lock?.[0]).toBe(0x6a);
    }

    // The finalized-byte gate and the standard-policy indexer both accept the transaction.
    await expect(provider.sendRawTransaction(composed.build())).resolves.toMatch(/^[0-9a-f]{64}$/);
  }, 300_000);
});
