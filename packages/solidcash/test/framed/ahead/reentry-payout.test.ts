import { describe, expect, it } from 'vitest';
import { bigIntToVmNumber, binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { FrameKind, bytesToHex, encodePushdataValue, validatorAddress, type Artifact } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { decodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import { readFramedDeployment } from '../../../src/framed/deploy/index.js';
import { buildProxyArtifact, deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { callFramedProxyEntry, type FramedProxyCallResult } from '../../../src/framed/proxy/deploy.js';
import {
  deploymentStateValues, planHopExternalCalls, type HopCallee, type FramedProxyExternal,
} from '../../../src/framed/proxy/external-calls.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * Ahead of the ladder, MS4: a rated completion that releases an escrow, whose claimer re-enters it and pays out in
 * a loop, driven through the shipped proxy hop (`callFramedProxyEntry`).
 *
 * The call structure is the marketplace's rated `approveResult` (19 calls: store 5, token 4, escrow 8, claimer 1,
 * judge 1; depth 4 below the root): the root, behind a generated proxy, calls `Escrow.release`, which sets the
 * escrow's guard and calls `Claimer.claim`. `claim` re-enters the escrow for a `STATIC` read of its record, reads a
 * third contract `STATIC`, makes a `pure` `uint16[5]` call, calls the guarded `setClaimed`, then `sendShare` once
 * per turn, each paying through `Token.transfer`. The root then writes its own record and calls a store behind its
 * own proxy five times, which gates on the root proxy's address. The sources start from the hand-planned replica
 * (`shapes/reentry-payout-loop.test.ts`), whose loop likewise turns as often as an earlier `STATIC` read returned;
 * the token keeps balances per holder, as the marketplace's does.
 *
 * Pinned as it stands: the flow, whose loop the hop plans from the count it learns in execution order, the variant
 * with the loop's count moved into the claimer's own record and the flow with one turn all settle: every verdict is
 * accepted and the transaction broadcasts. The re-entered escrow frames start from the guard `release` wrote before
 * its call into the claimer, which the hop learns by deriving `release` up to that call (`proxy/reentry.ts`); each
 * turn's transfer continues the node the one before it created; `release`'s segment after the call carries on from
 * the claim `setClaimed` wrote; and the store's own record writes are authorized by its proxy's master.
 */

/** A 32-byte value with varied bytes, `seed` chosen so each name is distinct. */
function category(seed: string): string {
  const base = 'c4d5e6f708192a3b4c5d6e7f8091a2b';
  return `${seed}${base}${base}`.slice(0, 64);
}

const TOKEN_CATEGORY = category('0a');
const JUDGE_CATEGORY = category('1b');
const ESCROW_CATEGORY = category('2c');
const CLAIMER_CATEGORY = category('3d');
const STORE_IMPL_CATEGORY = category('4e');
const STORE_PROXY_CATEGORY = category('5f');
const ROOT_IMPL_CATEGORY = category('60');
const ROOT_PROXY_CATEGORY = category('71');
const STORE_INIT_TXID = category('82');
const ROOT_INIT_TXID = category('93');
const CALL_TXID = category('a4');

/** The address a contract at `categoryId` presents, `addrV(category)`, as an address literal's hex. */
const addressOf = (categoryId: string): string =>
  binToHex(validatorAddress(hexToBin(categoryId), VALIDATOR_PROGRAM));
const USER = binToHex(encodeLockingBytecodeP2pkh(alicePkh));
const PARTS_WIRE = binToHex(encodePushdataValue([1n, 1n, 1n, 1n, 1n], 'uint16[5]'));
/** The payout's turns: the escrow's recorded share count, and the claimer's own count in the stepped variant. */
const TURNS = 4;
const RATING = 3n;

/**
 * The contracts, with the payout loop bounded by `bound`: `count`, what the escrow's `STATIC` read returned (the
 * flow), or `this.turns`, the claimer's own record (the flow with its first wall stepped around), set to `turns`.
 */
function source(bound: 'count' | 'this.turns', turns = TURNS): string {
  const escrowAddress = addressOf(ESCROW_CATEGORY);
  return [
    'pragma solidcash ^0.14.0;',
    'interface IStore { function rate(int score); function review(int score); function note(int kind);'
      + ' function deliver(); }',
    'interface IEscrow { function release(); function readRecord() view returns (int);'
      + ' function calc(uint16[5] xs) pure returns (uint16[5]); function setClaimed(int value);'
      + ' function sendShare(int amount); }',
    'interface IClaimer { function claim() returns (int); }',
    'interface IJudge { function terms() view returns (int); }',
    'interface IToken { function transfer(address to, int amount); }',
    'contract Token {',
    '  int public paid;',
    '  mapping(address => int) public balances;',
    '  function transfer(address to, int amount) {',
    '    this.balances[to] = this.balances[to] + amount;',
    '    require(amount >= 0);',
    '  }',
    '}',
    'contract Judge {',
    '  int public fee;',
    '  constructor() { this.fee = 1; }',
    '  function terms() view returns (int) { return this.fee; }',
    '}',
    'contract Escrow {',
    '  int public shares;',
    '  int public claiming;',
    '  int public claimed;',
    `  constructor() { this.shares = ${TURNS}; }`,
    '  function release() {',
    '    this.claiming = 1;',
    `    int paid = IClaimer(0x${addressOf(CLAIMER_CATEGORY)}).claim();`,
    '    require(paid >= 1);',
    '  }',
    '  function readRecord() view returns (int) { return this.shares; }',
    '  function calc(uint16[5] xs) pure returns (uint16[5]) { return xs; }',
    '  function setClaimed(int value) {',
    '    require(this.claiming == 1, "guard unset");',
    '    this.claimed = value;',
    '  }',
    `  function sendShare(int amount) { IToken(0x${addressOf(TOKEN_CATEGORY)}).transfer(0x${USER}, amount); }`,
    '}',
    'contract Claimer {',
    '  int public floor;',
    '  int public turns;',
    `  constructor() { this.floor = 1; this.turns = ${turns}; }`,
    '  function claim() returns (int) {',
    `    int count = IEscrow(0x${escrowAddress}).readRecord();`,
    '    require(count >= this.floor);',
    `    int fee = IJudge(0x${addressOf(JUDGE_CATEGORY)}).terms();`,
    '    require(fee >= 0);',
    `    uint16[5] parts = IEscrow(0x${escrowAddress}).calc(hex"${PARTS_WIRE}");`,
    '    require(parts[0] == 1);',
    `    IEscrow(0x${escrowAddress}).setClaimed(1);`,
    '    int paid = 0;',
    `    for (int i = 0; i < ${bound}; i = i + 1) {`,
    `      IEscrow(0x${escrowAddress}).sendShare(1);`,
    '      paid = paid + 1;',
    '    }',
    '    return paid;',
    '  }',
    '}',
    'contract Store {',
    '  address public implementation;',
    '  address public owner;',
    '  int public ratings;',
    '  int public reviews;',
    '  int public delivered;',
    '  event Noted(int indexed kind);',
    '  function initialize(address root) { this.owner = root; require(true); }',
    '  function rate(int score) { require(msg.sender == this.owner); this.ratings = this.ratings + score; }',
    '  function review(int score) { require(msg.sender == this.owner); this.reviews = this.reviews + score; }',
    '  function note(int kind) { require(msg.sender == this.owner); emit Noted(kind); }',
    '  function deliver() { require(msg.sender == this.owner); this.delivered = this.delivered + 1; }',
    '}',
    'contract Root {',
    '  address public implementation;',
    '  address public store;',
    '  address public escrow;',
    '  int public stage;',
    '  function initialize(address s, address e) { this.store = s; this.escrow = e; this.stage = 1; }',
    '  function complete(int rating) {',
    '    require(this.stage == 1);',
    '    IEscrow(this.escrow).release();',
    '    this.stage = 2;',
    '    if (rating > 0) {',
    '      IStore(this.store).rate(rating);',
    '      IStore(this.store).review(rating);',
    '      IStore(this.store).note(1);',
    '    }',
    '    IStore(this.store).deliver();',
    '    IStore(this.store).note(2);',
    '    require(this.stage == 2);',
    '  }',
    '}',
  ].join('\n');
}

type ArtifactMap = ReturnType<typeof compileStringMulti>;
const compiled = new Map<string, ArtifactMap>();
/** Each variant is compiled once, and only when a case runs it. */
function artifactsFor(bound: 'count' | 'this.turns', turns = TURNS): ArtifactMap {
  const variant = `${bound}/${turns}`;
  let found = compiled.get(variant);
  if (found === undefined) {
    found = compileStringMulti(source(bound, turns), { composition: 'framed' });
    compiled.set(variant, found);
  }
  return found;
}

/** A coin a genesis is funded from; its txid becomes the category it mints. */
function funding(txid: string): { txid: string; vout: number; satoshis: bigint } {
  return { txid, vout: 0, satoshis: 5_000_000n };
}

interface Deployed {
  readonly rootProxyCategoryId: string;
  readonly rootImplementationCategoryId: string;
  readonly rootProxyAddress: Uint8Array;
  readonly deployerLock: Uint8Array;
  readonly changeAddress: string;
  readonly callCoin: { txid: string; vout: number; satoshis: bigint };
  readonly funder: ReturnType<SignatureTemplate['unlockP2PKH']>;
  readonly externals: Record<string, FramedProxyExternal>;
}

/** Deploys the plain contracts at the pool's default size, then the store and the root behind their proxies. */
async function deployAll(network: MockNetworkProvider, artifacts: ArtifactMap): Promise<Deployed> {
  const signature = new SignatureTemplate(alicePriv);
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = wallet.unlock.spend(alicePub, signature);
  const callerFunder = signature.unlockP2PKH();
  const deployerLock = encodeLockingBytecodeP2pkh(alicePkh);
  const store = artifacts.Store!;
  const root = artifacts.Root!;

  const plain = [['Token', TOKEN_CATEGORY], ['Judge', JUDGE_CATEGORY], ['Escrow', ESCROW_CATEGORY],
    ['Claimer', CLAIMER_CATEGORY]] as const;
  for (const [name, txid] of plain) {
    const coin = funding(txid);
    await network.addUtxo(wallet.address, coin);
    await deployStatefulContract(artifacts[name]!, [], {
      fundingUtxo: coin, funder, changeAddress: wallet.address, provider: network,
    });
  }
  for (const txid of [STORE_IMPL_CATEGORY, STORE_PROXY_CATEGORY, ROOT_IMPL_CATEGORY, ROOT_PROXY_CATEGORY]) {
    await network.addUtxo(wallet.address, funding(txid));
  }
  const storeInitCoin = funding(STORE_INIT_TXID);
  const rootInitCoin = funding(ROOT_INIT_TXID);
  const callCoin = funding(CALL_TXID);
  for (const coin of [storeInitCoin, rootInitCoin, callCoin]) {
    await network.addUtxo(binToHex(deployerLock), coin);
  }
  await fundShippedFacets(network);

  // The store gates on the root proxy's address, which its category fixes before the root is deployed.
  const storeDeployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: store,
    proxyArtifact: buildProxyArtifact(store),
    implementationDeploy: { fundingUtxo: funding(STORE_IMPL_CATEGORY), funder, changeAddress: wallet.address },
    proxyDeploy: { fundingUtxo: funding(STORE_PROXY_CATEGORY), funder, changeAddress: wallet.address },
    initialize: { functionName: 'initialize', args: [hexToBin(addressOf(ROOT_PROXY_CATEGORY))] },
    callerLockingBytecode: deployerLock,
    callerFunding: { utxo: storeInitCoin, funder: callerFunder, changeAddress: wallet.address },
    vm: compositionMachine(),
  });
  expect(storeDeployment.initialize.broadcast).toBeDefined();

  const rootDeployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: root,
    proxyArtifact: buildProxyArtifact(root),
    implementationDeploy: { fundingUtxo: funding(ROOT_IMPL_CATEGORY), funder, changeAddress: wallet.address },
    proxyDeploy: { fundingUtxo: funding(ROOT_PROXY_CATEGORY), funder, changeAddress: wallet.address },
    initialize: {
      functionName: 'initialize',
      args: [storeDeployment.proxy.address, hexToBin(addressOf(ESCROW_CATEGORY))],
    },
    callerLockingBytecode: deployerLock,
    callerFunding: { utxo: rootInitCoin, funder: callerFunder, changeAddress: wallet.address },
    vm: compositionMachine(),
  });
  expect(rootDeployment.initialize.broadcast).toBeDefined();
  expect(binToHex(rootDeployment.proxy.address)).toBe(addressOf(ROOT_PROXY_CATEGORY));

  return {
    rootProxyCategoryId: rootDeployment.proxy.categoryId,
    rootImplementationCategoryId: rootDeployment.implementation.categoryId,
    rootProxyAddress: rootDeployment.proxy.address,
    deployerLock,
    changeAddress: wallet.address,
    callCoin,
    funder: callerFunder,
    externals: {
      IStore: {
        artifact: store,
        categoryId: storeDeployment.proxy.categoryId,
        proxyArtifact: buildProxyArtifact(store),
        implementationCategoryId: storeDeployment.implementation.categoryId,
      },
      IEscrow: { artifact: artifacts.Escrow!, categoryId: ESCROW_CATEGORY },
      IClaimer: { artifact: artifacts.Claimer!, categoryId: CLAIMER_CATEGORY },
      IJudge: { artifact: artifacts.Judge!, categoryId: JUDGE_CATEGORY },
      IToken: { artifact: artifacts.Token!, categoryId: TOKEN_CATEGORY },
    },
  };
}

