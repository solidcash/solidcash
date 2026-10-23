import {
  binToHex, decodeAuthenticationInstructions, encodeAuthenticationInstructions, encodeDataPush, hexToBin,
} from '@bitauth/libauth';
import { compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { ContractFactory, StatefulContract } from '../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';
import { createTestProvider, getSigners } from '../test-util.js';

const source = `pragma solidcash >=0.8.0;
interface ISink { function record(address who) external; }
contract Sink() {
  int public calls;
  function record(address next) external { this.calls++; require(bytes(next).length >= 0); }
}
contract Relay(address target) {
  int public calls;
  function forward(address who) external {
    bool ok, bytes result = target.call{value: 0}(abi.encodeWithSelector(ISink.record.selector, who));
    require(ok);
    this.calls++;
  }
}`;
const artifacts = compileStringMulti(source, {
  forceStateful: true, evmCompat: true, messageBus: true, messageBusKernel: true,
  messageBusGraphContext: true, maximumInputBytes: 1_000_000, suppressWarnings: true,
});
const nativeSink = compileStringMulti(source, {
  forceStateful: true, messageBus: false, evmCompat: true, suppressWarnings: true,
}).Sink;
const identity = new Uint8Array(20).fill(0x42);
const nativeLock = hexToBin(`76a914${binToHex(identity)}88ac`);
const word = new Uint8Array(32);
word.set(identity, 12);

async function setup(): Promise<{ relay: StatefulContract; sink: StatefulContract; check: (arg: Uint8Array) => boolean[] }> {
  const provider = createTestProvider();
  provider.consensusLimits = { ...provider.consensusLimits,
    maximumInputBytes: 1_000_000, maximumTransactionBytes: 10_000_000, maximumNftCommitmentBytes: 128 };
  const [signer] = await getSigners(1, { provider, fundingUtxos: 40 });
  const sink = await new ContractFactory(nativeSink, signer).deploy();
  const sinkLock = hexToBin(sink.inner.withCategory(hexToBin(sink.categoryId)).lockingBytecode);
  const relay = await new ContractFactory(artifacts.Relay, signer).deploy(sinkLock);
  const builder = await relay.call.forward(nativeLock).withCall(sink, 'record', [nativeLock]).build();
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const calleeIndex = sourceOutputs.findIndex((output) => binToHex(output.lockingBytecode) === binToHex(sinkLock));
  expect(calleeIndex).toBeGreaterThan(0);
  await builder.build();
  const original = builder.buildLibauthTransaction();
  const instructions = decodeAuthenticationInstructions(original.inputs[calleeIndex].unlockingBytecode);
  const argument = instructions[instructions.length - 2];
  expect('data' in argument && argument.data).toEqual(nativeLock);
  const beforeArgument = encodeAuthenticationInstructions(instructions.slice(0, -2));
  const redeem = encodeAuthenticationInstructions(instructions.slice(-1));
  const vm = createVirtualMachineBch2026ForProvider(provider);
  return {
    relay, sink,
    check: (arg) => {
      const transaction = structuredClone(original);
      transaction.inputs[calleeIndex].unlockingBytecode = Uint8Array.from([
        ...beforeArgument, ...encodeDataPush(arg), ...redeem,
      ]);
      return transaction.inputs.map((_, inputIndex) => vm.stateSuccess(vm.evaluate({
        inputIndex, sourceOutputs, transaction,
      })) === true);
    },
  };
}

describe('Solidity-compatible raw-call address argument lanes', () => {
  it('accepts canonical ABI words and native identity/P2PKH arguments through every VM input', async () => {
    const { check } = await setup();
    for (const actual of [nativeLock, identity, word]) {
      const accepted = check(actual);
      expect(accepted, binToHex(actual)).toEqual(accepted.map(() => true));
    }
  }, 120_000);

  it('refuses another identity or a nonzero ABI address prefix at the caller', async () => {
    const { check, relay, sink } = await setup();
    const other = word.slice();
    other[31] ^= 1;
    const dirtyPrefix = word.slice();
    dirtyPrefix[0] = 1;
    for (const actual of [other, dirtyPrefix]) expect(check(actual)[0]).toBe(false);
    expect((await relay.getState()).calls).toBe(0n);
    expect((await sink.getState()).calls).toBe(0n);
  }, 120_000);
});
