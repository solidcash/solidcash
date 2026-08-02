import {
  binToHex, decodeAuthenticationInstructions, encodeAuthenticationInstructions, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import { Contract, StatefulContract, layer3 } from '../../src/index.js';
import type { TransactionBuilder } from '../../src/TransactionBuilder.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../test-util.js';
import { createLayer3SemanticTestProvider } from './layer3-semantic-profile.js';

const CALLEE = `contract ComposeCallee() {
  int counter;
  function settle(int next) public { this.counter = next; require(true); }
}`;

const CALLER = `
interface IComposeCallee { function settle(int next); }
contract ComposeCaller(address callee) {
  function prepare(int next) public {
    IComposeCallee(callee).settle(next);
    require(true);
  }
}`;

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));

const mutateInputZero = (
  builder: TransactionBuilder, selectorHex: string, target: 'carrier' | 'emissions',
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
          return target === 'carrier'
            ? index === 2 && hex.startsWith('4c334331') && hex.includes(selectorHex)
            : index > 2 && instruction.data.length < 128 && hex.includes(selectorHex);
        });
        if (instructionIndex < 0) throw new Error(`test could not locate ${target} frame`);
        const instruction = instructions[instructionIndex];
        if (!('data' in instruction)) throw new Error(`test ${target} frame is not a push`);
        const data = instruction.data.slice();
        const selectorOffset = binToHex(data).indexOf(selectorHex) / 2;
        data[selectorOffset] ^= 0x01;
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
    expect(built.inputs).toHaveLength(4);
    expect(built.outputs).toHaveLength(4);
    for (const mutation of ['carrier', 'emissions'] as const) {
      const hostile = await composition.build();
      mutateInputZero(hostile, calleeArtifact.abi.find((fn) => fn.name === 'settle')!.selector!, mutation);
      await expect(provider.sendRawTransaction(raw(hostile))).rejects.toThrow();
    }
    await expect(composition.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect((await callee.getState()).counter).toBe(7n);
  }, 120_000);
});