/** The user's rated completion, entered on the root's proxy. */
async function complete(
  network: MockNetworkProvider, deployed: Deployed, artifacts: ArtifactMap,
): Promise<FramedProxyCallResult> {
  return callFramedProxyEntry({
    provider: network,
    implementationArtifact: artifacts.Root!,
    proxyArtifact: buildProxyArtifact(artifacts.Root!),
    proxyCategoryId: deployed.rootProxyCategoryId,
    implementationCategoryId: deployed.rootImplementationCategoryId,
    functionName: 'complete',
    args: [RATING],
    externals: deployed.externals,
    callerUtxo: deployed.callCoin,
    callerLockingBytecode: deployed.deployerLock,
    funder: deployed.funder,
    changeAddress: deployed.changeAddress,
    vm: compositionMachine(),
  });
}

/** The root proxy's records as the chain holds them, so a refused call is seen to have changed nothing. */
async function rootRecords(
  network: MockNetworkProvider, deployed: Deployed, artifacts: ArtifactMap,
): Promise<readonly (string | undefined)[]> {
  const layout = buildProxyArtifact(artifacts.Root!).stateLayout!;
  const pools = await readFramedDeployment(network, deployed.rootProxyCategoryId, layout);
  return pools.records.map((record) => record.token?.nft?.commitment);
}

