import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin, utf8ToBin } from '@bitauth/libauth';
import { bytesToHex, sha256, validatorAddress } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { keyToSlotValue } from '../../../src/stateful/SortedList.js';
import { deployMaster } from '../../../src/per-call/deploy/index.js';
import { readPublishedStopSites } from '../../../src/per-call/composer/index.js';
import { buildProxyArtifact, deployPerCallProxy } from '../../../src/per-call/proxy/index.js';
import { callPerCallProxyEntry, type PerCallProxyCallResult } from '../../../src/per-call/proxy/deploy.js';
import type { PerCallProxyExternal } from '../../../src/per-call/proxy/external-calls.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub, bobPkh, bobPriv } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * Ahead of the ladder, MS5: the origin-gated nested payout, driven through the shipped proxy hop
 * (`callPerCallProxyEntry`).
 *
 * The root, behind a generated proxy, keeps its jobs in a dynamic array of structs and settles a taken job two ways:
 * `refund`, entered by the job's worker, and `refuseArbitration`, entered by its arbitrator. Both reach a guarded
 * escrow, which reads a registry (`STATIC`), admits only an origin that is the seller or the arbitrator, marks the
 * payment claimed in a mapping, pays the buyer back through a low-level token call and emits its terms as one event
 * above 128 bytes. The root then calls a store behind its own proxy, which gates on the root proxy's address, writes
 * a mapping per call and emits: six calls per flow (store 3, token 1, escrow 1, registry 1). `refuseArbitration`
 * reaches the payout only inside `if (job.state == taken)`, and the helper both flows share rewrites the job before
 * its last store call.
 *
 * Each flow is pinned where it stands today; beside them, the same flows against an escrow whose one change is that
 * it keeps no guard of its own show what stands behind the first wall.
 */

/** A 32-byte category or txid that is neither one repeated byte nor a palindrome, taken from its label. */
function idOf(label: string): string {
  return bytesToHex(sha256(utf8ToBin(`origin gated payout ahead ${label}`)));
}

const REGISTRY_CATEGORY = idOf('registry');
const TOKEN_CATEGORY = idOf('token');
const STORE_IMPL_CATEGORY = idOf('store implementation');
const STORE_PROXY_CATEGORY = idOf('store proxy');
const ROOT_IMPL_CATEGORY = idOf('root implementation');
const ROOT_PROXY_CATEGORY = idOf('root proxy');
/** Two escrow deployments: the buyer's token balance sorts right after the escrow's in one, before it in the other. */
const ESCROW_BELOW_BUYER = idOf('escrow');
const ESCROW_ABOVE_BUYER = idOf('escrow 3');

const JOB_ID = 0n;
const ESCROW_ID = 3n;
const AMOUNT = 500n;
/** Five 32-byte fields: the escrow's payout terms, a commitment well above the 128-byte data-NFT size. */
const BIG = 452312848583266388373324160190187140051835877600158453279131187530910662656n;

const WORKER_LOCK = encodeLockingBytecodeP2pkh(alicePkh);
const ARBITER_LOCK = encodeLockingBytecodeP2pkh(bobPkh);
const ROOT_PROXY_ADDRESS = validatorAddress(hexToBin(ROOT_PROXY_CATEGORY), VALIDATOR_PROGRAM);

