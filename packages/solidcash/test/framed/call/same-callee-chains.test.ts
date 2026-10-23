import { describe, expect, it } from 'vitest';
import { bigIntToVmNumber, binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { bytesToSlotValue, decodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import { deployMaster, readFramedDeployment } from '../../../src/framed/deploy/index.js';
import { buildProxyArtifact, deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { callFramedProxyEntry } from '../../../src/framed/proxy/deploy.js';
import type { FramedProxyExternal } from '../../../src/framed/proxy/external-calls.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * One entry reaching the same mapping-writing, value-returning callee three times in one hop.
 *
 * Every reach runs a master of its own and writes the callee's one sorted mapping, and the reaches are separate
 * call sites, so each is planned by its own write step against the deployment alone. Three keys in three gaps each
 * splice through a node of its own, with the read-only callee behind its own proxy reached before them and the
 * event-emitting callee reached after, and all declare records the one transaction carries. Reaches that update one
 * key the list holds share its node, each continuing from the view the one before it left: that is
 * `call/shared-node-across-reaches.test.ts` ("two debits of one balance settle").
 *
 * Three reaches inserting into one gap land one behind the other: each later reach is planned against the list the
 * one before it left, so it splices through the node the one before it created, named at that reach's output, and
 * the list the transaction leaves links every key in order.
 */

/** A 32-byte value with varied bytes, `seed` chosen so each name is distinct. */
function category(seed: string): string {
  const base = 'a1b2c3d4e5f60718293a4b5c6d7e8f9';
  return `${seed}${base}${base}`.slice(0, 64);
}

const REGISTRY_IMPL_CATEGORY = category('0a');
const REGISTRY_PROXY_CATEGORY = category('1b');
const LEDGER_CATEGORY = category('2c');
const PAY_CATEGORY = category('3d');
const ROOT_IMPL_CATEGORY = category('4e');
const ROOT_PROXY_CATEGORY = category('5f');
const REGISTRY_INIT_TXID = category('60');
const ROOT_INIT_TXID = category('71');
const CALL_TXID = category('82');

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IRegistry { function note(int i); }'
  + ' interface ILedger { function move(int key, int by) returns (bool); }'
  + ' interface IPay { function transfer(int amount) returns (bool); }'
  + ' contract Registry {'
  + '   address public implementation;'
  + '   int public tags;'
  + '   function initialize() { this.tags = 7; require(this.tags > 0); }'
  + '   function note(int i) { require(i >= 0); require(this.tags == 7); }'
  + ' }'
  + ' contract Ledger {'
  + '   int public floor;'
  + '   mapping(int => int) public held;'
  + '   constructor(int a, int b, int c, int d) {'
  + '     this.floor = 1; this.held[a] = 10; this.held[b] = 20; this.held[c] = 30; this.held[d] = 40;'
  + '   }'
  + '   function move(int key, int by) returns (bool) {'
  + '     this.held[key] = this.held[key] + by;'
  + '     require(this.held[key] >= this.floor);'
  + '     return true;'
  + '   }'
  + ' }'
  + ' contract Pay {'
  + '   int public total;'
  + '   event Paid(int amount);'
  + '   function transfer(int amount) returns (bool) {'
  + '     require(amount >= 0);'
  + '     emit Paid(amount);'
  + '     return true;'
  + '   }'
  + ' }'
  + ' contract Root {'
  + '   address public implementation;'
  + '   address public registry;'
  + '   address public ledger;'
  + '   address public pay;'
  + '   function initialize(address r, address l, address p) {'
  + '     this.registry = r; this.ledger = l; this.pay = p; require(true);'
  + '   }'
  + '   function run(int k1, int k2, int k3) {'
  + '     IRegistry(this.registry).note(1);'
  + '     require(ILedger(this.ledger).move(k1, 1));'
  + '     require(ILedger(this.ledger).move(k2, 2));'
  + '     require(ILedger(this.ledger).move(k3, 3));'
  + '     require(IPay(this.pay).transfer(7));'
  + '     require(true);'
  + '   }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const registry = artifacts.Registry!;
const ledger = artifacts.Ledger!;
const pay = artifacts.Pay!;
const root = artifacts.Root!;

/** The slot a mapping node for an int key sits at, as the hop's own key resolution derives it. */
function slotOf(key: bigint): bigint {
  return bytesToSlotValue(keyToSlotMulti([bigIntToVmNumber(key)]));
}

/** The candidate keys, ordered by the slot each one's node would sit at. */
function rankedKeys(): readonly { readonly key: bigint; readonly slot: bigint }[] {
  return Array.from({ length: 64 }, (_unused, index) => BigInt(index + 1))
    .map((key) => ({ key, slot: slotOf(key) }))
    .sort((left, right) => (left.slot < right.slot ? -1 : 1));
}

/**
 * The keys each case uses: four spread-out keys seed the callee's constructor, three keys that land in three
 * different gaps are the reaches the hop settles, and three keys above every seed share the tail's gap.
 */
function keySets(): {
  readonly seeds: readonly bigint[];
  readonly distinctGap: readonly bigint[];
  readonly sharedGap: readonly bigint[];
} {
  const ranked = rankedKeys();
  const seedIndices = [0, 16, 32, 48];
  const seeds = seedIndices.map((index) => ranked[index]!.key);
  const distinctGap = [8, 24, 40].map((index) => ranked[index]!.key);
  // Each reach sits strictly between two consecutive seeds, so its predecessor is the seed below it and no two
  // reaches share one.
  for (let gap = 0; gap < distinctGap.length; gap += 1) {
    const slot = slotOf(distinctGap[gap]!);
    if (!(slot > slotOf(seeds[gap]!) && slot < slotOf(seeds[gap + 1]!))) {
      throw new Error(`reach ${gap} does not land in the gap between its seeds`);
    }
  }
  return {
    seeds,
    distinctGap,
    sharedGap: [56, 57, 58].map((index) => ranked[index]!.key),
  };
}

function funding(txid: string): { txid: string; vout: number; satoshis: bigint } {
  return { txid, vout: 0, satoshis: 5_000_000n };
}

async function deployChains(network: MockNetworkProvider): Promise<{
  readonly rootProxyCategoryId: string;
  readonly rootImplementationCategoryId: string;
  readonly deployerLock: Uint8Array;
  readonly changeAddress: string;
  readonly callCoin: { txid: string; vout: number; satoshis: bigint };
  readonly funder: ReturnType<SignatureTemplate['unlockP2PKH']>;
  readonly externals: Record<string, FramedProxyExternal>;
}> {
  const signature = new SignatureTemplate(alicePriv);
  const source = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = source.unlock.spend(alicePub, signature);
  const callerFunder = signature.unlockP2PKH();
  const deployerLock = encodeLockingBytecodeP2pkh(alicePkh);

  const { seeds } = keySets();
  const ledgerCoin = funding(LEDGER_CATEGORY);
  await network.addUtxo(source.address, ledgerCoin);
  await deployStatefulContract(ledger, [...seeds], {
    fundingUtxo: ledgerCoin, funder, changeAddress: source.address, provider: network, threadCount: 4,
  });
  const payCoin = funding(PAY_CATEGORY);
  await network.addUtxo(source.address, payCoin);
  await deployStatefulContract(pay, [], {
    fundingUtxo: payCoin, funder, changeAddress: source.address, provider: network, threadCount: 4,
  });

  for (const txid of [REGISTRY_IMPL_CATEGORY, REGISTRY_PROXY_CATEGORY, ROOT_IMPL_CATEGORY, ROOT_PROXY_CATEGORY]) {
    await network.addUtxo(source.address, funding(txid));
  }
  const registryInitCoin = funding(REGISTRY_INIT_TXID);
  const rootInitCoin = funding(ROOT_INIT_TXID);
  const callCoin = funding(CALL_TXID);
  for (const coin of [registryInitCoin, rootInitCoin, callCoin]) {
    await network.addUtxo(binToHex(deployerLock), coin);
  }
  await fundShippedFacets(network);

  const registryDeployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: registry,
    proxyArtifact: buildProxyArtifact(registry),
    implementationDeploy: { fundingUtxo: funding(REGISTRY_IMPL_CATEGORY), funder, changeAddress: source.address },
    proxyDeploy: { fundingUtxo: funding(REGISTRY_PROXY_CATEGORY), funder, changeAddress: source.address },
    initialize: { functionName: 'initialize', args: [] },
    callerLockingBytecode: deployerLock,
    callerFunding: { utxo: registryInitCoin, funder: callerFunder, changeAddress: source.address },
    vm: compositionMachine(),
  });
  expect(registryDeployment.initialize.broadcast).toBeDefined();

  const ledgerAddress = deployMaster(ledger, hexToBin(LEDGER_CATEGORY), VALIDATOR_PROGRAM).address;
  const payAddress = deployMaster(pay, hexToBin(PAY_CATEGORY), VALIDATOR_PROGRAM).address;

  const rootDeployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: root,
    proxyArtifact: buildProxyArtifact(root),
    implementationDeploy: { fundingUtxo: funding(ROOT_IMPL_CATEGORY), funder, changeAddress: source.address },
    proxyDeploy: { fundingUtxo: funding(ROOT_PROXY_CATEGORY), funder, changeAddress: source.address },
    initialize: {
      functionName: 'initialize',
      args: [registryDeployment.proxy.address, ledgerAddress, payAddress],
    },
    callerLockingBytecode: deployerLock,
    callerFunding: { utxo: rootInitCoin, funder: callerFunder, changeAddress: source.address },
    vm: compositionMachine(),
  });
  expect(rootDeployment.initialize.broadcast).toBeDefined();

  return {
    rootProxyCategoryId: rootDeployment.proxy.categoryId,
    rootImplementationCategoryId: rootDeployment.implementation.categoryId,
    deployerLock,
    changeAddress: source.address,
    callCoin,
    funder: callerFunder,
    externals: {
      IRegistry: {
        artifact: registry,
        categoryId: registryDeployment.proxy.categoryId,
        proxyArtifact: buildProxyArtifact(registry),
        implementationCategoryId: registryDeployment.implementation.categoryId,
      },
      ILedger: { artifact: ledger, categoryId: LEDGER_CATEGORY },
      IPay: { artifact: pay, categoryId: PAY_CATEGORY },
    },
  };
}