/** A planned frame's distance below the root's implementation frame. */
function depthOf(callees: readonly HopCallee[], index: number): number {
  let depth = 1;
  for (let caller = callees[index]!.enteredBy; caller !== null; caller = callees[caller]!.enteredBy) depth += 1;
  return depth;
}

/** A contract's fields as the chain holds them, parsed with the shipped decoder; a proxy's are read at its layout. */
async function fieldsOf(
  network: MockNetworkProvider, artifact: Artifact, categoryId: string, proxied = false,
): Promise<Record<string, unknown>> {
  const layout = (proxied ? buildProxyArtifact(artifact) : artifact).stateLayout!;
  return deploymentStateValues(layout, categoryId, await readFramedDeployment(network, categoryId, layout));
}

/** The values the token's live nodes hold for the user: one node, however many turns credited it. */
async function userBalances(network: MockNetworkProvider, artifacts: ArtifactMap): Promise<readonly string[]> {
  const deployment = await readFramedDeployment(network, TOKEN_CATEGORY, artifacts.Token!.stateLayout!);
  const slot = bytesToHex(keyToSlotMulti([hexToBin(USER)]));
  return (deployment.nodesByCollection.get('balances') ?? [])
    .map((utxo) => decodeEntryCommitment(hexToBin(utxo.token!.nft!.commitment)))
    .filter((decoded) => bytesToHex(decoded.slot) === slot)
    .map((decoded) => bytesToHex(decoded.value));
}

