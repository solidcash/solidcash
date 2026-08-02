import {
  bigIntToVmNumber, binToHex, decodeAuthenticationInstructions, encodeAuthenticationInstructions,
  encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { compileString } from 'solidc';
import { buildChunkCommitment } from '@solidcash/utils';
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
import { createLayer3SemanticTestProvider } from './layer3-semantic-profile.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';

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
  | 'carrier-invocation-target',
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
              || (target !== 'carrier-invocation-target' && invocationIndices.length < 2)) {
              throw new Error('test could not locate required invocation rows');
            }
            const [first, second] = invocationIndices;
            let rows = [...transcript.rows];
            if (target === 'carrier-invocation-target') {
              rows[first] = {
                ...rows[first], consumer: (rows[first].consumer + 1) % transcript.participants.length,
              };
            } else if (target === 'carrier-invocation-swap') {
              rows = rows.map((row, index) => index === first
                ? { ...row, argsHex: transcript.rows[second].argsHex }
                : index === second ? { ...row, argsHex: transcript.rows[first].argsHex } : row);
            } else if (target === 'carrier-invocation-drop') {
              rows.splice(second, 1);
            } else {
              rows.splice(second + 1, 0, { ...rows[second] });
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
    const provider = createLayer3SemanticTestProvider();
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
    const provider = createLayer3SemanticTestProvider();
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
    const provider = createLayer3SemanticTestProvider();
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

  it('builds and broadcasts one transaction for two existing participants without setup execution', async () => {
    const provider = createLayer3SemanticTestProvider();
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
    const provider = createLayer3SemanticTestProvider();
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
    const provider = createLayer3SemanticTestProvider();
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
    const provider = createLayer3SemanticTestProvider();
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
    const provider = createLayer3SemanticTestProvider();
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
    const provider = createLayer3SemanticTestProvider();
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
    const provider = createLayer3SemanticTestProvider();
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
    await expect(composition.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 120_000);

  it('authenticates a fungible-token container and recipient settlement', async () => {
    const provider = createLayer3SemanticTestProvider();
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
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });

    const built = await composition.build();
    const tokenOutput = built.outputs.findIndex((output) =>
      output.token?.category === token.category && output.token.amount === amount && !output.token.nft);
    expect(tokenOutput).toBeGreaterThan(0);
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
    await expect(composition.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 120_000);

  it('authenticates NFT capability, commitment, recipient, and mixed-container settlement', async () => {
    const provider = createLayer3SemanticTestProvider();
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