type Funded = Awaited<ReturnType<typeof deployChains>>;

/** The deployment the cases share, and the chain as it stood when the deployment was done. */
interface Chains {
  readonly network: MockNetworkProvider;
  readonly funded: Funded;
  readonly snapshot: SnapshotRestorer;
}

let chainsRun: Promise<Chains> | undefined;

/** One deployment serves every case, each rewinding the chain to it first, so no case reads another's broadcast. */
async function deployedChains(): Promise<Chains> {
  chainsRun ??= (async (): Promise<Chains> => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funded = await deployChains(network);
    return { network, funded, snapshot: await network.takeSnapshot() };
  })();
  const chains = await chainsRun;
  await chains.snapshot.restore();
  return chains;
}

/** The ledger's list as the chain holds it, walked from the head along each node's link, with each node's value. */
async function heldList(
  network: MockNetworkProvider,
): Promise<readonly { readonly slot: bigint; readonly value: string }[]> {
  const deployment = await readFramedDeployment(network, LEDGER_CATEGORY, ledger.stateLayout!);
  const nodes = new Map((deployment.nodesByCollection.get('held') ?? []).map((utxo) => {
    const node = decodeEntryCommitment(hexToBin(utxo.token!.nft!.commitment));
    return [bytesToSlotValue(node.slot), node] as const;
  }));
  const list: { slot: bigint; value: string }[] = [];
  for (let next = nodes.get(0n)?.nextKey; next !== undefined && bytesToSlotValue(next) !== 0n;) {
    const node = nodes.get(bytesToSlotValue(next));
    if (node === undefined) break;
    list.push({ slot: bytesToSlotValue(node.slot), value: binToHex(node.value) });
    next = node.nextKey;
  }
  return list;
}