/** The five contracts; `guarded` keeps the escrow's own reentrancy guard, a write to its data record. */
function sourceFor(guarded: boolean): string {
  return 'pragma solidcash ^0.13.0;'
    + ' struct Job { address worker; address arbitrator; int state; int escrowId; int disputed; }'
    + ' interface IStore {'
    + '   function markDown(address who); function markRefusal(address who); function log(int id, int kind);'
    + ' }'
    + ' interface IEscrow { function refund(int id); }'
    + ' interface IRegistry { function arbiterOf(int id) view returns (address); }'
    + ' interface IToken { function transfer(address to, int amount) returns (bool); }'
    + ' contract Registry {'
    + '   address public arbiter;'
    + '   function arbiterOf(int id) view returns (address) { require(id >= 0); return this.arbiter; }'
    + ' }'
    + ' contract Token {'
    + '   mapping(address => int) public balances;'
    + '   constructor(address holder, int amount) { this.balances[holder] = amount; }'
    + '   function transfer(address to, int amount) returns (bool) {'
    + '     require(this.balances[msg.sender] >= amount);'
    + '     this.balances[msg.sender] = this.balances[msg.sender] - amount;'
    + '     this.balances[to] = this.balances[to] + amount;'
    + '     return true;'
    + '   }'
    + ' }'
    + ' contract Escrow {'
    + '   int public locked;'
    + '   int public amount;'
    + '   address public seller;'
    + '   address public buyer;'
    + '   address public registry;'
    + '   address public token;'
    + '   mapping(int => int) public claims;'
    + '   event Refunded(int id, int a, int b, int c, int d, int e);'
    + '   function refund(int id) {'
    + (guarded ? '     require(this.locked == 0); this.locked = 1;' : '')
    + '     address arbiter = IRegistry(this.registry).arbiterOf(id);'
    + '     require(msg.sender == this.seller || tx.origin == this.seller'
    + '       || msg.sender == arbiter || tx.origin == arbiter);'
    + '     require(this.claims[id] == 0);'
    + '     this.claims[id] = 1;'
    + '     (bool ok, bytes data) = address(this.token).call('
    + '       abi.encodeCall(IToken.transfer, (this.buyer, this.amount)));'
    + '     require(ok);'
    + `     emit Refunded(id, ${BIG}, ${BIG}, ${BIG}, ${BIG}, ${BIG});`
    + (guarded ? '     this.locked = 0;' : '')
    + '   }'
    + ' }'
    + ' contract Store {'
    + '   address public implementation;'
    + '   address public owner;'
    + '   mapping(address => int) public downs;'
    + '   mapping(address => int) public refusals;'
    + '   mapping(int => int) public counts;'
    + '   event Logged(int id, int kind);'
    + '   function initialize(address o) { this.owner = o; require(true); }'
    + '   function markDown(address who) { require(msg.sender == this.owner); this.downs[who] = this.downs[who] + 1; }'
    + '   function markRefusal(address who) {'
    + '     require(msg.sender == this.owner); this.refusals[who] = this.refusals[who] + 1;'
    + '   }'
    + '   function log(int id, int kind) {'
    + '     require(msg.sender == this.owner); this.counts[id] = this.counts[id] + 1; emit Logged(id, kind);'
    + '   }'
    + ' }'
    + ' contract Root {'
    + '   address public implementation;'
    + '   address public store;'
    + '   address public escrow;'
    + '   Job[] public jobs;'
    + '   function initialize(address s, address e, address w, address a, int id) {'
    + '     this.store = s; this.escrow = e; this.jobs.push(Job(w, a, 1, id, 0)); require(true);'
    + '   }'
    + '   function refund(int jobId) {'
    + '     require(this.jobs[jobId].worker == msg.sender);'
    + '     this.settle(jobId, true);'
    + '   }'
    + '   function refuseArbitration(int jobId) {'
    + '     require(this.jobs[jobId].arbitrator == msg.sender);'
    + '     require(this.jobs[jobId].state != 2);'
    + '     IStore(this.store).markRefusal(msg.sender);'
    + '     IStore(this.store).log(jobId, 7);'
    + '     if (this.jobs[jobId].state == 1) { this.settle(jobId, false); }'
    + '     this.jobs[jobId].arbitrator = address(0);'
    + '   }'
    + '   function settle(int jobId, bool byWorker) internal {'
    + '     require(this.jobs[jobId].state == 1);'
    + '     this.jobs[jobId].disputed = 0;'
    + '     IEscrow(this.escrow).refund(this.jobs[jobId].escrowId);'
    + '     this.jobs[jobId].state = 0;'
    + '     this.jobs[jobId].escrowId = 0;'
    + '     if (byWorker) {'
    + '       IStore(this.store).markDown(this.jobs[jobId].worker);'
    + '       IStore(this.store).log(jobId, 5);'
    + '     }'
    + '     IStore(this.store).log(jobId, 6);'
    + '     this.jobs[jobId].worker = address(0);'
    + '   }'
    + ' }';
}

type Artifacts = ReturnType<typeof compileStringMulti>;
const compiled = new Map<boolean, Artifacts>();
/** The five contracts compiled once per variant, on first use, so a run without the gate compiles nothing. */
function artifactsFor(guarded: boolean): Artifacts {
  let artifacts = compiled.get(guarded);
  if (artifacts === undefined) {
    artifacts = compileStringMulti(sourceFor(guarded), { composition: 'per-call' });
    compiled.set(guarded, artifacts);
  }
  return artifacts;
}

type Flow = 'refund' | 'refuseArbitration';

/** One network holding the five contracts, a taken job, and a coin each of the two callers can enter a hop with. */
interface Market {
  readonly network: MockNetworkProvider;
  readonly artifacts: Artifacts;
  readonly rootProxyCategoryId: string;
  readonly rootImplementationCategoryId: string;
  readonly externals: Readonly<Record<string, PerCallProxyExternal>>;
  readonly changeAddress: string;
  readonly coins: Readonly<Record<Flow, { txid: string; vout: number; satoshis: bigint }>>;
}

