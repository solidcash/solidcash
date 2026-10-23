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
 * Ahead of the ladder, MS7: a deep arbitration whose claimer re-enters the judge and the vault, driven through the
 * shipped proxy hop (`callFramedProxyEntry`).
 *
 * The call structure is the marketplace's 80-20 `arbitrate` (20 calls: store 2, token 5, vault 9, claimer 1,
 * judge 3; 24 masters; depth 4 below the root): the root, behind a generated proxy, writes a store behind its own
 * proxy, then calls `Judge.enter(uint16[2])`, which requires the user as `tx.origin`, reads the vault `STATIC`,
 * calls `Vault.settle(uint16[4], int16[2])`, writes its own flag and calls `Claimer.claim`. `claim` re-enters the
 * judge for a `STATIC` read of that flag and a `pure` `uint16[5]` calculation, and reaches the vault again for its
 * record, the guarded `setClaimed` and `sendShare` once per turn, each paying through `Token.transfer`. The shares
 * `settle` returned travel back up two frames, and the root writes the store again after the call. The sources
 * start from the hand-planned replica (`shapes/deep-arbitration.test.ts`), whose loop turns as often as the vault's
 * read returned; the token keeps balances per holder, as the marketplace's does.
 *
 * Pinned as it stands: the flow, whose loop the hop plans from the count it learns in execution order, the variant
 * with the loop's count moved into the claimer's own record and the flow with one turn all settle: every verdict is
 * accepted and the transaction broadcasts. The re-entered `readFlag` starts from the view `enter`'s own close left
 * before its call into the claimer, which the hop learns by deriving `enter` up to that call (`proxy/reentry.ts`);
 * the vault's guard reads the flag `settle` wrote; each turn's transfer continues the node the one before it created;
 * and the judge's last segment carries on from the view the frames inside it left.
 */

/** A 32-byte value with varied bytes, `seed` chosen so each name is distinct. */
function category(seed: string): string {
  const base = 'e6f708192a3b4c5d6e7f8091a2b3c4d';
  return `${seed}${base}${base}`.slice(0, 64);
}

const TOKEN_CATEGORY = category('0b');
const VAULT_CATEGORY = category('1c');
const CLAIMER_CATEGORY = category('2d');
const JUDGE_CATEGORY = category('3e');
const STORE_IMPL_CATEGORY = category('4f');
const STORE_PROXY_CATEGORY = category('50');
const ROOT_IMPL_CATEGORY = category('61');
const ROOT_PROXY_CATEGORY = category('72');
const STORE_INIT_TXID = category('83');
const ROOT_INIT_TXID = category('94');
const CALL_TXID = category('a5');

/** The address a contract at `categoryId` presents, `addrV(category)`, as an address literal's hex. */
const addressOf = (categoryId: string): string =>
  binToHex(validatorAddress(hexToBin(categoryId), VALIDATOR_PROGRAM));
const USER = binToHex(encodeLockingBytecodeP2pkh(alicePkh));
/** The 80-20 split the root hands the judge, and the settlement's own fixed-size arguments. */
const SPLIT_WIRE = binToHex(encodePushdataValue([8000n, 2000n], 'uint16[2]'));
const XS_WIRE = binToHex(encodePushdataValue([1n, 2n, 3n, 4n], 'uint16[4]'));
const YS_WIRE = binToHex(encodePushdataValue([-1n, 2n], 'int16[2]'));
const SHARES_WIRE = binToHex(encodePushdataValue([1n, 1n, 1n, 1n, 1n], 'uint16[5]'));
/** Every share of the 80-20 split is non-zero, so the payout turns five times. */
const TURNS = 5;

/**
 * The contracts, with the payout loop bounded by `bound`: `count`, what the vault's `STATIC` read returned (the
 * flow), or `this.turns`, the claimer's own record (the flow with its first wall stepped around); `turns` is that
 * record's value and the payout the judge requires.
 */