/**
 * A settled release, read back from the chain: every verdict accepted and the broadcast, one token node crediting the
 * user once per turn, the escrow's guard `release` set and the claim the re-entered `setClaimed` wrote under it, the
 * root's stage and the store's ratings, review and delivery.
 */
async function expectSettled(
  network: MockNetworkProvider, deployed: Deployed, artifacts: ArtifactMap, result: FramedProxyCallResult,
  turns: number,
): Promise<void> {
  expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
  expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  expect(await userBalances(network, artifacts)).toStrictEqual([bytesToHex(bigIntToVmNumber(BigInt(turns)))]);
  const escrow = await fieldsOf(network, artifacts.Escrow!, ESCROW_CATEGORY);
  expect([escrow.claiming, escrow.claimed]).toStrictEqual([1n, 1n]);
  expect((await fieldsOf(network, artifacts.Root!, deployed.rootProxyCategoryId, true)).stage).toBe(2n);
  const store = await fieldsOf(network, artifacts.Store!, deployed.externals.IStore!.categoryId, true);
  expect([store.ratings, store.reviews, store.delivered]).toStrictEqual([RATING, RATING, 1n]);
}

describe.runIf(process.env.FRAMED_AHEAD === '1')('ahead (MS4): a rated release with a re-entrant payout', () => {
  it('plans the payout loop from the count an earlier call returned, and settles', async () => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const flow = artifactsFor('count');
    const deployed = await deployAll(network, flow);
    const before = await rootRecords(network, deployed, flow);

    // The loop's bound is the escrow's `readRecord` result, so the hop plans in execution order: it stops before the
    // loop, settles the read's frame alone, learns the count (`FRAMED_HOP_TRACE=1`: `stop-plan ... reads=loop-bound`,
    // `learned=[/0.0/0.0|0:4]`) and plans the four turns from it. The turns credit one holder and each later transfer
    // continues the node the one before it created; the re-entered frames start from the view `release` left, and
    // its own segment after the call carries on from the claim `setClaimed` wrote, so the hop settles.
    const result = await complete(network, deployed, flow);
    await expectSettled(network, deployed, flow, result, TURNS);
    expect(await rootRecords(network, deployed, flow)).not.toStrictEqual(before);
  });

  it('with the turn count in the claimer\'s record, plans every frame and settles', async () => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const stepped = artifactsFor('this.turns');
    const deployed = await deployAll(network, stepped);
    const before = await rootRecords(network, deployed, stepped);

    // The planner places the whole flow: nineteen calls and the five delegate frames the store's proxy forwards
    // to, the escrow entered eight times in one block, and each transfer four frames below the root.
    const rootLayout = buildProxyArtifact(stepped.Root!).stateLayout!;
    const plan = await planHopExternalCalls({
      provider: network,
      artifact: stepped.Root!,
      functionName: 'complete',
      args: [RATING],
      externals: deployed.externals,
      validatorProgram: VALIDATOR_PROGRAM,
      stateValues: deploymentStateValues(rootLayout, deployed.rootProxyCategoryId,
        await readFramedDeployment(network, deployed.rootProxyCategoryId, rootLayout)),
      selfAddress: deployed.rootProxyAddress,
      senderAddress: deployed.deployerLock,
    });
    const payout = Array.from({ length: TURNS }, () => ['Escrow.sendShare()', 'Token.transfer()']).flat();
    const storeCalls = ['rate', 'review', 'note', 'deliver', 'note']
      .flatMap((entry) => ['StoreProxy.__fallback()', `Store.${entry}()`]);
    expect(plan.callees.map((callee) => callee.functionName)).toStrictEqual([
      'Escrow.release()', 'Claimer.claim()', 'Escrow.readRecord()', 'Judge.terms()', 'Escrow.calc()',
      'Escrow.setClaimed()', ...payout, ...storeCalls,
    ]);
    expect(plan.callees.filter((callee) => callee.kind === FrameKind.DELEGATE)).toHaveLength(5);
    expect(plan.callees.filter((callee) => callee.kind === FrameKind.STATIC).map((callee) => callee.functionName))
      .toStrictEqual(['Escrow.readRecord()', 'Judge.terms()', 'Escrow.calc()']);
    expect(plan.callees.filter((callee) => callee.contract === 'Escrow')).toHaveLength(8);
    const transfers = plan.callees.flatMap((callee, index) => (callee.contract === 'Token' ? [index] : []));
    expect(transfers.map((index) => depthOf(plan.callees, index))).toStrictEqual([4, 4, 4, 4]);

    // All four transfers credit one holder, and each later reach rewrites the node the one before it created rather
    // than recreating it, so the reach check admits the plan, and the hop settles.
    const result = await complete(network, deployed, stepped);
    await expectSettled(network, deployed, stepped, result, TURNS);
    expect(await rootRecords(network, deployed, stepped)).not.toStrictEqual(before);
  });

  it('with one turn in the claimer\'s record, settles', async () => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const stepped = artifactsFor('this.turns', 1);
    const deployed = await deployAll(network, stepped);
    const before = await rootRecords(network, deployed, stepped);

    // One transfer, and the same re-entered guard and claim as the four-turn flows.
    const result = await complete(network, deployed, stepped);
    await expectSettled(network, deployed, stepped, result, 1);
    expect(await rootRecords(network, deployed, stepped)).not.toStrictEqual(before);
  });
});