/** A coin a genesis or a hop is funded from; a genesis's txid becomes the category it mints. */
function funding(txid: string): { txid: string; vout: number; satoshis: bigint } {
  return { txid, vout: 0, satoshis: 5_000_000n };
}

/** Deploys the plain callees, then the store and the root behind their proxies, the root holding one taken job. */
async function deployMarket(artifacts: Artifacts, escrowCategory: string): Promise<Market> {
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = wallet.unlock.spend(alicePub, signature);
  const addressAt = (name: string, categoryId: string): Uint8Array =>
    deployMaster(artifacts[name]!, hexToBin(categoryId), VALIDATOR_PROGRAM).address;
  const registryAddress = addressAt('Registry', REGISTRY_CATEGORY);
  const tokenAddress = addressAt('Token', TOKEN_CATEGORY);
  const escrowAddress = addressAt('Escrow', escrowCategory);
  await fundShippedFacets(network);

  // The escrow holds the payment for the root proxy as its buyer and the worker as its seller; the token holds the
  // escrow's balance, and the registry names the arbitrator.
  const plain: readonly (readonly [string, string, readonly unknown[], Record<string, unknown> | undefined])[] = [
    ['Registry', REGISTRY_CATEGORY, [], { arbiter: ARBITER_LOCK }],
    ['Token', TOKEN_CATEGORY, [escrowAddress, AMOUNT], undefined],
    ['Escrow', escrowCategory, [], {
      locked: 0n, amount: AMOUNT, seller: WORKER_LOCK, buyer: ROOT_PROXY_ADDRESS,
      registry: registryAddress, token: tokenAddress,
    }],
  ];
  for (const [name, categoryId, constructorArgs, initialState] of plain) {
    const coin = funding(categoryId);
    await network.addUtxo(wallet.address, coin);
    await deployStatefulContract(artifacts[name]!, constructorArgs as never, {
      fundingUtxo: coin, funder, changeAddress: wallet.address, provider: network,
      ...(initialState === undefined ? {} : { initialState: initialState as never }),
    });
  }
  for (const categoryId of [STORE_IMPL_CATEGORY, STORE_PROXY_CATEGORY, ROOT_IMPL_CATEGORY, ROOT_PROXY_CATEGORY]) {
    await network.addUtxo(wallet.address, funding(categoryId));
  }
  const storeInitCoin = funding(idOf('store initialize coin'));
  const rootInitCoin = funding(idOf('root initialize coin'));
  const coins = { refund: funding(idOf('worker coin')), refuseArbitration: funding(idOf('arbitrator coin')) };
  for (const coin of [storeInitCoin, rootInitCoin, coins.refund]) await network.addUtxo(binToHex(WORKER_LOCK), coin);
  await network.addUtxo(binToHex(ARBITER_LOCK), coins.refuseArbitration);

  const store = artifacts.Store!;
  const storeDeployment = await deployPerCallProxy({
    provider: network,
    implementationArtifact: store,
    proxyArtifact: buildProxyArtifact(store),
    implementationDeploy: { fundingUtxo: funding(STORE_IMPL_CATEGORY), funder, changeAddress: wallet.address },
    proxyDeploy: { fundingUtxo: funding(STORE_PROXY_CATEGORY), funder, changeAddress: wallet.address },
    initialize: { functionName: 'initialize', args: [ROOT_PROXY_ADDRESS] },
    callerLockingBytecode: WORKER_LOCK,
    callerFunding: { utxo: storeInitCoin, funder: signature.unlockP2PKH(), changeAddress: wallet.address },
    vm: compositionMachine(),
  });
  expect(storeDeployment.initialize.broadcast).toBeDefined();

  const root = artifacts.Root!;
  const rootDeployment = await deployPerCallProxy({
    provider: network,
    implementationArtifact: root,
    proxyArtifact: buildProxyArtifact(root),
    implementationDeploy: { fundingUtxo: funding(ROOT_IMPL_CATEGORY), funder, changeAddress: wallet.address },
    proxyDeploy: { fundingUtxo: funding(ROOT_PROXY_CATEGORY), funder, changeAddress: wallet.address },
    initialize: {
      functionName: 'initialize',
      args: [storeDeployment.proxy.address, escrowAddress, WORKER_LOCK, ARBITER_LOCK, ESCROW_ID],
    },
    callerLockingBytecode: WORKER_LOCK,
    callerFunding: { utxo: rootInitCoin, funder: signature.unlockP2PKH(), changeAddress: wallet.address },
    vm: compositionMachine(),
  });
  expect(rootDeployment.initialize.broadcast).toBeDefined();
  // The store and the escrow were seeded with the root proxy's address before the root existed.
  expect(bytesToHex(rootDeployment.proxy.address)).toBe(bytesToHex(ROOT_PROXY_ADDRESS));

  return {
    network,
    artifacts,
    rootProxyCategoryId: rootDeployment.proxy.categoryId,
    rootImplementationCategoryId: rootDeployment.implementation.categoryId,
    externals: {
      IEscrow: { artifact: artifacts.Escrow!, categoryId: escrowCategory },
      IRegistry: { artifact: artifacts.Registry!, categoryId: REGISTRY_CATEGORY },
      IToken: { artifact: artifacts.Token!, categoryId: TOKEN_CATEGORY },
      IStore: {
        artifact: store,
        categoryId: storeDeployment.proxy.categoryId,
        proxyArtifact: buildProxyArtifact(store),
        implementationCategoryId: storeDeployment.implementation.categoryId,
      },
    },
    changeAddress: wallet.address,
    coins,
  };
}

