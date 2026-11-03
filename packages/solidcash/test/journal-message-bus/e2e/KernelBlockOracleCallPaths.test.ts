import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { blockOracleLockingBytecode, type BlockOracleCommitmentFields } from '@solidcash/utils';
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
const CLOCK: BlockOracleCommitmentFields = {
  number: 133_699n, timestamp: T, difficulty: 0n, size: 1n, totalFees: 0n, coinbase: new Uint8Array(),
};
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

/** Set the test clock on each reader's own oracle, which its genesis minted. */
function setClock(provider: MockNetworkProvider, readers: readonly StatefulContract[]): void {
  for (const reader of readers) provider.setBlockOracleFields(CLOCK, reader.categoryId);
}

/** Each reader co-spends its own oracle once, recreated in place, and no other oracle is spent. */
function expectOwnOracles(builder: TransactionBuilder, readers: readonly StatefulContract[]): number[] {
  const sources = generateLibauthSourceOutputs(builder.inputs);
  const oracles = sources.flatMap((output, index) => output.token?.nft?.capability === 'mutable'
    && binToHex(output.lockingBytecode) === binToHex(blockOracleLockingBytecode(output.token.category))
    ? [index] : []);
  expect(oracles).toHaveLength(readers.length);
  return readers.map((reader) => {
    const own = oracles.filter((index) => binToHex(sources[index].lockingBytecode)
      === binToHex(reader.inner.blockOracleLock!));
    expect(own).toHaveLength(1);
    expect(builder.outputs[own[0]].token!.nft!.commitment).toBe(builder.inputs[own[0]].token!.nft!.commitment);
    return own[0];
  });
}

/** A changed commitment on any reader's oracle fails the transaction. */
function expectOraclesAuthenticated(builder: TransactionBuilder, oracles: readonly number[]): void {
  for (const oracle of oracles) {
    const commitment = builder.outputs[oracle].token!.nft!.commitment;
    builder.outputs[oracle].token!.nft!.commitment = '00';
    expect(results(builder).some((result) => result !== true)).toBe(true);
    builder.outputs[oracle].token!.nft!.commitment = commitment;
  }
}

describe('own block-info oracles on additional call paths', () => {
  it('forwards a nested non-bus reader the index of its own oracle', async () => {
    const provider = new MockNetworkProvider();
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
    setClock(provider, [caller, reader]);
    const call = caller.call.invoke(T);
    const builder = await call.build();
    const oracles = expectOwnOracles(builder, [caller, reader]);
    expect(results(builder)).toEqual(builder.inputs.map(() => true));
    expectOraclesAuthenticated(builder, oracles);
    await expect(call.send()).resolves.toHaveProperty('txid');
  }, 120_000);

  it('forwards an oracle read of the implementation\'s own oracle through a plain delegate forwarder', async () => {
    const provider = new MockNetworkProvider();
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
    // The forwarder reads no clock: the oracle is the implementation's.
    setClock(provider, [implementation]);
    const selector = implementation.inner.artifact.abi.find((entry) => entry.name === 'read')!.selector!;
    const call = forwarder.call.forward(hexToBin(selector)).withDelegatecall(implementation, 'read', [T]);
    const builder = await call.build();
    const oracles = expectOwnOracles(builder, [implementation]);
    expect(results(builder)).toEqual(builder.inputs.map(() => true));
    expectOraclesAuthenticated(builder, oracles);
    await expect(call.send()).resolves.toHaveProperty('txid');
  }, 120_000);

  it('keeps each reader of an all-staticcall composition its own oracle, none padded away', async () => {
    const provider = new MockNetworkProvider();
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
    setClock(provider, [caller, first, second]);
    const funder = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const composition = messageBus.compose({
      calls: [caller.call.invoke(T), first.call.read(T), second.call.read(T)], funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });
    const builder = await composition.build();
    // A neutral pad stands in only for a later copy of one contract's oracle: distinct readers keep their own.
    const oracles = expectOwnOracles(builder, [caller, first, second]);
    expect(results(builder)).toEqual(builder.inputs.map(() => true));
    // Each kept oracle is pinned at its full value.
    for (const oracle of oracles) {
      builder.outputs[oracle].amount -= 1n;
      expect(results(builder).some((result) => result !== true)).toBe(true);
      builder.outputs[oracle].amount += 1n;
    }
    await expect(composition.send()).resolves.toHaveProperty('txid');
  }, 120_000);
});
