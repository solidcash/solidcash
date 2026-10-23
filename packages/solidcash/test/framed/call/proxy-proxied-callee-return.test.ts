import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployMaster } from '../../../src/framed/deploy/index.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { buildProxyArtifact, deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { callFramedProxyEntry, type FramedProxyCallResult } from '../../../src/framed/proxy/deploy.js';
import type { FramedProxyExternal } from '../../../src/framed/proxy/external-calls.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * A hop whose proxied callee's implementation entry returns a value the caller reads.
 *
 * The callee is two contracts, so each reach takes a master of the callee proxy's and a master of the
 * implementation's. The caller records the call against the proxy's master and reads the recorded result, so the
 * proxy's fallback frame has to record what the implementation frame returned; the bytes it records are the
 * implementation entry's own declared return encoding, which is what the caller decodes.
 */

const DATA_IMPL_CATEGORY = 'a1'.repeat(31) + '5e';
const DATA_PROXY_CATEGORY = 'b2'.repeat(31) + '4d';
const DIRECT_DATA_CATEGORY = 'e5'.repeat(31) + '1a';

// Every callee entry is declared without `view`: a read-only (STATIC) call may not sit above the proxy's DELEGATE
// leg, which the shipped validator refuses by name (see the suite's report).
const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IData {'
  + '   function score() returns (int);'
  + '   function label() returns (string);'
  + '   function touch();'
  + ' }'
  + ' contract Data {'
  + '   address public implementation;'
  + '   int public base;'
  + '   function initialize(int b) { this.base = b; require(true); }'
  + '   function score() public returns (int) { return this.base + 1; }'
  + '   function label() public returns (string) { return "MECE"; }'
  + '   function touch() public { require(this.base >= 0); }'
  + ' }'
  + ' contract Outer {'
  + '   address public implementation;'
  + '   address public data;'
  + '   function initialize(address target) { this.data = target; require(true); }'
  + '   function run(int expected) { int s = IData(this.data).score(); require(s == expected); }'
  + '   function tag() { require(IData(this.data).label() == "MECE"); }'
  + '   function poke() { IData(this.data).touch(); require(true); }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const data = artifacts.Data!;
const outer = artifacts.Outer!;

/** A coin a genesis is funded from; its txid becomes the category it mints. */
function funding(txid: string): { txid: string; vout: number; satoshis: bigint } {
  return { txid, vout: 0, satoshis: 5_000_000n };
}

/** The deployer's own coins and lock, shared by the arrangements below. */
interface Setup {
  readonly network: MockNetworkProvider;
  readonly deployerLock: Uint8Array;
  readonly changeAddress: string;
  readonly funder: ReturnType<SignatureTemplate['unlockP2PKH']>;
}

async function setup(network: MockNetworkProvider): Promise<Setup> {
  const signature = new SignatureTemplate(alicePriv);
  const source = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  await fundShippedFacets(network);
  return {
    network,
    deployerLock: encodeLockingBytecodeP2pkh(alicePkh),
    changeAddress: source.address,
    funder: signature.unlockP2PKH(),
  };
}

/** The proxied callee: the implementation behind its generated proxy, seeded with `base`. */
async function deployProxiedCallee(
  setup_: Setup, base: bigint,
): Promise<{ readonly proxyCategoryId: string; readonly implementationCategoryId: string; readonly address: Uint8Array }> {
  const signature = new SignatureTemplate(alicePriv);
  const source = new Contract(p2pkhArtifact, [alicePkh], { provider: setup_.network });
  const funder = source.unlock.spend(alicePub, signature);
  const initCoin = funding('55'.repeat(32));
  await setup_.network.addUtxo(binToHex(setup_.deployerLock), initCoin);
  for (const txid of [DATA_IMPL_CATEGORY, DATA_PROXY_CATEGORY]) {
    await setup_.network.addUtxo(source.address, funding(txid));
  }

  const deployment = await deployFramedProxy({
    provider: setup_.network,
    implementationArtifact: data,
    proxyArtifact: buildProxyArtifact(data),
    implementationDeploy: {
      fundingUtxo: funding(DATA_IMPL_CATEGORY), funder, changeAddress: source.address, threadCount: 5,
    },
    proxyDeploy: {
      fundingUtxo: funding(DATA_PROXY_CATEGORY), funder, changeAddress: source.address, threadCount: 5,
    },
    initialize: { functionName: 'initialize', args: [base] },
    callerLockingBytecode: setup_.deployerLock,
    callerFunding: { utxo: initCoin, funder: setup_.funder, changeAddress: source.address },
    vm: compositionMachine(),
  });
  expect(deployment.initialize.accepted).toBe(true);
  return {
    proxyCategoryId: deployment.proxy.categoryId,
    implementationCategoryId: deployment.implementation.categoryId,
    address: deployment.proxy.address,
  };
}

/** The same implementation deployed alone, so a call reaches its entry without a proxy leg. */
async function deployDirectCallee(setup_: Setup): Promise<{ readonly categoryId: string; readonly address: Uint8Array }> {
  const signature = new SignatureTemplate(alicePriv);
  const source = new Contract(p2pkhArtifact, [alicePkh], { provider: setup_.network });
  const funder = source.unlock.spend(alicePub, signature);
  await setup_.network.addUtxo(source.address, funding(DIRECT_DATA_CATEGORY));
  await deployStatefulContract(data, [], {
    fundingUtxo: funding(DIRECT_DATA_CATEGORY), funder, changeAddress: source.address,
    provider: setup_.network, threadCount: 4,
  });
  return {
    categoryId: DIRECT_DATA_CATEGORY,
    address: deployMaster(data, hexToBin(DIRECT_DATA_CATEGORY), VALIDATOR_PROGRAM).address,
  };
}

/** Deploys the caller behind its own proxy, with `data` set to the address it names. */
async function deployCaller(setup_: Setup, dataAddress: Uint8Array, seed: string): Promise<{
  readonly proxyCategoryId: string;
  readonly implementationCategoryId: string;
}> {
  const signature = new SignatureTemplate(alicePriv);
  const source = new Contract(p2pkhArtifact, [alicePkh], { provider: setup_.network });
  const funder = source.unlock.spend(alicePub, signature);
  const category = (suffix: string): string => `${seed}${suffix}${'0'.repeat(61)}`;
  const implCategory = category('1');
  const proxyCategory = category('2');
  const initCoin = funding(category('3'));
  await setup_.network.addUtxo(binToHex(setup_.deployerLock), initCoin);
  for (const txid of [implCategory, proxyCategory]) await setup_.network.addUtxo(source.address, funding(txid));

  const deployment = await deployFramedProxy({
    provider: setup_.network,
    implementationArtifact: outer,
    proxyArtifact: buildProxyArtifact(outer),
    implementationDeploy: { fundingUtxo: funding(implCategory), funder, changeAddress: source.address },
    proxyDeploy: { fundingUtxo: funding(proxyCategory), funder, changeAddress: source.address },
    initialize: { functionName: 'initialize', args: [dataAddress] },
    callerLockingBytecode: setup_.deployerLock,
    callerFunding: { utxo: initCoin, funder: setup_.funder, changeAddress: source.address },
    vm: compositionMachine(),
  });
  expect(deployment.initialize.accepted).toBe(true);
  return {
    proxyCategoryId: deployment.proxy.categoryId,
    implementationCategoryId: deployment.implementation.categoryId,
  };
}

/** Calls one entry of the caller through the hop, with the caller's own coin. */
async function callRun(options: {
  readonly setup: Setup;
  readonly caller: { readonly proxyCategoryId: string; readonly implementationCategoryId: string };
  readonly externals: Readonly<Record<string, FramedProxyExternal>>;
  readonly functionName: string;
  readonly args: readonly (bigint | Uint8Array | string | boolean)[];
  readonly fundingTxid: string;
}): Promise<FramedProxyCallResult> {
  const coin = funding(options.fundingTxid);
  await options.setup.network.addUtxo(binToHex(options.setup.deployerLock), coin);
  return callFramedProxyEntry({
    provider: options.setup.network,
    implementationArtifact: outer,
    proxyArtifact: buildProxyArtifact(outer),
    proxyCategoryId: options.caller.proxyCategoryId,
    implementationCategoryId: options.caller.implementationCategoryId,
    functionName: options.functionName,
    args: options.args,
    externals: options.externals,
    callerUtxo: coin,
    callerLockingBytecode: options.setup.deployerLock,
    funder: options.setup.funder,
    changeAddress: options.setup.changeAddress,
    vm: compositionMachine(),
  });
}

/** The proxied callee seeded with 7 and its caller, and the chain as it stood when both were deployed. */
interface Proxied {
  readonly setup: Setup;
  readonly callee: Awaited<ReturnType<typeof deployProxiedCallee>>;
  readonly caller: Awaited<ReturnType<typeof deployCaller>>;
  readonly snapshot: SnapshotRestorer;
}

let proxiedRun: Promise<Proxied> | undefined;

/** One proxied callee and caller serve the cases that reach it, each rewinding the chain to them first. */
async function proxied(): Promise<Proxied> {
  proxiedRun ??= (async (): Promise<Proxied> => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const arranged = await setup(network);
    const callee = await deployProxiedCallee(arranged, 7n);
    const caller = await deployCaller(arranged, callee.address, '1a');
    return { setup: arranged, callee, caller, snapshot: await network.takeSnapshot() };
  })();
  const shared = await proxiedRun;
  await shared.snapshot.restore();
  return shared;
}