function source(bound: 'count' | 'this.turns', turns = TURNS): string {
  const vaultAddress = addressOf(VAULT_CATEGORY);
  const judgeAddress = addressOf(JUDGE_CATEGORY);
  return [
    'pragma solidcash ^0.14.0;',
    'interface IStore { function write(int amount); }',
    'interface IJudge { function enter(uint16[2] xs) returns (uint16[5]); function readFlag() view returns (int);'
      + ' function calc(uint16[5] xs) pure returns (uint16[5]); }',
    'interface IVault { function readRecord() view returns (int);'
      + ' function settle(uint16[4] xs, int16[2] ys) returns (uint16[5]); function setClaimed(int value);'
      + ' function sendShare(); }',
    'interface IClaimer { function claim() returns (int); }',
    'interface IToken { function transfer(address to, int amount); }',
    'contract Token {',
    '  int public paid;',
    '  mapping(address => int) public balances;',
    '  function transfer(address to, int amount) {',
    '    this.balances[to] = this.balances[to] + amount;',
    '    require(amount >= 0);',
    '  }',
    '}',
    'contract Vault {',
    '  int public shares;',
    '  int public settled;',
    '  int public claimed;',
    `  constructor() { this.shares = ${TURNS}; }`,
    '  function readRecord() view returns (int) { return this.shares; }',
    '  function settle(uint16[4] xs, int16[2] ys) returns (uint16[5]) {',
    '    uint16[5] r; r[0] = 1; r[1] = 1; r[2] = 1; r[3] = 1; r[4] = 1;',
    '    this.settled = 1;',
    '    return r;',
    '  }',
    '  function setClaimed(int value) {',
    '    require(this.settled == 1, "not settled");',
    '    this.claimed = value;',
    '  }',
    `  function sendShare() { IToken(0x${addressOf(TOKEN_CATEGORY)}).transfer(0x${USER}, 1); }`,
    '}',
    'contract Claimer {',
    '  int public floor;',
    '  int public turns;',
    `  constructor() { this.floor = 1; this.turns = ${turns}; }`,
    '  function claim() returns (int) {',
    `    int flag = IJudge(0x${judgeAddress}).readFlag();`,
    '    require(flag == 1);',
    `    uint16[5] arr = IJudge(0x${judgeAddress}).calc(hex"${SHARES_WIRE}");`,
    '    require(arr[0] == 1);',
    `    int count = IVault(0x${vaultAddress}).readRecord();`,
    '    require(count >= this.floor);',
    `    IVault(0x${vaultAddress}).setClaimed(1);`,
    '    int paid = 0;',
    `    for (int i = 0; i < ${bound}; i = i + 1) {`,
    `      IVault(0x${vaultAddress}).sendShare();`,
    '      paid = paid + 1;',
    '    }',
    '    return paid;',
    '  }',
    '}',
    'contract Judge {',
    '  int public settled;',
    '  function enter(uint16[2] xs) returns (uint16[5]) {',
    `    require(tx.origin == 0x${USER});`,
    `    int count = IVault(0x${vaultAddress}).readRecord();`,
    '    require(count >= 1);',
    `    uint16[5] shares = IVault(0x${vaultAddress}).settle(hex"${XS_WIRE}", hex"${YS_WIRE}");`,
    '    this.settled = 1;',
    `    int paid = IClaimer(0x${addressOf(CLAIMER_CATEGORY)}).claim();`,
    `    require(paid == ${turns});`,
    '    return shares;',
    '  }',
    '  function readFlag() view returns (int) { return this.settled; }',
    '  function calc(uint16[5] xs) pure returns (uint16[5]) { return xs; }',
    '}',
    'contract Store {',
    '  address public implementation;',
    '  address public owner;',
    '  int public written;',
    '  function initialize(address root) { this.owner = root; require(true); }',
    '  function write(int amount) {',
    '    require(msg.sender == this.owner);',
    '    this.written = this.written + amount;',
    '    require(this.written >= amount);',
    '  }',
    '}',
    'contract Root {',
    '  address public implementation;',
    '  address public store;',
    '  address public judge;',
    '  int public score;',
    '  function initialize(address s, address j) { this.store = s; this.judge = j; require(true); }',
    '  function run() {',
    '    IStore(this.store).write(1);',
    `    uint16[5] shares = IJudge(this.judge).enter(hex"${SPLIT_WIRE}");`,
    '    IStore(this.store).write(2);',
    '    this.score = int(shares[0]);',
    '    require(this.score == int(shares[0]));',
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

/**
 * Deploys the plain contracts, then the store and the root behind their proxies.
 *
 * Every pool is the framed default of twelve masters, which holds the vault's nine reaches.
 */
async function deployAll(network: MockNetworkProvider, artifacts: ArtifactMap): Promise<Deployed> {
  const signature = new SignatureTemplate(alicePriv);
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = wallet.unlock.spend(alicePub, signature);
  const callerFunder = signature.unlockP2PKH();
  const deployerLock = encodeLockingBytecodeP2pkh(alicePkh);
  const store = artifacts.Store!;
  const root = artifacts.Root!;

  const plain = [['Token', TOKEN_CATEGORY], ['Vault', VAULT_CATEGORY], ['Claimer', CLAIMER_CATEGORY],
    ['Judge', JUDGE_CATEGORY]] as const;
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
      args: [storeDeployment.proxy.address, hexToBin(addressOf(JUDGE_CATEGORY))],
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
      IJudge: { artifact: artifacts.Judge!, categoryId: JUDGE_CATEGORY },
      IVault: { artifact: artifacts.Vault!, categoryId: VAULT_CATEGORY },
      IClaimer: { artifact: artifacts.Claimer!, categoryId: CLAIMER_CATEGORY },
      IToken: { artifact: artifacts.Token!, categoryId: TOKEN_CATEGORY },
    },
  };
}

