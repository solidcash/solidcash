import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';
import { isContractUnlocker } from '../../src/interfaces.js';
import { setupStatefulUtxos } from '../test-util.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

const KERNEL = {
  forceStateful: true, messageBus: true, messageBusKernel: true,
  maximumInputBytes: 1_000_000, suppressWarnings: true,
} as const;

describe('kernel distinct fixed-entry rows', () => {
  it.each([0n, 4n])('preserves distinct recipients, repeated recipients, and self transfers (%s)', async (first) => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifact = compileString(`contract Ledger() {
      mapping(int => int) public balances;
      function credit(int key, int amount) public {
        this.balances[key] = this.balances[key] + amount;
        require(true);
      }
      function move(int from, int to, int amount) public {
        require(this.balances[from] >= amount);
        this.balances[from] = this.balances[from] - amount;
        this.balances[to] = this.balances[to] + amount;
        require(true);
      }
      function check(int key, int expected) public { require(this.balances[key] == expected); }
    }`, KERNEL);
    expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(artifact.messageBus?.route.inputs.some((input) => /_r\d+$/.test(input.name))).toBe(false);
    const inner = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(provider, inner, artifact.stateLayout!, {}, { saltContract: true });
    const ledger = StatefulContract.withCategory(inner, setup.categoryId);
    await ledger.call.credit(10n, 100n).send();
    const call = ledger.batch([
      { function: 'move', args: [10n, first, 10n] },
      { function: 'move', args: [10n, 1n, 20n] },
      { function: 'move', args: [10n, 2n, 30n] },
      { function: 'move', args: [10n, first, 5n] },
      { function: 'move', args: [first, 10n, 3n] },
      { function: 'move', args: [10n, 10n, 7n] },
    ]);
    const builder = await call.build();
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const failures = [];
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      const state = vm.evaluate({ inputIndex, transaction, sourceOutputs });
      if (vm.stateSuccess(state) !== true) failures.push({ inputIndex, error: state.error, ip: state.ip,
        nearby: state.instructions.slice(Math.max(0, state.ip - 6), state.ip + 2),
        stack: state.stack.slice(-5).map(binToHex) });
    }
    expect(failures).toEqual([]);
    const original = builder.inputs[0].unlocker;
    if (!isContractUnlocker(original)) throw new Error('Missing ledger route unlocker');
    const pool = artifact.messageBus!.handlers.find((handler) => handler.name === 'move')!
      .batchKeyWitnesses!.find((binding) => binding.keyPool)!.keyPool!;
    const laneIndex = original.abiFunction.inputs.findIndex((input) => input.name === pool[1]);
    const argument = (name: string): unknown => original.params[original.abiFunction.inputs.findIndex((input) =>
      input.name === name)];
    // Key 4's sorted predecessor is the existing sender (10), so its unused aliases must inherit the sender's
    // physical proof offset. The first recipient's own fixed input is a funding pad, not an entry proof.
    if (first === 4n) {
      expect(argument('__internal__vmapBatchProof_1')).toBe(argument('__internal__vmapBatchProof_0'));
      expect(argument('__internal__vmapBatchProof_5')).toBe(argument('__internal__vmapBatchProof_0'));
    }
    const recreate = original.contract.createCompilerRouteUnlocker(
      original.abiFunction, hexToBin(artifact.messageBus!.route.selector!),
    );
    for (const foreignKey of [99n, first]) {
      const params = [...original.params];
      params[laneIndex] = foreignKey;
      builder.inputs[0].unlocker = recreate(...params);
      expect(vm.stateSuccess(vm.evaluate({ inputIndex: 0, sourceOutputs,
        transaction: builder.buildLibauthTransaction() }))).not.toBe(true);
    }
    builder.inputs[0].unlocker = original;
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/u) });
    for (const [key, expected] of [[10n, 38n], [first, 12n], [1n, 20n], [2n, 30n]]) {
      await expect(ledger.call.check(key, expected).send()).resolves.toBeDefined();
    }
    await expect(ledger.batch([{ function: 'move', args: [10n, 10n, 200n] }]).send()).rejects.toThrow();
  }, 180_000);
});