/** One flow through the shipped hop: the worker enters `refund`, the arbitrator `refuseArbitration`. */
function callFlow(market: Market, flow: Flow): Promise<PerCallProxyCallResult> {
  const caller = flow === 'refund' ? { lock: WORKER_LOCK, key: alicePriv } : { lock: ARBITER_LOCK, key: bobPriv };
  return callPerCallProxyEntry({
    provider: market.network,
    implementationArtifact: market.artifacts.Root!,
    proxyArtifact: buildProxyArtifact(market.artifacts.Root!),
    proxyCategoryId: market.rootProxyCategoryId,
    implementationCategoryId: market.rootImplementationCategoryId,
    functionName: flow,
    args: [JOB_ID],
    externals: market.externals,
    callerUtxo: market.coins[flow],
    callerLockingBytecode: caller.lock,
    funder: new SignatureTemplate(caller.key).unlockP2PKH(),
    changeAddress: market.changeAddress,
    vm: compositionMachine(),
  });
}

/** True while the caller's coin is unspent, i.e. nothing was broadcast for the hop. */
async function coinLive(market: Market, flow: Flow): Promise<boolean> {
  const lock = flow === 'refund' ? WORKER_LOCK : ARBITER_LOCK;
  const coin = market.coins[flow];
  return (await market.network.getUtxosForLockingBytecode(lock))
    .some((utxo) => utxo.txid === coin.txid && utxo.vout === coin.vout);
}

/** The write segments the compiler publishes for the escrow's `refund`, or undefined when it publishes none. */
function escrowWriteSegments(artifacts: Artifacts): unknown {
  const entry = readPublishedStopSites(artifacts.Escrow!).entries
    .find((candidate) => candidate.functionName === 'Escrow.refund()');
  return (entry as { readonly writeSegments?: unknown } | undefined)?.writeSegments;
}

let guardedMarket: Promise<Market> | undefined;
/** One deployment serves both pinned flows: each is refused before anything is broadcast. */
function sharedGuardedMarket(): Promise<Market> {
  guardedMarket ??= deployMarket(artifactsFor(true), ESCROW_BELOW_BUYER);
  return guardedMarket;
}

/** The refusal the guarded escrow meets while the hop plans it, before any frame is derived. */
const ESCROW_WRITE_UNPUBLISHED = new RegExp('the callee\'s "Escrow\\.refund\\(\\)" entry writes a mapping record '
  + 'beside an external call, and the segment that write lands in is not fixed by the entry\'s own source');

