import {
  binToHex, decodeAuthenticationInstructions, encodeAuthenticationInstructions,
} from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import type { TransactionBuilder } from '../../../src/TransactionBuilder.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { getDynamicChunkAddress, getEntryNftAddress } from '../../../src/stateful/covenant-helpers.js';
import { addressToLockScript, generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createBareP2pkhFeeFunder, createTestProvider, setupStatefulUtxos } from '../../test-util.js';

const KERNEL = {
  forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000,
} as const;

const SOURCE = `contract IndependentJournals() {
  int[] sequence;
  int[] mirror;
  mapping(int => int) records;

  function initialize() public {
    this.sequence = [int(10), int(20), int(30), int(80)];
    this.mirror = [int(1), int(2), int(3), int(4)];
    require(true);
  }

  function revise(int position, int key, int value) public {
    this.sequence[position] = value;
    this.records[key] = this.sequence[position] + 100;
    this.mirror[position] = this.records[key] + 1000;
    require(true);
  }

  function checkSequence(int position, int expected) public {
    require(this.sequence[position] == expected);
  }

  function checkRecord(int key, int expected) public {
    require(this.records[key] == expected);
  }

  function checkMirror(int position, int expected) public {
    require(this.mirror[position] == expected);
  }
}`;

describe('kernel independently indexed dynamic-array and mapping journals', () => {
  type Setup = {
    provider: ReturnType<typeof createTestProvider>;
    inner: Contract<any, any>;
    categoryId: string;
    contract: StatefulContract<any>;
    call: ReturnType<StatefulContract<any>['batch']>;
    builder: TransactionBuilder;
  };

  const build = async (rows: Array<{ function: string; args: bigint[] }> = [
    { function: 'revise', args: [2n, 5n, 70n] },
    { function: 'revise', args: [0n, 5n, 40n] },
    { function: 'revise', args: [1n, 5n, 60n] },
  ], initializeBeforeBatch = true, entryPoolCapacity?: number): Promise<Setup> => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE, {
      ...KERNEL,
      ...(entryPoolCapacity !== undefined && { messageBusEntryPoolCapacity: entryPoolCapacity }),
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'revise'))
      .toMatchObject({ eligible: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, { sequence: [], mirror: [] }, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    if (initializeBeforeBatch) await contract.initialize().send();
    const call = contract.batch(rows);
    const fee = await createBareP2pkhFeeFunder(provider);
    call.addInput(fee.utxo, fee.unlocker);
    const builder = await call.build();
    // Record covenants bind the master's lock: callers derive record addresses from the pinned master.
    return { provider, inner: contract.inner, categoryId, contract, call, builder };
  };

  const evaluate = (setup: Setup): Array<true | string> => {
    const vm = createVirtualMachineBch2026ForProvider(setup.provider);
    const transaction = setup.builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(setup.builder.inputs);
    return transaction.inputs.map((_input, inputIndex) =>
      vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })));
  };

  it('preserves row order while the array index and mapping key remain independent', async () => {
    const setup = await build();
    expect(evaluate(setup).every((result) => result === true)).toBe(true);
    await expect(setup.call.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    await setup.contract.checkSequence(0n, 40n).send();
    await setup.contract.checkSequence(1n, 60n).send();
    await setup.contract.checkSequence(2n, 70n).send();
    await setup.contract.checkRecord(5n, 160n).send();
    await setup.contract.checkMirror(0n, 1140n).send();
    await setup.contract.checkMirror(1n, 1160n).send();
    await setup.contract.checkMirror(2n, 1170n).send();
  }, 180_000);

  it('keeps two mapping keys separate across interleaved array writes', async () => {
    const setup = await build([
      { function: 'revise', args: [2n, 5n, 70n] },
      { function: 'revise', args: [0n, 6n, 40n] },
      { function: 'revise', args: [1n, 5n, 60n] },
    ]);
    expect(evaluate(setup).every((result) => result === true)).toBe(true);
    await expect(setup.call.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    await setup.contract.checkSequence(0n, 40n).send();
    await setup.contract.checkSequence(1n, 60n).send();
    await setup.contract.checkSequence(2n, 70n).send();
    await setup.contract.checkRecord(5n, 160n).send();
    await setup.contract.checkRecord(6n, 140n).send();
    await setup.contract.checkMirror(0n, 1140n).send();
    await setup.contract.checkMirror(1n, 1160n).send();
    await setup.contract.checkMirror(2n, 1170n).send();
  }, 180_000);

  it('threads an initialization row into later array and mapping writes', async () => {
    const setup = await build([
      { function: 'initialize', args: [] },
      { function: 'revise', args: [2n, 5n, 70n] },
      { function: 'revise', args: [0n, 5n, 40n] },
    ], false);
    expect(evaluate(setup).every((result) => result === true)).toBe(true);
    await expect(setup.call.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    await setup.contract.checkSequence(0n, 40n).send();
    await setup.contract.checkSequence(1n, 20n).send();
    await setup.contract.checkSequence(2n, 70n).send();
    await setup.contract.checkRecord(5n, 140n).send();
    await setup.contract.checkMirror(0n, 1140n).send();
    await setup.contract.checkMirror(1n, 2n).send();
    await setup.contract.checkMirror(2n, 1170n).send();
  }, 180_000);

  it('settles three independent mapping keys beside array writes', async () => {
    const setup = await build([
      { function: 'revise', args: [2n, 5n, 70n] },
      { function: 'revise', args: [0n, 6n, 40n] },
      { function: 'revise', args: [1n, 7n, 60n] },
    ], true, 3);
    expect(evaluate(setup).every((result) => result === true)).toBe(true);
    await expect(setup.call.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    await setup.contract.checkRecord(5n, 170n).send();
    await setup.contract.checkRecord(6n, 140n).send();
    await setup.contract.checkRecord(7n, 160n).send();
    await setup.contract.checkMirror(0n, 1140n).send();
    await setup.contract.checkMirror(1n, 1160n).send();
    await setup.contract.checkMirror(2n, 1170n).send();
  }, 180_000);

  it.each(['dynamic chunk', 'mapping entry'] as const)(
    'rejects a forged %s output on BCH-2026', async (kind) => {
      const setup = await build();
      const address = kind === 'dynamic chunk'
        ? getDynamicChunkAddress(setup.inner, setup.categoryId, 'sequence', 'int256[]')
        : getEntryNftAddress(setup.inner, setup.categoryId, 'records');
      const expectedLock = binToHex(addressToLockScript(address));
      const candidates = setup.builder.outputs.filter((output) =>
        binToHex(typeof output.to === 'string' ? addressToLockScript(output.to) : output.to) === expectedLock
        && output.token?.nft?.capability === 'mutable');
      expect(candidates.length).toBeGreaterThan(0);
      const target = candidates.at(-1)!;
      const commitment = target.token!.nft!.commitment;
      target.token = {
        ...target.token!,
        nft: {
          ...target.token!.nft!,
          commitment: commitment.length === 0
            ? '01' : `${commitment.slice(0, -2)}${commitment.endsWith('00') ? '01' : '00'}`,
        },
      };
      expect(evaluate(setup)[0]).not.toBe(true);
    },
  );

  it('rejects a forged row witness on BCH-2026', async () => {
    const setup = await build();
    const vm = createVirtualMachineBch2026ForProvider(setup.provider);
    const transaction = setup.builder.buildLibauthTransaction();
    const instructions = decodeAuthenticationInstructions(transaction.inputs[0].unlockingBytecode);
    const rowBlob = instructions[0];
    expect(rowBlob && 'data' in rowBlob).toBe(true);
    if (!rowBlob || !('data' in rowBlob)) throw new Error('kernel master has no row-blob witness');
    const forged = rowBlob.data.slice();
    forged[Math.floor(forged.length / 2)] ^= 0x01;
    instructions[0] = { ...rowBlob, data: forged };
    transaction.inputs[0].unlockingBytecode = encodeAuthenticationInstructions(instructions);
    const sourceOutputs = generateLibauthSourceOutputs(setup.builder.inputs);
    expect(vm.stateSuccess(vm.evaluate({ inputIndex: 0, sourceOutputs, transaction }))).not.toBe(true);
  }, 180_000);
});