/** The user's arbitration, entered on the root's proxy. */
async function run(
  network: MockNetworkProvider, deployed: Deployed, artifacts: ArtifactMap,
): Promise<FramedProxyCallResult> {
  return callFramedProxyEntry({
    provider: network,
    implementationArtifact: artifacts.Root!,
    proxyArtifact: buildProxyArtifact(artifacts.Root!),
    proxyCategoryId: deployed.rootProxyCategoryId,
    implementationCategoryId: deployed.rootImplementationCategoryId,
    functionName: 'run',
    args: [],
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
 * A settled arbitration, read back from the chain: every verdict accepted and the broadcast, one token node crediting
 * the user once per turn, the judge's flag and the vault's claim the re-entered frames read and wrote, the store
 * written twice and the root's score set from the shares `settle` returned.
 */
async function expectSettled(
  network: MockNetworkProvider, deployed: Deployed, artifacts: ArtifactMap, result: FramedProxyCallResult,
  turns: number,
): Promise<void> {
  expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
  expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  expect(await userBalances(network, artifacts)).toStrictEqual([bytesToHex(bigIntToVmNumber(BigInt(turns)))]);
  expect((await fieldsOf(network, artifacts.Judge!, JUDGE_CATEGORY)).settled).toBe(1n);
  const vault = await fieldsOf(network, artifacts.Vault!, VAULT_CATEGORY);
  expect([vault.settled, vault.claimed]).toStrictEqual([1n, 1n]);
  expect((await fieldsOf(network, artifacts.Store!, deployed.externals.IStore!.categoryId, true)).written).toBe(3n);
  expect((await fieldsOf(network, artifacts.Root!, deployed.rootProxyCategoryId, true)).score).toBe(1n);
}

describe.runIf(process.env.FRAMED_AHEAD === '1')('ahead (MS7): a deep 80-20 arbitration', () => {
  it('plans the payout loop from the count an earlier call returned, and settles', async () => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const flow = artifactsFor('count');
    const deployed = await deployAll(network, flow);
    const before = await rootRecords(network, deployed, flow);

    // The loop's bound is the vault's `readRecord` result, so the hop plans in execution order: it stops before the
    // loop, settles the read's frame alone, learns the count (`FRAMED_HOP_TRACE=1`: `stop-plan ... reads=loop-bound`,
    // `learned=[/1.0/2.0|2:5]`) and plans the five turns from it. The turns credit one holder and each later transfer
    // continues the node the one before it created, and the re-entered frames start from the views the frames before
    // them left (`HOPTRACE reentry`), so the hop settles.
    const result = await run(network, deployed, flow);
    await expectSettled(network, deployed, flow, result, TURNS);
    expect(await rootRecords(network, deployed, flow)).not.toStrictEqual(before);
  });

  it('with the turn count in the claimer\'s record, plans 24 masters and settles', async () => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const stepped = artifactsFor('this.turns');
    const deployed = await deployAll(network, stepped);
    const before = await rootRecords(network, deployed, stepped);

    // The planner places the whole flow: twenty calls and the two delegate frames the store's proxy forwards to,
    // which with the root's own proxy and implementation frames are twenty-four masters; the vault is entered nine
    // times and the judge three in one block each, and each transfer runs four frames below the root.
    const rootLayout = buildProxyArtifact(stepped.Root!).stateLayout!;
    const plan = await planHopExternalCalls({
      provider: network,
      artifact: stepped.Root!,
      functionName: 'run',
      args: [],
      externals: deployed.externals,
      validatorProgram: VALIDATOR_PROGRAM,
      stateValues: deploymentStateValues(rootLayout, deployed.rootProxyCategoryId,
        await readFramedDeployment(network, deployed.rootProxyCategoryId, rootLayout)),
      selfAddress: deployed.rootProxyAddress,
      senderAddress: deployed.deployerLock,
    });
    const payout = Array.from({ length: TURNS }, () => ['Vault.sendShare()', 'Token.transfer()']).flat();
    expect(plan.callees.map((callee) => callee.functionName)).toStrictEqual([
      'StoreProxy.__fallback()', 'Store.write()',
      'Judge.enter()', 'Vault.readRecord()', 'Vault.settle()', 'Claimer.claim()',
      'Judge.readFlag()', 'Judge.calc()', 'Vault.readRecord()', 'Vault.setClaimed()', ...payout,
      'StoreProxy.__fallback()', 'Store.write()',
    ]);
    expect(plan.callees.length + 2).toBe(24);
    expect(plan.callees.filter((callee) => callee.kind === FrameKind.DELEGATE)).toHaveLength(2);
    expect(plan.callees.filter((callee) => callee.kind === FrameKind.STATIC).map((callee) => callee.functionName))
      .toStrictEqual(['Vault.readRecord()', 'Judge.readFlag()', 'Judge.calc()', 'Vault.readRecord()']);
    expect(plan.callees.filter((callee) => callee.contract === 'Vault')).toHaveLength(9);
    expect(plan.callees.filter((callee) => callee.contract === 'Judge')).toHaveLength(3);
    const transfers = plan.callees.flatMap((callee, index) => (callee.contract === 'Token' ? [index] : []));
    expect(transfers.map((index) => depthOf(plan.callees, index))).toStrictEqual([4, 4, 4, 4, 4]);

    // All five transfers credit one holder, and each later reach rewrites the node the one before it created rather
    // than recreating it, so the reach check admits the plan, and the hop settles.
    const result = await run(network, deployed, stepped);
    await expectSettled(network, deployed, stepped, result, TURNS);
    expect(await rootRecords(network, deployed, stepped)).not.toStrictEqual(before);
  });

  it('with one turn in the claimer\'s record, settles', async () => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const stepped = artifactsFor('this.turns', 1);
    const deployed = await deployAll(network, stepped);
    const before = await rootRecords(network, deployed, stepped);

    // One transfer, and the same re-entered reads and writes as the five-turn flows.
    const result = await run(network, deployed, stepped);
    await expectSettled(network, deployed, stepped, result, 1);
    expect(await rootRecords(network, deployed, stepped)).not.toStrictEqual(before);
  });
});