describe.runIf(process.env.PER_CALL_AHEAD === '1')('ahead (MS5): the origin-gated payout', () => {
  it('compiles the five contracts on the per-call path', () => {
    for (const artifacts of [artifactsFor(true), artifactsFor(false)]) {
      for (const name of ['Registry', 'Token', 'Escrow', 'Store', 'Root']) {
        expect(artifacts[name]?.composition?.convention).toBe('per-call');
      }
    }
  });

  it('refund stops at its first wall: the guarded escrow\'s writes are unpublished, so the hop cannot plan it', async () => {
    const market = await sharedGuardedMarket();

    // The guard writes the escrow's data record before its first call and again after its last, so the compiler
    // publishes no write segment for the entry at all; the unguarded entry publishes its mapping write at segment 1.
    expect(escrowWriteSegments(artifactsFor(true))).toBeUndefined();
    expect(escrowWriteSegments(artifactsFor(false))).toStrictEqual([{ collection: 'claims', segment: 1 }]);
    // Owner: the compiler (`per-call/master/support.ts`, a record written in two segments leaves the entry's writes
    // unpublished), then the SDK hop (`proxy/deploy.ts`: a callee's own data-record write is declared kept).
    await expect(callFlow(market, 'refund')).rejects.toThrow(ESCROW_WRITE_UNPUBLISHED);
    expect(await coinLive(market, 'refund')).toBe(true);
  });

  it('refuseArbitration stops at the same wall', async () => {
    const market = await sharedGuardedMarket();

    // Owner: as for `refund`.
    await expect(callFlow(market, 'refuseArbitration')).rejects.toThrow(ESCROW_WRITE_UNPUBLISHED);
    expect(await coinLive(market, 'refuseArbitration')).toBe(true);
  });
});

describe.runIf(process.env.PER_CALL_AHEAD === '1')('ahead (MS5): behind the escrow\'s guard', () => {
  it('refund settles when the buyer\'s new token balance sorts before the escrow\'s', async () => {
    expect(keyToSlotValue(ROOT_PROXY_ADDRESS)).toBeLessThan(keyToSlotValue(
      validatorAddress(hexToBin(ESCROW_ABOVE_BUYER), VALIDATOR_PROGRAM)));
    const market = await deployMarket(artifactsFor(false), ESCROW_ABOVE_BUYER);
    const result = await callFlow(market, 'refund');

    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    // The escrow's reads and its payout settle first, then the store's three reaches, then the root's own hop.
    expect(result.completed.map((frame) => frame.functionName)).toStrictEqual([
      'Registry.arbiterOf()', 'Token.transfer()', 'Escrow.refund()',
      'Store.markDown()', 'StoreProxy.__fallback()',
      'Store.log()', 'StoreProxy.__fallback()',
      'Store.log()', 'StoreProxy.__fallback()',
      'Root.refund()', 'RootProxy.__fallback()',
    ]);
  });

  it('refund stops at the token when the buyer\'s new balance sorts right after the escrow\'s', async () => {
    expect(keyToSlotValue(ROOT_PROXY_ADDRESS)).toBeGreaterThan(keyToSlotValue(
      validatorAddress(hexToBin(ESCROW_BELOW_BUYER), VALIDATOR_PROGRAM)));
    const market = await deployMarket(artifactsFor(false), ESCROW_BELOW_BUYER);

    // The transfer debits the escrow's node and inserts the buyer's, whose predecessor is that same node. The direct
    // call path settles this shape (`call/mapping-call.test.ts`); a callee frame of the hop does not. Owner: the SDK
    // hop (`proxy/entry-writes.ts`, `proxy/deploy.ts`: a callee batch whose insert relinks the node it updates).
    await expect(callFlow(market, 'refund')).rejects.toThrow(new RegExp('the implementation\'s "refund" entry did '
      + 'not settle through the proxy: frame "[^"]+" of Token\\.transfer\\(\\)'));
    expect(await coinLive(market, 'refund')).toBe(true);
  });

  it('refuseArbitration settles: the store call after the taken arm\'s own write keeps that arm\'s predicate', async () => {
    const market = await deployMarket(artifactsFor(false), ESCROW_ABOVE_BUYER);

    // The last store call sits inside `if (jobs[id].state == 1)`, whose arm sets `state = 0` before it. Its condition
    // is the predicate as it stands where the branch starts, the escrow call's own, not `0 == 1`, which dropped it
    // from the plan (`call/branch-predicate-after-arm-write.test.ts`).
    const row = market.artifacts.Root!.abi.find((entry) => entry.name === 'refuseArbitration')!;
    expect((row.externalCalls ?? []).map((call) => call.condition?.kind ?? 'none'))
      .toStrictEqual(['none', 'none', 'binary', 'binary']);
    expect(row.externalCalls![3]!.condition).toStrictEqual(row.externalCalls![2]!.condition);
    const result = await callFlow(market, 'refuseArbitration');

    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(result.completed.map((frame) => frame.functionName)).toStrictEqual([
      'Store.markRefusal()', 'StoreProxy.__fallback()',
      'Store.log()', 'StoreProxy.__fallback()',
      'Registry.arbiterOf()', 'Token.transfer()', 'Escrow.refund()',
      'Store.log()', 'StoreProxy.__fallback()',
      'Root.refuseArbitration()', 'RootProxy.__fallback()',
    ]);
  });
});
