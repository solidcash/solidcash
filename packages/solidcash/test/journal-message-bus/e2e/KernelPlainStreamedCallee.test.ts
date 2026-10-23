import { binToHex, hexToBin } from '@bitauth/libauth';
import { encodeEventCommitment } from '@solidcash/utils';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract, Signer, type TransactionBuilder } from '../../../src/index.js';
import { StatefulContract, getEventNftAddress, getEventNftContinuationAddress } from '../../../src/stateful/index.js';
import { MockNetworkProvider } from '../../../src/network/mock/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { addressToLockScript, generateLibauthSourceOutputs, randomUtxo } from '../../../src/utils.js';
import { setupStatefulUtxos } from '../../test-util.js';
import { alicePriv } from '../../fixture/vars.js';

const KERNEL = { forceStateful: true, messageBus: true, messageBusKernel: true } as const;

const inputResults = (builder: TransactionBuilder): Array<true | string> => {
  const transaction = builder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const vm = createVirtualMachineBch2026ForProvider();
  return transaction.inputs.map((_input, inputIndex) => vm.stateSuccess(
    vm.evaluate({ inputIndex, sourceOutputs, transaction }),
  ));
};

describe('streamed events from a routed callee on the plain call path', () => {
  it('places a compact callee record and rejects a forged commitment or capability', async () => {
    const provider = new MockNetworkProvider();
    const calleeArtifact = compileString(`contract PlainStreamCallee() {
      int seen;
      event Recorded(int value);
      function record(int value) public {
        this.seen = value;
        emit Recorded(value);
        require(value >= 0);
      }
    }`, KERNEL);
    const handler = calleeArtifact.messageBus!.handlers.find((candidate) => candidate.name === 'record')!;
    expect(handler.runtimeLoopEvents).toEqual([
      expect.objectContaining({ eventSignatures: ['Recorded(int256)'], stream: true }),
    ]);
    expect(handler.emits).toBeUndefined();
    const calleeBase = new Contract(calleeArtifact, [], { provider });
    const calleeSetup = await setupStatefulUtxos(
      provider, calleeBase, calleeArtifact.stateLayout!, { seen: 0n }, { saltContract: true },
    );
    const callee = StatefulContract.withCategory(
      calleeBase.withCategory(hexToBin(calleeSetup.categoryId)), calleeSetup.categoryId,
    );
    const callerArtifact = compileString(`
      interface IPlainStreamCallee { function record(int value); }
      contract PlainStreamCaller(address target) {
        function forward(int value) public {
          IPlainStreamCallee(target).record(value);
          IPlainStreamCallee(target).record(value + 1);
          require(true);
        }
      }
    `, KERNEL);
    const callerBase = new Contract(callerArtifact, [callee.inner.lockingBytecode], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    caller._registerResolvedExternal('IPlainStreamCallee', callee);

    const call = caller.call.forward(7n);
    const builder = await call.build();
    expect(inputResults(builder)).toEqual(builder.inputs.map(() => true));
    const event = calleeArtifact.events![0];
    const eventLock = binToHex(addressToLockScript(getEventNftAddress(
      callee.inner, calleeSetup.categoryId, event.signature,
    )));
    const eventIndex = builder.outputs.findIndex((output) => output.token?.nft?.capability === 'none'
      && binToHex(typeof output.to === 'string' ? addressToLockScript(output.to) : output.to) === eventLock);
    expect(eventIndex).toBeGreaterThan(0);
    expect(builder.outputs[eventIndex].token!.nft!.commitment)
      .toBe(binToHex(encodeEventCommitment(event.parameters, [7n])));
    expect(builder.outputs.filter((output) => output.token?.category === calleeSetup.categoryId
      && output.token.nft?.capability === 'none').map((output) => output.token!.nft!.commitment))
      .toEqual([7n, 8n].map((value) => binToHex(encodeEventCommitment(event.parameters, [value]))));
    for (const mutation of ['commitment', 'capability'] as const) {
      const hostile = await call.build();
      const nft = hostile.outputs[eventIndex].token!.nft!;
      if (mutation === 'commitment') nft.commitment = 'ff';
      else nft.capability = 'mutable';
      expect(inputResults(hostile).some((result) => result !== true), mutation).toBe(true);
    }
    await expect(call.send()).resolves.toHaveProperty('txid');
    expect((await callee.getState()).seen).toBe(8n);
  }, 120_000);

  it('places differing chunked rows with signer funding and rejects reordered continuations', async () => {
    const provider = new MockNetworkProvider();
    const calleeArtifact = compileString(`contract PlainChunkedCallee() {
      int count;
      event Recorded(int[] payload);
      function record(int[] payload) public {
        this.count = this.count + 1;
        emit Recorded(payload);
        require(payload.length > 0);
      }
    }`, KERNEL);
    const handler = calleeArtifact.messageBus!.handlers.find((candidate) => candidate.name === 'record')!;
    expect(handler.runtimeLoopEvents).toEqual([expect.objectContaining({ chunked: true })]);
    const calleeBase = new Contract(calleeArtifact, [], { provider });
    const calleeSetup = await setupStatefulUtxos(
      provider, calleeBase, calleeArtifact.stateLayout!, { count: 0n }, { saltContract: true },
    );
    const callee = StatefulContract.withCategory(
      calleeBase.withCategory(hexToBin(calleeSetup.categoryId)), calleeSetup.categoryId,
    );
    const callerArtifact = compileString(`
      interface IPlainChunkedCallee { function record(int[] payload); }
      contract PlainChunkedCaller(address target) {
        function forward(int[] first, int[] second) public {
          IPlainChunkedCallee(target).record(first);
          IPlainChunkedCallee(target).record(second);
          require(true);
        }
      }
    `, KERNEL);
    const callerBase = new Contract(callerArtifact, [callee.inner.lockingBytecode], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const signer = new Signer(alicePriv, provider);
    for (let index = 0; index < 12; index += 1) {
      await provider.addUtxo(signer.getAddress(), randomUtxo({ satoshis: 100_000n }));
    }
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    ).connect(signer);
    caller._registerResolvedExternal('IPlainChunkedCallee', callee);
    const payloads = [9, 5].map((length) => Array.from({ length }, (_unused, index) => 100_000n + BigInt(index)));
    const call = caller.call.forward(...payloads);
    const builder = await call.build();
    expect(inputResults(builder)).toEqual(builder.inputs.map(() => true));
    const event = calleeArtifact.events![0];
    const lock = (address: string): string => binToHex(addressToLockScript(address));
    const headLock = lock(getEventNftAddress(callee.inner, calleeSetup.categoryId, event.signature));
    const continuationLock = lock(getEventNftContinuationAddress(callee.inner, calleeSetup.categoryId, event.signature));
    const records = builder.outputs.flatMap((output, index) => output.token?.category === calleeSetup.categoryId
      && output.token.nft?.capability === 'none' ? [{ output, index }] : []);
    expect(records).toHaveLength(5);
    expect(records.map(({ output }) => binToHex(typeof output.to === 'string'
      ? addressToLockScript(output.to) : output.to)))
      .toEqual([headLock, continuationLock, continuationLock, headLock, continuationLock]);
    expect(records.slice(0, 3).map(({ output }) => output.token!.nft!.commitment).join(''))
      .toBe(binToHex(encodeEventCommitment(event.parameters, [payloads[0]])));
    expect(records.slice(3).map(({ output }) => output.token!.nft!.commitment).join(''))
      .toBe(binToHex(encodeEventCommitment(event.parameters, [payloads[1]])));
    const hostile = await call.build();
    [hostile.outputs[records[1].index], hostile.outputs[records[4].index]] =
      [hostile.outputs[records[4].index], hostile.outputs[records[1].index]];
    expect(inputResults(hostile).some((result) => result !== true)).toBe(true);
    await expect(call.send()).resolves.toHaveProperty('txid');
    expect((await callee.getState()).count).toBe(2n);
  }, 120_000);
});