/** Runs one hop of the root entry, with the reaches' keys as its argument. */
async function callRun(
  network: MockNetworkProvider,
  funded: Funded,
  args: readonly bigint[],
): Promise<Awaited<ReturnType<typeof callFramedProxyEntry>>> {
  return callFramedProxyEntry({
    provider: network,
    implementationArtifact: root,
    proxyArtifact: buildProxyArtifact(root),
    proxyCategoryId: funded.rootProxyCategoryId,
    implementationCategoryId: funded.rootImplementationCategoryId,
    functionName: 'run',
    args: [...args],
    externals: funded.externals,
    callerUtxo: funded.callCoin,
    callerLockingBytecode: funded.deployerLock,
    funder: funded.funder,
    changeAddress: funded.changeAddress,
    vm: compositionMachine(),
  });
}

describe('one entry reaching the same mapping-writing callee three times', () => {
  it('settles three reaches that insert into three gaps beside the other callees, and broadcasts', async () => {
    const { network, funded } = await deployedChains();
    const { distinctGap, seeds } = keySets();
    // Each reach's key lands in a different gap of the seeded list, so no two reaches share a predecessor.
    expect(distinctGap.map(slotOf)).toStrictEqual(
      [...distinctGap.map(slotOf)].sort((left, right) => (left < right ? -1 : 1)),
    );
    expect(distinctGap.some((key) => seeds.includes(key))).toBe(false);
    const result = await callRun(network, funded, distinctGap);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  });

  it('settles three reaches that insert into one gap, each through the node the one before it created', async () => {
    const { network, funded } = await deployedChains();
    const { sharedGap, seeds } = keySets();
    const result = await callRun(network, funded, sharedGap);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    // The list links every key in ascending order, the seeds' and the three new ones', each holding what it was
    // moved by.
    const list = await heldList(network);
    expect(list.map((node) => node.slot))
      .toStrictEqual([...seeds, ...sharedGap].map(slotOf).sort((left, right) => (left < right ? -1 : 1)));
    expect(sharedGap.map((key) => list.find((node) => node.slot === slotOf(key))?.value))
      .toStrictEqual([1n, 2n, 3n].map((by) => binToHex(bigIntToVmNumber(by))));
  });

});
