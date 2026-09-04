import {
  bigIntToVmNumber, binToHex, decodeAuthenticationInstructions, encodeAuthenticationInstructions,
  encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { compileString } from 'solidc';
import {
  blockhashOracleLockingBytecode, buildBlockhashCommitment, buildChunkCommitment, scriptToBytecode, sha256,
  keccakComputeLockingBytecode,
  ecrecoverComputeLockingBytecode,
  hash160,
  buildValueChunkCommitment, encodeChunkableValueTail, encodePushdataValue, splitValueIntoValueChunks,
} from '@solidcash/utils';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { ethers } from 'ethers';
import { describe, expect, it } from 'vitest';
import {
  Contract, SignatureTemplate, Signer, StatefulContract, getContractFactory, messageBus, upgrades,
} from '../../../src/index.js';
import { decodeAtomicMessageEnvelope, encodeAtomicMessageEnvelope } from '../../../src/message-bus/atomic.js';
import {
  getDynamicChunkAddress, getEntryNftAddress, getMessageBusVerifierLockingBytecode,
  getSatoshiContainerAddress, getTokenContainerAddress, getValueChunkAddress,
} from '../../../src/stateful/covenant-helpers.js';
import { encodeEntryCommitment, keyToSlot } from '../../../src/stateful/SortedList.js';
import type { TransactionBuilder } from '../../../src/TransactionBuilder.js';
import {
  createBareP2pkhFeeFunder, genesisFtContainer, setupStatefulUtxos,
} from '../../test-util.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { assertAuthenticatingVmEvidence } from '../vm-evidence.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { randomUtxo } from '../../../src/utils.js';

const CALLEE = `contract ComposeCallee() {
  int counter;
  function settle(int next) public returns (int) {
    this.counter = next;
    return next + 1;
  }
}`;

const CALLER = `
interface IComposeCallee { function settle(int next) returns (int); }
contract ComposeCaller(address callee) {
  int marker;
  function prepare(int next) public {
    int result = IComposeCallee(callee).settle(next);
    require(result == next + 1);
  }
  function setDirect(int next) public { this.marker = next; require(next >= 0); }
}`;

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));

const vmRejects = (candidate: TransactionBuilder): boolean => {
  assertAuthenticatingVmEvidence(candidate);
  const transaction = candidate.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(candidate.inputs);
  const vm = createVirtualMachineBch2026ForProvider(candidate.provider);
  // `debug` retains every intermediate VM state. Large kernel routes can execute enough instructions for that
  // trace collector to exhaust the JavaScript call stack even though ordinary consensus evaluation succeeds.
  // This helper only asks for the final accept/reject verdict, so use the same bounded evaluation path as
  // preflight instead of turning route size into a test-harness failure.
  return transaction.inputs.some((_input, inputIndex) => vm.stateSuccess(
    vm.evaluate({ inputIndex, sourceOutputs, transaction }),
  ) !== true);
};

const uint16 = (value: number): Uint8Array => Uint8Array.of(value & 0xff, (value >>> 8) & 0xff);
const concatBytes = (...parts: readonly Uint8Array[]): Uint8Array => {
  const result = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
};

/**
 * Adversary-strength envelope mutation: rewrite the canonical envelope in every verifier and repoint every
 * verifier output commitment to the new manifest hash. Rejection after this rewrite exercises the participant
 * layout rules, not the cheap stale-digest boundary.
 */
const mutateEveryEnvelopeAndRebind = (
  builder: TransactionBuilder,
  mutate: (manifest: ReturnType<typeof decodeAtomicMessageEnvelope>) => ReturnType<typeof decodeAtomicMessageEnvelope>,
): void => {
  const verifierIndices = builder.inputs
    .map((input, index) => ({ input, index }))
    .filter(({ input }) => input.token?.nft?.commitment.startsWith('4c335631'))
    .map(({ index }) => index);
  if (verifierIndices.length < 2) throw new Error('strong mutation requires every participant verifier');
  const verifierUnlockers = verifierIndices.map((index) => builder.inputs[index].unlocker!);
  const transaction = builder.buildLibauthTransaction();
  const firstInstructions = decodeAuthenticationInstructions(transaction.inputs[verifierIndices[0]].unlockingBytecode);
  const firstEnvelope = firstInstructions[0];
  if (!firstEnvelope || !('data' in firstEnvelope)) throw new Error('strong mutation found no canonical envelope');
  const originalManifest = decodeAtomicMessageEnvelope(firstEnvelope.data);
  const changedEnvelope = encodeAtomicMessageEnvelope(mutate(originalManifest));
  const changedCallManifest = changedEnvelope.slice(8);

  for (const [participant, verifierIndex] of verifierIndices.entries()) {
    const original = verifierUnlockers[participant];
    builder.inputs[verifierIndex] = {
      ...builder.inputs[verifierIndex],
      unlocker: {
        generateLockingBytecode: () => original.generateLockingBytecode(),
        generateUnlockingBytecode: (options) => {
          const instructions = decodeAuthenticationInstructions(original.generateUnlockingBytecode(options));
          if (!instructions[0] || !('data' in instructions[0])) throw new Error('verifier has no envelope push');
          instructions[0] = { ...instructions[0], data: changedEnvelope };
          return encodeAuthenticationInstructions(instructions);
        },
      },
    };
  }

  for (let participant = 0; participant < originalManifest.participants.length; participant += 1) {
    // Verifier ABI: density reserve, active base, local row count, batch blob, seven graph values, envelope.
    const params = verifierUnlockers[participant].params;
    const activeBase = params[1];
    const expectedLocalRows = params[2];
    const batchBlob = params[3];
    if (typeof activeBase !== 'bigint' || typeof expectedLocalRows !== 'bigint') {
      throw new Error('participant verifier has no active-base/local-row arguments');
    }
    if (!(batchBlob instanceof Uint8Array)) throw new Error('participant master has no batchBlob');
    const parts = [
      sha256(changedCallManifest), uint16(Number(activeBase)), uint16(Number(expectedLocalRows)), sha256(batchBlob),
    ];
    for (const value of params.slice(4, 11)) {
      if (typeof value === 'bigint') parts.push(uint16(Number(value)));
      else if (value instanceof Uint8Array) parts.push(sha256(value));
      else throw new Error('participant verifier has an invalid graph argument');
    }
    const output = builder.outputs[verifierIndices[participant]];
    output.token!.nft!.commitment = `${builder.inputs[verifierIndices[participant]].token!.nft!.commitment.slice(0, 12)}`
      + binToHex(sha256(concatBytes(...parts)));
  }
};

const mutateAuthenticatedFrame = (
  builder: TransactionBuilder, selectorHex: string,
  target: 'messageEnvelope' | 'emissions' | 'messageEnvelope-result' | 'messageEnvelope-event' | 'messageEnvelope-resource'
  | 'messageEnvelope-resource-mode' | 'messageEnvelope-resource-slot' | 'messageEnvelope-resource-subject'
  | 'messageEnvelope-resource-create' | 'messageEnvelope-resource-delete' | 'messageEnvelope-value' | 'messageEnvelope-value-drop'
  | 'messageEnvelope-satoshi' | 'messageEnvelope-satoshi-drop' | 'messageEnvelope-token' | 'messageEnvelope-token-drop'
  | 'messageEnvelope-token-container' | 'messageEnvelope-token-container-drop'
  | 'messageEnvelope-context-caller' | 'messageEnvelope-context-selector' | 'messageEnvelope-context-args' | 'messageEnvelope-root-origin'
  | 'messageEnvelope-span-shrink' | 'messageEnvelope-span-expand' | 'messageEnvelope-span-maximum'
  | 'messageEnvelope-invocation-swap' | 'messageEnvelope-invocation-drop' | 'messageEnvelope-invocation-duplicate'
  | 'messageEnvelope-invocation-target' | 'messageEnvelope-invocation-mode',
): void => {
  const messageEnvelopeTarget = target === 'messageEnvelope' || target === 'messageEnvelope-result' || target === 'messageEnvelope-event'
    || target.startsWith('messageEnvelope-resource') || target.startsWith('messageEnvelope-value')
    || target.startsWith('messageEnvelope-satoshi') || target.startsWith('messageEnvelope-token')
    || target.startsWith('messageEnvelope-context-') || target === 'messageEnvelope-root-origin'
    || target.startsWith('messageEnvelope-span-') || target.startsWith('messageEnvelope-invocation-');
  const verifierIndices = builder.inputs
    .map((input, index) => ({ input, index }))
    .filter(({ input }) => input.token?.nft?.commitment.startsWith('4c335631'))
    .map(({ index }) => index);
  const inputIndex = messageEnvelopeTarget ? verifierIndices[verifierIndices.length - 1] ?? -1 : 0;
  if (inputIndex < 0) throw new Error('test could not locate a deployed message bus verifier input');
  const original = builder.inputs[inputIndex].unlocker!;
  builder.inputs[inputIndex] = {
    ...builder.inputs[inputIndex],
    unlocker: {
      generateLockingBytecode: () => original.generateLockingBytecode(),
      generateUnlockingBytecode: (options) => {
        const instructions = decodeAuthenticationInstructions(original.generateUnlockingBytecode(options));
        const instructionIndex = instructions.findIndex((instruction, index) => {
          if (!('data' in instruction)) return false;
          const hex = binToHex(instruction.data);
          return messageEnvelopeTarget
            ? hex.startsWith('4c334331') && hex.includes(selectorHex)
            : index > 2 && instruction.data.length < 128 && hex.includes(selectorHex);
        });
        if (instructionIndex < 0) throw new Error(`test could not locate ${target} frame`);
        const instruction = instructions[instructionIndex];
        if (!('data' in instruction)) throw new Error(`test ${target} frame is not a push`);
        if (target === 'messageEnvelope-result' || target === 'messageEnvelope-event' || target.startsWith('messageEnvelope-resource')
          || target.startsWith('messageEnvelope-value') || target.startsWith('messageEnvelope-satoshi')
          || target.startsWith('messageEnvelope-token') || target.startsWith('messageEnvelope-context-')
          || target === 'messageEnvelope-root-origin' || target.startsWith('messageEnvelope-invocation-')
          || target.startsWith('messageEnvelope-span-')) {
          const callManifest = decodeAtomicMessageEnvelope(instruction.data);
          if (target.startsWith('messageEnvelope-span-')) {
            const participantIndex = callManifest.participants.findIndex((participant) =>
              target === 'messageEnvelope-span-shrink' ? participant.trailingUsed > 0
                : target === 'messageEnvelope-span-expand' ? participant.actualSize < participant.maximumSize
                  : true);
            if (participantIndex < 0) throw new Error(`test could not locate a ${target} participant`);
            const participants = callManifest.participants.map((participant, index) => index !== participantIndex
              ? participant
              : target === 'messageEnvelope-span-shrink'
                ? {
                  ...participant, actualSize: participant.actualSize - 1,
                  trailingUsed: participant.trailingUsed - 1,
                }
                : target === 'messageEnvelope-span-expand'
                  ? {
                    ...participant, actualSize: participant.actualSize + 1,
                    trailingUsed: participant.trailingUsed + 1,
                  }
                  : { ...participant, maximumSize: participant.maximumSize + 1 });
            instructions[instructionIndex] = {
              ...instruction, data: encodeAtomicMessageEnvelope({ ...callManifest, participants }),
            };
            return encodeAuthenticationInstructions(instructions);
          }
          if (target.startsWith('messageEnvelope-invocation-')) {
            const invocationIndices = callManifest.rows
              .map((row, index) => ({ row, index }))
              .filter(({ row }) => row.kind === 0 && row.parent !== 0xffff)
              .map(({ index }) => index);
            if (invocationIndices.length < 1
              || (['messageEnvelope-invocation-swap', 'messageEnvelope-invocation-drop'].includes(target)
                && invocationIndices.length < 2)) {
              throw new Error('test could not locate required invocation rows');
            }
            const [first, second] = invocationIndices;
            let rows = [...callManifest.rows];
            if (target === 'messageEnvelope-invocation-target') {
              rows[first] = {
                ...rows[first], consumer: (rows[first].consumer + 1) % callManifest.participants.length,
              };
            } else if (target === 'messageEnvelope-invocation-mode') {
              rows[first] = { ...rows[first], mode: rows[first].mode ^ 1 };
            } else if (target === 'messageEnvelope-invocation-swap') {
              rows = rows.map((row, index) => index === first
                ? { ...row, argsHex: callManifest.rows[second].argsHex }
                : index === second ? { ...row, argsHex: callManifest.rows[first].argsHex } : row);
            } else if (target === 'messageEnvelope-invocation-drop') {
              rows.splice(second, 1);
            } else {
              const selected = second ?? first;
              rows.splice(selected + 1, 0, { ...rows[selected] });
            }
            instructions[instructionIndex] = {
              ...instruction, data: encodeAtomicMessageEnvelope({ ...callManifest, rows }),
            };
            return encodeAuthenticationInstructions(instructions);
          }
          const rowIndex = callManifest.rows.findIndex((row) => target === 'messageEnvelope-result'
            ? row.resultHex.length > 0
            : target === 'messageEnvelope-root-origin'
              ? row.kind === 0 && row.parent === 0xffff
              : target.startsWith('messageEnvelope-context-')
                ? row.kind === 0 && row.parent !== 0xffff
                : row.kind === (target.startsWith('messageEnvelope-resource') || target.startsWith('messageEnvelope-satoshi')
                  || target.startsWith('messageEnvelope-token-container')
                  ? 1 : target.startsWith('messageEnvelope-value') ? 3 : target.startsWith('messageEnvelope-token') ? 4 : 2)
              && (row.effectHex.length > 0 || target === 'messageEnvelope-resource-delete')
              && (target !== 'messageEnvelope-resource-create' || row.mode === 1)
              && (target !== 'messageEnvelope-resource-delete' || row.mode === 2)
              && (!target.startsWith('messageEnvelope-satoshi') || row.mode === 3)
              && (!target.startsWith('messageEnvelope-token-container') || row.mode === 4));
          if (rowIndex < 0) throw new Error(`test could not locate a ${target} row`);
          if (target.startsWith('messageEnvelope-context-') || target === 'messageEnvelope-root-origin') {
            const rows = callManifest.rows.map((row, index) => {
              if (index !== rowIndex) return row;
              if (target === 'messageEnvelope-context-selector') {
                const selector = hexToBin(row.selectorHex);
                selector[0] ^= 1;
                return { ...row, selectorHex: binToHex(selector) };
              }
              if (target === 'messageEnvelope-context-args') {
                const args = hexToBin(row.argsHex);
                args[args.length - 1] ^= 1;
                return { ...row, argsHex: binToHex(args) };
              }
              const subject = hexToBin(row.subjectHex);
              subject[subject.length - 1] ^= 1;
              return { ...row, subjectHex: binToHex(subject) };
            });
            instructions[instructionIndex] = {
              ...instruction, data: encodeAtomicMessageEnvelope({ ...callManifest, rows }),
            };
            return encodeAuthenticationInstructions(instructions);
          }
          if (target.endsWith('-drop')) {
            instructions[instructionIndex] = {
              ...instruction,
              data: encodeAtomicMessageEnvelope({
                ...callManifest, rows: callManifest.rows.filter((_row, index) => index !== rowIndex),
              }),
            };
            return encodeAuthenticationInstructions(instructions);
          }
          if (target === 'messageEnvelope-resource-mode' || target === 'messageEnvelope-resource-slot'
            || target === 'messageEnvelope-resource-subject') {
            const row = callManifest.rows[rowIndex];
            const subject = hexToBin(row.subjectHex);
            if (target === 'messageEnvelope-resource-subject') subject[subject.length - 1] ^= 0x01;
            const rows = callManifest.rows.map((candidate, index) => index === rowIndex
              ? {
                ...candidate,
                ...(target === 'messageEnvelope-resource-mode' ? { mode: 1 } : {}),
                ...(target === 'messageEnvelope-resource-slot'
                  ? { sourceOffset: candidate.sourceOffset - 1, targetOffset: candidate.targetOffset - 1 } : {}),
                ...(target === 'messageEnvelope-resource-subject' ? { subjectHex: binToHex(subject) } : {}),
              } : candidate);
            instructions[instructionIndex] = {
              ...instruction, data: encodeAtomicMessageEnvelope({ ...callManifest, rows }),
            };
            return encodeAuthenticationInstructions(instructions);
          }
          const field = hexToBin(target === 'messageEnvelope-result' || target === 'messageEnvelope-resource-delete'
            ? callManifest.rows[rowIndex].resultHex : callManifest.rows[rowIndex].effectHex);
          field[field.length - 1] ^= 0x01;
          const rows = callManifest.rows.map((row, index) => index === rowIndex
            ? {
              ...row,
              ...(target === 'messageEnvelope-result'
                ? { resultHex: binToHex(field) } : { effectHex: binToHex(field) }),
            } : row);
          instructions[instructionIndex] = {
            ...instruction, data: encodeAtomicMessageEnvelope({ ...callManifest, rows }),
          };
          return encodeAuthenticationInstructions(instructions);
        }
        const data = instruction.data.slice();
        const fieldOffset = binToHex(data).lastIndexOf(selectorHex) / 2;
        if (fieldOffset < 0) throw new Error(`test could not locate ${target} field`);
        data[fieldOffset] ^= 0x01;
        instructions[instructionIndex] = { ...instruction, data };
        return encodeAuthenticationInstructions(instructions);
      },
    },
  };
};

