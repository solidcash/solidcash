import { beforeAll, describe, expect, it } from 'vitest';
import { bigIntToVmNumber, binToHex, encodeLockingBytecodeP2pkh, hexToBin, utf8ToBin } from '@bitauth/libauth';
import { sha256, type Artifact } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { deployMaster } from '../../../src/framed/deploy/index.js';
import { buildProxyArtifact, deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { callFramedProxyEntry, type FramedProxyCallResult } from '../../../src/framed/proxy/deploy.js';
import { sharedNodeId } from '../../../src/framed/proxy/entry-writes.js';
import type { FramedProxyExternal } from '../../../src/framed/proxy/external-calls.js';
import { decodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { aliceAddress, alicePkh, alicePriv, alicePub, bobAddress, bobPkh, bobPriv } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * A proxied root that calls a proxied store, a registry and a token, and settles (MS10, PW1 step 1).
 *
 * `Desk.post` replicates a publish entry: argument checks, a write into a proxied store, two registry reads, three
 * token calls (`balanceOf`, `approve`, `transferFrom`) and a second store write. With every check passing the entry
 * settles and broadcasts: the token's `balanceOf` and `transferFrom` reaches touch Alice's balance node, which the
 * hop places once and whose views it chains across the two frames.
 *
 * The registry is plain; a value a proxied callee returns reaches its caller since PW8, and that read settles
 * (pinned last). The refusal reporter a failing check asks - the entry's own reason, a callee's custom error and its
 * arguments, and the reached-path rule between them - is guarded on the shipped path by default in
 * `conformance/revert-after-calls-rows.test.ts`, `reverts/` and `call/own-stop-before-refused-plan.test.ts`.
 */

const txid = (seed: string): string => `${seed.repeat(31)}c4`;
const COIN_CATEGORY = txid('31');
const ROSTER_CATEGORY = txid('32');
const JOURNAL_IMPL_CATEGORY = txid('33');
const JOURNAL_PROXY_CATEGORY = txid('34');
const DESK_IMPL_CATEGORY = txid('35');
const DESK_PROXY_CATEGORY = txid('36');
const JOURNAL_INIT_TXID = txid('37');
const DESK_INIT_TXID = txid('38');

const ALICE_LOCK = encodeLockingBytecodeP2pkh(alicePkh);
const BOB_LOCK = encodeLockingBytecodeP2pkh(bobPkh);

// `Roster` lists Alice as a member and a referee and Bob as a referee; `Coin` gives Alice 1000 and Bob 500.
// `Journal` holds the two keys `post` notes, so each note rewrites a node the deployment holds: two notes into an
// empty `marks` would each mint its head, which the hop refuses by name (`call/two-created-heads.test.ts`).
const SOURCE = [
  'pragma solidcash ^0.14.0;',
  'error ShortBalance(address holder, int balance, int needed);',
  'interface IJournal { function note(int id); function isOpen() returns (bool); }',
  'interface IRoster { function isReferee(address who) returns (bool); function isMember(address who) returns (bool); }',
  'interface ICoin {',
  '  function balanceOf(address who) returns (int);',
  '  function approve(address spender, int amount);',
  '  function transferFrom(address holder, address recipient, int amount);',
  '}',
  'contract Journal {',
  '  address public implementation;',
  '  int public opened;',
  '  mapping(int => int) marks;',
  '  function initialize() { this.opened = 1; this.marks[7] = 2; this.marks[9] = 2; require(this.opened > 0); }',
  '  function note(int id) { this.marks[id] = 1; require(true); }',
  '  function isOpen() returns (bool) { return this.opened == 1; }',
  '}',
  'contract Roster {',
  '  mapping(address => int) roles;',
  `  constructor() { this.roles[msg.sender] = 3; this.roles[0x${binToHex(BOB_LOCK)}] = 2; }`,
  '  function isReferee(address who) returns (bool) { return this.roles[who] >= 2; }',
  '  function isMember(address who) returns (bool) { return this.roles[who] % 2 == 1; }',
  '}',
  'contract Coin {',
  '  mapping(address => int) balances;',
  '  mapping(address => int) allowance;',
  `  constructor() { this.balances[msg.sender] = 1000; this.balances[0x${binToHex(BOB_LOCK)}] = 500; }`,
  '  function balanceOf(address who) returns (int) { return this.balances[who]; }',
  '  function approve(address spender, int amount) { this.allowance[spender] = amount; require(true); }',
  '  function transferFrom(address holder, address recipient, int amount) {',
  '    int held = this.balances[holder];',
  '    if (held < amount) { revert ShortBalance(holder, held, amount); }',
  '    this.balances[holder] = held - amount;',
  '    require(recipient.length > 0);',
  '  }',
  '}',
  'contract Desk {',
  '  address public implementation;',
  '  address public journal;',
  '  address public roster;',
  '  address public coin;',
  '  function initialize(address j, address r, address c) {',
  '    this.journal = j; this.roster = r; this.coin = c; require(true);',
  '  }',
  '  function post(int nameLength, int amount, int methodLength, address referee, address coinAt) {',
  '    require(nameLength > 0 && nameLength < 255, "name too short or long");',
  '    require(amount > 0, "amount must be positive");',
  '    IJournal(this.journal).note(7);',
  '    require(IRoster(this.roster).isReferee(referee), "referee not listed");',
  '    require(referee != msg.sender, "referee is the poster");',
  '    require(ICoin(this.coin).balanceOf(msg.sender) > 0 && coinAt == this.coin, "invalid coin");',
  '    ICoin(this.coin).approve(address(this), amount);',
  '    require(methodLength > 0 && methodLength < 255, "method too short or long");',
  '    require(IRoster(this.roster).isMember(msg.sender), "not a member");',
  '    ICoin(this.coin).transferFrom(msg.sender, address(this), amount);',
  '    IJournal(this.journal).note(9);',
  '    require(true);',
  '  }',
  '  function peek() { require(IJournal(this.journal).isOpen(), "journal closed"); }',
  '}',
].join('\n');

/** A coin a genesis or a call is funded from; a genesis coin's txid becomes the category it mints. */
function funding(id: string): { txid: string; vout: number; satoshis: bigint } {
  return { txid: id, vout: 0, satoshis: 5_000_000n };
}

interface Compiled {
  readonly journal: Artifact;
  readonly roster: Artifact;
  readonly coin: Artifact;
  readonly desk: Artifact;
  readonly coinAddress: Uint8Array;
  readonly rosterAddress: Uint8Array;
}

/** Compiled when the suite runs, so a run that skips it compiles nothing. */
function compile(): Compiled {
  const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
  const [journal, roster, coin, desk] = [artifacts.Journal!, artifacts.Roster!, artifacts.Coin!, artifacts.Desk!];
  return {
    journal, roster, coin, desk,
    coinAddress: deployMaster(coin, hexToBin(COIN_CATEGORY), VALIDATOR_PROGRAM).address,
    rosterAddress: deployMaster(roster, hexToBin(ROSTER_CATEGORY), VALIDATOR_PROGRAM).address,
  };
}

interface Caller {
  readonly lock: Uint8Array;
  readonly address: string;
  readonly coin: { txid: string; vout: number; satoshis: bigint };
  readonly funder: ReturnType<SignatureTemplate['unlockP2PKH']>;
}

interface Deployed {
  readonly network: MockNetworkProvider;
  readonly deskProxyCategoryId: string;
  readonly deskImplementationCategoryId: string;
  readonly externals: Record<string, FramedProxyExternal>;
  readonly alice: Caller;
  readonly bob: Caller;
}

let compiled: Compiled;
let deployed: Deployed;

/** Deploys the registry and the token, then the store and the root behind generated proxies. */
async function deployAll(): Promise<Deployed> {
  const { journal, roster, coin, desk } = compiled;
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const source = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = source.unlock.spend(alicePub, signature);
  const aliceFunder = signature.unlockP2PKH();

  // Alice's own coin funds each plain genesis, so she is the constructor's `msg.sender`.
  for (const [artifact, id] of [[roster, ROSTER_CATEGORY], [coin, COIN_CATEGORY]] as const) {
    const genesisCoin = funding(id);
    await network.addUtxo(aliceAddress, genesisCoin);
    await deployStatefulContract(artifact, [], {
      fundingUtxo: genesisCoin, funder: aliceFunder, changeAddress: aliceAddress, provider: network, threadCount: 4,
    });
  }
  for (const id of [JOURNAL_IMPL_CATEGORY, JOURNAL_PROXY_CATEGORY, DESK_IMPL_CATEGORY, DESK_PROXY_CATEGORY]) {
    await network.addUtxo(source.address, funding(id));
  }
  const journalInitCoin = funding(JOURNAL_INIT_TXID);
  const deskInitCoin = funding(DESK_INIT_TXID);
  for (const initCoin of [journalInitCoin, deskInitCoin]) await network.addUtxo(binToHex(ALICE_LOCK), initCoin);
  await fundShippedFacets(network);

  const journalDeployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: journal,
    proxyArtifact: buildProxyArtifact(journal),
    implementationDeploy: { fundingUtxo: funding(JOURNAL_IMPL_CATEGORY), funder, changeAddress: source.address },
    proxyDeploy: { fundingUtxo: funding(JOURNAL_PROXY_CATEGORY), funder, changeAddress: source.address },
    initialize: { functionName: 'initialize', args: [] },
    callerLockingBytecode: ALICE_LOCK,
    callerFunding: { utxo: journalInitCoin, funder: aliceFunder, changeAddress: source.address },
    vm: compositionMachine(),
  });
  expect(journalDeployment.initialize.broadcast).toBeDefined();

  const deskDeployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: desk,
    proxyArtifact: buildProxyArtifact(desk),
    implementationDeploy: { fundingUtxo: funding(DESK_IMPL_CATEGORY), funder, changeAddress: source.address },
    proxyDeploy: { fundingUtxo: funding(DESK_PROXY_CATEGORY), funder, changeAddress: source.address },
    initialize: {
      functionName: 'initialize',
      args: [journalDeployment.proxy.address, compiled.rosterAddress, compiled.coinAddress],
    },
    callerLockingBytecode: ALICE_LOCK,
    callerFunding: { utxo: deskInitCoin, funder: aliceFunder, changeAddress: source.address },
    vm: compositionMachine(),
  });
  expect(deskDeployment.initialize.broadcast).toBeDefined();

  const caller = async (lock: Uint8Array, address: string, key: Uint8Array, seed: string): Promise<Caller> => {
    const callCoin = funding(txid(seed));
    await network.addUtxo(binToHex(lock), callCoin);
    return { lock, address, coin: callCoin, funder: new SignatureTemplate(key).unlockP2PKH() };
  };
  return {
    network,
    deskProxyCategoryId: deskDeployment.proxy.categoryId,
    deskImplementationCategoryId: deskDeployment.implementation.categoryId,
    externals: {
      IJournal: {
        artifact: journal,
        categoryId: journalDeployment.proxy.categoryId,
        proxyArtifact: buildProxyArtifact(journal),
        implementationCategoryId: journalDeployment.implementation.categoryId,
      },
      IRoster: { artifact: roster, categoryId: ROSTER_CATEGORY },
      ICoin: { artifact: coin, categoryId: COIN_CATEGORY },
    },
    alice: await caller(ALICE_LOCK, aliceAddress, alicePriv, '39'),
    bob: await caller(BOB_LOCK, bobAddress, bobPriv, '3a'),
  };
}

