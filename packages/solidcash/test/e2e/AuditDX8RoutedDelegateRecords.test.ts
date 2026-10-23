import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract, Signer } from '../../src/index.js';
import {
  StatefulContract, getContractFactory, getDataNftAddress, upgrades,
} from '../../src/stateful/index.js';
import * as messageBus from '../../src/message-bus/index.js';
import { isContractUnlocker, type Utxo } from '../../src/interfaces.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs, solidCashOutputToLibauthOutput } from '../../src/utils.js';
import { addProvenUtxo, createBareP2pkhFeeFunder, setupStatefulUtxos } from '../test-util.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

/**
 * Audit DX-8, routed delegates. A message-bus route executing as a delegate co-spends the implementation's minting
 * master, which authorizes every record of the implementation's own category, exactly as a direct delegate does.
 * The route pinned only that master and its minting count, so the same transaction could rewrite, destroy or mint
 * an implementation record. Every such transaction must be refused at the executing implementation input.
 */

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
} as const;

const IMPL = `pragma solidcash >=0.8.0;
  interface IRoutedProbe { function touch() external; }
  contract RoutedCounter() {
    int counter;
    function bump(address probe) public {
      this.counter = this.counter + 1;
      IRoutedProbe(probe).touch();
      require(true);
    }
  }`;

const PROBE = `pragma solidcash >=0.8.0;
  contract RoutedProbe() { function touch() public { require(true); } }`;

type Provider = ReturnType<typeof createMessageBusCapstoneTestProvider>;
type Composition = ReturnType<typeof messageBus.compose>;
type Builder = Awaited<ReturnType<Composition['build']>>;
type Tx = ReturnType<Builder['buildLibauthTransaction']>;
type SourceOutput = ReturnType<typeof generateLibauthSourceOutputs>[number];

interface Fixture {
  provider: Provider;
  proxy: StatefulContract;
  composition: Composition;
  transaction: Tx;
  sourceOutputs: SourceOutput[];
  executor: number;
  feeInput: number;
  changeOutput: number;
  records: Utxo[];
  record: Utxo;
  recordAddress: string;
  foreignCategory: string;
  forged: string;
}

async function setup(): Promise<Fixture> {
  const provider = createMessageBusCapstoneTestProvider();
  const signer = new Signer(new Uint8Array(32).fill(0x58), provider);
  for (let index = 0; index < 16; index += 1) await addProvenUtxo(provider, signer.getAddress());
  const probeArtifact = compileString(PROBE, { ...KERNEL, messageBusGraphContext: true });
  const probeBase = new Contract(probeArtifact, [], { provider });
  const probeSetup = await setupStatefulUtxos(
    provider, probeBase, probeArtifact.stateLayout!, {}, { saltContract: true },
  );
  const probe = StatefulContract.withCategory(
    probeBase.withCategory(hexToBin(probeSetup.categoryId)), probeSetup.categoryId,
  );

  const artifact = compileString(IMPL, KERNEL);
  const delegate = artifact.delegateArtifact!;
  expect(delegate.messageBus?.handlers.find((handler) => handler.name === 'bump')).toMatchObject({ eligible: true });
  const deployed = await upgrades.deployProxy(
    getContractFactory(artifact, signer), { counter: 0n }, { initializer: false },
  );
  const implementation = deployed.implementation;
  implementation._registerResolvedExternal('IRoutedProbe', probe);
  const callsite = delegate.abi.find((entry) => entry.name === 'bump')
    ?.externalCalls?.find((call) => call.functionName === 'touch');
  expect(callsite?.callsiteId).toBeDefined();

  const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
  const feeLock = binToHex(fee.unlocker.generateLockingBytecode());
  const composition = messageBus.compose({
    preparedCalls: [{
      contract: deployed.proxy,
      functionName: 'bump',
      args: [probe.inner.lockingBytecode],
      executionArtifact: implementation.inner.artifact,
      executor: implementation,
    }, {
      contract: probe,
      functionName: 'touch',
      args: [],
      callsiteId: callsite!.callsiteId,
    }],
    funder: fee,
    changeAddress: fee.unlocker.generateLockingBytecode(),
  });
  const builder = await composition.build();
  const transaction = builder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const executor = builder.inputs.findIndex((input) => isContractUnlocker(input.unlocker)
    && input.unlocker.contract.address === implementation.inner.address);
  expect(executor).toBeGreaterThanOrEqual(0);
  // The executor runs the message-bus route, not a direct delegate entry.
  const executorUnlocker = builder.inputs[executor].unlocker;
  expect(isContractUnlocker(executorUnlocker) && executorUnlocker.abiFunction.name).toBe('__message_bus1');

  const recordAddress = getDataNftAddress(implementation.inner, implementation.categoryId);
  const records = await provider.getUtxos(recordAddress);
  const [record] = records;
  expect(record?.token?.category).toBe(implementation.categoryId);
  expect(record.token!.nft!.capability).toBe('mutable');
  return {
    provider,
    proxy: deployed.proxy,
    composition,
    transaction,
    sourceOutputs,
    executor,
    feeInput: sourceOutputs.map((output) => binToHex(output.lockingBytecode)).lastIndexOf(feeLock),
    changeOutput: transaction.outputs.map((output) => binToHex(output.lockingBytecode)).lastIndexOf(feeLock),
    records,
    record,
    recordAddress,
    foreignCategory: probeSetup.categoryId,
    forged: `6a${record.token!.nft!.commitment}`,
  };
}

