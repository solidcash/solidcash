import {
  binToHex, decodeAuthenticationInstructions, encodeAuthenticationInstructions, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import { Contract, StatefulContract, layer3 } from '../../src/index.js';
import { decodeSingleTxCarrier, encodeSingleTxCarrier } from '../../src/layer3/controllerless.js';
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
  target: 'carrier' | 'emissions' | 'carrier-result',
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
          return target === 'carrier' || target === 'carrier-result'
            ? index === 2 && hex.startsWith('4c334331') && hex.includes(selectorHex)
            : index > 2 && instruction.data.length < 128 && hex.includes(selectorHex);
        });
        if (instructionIndex < 0) throw new Error(`test could not locate ${target} frame`);
        const instruction = instructions[instructionIndex];
        if (!('data' in instruction)) throw new Error(`test ${target} frame is not a push`);
        if (target === 'carrier-result') {
          const transcript = decodeSingleTxCarrier(instruction.data);
          const rowIndex = transcript.rows.findIndex((row) => row.resultHex.length > 0);
          if (rowIndex < 0) throw new Error('test could not locate a returning carrier row');
          const result = hexToBin(transcript.rows[rowIndex].resultHex);
          result[result.length - 1] ^= 0x01;
          const rows = transcript.rows.map((row, index) => index === rowIndex
            ? { ...row, resultHex: binToHex(result) } : row);
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
});
