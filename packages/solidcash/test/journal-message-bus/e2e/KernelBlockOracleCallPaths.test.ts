import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract, type TransactionBuilder } from '../../../src/index.js';
import type { ConstructorArgument } from '../../../src/Argument.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import { MockNetworkProvider } from '../../../src/network/mock/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';

const T = 1_699_990_000n;
const KERNEL = { forceStateful: true, messageBus: true, messageBusKernel: true } as const;
const direct = { forceStateful: true, messageBus: false } as const;
const results = (builder: TransactionBuilder): Array<true | string> => {
  const transaction = builder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const vm = createVirtualMachineBch2026ForProvider();
  return transaction.inputs.map((_input, inputIndex) => vm.stateSuccess(vm.evaluate({
    inputIndex, sourceOutputs, transaction,
  })));
};

async function connect(
  provider: MockNetworkProvider, artifact: ReturnType<typeof compileString>, args: ConstructorArgument[] = [],
): Promise<StatefulContract> {
  const base = new Contract(artifact, args, { provider });
  const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
  return StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
}

function providerWithClock(): MockNetworkProvider {
  const provider = new MockNetworkProvider();
  provider.setBlockOracleFields({
    number: 133_699n, timestamp: T, difficulty: 0n, size: 1n, totalFees: 0n, coinbase: new Uint8Array(),
  });
  return provider;
}

function expectOneOracle(builder: TransactionBuilder, provider: MockNetworkProvider): number {
  const inputs = generateLibauthSourceOutputs(builder.inputs);
  const indexes = inputs.flatMap((output, index) => binToHex(output.lockingBytecode)
    === binToHex(provider.blockOracleLock) ? [index] : []);
  expect(indexes).toHaveLength(1);
  expect(builder.outputs[indexes[0]].token!.nft!.commitment).toBe(builder.inputs[indexes[0]].token!.nft!.commitment);
  return indexes[0];
}

describe('shared block-info oracle on additional call paths', () => {
  it('forwards the same oracle index to a nested non-bus reader', async () => {
    const provider = providerWithClock();
    const reader = await connect(provider, compileString(`contract Reader() {
      function read(int expected) public { require(block.timestamp == expected); }
    }`, direct));
    const caller = await connect(provider, compileString(`interface IReader { function read(int expected); }
      contract Forward(address reader) {
        function invoke(int expected) public {
          require(block.timestamp == expected);
          IReader(reader).read(expected);
          require(true);
        }
      }`, direct), [reader.inner.lockingBytecode]);
    caller._registerResolvedExternal('IReader', reader);
    const call = caller.call.invoke(T);
    const builder = await call.build();
    const oracle = expectOneOracle(builder, provider);
    expect(results(builder)).toEqual(builder.inputs.map(() => true));
    const commitment = builder.outputs[oracle].token!.nft!.commitment;
    builder.outputs[oracle].token!.nft!.commitment = '00';
    expect(results(builder).some((result) => result !== true)).toBe(true);
    builder.outputs[oracle].token!.nft!.commitment = commitment;
    await expect(call.send()).resolves.toHaveProperty('txid');
  }, 120_000);

  it('forwards an oracle read through a plain delegate forwarder', async () => {
    const provider = providerWithClock();
    const implementationArtifact = compileString(`contract ClockImplementation() {
      int seen;
      function read(int expected) public {
        this.seen = block.timestamp;
        require(this.seen == expected);
      }
    }`, direct);
    const implementation = await connect(provider, implementationArtifact.delegateArtifact!);
    const forwarder = await connect(provider, compileString(`contract DelegateForward() {
      int seen;
      function forward(bytes input) public {
        address implementation = address(0x${implementation.inner.lockingBytecode});
        implementation.delegatecall(input);
        require(input.length > 0);
      }
    }`, direct));
    const selector = implementation.inner.artifact.abi.find((entry) => entry.name === 'read')!.selector!;
    const call = forwarder.call.forward(hexToBin(selector)).withDelegatecall(implementation, 'read', [T]);
    const builder = await call.build();
    const oracle = expectOneOracle(builder, provider);
    expect(results(builder)).toEqual(builder.inputs.map(() => true));
    const commitment = builder.outputs[oracle].token!.nft!.commitment;
    builder.outputs[oracle].token!.nft!.commitment = '00';
    expect(results(builder).some((result) => result !== true)).toBe(true);
    builder.outputs[oracle].token!.nft!.commitment = commitment;
    await expect(call.send()).resolves.toHaveProperty('txid');
  }, 120_000);

  it('shares the oracle across an all-staticcall composition and authenticates its neutral pads', async () => {
    const provider = providerWithClock();
    const readerArtifact = compileString(`contract ClockReader() {
      function read(int expected) public view { require(block.timestamp == expected); }
    }`, KERNEL);
    const first = await connect(provider, readerArtifact);
    const second = await connect(provider, readerArtifact);
    const caller = await connect(provider, compileString(`interface IClock { function read(int expected); }
      contract StaticForward(address first, address second) {
        function invoke(int expected) public {
          require(block.timestamp == expected);
          IClock(first).read.staticcall(expected);
          IClock(second).read.staticcall(expected);
          require(true);
        }
      }`, KERNEL), [first.inner.lockingBytecode, second.inner.lockingBytecode]);
    const funder = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const composition = messageBus.compose({
      calls: [caller.call.invoke(T), first.call.read(T), second.call.read(T)], funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });
    const builder = await composition.build();
    expectOneOracle(builder, provider);
    expect(results(builder)).toEqual(builder.inputs.map(() => true));
    const sources = generateLibauthSourceOutputs(builder.inputs);
    const pads = sources.flatMap((output, index) => output.token === undefined
      && binToHex(output.lockingBytecode).startsWith('aa20953c') ? [index] : []);
    expect(pads.length).toBeGreaterThanOrEqual(2);
    const hostile = await composition.build();
    hostile.outputs[pads[0]].amount -= 1n;
    expect(results(hostile).some((result) => result !== true)).toBe(true);
    await expect(composition.send()).resolves.toHaveProperty('txid');
  }, 120_000);
});
