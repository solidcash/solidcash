import {
  bigIntToVmNumber, binToHex, decodeAuthenticationInstructions, encodeAuthenticationInstructions,
  encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import { Contract, StatefulContract, layer3 } from '../../src/index.js';
import { decodeSingleTxCarrier, encodeSingleTxCarrier } from '../../src/layer3/controllerless.js';
import { getEntryNftAddress } from '../../src/stateful/covenant-helpers.js';
import { encodeEntryCommitment, keyToSlot } from '../../src/stateful/SortedList.js';
import type { TransactionBuilder } from '../../src/TransactionBuilder.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../test-util.js';
import { createLayer3SemanticTestProvider } from './layer3-semantic-profile.js';

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

const mutateInputZero = (
  builder: TransactionBuilder, selectorHex: string,
  target: 'carrier' | 'emissions' | 'carrier-result' | 'carrier-event' | 'carrier-resource'
  | 'carrier-resource-mode' | 'carrier-resource-slot' | 'carrier-resource-subject',
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
            || target.startsWith('carrier-resource')
            ? index === 2 && hex.startsWith('4c334331') && hex.includes(selectorHex)
            : index > 2 && instruction.data.length < 128 && hex.includes(selectorHex);
        });
        if (instructionIndex < 0) throw new Error(`test could not locate ${target} frame`);
        const instruction = instructions[instructionIndex];
        if (!('data' in instruction)) throw new Error(`test ${target} frame is not a push`);
        if (target === 'carrier-result' || target === 'carrier-event' || target.startsWith('carrier-resource')) {
          const transcript = decodeSingleTxCarrier(instruction.data);
          const rowIndex = transcript.rows.findIndex((row) => target === 'carrier-result'
            ? row.resultHex.length > 0
            : row.kind === (target.startsWith('carrier-resource') ? 1 : 2) && row.effectHex.length > 0);
          if (rowIndex < 0) throw new Error(`test could not locate a ${target} row`);
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
          const field = hexToBin(target === 'carrier-result'
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
});
