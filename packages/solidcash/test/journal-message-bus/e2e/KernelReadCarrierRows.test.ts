import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import { Contract, StatefulContract, getEntryNftAddress } from '../../../src/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { decodeKernelEntryJournalAccesses } from '../../../src/stateful/KernelEntryJournal.js';
import { addressToLockScript, generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../../test-util.js';

const SOURCE = `contract RepeatedRowCarrier() {
  mapping(int => int) source;
  mapping(int => int) result;
  function seed(int key, int value) public {
    this.source[key] = value;
    this.result[key] = 0;
    require(true);
  }
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
  transaction: { inputs: Array<{ lockingBytecode: Uint8Array }>; outputs: Array<{ lockingBytecode: Uint8Array }> },
  address: string,
): { inputs: number[]; outputs: number[] } {
  const lockingBytecode = binToHex(addressToLockScript(address));
  return {
    inputs: transaction.inputs.flatMap((input, index) =>
      binToHex(input.lockingBytecode) === lockingBytecode ? [index] : []),
    outputs: transaction.outputs.flatMap((output, index) =>
      binToHex(output.lockingBytecode) === lockingBytecode ? [index] : []),
  };
}

/**
 * Activation fixture for the compiler-published `internal-read-carrier` capability.
 *
 * Keep this test intentionally skipped until GTT publishes the capability and recognizes its internally-produced
 * 0x11 marker. Current bytecode cannot accept a second non-authenticated read, so enabling it early would turn a
 * meaningful protocol precondition into a misleading SDK failure.
 */
describe('kernel repeated clean-read carriers', () => {
  it.skip('shares each physical clean input across copy(2), copy(2) and settles a dense mixed final flush', async () => {
    const artifact = compileString(SOURCE, KERNEL);
    expect(artifact.messageBus?.capabilities).toContain('internal-read-carrier');
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'copy')).toMatchObject({ eligible: true });
    const provider = createTestProvider();
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, inner, artifact.stateLayout!, {}, { saltContract: true });
    const contract = StatefulContract.withCategory(inner, categoryId);
    // Reverse insertion order proves source order and physical entry order are independently authenticated.
    await contract.call.seed(1n, 11n).send();
    await contract.call.seed(0n, 10n).send();
    const call = contract.batch([{ function: 'copy', args: [2n] }, { function: 'copy', args: [2n] }]);
    const builder = await call.build();
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`).toBe(true);
    }

    const sourceSlots = entryIndices(transaction, getEntryNftAddress(contract.inner, categoryId, 'source'));
    const resultSlots = entryIndices(transaction, getEntryNftAddress(contract.inner, categoryId, 'result'));
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
    const swapped = structuredClone(transaction);
    [swapped.outputs[sourceSlots.outputs[0]!]!.token, swapped.outputs[sourceSlots.outputs[1]!]!.token] = [
      swapped.outputs[sourceSlots.outputs[1]!]!.token, swapped.outputs[sourceSlots.outputs[0]!]!.token,
    ];
    expect(vm.stateSuccess(vm.evaluate({ inputIndex: routeInput, sourceOutputs, transaction: swapped }))).not.toBe(true);
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(contract.call.check(0n, 10n).send()).resolves.toBeDefined();
    await expect(contract.call.check(1n, 11n).send()).resolves.toBeDefined();

    // Legacy unrolling intentionally does not admit this runtime-mapping shape. Compare instead with the direct
    // dispatcher, which is the independent observable-semantics baseline until legacy gains an equivalent route.
    const legacy = compileString(SOURCE, { ...KERNEL, messageBusKernel: false });
    expect(legacy.messageBus?.handlers.find((handler) => handler.name === 'copy')?.eligible).toBe(false);
    const directArtifact = compileString(SOURCE, { forceStateful: true, messageBus: false });
    const directProvider = createTestProvider();
    const directInner = new Contract(directArtifact, [], { provider: directProvider });
    const directState = await setupStatefulUtxos(
      directProvider, directInner, directArtifact.stateLayout!, {}, { saltContract: true },
    );
    const direct = StatefulContract.withCategory(directInner, directState.categoryId);
    await direct.call.seed(1n, 11n).send();
    await direct.call.seed(0n, 10n).send();
    await direct.call.copy(2n).send();
    await direct.call.copy(2n).send();
    await expect(direct.call.check(0n, 10n).send()).resolves.toBeDefined();
    await expect(direct.call.check(1n, 11n).send()).resolves.toBeDefined();
  }, 180_000);
});