describe('messageBus.compose atomic transaction', () => {
  it('forwards detached signatures in composite arrays through a typed graph edge', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const calleeArtifact = compileString(`
      struct Auth { sig signature; pubkey key; }
      contract CompositeSignatureCallee() {
        int stored;
        function settle(Auth[] auth, int next) public {
          require(auth.length == 1 && checkSig(auth[0].signature, auth[0].key));
          this.stored = next;
        }
        function check(int expected) public { require(this.stored == expected); }
      }
    `, { forceStateful: true, messageBus: true, messageBusKernel: true });
    const calleeBase = new Contract(calleeArtifact, [], { provider });
    const calleeSetup = await setupStatefulUtxos(
      provider, calleeBase, calleeArtifact.stateLayout!, { stored: 0n }, { saltContract: true },
    );
    const calleeInner = calleeBase.withCategory(hexToBin(calleeSetup.categoryId));
    const callee = StatefulContract.withCategory(calleeInner, calleeSetup.categoryId);

    const callerArtifact = compileString(`
      struct Auth { sig signature; pubkey key; }
      interface ICompositeSignatureCallee { function settle(Auth[] auth, int next); }
      contract CompositeSignatureCaller(address callee) {
        function forward(Auth[] auth, int next) public {
          ICompositeSignatureCallee(callee).settle(auth, next);
          require(true);
        }
      }
    `, { forceStateful: true, messageBus: true, messageBusKernel: true });
    const callerBase = new Contract(callerArtifact, [hexToBin(calleeInner.lockingBytecode)], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    const auth = [{ signature: new SignatureTemplate(alicePriv), key: alicePub }];
    const composition = messageBus.compose({
      calls: [caller.call.forward(auth, 7n), callee.call.settle(auth, 7n)],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });
    await expect(composition.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(StatefulContract.withCategory(calleeInner, calleeSetup.categoryId).call.check(7n).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 120_000);

  it('reconstructs and authenticates msg.sender, msg.sig, msg.data, and tx.origin', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const calleeArtifact = compileString(`contract ComposeContextCallee() {
      function check(address expectedSender, bytes4 expectedSig, address expectedOrigin) public {
        require(msg.sender == expectedSender && msg.sig == expectedSig
          && msg.data.length > 4 && tx.origin == expectedOrigin);
      }
    }`, { forceStateful: true, messageBus: true });
    const calleeBase = new Contract(calleeArtifact, [], { provider });
    const calleeSetup = await setupStatefulUtxos(
      provider, calleeBase, calleeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const calleeInner = calleeBase.withCategory(hexToBin(calleeSetup.categoryId));
    const callee = StatefulContract.withCategory(calleeInner, calleeSetup.categoryId);
    const callerArtifact = compileString(`
      interface IComposeContextCallee {
        function check(address expectedSender, bytes4 expectedSig, address expectedOrigin);
      }
      contract ComposeContextCaller(address calleeAddress) {
        function prepare(address expectedSender, bytes4 expectedSig, address expectedOrigin) public {
          IComposeContextCallee(calleeAddress).check(expectedSender, expectedSig, expectedOrigin);
          require(true);
        }
      }
    `, { forceStateful: true, messageBus: true });
    const callerBase = new Contract(callerArtifact, [calleeInner.lockingBytecode], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const callerInner = callerBase.withCategory(hexToBin(callerSetup.categoryId));
    const caller = StatefulContract.withCategory(callerInner, callerSetup.categoryId);
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const expectedSender = hexToBin(callerInner.lockingBytecode);
    const expectedSig = hexToBin(calleeArtifact.abi.find((entry) => entry.name === 'check')!.selector!);
    const expectedOrigin = fee.unlocker.generateLockingBytecode();
    const composition = messageBus.compose({
      calls: [
        caller.call.prepare(expectedSender, expectedSig, expectedOrigin),
        callee.call.check(expectedSender, expectedSig, expectedOrigin),
      ],
      funder: fee,
      changeAddress: expectedOrigin,
    });
    const canonical = await composition.build();
    expect(vmRejects(canonical)).toBe(false);
    for (const mutation of [
      'messageEnvelope-context-caller', 'messageEnvelope-context-selector', 'messageEnvelope-context-args', 'messageEnvelope-root-origin',
    ] as const) {
      const hostile = await composition.build();
      mutateAuthenticatedFrame(hostile, '', mutation);
      expect(vmRejects(hostile), mutation).toBe(true);
    }
    await expect(canonical.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 120_000);

  it('settles repeated callsites through one physical participant in compiler-authored order', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const sinkArtifact = compileString(`contract ComposeRepeatedSink() {
      function ping(int value) public { require(value >= 0); }
    }`, { forceStateful: true, messageBus: true });
    const sinkBase = new Contract(sinkArtifact, [], { provider });
    const sinkSetup = await setupStatefulUtxos(
      provider, sinkBase, sinkArtifact.stateLayout!, {}, { saltContract: true },
    );
    const sinkInner = sinkBase.withCategory(hexToBin(sinkSetup.categoryId));
    const sink = StatefulContract.withCategory(sinkInner, sinkSetup.categoryId);
    const callerArtifact = compileString(`
      interface IComposeRepeatedSink { function ping(int value); }
      contract ComposeRepeatedCaller(address sink) {
        function invoke(int value) public {
          IComposeRepeatedSink(sink).ping(value);
          IComposeRepeatedSink(sink).ping(9);
          require(value >= 0);
        }
      }
    `, { forceStateful: true, messageBus: true });
    const callerBase = new Contract(callerArtifact, [sinkInner.lockingBytecode], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const composition = messageBus.compose({
      calls: [caller.call.invoke(7n), sink.call.ping(7n), sink.call.ping(9n)],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });
    const canonical = await composition.build();
    expect(canonical.inputs).toHaveLength(5);
    expect(vmRejects(canonical)).toBe(false);
    await expect(messageBus.compose({
      calls: [caller.call.invoke(7n), sink.call.ping(9n), sink.call.ping(7n)],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    }).build()).rejects.toThrow(/prepared call 1 .*arguments disagree/);
    for (const mutation of [
      'messageEnvelope-invocation-swap', 'messageEnvelope-invocation-drop', 'messageEnvelope-invocation-duplicate',
    ] as const) {
      const hostile = await composition.build();
      mutateAuthenticatedFrame(hostile, '', mutation);
      expect(vmRejects(hostile), mutation).toBe(true);
    }
    await expect(canonical.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 120_000);

  it('propagates multiple pooled collection returns from one physical participant', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const calleeArtifact = compileString(`contract ComposePooledReturnCallee() {
      mapping(bigint => bigint) first;
      mapping(bigint => bigint) second;
      function readFirst(bigint key) public returns (bigint) { return this.first[key]; }
      function readSecond(bigint key) public returns (bigint) { return this.second[key]; }
      function writeFirst(bigint key, bigint value) public {
        this.first[key] = value;
        require(value >= 0);
      }
    }`, { forceStateful: true, messageBus: true, messageBusGraphContext: true });
    const calleeBase = new Contract(calleeArtifact, [], { provider });
    const key = 7n;
    const slot = keyToSlot(bigIntToVmNumber(key));
    const calleeSetup = await setupStatefulUtxos(provider, calleeBase, calleeArtifact.stateLayout!, {}, {
      saltContract: true,
      extraOutputs: (categoryId) => [
        { collection: 'first', value: 11n },
        { collection: 'second', value: 22n },
      ].map(({ collection, value }) => ({
        address: getEntryNftAddress(calleeBase, categoryId, collection),
        satoshis: 10_000n,
        token: {
          amount: 0n,
          nft: {
            capability: 'mutable' as const,
            commitment: binToHex(encodeEntryCommitment(slot, new Uint8Array(32), bigIntToVmNumber(value))),
          },
        },
      })),
    });
    const calleeInner = calleeBase.withCategory(hexToBin(calleeSetup.categoryId));
    const callee = StatefulContract.withCategory(calleeInner, calleeSetup.categoryId);
    const callerArtifact = compileString(`
      interface IComposePooledReturnCallee {
        function readFirst(bigint key) returns (bigint);
        function readSecond(bigint key) returns (bigint);
      }
      contract ComposePooledReturnCaller(address calleeAddress) {
        function prepare(bigint key) public {
          bigint first = IComposePooledReturnCallee(calleeAddress).readFirst(key);
          bigint second = IComposePooledReturnCallee(calleeAddress).readSecond(key);
          require(first == 11 && second == 22);
        }
      }
    `, { forceStateful: true, messageBus: true });
    const callerBase = new Contract(callerArtifact, [calleeInner.lockingBytecode], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      calls: [caller.call.prepare(key), callee.call.readFirst(key), callee.call.readSecond(key)],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });

    const built = await composition.build();
    expect(vmRejects(built)).toBe(false);
    await expect(composition.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 120_000);

  it('preserves a pooled long mapping return across event-emitting writes', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const calleeArtifact = compileString(`contract ComposePooledArrayCallee() {
      struct FeeRecord { bytes publicKey; string name; bigint fee; }
      event Appended(uint256 key);
      mapping(bool => bool) earlier;
      mapping(bigint => FeeRecord) fees;
      mapping(uint256 => bigint[]) items;
      function readEarlier(bool key) public returns (bool) { return this.earlier[key]; }
      function readFee(bigint key) public returns (bigint) { return this.fees[key].fee; }
      function itemsLength(uint256 key) public returns (uint256) { return this.items[key].length; }
      function append(uint256 key) public {
        this.items[key].push(bigint(4) << 160);
      emit Appended(key);
      require(this.items[key].length > 0);
      }
    }`, {
      forceStateful: true, messageBus: true, messageBusGraphContext: true,
      suppressWarnings: true,
    });
    const calleeBase = new Contract(calleeArtifact, [], { provider });
    const key = 7n;
    const slot = keyToSlot(bigIntToVmNumber(key));
    const feeKey = 9n;
    const feeSlot = keyToSlot(bigIntToVmNumber(feeKey));
    const feeValue = encodePushdataValue([
      new Uint8Array(33).fill(2), 'long fee record '.repeat(6), 100n,
    ], 'FeeRecord', calleeArtifact.structs);
    const feeDigest = sha256(feeValue);
    const encodedItems = encodePushdataValue([
      1n << 160n, 2n << 160n, 3n << 160n,
    ], 'bigint[]');
    const valueDigest = sha256(encodedItems);
    const entryValue = new Uint8Array(64);
    new DataView(entryValue.buffer).setUint32(0, encodedItems.length, true);
    entryValue.set(valueDigest, 4);
    entryValue.set(encodedItems.subarray(0, 28), 36);
    const calleeSetup = await setupStatefulUtxos(provider, calleeBase, calleeArtifact.stateLayout!, {}, {
      saltContract: true,
      extraOutputs: (categoryId) => {
        const outputs = [{
          address: getEntryNftAddress(calleeBase, categoryId, 'items'),
          satoshis: 10_000n,
          token: {
            amount: 0n,
            nft: {
              capability: 'mutable' as const,
              commitment: binToHex(encodeEntryCommitment(slot, new Uint8Array(32), entryValue)),
            },
          },
        }, {
          address: getEntryNftAddress(calleeBase, categoryId, 'fees'),
          satoshis: 10_000n,
          token: {
            amount: 0n,
            nft: {
              capability: 'mutable' as const,
              commitment: binToHex(encodeEntryCommitment(
                feeSlot, new Uint8Array(32),
                encodeChunkableValueTail(feeValue),
              )),
            },
          },
        }];
        const chunkAddress = getValueChunkAddress(calleeBase, categoryId, 'items', slot, valueDigest);
        splitValueIntoValueChunks(encodedItems).forEach((chunk, index) => outputs.push({
          address: chunkAddress,
          satoshis: 10_000n,
          token: {
            amount: 0n,
            nft: { capability: 'mutable' as const, commitment: buildValueChunkCommitment(index, chunk) },
          },
        }));
        const feeChunkAddress = getValueChunkAddress(calleeBase, categoryId, 'fees', feeSlot, feeDigest);
        splitValueIntoValueChunks(feeValue).forEach((chunk, index) => outputs.push({
          address: feeChunkAddress,
          satoshis: 10_000n,
          token: {
            amount: 0n,
            nft: { capability: 'mutable' as const, commitment: buildValueChunkCommitment(index, chunk) },
          },
        }));
        return outputs;
      },
    });
    const calleeInner = calleeBase.withCategory(hexToBin(calleeSetup.categoryId));
    const callee = StatefulContract.withCategory(calleeInner, calleeSetup.categoryId);
    const callerArtifact = compileString(`
      interface IComposePooledArrayCallee {
        function readEarlier(bool key) external returns (bool);
        function readFee(bigint key) external returns (bigint);
        function itemsLength(uint256 key) external returns (uint256);
        function append(uint256 key) external;
      }
      contract ComposePooledArrayCaller(address calleeAddress) {
        function prepare(uint256 key) public {
          uint256 length = IComposePooledArrayCallee(calleeAddress).itemsLength(key);
          IComposePooledArrayCallee(calleeAddress).append(key);
          IComposePooledArrayCallee(calleeAddress).append(key);
          bigint fee = IComposePooledArrayCallee(calleeAddress).readFee(9);
          require(length == 3 && fee == 100);
        }
      }
    `, {
      forceStateful: true, messageBus: true, suppressWarnings: true,
    });
    const callerBase = new Contract(callerArtifact, [calleeInner.lockingBytecode], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      calls: [
        caller.call.prepare(key), callee.call.itemsLength(key), callee.call.append(key),
        callee.call.append(key), callee.call.readFee(feeKey),
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });

    await expect(composition.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 120_000);

  it('settles fan-out to two independently authenticated physical participants', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const sinkArtifact = compileString(`contract ComposeFanoutSink() {
      function ping(int value) public { require(value >= 0); }
    }`, { forceStateful: true, messageBus: true });
    const connectSink = async (): Promise<StatefulContract> => {
      const base = new Contract(sinkArtifact, [], { provider });
      const setup = await setupStatefulUtxos(
        provider, base, sinkArtifact.stateLayout!, {}, { saltContract: true },
      );
      return StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
    };
    const first = await connectSink();
    const second = await connectSink();
    const callerArtifact = compileString(`
      interface IComposeFanoutSink { function ping(int value); }
      contract ComposeFanoutCaller(address first, address second) {
        function invoke(int value) public {
          IComposeFanoutSink(first).ping(value);
          IComposeFanoutSink(second).ping(9);
          require(value >= 0);
        }
      }
    `, { forceStateful: true, messageBus: true });
    const callerBase = new Contract(
      callerArtifact, [first.inner.lockingBytecode, second.inner.lockingBytecode], { provider },
    );
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const composition = messageBus.compose({
      calls: [caller.call.invoke(7n), first.call.ping(7n), second.call.ping(9n)],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });
    const canonical = await composition.build();
    expect(canonical.inputs).toHaveLength(7);
    expect(vmRejects(canonical)).toBe(false);
    const hostile = await composition.build();
    mutateAuthenticatedFrame(hostile, '', 'messageEnvelope-invocation-target');
    expect(vmRejects(hostile)).toBe(true);
    await expect(canonical.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 120_000);

  it('authenticates taken and untaken conditional call reachability exactly', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const sinkArtifact = compileString(`contract ComposeBranchSink() {
      function ping(int value) public { require(value >= 0); }
    }`, { forceStateful: true, messageBus: true });
    const connectSink = async (): Promise<StatefulContract> => {
      const base = new Contract(sinkArtifact, [], { provider });
      const setup = await setupStatefulUtxos(
        provider, base, sinkArtifact.stateLayout!, {}, { saltContract: true },
      );
      return StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
    };
    const always = await connectSink();
    const conditional = await connectSink();
    const callerArtifact = compileString(`
      interface IComposeBranchSink { function ping(int value); }
      contract ComposeBranchCaller(address always, address conditional) {
        function invoke(bool takeBranch, int value) public {
          IComposeBranchSink(always).ping(value);
          if (takeBranch) { IComposeBranchSink(conditional).ping(9); }
          require(value >= 0);
        }
      }
    `, { forceStateful: true, messageBus: true });
    const callerBase = new Contract(
      callerArtifact, [always.inner.lockingBytecode, conditional.inner.lockingBytecode], { provider },
    );
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const taken = messageBus.compose({
      calls: [caller.call.invoke(true, 7n), always.call.ping(7n), conditional.call.ping(9n)],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });
    const untaken = messageBus.compose({
      calls: [caller.call.invoke(false, 7n), always.call.ping(7n)],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });
    const canonicalTaken = await taken.build();
    const canonicalUntaken = await untaken.build();
    expect(vmRejects(canonicalTaken)).toBe(false);
    expect(vmRejects(canonicalUntaken)).toBe(false);
    const omitted = await taken.build();
    mutateAuthenticatedFrame(omitted, '', 'messageEnvelope-invocation-drop');
    expect(vmRejects(omitted)).toBe(true);
    const phantom = await untaken.build();
    mutateAuthenticatedFrame(phantom, '', 'messageEnvelope-invocation-duplicate');
    expect(vmRejects(phantom)).toBe(true);
    await expect(canonicalTaken.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 120_000);

  it('uses stable callsites to distinguish conditional calls to the same method', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const sinkArtifact = compileString(`contract ComposeRepeatedBranchSink() {
      function ping(int value) public { require(value >= 0); }
    }`, { forceStateful: true, messageBus: true });
    const sinkBase = new Contract(sinkArtifact, [], { provider });
    const sinkSetup = await setupStatefulUtxos(
      provider, sinkBase, sinkArtifact.stateLayout!, {}, { saltContract: true },
    );
    const sink = StatefulContract.withCategory(
      sinkBase.withCategory(hexToBin(sinkSetup.categoryId)), sinkSetup.categoryId,
    );
    const callerArtifact = compileString(`
      interface IComposeRepeatedBranchSink { function ping(int value); }
      contract ComposeRepeatedBranchCaller(address sink) {
        function invoke(bool first, bool second, bool third) public {
          if (first) { IComposeRepeatedBranchSink(sink).ping(1); }
          if (second) { IComposeRepeatedBranchSink(sink).ping(2); }
          if (third) { IComposeRepeatedBranchSink(sink).ping(3); }
          require(true);
        }
      }
    `, { forceStateful: true, messageBus: true });
    const callerBase = new Contract(callerArtifact, [sink.inner.lockingBytecode], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    const callsites = callerArtifact.abi.find((candidate) => candidate.name === 'invoke')?.externalCalls ?? [];
    expect(callsites).toHaveLength(3);
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const composition = messageBus.compose({
      preparedCalls: [
        { contract: caller, functionName: 'invoke', args: [false, true, false] },
        { contract: sink, functionName: 'ping', args: [2n], callsiteId: callsites[1].callsiteId },
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });
    const canonical = await composition.build();
    await expect(canonical.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 120_000);

  it('authenticates bounded-loop occurrence floors, ceilings, and exact row consumption', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const sinkArtifact = compileString(`contract ComposeLoopSink() {
      function ping(int value) public { require(value >= 0); }
    }`, { forceStateful: true, messageBus: true });
    const sinkBase = new Contract(sinkArtifact, [], { provider });
    const sinkSetup = await setupStatefulUtxos(
      provider, sinkBase, sinkArtifact.stateLayout!, {}, { saltContract: true },
    );
    const sinkInner = sinkBase.withCategory(hexToBin(sinkSetup.categoryId));
    const sink = StatefulContract.withCategory(sinkInner, sinkSetup.categoryId);
    const callerArtifact = compileString(`
      interface IComposeLoopSink { function ping(int value); }
      contract ComposeLoopCaller(address sink) {
        function invoke(int value) public {
          for (int i = 0; i < 2; i = i + 1) { IComposeLoopSink(sink).ping(value); }
          require(value >= 0);
        }
      }
    `, { forceStateful: true, messageBus: true });
    const callerBase = new Contract(callerArtifact, [sinkInner.lockingBytecode], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const composition = messageBus.compose({
      calls: [caller.call.invoke(7n), sink.call.ping(7n), sink.call.ping(7n)],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });
    const canonical = await composition.build();
    expect(vmRejects(canonical)).toBe(false);
    await expect(messageBus.compose({
      calls: [caller.call.invoke(7n), sink.call.ping(7n)],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    }).build()).rejects.toThrow(/below the 2 proven by a compile-time trip count/);
    await expect(messageBus.compose({
      calls: [caller.call.invoke(7n), sink.call.ping(7n), sink.call.ping(7n), sink.call.ping(7n)],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    }).build()).rejects.toThrow(/compiled graph reaches 3/);
    for (const mutation of ['messageEnvelope-invocation-drop', 'messageEnvelope-invocation-duplicate'] as const) {
      const hostile = await composition.build();
      mutateAuthenticatedFrame(hostile, '', mutation);
      expect(vmRejects(hostile), mutation).toBe(true);
    }
    await expect(canonical.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 120_000);

  it('authenticates staticcall mode and enforces a read-only participant snapshot', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const connect = async (artifact: ReturnType<typeof compileString>): Promise<StatefulContract> => {
      const base = new Contract(artifact, [], { provider });
      const setup = await setupStatefulUtxos(
        provider, base, artifact.stateLayout!, {}, { saltContract: true },
      );
      return StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
    };
    const readonlyArtifact = compileString(`contract ComposeStaticSink() {
      function peek() public pure { require(true); }
    }`, { forceStateful: true, messageBus: true });
    const readonly = await connect(readonlyArtifact);
    const callerArtifact = compileString(`
      interface IComposeStaticSink { function peek(); }
      contract ComposeStaticCaller(address sink) {
        function invoke() public {
          IComposeStaticSink(sink).peek.staticcall();
          require(true);
        }
      }
    `, { forceStateful: true, messageBus: true });
    const callerBase = new Contract(callerArtifact, [readonly.inner.lockingBytecode], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const composition = messageBus.compose({
      calls: [caller.call.invoke(), readonly.call.peek()],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });
    const canonical = await composition.build();
    const verifierIndex = canonical.inputs.findIndex(
      (input) => input.token?.nft?.commitment.startsWith('4c335631'),
    );
    if (verifierIndex < 0) throw new Error('test could not locate a deployed message bus verifier input');
    const messageEnvelopePush = decodeAuthenticationInstructions(
      canonical.inputs[verifierIndex].unlocker!.generateUnlockingBytecode({
        transaction: canonical.buildLibauthTransaction(), inputIndex: verifierIndex,
      }),
    ).find((instruction) => 'data' in instruction && binToHex(instruction.data).startsWith('4c334331'));
    if (!messageEnvelopePush || !('data' in messageEnvelopePush)) throw new Error('test could not locate canonical messageEnvelope');
    const staticRow = decodeAtomicMessageEnvelope(messageEnvelopePush.data).rows.find(
      (row) => row.kind === 0 && row.parent !== 0xffff,
    );
    expect(staticRow?.mode).toBe(1);
    expect(vmRejects(canonical)).toBe(false);
    const renamed = await composition.build();
    mutateAuthenticatedFrame(renamed, '', 'messageEnvelope-invocation-mode');
    expect(vmRejects(renamed)).toBe(true);

    const mutableArtifact = compileString(`contract ComposeStaticMutation() {
      event Changed(int next);
      function mutate() public {
        emit Changed(9);
        require(true);
      }
    }`, { forceStateful: true, messageBus: true });
    const mutable = await connect(mutableArtifact);
    const mutatingCallerArtifact = compileString(`
      interface IComposeStaticMutation { function mutate(); }
      contract ComposeStaticMutationCaller(address sink) {
        function invoke() public {
          IComposeStaticMutation(sink).mutate.staticcall();
          require(true);
        }
      }
    `, { forceStateful: true, messageBus: true });
    const mutatingCallerBase = new Contract(
      mutatingCallerArtifact, [mutable.inner.lockingBytecode], { provider },
    );
    const mutatingCallerSetup = await setupStatefulUtxos(
      provider, mutatingCallerBase, mutatingCallerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const mutatingCaller = StatefulContract.withCategory(
      mutatingCallerBase.withCategory(hexToBin(mutatingCallerSetup.categoryId)), mutatingCallerSetup.categoryId,
    );
    await expect(messageBus.compose({
      calls: [mutatingCaller.call.invoke(), mutable.call.mutate()],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    }).build()).rejects.toThrow(/BCH-2026 preflight failed at input 1/);
    await expect(canonical.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 120_000);

  it('decodes and authenticates a low-level target, selector, calldata, and result', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const targetArtifact = compileString(`contract ComposeRawTarget() {
      function echo(int value) public pure returns (int) { return value; }
    }`, { forceStateful: true, messageBus: true });
    const targetBase = new Contract(targetArtifact, [], { provider });
    const targetSetup = await setupStatefulUtxos(
      provider, targetBase, targetArtifact.stateLayout!, {}, { saltContract: true },
    );
    const target = StatefulContract.withCategory(
      targetBase.withCategory(hexToBin(targetSetup.categoryId)), targetSetup.categoryId,
    );
    const selector = targetArtifact.abi.find((fn) => fn.name === 'echo')?.selector;
    if (!selector) throw new Error('test target did not publish its selector');
    const payload = new Uint8Array([
      ...hexToBin(selector), ...scriptToBytecode([bigIntToVmNumber(3n)]),
    ]);
    const callerArtifact = compileString(`contract ComposeRawCaller() {
      function invoke(address target, bytes payload) public {
        (bool ok, bytes result) = target.call(payload);
        require(ok && result == hex"53");
      }
    }`, { forceStateful: true, messageBus: true });
    const callerBase = new Contract(callerArtifact, [], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const composition = messageBus.compose({
      calls: [caller.call.invoke(target.inner.lockingBytecode, payload), target.call.echo(3n)],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });
    const canonical = await composition.build();
    expect(vmRejects(canonical)).toBe(false);
    for (const mutation of [
      'messageEnvelope-invocation-target', 'messageEnvelope-context-selector', 'messageEnvelope-context-args',
      'messageEnvelope-result',
    ] as const) {
      const hostile = await composition.build();
      mutateAuthenticatedFrame(hostile, '', mutation);
      expect(vmRejects(hostile), mutation).toBe(true);
    }
    await expect(canonical.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 120_000);

  it('authenticates a kernel low-level call whose result is discarded', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const targetArtifact = compileString(`contract ComposeVoidRawTarget() {
      function echo(int value) public pure returns (int) { return value; }
    }`, { forceStateful: true, messageBus: true, messageBusKernel: true });
    const targetBase = new Contract(targetArtifact, [], { provider });
    const targetSetup = await setupStatefulUtxos(
      provider, targetBase, targetArtifact.stateLayout!, {}, { saltContract: true },
    );
    const target = StatefulContract.withCategory(
      targetBase.withCategory(hexToBin(targetSetup.categoryId)), targetSetup.categoryId,
    );
    const selector = targetArtifact.abi.find((fn) => fn.name === 'echo')?.selector;
    if (!selector) throw new Error('test target did not publish its selector');
    const payload = new Uint8Array([
      ...hexToBin(selector), ...scriptToBytecode([bigIntToVmNumber(3n)]),
    ]);
    const callerArtifact = compileString(`contract ComposeVoidRawCaller(address target) {
      function invoke(bytes payload) public {
        target.call(payload);
        require(true);
      }
    }`, { forceStateful: true, messageBus: true, messageBusKernel: true });
    expect(callerArtifact.messageBus?.handlers.find((handler) => handler.name === 'invoke'))
      .toMatchObject({ eligible: true });
    const callerBase = new Contract(
      callerArtifact, [hexToBin(target.inner.lockingBytecode)], { provider },
    );
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const composition = messageBus.compose({
      calls: [caller.call.invoke(payload), target.call.echo(3n)],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });
    const canonical = await composition.build();
    expect(vmRejects(canonical)).toBe(false);
    const hostileResult = await composition.build();
    mutateAuthenticatedFrame(hostileResult, '', 'messageEnvelope-result');
    expect(vmRejects(hostileResult)).toBe(true);
    await expect(canonical.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 120_000);

  it.skipIf(process.env.TESTS_USE_REGTEST === 'true')(
    'advances past a reached conditional opaque-return row in a delegated root', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const targetArtifact = compileString(`
      pragma solidity ^0.8.20;
      contract ComposeConditionalRawTarget {
        function approve(address spender, uint256 value) public pure returns (bool) {
          require(spender != address(0) && value > 0);
          return true;
        }
      }
    `, { forceStateful: true, messageBus: true, solidityImportCompat: true });
    const targetBase = new Contract(targetArtifact, [], { provider });
    const targetSetup = await setupStatefulUtxos(
      provider, targetBase, targetArtifact.stateLayout!, {}, { saltContract: true },
    );
    const target = StatefulContract.withCategory(
      targetBase.withCategory(hexToBin(targetSetup.categoryId)), targetSetup.categoryId,
    );
    const dataArtifact = compileString(`
      pragma solidity ^0.8.20;
      contract ComposeConditionalRawData {
        function userRegistered(address account) public pure returns (bool) {
          return account != address(0);
        }
        function eventsLength(uint256 key) public pure returns (uint256) { return key + 99; }
        function publish(uint256 value) public pure { require(value == 100); }
        function fee() public pure returns (uint256) { return 9; }
      }
    `, { forceStateful: true, messageBus: true, solidityImportCompat: true });
    const dataBase = new Contract(dataArtifact, [], { provider });
    const dataSetup = await setupStatefulUtxos(
      provider, dataBase, dataArtifact.stateLayout!, {}, { saltContract: true },
    );
    const data = StatefulContract.withCategory(
      dataBase.withCategory(hexToBin(dataSetup.categoryId)), dataSetup.categoryId,
    );
    const payArtifact = compileString(`
      pragma solidity ^0.8.20;
      contract ComposeConditionalRawPay {
        function pay(uint256 feeValue) public pure { require(feeValue == 9); }
      }
    `, { forceStateful: true, messageBus: true, solidityImportCompat: true });
    const payBase = new Contract(payArtifact, [], { provider });
    const paySetup = await setupStatefulUtxos(
      provider, payBase, payArtifact.stateLayout!, {}, { saltContract: true },
    );
    const pay = StatefulContract.withCategory(
      payBase.withCategory(hexToBin(paySetup.categoryId)), paySetup.categoryId,
    );
    const callerArtifact = compileString(`
      pragma solidity ^0.8.20;
      interface IComposeConditionalRawTarget {
        function approve(address spender, uint256 value) external returns (bool);
      }
      interface IComposeConditionalRawData {
        function userRegistered(address account) external returns (bool);
        function eventsLength(uint256 key) external returns (uint256);
        function publish(uint256 value) external;
        function fee() external returns (uint256);
      }
      interface IComposeConditionalRawPay { function pay(uint256 feeValue) external; }
      library ComposeConditionalRaw {
        function callBool(address target, bytes memory payload) internal returns (bool) {
          (bool ok, bytes returned) = target.call(payload);
          return ok && (returned.length == 0 || abi.decode(returned, (bool)))
            && target.code.length > 0;
        }
        function callVoid(address target, bytes memory payload) internal {
          (bool ok, bytes returned) = target.call(payload);
          require(ok && (returned.length == 0 || abi.decode(returned, (bool))));
        }
        function invoke(address target, address spender, uint256 value) internal {
          bytes memory payload = abi.encodeCall(IComposeConditionalRawTarget.approve, (spender, value));
          if (!callBool(target, payload)) {
            callVoid(target, abi.encodeCall(IComposeConditionalRawTarget.approve, (spender, 0)));
            callVoid(target, payload);
          }
        }
      }
      contract ComposeConditionalRawCaller {
        uint256 marker;
        function invoke(
          address target, address spender, address dataTarget, address payTarget,
          uint256 value, bool runApproval
        ) public {
          require(IComposeConditionalRawData(dataTarget).userRegistered(spender));
          uint256 eventCount = IComposeConditionalRawData(dataTarget).eventsLength(1);
          this.marker = eventCount;
          IComposeConditionalRawData(dataTarget).publish(eventCount);
          if (runApproval) { ComposeConditionalRaw.invoke(target, spender, value); }
          IComposeConditionalRawPay(payTarget).pay(IComposeConditionalRawData(dataTarget).fee());
          require(true);
        }
      }
    `, { forceStateful: true, messageBus: true, solidityImportCompat: true });
    expect(callerArtifact.delegateArtifact).toBeDefined();
    const signer = new Signer(alicePriv, provider);
    for (let index = 0; index < 8; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: `${(0xd0 + index).toString(16)}`.repeat(32), vout: 0, satoshis: 1_000_000n,
      });
    }
    const proxy = await upgrades.deployProxy(
      getContractFactory(callerArtifact, signer), { marker: 0n }, { initializer: false },
    );
    proxy.implementation._registerResolvedExternal('IComposeConditionalRawTarget', target);
    proxy.implementation._registerResolvedExternal('IComposeConditionalRawData', data);
    proxy.implementation._registerResolvedExternal('IComposeConditionalRawPay', pay);
    const rootArgs = [
      target.inner.lockingBytecode, target.inner.lockingBytecode, data.inner.lockingBytecode,
      pay.inner.lockingBytecode, 7n, true,
    ] as const;
    const executionArtifact = proxy.implementation.inner.artifact;
    const callsites = executionArtifact.abi
      .find((candidate) => candidate.name === 'invoke')?.externalCalls ?? [];
    expect(callsites).toHaveLength(8);
    const registeredCallsite = callsites.find((callsite) => callsite.functionName === 'userRegistered');
    const eventsCallsite = callsites.find((callsite) => callsite.functionName === 'eventsLength');
    const publishCallsite = callsites.find((callsite) => callsite.functionName === 'publish');
    const approveCallsite = callsites.find((callsite) => callsite.rawFunctionName === 'approve');
    const feeCallsite = callsites.find((callsite) => callsite.functionName === 'fee');
    const payCallsite = callsites.find((callsite) => callsite.functionName === 'pay');
    if (!registeredCallsite || !eventsCallsite || !publishCallsite
      || !approveCallsite || !feeCallsite || !payCallsite) {
      throw new Error('test delegate did not publish its expected callsites');
    }
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const composition = messageBus.compose({
      preparedCalls: [
        {
          contract: proxy.proxy, functionName: 'invoke', args: rootArgs,
          executionArtifact, executor: proxy.implementation,
        },
        {
          contract: data, functionName: 'userRegistered', args: [target.inner.lockingBytecode],
          callsiteId: registeredCallsite.callsiteId,
        },
        { contract: data, functionName: 'eventsLength', args: [1n], callsiteId: eventsCallsite.callsiteId },
        { contract: data, functionName: 'publish', args: [100n], callsiteId: publishCallsite.callsiteId },
        {
          contract: target, functionName: 'approve', args: [target.inner.lockingBytecode, 7n],
          callsiteId: approveCallsite.callsiteId,
        },
        { contract: data, functionName: 'fee', args: [], callsiteId: feeCallsite.callsiteId },
        { contract: pay, functionName: 'pay', args: [9n], callsiteId: payCallsite.callsiteId },
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });
    const canonical = await composition.build();
    await expect(canonical.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }, 120_000,
  );

  it('co-spends a compiler-positioned blockhash oracle in the atomic participant block', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const before = await provider.getBlockHeight();
    await provider.mine(1);
    const height = before + 1;
    const hash = hexToBin(await provider.getBlockHash(height));
    const callerArtifact = compileString(`
      interface IComposeBlockhashSink { function accept(bytes32 value); }
      contract ComposeBlockhashCaller() {
        function invoke(address target, int height) public {
          bytes32 value = blockhash(height);
          IComposeBlockhashSink(target).accept(value);
          require(height > 0);
        }
      }
    `, { forceStateful: true, messageBus: true });
    const sinkArtifact = compileString(`contract ComposeBlockhashSink() {
      function accept(bytes32 value) public pure { require(value.length == 32); }
    }`, { forceStateful: true, messageBus: true });
    const callerBase = new Contract(callerArtifact, [], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, {
        saltContract: true,
        extraOutputs: (category) => [{
          address: binToHex(blockhashOracleLockingBytecode(hexToBin(category), BigInt(height))),
          satoshis: 1000n,
          token: {
            amount: 0n,
            nft: {
              capability: 'none',
              commitment: binToHex(buildBlockhashCommitment(BigInt(height), hash)),
            },
          },
        }],
      },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    const sinkBase = new Contract(sinkArtifact, [], { provider });
    const sinkSetup = await setupStatefulUtxos(
      provider, sinkBase, sinkArtifact.stateLayout!, {}, { saltContract: true },
    );
    const sink = StatefulContract.withCategory(
      sinkBase.withCategory(hexToBin(sinkSetup.categoryId)), sinkSetup.categoryId,
    );
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const composition = messageBus.compose({
      calls: [caller.call.invoke(sink.inner.lockingBytecode, BigInt(height)), sink.call.accept(hash)],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });
    const canonical = await composition.build();
    expect(vmRejects(canonical)).toBe(false);
    for (const mutation of ['stale', 'substituted', 'omitted', 'duplicate'] as const) {
      const hostile = await composition.build();
      if (mutation === 'stale') {
        hostile.inputs[1] = {
          ...hostile.inputs[1],
          token: { ...hostile.inputs[1].token!, nft: { ...hostile.inputs[1].token!.nft! } },
        };
        hostile.inputs[1].token!.nft!.commitment = binToHex(
          buildBlockhashCommitment(BigInt(height - 1), hash),
        );
      } else if (mutation === 'substituted') {
        hostile.inputs[1] = {
          ...hostile.inputs[1],
          token: { ...hostile.inputs[1].token!, nft: { ...hostile.inputs[1].token!.nft! } },
        };
        const wrongHash = hash.slice();
        wrongHash[0] ^= 1;
        hostile.inputs[1].token!.nft!.commitment = binToHex(
          buildBlockhashCommitment(BigInt(height), wrongHash),
        );
      } else if (mutation === 'omitted') {
        hostile.inputs[1] = { ...hostile.inputs[2] };
      } else {
        hostile.inputs[2] = { ...hostile.inputs[1] };
      }
      expect(vmRejects(hostile), mutation).toBe(true);
    }
    await expect(canonical.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 120_000);

  it('co-spends and recreates a keccak sidecar at its exact atomic slot', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const callerArtifact = compileString(`
      interface IComposeKeccakSink { function accept(bytes32 value); }
      contract ComposeKeccakCaller() {
        function invoke(address target, bytes32 payload) public {
          bytes32 value = keccak256(payload);
          IComposeKeccakSink(target).accept(value);
          require(payload.length > 0);
        }
      }
    `, { forceStateful: true, messageBus: true });
    const sinkArtifact = compileString(`contract ComposeKeccakSink() {
      function accept(bytes32 value) public pure { require(value.length == 32); }
    }`, { forceStateful: true, messageBus: true });
    const payload = hexToBin('01'.repeat(32));
    const digest = keccak_256(payload);
    const sidecarCategory = 'ee'.repeat(32);
    const callerBase = new Contract(callerArtifact, [], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const sidecarLock = binToHex(keccakComputeLockingBytecode(
      hexToBin(callerSetup.categoryId).reverse(), true,
    ));
    for (let index = 0; index < 2; index += 1) {
      await provider.addUtxo(sidecarLock, {
        ...randomUtxo({ satoshis: 100_000n }),
        token: {
          category: sidecarCategory, amount: 0n,
          nft: { capability: 'mutable', commitment: '' },
        },
      });
    }
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    const sinkBase = new Contract(sinkArtifact, [], { provider });
    const sinkSetup = await setupStatefulUtxos(
      provider, sinkBase, sinkArtifact.stateLayout!, {}, { saltContract: true },
    );
    const sink = StatefulContract.withCategory(
      sinkBase.withCategory(hexToBin(sinkSetup.categoryId)), sinkSetup.categoryId,
    );
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const composition = messageBus.compose({
      calls: [caller.call.invoke(sink.inner.lockingBytecode, payload), sink.call.accept(digest)],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });
    const canonical = await composition.build();
    const sidecarOffset = callerArtifact.messageBus!.route.blockLayout!.slots.find(
      (slot) => slot.kind === 'keccakSideCar',
    )?.offset;
    if (sidecarOffset === undefined) throw new Error('test caller published no keccak sidecar slot');
    expect(vmRejects(canonical)).toBe(false);
    const wrongRecreation = await composition.build();
    wrongRecreation.outputs[sidecarOffset] = {
      ...wrongRecreation.outputs[sidecarOffset],
      token: {
        ...wrongRecreation.outputs[sidecarOffset].token!,
        nft: { ...wrongRecreation.outputs[sidecarOffset].token!.nft!, commitment: '00'.repeat(32) },
      },
    };
    expect(vmRejects(wrongRecreation)).toBe(true);
    const omitted = await composition.build();
    omitted.inputs[sidecarOffset] = { ...omitted.inputs[sidecarOffset + 1] };
    expect(vmRejects(omitted)).toBe(true);
    const duplicate = await composition.build();
    duplicate.inputs[sidecarOffset + 1] = { ...duplicate.inputs[sidecarOffset] };
    expect(vmRejects(duplicate)).toBe(true);
    await expect(canonical.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 120_000);

  it('hash-commits an aggregate return vector larger than one NFT commitment', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const calleeArtifact = compileString(`contract ComposeLongReturnCallee() {
      function value(bytes32 item) public pure returns (bytes32) {
        require(item.length == 32);
        return item;
      }
    }`, { forceStateful: true, messageBus: true, solidityImportCompat: true });
    const callerArtifact = compileString(`
      interface IComposeLongReturnCallee { function value(bytes32 item) external returns (bytes32); }
      contract ComposeLongReturnCaller(address callee) {
        function run(bytes32 a, bytes32 b, bytes32 c, bytes32 d) public {
          require(IComposeLongReturnCallee(callee).value(a) == a);
          require(IComposeLongReturnCallee(callee).value(b) == b);
          require(IComposeLongReturnCallee(callee).value(c) == c);
          require(IComposeLongReturnCallee(callee).value(d) == d);
        }
      }
    `, { forceStateful: true, messageBus: true, solidityImportCompat: true });
    const calleeBase = new Contract(calleeArtifact, [], { provider });
    const calleeSetup = await setupStatefulUtxos(
      provider, calleeBase, calleeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const callee = StatefulContract.withCategory(
      calleeBase.withCategory(hexToBin(calleeSetup.categoryId)), calleeSetup.categoryId,
    );
    const callerBase = new Contract(callerArtifact, [callee.inner.lockingBytecode], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    const values = [1, 2, 3, 4].map((prefix) => Uint8Array.from({ length: 32 }, (_unused, index) => prefix + index));
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const built = await messageBus.compose({
      calls: [
        caller.call.run(...values),
        ...values.map((value) => callee.call.value(value)),
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    }).build();
    const longReturn = built.outputs.find((output) => output.token?.category === calleeSetup.categoryId
      && output.token.nft?.capability === 'none');
    expect(longReturn?.token?.nft?.commitment).toMatch(/^[0-9a-f]{64}$/);
    await expect(built.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 120_000);

  it('co-spends and recreates an ecrecover A/B pair at exact atomic slots', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const wallet = new ethers.Wallet(`0x${'11'.repeat(32)}`);
    const message = 'atomic-single-tx-bus';
    const signature = await wallet.signMessage(message);
    const digestHex = ethers.hashMessage(message);
    const parsed = ethers.Signature.from(signature);
    const littleEndian = (value: string): Uint8Array => hexToBin(value.replace(/^0x/, '')).reverse();
    const digest = littleEndian(digestHex);
    const r = littleEndian(parsed.r);
    const s = littleEndian(parsed.s);
    const callerArtifact = compileString(`
      interface IComposeRecoverSink {
        function recover(bytes32 h, int v, bytes32 r, bytes32 s);
      }
      contract ComposeRecoverCaller() {
        function invoke(address target, bytes32 h, int v, bytes32 r, bytes32 s) public {
          IComposeRecoverSink(target).recover(h, v, r, s);
          require(v == 27 || v == 28);
        }
      }
    `, { forceStateful: true, messageBus: true });
    const sinkArtifact = compileString(`contract ComposeRecoverSink() {
      function recover(bytes32 h, int v, bytes32 r, bytes32 s) public {
        pubkey value = ecrecoverPubKey(h, v, r, s);
        require(value.length == 33);
      }
    }`, { forceStateful: true, messageBus: true });
    const callerBase = new Contract(callerArtifact, [], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    const sinkBase = new Contract(sinkArtifact, [], { provider });
    const sinkSetup = await setupStatefulUtxos(
      provider, sinkBase, sinkArtifact.stateLayout!, {}, { saltContract: true },
    );
    const sink = StatefulContract.withCategory(
      sinkBase.withCategory(hexToBin(sinkSetup.categoryId)), sinkSetup.categoryId,
    );
    const salt = new Uint8Array(32);
    const sidecarCategory = 'ed'.repeat(32);
    for (const role of ['A', 'B'] as const) {
      await provider.addUtxo(binToHex(ecrecoverComputeLockingBytecode(salt, role)), {
        ...randomUtxo({ satoshis: 100_000n }),
        token: {
          category: sidecarCategory, amount: 0n,
          nft: { capability: 'mutable', commitment: '' },
        },
      });
    }
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const composition = messageBus.compose({
      calls: [
        caller.call.invoke(sink.inner.lockingBytecode, digest, BigInt(parsed.v), r, s),
        sink.call.recover(digest, BigInt(parsed.v), r, s),
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });
    const canonical = await composition.build();
    const sinkBaseOffset = callerArtifact.messageBus!.route.blockLayout!.blockSize;
    const offsets = sinkArtifact.messageBus!.route.blockLayout!.slots
      .filter((slot) => slot.kind === 'ecrecoverSideCar')
      .map((slot) => sinkBaseOffset + slot.offset);
    // Each possible kernel row owns an independent A/B pair. Sharing one pair across repeated recovery rows
    // would let distinct arguments alias one computed result; this one-row envelope activates the first pair.
    expect(offsets).toHaveLength(sinkArtifact.messageBus!.maximumRows * 2);
    expect(vmRejects(canonical)).toBe(false);
    const wrongRecreation = await composition.build();
    wrongRecreation.outputs[offsets[1]] = {
      ...wrongRecreation.outputs[offsets[1]],
      token: {
        ...wrongRecreation.outputs[offsets[1]].token!,
        nft: { ...wrongRecreation.outputs[offsets[1]].token!.nft!, commitment: '00'.repeat(33) },
      },
    };
    expect(vmRejects(wrongRecreation)).toBe(true);
    const swapped = await composition.build();
    [swapped.inputs[offsets[0]], swapped.inputs[offsets[1]]] = [
      swapped.inputs[offsets[1]], swapped.inputs[offsets[0]],
    ];
    expect(vmRejects(swapped)).toBe(true);
    const duplicated = await composition.build();
    duplicated.inputs[offsets[1]] = { ...duplicated.inputs[offsets[0]] };
    expect(vmRejects(duplicated)).toBe(true);
    await expect(canonical.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 120_000);

  it('learns computed ecrecover arguments under the shared atomic graph lock', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const wallet = new ethers.Wallet(`0x${'11'.repeat(32)}`);
    const digest = ethers.keccak256(new TextEncoder().encode('atomic-computed-recovery'));
    const sourceHash = hexToBin(digest.slice(2));
    const parsed = wallet.signingKey.sign(digest);
    const littleEndian = (value: string): Uint8Array => hexToBin(value.replace(/^0x/, '')).reverse();
    const expected = hash160(hexToBin(ethers.SigningKey.computePublicKey(wallet.signingKey.publicKey, true).slice(2)));
    const r = littleEndian(parsed.r);
    const s = littleEndian(parsed.s);
    const callerArtifact = compileString(`
      interface IComputedRecoverSink {
        function recover(bytes32 sourceHash, int v, bytes32 r, bytes32 s, bytes20 expected);
      }
      contract ComputedRecoverCaller() {
        function invoke(address target, bytes32 sourceHash, int v, bytes32 r, bytes32 s, bytes20 expected) public {
          IComputedRecoverSink(target).recover(sourceHash, v, r, s, expected);
          require(v == 27 || v == 28);
        }
      }
    `, { forceStateful: true, messageBus: true });
    const sinkArtifact = compileString(`contract ComputedRecoverSink() {
      function recover(bytes32 sourceHash, int v, bytes32 r, bytes32 s, bytes20 expected) public {
        pubkey value = ecrecoverPubKey(bytes32(bytes(sourceHash).reverse()), v, r, s);
        require(value.length == 33);
      }
    }`, { forceStateful: true, messageBus: true });
    const handler = sinkArtifact.messageBus?.handlers.find((candidate) => candidate.name === 'recover');
    expect(handler?.ecrecoverArgParams).toEqual([[null, 'v', 'r', 's']]);

    const callerBase = new Contract(callerArtifact, [], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    const sinkBase = new Contract(sinkArtifact, [], { provider });
    const sinkSetup = await setupStatefulUtxos(
      provider, sinkBase, sinkArtifact.stateLayout!, {}, { saltContract: true },
    );
    const sink = StatefulContract.withCategory(
      sinkBase.withCategory(hexToBin(sinkSetup.categoryId)), sinkSetup.categoryId,
    );
    const sidecarCategory = 'ec'.repeat(32);
    for (const role of ['A', 'B'] as const) {
      await provider.addUtxo(binToHex(ecrecoverComputeLockingBytecode(new Uint8Array(32), role)), {
        ...randomUtxo({ satoshis: 100_000n }),
        token: {
          category: sidecarCategory, amount: 0n,
          nft: { capability: 'mutable', commitment: '' },
        },
      });
    }
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const args = [sourceHash, BigInt(parsed.v), r, s, expected] as const;
    const canonical = await messageBus.compose({
      calls: [
        caller.call.invoke(sink.inner.lockingBytecode, ...args),
        sink.call.recover(...args),
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    }).build();
    expect(vmRejects(canonical)).toBe(false);
    await expect(canonical.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 120_000);

  it('builds and broadcasts one transaction for two existing participants without setup execution', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const calleeArtifact = compileString(CALLEE, { forceStateful: true, messageBus: true });
    const calleeBase = new Contract(calleeArtifact, [], { provider });
    const calleeSetup = await setupStatefulUtxos(
      provider, calleeBase, calleeArtifact.stateLayout!, { counter: 0n }, { saltContract: true },
    );
    const calleeInner = calleeBase.withCategory(hexToBin(calleeSetup.categoryId));
    const callee = StatefulContract.withCategory(calleeInner, calleeSetup.categoryId);

    const callerArtifact = compileString(CALLER, { forceStateful: true, messageBus: true });
    const callerBase = new Contract(callerArtifact, [hexToBin(calleeInner.lockingBytecode)], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);

    const composition = messageBus.compose({
      calls: [caller.call.prepare(7n), callee.call.settle(7n)],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });
    await expect(messageBus.compose({
      calls: [caller.call.prepare(7n), callee.call.settle(8n)],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    }).build()).rejects.toThrow(/prepared call 1 .*arguments disagree/);
    await expect(messageBus.compose({
      calls: [caller.call.prepare(7n), callee.call.settle(7n)],
      funder: {
        utxo: fee.utxo,
        unlocker: { generateLockingBytecode: () => hexToBin(`aa20${'00'.repeat(32)}87`) } as never,
      },
      changeAddress: fee.unlocker.generateLockingBytecode(),
    }).build()).rejects.toThrow(/canonical fee tail must be a bare P2PKH input/);
    const built = await composition.build();
    expect(built.inputs).toHaveLength(8);
    expect(built.outputs).toHaveLength(8);
    // Graph finalization already produced the messageEnvelope before this transaction requested any signatures. Prove
    // that its exact physical push remains stable as each finalized input signature is regenerated in order.
    const finalizedTransaction = built.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(built.inputs);
    const verifierIndex = built.inputs.findIndex(
      (input) => input.token?.nft?.commitment.startsWith('4c335631'),
    );
    if (verifierIndex < 0) throw new Error('test could not locate a deployed message bus verifier input');
    const messageEnvelopePush = (): Uint8Array => {
      const instruction = decodeAuthenticationInstructions(
        finalizedTransaction.inputs[verifierIndex].unlockingBytecode,
      ).find((candidate) => 'data' in candidate && binToHex(candidate.data).startsWith('4c334331'));
      if (!instruction || !('data' in instruction)) throw new Error('test could not locate canonical messageEnvelope');
      return instruction.data;
    };
    const messageEnvelopeBeforeResigning = messageEnvelopePush();
    for (const [inputIndex, input] of built.inputs.entries()) {
      finalizedTransaction.inputs[inputIndex].unlockingBytecode = input.unlocker.generateUnlockingBytecode({
        transaction: finalizedTransaction, sourceOutputs, inputIndex,
      });
      expect(messageEnvelopePush()).toEqual(messageEnvelopeBeforeResigning);
    }
    expect(decodeAtomicMessageEnvelope(messageEnvelopeBeforeResigning)).toEqual(
      decodeAtomicMessageEnvelope(messageEnvelopePush()),
    );
    const hostileVerifierCommitment = await composition.build();
    const hostileVerifierIndex = hostileVerifierCommitment.inputs.findIndex(
      (input) => input.token?.nft?.commitment.startsWith('4c335631'),
    );
    if (hostileVerifierIndex < 0) throw new Error('test could not locate a deployed message bus verifier input');
    const verifierCommitment = hexToBin(
      hostileVerifierCommitment.outputs[hostileVerifierIndex].token!.nft!.commitment,
    );
    verifierCommitment[verifierCommitment.length - 1] ^= 1;
    hostileVerifierCommitment.outputs[hostileVerifierIndex].token!.nft!.commitment = binToHex(verifierCommitment);
    expect(vmRejects(hostileVerifierCommitment)).toBe(true);

    const hostileVerifierLock = await composition.build();
    const lockVerifierIndex = hostileVerifierLock.inputs.findIndex(
      (input) => input.token?.nft?.commitment.startsWith('4c335631'),
    );
    if (lockVerifierIndex < 0) throw new Error('test could not locate a deployed message bus verifier input');
    const verifierUnlocker = hostileVerifierLock.inputs[lockVerifierIndex].unlocker!;
    hostileVerifierLock.inputs[lockVerifierIndex].unlocker = {
      ...verifierUnlocker,
      generateLockingBytecode: () => Uint8Array.of(0x51),
    };
    expect(vmRejects(hostileVerifierLock)).toBe(true);

    for (const mutation of ['messageEnvelope', 'emissions'] as const) {
      const hostile = await composition.build();
      mutateAuthenticatedFrame(hostile, calleeArtifact.abi.find((fn) => fn.name === 'settle')!.selector!, mutation);
      await expect(provider.sendRawTransaction(raw(hostile))).rejects.toThrow();
    }
    const hostileCallManifestResult = await composition.build();
    mutateAuthenticatedFrame(
      hostileCallManifestResult,
      calleeArtifact.abi.find((fn) => fn.name === 'settle')!.selector!,
      'messageEnvelope-result',
    );
    await expect(provider.sendRawTransaction(raw(hostileCallManifestResult))).rejects.toThrow();

    const hostileReturnOutput = await composition.build();
    const returnOutput = hostileReturnOutput.outputs.find((output) =>
      output.token?.category === calleeSetup.categoryId
      && output.token.nft?.capability === 'none');
    if (!returnOutput?.token?.nft) throw new Error('test could not locate the callee return-event output');
    const commitment = hexToBin(returnOutput.token.nft.commitment);
    expect(commitment.length).toBeGreaterThan(1);
    commitment[commitment.length - 1] ^= 0x01;
    returnOutput.token.nft.commitment = binToHex(commitment);
    await expect(provider.sendRawTransaction(raw(hostileReturnOutput))).rejects.toThrow();
    await expect(composition.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect((await callee.getState()).counter).toBe(7n);
    const verifierLock = getMessageBusVerifierLockingBytecode(
      caller.inner, callerSetup.categoryId, caller.inner.addressType,
    );
    const verifierOutpointsBefore = (await provider.getUtxosForLockingBytecode(verifierLock))
      .map((utxo) => `${utxo.txid}:${utxo.vout}`).sort();
    await expect(caller.call.setDirect(9n).send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    const verifierOutpointsAfter = (await provider.getUtxosForLockingBytecode(verifierLock))
      .map((utxo) => `${utxo.txid}:${utxo.vout}`).sort();
    expect(verifierOutpointsAfter).toEqual(verifierOutpointsBefore);
    expect((await caller.getState()).marker).toBe(9n);
  }, 240_000);

  it('converges nested authenticated returns across an A-to-B-to-C graph', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const leafArtifact = compileString(`contract ComposeLeaf() {
      function leaf(int value) public pure returns (int) { return value * 2; }
    }`, {
      forceStateful: true, messageBus: true, solidityImportCompat: true, suppressWarnings: true,
    });
    const leafBase = new Contract(leafArtifact, [], { provider });
    const leafSetup = await setupStatefulUtxos(
      provider, leafBase, leafArtifact.stateLayout!, {}, { saltContract: true },
    );
    const leafInner = leafBase.withCategory(hexToBin(leafSetup.categoryId));
    const leaf = StatefulContract.withCategory(leafInner, leafSetup.categoryId);

    const middleArtifact = compileString(`
      interface IComposeLeaf { function leaf(int value) external returns (int); }
      contract ComposeMiddle(address leafAddress) {
        int counter;
        function middle(int value) public returns (int) {
          int doubled = IComposeLeaf(leafAddress).leaf(value);
          this.counter = doubled + 3;
          return this.counter;
        }
      }
    `, {
      forceStateful: true, messageBus: true, solidityImportCompat: true, suppressWarnings: true,
    });
    const middleBase = new Contract(middleArtifact, [leafInner.lockingBytecode], { provider });
    const middleSetup = await setupStatefulUtxos(
      provider, middleBase, middleArtifact.stateLayout!, {}, { saltContract: true },
    );
    const middleInner = middleBase.withCategory(hexToBin(middleSetup.categoryId));
    const middle = StatefulContract.withCategory(middleInner, middleSetup.categoryId);

    const rootArtifact = compileString(`
      interface IComposeMiddle { function middle(int value) external returns (int); }
      contract ComposeRoot(address middleAddress) {
        struct Record { int prefix; int returned; }
        Record[] jobs;
        function seed(int prefix) public {
          this.jobs.push(Record(prefix, 0));
          require(this.jobs.length == 1);
        }
        function root(int value) public {
          int result = IComposeMiddle(middleAddress).middle(value);
          this.jobs[0].returned = result;
          require(result == value * 2 + 3);
        }
      }
    `, {
      forceStateful: true, messageBus: true, solidityImportCompat: true, suppressWarnings: true,
    });
    const rootBase = new Contract(rootArtifact, [middleInner.lockingBytecode], { provider });
    const rootSetup = await setupStatefulUtxos(
      provider, rootBase, rootArtifact.stateLayout!, { jobs: [] }, { saltContract: true },
    );
    const root = StatefulContract.withCategory(
      rootBase.withCategory(hexToBin(rootSetup.categoryId)), rootSetup.categoryId,
    );
    await root.call.seed(7n).send();
    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      calls: [root.call.root(11n), middle.call.middle(11n), leaf.call.leaf(11n)],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });

    const built = await composition.build();
    expect(built.inputs).toHaveLength(built.outputs.length);
    expect(built.inputs.length).toBeGreaterThanOrEqual(6);
    await expect(composition.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect((await root.getState()).jobs).toEqual([{ prefix: 7n, returned: 25n }]);
  }, 120_000);

  it('applies a provisional sibling return before building dependent call arguments', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const sourceArtifact = compileString(`contract ComposeFeeSource() {
      function fee() public pure returns (uint16) { return 1; }
    }`, {
      forceStateful: true, messageBus: true, solidityImportCompat: true, suppressWarnings: true,
    });
    const sourceBase = new Contract(sourceArtifact, [], { provider });
    const sourceSetup = await setupStatefulUtxos(
      provider, sourceBase, sourceArtifact.stateLayout!, {}, { saltContract: true },
    );
    const source = StatefulContract.withCategory(
      sourceBase.withCategory(hexToBin(sourceSetup.categoryId)), sourceSetup.categoryId,
    );

    const sinkArtifact = compileString(`contract ComposeFeeSink() {
      uint16 lastFee;
      function accept(uint16 fee) public { this.lastFee = fee; require(fee == 1); }
    }`, {
      forceStateful: true, messageBus: true, solidityImportCompat: true, suppressWarnings: true,
    });
    const sinkBase = new Contract(sinkArtifact, [], { provider });
    const sinkSetup = await setupStatefulUtxos(
      provider, sinkBase, sinkArtifact.stateLayout!, {}, { saltContract: true },
    );
    const sink = StatefulContract.withCategory(
      sinkBase.withCategory(hexToBin(sinkSetup.categoryId)), sinkSetup.categoryId,
    );

    const rootArtifact = compileString(`
      interface IComposeFeeSource { function fee() external returns (uint16); }
      interface IComposeFeeSink { function accept(uint16 fee) external; }
      contract ComposeFeeRoot(address source, address sink) {
        function run() public {
          uint16 fee = IComposeFeeSource(source).fee();
          IComposeFeeSink(sink).accept(fee);
          require(true);
        }
      }
    `, {
      forceStateful: true, messageBus: true, solidityImportCompat: true, suppressWarnings: true,
    });
    const rootBase = new Contract(
      rootArtifact, [source.inner.lockingBytecode, sink.inner.lockingBytecode], { provider },
    );
    const rootSetup = await setupStatefulUtxos(
      provider, rootBase, rootArtifact.stateLayout!, {}, { saltContract: true },
    );
    const root = StatefulContract.withCategory(
      rootBase.withCategory(hexToBin(rootSetup.categoryId)), rootSetup.categoryId,
    );
    const run = rootArtifact.abi.find((fn) => fn.name === 'run')!;
    const sourceCallsite = run.externalCalls!.find((call) => call.functionName === 'fee')!.callsiteId!;
    const sinkCallsite = run.externalCalls!.find((call) => call.functionName === 'accept')!.callsiteId!;
    const provisionalFee = new Uint8Array(32);
    provisionalFee[31] = 1;
    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [
        { contract: root, functionName: 'run', args: [] },
        {
          contract: source,
          functionName: 'fee',
          args: [],
          callsiteId: sourceCallsite,
          provisionalResultCommitment: provisionalFee,
        },
        {
          contract: sink,
          functionName: 'accept',
          args: [0n],
          callsiteId: sinkCallsite,
          resolveArgsFromResults: (results) => {
            const resolvedFee = results.get(sourceCallsite);
            return resolvedFee === undefined ? undefined : [resolvedFee];
          },
        },
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });

    await expect(composition.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect((await sink.getState()).lastFee).toBe(1n);
  }, 120_000);

  it('decodes an authenticated dynamic Solidity return in a caller graph loop', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const sourceArtifact = compileString(`contract ComposeStringSource() {
      function label(string shortForm) public pure returns (string) { return "DIGITAL_VIDEO"; }
      function active() public pure returns (bool) { return true; }
    }`, {
      forceStateful: true, messageBus: true, solidityImportCompat: true, suppressWarnings: true,
    });
    const sourceBase = new Contract(sourceArtifact, [], { provider });
    const sourceSetup = await setupStatefulUtxos(
      provider, sourceBase, sourceArtifact.stateLayout!, {}, { saltContract: true },
    );
    const source = StatefulContract.withCategory(
      sourceBase.withCategory(hexToBin(sourceSetup.categoryId)), sourceSetup.categoryId,
    );

    const rootArtifact = compileString(`
      interface IComposeStringSource {
        function label(string shortForm) external returns (string);
        function active() external returns (bool);
      }
      contract ComposeStringRoot(address source) {
        uint256 labelLength;
        function run(string[] tags) public {
          uint256 matches = 0;
          for (uint256 i = 0; i < tags.length; i = i + 1) {
            string value = IComposeStringSource(source).label(tags[i]);
            if (bytes(value).length > 0) matches = matches + 1;
          }
          bool active = IComposeStringSource(source).active();
          this.labelLength = matches;
          require(this.labelLength == 1 && active);
        }
      }
    `, {
      forceStateful: true, messageBus: true, solidityImportCompat: true, suppressWarnings: true,
    });
    const rootBase = new Contract(rootArtifact, [source.inner.lockingBytecode], { provider });
    const rootSetup = await setupStatefulUtxos(
      provider, rootBase, rootArtifact.stateLayout!, {}, { saltContract: true },
    );
    const root = StatefulContract.withCategory(
      rootBase.withCategory(hexToBin(rootSetup.categoryId)), rootSetup.categoryId,
    );
    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      calls: [root.call.run(['DV']), source.call.label('DV'), source.call.active()],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });

    await expect(composition.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect((await root.getState()).labelLength).toBe(1n);
  }, 120_000);

  it('binds an emitted event row to its absolute physical output', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const calleeArtifact = compileString(`contract ComposeEventCallee() {
      event Settled(int value);
      function settle(int value) public { emit Settled(value); require(true); }
    }`, { forceStateful: true, messageBus: true });
    const calleeBase = new Contract(calleeArtifact, [], { provider });
    const calleeSetup = await setupStatefulUtxos(
      provider, calleeBase, calleeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const calleeInner = calleeBase.withCategory(hexToBin(calleeSetup.categoryId));
    const callee = StatefulContract.withCategory(calleeInner, calleeSetup.categoryId);
    const callerArtifact = compileString(`
      interface IComposeEventCallee { function settle(int value); }
      contract ComposeEventCaller(address calleeAddress) {
        function prepare(int value) public {
          IComposeEventCallee(calleeAddress).settle(value);
          require(true);
        }
      }
    `, { forceStateful: true, messageBus: true });
    const callerBase = new Contract(callerArtifact, [calleeInner.lockingBytecode], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      calls: [caller.call.prepare(13n), callee.call.settle(13n)],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });

    const built = await composition.build();
    const eventOutputIndex = built.outputs.findIndex((output) =>
      output.token?.category === calleeSetup.categoryId && output.token.nft?.capability === 'none');
    expect(eventOutputIndex).toBeGreaterThan(0);
    const hostileMessageEnvelope = await composition.build();
    mutateAuthenticatedFrame(hostileMessageEnvelope, '', 'messageEnvelope-event');
    await expect(provider.sendRawTransaction(raw(hostileMessageEnvelope))).rejects.toThrow();
    const hostileOutput = await composition.build();
    const commitment = hexToBin(hostileOutput.outputs[eventOutputIndex].token!.nft!.commitment);
    commitment[commitment.length - 1] ^= 0x01;
    hostileOutput.outputs[eventOutputIndex].token!.nft!.commitment = binToHex(commitment);
    await expect(provider.sendRawTransaction(raw(hostileOutput))).rejects.toThrow();
    await expect(composition.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 120_000);

  it('settles an authenticated mapping entry in a later participant block', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const calleeArtifact = compileString(`contract ComposeMappingCallee() {
      mapping(bigint => bigint) values;
      function set(bigint key, bigint value) public {
        this.values[key] = value;
        require(value >= 0);
      }
    }`, { forceStateful: true, messageBus: true });
    const calleeBase = new Contract(calleeArtifact, [], { provider });
    const key = 7n;
    const slot = keyToSlot(bigIntToVmNumber(key));
    const calleeSetup = await setupStatefulUtxos(provider, calleeBase, calleeArtifact.stateLayout!, {}, {
      saltContract: true,
      extraOutputs: (categoryId) => [{
        address: getEntryNftAddress(calleeBase, categoryId, 'values'),
        satoshis: 10_000n,
        token: {
          amount: 0n,
          nft: {
            capability: 'mutable',
            commitment: binToHex(encodeEntryCommitment(slot, new Uint8Array(32), bigIntToVmNumber(11n))),
          },
        },
      }],
    });
    const calleeInner = calleeBase.withCategory(hexToBin(calleeSetup.categoryId));
    const callee = StatefulContract.withCategory(calleeInner, calleeSetup.categoryId);
    const callerArtifact = compileString(`
      interface IComposeMappingCallee { function set(bigint key, bigint value); }
      contract ComposeMappingCaller(address calleeAddress) {
        function prepare(bigint key, bigint value) public {
          IComposeMappingCallee(calleeAddress).set(key, value);
          require(true);
        }
      }
    `, { forceStateful: true, messageBus: true });
    const callerBase = new Contract(callerArtifact, [calleeInner.lockingBytecode], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      calls: [caller.call.prepare(key, 77n), callee.call.set(key, 77n)],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });

    const built = await composition.build();
    const entryOutput = built.outputs.findIndex((output) =>
      output.token?.category === calleeSetup.categoryId && output.token.nft?.capability === 'mutable'
      && output.token.nft.commitment.length >= 128);
    expect(entryOutput).toBeGreaterThan(0);
    for (const mutation of [
      'messageEnvelope-resource', 'messageEnvelope-resource-mode', 'messageEnvelope-resource-slot', 'messageEnvelope-resource-subject',
    ] as const) {
      const hostileMessageEnvelope = await composition.build();
      mutateAuthenticatedFrame(hostileMessageEnvelope, '', mutation);
      const outcome = await provider.sendRawTransaction(raw(hostileMessageEnvelope)).then(() => 'accepted').catch(() => 'rejected');
      expect(outcome, mutation).toBe('rejected');
    }
    const hostileOutput = await composition.build();
    const commitment = hexToBin(hostileOutput.outputs[entryOutput].token!.nft!.commitment);
    commitment[commitment.length - 1] ^= 0x01;
    hostileOutput.outputs[entryOutput].token!.nft!.commitment = binToHex(commitment);
    await expect(provider.sendRawTransaction(raw(hostileOutput))).rejects.toThrow();
    await expect(composition.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 120_000);

  it('authenticates a created dynamic-state chunk inside the trailing region', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const calleeArtifact = compileString(`contract ComposeDynamicCallee() {
      bytes note;
      function set(bytes value) public { this.note = value; require(value.length > 0); }
    }`, { forceStateful: true, messageBus: true });
    const calleeBase = new Contract(calleeArtifact, [], { provider });
    const calleeSetup = await setupStatefulUtxos(
      provider, calleeBase, calleeArtifact.stateLayout!, { note: new Uint8Array() }, { saltContract: true },
    );
    const calleeInner = calleeBase.withCategory(hexToBin(calleeSetup.categoryId));
    const callee = StatefulContract.withCategory(calleeInner, calleeSetup.categoryId);
    const callerArtifact = compileString(`
      interface IComposeDynamicCallee { function set(bytes value); }
      contract ComposeDynamicCaller(address calleeAddress) {
        function prepare(bytes value) public {
          IComposeDynamicCallee(calleeAddress).set(value);
          require(true);
        }
      }
    `, { forceStateful: true, messageBus: true });
    const callerBase = new Contract(callerArtifact, [calleeInner.lockingBytecode], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    const value = Uint8Array.from({ length: 80 }, (_, index) => index + 1);
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const composition = messageBus.compose({
      calls: [caller.call.prepare(value), callee.call.set(value)],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });

    const built = await composition.build();
    const mutableOutputs = built.outputs
      .map((output, index) => ({ output, index }))
      .filter(({ output }) => output.token?.category === calleeSetup.categoryId
        && output.token.nft?.capability === 'mutable');
    expect(mutableOutputs.length).toBeGreaterThanOrEqual(2);
    const chunkOutput = mutableOutputs[mutableOutputs.length - 1].index;
    const hostileMessageEnvelope = await composition.build();
    mutateAuthenticatedFrame(hostileMessageEnvelope, '', 'messageEnvelope-resource-create');
    await expect(provider.sendRawTransaction(raw(hostileMessageEnvelope))).rejects.toThrow();
    for (const mutation of [
      'messageEnvelope-span-shrink', 'messageEnvelope-span-expand', 'messageEnvelope-span-maximum',
    ] as const) {
      const hostileSpan = await composition.build();
      mutateEveryEnvelopeAndRebind(hostileSpan, (manifest) => {
        const participantIndex = manifest.participants.findIndex((participant) =>
          mutation === 'messageEnvelope-span-shrink' ? participant.trailingUsed > 0
            : mutation === 'messageEnvelope-span-expand' ? participant.actualSize < participant.maximumSize
              : participant.trailingUsed > 0);
        if (participantIndex < 0) throw new Error(`test could not locate a ${mutation} participant`);
        return {
          ...manifest,
          participants: manifest.participants.map((participant, index) => index !== participantIndex
            ? participant
            : mutation === 'messageEnvelope-span-shrink'
              ? { ...participant, actualSize: participant.actualSize - 1, trailingUsed: participant.trailingUsed - 1 }
              : mutation === 'messageEnvelope-span-expand'
                ? { ...participant, actualSize: participant.actualSize + 1, trailingUsed: participant.trailingUsed + 1 }
                : { ...participant, maximumSize: participant.maximumSize + 1 }),
        };
      });
      expect(vmRejects(hostileSpan), mutation).toBe(true);
    }
    const hostileOutput = await composition.build();
    const commitment = hexToBin(hostileOutput.outputs[chunkOutput].token!.nft!.commitment);
    commitment[commitment.length - 1] ^= 0x01;
    hostileOutput.outputs[chunkOutput].token!.nft!.commitment = binToHex(commitment);
    await expect(provider.sendRawTransaction(raw(hostileOutput))).rejects.toThrow();
    await expect(composition.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 120_000);

  it('authenticates deletion when a dynamic-state chunk run shrinks', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const calleeArtifact = compileString(`contract ComposeShrinkCallee() {
      bytes note;
      function set(bytes value) public { this.note = value; require(value.length > 0); }
    }`, { forceStateful: true, messageBus: true });
    const calleeBase = new Contract(calleeArtifact, [], { provider });
    const initial = Uint8Array.from({ length: 160 }, (_, index) => 255 - index);
    const calleeSetup = await setupStatefulUtxos(provider, calleeBase, calleeArtifact.stateLayout!, { note: initial }, {
      saltContract: true,
      extraOutputs: (categoryId) => [initial.slice(0, 120), initial.slice(120)].map((chunk, index) => ({
        address: getDynamicChunkAddress(calleeBase, categoryId, 'note', 'bytes'),
        satoshis: 1200n,
        token: {
          amount: 0n,
          nft: { capability: 'mutable', commitment: buildChunkCommitment(index, chunk) },
        },
      })),
    });
    const calleeInner = calleeBase.withCategory(hexToBin(calleeSetup.categoryId));
    const callee = StatefulContract.withCategory(calleeInner, calleeSetup.categoryId);
    const callerArtifact = compileString(`
      interface IComposeShrinkCallee { function set(bytes value); }
      contract ComposeShrinkCaller(address calleeAddress) {
        function prepare(bytes value) public {
          IComposeShrinkCallee(calleeAddress).set(value);
          require(true);
        }
      }
    `, { forceStateful: true, messageBus: true });
    const callerBase = new Contract(callerArtifact, [calleeInner.lockingBytecode], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    const value = initial.slice(0, 80);
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const composition = messageBus.compose({
      calls: [caller.call.prepare(value), callee.call.set(value)],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });

    const built = await composition.build();
    const verifierIndex = built.inputs.findIndex(
      (input) => input.token?.nft?.commitment.startsWith('4c335631'),
    );
    if (verifierIndex < 0) throw new Error('test could not locate a deployed message bus verifier input');
    const instructions = decodeAuthenticationInstructions(
      built.buildLibauthTransaction().inputs[verifierIndex].unlockingBytecode,
    );
    const messageEnvelope = instructions.find((instruction) =>
      'data' in instruction && binToHex(instruction.data).startsWith('4c334331'));
    if (!messageEnvelope || !('data' in messageEnvelope)) {
      throw new Error('test could not locate shrink message envelope');
    }
    const deletion = decodeAtomicMessageEnvelope(messageEnvelope.data).rows
      .some((row) => row.kind === 1 && row.mode === 2);
    expect(deletion).toBe(true);
    const hostile = await composition.build();
    mutateAuthenticatedFrame(hostile, '', 'messageEnvelope-resource-delete');
    await expect(provider.sendRawTransaction(raw(hostile))).rejects.toThrow();
    await expect(composition.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 120_000);

  it('authenticates a BCH transfer and its satoshi-container settlement', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const calleeArtifact = compileString(`contract ComposeValueCallee() {
      event Paid(bigint amount);
      function pay(bytes recipient, bigint amount) public {
        this.transfer(recipient, amount);
        emit Paid(amount);
        require(amount > 0);
      }
    }`, { forceStateful: true, messageBus: true });
    const calleeBase = new Contract(calleeArtifact, [], { provider });
    const calleeSetup = await setupStatefulUtxos(
      provider, calleeBase, calleeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const calleeInner = calleeBase.withCategory(hexToBin(calleeSetup.categoryId));
    const callee = StatefulContract.withCategory(calleeInner, calleeSetup.categoryId);
    await provider.addUtxo(getSatoshiContainerAddress(calleeInner, calleeSetup.categoryId), {
      txid: 'ef'.repeat(32), vout: 1, satoshis: 50_000n,
    });
    const callerArtifact = compileString(`
      interface IComposeValueCallee { function pay(bytes recipient, bigint amount); }
      contract ComposeValueCaller(address calleeAddress) {
        function prepare(bytes recipient, bigint amount) public {
          IComposeValueCallee(calleeAddress).pay(recipient, amount);
          require(true);
        }
      }
    `, { forceStateful: true, messageBus: true });
    const callerBase = new Contract(callerArtifact, [calleeInner.lockingBytecode], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const recipient = fee.unlocker.generateLockingBytecode();
    const amount = 4_000n;
    const composition = messageBus.compose({
      calls: [caller.call.prepare(recipient, amount), callee.call.pay(recipient, amount)],
      funder: fee,
      changeAddress: recipient,
    });

    const built = await composition.build();
    const transferOutput = built.outputs.findIndex((output) =>
      output.amount === amount && !output.token
      && typeof output.to !== 'string' && binToHex(output.to) === binToHex(recipient));
    expect(transferOutput).toBeGreaterThan(0);
    if (!process.env.TESTS_USE_REGTEST) {
      for (const mutation of [
        'messageEnvelope-value', 'messageEnvelope-value-drop', 'messageEnvelope-satoshi', 'messageEnvelope-satoshi-drop',
      ] as const) {
        const hostileMessageEnvelope = await composition.build();
        mutateAuthenticatedFrame(hostileMessageEnvelope, '', mutation);
        await expect(provider.sendRawTransaction(raw(hostileMessageEnvelope))).rejects.toThrow();
      }
      const hostileOutput = await composition.build();
      hostileOutput.outputs[transferOutput].amount += 1n;
      await expect(provider.sendRawTransaction(raw(hostileOutput))).rejects.toThrow();
    }
    await expect(composition.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 120_000);

  it('authenticates repeated fungible-token calls against one container and recipient settlement', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const calleeArtifact = compileString(`contract ComposeTokenCallee() {
      function send(bytes32 category, bytes32 preservedCategory, bytes20 recipient, bigint amount) public {
        require(this.tokens[category].tokenAmount >= amount);
        require(this.tokens[preservedCategory].tokenAmount >= 0);
        this.tokens[category].transfer(new LockingBytecodeP2PKH(recipient), amount);
        require(amount > 0);
      }
    }`, { forceStateful: true, messageBus: true });
    const calleeBase = new Contract(calleeArtifact, [], { provider });
    const calleeSetup = await setupStatefulUtxos(
      provider, calleeBase, calleeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const calleeInner = calleeBase.withCategory(hexToBin(calleeSetup.categoryId));
    const callee = StatefulContract.withCategory(calleeInner, calleeSetup.categoryId);
    const token = await genesisFtContainer(provider, calleeInner, calleeSetup.categoryId, [100n]);
    const preserved = await genesisFtContainer(provider, calleeInner, calleeSetup.categoryId, [100n]);
    const callerArtifact = compileString(`
      interface IComposeTokenCallee {
        function send(bytes32 category, bytes32 preservedCategory, bytes20 recipient, bigint amount);
      }
      contract ComposeTokenCaller(address calleeAddress) {
        function prepare(bytes32 category, bytes32 preservedCategory, bytes20 recipient, bigint amount) public {
          IComposeTokenCallee(calleeAddress).send(category, preservedCategory, recipient, amount);
          IComposeTokenCallee(calleeAddress).send(category, preservedCategory, recipient, amount);
          require(true);
        }
      }
    `, { forceStateful: true, messageBus: true });
    const callerBase = new Contract(callerArtifact, [calleeInner.lockingBytecode], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    const category = hexToBin(token.category);
    const preservedCategory = hexToBin(preserved.category);
    const amount = 25n;
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const composition = messageBus.compose({
      calls: [
        caller.call.prepare(category, preservedCategory, alicePkh, amount),
        callee.call.send(category, preservedCategory, alicePkh, amount),
        callee.call.send(category, preservedCategory, alicePkh, amount),
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });

    const built = await composition.build();
    const tokenOutputs = built.outputs.map((output, index) => ({ output, index })).filter(({ output }) =>
      output.token?.category === token.category && output.token.amount === amount && !output.token.nft
      && typeof output.to !== 'string' && binToHex(output.to) === binToHex(
        new Uint8Array([0x76, 0xa9, 0x14, ...alicePkh, 0x88, 0xac]),
      ));
    expect(tokenOutputs.map(({ index }) => index)).toEqual([4, 5]);
    const tokenOutput = tokenOutputs[0].index;
    if (!process.env.TESTS_USE_REGTEST) {
      for (const mutation of [
        'messageEnvelope-token', 'messageEnvelope-token-drop', 'messageEnvelope-token-container', 'messageEnvelope-token-container-drop',
      ] as const) {
        const hostile = await composition.build();
        mutateAuthenticatedFrame(hostile, '', mutation);
        await expect(provider.sendRawTransaction(raw(hostile))).rejects.toThrow();
      }
      const hostileOutput = await composition.build();
      hostileOutput.outputs[tokenOutput].token!.amount += 1n;
      await expect(provider.sendRawTransaction(raw(hostileOutput))).rejects.toThrow();
      const hostilePreserved = await composition.build();
      const preservedOutput = hostilePreserved.outputs.find((output) =>
        output.token?.category === preserved.category && !output.token.nft);
      expect(preservedOutput).toBeDefined();
      preservedOutput!.token!.amount -= amount * 2n;
      hostilePreserved.options.allowImplicitFungibleTokenBurn = true;
      await expect(provider.sendRawTransaction(raw(hostilePreserved))).rejects.toThrow();
    }
    await expect(composition.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 120_000);

  it('authenticates NFT capability, commitment, recipient, and mixed-container settlement', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const calleeArtifact = compileString(`contract ComposeNftCallee() {
      function send(
        bytes32 category, bytes32 preservedCategory, bytes20 recipient, bytes commitment, int capability,
        bool usePreserved
      ) public {
        require(this.tokens[category].tokenAmount + this.tokens[preservedCategory].tokenAmount >= 0);
        if (usePreserved) {
          this.tokens[preservedCategory].transferNft(
            new LockingBytecodeP2PKH(recipient), commitment, capability
          );
        } else {
          this.tokens[category].transferNft(new LockingBytecodeP2PKH(recipient), commitment, capability);
        }
        require(capability >= 0);
      }
    }`, { forceStateful: true, messageBus: true, messageBusKernel: true });
    const calleeBase = new Contract(calleeArtifact, [], { provider });
    const calleeSetup = await setupStatefulUtxos(
      provider, calleeBase, calleeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const calleeInner = calleeBase.withCategory(hexToBin(calleeSetup.categoryId));
    const callee = StatefulContract.withCategory(calleeInner, calleeSetup.categoryId);
    const commitment = 'c0ffee';
    const seeded = await provider.addTokenUtxosDynamic((category) => [{
      address: getTokenContainerAddress(calleeInner, calleeSetup.categoryId, category),
      satoshis: 1200n,
      token: { amount: 50n, nft: { capability: 'none', commitment } },
    }]);
    const token = { category: seeded.categoryId };
    const preserved = await provider.addTokenUtxosDynamic((category) => [{
      address: getTokenContainerAddress(calleeInner, calleeSetup.categoryId, category),
      satoshis: 1200n,
      token: { amount: 1n, nft: { capability: 'minting', commitment: 'a1' } },
    }]);
    const callerArtifact = compileString(`
      interface IComposeNftCallee {
        function send(
          bytes32 category, bytes32 preservedCategory, bytes20 recipient, bytes commitment, int capability,
          bool usePreserved
        );
      }
      contract ComposeNftCaller(address calleeAddress) {
        function prepare(
          bytes32 category, bytes32 preservedCategory, bytes20 recipient, bytes commitment, int capability,
          bool usePreserved
        ) public {
          IComposeNftCallee(calleeAddress).send(
            category, preservedCategory, recipient, commitment, capability, usePreserved
          );
          require(true);
        }
      }
    `, { forceStateful: true, messageBus: true, messageBusKernel: true });
    const callerBase = new Contract(callerArtifact, [calleeInner.lockingBytecode], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    const category = hexToBin(token.category);
    const preservedCategory = hexToBin(preserved.categoryId);
    const commitmentBytes = hexToBin(commitment);
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const composition = messageBus.compose({
      calls: [
        caller.call.prepare(category, preservedCategory, alicePkh, commitmentBytes, 0n, false),
        callee.call.send(category, preservedCategory, alicePkh, commitmentBytes, 0n, false),
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });
    const otherCategory = messageBus.compose({
      calls: [
        caller.call.prepare(category, preservedCategory, alicePkh, commitmentBytes, 0n, true),
        callee.call.send(category, preservedCategory, alicePkh, commitmentBytes, 0n, true),
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });
    const otherBuilt = await otherCategory.build();
    const inactiveCategoryOutput = otherBuilt.outputs.find((output) =>
      output.token?.category === token.category && output.token.nft?.commitment === commitment);
    expect(inactiveCategoryOutput).toBeDefined();
    delete inactiveCategoryOutput!.token!.nft;
    await expect(provider.sendRawTransaction(raw(otherBuilt))).rejects.toThrow();

    const built = await composition.build();
    const nftOutput = built.outputs.findIndex((output) =>
      output.token?.category === token.category && output.token.nft?.commitment === commitment);
    expect(nftOutput).toBeGreaterThan(0);
    for (const mutation of [
      'messageEnvelope-token', 'messageEnvelope-token-drop', 'messageEnvelope-token-container', 'messageEnvelope-token-container-drop',
    ] as const) {
      const hostile = await composition.build();
      mutateAuthenticatedFrame(hostile, '', mutation);
      await expect(provider.sendRawTransaction(raw(hostile))).rejects.toThrow();
    }
    const hostileOutput = await composition.build();
    hostileOutput.outputs[nftOutput].token!.nft!.commitment = 'c0ffef';
    await expect(provider.sendRawTransaction(raw(hostileOutput))).rejects.toThrow();
    const hostilePreserved = await composition.build();
    const preservedOutput = hostilePreserved.outputs.find((output) =>
      output.token?.category === preserved.categoryId && output.token.nft?.capability === 'minting');
    expect(preservedOutput).toBeDefined();
    delete preservedOutput!.token!.nft;
    await expect(provider.sendRawTransaction(raw(hostilePreserved))).rejects.toThrow();
    await expect(composition.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 120_000);
});
