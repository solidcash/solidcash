import {
  binToHex, decodeAuthenticationInstructions, encodeAuthenticationInstructions, hexToBin,
} from '@bitauth/libauth';
import { sha256, type Artifact } from '@solidcash/utils';
import { compileStringMulti } from 'solidc';
import { describe, expect, it } from 'vitest';
import { Contract, StatefulContract, messageBus, type TransactionBuilder } from '../../../src/index.js';
import { decodeAtomicMessageEnvelope, encodeAtomicMessageEnvelope } from '../../../src/message-bus/atomic.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const uint16 = (value: number): Uint8Array => Uint8Array.of(value & 0xff, (value >>> 8) & 0xff);
const concat = (...parts: readonly Uint8Array[]): Uint8Array => {
  const result = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let cursor = 0;
  for (const part of parts) { result.set(part, cursor); cursor += part.length; }
  return result;
};

const vmAccepts = (builder: TransactionBuilder): boolean => {
  const transaction = builder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const vm = createVirtualMachineBch2026ForProvider(builder.provider);
  return transaction.inputs.every((_input, inputIndex) => vm.stateSuccess(
    vm.evaluate({ inputIndex, sourceOutputs, transaction }),
  ) === true);
};

/** Rebind every verifier so hostile manifest tests reach semantic lifecycle checks. */
const mutateManifest = (
  builder: TransactionBuilder,
  mutate: (manifest: ReturnType<typeof decodeAtomicMessageEnvelope>) =>
  ReturnType<typeof decodeAtomicMessageEnvelope>,
): void => {
  const verifierIndices = builder.inputs.map((input, index) => ({ input, index }))
    .filter(({ input }) => input.token?.nft?.commitment.startsWith('4c335631'))
    .map(({ index }) => index);
  const originals = verifierIndices.map((index) => builder.inputs[index].unlocker!);
  const first = decodeAuthenticationInstructions(
    builder.buildLibauthTransaction().inputs[verifierIndices[0]].unlockingBytecode,
  )[0];
  if (!first || !('data' in first)) throw new Error('test could not locate lifecycle envelope');
  const changedEnvelope = encodeAtomicMessageEnvelope(mutate(decodeAtomicMessageEnvelope(first.data)));
  const changedManifest = changedEnvelope.slice(8);
  for (const [participant, verifierIndex] of verifierIndices.entries()) {
    const original = originals[participant];
    builder.inputs[verifierIndex] = {
      ...builder.inputs[verifierIndex],
      unlocker: {
        ...original,
        generateUnlockingBytecode: (options) => {
          const instructions = decodeAuthenticationInstructions(original.generateUnlockingBytecode(options));
          instructions[0] = { ...instructions[0], data: changedEnvelope };
          return encodeAuthenticationInstructions(instructions);
        },
      },
    };
    const [activeBase, localRows, localBatch] = original.params.slice(1, 4);
    if (typeof activeBase !== 'bigint' || typeof localRows !== 'bigint'
      || !(localBatch instanceof Uint8Array)) throw new Error('invalid verifier frame');
    const digestParts = [
      sha256(changedManifest), uint16(Number(activeBase)), uint16(Number(localRows)), sha256(localBatch),
    ];
    for (const value of original.params.slice(4, 11)) {
      if (typeof value === 'bigint') digestParts.push(uint16(Number(value)));
      else if (value instanceof Uint8Array) digestParts.push(sha256(value));
      else throw new Error('invalid verifier graph value');
    }
    const participantManifest = decodeAtomicMessageEnvelope(changedEnvelope).participants[participant];
    const suffix = participantManifest.lifecycle?.kind === 'split'
      ? binToHex(uint16(participantManifest.lifecycle.count)) : '';
    const output = builder.outputs[verifierIndex];
    output.token!.nft!.commitment = `${builder.inputs[verifierIndex].token!.nft!.commitment.slice(0, 12)}`
      + binToHex(sha256(concat(...digestParts))) + suffix;
  }
};

