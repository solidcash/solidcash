import {
  bigIntToVmNumber, binToHex, decodeAuthenticationInstructions, encodeAuthenticationInstructions,
  encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { compileString } from 'solidc';
import {
  blockhashOracleLockingBytecode, buildBlockhashCommitment, buildChunkCommitment, scriptToBytecode,
  keccakComputeLockingBytecode,
  ecrecoverComputeLockingBytecode,
} from '@solidcash/utils';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { ethers } from 'ethers';
import { describe, expect, it } from 'vitest';
import { Contract, StatefulContract, layer3 } from '../../src/index.js';
import { decodeSingleTxCarrier, encodeSingleTxCarrier } from '../../src/layer3/controllerless.js';
import {
  getDynamicChunkAddress, getEntryNftAddress, getSatoshiContainerAddress, getTokenContainerAddress,
} from '../../src/stateful/covenant-helpers.js';
import { encodeEntryCommitment, keyToSlot } from '../../src/stateful/SortedList.js';
import type { TransactionBuilder } from '../../src/TransactionBuilder.js';
import {
  createBareP2pkhFeeFunder, genesisFtContainer, setupStatefulUtxos,
} from '../test-util.js';
import { alicePkh } from '../fixture/vars.js';
import { createLayer3CapstoneTestProvider } from './layer3-semantic-profile.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { randomUtxo } from '../../src/utils.js';

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
  function prepare(int next) public {
    int result = IComposeCallee(callee).settle(next);
    require(result == next + 1);
  }
}`;

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));

const vmRejects = (candidate: TransactionBuilder): boolean => {
  const transaction = candidate.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(candidate.inputs);
  const vm = createVirtualMachineBch2026ForProvider(candidate.provider);
  return transaction.inputs.some((_input, inputIndex) => (
    vm.debug({ inputIndex, sourceOutputs, transaction }) as Array<{ error?: unknown }>
  ).some((state) => state.error !== undefined));
};

const mutateInputZero = (
  builder: TransactionBuilder, selectorHex: string,
  target: 'carrier' | 'emissions' | 'carrier-result' | 'carrier-event' | 'carrier-resource'
  | 'carrier-resource-mode' | 'carrier-resource-slot' | 'carrier-resource-subject'
  | 'carrier-resource-create' | 'carrier-resource-delete' | 'carrier-value' | 'carrier-value-drop'
  | 'carrier-satoshi' | 'carrier-satoshi-drop' | 'carrier-token' | 'carrier-token-drop'
  | 'carrier-token-container' | 'carrier-token-container-drop'
  | 'carrier-context-caller' | 'carrier-context-selector' | 'carrier-context-args' | 'carrier-root-origin'
  | 'carrier-invocation-swap' | 'carrier-invocation-drop' | 'carrier-invocation-duplicate'
  | 'carrier-invocation-target' | 'carrier-invocation-mode',
): void => {
  const original = builder.inputs[0].unlocker!;
  builder.inputs[0] = {
    ...builder.inputs[0],
    unlocker: {
      generateLockingBytecode: () => original.generateLockingBytecode(),
      generateUnlockingBytecode: (options) => {
        const instructions = decodeAuthenticationInstructions(original.generateUnlockingBytecode(options));
        const instructionIndex = instructions.findIndex((instruction, index) => {
          if (!('data' in instruction)) return false;
          const hex = binToHex(instruction.data);
          return target === 'carrier' || target === 'carrier-result' || target === 'carrier-event'
            || target.startsWith('carrier-resource') || target.startsWith('carrier-value')
            || target.startsWith('carrier-satoshi')
            || target.startsWith('carrier-token')
            || target.startsWith('carrier-context-') || target === 'carrier-root-origin'
            || target.startsWith('carrier-invocation-')
            ? index === 2 && hex.startsWith('4c334331') && hex.includes(selectorHex)
            : index > 2 && instruction.data.length < 128 && hex.includes(selectorHex);
        });
        if (instructionIndex < 0) throw new Error(`test could not locate ${target} frame`);
        const instruction = instructions[instructionIndex];
        if (!('data' in instruction)) throw new Error(`test ${target} frame is not a push`);
        if (target === 'carrier-result' || target === 'carrier-event' || target.startsWith('carrier-resource')
          || target.startsWith('carrier-value') || target.startsWith('carrier-satoshi')
          || target.startsWith('carrier-token') || target.startsWith('carrier-context-')
          || target === 'carrier-root-origin' || target.startsWith('carrier-invocation-')) {
          const transcript = decodeSingleTxCarrier(instruction.data);
          if (target.startsWith('carrier-invocation-')) {
            const invocationIndices = transcript.rows
              .map((row, index) => ({ row, index }))
              .filter(({ row }) => row.kind === 0 && row.parent !== 0xffff)
              .map(({ index }) => index);
            if (invocationIndices.length < 1
              || (['carrier-invocation-swap', 'carrier-invocation-drop'].includes(target)
                && invocationIndices.length < 2)) {
              throw new Error('test could not locate required invocation rows');
            }
            const [first, second] = invocationIndices;
            let rows = [...transcript.rows];
            if (target === 'carrier-invocation-target') {
              rows[first] = {
                ...rows[first], consumer: (rows[first].consumer + 1) % transcript.participants.length,
              };
            } else if (target === 'carrier-invocation-mode') {
              rows[first] = { ...rows[first], mode: rows[first].mode ^ 1 };
            } else if (target === 'carrier-invocation-swap') {
              rows = rows.map((row, index) => index === first
                ? { ...row, argsHex: transcript.rows[second].argsHex }
                : index === second ? { ...row, argsHex: transcript.rows[first].argsHex } : row);
            } else if (target === 'carrier-invocation-drop') {
              rows.splice(second, 1);
            } else {
              const selected = second ?? first;
              rows.splice(selected + 1, 0, { ...rows[selected] });
            }
            instructions[instructionIndex] = {
              ...instruction, data: encodeSingleTxCarrier({ ...transcript, rows }),
            };
            return encodeAuthenticationInstructions(instructions);
          }
          const rowIndex = transcript.rows.findIndex((row) => target === 'carrier-result'
            ? row.resultHex.length > 0
            : target === 'carrier-root-origin'
              ? row.kind === 0 && row.parent === 0xffff
              : target.startsWith('carrier-context-')
                ? row.kind === 0 && row.parent !== 0xffff
                : row.kind === (target.startsWith('carrier-resource') || target.startsWith('carrier-satoshi')
                  || target.startsWith('carrier-token-container')
                  ? 1 : target.startsWith('carrier-value') ? 3 : target.startsWith('carrier-token') ? 4 : 2)
              && (row.effectHex.length > 0 || target === 'carrier-resource-delete')
              && (target !== 'carrier-resource-create' || row.mode === 1)
              && (target !== 'carrier-resource-delete' || row.mode === 2)
              && (!target.startsWith('carrier-satoshi') || row.mode === 3)
              && (!target.startsWith('carrier-token-container') || row.mode === 4));
          if (rowIndex < 0) throw new Error(`test could not locate a ${target} row`);
          if (target.startsWith('carrier-context-') || target === 'carrier-root-origin') {
            const rows = transcript.rows.map((row, index) => {
              if (index !== rowIndex) return row;
              if (target === 'carrier-context-selector') {
                const selector = hexToBin(row.selectorHex);
                selector[0] ^= 1;
                return { ...row, selectorHex: binToHex(selector) };
              }
              if (target === 'carrier-context-args') {
                const args = hexToBin(row.argsHex);
                args[args.length - 1] ^= 1;
                return { ...row, argsHex: binToHex(args) };
              }
              const subject = hexToBin(row.subjectHex);
              subject[subject.length - 1] ^= 1;
              return { ...row, subjectHex: binToHex(subject) };
            });
            instructions[instructionIndex] = {
              ...instruction, data: encodeSingleTxCarrier({ ...transcript, rows }),
            };
            return encodeAuthenticationInstructions(instructions);
          }
          if (target.endsWith('-drop')) {
            instructions[instructionIndex] = {
              ...instruction,
              data: encodeSingleTxCarrier({
                ...transcript, rows: transcript.rows.filter((_row, index) => index !== rowIndex),
              }),
            };
            return encodeAuthenticationInstructions(instructions);
          }
          if (target === 'carrier-resource-mode' || target === 'carrier-resource-slot'
            || target === 'carrier-resource-subject') {
            const row = transcript.rows[rowIndex];
            const subject = hexToBin(row.subjectHex);
            if (target === 'carrier-resource-subject') subject[subject.length - 1] ^= 0x01;
            const rows = transcript.rows.map((candidate, index) => index === rowIndex
              ? {
                ...candidate,
                ...(target === 'carrier-resource-mode' ? { mode: 1 } : {}),
                ...(target === 'carrier-resource-slot'
                  ? { sourceSlot: candidate.sourceSlot - 1, targetSlot: candidate.targetSlot - 1 } : {}),
                ...(target === 'carrier-resource-subject' ? { subjectHex: binToHex(subject) } : {}),
              } : candidate);
            instructions[instructionIndex] = {
              ...instruction, data: encodeSingleTxCarrier({ ...transcript, rows }),
            };
            return encodeAuthenticationInstructions(instructions);
          }
          const field = hexToBin(target === 'carrier-result' || target === 'carrier-resource-delete'
            ? transcript.rows[rowIndex].resultHex : transcript.rows[rowIndex].effectHex);
          field[field.length - 1] ^= 0x01;
          const rows = transcript.rows.map((row, index) => index === rowIndex
            ? {
              ...row,
              ...(target === 'carrier-result'
                ? { resultHex: binToHex(field) } : { effectHex: binToHex(field) }),
            } : row);
          instructions[instructionIndex] = {
            ...instruction, data: encodeSingleTxCarrier({ ...transcript, rows }),
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

describe('layer3.compose controllerless transaction', () => {
  it('reconstructs and authenticates msg.sender, msg.sig, msg.data, and tx.origin', async () => {
    const provider = createLayer3CapstoneTestProvider();
    const calleeArtifact = compileString(`contract ComposeContextCallee() {
      function check(address expectedSender, bytes4 expectedSig, address expectedOrigin) public {
        require(msg.sender == expectedSender && msg.sig == expectedSig
          && msg.data.length > 4 && tx.origin == expectedOrigin);
      }
    }`, { forceStateful: true });
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
    `, { forceStateful: true });
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
    const composition = layer3.compose({
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
      'carrier-context-caller', 'carrier-context-selector', 'carrier-context-args', 'carrier-root-origin',
    ] as const) {
      const hostile = await composition.build();
      mutateInputZero(hostile, '', mutation);
      expect(vmRejects(hostile), mutation).toBe(true);
    }
    await expect(canonical.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 120_000);

  it('settles repeated callsites through one physical participant in compiler-authored order', async () => {
    const provider = createLayer3CapstoneTestProvider();
    const sinkArtifact = compileString(`contract ComposeRepeatedSink() {
      function ping(int value) public { require(value >= 0); }
    }`, { forceStateful: true });
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
    `, { forceStateful: true });
    const callerBase = new Contract(callerArtifact, [sinkInner.lockingBytecode], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const composition = layer3.compose({
      calls: [caller.call.invoke(7n), sink.call.ping(7n), sink.call.ping(9n)],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });
    const canonical = await composition.build();
    expect(canonical.inputs).toHaveLength(3);
    expect(vmRejects(canonical)).toBe(false);
    await expect(layer3.compose({
      calls: [caller.call.invoke(7n), sink.call.ping(9n), sink.call.ping(7n)],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    }).build()).rejects.toThrow(/prepared call 1 arguments disagree/);
    for (const mutation of [
      'carrier-invocation-swap', 'carrier-invocation-drop', 'carrier-invocation-duplicate',
    ] as const) {
      const hostile = await composition.build();
      mutateInputZero(hostile, '', mutation);
      expect(vmRejects(hostile), mutation).toBe(true);
    }
    await expect(canonical.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 120_000);

  it('settles fan-out to two independently authenticated physical participants', async () => {
    const provider = createLayer3CapstoneTestProvider();
    const sinkArtifact = compileString(`contract ComposeFanoutSink() {
      function ping(int value) public { require(value >= 0); }
    }`, { forceStateful: true });
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
    `, { forceStateful: true });
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
    const composition = layer3.compose({
      calls: [caller.call.invoke(7n), first.call.ping(7n), second.call.ping(9n)],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });
    const canonical = await composition.build();
    expect(canonical.inputs).toHaveLength(4);
    expect(vmRejects(canonical)).toBe(false);
    const hostile = await composition.build();
    mutateInputZero(hostile, '', 'carrier-invocation-target');
    expect(vmRejects(hostile)).toBe(true);
    await expect(canonical.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 120_000);

  it('authenticates taken and untaken conditional call reachability exactly', async () => {
    const provider = createLayer3CapstoneTestProvider();
    const sinkArtifact = compileString(`contract ComposeBranchSink() {
      function ping(int value) public { require(value >= 0); }
    }`, { forceStateful: true });
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
    `, { forceStateful: true });
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
    const taken = layer3.compose({
      calls: [caller.call.invoke(true, 7n), always.call.ping(7n), conditional.call.ping(9n)],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });
    const untaken = layer3.compose({
      calls: [caller.call.invoke(false, 7n), always.call.ping(7n)],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });
    const canonicalTaken = await taken.build();
    const canonicalUntaken = await untaken.build();
    expect(vmRejects(canonicalTaken)).toBe(false);
    expect(vmRejects(canonicalUntaken)).toBe(false);
    const omitted = await taken.build();
    mutateInputZero(omitted, '', 'carrier-invocation-drop');
    expect(vmRejects(omitted)).toBe(true);
    const phantom = await untaken.build();
    mutateInputZero(phantom, '', 'carrier-invocation-duplicate');
    expect(vmRejects(phantom)).toBe(true);
    await expect(canonicalTaken.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 120_000);

  it('authenticates bounded-loop occurrence floors, ceilings, and exact row consumption', async () => {
    const provider = createLayer3CapstoneTestProvider();
    const sinkArtifact = compileString(`contract ComposeLoopSink() {
      function ping(int value) public { require(value >= 0); }
    }`, { forceStateful: true });
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
    `, { forceStateful: true });
    const callerBase = new Contract(callerArtifact, [sinkInner.lockingBytecode], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const composition = layer3.compose({
      calls: [caller.call.invoke(7n), sink.call.ping(7n), sink.call.ping(7n)],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });
    const canonical = await composition.build();
    expect(vmRejects(canonical)).toBe(false);
    await expect(layer3.compose({
      calls: [caller.call.invoke(7n), sink.call.ping(7n)],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    }).build()).rejects.toThrow(/below the 2 proven by a compile-time trip count/);
    await expect(layer3.compose({
      calls: [caller.call.invoke(7n), sink.call.ping(7n), sink.call.ping(7n), sink.call.ping(7n)],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    }).build()).rejects.toThrow(/compiled graph reaches 3/);
    for (const mutation of ['carrier-invocation-drop', 'carrier-invocation-duplicate'] as const) {
      const hostile = await composition.build();
      mutateInputZero(hostile, '', mutation);
      expect(vmRejects(hostile), mutation).toBe(true);
    }
    await expect(canonical.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 120_000);

  it('authenticates staticcall mode and enforces a read-only participant snapshot', async () => {
    const provider = createLayer3CapstoneTestProvider();
    const connect = async (artifact: ReturnType<typeof compileString>): Promise<StatefulContract> => {
      const base = new Contract(artifact, [], { provider });
      const setup = await setupStatefulUtxos(
        provider, base, artifact.stateLayout!, {}, { saltContract: true },
      );
      return StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
    };
    const readonlyArtifact = compileString(`contract ComposeStaticSink() {
      function peek() public pure { require(true); }
    }`, { forceStateful: true });
    const readonly = await connect(readonlyArtifact);
    const callerArtifact = compileString(`
      interface IComposeStaticSink { function peek(); }
      contract ComposeStaticCaller(address sink) {
        function invoke() public {
          IComposeStaticSink(sink).peek.staticcall();
          require(true);
        }
      }
    `, { forceStateful: true });
    const callerBase = new Contract(callerArtifact, [readonly.inner.lockingBytecode], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const composition = layer3.compose({
      calls: [caller.call.invoke(), readonly.call.peek()],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });
    const canonical = await composition.build();
    const carrierPush = decodeAuthenticationInstructions(
      canonical.inputs[0].unlocker!.generateUnlockingBytecode({
        transaction: canonical.buildLibauthTransaction(), inputIndex: 0,
      }),
    ).find((instruction) => 'data' in instruction && binToHex(instruction.data).startsWith('4c334331'));
    if (!carrierPush || !('data' in carrierPush)) throw new Error('test could not locate canonical carrier');
    const staticRow = decodeSingleTxCarrier(carrierPush.data).rows.find(
      (row) => row.kind === 0 && row.parent !== 0xffff,
    );
    expect(staticRow?.mode).toBe(1);
    expect(vmRejects(canonical)).toBe(false);
    const renamed = await composition.build();
    mutateInputZero(renamed, '', 'carrier-invocation-mode');
    expect(vmRejects(renamed)).toBe(true);

    const mutableArtifact = compileString(`contract ComposeStaticMutation() {
      event Changed(int next);
      function mutate() public {
        emit Changed(9);
        require(true);
      }
    }`, { forceStateful: true });
    const mutable = await connect(mutableArtifact);
    const mutatingCallerArtifact = compileString(`
      interface IComposeStaticMutation { function mutate(); }
      contract ComposeStaticMutationCaller(address sink) {
        function invoke() public {
          IComposeStaticMutation(sink).mutate.staticcall();
          require(true);
        }
      }
    `, { forceStateful: true });
    const mutatingCallerBase = new Contract(
      mutatingCallerArtifact, [mutable.inner.lockingBytecode], { provider },
    );
    const mutatingCallerSetup = await setupStatefulUtxos(
      provider, mutatingCallerBase, mutatingCallerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const mutatingCaller = StatefulContract.withCategory(
      mutatingCallerBase.withCategory(hexToBin(mutatingCallerSetup.categoryId)), mutatingCallerSetup.categoryId,
    );
    await expect(layer3.compose({
      calls: [mutatingCaller.call.invoke(), mutable.call.mutate()],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    }).build()).rejects.toThrow(/BCH-2026 preflight failed at input 1/);
    await expect(canonical.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 120_000);

  it('decodes and authenticates a low-level target, selector, calldata, and result', async () => {
    const provider = createLayer3CapstoneTestProvider();
    const targetArtifact = compileString(`contract ComposeRawTarget() {
      function echo(int value) public pure returns (int) { return value; }
    }`, { forceStateful: true });
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
    }`, { forceStateful: true });
    const callerBase = new Contract(callerArtifact, [], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const composition = layer3.compose({
      calls: [caller.call.invoke(target.inner.lockingBytecode, payload), target.call.echo(3n)],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });
    const canonical = await composition.build();
    expect(vmRejects(canonical)).toBe(false);
    for (const mutation of [
      'carrier-invocation-target', 'carrier-context-selector', 'carrier-context-args',
      'carrier-result',
    ] as const) {
      const hostile = await composition.build();
      mutateInputZero(hostile, '', mutation);
      expect(vmRejects(hostile), mutation).toBe(true);
    }
    await expect(canonical.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 120_000);

  it('co-spends a compiler-positioned blockhash oracle in the controllerless participant block', async () => {
    const provider = createLayer3CapstoneTestProvider();
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
    `, { forceStateful: true });
    const sinkArtifact = compileString(`contract ComposeBlockhashSink() {
      function accept(bytes32 value) public pure { require(value.length == 32); }
    }`, { forceStateful: true });
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
    const composition = layer3.compose({
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

  it('co-spends and recreates a keccak sidecar at its exact controllerless slot', async () => {
    const provider = createLayer3CapstoneTestProvider();
    const callerArtifact = compileString(`
      interface IComposeKeccakSink { function accept(bytes32 value); }
      contract ComposeKeccakCaller() {
        function invoke(address target, bytes32 payload) public {
          bytes32 value = keccak256(payload);
          IComposeKeccakSink(target).accept(value);
          require(payload.length > 0);
        }
      }
    `, { forceStateful: true });
    const sinkArtifact = compileString(`contract ComposeKeccakSink() {
      function accept(bytes32 value) public pure { require(value.length == 32); }
    }`, { forceStateful: true });
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
    const composition = layer3.compose({
      calls: [caller.call.invoke(sink.inner.lockingBytecode, payload), sink.call.accept(digest)],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });
    const canonical = await composition.build();
    const sidecarOffset = callerArtifact.hiddenBatch!.route.blockLayout!.slots.find(
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

  it('co-spends and recreates an ecrecover A/B pair at exact controllerless slots', async () => {
    const provider = createLayer3CapstoneTestProvider();
    const wallet = new ethers.Wallet(`0x${'11'.repeat(32)}`);
    const message = 'controllerless-single-tx-bus';
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
    `, { forceStateful: true });
    const sinkArtifact = compileString(`contract ComposeRecoverSink() {
      function recover(bytes32 h, int v, bytes32 r, bytes32 s) public {
        pubkey value = ecrecoverPubKey(h, v, r, s);
        require(value.length == 33);
      }
    }`, { forceStateful: true });
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
    const composition = layer3.compose({
      calls: [
        caller.call.invoke(sink.inner.lockingBytecode, digest, BigInt(parsed.v), r, s),
        sink.call.recover(digest, BigInt(parsed.v), r, s),
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });
    const canonical = await composition.build();
    const sinkBaseOffset = callerArtifact.hiddenBatch!.route.blockLayout!.blockSize;
    const offsets = sinkArtifact.hiddenBatch!.route.blockLayout!.slots
      .filter((slot) => slot.kind === 'ecrecoverSideCar')
      .map((slot) => sinkBaseOffset + slot.offset);
    expect(offsets).toHaveLength(2);
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

  it('builds and broadcasts one transaction for two existing participants without setup execution', async () => {
    const provider = createLayer3CapstoneTestProvider();
    const calleeArtifact = compileString(CALLEE, { forceStateful: true });
    const calleeBase = new Contract(calleeArtifact, [], { provider });
    const calleeSetup = await setupStatefulUtxos(
      provider, calleeBase, calleeArtifact.stateLayout!, { counter: 0n }, { saltContract: true },
    );
    const calleeInner = calleeBase.withCategory(hexToBin(calleeSetup.categoryId));
    const callee = StatefulContract.withCategory(calleeInner, calleeSetup.categoryId);

    const callerArtifact = compileString(CALLER, { forceStateful: true });
    const callerBase = new Contract(callerArtifact, [hexToBin(calleeInner.lockingBytecode)], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);

    const composition = layer3.compose({
      calls: [caller.call.prepare(7n), callee.call.settle(7n)],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });
    await expect(layer3.compose({
      calls: [caller.call.prepare(7n), callee.call.settle(8n)],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    }).build()).rejects.toThrow(/prepared call 1 arguments disagree/);
    await expect(layer3.compose({
      calls: [caller.call.prepare(7n), callee.call.settle(7n)],
      funder: {
        utxo: fee.utxo,
        unlocker: { generateLockingBytecode: () => hexToBin(`aa20${'00'.repeat(32)}87`) } as never,
      },
      changeAddress: fee.unlocker.generateLockingBytecode(),
    }).build()).rejects.toThrow(/canonical fee tail must be a bare P2PKH input/);
    const built = await composition.build();
    expect(built.inputs).toHaveLength(5);
    expect(built.outputs).toHaveLength(5);
    // Graph finalization already produced the carrier before this transaction requested any signatures. Prove
    // that its exact physical push remains stable as each finalized input signature is regenerated in order.
    const finalizedTransaction = built.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(built.inputs);
    const carrierPush = (): Uint8Array => {
      const instruction = decodeAuthenticationInstructions(
        finalizedTransaction.inputs[0].unlockingBytecode,
      )[2];
      if (!instruction || !('data' in instruction)) throw new Error('test could not locate canonical carrier');
      return instruction.data;
    };
    const carrierBeforeResigning = carrierPush();
    for (const [inputIndex, input] of built.inputs.entries()) {
      finalizedTransaction.inputs[inputIndex].unlockingBytecode = input.unlocker.generateUnlockingBytecode({
        transaction: finalizedTransaction, sourceOutputs, inputIndex,
      });
      expect(carrierPush()).toEqual(carrierBeforeResigning);
    }
    expect(decodeSingleTxCarrier(carrierBeforeResigning)).toEqual(
      decodeSingleTxCarrier(carrierPush()),
    );
    for (const mutation of ['carrier', 'emissions'] as const) {
      const hostile = await composition.build();
      mutateInputZero(hostile, calleeArtifact.abi.find((fn) => fn.name === 'settle')!.selector!, mutation);
      await expect(provider.sendRawTransaction(raw(hostile))).rejects.toThrow();
    }
    const hostileTranscriptResult = await composition.build();
    mutateInputZero(
      hostileTranscriptResult,
      calleeArtifact.abi.find((fn) => fn.name === 'settle')!.selector!,
      'carrier-result',
    );
    await expect(provider.sendRawTransaction(raw(hostileTranscriptResult))).rejects.toThrow();

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
  }, 120_000);

  it('converges nested authenticated returns across an A-to-B-to-C graph', async () => {
    const provider = createLayer3CapstoneTestProvider();
    const leafArtifact = compileString(`contract ComposeLeaf() {
      function leaf(int value) public pure returns (int) { return value * 2; }
    }`, { forceStateful: true });
    const leafBase = new Contract(leafArtifact, [], { provider });
    const leafSetup = await setupStatefulUtxos(
      provider, leafBase, leafArtifact.stateLayout!, {}, { saltContract: true },
    );
    const leafInner = leafBase.withCategory(hexToBin(leafSetup.categoryId));
    const leaf = StatefulContract.withCategory(leafInner, leafSetup.categoryId);

    const middleArtifact = compileString(`
      interface IComposeLeaf { function leaf(int value) returns (int); }
      contract ComposeMiddle(address leafAddress) {
        function middle(int value) public returns (int) {
          int doubled = IComposeLeaf(leafAddress).leaf(value);
          return doubled + 3;
        }
      }
    `, { forceStateful: true });
    const middleBase = new Contract(middleArtifact, [leafInner.lockingBytecode], { provider });
    const middleSetup = await setupStatefulUtxos(
      provider, middleBase, middleArtifact.stateLayout!, {}, { saltContract: true },
    );
    const middleInner = middleBase.withCategory(hexToBin(middleSetup.categoryId));
    const middle = StatefulContract.withCategory(middleInner, middleSetup.categoryId);

    const rootArtifact = compileString(`
      interface IComposeMiddle { function middle(int value) returns (int); }
      contract ComposeRoot(address middleAddress) {
        function root(int value) public {
          int result = IComposeMiddle(middleAddress).middle(value);
          require(result == value * 2 + 3);
        }
      }
    `, { forceStateful: true });
    const rootBase = new Contract(rootArtifact, [middleInner.lockingBytecode], { provider });
    const rootSetup = await setupStatefulUtxos(
      provider, rootBase, rootArtifact.stateLayout!, {}, { saltContract: true },
    );
    const root = StatefulContract.withCategory(
      rootBase.withCategory(hexToBin(rootSetup.categoryId)), rootSetup.categoryId,
    );
    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = layer3.compose({
      calls: [root.call.root(11n), middle.call.middle(11n), leaf.call.leaf(11n)],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });

    const built = await composition.build();
    expect(built.inputs).toHaveLength(built.outputs.length);
    expect(built.inputs.length).toBeGreaterThanOrEqual(6);
    await expect(composition.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 120_000);

  it('binds an emitted event row to its absolute physical output', async () => {
    const provider = createLayer3CapstoneTestProvider();
    const calleeArtifact = compileString(`contract ComposeEventCallee() {
      event Settled(int value);
      function settle(int value) public { emit Settled(value); require(true); }
    }`, { forceStateful: true });
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
    `, { forceStateful: true });
    const callerBase = new Contract(callerArtifact, [calleeInner.lockingBytecode], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = layer3.compose({
      calls: [caller.call.prepare(13n), callee.call.settle(13n)],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });

    const built = await composition.build();
    const eventOutputIndex = built.outputs.findIndex((output) =>
      output.token?.category === calleeSetup.categoryId && output.token.nft?.capability === 'none');
    expect(eventOutputIndex).toBeGreaterThan(0);
    const hostileCarrier = await composition.build();
    mutateInputZero(hostileCarrier, '', 'carrier-event');
    await expect(provider.sendRawTransaction(raw(hostileCarrier))).rejects.toThrow();
    const hostileOutput = await composition.build();
    const commitment = hexToBin(hostileOutput.outputs[eventOutputIndex].token!.nft!.commitment);
    commitment[commitment.length - 1] ^= 0x01;
    hostileOutput.outputs[eventOutputIndex].token!.nft!.commitment = binToHex(commitment);
    await expect(provider.sendRawTransaction(raw(hostileOutput))).rejects.toThrow();
    await expect(composition.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 120_000);

  it('settles an authenticated mapping entry in a later participant block', async () => {
    const provider = createLayer3CapstoneTestProvider();
    const calleeArtifact = compileString(`contract ComposeMappingCallee() {
      mapping(bigint => bigint) values;
      function set(bigint key, bigint value) public {
        this.values[key] = value;
        require(value >= 0);
      }
    }`, { forceStateful: true });
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
    `, { forceStateful: true });
    const callerBase = new Contract(callerArtifact, [calleeInner.lockingBytecode], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = layer3.compose({
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
      'carrier-resource', 'carrier-resource-mode', 'carrier-resource-slot', 'carrier-resource-subject',
    ] as const) {
      const hostileCarrier = await composition.build();
      mutateInputZero(hostileCarrier, '', mutation);
      const outcome = await provider.sendRawTransaction(raw(hostileCarrier)).then(() => 'accepted').catch(() => 'rejected');
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
    const provider = createLayer3CapstoneTestProvider();
    const calleeArtifact = compileString(`contract ComposeDynamicCallee() {
      bytes note;
      function set(bytes value) public { this.note = value; require(value.length > 0); }
    }`, { forceStateful: true });
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
    `, { forceStateful: true });
    const callerBase = new Contract(callerArtifact, [calleeInner.lockingBytecode], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    const value = Uint8Array.from({ length: 80 }, (_, index) => index + 1);
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const composition = layer3.compose({
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
    const hostileCarrier = await composition.build();
    mutateInputZero(hostileCarrier, '', 'carrier-resource-create');
    await expect(provider.sendRawTransaction(raw(hostileCarrier))).rejects.toThrow();
    const hostileOutput = await composition.build();
    const commitment = hexToBin(hostileOutput.outputs[chunkOutput].token!.nft!.commitment);
    commitment[commitment.length - 1] ^= 0x01;
    hostileOutput.outputs[chunkOutput].token!.nft!.commitment = binToHex(commitment);
    await expect(provider.sendRawTransaction(raw(hostileOutput))).rejects.toThrow();
    await expect(composition.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 120_000);

  it('authenticates deletion when a dynamic-state chunk run shrinks', async () => {
    const provider = createLayer3CapstoneTestProvider();
    const calleeArtifact = compileString(`contract ComposeShrinkCallee() {
      bytes note;
      function set(bytes value) public { this.note = value; require(value.length > 0); }
    }`, { forceStateful: true });
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
    `, { forceStateful: true });
    const callerBase = new Contract(callerArtifact, [calleeInner.lockingBytecode], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    const value = initial.slice(0, 80);
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const composition = layer3.compose({
      calls: [caller.call.prepare(value), callee.call.set(value)],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });

    const built = await composition.build();
    const instructions = decodeAuthenticationInstructions(
      built.buildLibauthTransaction().inputs[0].unlockingBytecode,
    );
    const carrier = instructions.find((instruction, index) =>
      index === 2 && 'data' in instruction && binToHex(instruction.data).startsWith('4c334331'));
    if (!carrier || !('data' in carrier)) throw new Error('test could not locate shrink carrier');
    expect(decodeSingleTxCarrier(carrier.data).rows.some((row) => row.kind === 1 && row.mode === 2)).toBe(true);
    const hostile = await composition.build();
    mutateInputZero(hostile, '', 'carrier-resource-delete');
    await expect(provider.sendRawTransaction(raw(hostile))).rejects.toThrow();
    await expect(composition.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 120_000);

  it('authenticates a BCH transfer and its satoshi-container settlement', async () => {
    const provider = createLayer3CapstoneTestProvider();
    const calleeArtifact = compileString(`contract ComposeValueCallee() {
      event Paid(bigint amount);
      function pay(bytes recipient, bigint amount) public {
        this.transfer(recipient, amount);
        emit Paid(amount);
        require(amount > 0);
      }
    }`, { forceStateful: true });
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
    `, { forceStateful: true });
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
    const composition = layer3.compose({
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
        'carrier-value', 'carrier-value-drop', 'carrier-satoshi', 'carrier-satoshi-drop',
      ] as const) {
        const hostileCarrier = await composition.build();
        mutateInputZero(hostileCarrier, '', mutation);
        await expect(provider.sendRawTransaction(raw(hostileCarrier))).rejects.toThrow();
      }
      const hostileOutput = await composition.build();
      hostileOutput.outputs[transferOutput].amount += 1n;
      await expect(provider.sendRawTransaction(raw(hostileOutput))).rejects.toThrow();
    }
    await expect(composition.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 120_000);

  it('authenticates repeated fungible-token calls against one container and recipient settlement', async () => {
    const provider = createLayer3CapstoneTestProvider();
    const calleeArtifact = compileString(`contract ComposeTokenCallee() {
      function send(bytes32 category, bytes20 recipient, bigint amount) public {
        require(this.tokens[category].tokenAmount >= amount);
        this.tokens[category].transfer(new LockingBytecodeP2PKH(recipient), amount);
        require(amount > 0);
      }
    }`, { forceStateful: true });
    const calleeBase = new Contract(calleeArtifact, [], { provider });
    const calleeSetup = await setupStatefulUtxos(
      provider, calleeBase, calleeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const calleeInner = calleeBase.withCategory(hexToBin(calleeSetup.categoryId));
    const callee = StatefulContract.withCategory(calleeInner, calleeSetup.categoryId);
    const token = await genesisFtContainer(provider, calleeInner, calleeSetup.categoryId, [100n]);
    const callerArtifact = compileString(`
      interface IComposeTokenCallee { function send(bytes32 category, bytes20 recipient, bigint amount); }
      contract ComposeTokenCaller(address calleeAddress) {
        function prepare(bytes32 category, bytes20 recipient, bigint amount) public {
          IComposeTokenCallee(calleeAddress).send(category, recipient, amount);
          IComposeTokenCallee(calleeAddress).send(category, recipient, amount);
          require(true);
        }
      }
    `, { forceStateful: true });
    const callerBase = new Contract(callerArtifact, [calleeInner.lockingBytecode], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    const category = hexToBin(token.category);
    const amount = 25n;
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const composition = layer3.compose({
      calls: [
        caller.call.prepare(category, alicePkh, amount),
        callee.call.send(category, alicePkh, amount),
        callee.call.send(category, alicePkh, amount),
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
    expect(tokenOutputs.map(({ index }) => index)).toEqual([3, 4]);
    const tokenOutput = tokenOutputs[0].index;
    if (!process.env.TESTS_USE_REGTEST) {
      for (const mutation of [
        'carrier-token', 'carrier-token-drop', 'carrier-token-container', 'carrier-token-container-drop',
      ] as const) {
        const hostile = await composition.build();
        mutateInputZero(hostile, '', mutation);
        await expect(provider.sendRawTransaction(raw(hostile))).rejects.toThrow();
      }
      const hostileOutput = await composition.build();
      hostileOutput.outputs[tokenOutput].token!.amount += 1n;
      await expect(provider.sendRawTransaction(raw(hostileOutput))).rejects.toThrow();
    }
    await expect(composition.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 120_000);

  it('authenticates NFT capability, commitment, recipient, and mixed-container settlement', async () => {
    const provider = createLayer3CapstoneTestProvider();
    const calleeArtifact = compileString(`contract ComposeNftCallee() {
      function send(bytes32 category, bytes20 recipient, bytes commitment, int capability) public {
        require(this.tokens[category].tokenAmount >= 0);
        this.tokens[category].transferNft(new LockingBytecodeP2PKH(recipient), commitment, capability);
        require(capability >= 0);
      }
    }`, { forceStateful: true });
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
    const callerArtifact = compileString(`
      interface IComposeNftCallee {
        function send(bytes32 category, bytes20 recipient, bytes commitment, int capability);
      }
      contract ComposeNftCaller(address calleeAddress) {
        function prepare(bytes32 category, bytes20 recipient, bytes commitment, int capability) public {
          IComposeNftCallee(calleeAddress).send(category, recipient, commitment, capability);
          require(true);
        }
      }
    `, { forceStateful: true });
    const callerBase = new Contract(callerArtifact, [calleeInner.lockingBytecode], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    const category = hexToBin(token.category);
    const commitmentBytes = hexToBin(commitment);
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const composition = layer3.compose({
      calls: [
        caller.call.prepare(category, alicePkh, commitmentBytes, 0n),
        callee.call.send(category, alicePkh, commitmentBytes, 0n),
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });

    const built = await composition.build();
    const nftOutput = built.outputs.findIndex((output) =>
      output.token?.category === token.category && output.token.nft?.commitment === commitment);
    expect(nftOutput).toBeGreaterThan(0);
    for (const mutation of [
      'carrier-token', 'carrier-token-drop', 'carrier-token-container', 'carrier-token-container-drop',
    ] as const) {
      const hostile = await composition.build();
      mutateInputZero(hostile, '', mutation);
      await expect(provider.sendRawTransaction(raw(hostile))).rejects.toThrow();
    }
    const hostileOutput = await composition.build();
    hostileOutput.outputs[nftOutput].token!.nft!.commitment = 'c0ffef';
    await expect(provider.sendRawTransaction(raw(hostileOutput))).rejects.toThrow();
    await expect(composition.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 120_000);
});
