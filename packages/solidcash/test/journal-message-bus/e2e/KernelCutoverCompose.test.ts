import { binToHex, hexToBin } from '@bitauth/libauth';
import { bytecodeToAsm } from '@solidcash/utils';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import { encodeMessageBatch } from '../../../src/message-bus/message-bus.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { alicePkh } from '../../fixture/vars.js';
import { createTestProvider, genesisFtContainer, setupStatefulUtxos } from '../../test-util.js';

const KERNEL = { forceStateful: true, messageBus: true, messageBusKernel: true } as const;

const SOURCE = `pragma solidcash ^0.14.0;
contract KernelLedger() {
  mapping(bytes20 => int) balances;
  function bump(bytes20 who, int n) internal {
    this.balances[who] = this.balances[who] + n;
  }
  function credit(bytes20 who, int n) public {
    bump(who, n);
    require(true);
  }
  function check(bytes20 who, int expected) public {
    require(this.balances[who] == expected);
  }
}`;

describe('kernel cutover mapping compose', () => {
  it('evaluates two logical credit rows on the same mapping entry', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'credit')?.eligible).toBe(true);
    const routeBody = artifact.functionBodies?.['53434231'];
    expect(routeBody).toBeDefined();
    expect(bytecodeToAsm(hexToBin(routeBody!))).toMatch(/OP_UNTIL|OP_BEGIN/);
    expect(artifact.messageBus?.route.inputs.some((input) => /_r\d+$/.test(input.name))).toBe(false);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    await contract.credit(alicePkh, 0n).send();
    const call = contract.batch([
      { function: 'credit', args: [alicePkh, 2n] },
      { function: 'credit', args: [alicePkh, 3n] },
    ]);
    const builder = await call.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction }))).toBe(true);
    }
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(
      StatefulContract.withCategory(inner, categoryId).check(alicePkh, 5n).send(),
    ).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 180_000);

  it('fails closed for an unknown row selector and for too many rows', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE, KERNEL);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    await contract.credit(alicePkh, 0n).send();
    const credit = artifact.messageBus!.handlers.find((handler) => handler.name === 'credit')!;
    const encoded = encodeMessageBatch(artifact, [{ function: 'credit', args: [alicePkh, 1n] }]);
    const unknown = Uint8Array.from(encoded.blob);
    const selector = hexToBin(credit.selector);
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
      { function: 'credit', args: [alicePkh, 1n] }
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

const TOKEN_SOURCE = `pragma solidcash ^0.14.0;
contract KernelVault() {
  function send(bytes32 category, bytes recipient, int amount) public {
    require(this.tokens[category].tokenAmount >= amount);
    this.tokens[category].transfer(recipient, amount);
    require(true);
  }
}`;

const aliceP2pkh = new Uint8Array([0x76, 0xa9, 0x14, ...alicePkh, 0x88, 0xac]);

