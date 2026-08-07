import { describe, expect, it, vi } from 'vitest';
import { compileString } from '../direct-compile.js';
import { decodeTransactionUnsafe, hexToBin } from '@bitauth/libauth';
import { OpcodesBch2026 as Op } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-opcodes.js';
import { StatefulContract } from '../../src/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { createTestProvider, getSigners } from '../test-util.js';

/**
 * X57 measurement, not a fix: what did the dropped observer actually cost on a live network?
 *
 * Every in-tree caller that passes an observer first checks
 * `(provider.consensusLimits?.maximumInputBytes ?? 10_000) > 10_000` - the same condition that decided whether
 * the factory took its early return. A provider that publishes no limits therefore never asks for an observer;
 * derivation falls through to the full `vm.debug()` trace instead. The dropped observer did not break live
 * state derivation, it was masked. This file measures that instead of asserting it from reading.
 *
 * Runs on whichever provider `createTestProvider()` selects, so `yarn test:regtest` executes it against a real
 * BCHN node - the live, limits-less arm.
 */

const { factoryCalls } = vi.hoisted(() => ({
  factoryCalls: [] as Array<{ hasLimits: boolean; hasObserver: boolean }>,
}));

vi.mock('../../src/network/createVirtualMachine.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/network/createVirtualMachine.js')>();
  type Args = Parameters<typeof actual.createVirtualMachineBch2026ForProvider>;
  return {
    ...actual,
    createVirtualMachineBch2026ForProvider: (provider?: Args[0], observer?: Args[1], options?: Args[2]) => {
      factoryCalls.push({
        hasLimits: provider?.consensusLimits !== undefined,
        hasObserver: observer !== undefined,
      });
      return actual.createVirtualMachineBch2026ForProvider(provider, observer, options);
    },
  };
});

const SRC = `pragma solidcash >=0.8.0;
contract Counter() {
  bigint n;
  mapping(bigint => bigint) seen;
  function bump(bigint k) { this.n = this.n + 1; this.seen[k] = this.n; }
  function count() view returns (bigint) { return this.n; }
}`;

describe('X57 consequence measurement: the dropped observer was masked', () => {
  it('derives state correctly, and only asks for an observer when the provider publishes relaxed limits', async () => {
    const artifact = compileString(SRC, { forceStateful: true });
    const provider = createTestProvider();
    const [alice] = await getSigners(1, { provider, fundingUtxos: 2 });
    // Deploy needs vout 0 (the funding txid becomes the token category). On regtest the address accumulates
    // UTXOs across runs, so filtering on vout is required rather than taking the first untokened one.
    const funding = (await alice.getUtxos()).find((utxo) => utxo.vout === 0 && !utxo.token);

    const deployed = await StatefulContract.deploy(artifact, [], {
      provider,
      fundingUtxo: funding,
      funder: alice.unlockP2PKH(),
      changeAddress: alice.getAddress(),
      initialState: {},
    });

    factoryCalls.length = 0;
    const contract = deployed.contract.connect(alice) as unknown as {
      bump: (k: bigint) => Promise<{ txid: string }>;
      count: () => Promise<bigint>;
    };
    const bumped = await contract.bump(1n);
    await contract.bump(2n);

    // THE consequence: auto-derivation is correct either way. On a limits-less (live) provider it reaches this
    // answer through the full vm.debug() trace rather than through the observer.
    expect(await contract.count()).toBe(2n);

    const observerRequests = factoryCalls.filter((call) => call.hasObserver).length;
    expect(factoryCalls.length).toBeGreaterThan(0);

    // The gate the callers use is exactly the one the factory used, so the two agree by construction:
    // relaxed limits => sparse observer probe requested; no limits (every live provider) => never requested,
    // which is why the silently dropped observer never showed up as a derivation failure.
    const relaxed = (provider.consensusLimits?.maximumInputBytes ?? 10_000) > 10_000;
    if (relaxed) {
      expect(observerRequests).toBeGreaterThan(0);
    } else {
      expect(provider.consensusLimits).toBeUndefined();
      expect(observerRequests).toBe(0);
    }

    // X57 POSITIVE CONTROL on the connected provider, over a transaction this test really broadcast and then
    // read back from the node. Under TESTS_USE_REGTEST this provider is a live BCHN client with no
    // consensusLimits, which is precisely the case the early return used to discard the observer for.
    const raw = await provider.getRawTransaction(bumped.txid);
    const transaction = decodeTransactionUnsafe(hexToBin(raw));
    const seen: number[] = [];
    const spendable = { lockingBytecode: Uint8Array.of(Op.OP_EQUALVERIFY, Op.OP_1), valueSatoshis: 10_000n };
    const vm = createVirtualMachineBch2026ForProvider(provider, {
      opcodes: new Set([Op.OP_EQUALVERIFY]),
      beforeOperation: (state) => {
        const executing = state as { ip: number; instructions: Array<{ opcode: number }> };
        seen.push(executing.instructions[executing.ip]?.opcode ?? -1);
      },
    });
    vm.evaluate({
      inputIndex: 0,
      // Real broadcast transaction; only the source output's script is synthesised so the observed opcode is
      // deterministic. The provider - the variable X57 is about - is the live one.
      sourceOutputs: transaction.inputs.map(() => spendable),
      transaction: { ...transaction, inputs: transaction.inputs.map((input, index) => (index === 0
        ? { ...input, unlockingBytecode: Uint8Array.of(Op.OP_1, Op.OP_1) }
        : input)) },
    } as never);
    expect(seen).toEqual([Op.OP_EQUALVERIFY]);
  });
});
