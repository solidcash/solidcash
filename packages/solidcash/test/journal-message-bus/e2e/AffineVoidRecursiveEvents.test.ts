import { binToHex } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../../test-util.js';

const KERNEL = { forceStateful: true, messageBus: true, messageBusKernel: true } as const;

describe('affine void recursive event settlement', () => {
  it('settles a guarded tail-call stream with an inert unwind suffix in recursive source order', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract GuardedStream() {
      event Seen(int value);
      function descend(int cursor) public {
        emit Seen(cursor);
        if (cursor > 0) descend(cursor - 1);
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'descend')).toMatchObject({
      eligible: true,
      runtimeLoopEvents: [{
        iterationDomain: { counterName: 'cursor', maximumIterations: 64 },
        eventSignatures: ['Seen(int256)'],
      }],
    });

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const builder = await contract.call.descend(3n).build();
    const transaction = builder.buildLibauthTransaction();
    expect(transaction.outputs
      .filter((output) => output.token?.nft?.capability === 'none')
      .map((output) => binToHex(output.token!.nft!.commitment)))
      .toEqual(['53', '52', '51', '00']);

    const vm = createVirtualMachineBch2026ForProvider(provider);
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
        .toBe(true);
    }
    await expect(contract.call.descend(63n).build()).resolves.toBeDefined();
    await expect(contract.call.descend(64n).build())
      .rejects.toThrow(/exceeds its compiler-published maximum/);
  }, 180_000);

  it('reconstructs multiple affine parameters for a pre-only stream and enforces exact termination', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract RecursiveStream() {
      event Seen(bigint cursor, bigint value, bigint reverse);
      event Marker(bigint reverse);
      function descend(bigint cursor, bigint value, bigint reverse, bigint stride, bigint delta) public {
        emit Seen(cursor, value, reverse);
        if (cursor % 4 == 0) emit Marker(reverse);
        if (cursor == 0) return;
        descend(cursor - stride, value + delta, reverse - 3, stride, delta);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'descend')).toMatchObject({
      eligible: true,
      runtimeLoopEvents: [{
        iterationDomain: { initialValue: { value: '0' }, maximumIterations: 64 },
        eventSignatures: ['Seen(bigint,bigint,bigint)', 'Marker(bigint)'],
      }],
    });

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const builder = await contract.call.descend(6n, 10n, 20n, 2n, 3n).build();
    const transaction = builder.buildLibauthTransaction();
    expect(transaction.outputs
      .filter((output) => output.token?.nft?.capability === 'none')
      .map((output) => binToHex(output.token!.nft!.commitment)))
      .toEqual(['565a0114', '545d0111', '0111', '52605e', '0001135b', '5b']);

    const vm = createVirtualMachineBch2026ForProvider(provider);
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
        .toBe(true);
    }

    await expect(contract.call.descend(126n, 0n, 0n, 2n, 1n).build()).resolves.toBeDefined();
    await expect(contract.call.descend(128n, 0n, 0n, 2n, 1n).build())
      .rejects.toThrow(/exceeds its compiler-published maximum/);
    // descend(5, stride 2) never lands on 0, so the affine frame guard refuses it during derivation.
    await expect(contract.call.descend(5n, 10n, 20n, 2n, 3n).build())
      .rejects.toThrow(/recursive affine frame count must be exact/);
  }, 180_000);

  it('reconstructs independent affine parameters during non-void unwind', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract RecursiveUnwind() {
      event Seen(bigint value, bigint reverse);
      function descend(bigint cursor, bigint value, bigint reverse, bigint stride, bigint delta)
        public returns (bigint) {
        if (cursor == 0) return value - reverse;
        bigint result = descend(cursor - stride, value + delta, reverse - 3, stride, delta);
        require(result == 8);
        if (value % 2 == 0) emit Seen(value, reverse);
        return result;
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'descend')).toMatchObject({
      eligible: true,
      runtimeLoopEvents: [{
        iterationDomain: { initialValue: { value: '1' }, maximumIterations: 64 },
        eventSignatures: ['Seen(bigint,bigint)'],
      }],
    });

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const builder = await contract.call.descend(6n, 10n, 20n, 2n, 3n).build();
    const transaction = builder.buildLibauthTransaction();
    expect(transaction.outputs
      .filter((output) => output.token?.nft?.capability === 'none')
      .map((output) => binToHex(output.token!.nft!.commitment)))
      .toEqual(['605e', '5a0114']);

    const vm = createVirtualMachineBch2026ForProvider(provider);
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
        .toBe(true);
    }

    await expect(contract.call.descend(128n, 0n, 248n, 2n, 1n).build()).resolves.toBeDefined();
    await expect(contract.call.descend(130n, 0n, 252n, 2n, 1n).build())
      .rejects.toThrow(/exceeds its compiler-published maximum/);
    // descend(5, stride 2) visits 5, 3, 1, -1, ... and never lands on 0, so the affine frame guard refuses
    // it during derivation ("recursive affine frame count must be exact") instead of building for a VM miss.
    await expect(contract.call.descend(5n, 10n, 20n, 2n, 3n).build())
      .rejects.toThrow(/recursive affine frame count must be exact/);
  }, 180_000);

  it('settles every pre-recursion frame, rejects a forged event, and enforces the frame bound', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract RecursiveStream() {
      event Seen(bigint value);
      function descend(bigint cursor, bigint stride) public {
        emit Seen(cursor);
        if (cursor == 0) return;
        descend(cursor - stride, stride);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'descend')).toMatchObject({
      eligible: true,
      runtimeLoopEvents: [{
        iterationDomain: { counterName: 'cursor', maximumIterations: 64 },
        eventSignatures: ['Seen(bigint)'],
      }],
    });

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const builder = await contract.call.descend(6n, 2n).build();
    const transaction = builder.buildLibauthTransaction();
    const events = transaction.outputs.filter((output) => output.token?.nft?.capability === 'none');
    expect(events.map((output) => binToHex(output.token!.nft!.commitment))).toEqual(['56', '54', '52', '00']);

    const vm = createVirtualMachineBch2026ForProvider(provider);
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
        .toBe(true);
    }
    const eventIndex = transaction.outputs.findIndex((output) => output.token?.nft?.capability === 'none');
    const eventOutput = transaction.outputs[eventIndex];
    const hostile = {
      ...transaction,
      outputs: transaction.outputs.map((output, index) => index === eventIndex ? {
        ...output,
        token: {
          ...eventOutput.token!,
          nft: { ...eventOutput.token!.nft!, commitment: Uint8Array.of(9) },
        },
      } : output),
    };
    expect(vm.stateSuccess(vm.evaluate({ inputIndex: 0, sourceOutputs, transaction: hostile }))).not.toBe(true);

    await expect(contract.call.descend(63n, 1n).build()).resolves.toBeDefined();
    await expect(contract.call.descend(1n, 0n).build()).rejects.toThrow(/step must be non-zero/);
    await expect(contract.call.descend(64n, 1n).build())
      .rejects.toThrow(/exceeds its compiler-published maximum/);
  }, 180_000);

  it('settles mixed pre-order and post-descent events in recursive source order', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract UnwindStream() {
      event Seen(bigint value);
      function descend(bigint cursor, bigint stride) public {
        emit Seen(cursor);
        if (cursor == 0) return;
        descend(cursor - stride, stride);
        emit Seen(cursor);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'descend')).toMatchObject({
      eligible: true,
      runtimeLoopEvents: [
        { iterationDomain: { initialValue: { value: '0' }, maximumIterations: 64 },
          eventSignatures: ['Seen(bigint)'] },
        { iterationDomain: { initialValue: { value: '1' }, maximumIterations: 64 },
          eventSignatures: ['Seen(bigint)'] },
      ],
    });

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const builder = await contract.call.descend(6n, 2n).build();
    const transaction = builder.buildLibauthTransaction();
    const events = transaction.outputs.filter((output) => output.token?.nft?.capability === 'none');
    expect(events.map((output) => binToHex(output.token!.nft!.commitment)))
      .toEqual(['56', '54', '52', '00', '52', '54', '56']);

    const vm = createVirtualMachineBch2026ForProvider(provider);
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
        .toBe(true);
    }
    const eventIndex = transaction.outputs.findIndex((output) => output.token?.nft?.capability === 'none');
    const eventOutput = transaction.outputs[eventIndex];
    const hostile = {
      ...transaction,
      outputs: transaction.outputs.map((output, index) => index === eventIndex ? {
        ...output,
        token: {
          ...eventOutput.token!,
          nft: { ...eventOutput.token!.nft!, commitment: Uint8Array.of(9) },
        },
      } : output),
    };
    expect(vm.stateSuccess(vm.evaluate({ inputIndex: 0, sourceOutputs, transaction: hostile }))).not.toBe(true);
    const lastEventIndex = transaction.outputs.findLastIndex(
      (output) => output.token?.nft?.capability === 'none',
    );
    const lastEventOutput = transaction.outputs[lastEventIndex];
    const hostileSuffix = {
      ...transaction,
      outputs: transaction.outputs.map((output, index) => index === lastEventIndex ? {
        ...output,
        token: {
          ...lastEventOutput.token!,
          nft: { ...lastEventOutput.token!.nft!, commitment: Uint8Array.of(9) },
        },
      } : output),
    };
    expect(vm.stateSuccess(vm.evaluate({
      inputIndex: 0, sourceOutputs, transaction: hostileSuffix,
    }))).not.toBe(true);

    const zero = await contract.call.descend(0n, 2n).build();
    expect(zero.buildLibauthTransaction().outputs
      .filter((output) => output.token?.nft?.capability === 'none')
      .map((output) => binToHex(output.token!.nft!.commitment))).toEqual(['00']);
    await expect(contract.call.descend(126n, 2n).build()).resolves.toBeDefined();
    await expect(contract.call.descend(2n, 0n).build()).rejects.toThrow(/step must be non-zero|Division by zero/);
    await expect(contract.call.descend(128n, 2n).build())
      .rejects.toThrow(/exceeds its compiler-published maximum/);
    // descend(5, stride 2) never lands on 0, so the affine frame guard refuses it during derivation.
    await expect(contract.call.descend(5n, 2n).build())
      .rejects.toThrow(/recursive affine frame count must be exact/);
  }, 180_000);

  it('reconstructs multiple affine parameters across descent and unwind', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract RecursiveStream() {
      event Seen(bigint value);
      function descend(bigint cursor, bigint value) public {
        emit Seen(value);
        if (cursor == 0) return;
        descend(cursor - 2, value + 3);
        emit Seen(value);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'descend')).toMatchObject({
      eligible: true,
      runtimeLoopEvents: [
        { iterationDomain: { initialValue: { value: '0' }, maximumIterations: 64 } },
        { iterationDomain: { initialValue: { value: '1' }, maximumIterations: 64 } },
      ],
    });

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const builder = await contract.call.descend(6n, 10n).build();
    const transaction = builder.buildLibauthTransaction();
    const events = transaction.outputs.filter((output) => output.token?.nft?.capability === 'none');
    expect(events.map((output) => binToHex(output.token!.nft!.commitment)))
      .toEqual(['5a', '5d', '60', '0113', '60', '5d', '5a']);

    const vm = createVirtualMachineBch2026ForProvider(provider);
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
        .toBe(true);
    }
    const suffixIndex = transaction.outputs.findLastIndex(
      (output) => output.token?.nft?.capability === 'none',
    );
    const suffix = transaction.outputs[suffixIndex];
    const hostile = {
      ...transaction,
      outputs: transaction.outputs.map((output, index) => index === suffixIndex ? {
        ...output,
        token: {
          ...suffix.token!, nft: { ...suffix.token!.nft!, commitment: Uint8Array.of(9) },
        },
      } : output),
    };
    expect(vm.stateSuccess(vm.evaluate({ inputIndex: 0, sourceOutputs, transaction: hostile }))).not.toBe(true);
  }, 180_000);

  it('settles affine-counter progression in exact pre-order and unwind order at the 64-frame boundary', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract RecursiveCounterDelta() {
      event Seen(bigint value);
      function descend(bigint cursor, bigint value, bigint stride, bigint bias) public {
        emit Seen(value);
        if (cursor == 0) return;
        descend(cursor - stride, value + cursor + bias, stride, bias);
        emit Seen(value);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'descend')).toMatchObject({
      eligible: true,
      runtimeLoopEvents: [
        { iterationDomain: { initialValue: { value: '0' }, maximumIterations: 64 } },
        { iterationDomain: { initialValue: { value: '1' }, maximumIterations: 64 } },
      ],
    });

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const builder = await contract.call.descend(6n, 10n, 2n, 1n).build();
    const transaction = builder.buildLibauthTransaction();
    const events = transaction.outputs.filter((output) => output.token?.nft?.capability === 'none');
    expect(events.map((output) => binToHex(output.token!.nft!.commitment)))
      .toEqual(['5a', '0111', '0116', '0119', '0116', '0111', '5a']);

    const vm = createVirtualMachineBch2026ForProvider(provider);
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
        .toBe(true);
    }
    const eventIndex = transaction.outputs.findIndex((output) => output.token?.nft?.capability === 'none');
    const eventOutput = transaction.outputs[eventIndex];
    const hostile = {
      ...transaction,
      outputs: transaction.outputs.map((output, index) => index === eventIndex ? {
        ...output,
        token: {
          ...eventOutput.token!,
          nft: { ...eventOutput.token!.nft!, commitment: Uint8Array.of(9) },
        },
      } : output),
    };
    expect(vm.stateSuccess(vm.evaluate({ inputIndex: 0, sourceOutputs, transaction: hostile }))).not.toBe(true);

    await expect(contract.call.descend(126n, 0n, 2n, 0n).build()).resolves.toBeDefined();
    await expect(contract.call.descend(128n, 0n, 2n, 0n).build())
      .rejects.toThrow(/exceeds its compiler-published maximum/);
    // descend(5, stride 2) never lands on 0, so the affine frame guard refuses it during derivation.
    await expect(contract.call.descend(5n, 10n, 2n, 1n).build())
      .rejects.toThrow(/recursive affine frame count must be exact/);
  }, 180_000);

  it('fences checked regrouping while bigint progression remains unrestricted', async () => {
    const provider = createTestProvider();
    const checkedArtifact = compileString(`contract CheckedCounterDelta() {
      event Seen(uint8 value);
      function descend(uint8 cursor, uint8 value) public {
        emit Seen(value);
        if (cursor == 0) return;
        descend(cursor - 1, value + cursor);
      }
      function control() public { require(true); }
    }`, KERNEL);
    // All 20 source-ordered updates fit (the terminal value is 210), while the regrouped gross term would be
    // 20 * 20 = 400 before triangular correction. Refuse the replay instead of changing checked semantics.
    expect(checkedArtifact.messageBus?.handlers.find((handler) => handler.name === 'descend'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });

    const bigintArtifact = compileString(`contract BigintCounterDelta() {
      event Seen(bigint value);
      function descend(bigint cursor, bigint value) public {
        emit Seen(value);
        if (cursor == 0) return;
        descend(cursor - 1, value + cursor);
      }
    }`, KERNEL);
    const bigintInner = new Contract(bigintArtifact, [], { provider });
    const { categoryId: bigintCategory } = await setupStatefulUtxos(
      provider, bigintInner, bigintArtifact.stateLayout!, {}, { saltContract: true },
    );
    const bigint = StatefulContract.withCategory(bigintInner, bigintCategory);
    const unrestricted = await bigint.call.descend(2n, 253n).build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    expect(vm.stateSuccess(vm.evaluate({
      inputIndex: 0,
      sourceOutputs: generateLibauthSourceOutputs(unrestricted.inputs),
      transaction: unrestricted.buildLibauthTransaction(),
    }))).toBe(true);
  }, 180_000);
});