describe('kernel atomic split lifecycle', () => {
  it('executes a non-first split participant and rejects lifecycle geometry and identity forgery', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifacts = compileStringMulti(`
      // lifecycle-v3-split-e2e-v2
      interface IThreads { function forkThreads(int count); }
      interface IIdle { function idle(); }
      contract Coordinator(address threads) {
        function run(int count) public {
          IThreads(threads).forkThreads(count);
          require(count > 0);
        }
        function idle() public { require(true); }
      }
      contract Threads() {
        function forkThreads(int count) public split(count) { require(count > 0); }
        function callerBound(address target) public {
          IIdle(target).idle();
          require(msg.sender == msg.sender);
        }
      }
    `, { forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000 });
    const connect = async (artifact: Artifact, args: readonly unknown[] = []): Promise<{
      contract: StatefulContract; category: string;
    }> => {
      const base = new Contract(artifact, args as never[], { provider });
      const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
      return {
        contract: StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId),
        category: setup.categoryId,
      };
    };
    const threads = await connect(artifacts.Threads);
    const coordinator = await connect(artifacts.Coordinator, [hexToBin(threads.contract.inner.lockingBytecode)]);

    const build = async (reuseFeeAsSplit = false): Promise<TransactionBuilder> => {
      const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
      const first = reuseFeeAsSplit ? fee : await createBareP2pkhFeeFunder(provider, 2_000n);
      const second = await createBareP2pkhFeeFunder(provider, 3_000n);
      return messageBus.compose({
        preparedCalls: [
          { contract: coordinator.contract, functionName: 'run', args: [2n] },
          { contract: threads.contract, functionName: 'forkThreads', args: [2n] },
        ],
        funder: fee,
        changeAddress: fee.unlocker.generateLockingBytecode(),
        lifecycleSplits: [{
          invocationIndex: 1, funders: [first, second], createdValues: [1_000n, 1_500n],
        }],
      }).build();
    };

    const canonical = await build();
    expect(vmAccepts(canonical)).toBe(true);
    const neutralFee = await createBareP2pkhFeeFunder(provider, 500_000n);
    const neutral = await messageBus.compose({
      preparedCalls: [
        { contract: threads.contract, functionName: 'callerBound',
          args: [hexToBin(coordinator.contract.inner.lockingBytecode)] },
        { contract: coordinator.contract, functionName: 'idle', args: [] },
      ],
      funder: neutralFee,
      changeAddress: neutralFee.unlocker.generateLockingBytecode(),
    }).build();
    expect(vmAccepts(neutral)).toBe(true);
    const verifierIndex = canonical.inputs.findIndex((input) =>
      input.token?.nft?.commitment.startsWith('4c335631'));
    const envelopeInstruction = decodeAuthenticationInstructions(
      canonical.buildLibauthTransaction().inputs[verifierIndex].unlockingBytecode,
    )[0];
    if (!envelopeInstruction || !('data' in envelopeInstruction)) throw new Error('missing envelope');
    const manifest = decodeAtomicMessageEnvelope(envelopeInstruction.data);
    const splitParticipant = manifest.participants.findIndex((participant) => participant.lifecycle?.kind === 'split');
    expect(splitParticipant).toBe(1);
    const splitBase = manifest.participants.slice(0, splitParticipant)
      .reduce((base, participant) => base + participant.actualSize, 0);
    const createdIndices = [splitBase + 1, splitBase + 2];
    expect(createdIndices.map((index) => canonical.outputs[index].token?.category)).toEqual([
      threads.category, threads.category,
    ]);

    const mutateOutput = (index: number, mutate: () => void, restore: () => void): void => {
      mutate(); expect(vmAccepts(canonical)).toBe(false); restore();
    };
    const created = canonical.outputs[createdIndices[0]];
    const originalCategory = created.token!.category;
    mutateOutput(createdIndices[0], () => { created.token!.category = 'ab'.repeat(32); },
      () => { created.token!.category = originalCategory; });
    const originalLbc = created.to;
    mutateOutput(createdIndices[0], () => { created.to = Uint8Array.of(0x51); }, () => { created.to = originalLbc; });
    mutateOutput(createdIndices[0], () => { created.token!.nft!.commitment = '01'; },
      () => { created.token!.nft!.commitment = ''; });
    mutateOutput(createdIndices[0], () => { created.token!.amount = 1n; }, () => { created.token!.amount = 0n; });
    const originalValue = created.amount;
    mutateOutput(createdIndices[0], () => { created.amount = 0n; }, () => { created.amount = originalValue; });

    const preserved = canonical.outputs[splitBase];
    const originalMasterCommitment = preserved.token!.nft!.commitment;
    mutateOutput(splitBase, () => { preserved.token!.nft!.commitment = `${originalMasterCommitment}00`; },
      () => { preserved.token!.nft!.commitment = originalMasterCommitment; });
    const originalMasterAmount = preserved.token!.amount;
    mutateOutput(splitBase, () => { preserved.token!.amount = originalMasterAmount + 1n; },
      () => { preserved.token!.amount = originalMasterAmount; });
    const originalMasterValue = preserved.amount;
    mutateOutput(splitBase, () => { preserved.amount = originalMasterValue + 1n; },
      () => { preserved.amount = originalMasterValue; });
    const originalMasterLbc = preserved.to;
    mutateOutput(splitBase, () => { preserved.to = Uint8Array.of(0x51); },
      () => { preserved.to = originalMasterLbc; });

    const injectedIndex = canonical.outputs.length - 1;
    const injectedToken = canonical.outputs[injectedIndex].token;
    mutateOutput(injectedIndex, () => {
      canonical.outputs[injectedIndex].token = {
        category: threads.category, amount: 0n, nft: { capability: 'minting', commitment: '' },
      };
    }, () => { canonical.outputs[injectedIndex].token = injectedToken; });

    const wrongCount = await build();
    let changedSplitCount = false;
    mutateManifest(wrongCount, (current) => ({
      ...current,
      rows: current.rows.map((row) => {
        if (row.consumer !== splitParticipant || row.kind !== 0) return row;
        expect(row.argsHex).toBe('52');
        changedSplitCount = true;
        return { ...row, argsHex: '51' };
      }),
    }));
    expect(changedSplitCount).toBe(true);
    expect(vmAccepts(wrongCount)).toBe(false);

    const hostileSibling = await build();
    mutateManifest(hostileSibling, (current) => ({
      ...current,
      participants: current.participants.map((participant, index) => index !== 0 ? participant : ({
        ...participant, fixedSize: 1, actualSize: 2, maximumSize: 2, trailingUsed: 1, returnOffset: 0xffff,
        lifecycle: {
          version: 1, kind: 'split', count: 1, inputSpan: 1, outputSpan: 2, balancedSpan: 2,
          inputTail: 'funding', outputTail: 'created-masters',
        },
      })),
    }));
    expect(vmAccepts(hostileSibling)).toBe(false);

    await expect(build(true)).rejects.toThrow(/duplicate input outpoint/);
  }, 180_000);

  it('rejects one funding outpoint reused by two split participants', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifacts = compileStringMulti(`
      interface IA { function forkA(int count); }
      interface IB { function forkB(int count); }
      contract Root(address a, address b) {
        function run() public { IA(a).forkA(1); IB(b).forkB(1); require(true); }
      }
      contract A() { function forkA(int count) public split(count) { require(count > 0); } }
      contract B() { function forkB(int count) public split(count) { require(count > 0); } }
    `, { forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000 });
    const connect = async (artifact: Artifact, args: readonly unknown[] = []): Promise<StatefulContract> => {
      const base = new Contract(artifact, args as never[], { provider });
      const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
      return StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
    };
    const a = await connect(artifacts.A);
    const b = await connect(artifacts.B);
    const root = await connect(artifacts.Root, [
      hexToBin(a.inner.lockingBytecode), hexToBin(b.inner.lockingBytecode),
    ]);
    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    const shared = await createBareP2pkhFeeFunder(provider, 4_000n);
    await expect(messageBus.compose({
      preparedCalls: [
        { contract: root, functionName: 'run', args: [] },
        { contract: a, functionName: 'forkA', args: [1n] },
        { contract: b, functionName: 'forkB', args: [1n] },
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
      lifecycleSplits: [
        { invocationIndex: 1, funders: [shared], createdValues: [1_000n] },
        { invocationIndex: 2, funders: [shared], createdValues: [1_000n] },
      ],
    }).build()).rejects.toThrow(/duplicate input outpoint/);
  }, 180_000);
});
