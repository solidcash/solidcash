import { binToHex, hexToBin } from '@bitauth/libauth';
import { encodeEventCommitment } from '@solidcash/utils';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import { Contract, type TransactionBuilder } from '../../src/index.js';
import {
  StatefulContract, getEventNftAddress, getEventNftContinuationAddress,
} from '../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { addressToLockScript, generateLibauthSourceOutputs } from '../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

/**
 * A kernel handler whose emits all sit at its top level settles them on its runtime effect stream at consecutive
 * trailing outputs: one compact record per emit, or, when an emit can exceed one 128-byte commitment, one record
 * per chunk, the head at the event covenant and the rest at its continuation covenant. `Wide` always spans two
 * commitments (5 x 33 bytes); `Many` grows with its array; `Narrow` fits one.
 */
const KERNEL = { forceStateful: true, messageBus: true, messageBusKernel: true } as const;
const SOURCE = `pragma solidcash ^0.14.0;
contract StreamedWideEvents() {
  int count;
  event Wide(bytes32 a, bytes32 b, bytes32 c, bytes32 d, bytes32 e);
  event Many(int[] values);
  event Narrow(int value);
  function wide(bytes32 a, bytes32 b) public {
    this.count = this.count + 1;
    emit Narrow(7);
    emit Wide(a, b, a, b, a);
    require(true);
  }
  function many(int[] values) public {
    this.count = this.count + 1;
    emit Many(values);
    require(true);
  }
  function narrow(int value) public {
    this.count = this.count + value;
    emit Narrow(value);
    require(true);
  }
}`;

type LibauthTransaction = ReturnType<TransactionBuilder['buildLibauthTransaction']>;