describe('a hop whose proxied callee returns a value', () => {
  it('generates a proxy whose fallback publishes the delegate bytes as its return', () => {
    const fallback = buildProxyArtifact(data).abi.find((entry) => entry.name === '__fallback');
    expect(fallback?.outputs).toStrictEqual([{ type: 'bytes' }]);
  });

  it('carries the integer its entry returned through the proxy leg to the caller', async () => {
    const { setup: arranged, callee, caller } = await proxied();

    const result = await callRun({
      setup: arranged,
      caller,
      functionName: 'run',
      args: [8n],
      fundingTxid: '77'.repeat(32),
      externals: {
        IData: {
          artifact: data,
          categoryId: callee.proxyCategoryId,
          proxyArtifact: buildProxyArtifact(data),
          implementationCategoryId: callee.implementationCategoryId,
        },
      },
    });

    expect(result.completed.map((frame) => frame.functionName)).toStrictEqual([
      `${data.contractName}.score()`,
      `${data.contractName}Proxy.__fallback()`,
      `${outer.contractName}.run()`,
      `${outer.contractName}Proxy.__fallback()`,
    ]);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  });

  it('carries a value the entry encodes with a dynamic type', async () => {
    const { setup: arranged, callee, caller } = await proxied();

    const result = await callRun({
      setup: arranged,
      caller,
      functionName: 'tag',
      args: [],
      fundingTxid: '78'.repeat(32),
      externals: {
        IData: {
          artifact: data,
          categoryId: callee.proxyCategoryId,
          proxyArtifact: buildProxyArtifact(data),
          implementationCategoryId: callee.implementationCategoryId,
        },
      },
    });

    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  });

  it('still settles when the implementation entry records nothing', async () => {
    const { setup: arranged, callee, caller } = await proxied();

    const result = await callRun({
      setup: arranged,
      caller,
      functionName: 'poke',
      args: [],
      fundingTxid: '79'.repeat(32),
      externals: {
        IData: {
          artifact: data,
          categoryId: callee.proxyCategoryId,
          proxyArtifact: buildProxyArtifact(data),
          implementationCategoryId: callee.implementationCategoryId,
        },
      },
    });

    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  });

  it('carries a direct callee\'s return unchanged', async () => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const setupRun = await setup(network);
    const callee = await deployDirectCallee(setupRun);
    const caller = await deployCaller(setupRun, callee.address, '4a');

    const result = await callRun({
      setup: setupRun,
      caller,
      functionName: 'run',
      args: [1n],
      fundingTxid: '7a'.repeat(32),
      externals: { IData: { artifact: data, categoryId: callee.categoryId } },
    });

    expect(result.completed.map((frame) => frame.functionName)).toStrictEqual([
      `${data.contractName}.score()`,
      `${outer.contractName}.run()`,
      `${outer.contractName}Proxy.__fallback()`,
    ]);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  });
});
