import { hexToBin } from '@bitauth/libauth';
import { bytecodeToAsm } from '@solidcash/utils';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import { Contract, StatefulContract } from '../../../src/index.js';
import { encodeMessageBatch } from '../../../src/message-bus/message-bus.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../../test-util.js';

const SOURCE = `pragma solidcash ^0.13.0;
contract KernelAcc() {
  int x;
  function bump(int n) internal { this.x = this.x + n; }
  function add(int n) public {
    bump(n);
    require(true);
  }
  function check(int expected) public { require(this.x == expected); }
}`;

describe('kernel loop message-bus compose', () => {
  it('evaluates two logical add rows on the kernel route', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE, { forceStateful: true, messageBus: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'add')?.eligible).toBe(true);
    const routeBody = artifact.functionBodies?.['53434231'];
    expect(routeBody).toBeDefined();
    expect(bytecodeToAsm(hexToBin(routeBody!))).toMatch(/OP_UNTIL|OP_BEGIN/);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, { x: 0n }, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const call = contract.batch([{ function: 'add', args: [2n] }, { function: 'add', args: [3n] }]);
    const builder = await call.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction }))).toBe(true);
    }
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(
      StatefulContract.withCategory(inner, categoryId).check(5n).send(),
    ).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 180_000);

  it('fails closed for an unknown row selector and for too many rows', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE, { forceStateful: true, messageBus: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, { x: 0n }, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const add = artifact.messageBus!.handlers.find((handler) => handler.name === 'add')!;
    const encoded = encodeMessageBatch(artifact, [{ function: 'add', args: [1n] }]);
    const unknown = Uint8Array.from(encoded.blob);
    const selector = hexToBin(add.selector);
    const at = unknown.findIndex((_byte, index) => selector.every((value, offset) => unknown[index + offset] === value));
    expect(at).toBeGreaterThanOrEqual(0);
    unknown.set(hexToBin('deadbeef'), at);
    const unknownCall = contract._batchRaw(unknown, encoded.routeWitnesses);
    const unknownBuilder = await unknownCall.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const unknownTx = unknownBuilder.buildLibauthTransaction();
    const unknownSources = generateLibauthSourceOutputs(unknownBuilder.inputs);
    expect(unknownTx.inputs.some((_input, inputIndex) =>
      vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs: unknownSources, transaction: unknownTx }))
      !== true)).toBe(true);

    expect(artifact.messageBus!.maximumRows).toBeGreaterThanOrEqual(2);
    const tooMany = Array.from({ length: artifact.messageBus!.maximumRows + 1 }, () => (
      { function: 'add', args: [1n] }
    ));
    expect(() => encodeMessageBatch(artifact, tooMany)).toThrow(/row count must be between/);

    const overflow = Uint8Array.from(encoded.blob);
    overflow[6] = artifact.messageBus!.maximumRows + 1;
    const overflowCall = contract._batchRaw(overflow, encoded.routeWitnesses);
    const overflowBuilder = await overflowCall.build();
    const overflowTx = overflowBuilder.buildLibauthTransaction();
    const overflowSources = generateLibauthSourceOutputs(overflowBuilder.inputs);
    expect(overflowTx.inputs.some((_input, inputIndex) =>
      vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs: overflowSources, transaction: overflowTx }))
      !== true)).toBe(true);
  }, 180_000);
});