/** Calls a `Desk` entry through its proxy and returns the settled hop. */
function settledCall(
  caller: Caller, functionName: string, args: readonly FunctionArgument[],
): Promise<FramedProxyCallResult> {
  return callFramedProxyEntry({
    provider: deployed.network,
    implementationArtifact: compiled.desk,
    proxyArtifact: buildProxyArtifact(compiled.desk),
    proxyCategoryId: deployed.deskProxyCategoryId,
    implementationCategoryId: deployed.deskImplementationCategoryId,
    functionName,
    args,
    externals: deployed.externals,
    callerUtxo: caller.coin,
    callerLockingBytecode: caller.lock,
    funder: caller.funder,
    changeAddress: caller.address,
    vm: compositionMachine(),
  });
}

describe.runIf(process.env.FRAMED_AHEAD === '1')('a revert after calls through the shipped proxy hop', () => {
  beforeAll(async () => {
    compiled = compile();
    deployed = await deployAll();
  }, 600_000);

  it('with every check passing, the hop settles and broadcasts, the balance read and then debited one input',
    async () => {
      // A coin of Alice's own for the hop this case broadcasts, so the later cases keep the one they share.
      const coin = funding(binToHex(sha256(utf8ToBin('revert after calls: the settled post'))));
      await deployed.network.addUtxo(binToHex(ALICE_LOCK), coin);
      const result = await settledCall({ ...deployed.alice, coin }, 'post',
        [5n, 100n, 7n, BOB_LOCK, compiled.coinAddress]);
      expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
      expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
      // The transaction the provider accepted spends each outpoint once, and both token reaches ran.
      const spent = result.broadcast!.inputs.map(
        (input) => `${binToHex(input.outpointTransactionHash)}:${input.outpointIndex}`);
      expect(new Set(spent).size).toBe(spent.length);
      expect(result.completed.map((frame) => frame.functionName))
        .toEqual(expect.arrayContaining(['Coin.balanceOf()', 'Coin.transferFrom()']));
      // `balanceOf(msg.sender)` (callee-master-4) and `transferFrom(msg.sender, ...)` (callee-master-7) touch Alice's
      // balance node, which is placed once under the token's category; the read keeps the view the deployment holds
      // and the debit continues from it to the one its own frame computed, which the node's output carries.
      const { draft } = result;
      const node = sharedNodeId(COIN_CATEGORY, 'balances', keyToSlotMulti([ALICE_LOCK]));
      expect(draft.layout.participants.filter((placed) => placed.id.includes('-balances-'))
        .map((placed) => placed.id)).toStrictEqual([node]);
      const index = draft.layout.participants.find((placed) => placed.id === node)!.index;
      const value = (commitment: Uint8Array): string => binToHex(decodeEntryCommitment(commitment).value);
      const views = (master: string): readonly string[] => draft.blockOf(master).segments.flat()
        .filter((entry) => entry.in === index).map((entry) => `${value(entry.viewIn)}>${value(entry.viewOut)}`);
      const [held, left] = [binToHex(bigIntToVmNumber(1000n)), binToHex(bigIntToVmNumber(900n))];
      expect(views('callee-master-4')).toStrictEqual([`${held}>${held}`]);
      expect(views('callee-master-7')).toStrictEqual([`${held}>${left}`]);
      expect(value(Uint8Array.from(result.transaction.outputs[index]!.token!.nft!.commitment))).toBe(left);
    });

  it('a value a proxied store returns reaches its caller, and the read settles', async () => {
    const result = await settledCall(deployed.alice, 'peek', []);
    // The generated fallback returns the delegate's bytes (PW8), so the store's `true` passes the entry's check.
    expect(result.verdicts.every((verdict) => verdict.accepted)).toBe(true);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    const { draft } = result;
    expect(binToHex(draft.blockOf('callee-impl-master-2').retval)).toBe('51');
    expect(binToHex(draft.blockOf('callee-master-1').calls[0]!.result)).toBe('51');
    expect(binToHex(draft.blockOf('callee-master-1').retval)).toBe('51');
    expect(binToHex(draft.blockOf('implementation-master').calls[0]!.result)).toBe('51');
  });
});