describe('kernel route wide events on the runtime effect stream', () => {
  const artifact = compileString(SOURCE, KERNEL);
  const words = [new Uint8Array(32).fill(0x11), new Uint8Array(32).fill(0x22)];

  const deploy = async (): Promise<{
    provider: ReturnType<typeof createTestProvider>; contract: StatefulContract; salted: Contract;
    categoryId: string;
  }> => {
    const provider = createTestProvider();
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, { count: 0n }, { saltContract: true },
    );
    return {
      provider, contract: StatefulContract.withCategory(inner, categoryId),
      salted: inner.withCategory(hexToBin(categoryId)), categoryId,
    };
  };
  const lockOf = (address: string): string => binToHex(addressToLockScript(address));
  const eventOutputs = (transaction: LibauthTransaction): Array<{
    index: number; lock: string; commitment: string;
  }> => transaction.outputs.flatMap((output, index) => (output.token?.nft?.capability === 'none'
    ? [{ index, lock: binToHex(output.lockingBytecode), commitment: binToHex(output.token.nft.commitment) }] : []));
  const evaluates = (
    provider: ReturnType<typeof createTestProvider>, transaction: LibauthTransaction,
    sourceOutputs: ReturnType<typeof generateLibauthSourceOutputs>, inputIndex: number,
  ): boolean => {
    const vm = createVirtualMachineBch2026ForProvider(provider);
    return vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })) === true;
  };

  it('admits the wide handlers on chunked streams and the narrow handler on a compact stream', () => {
    const handler = (name: string): Record<string, unknown> | undefined => artifact.messageBus?.handlers
      .find((candidate) => candidate.name === name) as Record<string, unknown> | undefined;
    const signature = (name: string): string => artifact.events!.find((event) => event.name === name)!.signature;
    expect(handler('wide')).toMatchObject({
      eligible: true,
      runtimeLoopEvents: [{ repeatCount: 1, eventSignatures: [signature('Narrow'), signature('Wide')], chunked: true }],
    });
    expect(handler('wide')?.emits).toBeUndefined();
    expect(handler('many')).toMatchObject({
      eligible: true, runtimeLoopEvents: [{ repeatCount: 1, eventSignatures: [signature('Many')], chunked: true }],
    });
    expect(handler('narrow')).toMatchObject({
      eligible: true, runtimeLoopEvents: [{ repeatCount: 1, eventSignatures: [signature('Narrow')], stream: true }],
    });
    expect(handler('narrow')?.emits).toBeUndefined();
    expect((handler('narrow')?.runtimeLoopEvents as { chunked?: true }[])[0].chunked).toBeUndefined();
    // No handler keeps an event window, so the route reserves none.
    expect(artifact.messageBus?.route.blockLayout?.slots.some((slot) => slot.kind === 'event')).toBe(false);
    expect(artifact.messageBus?.route.blockLayout?.trailingCapacity).toBeGreaterThanOrEqual(64);
  });

  it('settles a compact record as an own-category immutable NFT and refuses a forged one', async () => {
    const { provider, contract, salted, categoryId } = await deploy();
    const call = contract.batch([{ function: 'narrow', args: [5n] }]);
    const builder = await call.build();
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(evaluates(provider, transaction, sourceOutputs, inputIndex), `input ${inputIndex}`).toBe(true);
    }
    const narrow = artifact.events!.find((event) => event.name === 'Narrow')!;
    const events = eventOutputs(transaction);
    expect(events.map((event) => event.lock)).toEqual([lockOf(getEventNftAddress(salted, categoryId, narrow.signature))]);
    expect(events[0].commitment).toBe(binToHex(encodeEventCommitment(narrow.parameters, [5n])));
    const withNft = (change: (nft: { capability: 'none' | 'mutable' | 'minting'; commitment: Uint8Array }) => object):
    LibauthTransaction => ({
      ...transaction,
      outputs: transaction.outputs.map((output, index) => (index === events[0].index ? {
        ...output, token: { ...output.token!, nft: { ...output.token!.nft!, ...change(output.token!.nft!) } },
      } : output)),
    });
    expect(evaluates(provider, withNft(() => ({ commitment: Uint8Array.of(0xff) })), sourceOutputs, 0)).toBe(false);
    expect(evaluates(provider, withNft(() => ({ capability: 'mutable' })), sourceOutputs, 0)).toBe(false);
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 300_000);

  it('settles head and continuation records in order and refuses a forged or reordered chunk', async () => {
    const { provider, contract, salted, categoryId } = await deploy();
    const call = contract.batch([{ function: 'wide', args: words }]);
    const builder = await call.build();
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(evaluates(provider, transaction, sourceOutputs, inputIndex), `input ${inputIndex}`).toBe(true);
    }

    const wide = artifact.events!.find((event) => event.name === 'Wide')!;
    const narrow = artifact.events!.find((event) => event.name === 'Narrow')!;
    const payload = binToHex(encodeEventCommitment(wide.parameters, [...words, words[0], words[1], words[0]]));
    const events = eventOutputs(transaction);
    expect(events.map((event) => event.lock)).toEqual([
      lockOf(getEventNftAddress(salted, categoryId, narrow.signature)),
      lockOf(getEventNftAddress(salted, categoryId, wide.signature)),
      lockOf(getEventNftContinuationAddress(salted, categoryId, wide.signature)),
    ]);
    expect(events.map((event) => event.index)).toEqual([events[0].index, events[0].index + 1, events[0].index + 2]);
    expect(events[0].commitment).toBe(binToHex(encodeEventCommitment(narrow.parameters, [7n])));
    expect(events[1].commitment + events[2].commitment).toBe(payload);
    expect(events[1].commitment.length / 2).toBe(128);

    const forged = {
      ...transaction,
      outputs: transaction.outputs.map((output, index) => (index === events[2].index ? {
        ...output, token: { ...output.token!, nft: { ...output.token!.nft!, commitment: Uint8Array.of(0xff) } },
      } : output)),
    };
    expect(evaluates(provider, forged, sourceOutputs, 0)).toBe(false);
    const reordered = {
      ...transaction,
      outputs: transaction.outputs.map((output, index) => (index === events[1].index
        ? transaction.outputs[events[2].index]
        : index === events[2].index ? transaction.outputs[events[1].index] : output)),
    };
    expect(evaluates(provider, reordered, sourceOutputs, 0)).toBe(false);
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 300_000);

  it('learns the record count of a dynamic-array payload from the trace', async () => {
    const { provider, contract, salted, categoryId } = await deploy();
    const values = Array.from({ length: 48 }, (_unused, index) => 100_000n + BigInt(index));
    const builder = await contract.batch([{ function: 'many', args: [values] }]).build();
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(evaluates(provider, transaction, sourceOutputs, inputIndex), `input ${inputIndex}`).toBe(true);
    }
    const many = artifact.events!.find((event) => event.name === 'Many')!;
    const events = eventOutputs(transaction);
    const continuation = lockOf(getEventNftContinuationAddress(salted, categoryId, many.signature));
    expect(events.length).toBeGreaterThan(1);
    expect(events[0].lock).toBe(lockOf(getEventNftAddress(salted, categoryId, many.signature)));
    expect(events.slice(1).every((event) => event.lock === continuation)).toBe(true);
    expect(events.map((event) => event.index - events[0].index)).toEqual(events.map((_event, index) => index));
    expect(events.slice(0, -1).every((event) => event.commitment.length / 2 === 128)).toBe(true);
  }, 300_000);
});