describe('kernel cutover token-container compose', () => {
  it('evaluates two logical FT send rows on a 1:1 kernel block', async () => {
    const provider = createTestProvider();
    const artifact = compileString(TOKEN_SOURCE, KERNEL);
    expect(artifact.messageBus?.version).toBe(1);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'send')?.eligible).toBe(true);
    const routeBody = artifact.functionBodies?.['53434231'];
    expect(routeBody).toBeDefined();
    expect(bytecodeToAsm(hexToBin(routeBody!))).toMatch(/OP_UNTIL|OP_BEGIN/);
    expect(artifact.messageBus?.route.inputs.some((input) => /_r\d+$/.test(input.name))).toBe(false);
    const frame = artifact.messageBus!.route.graphEffectFrame;
    expect(frame).toBeDefined();
    expect(frame!.sites).toBeGreaterThanOrEqual(2);
    expect(frame!.tokenTransferWidth).toBeGreaterThanOrEqual(1);
    const layout = artifact.messageBus!.route.blockLayout!;
    const tcSlots = layout.slots.filter((slot) => slot.kind === 'tcTransfer');
    expect(tcSlots.length).toBe(frame!.sites * frame!.tokenTransferWidth);
    expect(layout.slots.some((slot) => slot.kind === 'tokenContainer')).toBe(true);

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    // Containers bind the master's lock: fund them for the category-pinned master.
    const token = await genesisFtContainer(provider, contract.inner, categoryId, [100n]);
    const first = 25n;
    const second = 40n;
    const call = contract.batch([
      { function: 'send', args: [hexToBin(token.category), aliceP2pkh, first] },
      { function: 'send', args: [hexToBin(token.category), aliceP2pkh, second] },
    ]);
    call.tokenContainerTransfer(token.category, aliceP2pkh, first);
    call.tokenContainerTransfer(token.category, aliceP2pkh, second);
    const builder = await call.build();
    const blockSize = layout.blockSize;
    expect(builder.inputs.length).toBeGreaterThanOrEqual(blockSize);
    expect(builder.outputs.length).toBeGreaterThanOrEqual(blockSize);
    for (const slot of layout.slots) {
      expect(builder.inputs[slot.offset], `missing input for ${slot.kind}@${slot.offset}`).toBeDefined();
      expect(builder.outputs[slot.offset], `missing output for ${slot.kind}@${slot.offset}`).toBeDefined();
    }
    expect(builder.inputs.slice(0, blockSize).length).toBe(builder.outputs.slice(0, blockSize).length);
    expect(builder.inputs.slice(0, blockSize).length).toBe(blockSize);

    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const formatVm = (value: unknown): string => JSON.stringify(
      value,
      (_key, nestedValue) => (typeof nestedValue === 'bigint' ? nestedValue.toString() : nestedValue),
    );
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      const result = vm.evaluate({ inputIndex, sourceOutputs, transaction });
      expect(vm.stateSuccess(result), `input ${inputIndex}: ${formatVm(result)}`).toBe(true);
    }

    const tokenOutputs = builder.outputs.filter((output) =>
      output.token?.category === token.category && !output.token.nft
      && typeof output.to !== 'string' && binToHex(output.to) === binToHex(aliceP2pkh));
    expect(tokenOutputs.map((output) => output.token!.amount).sort((a, b) => Number(a - b)))
      .toEqual([first, second]);
    const remainder = builder.outputs.find((output) =>
      output.token?.category === token.category && output.token.amount === 100n - first - second);
    expect(remainder).toBeDefined();

    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 180_000);

  it('fails closed for an unknown row selector and for too many rows', async () => {
    const provider = createTestProvider();
    const artifact = compileString(TOKEN_SOURCE, KERNEL);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const token = await genesisFtContainer(provider, inner, categoryId, [100n]);
    const send = artifact.messageBus!.handlers.find((handler) => handler.name === 'send')!;
    const encoded = encodeMessageBatch(artifact, [
      { function: 'send', args: [hexToBin(token.category), aliceP2pkh, 1n] },
    ]);
    const unknown = Uint8Array.from(encoded.blob);
    const selector = hexToBin(send.selector);
    const at = unknown.findIndex((_byte, index) => selector.every((value, offset) => unknown[index + offset] === value));
    expect(at).toBeGreaterThanOrEqual(0);
    unknown.set(hexToBin('deadbeef'), at);
    const unknownCall = contract._batchRaw(unknown, encoded.routeWitnesses);
    unknownCall.tokenContainerTransfer(token.category, aliceP2pkh, 1n);
    const unknownBuilder = await unknownCall.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const unknownTx = unknownBuilder.buildLibauthTransaction();
    const unknownSources = generateLibauthSourceOutputs(unknownBuilder.inputs);
    expect(unknownTx.inputs.some((_input, inputIndex) =>
      vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs: unknownSources, transaction: unknownTx }))
      !== true)).toBe(true);

    expect(artifact.messageBus!.maximumRows).toBeGreaterThanOrEqual(2);
    const tooMany = Array.from({ length: artifact.messageBus!.maximumRows + 1 }, () => (
      { function: 'send', args: [hexToBin(token.category), aliceP2pkh, 1n] }
    ));
    expect(() => encodeMessageBatch(artifact, tooMany)).toThrow(/row count must be between/);

    const overflow = Uint8Array.from(encoded.blob);
    overflow[6] = artifact.messageBus!.maximumRows + 1;
    const overflowCall = contract._batchRaw(overflow, encoded.routeWitnesses);
    overflowCall.tokenContainerTransfer(token.category, aliceP2pkh, 1n);
    const overflowBuilder = await overflowCall.build();
    const overflowTx = overflowBuilder.buildLibauthTransaction();
    const overflowSources = generateLibauthSourceOutputs(overflowBuilder.inputs);
    expect(overflowTx.inputs.some((_input, inputIndex) =>
      vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs: overflowSources, transaction: overflowTx }))
      !== true)).toBe(true);
  }, 180_000);
});
