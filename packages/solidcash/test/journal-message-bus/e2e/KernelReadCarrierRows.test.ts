import { binToHex, hexToBin } from '@bitauth/libauth';
import { decodePushdataValue, KERNEL_ENTRY_JOURNAL_RECORD_SEGMENT_PREFIX } from '@solidcash/utils';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import {
  Contract,
  encodeFunctionArgument,
} from '../../../src/index.js';
import {
  StatefulContract,
  getEntryNftAddress,
} from '../../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { decodeKernelEntryJournalAccesses } from '../../../src/stateful/KernelEntryJournal.js';
import { addressToLockScript, generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../../test-util.js';

const SOURCE = `contract RepeatedRowCarrier() {
  mapping(int => int) source;
  mapping(int => int) result;
  function seedSource(int key, int value) public { this.source[key] = value; require(true); }
  function seedResult(int key, int value) public { this.result[key] = value; require(true); }
  function copy(int count) public {
    for (int cursor = 0; cursor < count; cursor = cursor + 1) {
      this.result[cursor] = this.source[cursor];
    }
    require(true);
  }
  function check(int key, int expected) public { require(this.result[key] == expected); }
}`;

const KERNEL = {
  forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000,
} as const;

function entryIndices(
  sourceOutputs: Array<{ lockingBytecode: Uint8Array }>,
  transaction: { outputs: Array<{ lockingBytecode: Uint8Array }> },
  address: string,
): { inputs: number[]; outputs: number[] } {
  const lockingBytecode = binToHex(addressToLockScript(address));
  return {
    inputs: sourceOutputs.flatMap((input, index) =>
      binToHex(input.lockingBytecode) === lockingBytecode ? [index] : []),
    outputs: transaction.outputs.flatMap((output, index) =>
      binToHex(output.lockingBytecode) === lockingBytecode ? [index] : []),
  };
}

describe('kernel repeated clean-read carriers', () => {
  it('shares each physical clean input across copy(2), copy(2) and settles a dense mixed final flush', async () => {
    const artifact = compileString(SOURCE, KERNEL);
    expect(artifact.messageBus?.kernelEntryJournal?.capabilities).toContainEqual(expect.objectContaining({
      kind: 'internal-read-carrier', version: 1,
    }));
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'copy')).toMatchObject({ eligible: true });
    const provider = createTestProvider();
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, inner, artifact.stateLayout!, {}, { saltContract: true });
    const contract = StatefulContract.withCategory(inner, categoryId);
    // Reverse insertion order proves source order and physical entry order are independently authenticated.
    await contract.call.seedSource(1n, 11n).send();
    await contract.call.seedSource(0n, 10n).send();
    await contract.call.seedResult(1n, 0n).send();
    await contract.call.seedResult(0n, 0n).send();
    const call = contract.batch([{ function: 'copy', args: [2n] }, { function: 'copy', args: [2n] }]);
    const builder = await call.build();
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`).toBe(true);
    }

    const sourceSlots = entryIndices(
      sourceOutputs, transaction, getEntryNftAddress(contract.inner, categoryId, 'source'),
    );
    const resultSlots = entryIndices(
      sourceOutputs, transaction, getEntryNftAddress(contract.inner, categoryId, 'result'),
    );
    // Four logical clean reads collapse to two physical source inputs. The two source carriers and two dirty
    // result slots each receive exactly one dense final output: 4 collection inputs and 4 collection outputs.
    expect(sourceSlots.inputs).toHaveLength(2);
    expect(sourceSlots.outputs).toHaveLength(2);
    expect(resultSlots.inputs).toHaveLength(2);
    expect(resultSlots.outputs).toHaveLength(2);
    expect([...sourceSlots.inputs, ...resultSlots.inputs]).toHaveLength(4);
    expect([...sourceSlots.outputs, ...resultSlots.outputs]).toHaveLength(4);

    const routeInput = builder.inputs.findIndex((input) => 'abiFunction' in input.unlocker
      && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    expect(routeInput).toBeGreaterThanOrEqual(0);
    const routeBuilderInput = builder.inputs[routeInput]!;
    if (!('params' in routeBuilderInput.unlocker)) throw new Error('kernel route has no parameterized unlocker');
    const originalUnlocker = routeBuilderInput.unlocker;
    const journalIndex = originalUnlocker.abiFunction.inputs.findIndex((input) => input.name === '__internal__kernelJournalAccessStreams');
    expect(journalIndex).toBeGreaterThanOrEqual(0);
    const rowStreams = originalUnlocker.params[journalIndex] as Uint8Array[][];
    // 0x0511 is route-internal state, never a caller-supplied access-stream byte sequence. The caller-visible
    // proof of reuse is instead the second row's read program: it names the same global record ordinals with no
    // target/predecessor authentication bits. The route alone turns the first authenticated clean records into
    // internal carriers before that later zero-auth consumer executes.
    const cleanReads = rowStreams.map((streams) => streams.flatMap((stream) =>
      decodeKernelEntryJournalAccesses(stream).filter((access) =>
        !access.mutates && access.presentBefore && access.presentAfter)));
    expect(cleanReads).toHaveLength(2);
    expect(cleanReads[0]).toHaveLength(2);
    expect(cleanReads[1]).toHaveLength(2);
    expect(cleanReads[0].every((access) => access.authenticatesTarget)).toBe(true);
    expect(cleanReads[1].every((access) =>
      !access.authenticatesTarget && !access.authenticatesPredecessor)).toBe(true);
    const selector = artifact.messageBus!.route.selector;
    if (!selector) throw new Error('kernel route has no selector');
    const routeFails = (journalStreams: Uint8Array[][]): boolean => {
      const params = [...originalUnlocker.params];
      params[journalIndex] = journalStreams;
      routeBuilderInput.unlocker = originalUnlocker.contract.createCompilerRouteUnlocker(
        originalUnlocker.abiFunction, hexToBin(selector),
      )(...params);
      const hostile = builder.buildLibauthTransaction();
      routeBuilderInput.unlocker = originalUnlocker;
      return vm.stateSuccess(vm.evaluate({ inputIndex: routeInput, sourceOutputs, transaction: hostile })) !== true;
    };
    const duplicatedAuthentication = rowStreams.map((streams) => streams.map((stream) => new Uint8Array(stream)));
    // Access encoding is `tag || count || collectionHash20 || flag || target-u16le || predecessor-u16le`.
    // Re-authenticate one second-row clean target: it would claim a second physical authority over the first row's
    // carrier and must be rejected by the route.
    let reauthenticated = false;
    for (const stream of duplicatedAuthentication[1]) {
      const accesses = decodeKernelEntryJournalAccesses(stream);
      const index = accesses.findIndex((access) => !access.mutates && access.presentBefore
        && !access.authenticatesTarget && !access.authenticatesPredecessor);
      if (index < 0) continue;
      stream[22 + index * 5] |= 0x10;
      reauthenticated = true;
      break;
    }
    expect(reauthenticated).toBe(true);
    expect(routeFails(duplicatedAuthentication)).toBe(true);

    // 0x0511 itself is prohibited at journal-record ingress. Forge it in the record carrier, rather than in the
    // compact access programs above, and require the route input (not an unrelated funding signature) to fail.
    const forgedRecordParams = [...originalUnlocker.params];
    let forgedRecord = false;
    originalUnlocker.abiFunction.inputs.forEach((input, inputIndex) => {
      if (!input.name.startsWith('__internal__kernelJournalRecordSegment_') || forgedRecord) return;
      const segment = new Uint8Array(originalUnlocker.params[inputIndex] as Uint8Array);
      for (let index = 0; index + 1 < segment.length; index += 1) {
        if (segment[index] !== 0x05 || segment[index + 1] !== 0x01) continue;
        segment[index + 1] = 0x11;
        forgedRecordParams[inputIndex] = segment;
        forgedRecord = true;
        break;
      }
    });
    expect(forgedRecord).toBe(true);
    routeBuilderInput.unlocker = originalUnlocker.contract.createCompilerRouteUnlocker(
      originalUnlocker.abiFunction, hexToBin(selector),
    )(...forgedRecordParams);
    const forgedRecordTransaction = builder.buildLibauthTransaction();
    routeBuilderInput.unlocker = originalUnlocker;
    expect(vm.stateSuccess(vm.evaluate({
      inputIndex: routeInput, sourceOutputs, transaction: forgedRecordTransaction,
    }))).not.toBe(true);

    // The record vector is an authenticated description, not a caller-owned cache. Mutating an ordinary record
    // body (independently of the reserved marker check above) must break its exact input/settlement binding.
    const recordBodyParams = structuredClone(originalUnlocker.params);
    const firstRecordSegment = originalUnlocker.abiFunction.inputs.findIndex((input) =>
      input.name === `${KERNEL_ENTRY_JOURNAL_RECORD_SEGMENT_PREFIX}0`);
    expect(firstRecordSegment).toBeGreaterThanOrEqual(0);
    const records = decodePushdataValue(
      recordBodyParams[firstRecordSegment] as Uint8Array, 0, 'bytes[]',
    ).value as Uint8Array[];
    expect(records.length).toBeGreaterThan(0);
    const alteredRecord = new Uint8Array(records[0]);
    alteredRecord[alteredRecord.length - 1] ^= 1;
    records[0] = alteredRecord;
    recordBodyParams[firstRecordSegment] = encodeFunctionArgument(
      records, 'bytes[]', artifact.stateLayout!.structs,
    ) as Uint8Array;
    routeBuilderInput.unlocker = originalUnlocker.contract.createCompilerRouteUnlocker(
      originalUnlocker.abiFunction, hexToBin(selector),
    )(...recordBodyParams);
    const alteredRecordTransaction = builder.buildLibauthTransaction();
    routeBuilderInput.unlocker = originalUnlocker;
    expect(vm.stateSuccess(vm.evaluate({
      inputIndex: routeInput, sourceOutputs, transaction: alteredRecordTransaction,
    })), 'altered record body').not.toBe(true);

    // Input identity is supplied by sourceOutputs to libauth. Change an authenticated entry commitment without
    // changing the journal record and require the route itself to reject the forged pre-state carrier.
    const alteredSourceOutputs = structuredClone(sourceOutputs);
    const alteredSourceCommitment = new Uint8Array(
      alteredSourceOutputs[sourceSlots.inputs[0]!]!.token!.nft!.commitment,
    );
    alteredSourceCommitment[alteredSourceCommitment.length - 1] ^= 1;
    alteredSourceOutputs[sourceSlots.inputs[0]!]!.token!.nft!.commitment = alteredSourceCommitment;
    expect(vm.stateSuccess(vm.evaluate({
      inputIndex: routeInput, sourceOutputs: alteredSourceOutputs, transaction,
    })), 'altered physical input commitment').not.toBe(true);

    const swapped = structuredClone(transaction);
    [swapped.outputs[sourceSlots.outputs[0]!]!.token, swapped.outputs[sourceSlots.outputs[1]!]!.token] = [
      swapped.outputs[sourceSlots.outputs[1]!]!.token, swapped.outputs[sourceSlots.outputs[0]!]!.token,
    ];
    expect(vm.stateSuccess(vm.evaluate({
      inputIndex: routeInput, sourceOutputs, transaction: swapped,
    })), 'swapped physical outputs').not.toBe(true);
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(contract.call.check(0n, 10n).send()).resolves.toBeDefined();
    await expect(contract.call.check(1n, 11n).send()).resolves.toBeDefined();

    // The sent carrier route above is the observable-semantics gate: both final state reads must succeed. The
    // direct dispatcher intentionally does not admit this runtime-mapping loop and therefore is not a runnable
    // transaction baseline for this shape.
  }, 180_000);

  it.each([
    {
      label: 'two absent keys sharing the collection head predecessor',
      sourceEntries: [] as Array<readonly [bigint, bigint]>,
      expected: [0n, 0n] as const,
      expectedKinds: [false, false] as const,
      expectedPhysicalCarriers: 1,
    },
    {
      label: 'a present target and collection-head predecessor reused across rows',
      sourceEntries: [[0n, 10n]] as Array<readonly [bigint, bigint]>,
      expected: [10n, 0n] as const,
      // Access streams are canonically emitted in reverse loop-body order: key 1's absence consumes HEAD as its
      // predecessor, then key 0 consumes its present record. The second row reuses both physical carriers.
      expectedKinds: [false, true] as const,
      expectedPhysicalCarriers: 2,
    },
  ])('authenticates each physical carrier once for $label', async ({
    sourceEntries, expected, expectedKinds, expectedPhysicalCarriers,
  }) => {
    const artifact = compileString(SOURCE, KERNEL);
    expect(artifact.messageBus?.kernelEntryJournal?.capabilities).toContainEqual(expect.objectContaining({
      kind: 'internal-read-carrier', version: 1,
    }));
    const provider = createTestProvider();
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    for (const [key, value] of sourceEntries) await contract.call.seedSource(key, value).send();
    await contract.call.seedResult(0n, 90n).send();
    await contract.call.seedResult(1n, 91n).send();

    const call = contract.batch([{ function: 'copy', args: [2n] }, { function: 'copy', args: [2n] }]);
    const builder = await call.build();
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const routeInput = builder.inputs.findIndex((input) => 'abiFunction' in input.unlocker
      && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    expect(routeInput).toBeGreaterThanOrEqual(0);
    const evaluated = vm.evaluate({ inputIndex: routeInput, sourceOutputs, transaction });
    expect(vm.stateSuccess(evaluated)).toBe(true);

    const sourceSlots = entryIndices(
      sourceOutputs, transaction, getEntryNftAddress(contract.inner, categoryId, 'source'),
    );
    const resultSlots = entryIndices(
      sourceOutputs, transaction, getEntryNftAddress(contract.inner, categoryId, 'result'),
    );
    // Every populated source collection also spends its authenticated HEAD. Each physical source record is then
    // consumed by both repeated rows without another input; the destination remains two independent dirty records.
    expect(sourceSlots.inputs).toHaveLength(sourceEntries.length + 1);
    expect(sourceSlots.outputs).toHaveLength(sourceEntries.length + 1);
    expect(resultSlots.inputs).toHaveLength(2);
    expect(resultSlots.outputs).toHaveLength(2);

    const routeUnlocker = builder.inputs[routeInput]!.unlocker;
    if (!('params' in routeUnlocker)) throw new Error('kernel route has no parameterized unlocker');
    const journalIndex = routeUnlocker.abiFunction.inputs.findIndex((input) =>
      input.name === '__internal__kernelJournalAccessStreams');
    const rowStreams = routeUnlocker.params[journalIndex] as Uint8Array[][];
    const cleanReads = rowStreams.flatMap((streams) => streams.flatMap((stream) =>
      decodeKernelEntryJournalAccesses(stream).filter((access) => !access.mutates)));
    expect(cleanReads).toHaveLength(4);
    expect(cleanReads.slice(0, 2).map((access) => access.presentBefore)).toEqual(expectedKinds);
    expect(cleanReads.slice(2).map((access) => access.presentBefore)).toEqual(expectedKinds);
    const physicalRecords = cleanReads.map((access) => access.presentBefore
      ? access.targetRecordOrdinal : access.predecessorRecordOrdinal);
    expect(physicalRecords.every((record) => record !== undefined)).toBe(true);
    expect(new Set(physicalRecords).size).toBe(expectedPhysicalCarriers);
    expect(physicalRecords.slice(2)).toEqual(physicalRecords.slice(0, 2));
    expect(cleanReads.filter((access) => access.authenticatesTarget
      || access.authenticatesPredecessor)).toHaveLength(expectedPhysicalCarriers);

    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(contract.call.check(0n, expected[0]).send()).resolves.toBeDefined();
    await expect(contract.call.check(1n, expected[1]).send()).resolves.toBeDefined();
  }, 180_000);
});