let shared: Promise<Fixture> | undefined;
const fixture = (): Promise<Fixture> => (shared ??= setup());

const recordKey = (utxo: Utxo): string => `${utxo.txid}:${utxo.vout}:${utxo.token?.nft?.commitment}`;

const executorAccepts = (f: Fixture, transaction: Tx, sourceOutputs: SourceOutput[]): boolean => {
  const vm = createVirtualMachineBch2026ForProvider(f.provider);
  return vm.stateSuccess(vm.evaluate({ inputIndex: f.executor, sourceOutputs, transaction })) === true;
};

const recordOutput = (f: Fixture, token: NonNullable<Utxo['token']>): SourceOutput =>
  solidCashOutputToLibauthOutput({ to: f.recordAddress, amount: f.record.satoshis, token });

/**
 * The honest routed transaction as the executor sees it, with the fee input spending `spent` and the change output
 * replaced by `change`. Input and output counts are unchanged.
 */
const tampered = (
  f: Fixture, spent: NonNullable<Utxo['token']> | undefined, change: SourceOutput | undefined,
): boolean => {
  const transaction = structuredClone(f.transaction);
  const sourceOutputs = [...f.sourceOutputs];
  expect(f.feeInput).toBeGreaterThanOrEqual(0);
  expect(f.changeOutput).toBeGreaterThanOrEqual(0);
  if (spent) {
    transaction.inputs[f.feeInput] = {
      ...transaction.inputs[f.feeInput],
      outpointTransactionHash: hexToBin(f.record.txid),
      outpointIndex: f.record.vout,
    };
    sourceOutputs[f.feeInput] = recordOutput(f, spent);
  }
  if (change) transaction.outputs[f.changeOutput] = change;
  return executorAccepts(f, transaction, sourceOutputs);
};

const forgedOf = (f: Fixture, token: NonNullable<Utxo['token']>): SourceOutput => recordOutput(f, {
  ...token, nft: { capability: 'mutable', commitment: f.forged },
});

describe('DX-8: a routed delegate conserves the implementation records', () => {
  it('settles an honest routed call and leaves the implementation record in place', async () => {
    const f = await fixture();
    expect(executorAccepts(f, f.transaction, f.sourceOutputs)).toBe(true);
    await expect(f.composition.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect((await f.proxy.getState()).counter).toBe(1n);
    const live = await f.provider.getUtxos(f.recordAddress);
    expect(live.map(recordKey).sort()).toEqual(f.records.map(recordKey).sort());
  }, 300_000);

  it('refuses a rewritten implementation record, and admits the same rewrite of a foreign item', async () => {
    const f = await fixture();
    const own = f.record.token!;
    // Control: the tamper position itself is free to the executor; only its own category is conserved.
    const foreign = { ...own, category: f.foreignCategory };
    expect(tampered(f, foreign, forgedOf(f, foreign))).toBe(true);
    expect(tampered(f, own, forgedOf(f, own))).toBe(false);
  }, 300_000);

  it('refuses a destroyed implementation record', async () => {
    const f = await fixture();
    expect(tampered(f, f.record.token!, undefined)).toBe(false);
  }, 300_000);

  it('refuses a minted implementation record', async () => {
    const f = await fixture();
    expect(tampered(f, undefined, forgedOf(f, f.record.token!))).toBe(false);
  }, 300_000);
});
