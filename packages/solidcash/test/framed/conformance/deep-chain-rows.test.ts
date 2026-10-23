import { beforeAll, describe, expect, it } from 'vitest';
import { bigIntToVmNumber, binToHex, encodeLockingBytecodeP2pkh, hexToBin, utf8ToBin } from '@bitauth/libauth';
import {
  FrameKind, bytesToHex, encodePushdataValue, parsePushdataCommitment, sha256, validatorAddress, type Artifact,
} from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { decodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import { readFramedDeployment } from '../../../src/framed/deploy/index.js';
import type { CompositionDraft } from '../../../src/framed/composer/index.js';
import { buildProxyArtifact, deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { callFramedProxyEntry, type FramedProxyCallResult } from '../../../src/framed/proxy/deploy.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * S0 conformance, spec section 23 row 25: deep chains, four calls below the root's implementation plus proxy hops,
 * about 24 masters.
 *
 * The user enters `Root.run` behind a generated proxy, so the root's implementation runs as a `DELEGATE` frame below
 * the proxy's fallback. It writes a store behind its own proxy twice (a `CALL` into the store's fallback, then its
 * `DELEGATE` into the store's implementation), and between those calls `Gate.enter`, which requires the user as
 * `tx.origin`, reads the vault's record, settles the vault for a `uint16[5]` and calls `Claimer.claim`. The claimer
 * re-enters the gate for a `STATIC` read and a `pure` calculation, reads the vault again, records its claim there
 * and pays one share per turn of the count its own record holds: `Vault.sendShare`, which calls `Token.transfer`,
 * four calls below the root's implementation. The shares travel back up two frames and the root keeps the first.
 * Every write rewrites a node or a record the deployment holds, and each payout credits the same holder's node, so
 * the reaches chain through it in execution order.
 *
 * With five turns the transaction carries twenty-four masters (the vault entered nine times, the gate three, the
 * token five), the shape the row names; it takes about 11 s. One turn carries the same depth and the same proxy hops
 * in sixteen masters, about 4 s, and 8 s with its compile. Both are driven through the shipped proxy hop and settle
 * with every input accepted, the validator's walk among them, and the writes are read back on chain through the
 * shipped decoders. Both run under `FRAMED_FULL=1`, compiling only then; by default the row's parts run cheaper
 * elsewhere: the same four-deep shape composed and derived in `shapes/deep-arbitration.test.ts`, a proxied callee
 * making its own call through the hop in `call/proxy-callee-proxy.test.ts`, a proxied callee reached at several
 * sites in `call/proxy-default-pool.test.ts`, calls in a loop through the hop in `loop-call-rows.test.ts`, and
 * `tx.origin` in a nested frame in `origin-nested-call-rows.test.ts`.
 */

/** A 32-byte category or txid with varied bytes, taken from its label. */
function idOf(label: string): string {
  return bytesToHex(sha256(utf8ToBin(`deep chain rows ${label}`)));
}

const TOKEN_CATEGORY = idOf('token');
const VAULT_CATEGORY = idOf('vault');
const CLAIMER_CATEGORY = idOf('claimer');
const GATE_CATEGORY = idOf('gate');
const STORE_IMPL_CATEGORY = idOf('store implementation');
const STORE_PROXY_CATEGORY = idOf('store proxy');
const ROOT_IMPL_CATEGORY = idOf('root implementation');
const ROOT_PROXY_CATEGORY = idOf('root proxy');

/** The address a contract at `categoryId` presents, `addrV(category)`. */
const addressOf = (categoryId: string): Uint8Array => validatorAddress(hexToBin(categoryId), VALIDATOR_PROGRAM);
const hexAddress = (categoryId: string): string => binToHex(addressOf(categoryId));
const USER_LOCK = encodeLockingBytecodeP2pkh(alicePkh);
const USER = binToHex(USER_LOCK);
/** The split the root hands the gate, and the settlement's own fixed-size arguments. */
const SPLIT_WIRE = binToHex(encodePushdataValue([8000n, 2000n], 'uint16[2]'));
const XS_WIRE = binToHex(encodePushdataValue([1n, 2n, 3n, 4n], 'uint16[4]'));
const YS_WIRE = binToHex(encodePushdataValue([-1n, 2n], 'int16[2]'));
const SHARES_WIRE = binToHex(encodePushdataValue([1n, 1n, 1n, 1n, 1n], 'uint16[5]'));

const VAULT = hexAddress(VAULT_CATEGORY);
const GATE = hexAddress(GATE_CATEGORY);

const SOURCE = [
  'pragma solidcash ^0.14.0;',
  'interface IStore { function write(int id); }',
  'interface IGate {',
  '  function enter(uint16[2] split) returns (uint16[5]);',
  '  function readFlag() view returns (int);',
  '  function calc(uint16[5] xs) pure returns (uint16[5]);',
  '}',
  'interface IVault {',
  '  function readRecord() view returns (int);',
  '  function settle(uint16[4] xs, int16[2] ys) returns (uint16[5]);',
  '  function recordClaim();',
  '  function sendShare();',
  '}',
  'interface IClaimer { function claim() returns (int); }',
  'interface IToken { function transfer(address to, int amount); }',
  'contract Token {',
  '  mapping(address => int) balances;',
  '  constructor(address holder) { this.balances[holder] = 1; }',
  '  function transfer(address to, int amount) {',
  '    this.balances[to] = this.balances[to] + amount;',
  '    require(amount >= 0);',
  '  }',
  '}',
  'contract Vault {',
  '  int public shares;',
  '  mapping(address => int) marks;',
  '  constructor(int count, address gate, address claimer) {',
  '    this.shares = count; this.marks[gate] = 1; this.marks[claimer] = 1;',
  '  }',
  '  function readRecord() view returns (int) { return this.shares; }',
  '  function settle(uint16[4] xs, int16[2] ys) returns (uint16[5]) {',
  '    uint16[5] r; r[0] = 1; r[1] = 1; r[2] = 1; r[3] = 1; r[4] = 1;',
  '    this.marks[msg.sender] = this.marks[msg.sender] + 1;',
  '    return r;',
  '  }',
  '  function recordClaim() { this.marks[msg.sender] = this.marks[msg.sender] + 1; require(true); }',
  `  function sendShare() { IToken(0x${hexAddress(TOKEN_CATEGORY)}).transfer(0x${USER}, 1); }`,
  '}',
  'contract Claimer {',
  '  int public turns;',
  '  constructor(int count) { this.turns = count; }',
  '  function claim() returns (int) {',
  `    require(IGate(0x${GATE}).readFlag() == 1);`,
  `    uint16[5] arr = IGate(0x${GATE}).calc(hex"${SHARES_WIRE}");`,
  '    require(arr[0] == 1);',
  `    require(IVault(0x${VAULT}).readRecord() >= 1);`,
  `    IVault(0x${VAULT}).recordClaim();`,
  '    int paid = 0;',
  '    for (int i = 0; i < this.turns; i = i + 1) {',
  `      IVault(0x${VAULT}).sendShare();`,
  '      paid = paid + 1;',
  '    }',
  '    return paid;',
  '  }',
  '}',
  'contract Gate {',
  '  int public ready;',
  '  int public expected;',
  '  constructor(int count) { this.ready = 1; this.expected = count; }',
  '  function enter(uint16[2] split) returns (uint16[5]) {',
  `    require(tx.origin == 0x${USER});`,
  `    require(IVault(0x${VAULT}).readRecord() >= 1);`,
  `    uint16[5] shares = IVault(0x${VAULT}).settle(hex"${XS_WIRE}", hex"${YS_WIRE}");`,
  `    int paid = IClaimer(0x${hexAddress(CLAIMER_CATEGORY)}).claim();`,
  '    require(paid == this.expected);',
  '    return shares;',
  '  }',
  '  function readFlag() view returns (int) { return this.ready; }',
  '  function calc(uint16[5] xs) pure returns (uint16[5]) { return xs; }',
  '}',
  'contract Store {',
  '  address public implementation;',
  '  address public owner;',
  '  mapping(int => int) notes;',
  '  function initialize(address root) { this.owner = root; this.notes[1] = 1; this.notes[2] = 1; }',
  '  function write(int id) {',
  '    require(msg.sender == this.owner);',
  '    this.notes[id] = this.notes[id] + 1;',
  '  }',
  '}',
  'contract Root {',
  '  address public implementation;',
  '  address public store;',
  '  address public gate;',
  '  int public score;',
  '  function initialize(address s, address g) { this.store = s; this.gate = g; require(true); }',
  '  function run() {',
  '    IStore(this.store).write(1);',
  `    uint16[5] shares = IGate(this.gate).enter(hex"${SPLIT_WIRE}");`,
  '    IStore(this.store).write(2);',
  '    this.score = int(shares[0]);',
  '    require(this.score == int(shares[0]));',
  '  }',
  '}',
].join('\n');

// Compiled by the gated describe's `beforeAll`, so the default run, which skips the row, compiles nothing.
let artifacts: ReturnType<typeof compileStringMulti>;
let store: Artifact;
let root: Artifact;
let storeProxy: Artifact;
let rootProxy: Artifact;

/** Compiles the six contracts and generates the store's and the root's proxies. */
function compileRow(): void {
  artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
  store = artifacts.Store!;
  root = artifacts.Root!;
  storeProxy = buildProxyArtifact(store);
  rootProxy = buildProxyArtifact(root);
}

/** A coin a genesis or a call is funded from; a genesis's txid becomes the category it mints. */
function funding(txid: string): { txid: string; vout: number; satoshis: bigint } {
  return { txid, vout: 0, satoshis: 5_000_000n };
}

/** The chain with every contract deployed for `turns` payouts, and the categories the two proxied pairs hold. */
interface Deployed {
  readonly network: MockNetworkProvider;
  readonly rootProxyCategoryId: string;
  readonly rootImplementationCategoryId: string;
  readonly storeProxyCategoryId: string;
  readonly storeImplementationCategoryId: string;
  readonly changeAddress: string;
}

/** Deploys the plain contracts for `turns` payouts, then the store and the root behind their proxies. */
async function deployFor(turns: number): Promise<Deployed> {
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = wallet.unlock.spend(alicePub, signature);
  const count = BigInt(turns);
  await fundShippedFacets(network);
  const plain: readonly (readonly [Artifact, string, readonly (bigint | Uint8Array)[]])[] = [
    [artifacts.Token!, TOKEN_CATEGORY, [USER_LOCK]],
    [artifacts.Vault!, VAULT_CATEGORY, [count, addressOf(GATE_CATEGORY), addressOf(CLAIMER_CATEGORY)]],
    [artifacts.Claimer!, CLAIMER_CATEGORY, [count]],
    [artifacts.Gate!, GATE_CATEGORY, [count]],
  ];
  for (const [artifact, categoryId, args] of plain) {
    const coin = funding(categoryId);
    await network.addUtxo(wallet.address, coin);
    await deployStatefulContract(artifact, [...args], {
      fundingUtxo: coin, funder, changeAddress: wallet.address, provider: network,
    });
  }
  for (const txid of [STORE_IMPL_CATEGORY, STORE_PROXY_CATEGORY, ROOT_IMPL_CATEGORY, ROOT_PROXY_CATEGORY]) {
    await network.addUtxo(wallet.address, funding(txid));
  }
  const deployProxied = async (
    implementation: Artifact, proxy: Artifact, categories: readonly [string, string], args: readonly Uint8Array[],
  ): Promise<Awaited<ReturnType<typeof deployFramedProxy>>> => {
    const initCoin = funding(idOf(`${implementation.contractName} initialize coin`));
    await network.addUtxo(binToHex(USER_LOCK), initCoin);
    const deployment = await deployFramedProxy({
      provider: network,
      implementationArtifact: implementation,
      proxyArtifact: proxy,
      implementationDeploy: { fundingUtxo: funding(categories[0]), funder, changeAddress: wallet.address },
      proxyDeploy: { fundingUtxo: funding(categories[1]), funder, changeAddress: wallet.address },
      initialize: { functionName: 'initialize', args: [...args] },
      callerLockingBytecode: USER_LOCK,
      callerFunding: { utxo: initCoin, funder: signature.unlockP2PKH(), changeAddress: wallet.address },
      vm: compositionMachine(),
    });
    expect(deployment.initialize.broadcast).toBeDefined();
    return deployment;
  };
  // The store admits the root's proxy, whose address its category fixes before the root is deployed.
  const storeDeployment = await deployProxied(store, storeProxy, [STORE_IMPL_CATEGORY, STORE_PROXY_CATEGORY],
    [addressOf(ROOT_PROXY_CATEGORY)]);
  const rootDeployment = await deployProxied(root, rootProxy, [ROOT_IMPL_CATEGORY, ROOT_PROXY_CATEGORY],
    [storeDeployment.proxy.address, addressOf(GATE_CATEGORY)]);
  expect(binToHex(rootDeployment.proxy.address)).toBe(hexAddress(ROOT_PROXY_CATEGORY));
  return {
    network,
    rootProxyCategoryId: rootDeployment.proxy.categoryId,
    rootImplementationCategoryId: rootDeployment.implementation.categoryId,
    storeProxyCategoryId: storeDeployment.proxy.categoryId,
    storeImplementationCategoryId: storeDeployment.implementation.categoryId,
    changeAddress: wallet.address,
  };
}

/** Runs the user's `run` on the root's proxy through the shipped hop. */
async function run(deployed: Deployed, label: string): Promise<FramedProxyCallResult> {
  const coin = funding(idOf(`${label} call coin`));
  await deployed.network.addUtxo(binToHex(USER_LOCK), coin);
  return callFramedProxyEntry({
    provider: deployed.network,
    implementationArtifact: root,
    proxyArtifact: rootProxy,
    proxyCategoryId: deployed.rootProxyCategoryId,
    implementationCategoryId: deployed.rootImplementationCategoryId,
    functionName: 'run',
    args: [],
    externals: {
      IStore: {
        artifact: store,
        categoryId: deployed.storeProxyCategoryId,
        proxyArtifact: storeProxy,
        implementationCategoryId: deployed.storeImplementationCategoryId,
      },
      IGate: { artifact: artifacts.Gate!, categoryId: GATE_CATEGORY },
      IVault: { artifact: artifacts.Vault!, categoryId: VAULT_CATEGORY },
      IClaimer: { artifact: artifacts.Claimer!, categoryId: CLAIMER_CATEGORY },
      IToken: { artifact: artifacts.Token!, categoryId: TOKEN_CATEGORY },
    },
    callerUtxo: coin,
    callerLockingBytecode: USER_LOCK,
    funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
    changeAddress: deployed.changeAddress,
    vm: compositionMachine(),
  });
}

/** Each master's distance below the frame no other frame entered, read from the frames' own caller references. */
function depths(draft: CompositionDraft): ReadonlyMap<string, number> {
  const masters = draft.layout.participants.filter((placed) => placed.kind === 'master');
  const idByIndex = new Map(masters.map((placed) => [placed.index, placed.id]));
  const found = new Map<string, number>();
  const depthOf = (id: string): number => {
    const known = found.get(id);
    if (known !== undefined) return known;
    const caller = idByIndex.get(draft.blockOf(id).callerRef);
    const depth = caller === undefined ? 0 : depthOf(caller) + 1;
    found.set(id, depth);
    return depth;
  };
  for (const placed of masters) depthOf(placed.id);
  return found;
}

/** The value tail one collection holds for a key, or undefined while it holds no node for it. */
async function nodeValue(
  network: MockNetworkProvider, artifact: Artifact, categoryId: string, collection: string, key: Uint8Array,
): Promise<string | undefined> {
  const pools = await readFramedDeployment(network, categoryId, artifact.stateLayout!);
  const slot = bytesToHex(keyToSlotMulti([key]));
  const node = (pools.nodesByCollection.get(collection) ?? []).map((utxo) =>
    decodeEntryCommitment(hexToBin(utxo.token!.nft!.commitment))).find((entry) => bytesToHex(entry.slot) === slot);
  return node === undefined ? undefined : bytesToHex(node.value);
}

const intValue = (value: bigint): string => binToHex(bigIntToVmNumber(value));

/** Drives the composition for `turns` payouts and checks the row's shape and its writes on chain. */
async function expectDeepChain(turns: number): Promise<void> {
  const deployed = await deployFor(turns);
  const result = await run(deployed, `${turns} turns`);
  expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
  expect(result.accepted).toBe(true);
  expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);

  // The masters: the root's proxy and implementation, the store's two of each, and the gate, vault, claimer and
  // token frames: three gate frames, four vault frames plus one per turn, and one token frame per turn.
  const { draft } = result;
  const masters = draft.layout.participants.filter((placed) => placed.kind === 'master');
  expect(masters).toHaveLength(14 + 2 * turns);
  const framesOf = (contract: string): number => masters.filter((placed) => placed.contract === contract).length;
  expect([framesOf('Gate'), framesOf('Vault'), framesOf('Claimer'), framesOf('Token')])
    .toStrictEqual([3, 4 + turns, 1, turns]);

  // The proxy hops: the user enters the root's fallback, which delegates into the root's implementation, and each
  // store call enters the store's fallback, which delegates into the store's implementation.
  const delegated = result.completed.filter((frame) => frame.kind === FrameKind.DELEGATE)
    .map((frame) => frame.functionName).sort();
  expect(delegated).toStrictEqual(['Root.run()', 'Store.write()', 'Store.write()']);
  expect(result.completed.filter((frame) => frame.functionName === 'StoreProxy.__fallback()')).toHaveLength(2);
  expect(result.completed.at(-1)?.functionName).toBe('RootProxy.__fallback()');

  // The depth: every token frame runs four calls below the root's implementation, and none deeper.
  const depth = depths(draft);
  const below = (master: string): number => depth.get(master)! - depth.get('implementation-master')!;
  const transfers = result.completed.filter((frame) => frame.functionName === 'Token.transfer()');
  expect(transfers.map((frame) => below(frame.master))).toStrictEqual(Array.from({ length: turns }, () => 4));
  expect(Math.max(...masters.map((placed) => below(placed.id)))).toBe(4);

  // The writes, on chain: the root kept the first share, the store's two notes moved, the vault counted the gate's
  // settle and the claimer's claim, and the holder's node took one credit per turn.
  const rootRecords = await readFramedDeployment(deployed.network, deployed.rootProxyCategoryId,
    rootProxy.stateLayout!);
  expect(Object.assign({}, ...rootRecords.records.map((record, nftIndex) => parsePushdataCommitment(
    record.token!.nft!.commitment, rootProxy.stateLayout!, nftIndex)))).toMatchObject({ score: 1n });
  for (const id of [1n, 2n]) {
    expect(await nodeValue(deployed.network, store, deployed.storeProxyCategoryId, 'notes', bigIntToVmNumber(id)))
      .toBe(intValue(2n));
  }
  for (const marked of [GATE_CATEGORY, CLAIMER_CATEGORY]) {
    expect(await nodeValue(deployed.network, artifacts.Vault!, VAULT_CATEGORY, 'marks', addressOf(marked)))
      .toBe(intValue(2n));
  }
  expect(await nodeValue(deployed.network, artifacts.Token!, TOKEN_CATEGORY, 'balances', USER_LOCK))
    .toBe(intValue(1n + BigInt(turns)));
}

describe.runIf(process.env.FRAMED_FULL === '1')(
  'spec section 23 row 25: deep chains, four calls below the root plus proxy hops, about 24 masters', () => {
    beforeAll(compileRow, 120_000);

    it('settles one payout four calls below the root\'s implementation, through both proxies, in 16 masters',
      async () => {
        await expectDeepChain(1);
      }, 300_000);

    it('settles five payouts four calls below the root\'s implementation, through both proxies, in 24 masters',
      async () => {
        await expectDeepChain(5);
      }, 600_000);
  },
);
