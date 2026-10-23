import { describe, expect, it } from 'vitest';
import { bigIntToVmNumber, binToHex, encodeLockingBytecodeP2pkh, hexToBin, secp256k1 } from '@bitauth/libauth';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { ethers } from 'ethers';
import {
  SHARED_LIBRARY_SALT, bytesToHex, encodePushdataValue, hash160, validatorAddress, type Artifact,
} from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { decodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import { computeEcrecoverWitness } from '../../../src/ecrecover/ecrecoverRecovery.js';
import { probeEcrecoverSplit } from '../../../src/ecrecover/ecrecoverComputeSidecar.js';
import { readFramedDeployment } from '../../../src/framed/deploy/index.js';
import {
  buildProxyArtifact, callFramedProxyEntry, deployFramedProxy,
  type FramedProxyCallResult,
} from '../../../src/framed/proxy/index.js';
import { deploymentStateValues, type FramedProxyExternal } from '../../../src/framed/proxy/external-calls.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import type { Unlocker, Utxo } from '../../../src/interfaces.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub, bobPkh } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * Walls ahead: the fan-in shape (MS3) through the shipped hop, `callFramedProxyEntry`.
 *
 * `Desk` (a proxied root) fans into `Journal` (a proxied store), `Coin` (a token), `Vault` (an escrow) and `Panel`
 * (the escrow's arbitrator), as `takeJob` with one applicant and `payStartJob` do. `take` reads membership and the
 * note count, checks the worker's signature over an EIP-191 digest of that count through `ecrecoverP2pkh`, posts a
 * note carrying the count, approves the escrow, reads the arbitrator's fee and passes it to the payable `Vault.pay`,
 * stores the id it returns and posts a note carrying it: 11 calls (store 5, token 4, escrow 1, arbitrator 1,
 * recovery 1). `payStart` is the creator's payable version without the signature: 9 calls (store 3). `pay` reads the
 * balance, pulls the token against the allowance the root wrote in this transaction, reads the balance again, calls
 * the arbitrator (gated on the escrow's address), then writes its record under a counter field and returns the id.
 *
 * Each flow is pinned where it stops today; a flow that settles moves its case to every verdict accepted and the
 * broadcast, as `payStart` has. The whole file runs only under `FRAMED_AHEAD=1`.
 */

/** A 32-byte id that is neither one repeated byte nor a palindrome. */
const id32 = (lead: string): string => `${lead.repeat(31)}c4`;

const JOURNAL_IMPL_CATEGORY = id32('3a');
const JOURNAL_PROXY_CATEGORY = id32('3b');
const DESK_IMPL_CATEGORY = id32('3c');
const DESK_PROXY_CATEGORY = id32('3d');
const COIN_CATEGORY = id32('3e');
const VAULT_CATEGORY = id32('3f');
const PANEL_CATEGORY = id32('4a');

/** A framed contract's address, which its category fixes before anything is deployed. */
const addressOf = (category: string): Uint8Array => validatorAddress(hexToBin(category), VALIDATOR_PROGRAM);

const MAX = 2n ** 256n - 1n;
const PREFIX = new TextEncoder().encode('\x19Ethereum Signed Message:\n32');
const JOB = 7n;
const AMOUNT = 40n;
const SUPPLY = 1000n;
const FEE = 250n;
/** The notes the job holds when it is taken: the one its opening posted. */
const NOTES_BEFORE = 1n;

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' struct Note { int kind; bytes who; bytes data; int stamp; }'
  + ' struct Member { bytes key; int score; }'
  + ' struct Judge { bytes key; int fee; }'
  + ' struct Terms { address buyer; address seller; int fee; address currency; int period; uint amount; string memo; }'
  + ' struct Deal { address buyer; address seller; address currency; uint amount; string memo; }'
  + ' struct Tally { int value; }'
  + ' struct Seat { address judge; int fee; bool buyerAgrees; bool sellerAgrees; }'
  + ' interface IJournal {'
  + '   function isMember(address who) view returns (bool);'
  + '   function noteCount(int id) view returns (int);'
  + '   function feeOf(address who) view returns (int);'
  + '   function post(int id, Note note);'
  + ' }'
  + ' interface ICoin {'
  + '   function approve(address spender, uint amount) returns (bool);'
  + '   function balanceOf(address who) view returns (uint);'
  + '   function transferFrom(address from, address to, uint amount) returns (bool);'
  + ' }'
  + ' interface IVault { function pay(address from, Terms terms, address judge, int fee) returns (int); }'
  + ' interface IPanel { function appoint(int id, address judge, int fee); }'
  + ' contract Journal {'
  + '   address public implementation;'
  + '   address public desk;'
  + '   mapping(int => Note[]) notes;'
  + '   mapping(address => Member) members;'
  + '   mapping(address => Judge) judges;'
  + '   event Posted(int id, Note note);'
  + '   function initialize(address hub, address member, bytes memberKey) {'
  + '     this.desk = hub;'
  + '     this.members[member] = Member(memberKey, 0);'
  + '   }'
  + '   function enlist(address who, bytes key, int fee) { this.judges[who] = Judge(key, fee); }'
  + '   function setUp(address hub, address member, bytes memberKey, address judge, bytes judgeKey, int fee) {'
  + '     this.desk = hub;'
  + '     this.members[member] = Member(memberKey, 0);'
  + '     this.judges[judge] = Judge(judgeKey, fee);'
  + '   }'
  + '   function isMember(address who) view returns (bool) { return this.members[who].key.length > 0; }'
  + '   function noteCount(int id) view returns (int) { return this.notes[id].length; }'
  + '   function feeOf(address who) view returns (int) { return this.judges[who].fee; }'
  + '   function post(int id, Note note) {'
  + '     require(msg.sender == this.desk);'
  + '     this.notes[id].push(note);'
  + '     emit Posted(id, note);'
  + '   }'
  + ' }'
  + ' contract Coin {'
  + '   mapping(address => uint) balances;'
  + '   mapping(address => mapping(address => uint)) allowances;'
  + '   constructor(address holder, uint supply) { this.balances[holder] = supply; }'
  + '   function approve(address spender, uint amount) returns (bool) {'
  + '     this.allowances[msg.sender][spender] = amount;'
  + '     return true;'
  + '   }'
  + '   function balanceOf(address who) view returns (uint) { return this.balances[who]; }'
  + '   function transferFrom(address from, address to, uint amount) returns (bool) {'
  + '     require(this.allowances[from][msg.sender] >= amount);'
  + '     this.allowances[from][msg.sender] = this.allowances[from][msg.sender] - amount;'
  + '     this.balances[from] = this.balances[from] - amount;'
  + '     this.balances[to] = this.balances[to] + amount;'
  + '     return true;'
  + '   }'
  + ' }'
  + ' contract Panel {'
  + '   address public vault;'
  + '   mapping(int => Seat) seats;'
  + '   constructor(address v) { this.vault = v; }'
  + '   function appoint(int id, address judge, int fee) {'
  + '     require(msg.sender == this.vault);'
  + '     this.seats[id].judge = judge;'
  + '     this.seats[id].fee = fee;'
  + '     this.seats[id].buyerAgrees = true;'
  + '     this.seats[id].sellerAgrees = true;'
  + '   }'
  + ' }'
  + ' contract Vault {'
  + '   Tally tally;'
  + '   address public panel;'
  + '   mapping(int => Deal) deals;'
  + '   event Paid(int id, uint amount, string memo);'
  + '   constructor(address p) { this.panel = p; }'
  + '   function pay(address from, Terms terms, address judge, int fee) payable returns (int) {'
  + '     int id = this.tally.value;'
  + '     require(fee + terms.fee < 10000);'
  + '     require(terms.buyer != terms.seller);'
  + '     require(terms.amount > 0);'
  + '     uint before = ICoin(terms.currency).balanceOf(address(this));'
  + '     require(ICoin(terms.currency).transferFrom(from, address(this), terms.amount));'
  + '     uint after = ICoin(terms.currency).balanceOf(address(this));'
  + '     uint amount = after - before;'
  + '     IPanel(this.panel).appoint(id, judge, fee);'
  + '     Deal memory deal = Deal(terms.buyer, terms.seller, terms.currency, amount, terms.memo);'
  + '     this.deals[id] = deal;'
  + '     this.tally.value = id + 1;'
  + '     emit Paid(id, amount, terms.memo);'
  + '     return id;'
  + '   }'
  + ' }'
  + ' contract Desk {'
  + '   address public implementation;'
  + '   address public journal;'
  + '   address public vault;'
  + '   address public coin;'
  + '   address public creator;'
  + '   address public judge;'
  + '   address public worker;'
  + '   int public state;'
  + '   uint public amount;'
  + '   int public dealId;'
  + '   function initialize(address j, address v, address c, address owner, address arbiter, uint value) {'
  + '     this.journal = j; this.vault = v; this.coin = c; this.creator = owner; this.judge = arbiter;'
  + '     this.amount = value;'
  + '   }'
  + '   function open(int id) {'
  + '     require(msg.sender == this.creator);'
  + '     Note memory opened = Note(0, abi.encodePacked(msg.sender), abi.encodePacked(id), 0);'
  + '     IJournal(this.journal).post(id, opened);'
  + '   }'
  + '   function take(int id, bytes signature) {'
  + '     require(IJournal(this.journal).isMember(msg.sender));'
  + '     require(msg.sender != this.creator);'
  + '     require(msg.sender != this.judge);'
  + '     int count = IJournal(this.journal).noteCount(id);'
  + '     require(this.state == 0);'
  + `     bytes32 digest = keccak256(bytes.concat(hex"${binToHex(PREFIX)}", keccak256(abi.encode(count, id))));`
  + '     bytes32 r = bytes32(signature.slice(0, 32));'
  + '     bytes32 s = bytes32(signature.slice(32, 64));'
  + '     int v = int(signature.slice(64, 65));'
  + '     require(ecrecoverP2pkh(digest, v, r, s) == msg.sender);'
  + '     Note memory signed = Note(1, abi.encodePacked(msg.sender), abi.encodePacked(count, signature), 0);'
  + '     IJournal(this.journal).post(id, signed);'
  + '     this.state = 1;'
  + '     this.worker = msg.sender;'
  + `     ICoin(this.coin).approve(this.vault, ${MAX});`
  + '     Terms memory terms = Terms(address(this), msg.sender, 0, this.coin, 86400, this.amount, "job");'
  + '     int fee = IJournal(this.journal).feeOf(this.judge);'
  + '     int got = IVault(this.vault).pay(address(this), terms, this.judge, fee);'
  + '     this.dealId = got;'
  + '     Note memory taken = Note(2, abi.encodePacked(msg.sender), abi.encodePacked(got), 0);'
  + '     IJournal(this.journal).post(id, taken);'
  + '   }'
  + '   function payStart(int id, address w) payable {'
  + '     require(msg.sender == this.creator);'
  + '     require(this.state == 0);'
  + '     require(IJournal(this.journal).isMember(w));'
  + '     require(w != this.creator);'
  + '     require(w != this.judge);'
  + '     this.state = 1;'
  + '     this.worker = w;'
  + `     ICoin(this.coin).approve(this.vault, ${MAX});`
  + '     Terms memory terms = Terms(address(this), w, 0, this.coin, 86400, this.amount, "job");'
  + '     int fee = IJournal(this.journal).feeOf(this.judge);'
  + '     int got = IVault(this.vault).pay(address(this), terms, this.judge, fee);'
  + '     this.dealId = got;'
  + '     Note memory paid = Note(3, abi.encodePacked(w), abi.encodePacked(got), 0);'
  + '     IJournal(this.journal).post(id, paid);'
  + '   }'
  + ' }';

/** The five contracts. */
interface Compiled {
  readonly journal: Artifact;
  readonly coin: Artifact;
  readonly panel: Artifact;
  readonly vault: Artifact;
  readonly desk: Artifact;
}

let compiledRun: Compiled | undefined;
/** The five contracts, compiled once and only when the file runs. */
function compiled(): Compiled {
  if (compiledRun === undefined) {
    const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
    compiledRun = {
      journal: artifacts.Journal!, coin: artifacts.Coin!, panel: artifacts.Panel!, vault: artifacts.Vault!,
      desk: artifacts.Desk!,
    };
  }
  return compiledRun;
}

/** A little-endian word from the big-endian hex a signer returns. */
const leBytes = (hex: string): Uint8Array => hexToBin(hex.replace(/^0x/, '')).slice().reverse();

/** The worker: a key whose recovery pair splits within the side-cars' budget, its lock and its 65-byte signature. */
interface Worker {
  readonly key: Uint8Array;
  readonly lock: Uint8Array;
  readonly signature: Uint8Array;
}

let workerRun: Worker | undefined;
/**
 * Signs the digest `take` hashes, `keccak256(PREFIX || keccak256(abi.encode(count, id)))`, with deterministic keys
 * until the shipped split probe accepts one; `abi.encode` is each value's pushdata encoding.
 */
function splittableWorker(): Worker {
  if (workerRun !== undefined) return workerRun;
  const encoded = Uint8Array.from([
    ...encodePushdataValue(NOTES_BEFORE, 'bigint'), ...encodePushdataValue(JOB, 'bigint'),
  ]);
  const digest = keccak_256(Uint8Array.from([...PREFIX, ...keccak_256(encoded)]));
  const probeUtxo = (odd: boolean): never => ({
    txid: id32(odd ? 'b1' : 'a1'), vout: 1, satoshis: 100_000n,
    token: { category: id32('e1'), amount: 0n, nft: { capability: 'mutable', commitment: '' } },
  }) as never;
  for (let seed = 0; seed < 50; seed += 1) {
    const key = keccak_256(new TextEncoder().encode(`fan-in worker ${seed}`));
    const { r, s, v } = new ethers.Wallet(`0x${binToHex(key)}`).signingKey
      .sign(`0x${binToHex(digest.slice().reverse())}`);
    try {
      probeEcrecoverSplit(computeEcrecoverWitness(digest, v, leBytes(r), leBytes(s)), SHARED_LIBRARY_SALT,
        probeUtxo(false), probeUtxo(true));
    } catch {
      continue;
    }
    const pub = secp256k1.derivePublicKeyCompressed(key) as Uint8Array;
    workerRun = {
      key, lock: encodeLockingBytecodeP2pkh(hash160(pub)), signature: Uint8Array.from([...leBytes(r), ...leBytes(s), v]),
    };
    return workerRun;
  }
  throw new Error('no worker signature with a two-covenant split after 50 keys');
}

/** A coin a genesis or a hop is funded from; a genesis mints its txid as the category. */
function funding(txid: string): Utxo {
  return { txid, vout: 0, satoshis: 5_000_000n };
}

/** One deployment of the five contracts, and what a flow enters it with. */
interface Deployed {
  readonly network: MockNetworkProvider;
  readonly deskProxyCategoryId: string;
  readonly deskImplementationCategoryId: string;
  readonly externals: Readonly<Record<string, FramedProxyExternal>>;
  readonly creatorLock: Uint8Array;
  readonly creatorFunder: Unlocker;
  readonly changeAddress: string;
}

/** A mock network holding every genesis coin and the creator's hop coins, and the unlockers that spend them. */
interface Funded {
  readonly network: MockNetworkProvider;
  readonly funder: Unlocker;
  readonly creatorFunder: Unlocker;
  readonly creatorLock: Uint8Array;
  readonly changeAddress: string;
  readonly hopCoins: readonly Utxo[];
}

/** Funds every genesis and four creator hops on a fresh network. */
async function fundedNetwork(): Promise<Funded> {
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const source = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const creatorLock = encodeLockingBytecodeP2pkh(alicePkh);
  const categories = [
    JOURNAL_IMPL_CATEGORY, JOURNAL_PROXY_CATEGORY, DESK_IMPL_CATEGORY, DESK_PROXY_CATEGORY,
    COIN_CATEGORY, VAULT_CATEGORY, PANEL_CATEGORY,
  ];
  for (const category of categories) await network.addUtxo(source.address, funding(category));
  const hopCoins = ['5a', '5b', '5c', '5d'].map((lead) => funding(id32(lead)));
  for (const utxo of hopCoins) await network.addUtxo(binToHex(creatorLock), utxo);
  await fundShippedFacets(network);
  return {
    network,
    funder: source.unlock.spend(alicePub, signature),
    creatorFunder: signature.unlockP2PKH(),
    creatorLock,
    changeAddress: source.address,
    hopCoins,
  };
}

/**
 * Deploys the token, the arbitrator and the escrow plain, the store and the root behind generated proxies, then
 * registers the arbitrator's fee and opens the job with one note. Every setup hop settles and broadcasts.
 */
async function deployFanIn(worker: Worker): Promise<Deployed> {
  const { journal, coin, panel, vault, desk } = compiled();
  const { network, funder, creatorFunder, creatorLock, changeAddress, hopCoins } = await fundedNetwork();
  const [journalInit, deskInit, enlistCoin, openCoin] = hopCoins;
  const judgeLock = encodeLockingBytecodeP2pkh(bobPkh);

  // The root holds the supply, and each plain contract names its peer by the address its category fixes.
  const deskAddress = addressOf(DESK_PROXY_CATEGORY);
  const plain: readonly (readonly [Artifact, string, Uint8Array, ...bigint[]])[] = [
    [coin, COIN_CATEGORY, deskAddress, SUPPLY],
    [panel, PANEL_CATEGORY, addressOf(VAULT_CATEGORY)],
    [vault, VAULT_CATEGORY, addressOf(PANEL_CATEGORY)],
  ];
  for (const [artifact, category, ...args] of plain) {
    await deployStatefulContract(artifact, args, {
      fundingUtxo: funding(category), funder, changeAddress, provider: network,
    });
  }

  const journalDeployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: journal,
    proxyArtifact: buildProxyArtifact(journal),
    implementationDeploy: { fundingUtxo: funding(JOURNAL_IMPL_CATEGORY), funder, changeAddress },
    proxyDeploy: { fundingUtxo: funding(JOURNAL_PROXY_CATEGORY), funder, changeAddress },
    initialize: { functionName: 'initialize', args: [deskAddress, worker.lock, worker.lock.slice(3, 23)] },
    callerLockingBytecode: creatorLock,
    callerFunding: { utxo: journalInit!, funder: creatorFunder, changeAddress },
    vm: compositionMachine(),
  });
  expect(journalDeployment.initialize.broadcast).toBeDefined();

  const deskDeployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: desk,
    proxyArtifact: buildProxyArtifact(desk),
    implementationDeploy: { fundingUtxo: funding(DESK_IMPL_CATEGORY), funder, changeAddress },
    proxyDeploy: { fundingUtxo: funding(DESK_PROXY_CATEGORY), funder, changeAddress },
    initialize: {
      functionName: 'initialize',
      args: [
        journalDeployment.proxy.address, addressOf(VAULT_CATEGORY), addressOf(COIN_CATEGORY), creatorLock, judgeLock,
        AMOUNT,
      ],
    },
    callerLockingBytecode: creatorLock,
    callerFunding: { utxo: deskInit!, funder: creatorFunder, changeAddress },
    vm: compositionMachine(),
  });
  expect(deskDeployment.initialize.broadcast).toBeDefined();
  expect(binToHex(deskDeployment.proxy.address)).toBe(binToHex(deskAddress));

  const journalExternal: FramedProxyExternal = {
    artifact: journal,
    categoryId: journalDeployment.proxy.categoryId,
    proxyArtifact: buildProxyArtifact(journal),
    implementationCategoryId: journalDeployment.implementation.categoryId,
  };

  // The arbitrator's fee is its own hop, as when a proxied initialize writing two collections stopped at its
  // broadcast; that initialize settles now (pinned below).
  const enlisted = await callFramedProxyEntry({
    provider: network,
    implementationArtifact: journal,
    proxyArtifact: buildProxyArtifact(journal),
    proxyCategoryId: journalDeployment.proxy.categoryId,
    implementationCategoryId: journalDeployment.implementation.categoryId,
    functionName: 'enlist',
    args: [judgeLock, judgeLock.slice(3, 23), FEE],
    callerUtxo: enlistCoin!,
    callerLockingBytecode: creatorLock,
    funder: creatorFunder,
    changeAddress,
    vm: compositionMachine(),
  });
  expect(enlisted.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);

  // The job is opened with one note, as a posted job holds its creation event before it is taken.
  const opened = await callFramedProxyEntry({
    provider: network,
    implementationArtifact: desk,
    proxyArtifact: buildProxyArtifact(desk),
    proxyCategoryId: deskDeployment.proxy.categoryId,
    implementationCategoryId: deskDeployment.implementation.categoryId,
    functionName: 'open',
    args: [JOB],
    externals: { IJournal: journalExternal },
    callerUtxo: openCoin!,
    callerLockingBytecode: creatorLock,
    funder: creatorFunder,
    changeAddress,
    vm: compositionMachine(),
  });
  expect(opened.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);

  return {
    network,
    deskProxyCategoryId: deskDeployment.proxy.categoryId,
    deskImplementationCategoryId: deskDeployment.implementation.categoryId,
    externals: {
      IJournal: journalExternal,
      ICoin: { artifact: coin, categoryId: COIN_CATEGORY },
      IVault: { artifact: vault, categoryId: VAULT_CATEGORY },
      IPanel: { artifact: panel, categoryId: PANEL_CATEGORY },
    },
    creatorLock,
    creatorFunder,
    changeAddress,
  };
}

/** Enters one of the root's entries through its proxy, from a coin funded at the caller's lock. */
async function enterDesk(
  deployed: Deployed, functionName: string, args: readonly (bigint | Uint8Array)[],
  caller: { readonly lock: Uint8Array; readonly funder: Unlocker; readonly coin: Utxo },
): Promise<FramedProxyCallResult> {
  const { desk } = compiled();
  await deployed.network.addUtxo(binToHex(caller.lock), caller.coin);
  return callFramedProxyEntry({
    provider: deployed.network,
    implementationArtifact: desk,
    proxyArtifact: buildProxyArtifact(desk),
    proxyCategoryId: deployed.deskProxyCategoryId,
    implementationCategoryId: deployed.deskImplementationCategoryId,
    functionName,
    args,
    externals: deployed.externals,
    callerUtxo: caller.coin,
    callerLockingBytecode: caller.lock,
    funder: caller.funder,
    changeAddress: deployed.changeAddress,
    vm: compositionMachine(),
  });
}

/** The interface and method of each call site an entry publishes, in execution order. */
function publishedSites(artifact: Artifact, functionName: string): readonly string[] {
  const row = artifact.abi.find((entry) => entry.name === functionName) as unknown as {
    readonly externalCalls?: readonly { readonly interfaceName: string; readonly functionName: string }[];
  };
  return (row.externalCalls ?? []).map((call) => `${call.interfaceName}.${call.functionName}`);
}

describe.runIf(process.env.FRAMED_AHEAD === '1')('the fan-in shape through the shipped hop (MS3)', () => {
  it('compiles every entry and publishes the calls each flow makes, in order', () => {
    const { journal, coin, panel, vault, desk } = compiled();
    for (const artifact of [journal, coin, panel, vault, desk]) {
      expect(artifact.composition?.convention).toBe('framed');
      expect(artifact.composition!.refusedEntries ?? []).toStrictEqual([]);
    }
    expect(publishedSites(desk, 'take')).toStrictEqual([
      'IJournal.isMember', 'IJournal.noteCount', 'IJournal.post', 'ICoin.approve', 'IJournal.feeOf', 'IVault.pay',
      'IJournal.post',
    ]);
    expect(publishedSites(desk, 'payStart')).toStrictEqual([
      'IJournal.isMember', 'ICoin.approve', 'IJournal.feeOf', 'IVault.pay', 'IJournal.post',
    ]);
    expect(publishedSites(vault, 'pay')).toStrictEqual([
      'ICoin.balanceOf', 'ICoin.transferFrom', 'ICoin.balanceOf', 'IPanel.appoint',
    ]);
  });

  it('setup: a store initialize that inserts into two collections settles and registers both', async () => {
    const { journal } = compiled();
    const { network, funder, creatorFunder, creatorLock, changeAddress, hopCoins } = await fundedNetwork();
    const judgeLock = encodeLockingBytecodeP2pkh(bobPkh);
    const deployed = await deployFramedProxy({
      provider: network,
      implementationArtifact: journal,
      proxyArtifact: buildProxyArtifact(journal),
      implementationDeploy: { fundingUtxo: funding(JOURNAL_IMPL_CATEGORY), funder, changeAddress },
      proxyDeploy: { fundingUtxo: funding(JOURNAL_PROXY_CATEGORY), funder, changeAddress },
      initialize: {
        functionName: 'setUp',
        args: [
          addressOf(DESK_PROXY_CATEGORY), creatorLock, creatorLock.slice(3, 23), judgeLock, judgeLock.slice(3, 23), FEE,
        ],
      },
      callerLockingBytecode: creatorLock,
      callerFunding: { utxo: hopCoins[0]!, funder: creatorFunder, changeAddress },
      vm: compositionMachine(),
    });

    // One insert into each of two collections, which spent one empty head twice at the broadcast until the hop
    // looked each head up at its own collection's lock (225b23731).
    expect(deployed.initialize.broadcast).toBeDefined();
    const read = (functionName: string, who: Uint8Array): Promise<unknown> => readFramedEntry({
      provider: network, artifact: journal, categoryId: deployed.proxy.categoryId, functionName, args: [who],
      vm: compositionMachine(),
    }).then((answer) => answer.value);
    expect([await read('isMember', creatorLock), await read('feeOf', judgeLock)]).toStrictEqual([true, FEE]);
  });

  /**
   * The token fan-in and the two posts into one job's notes settle together.
   *
   * The root's `approve` inserts the allowance key and the escrow's `transferFrom` continues that node. The hop
   * settles `approve` before every later frame of the token, and a stopped plan settles it with the producers that
   * follow it (`proxy/reentry.ts`), so `transferFrom` reads the allowance `approve` wrote rather than the candidate
   * the plan started from. `take` posts to the job's notes twice, and `notes[id]` is a `Note[]` whose values chunk:
   * the second post continues the node the first left, so the settled hop chains that node like any other shared one
   * and both posts land (a long value written by several frames, spec section 20).
   */

  /** The number of notes one job holds, read back through the shipped read path. */
  async function noteCountOf(deployed: Deployed, id: bigint): Promise<bigint> {
    const answered = await readFramedEntry({
      provider: deployed.network, artifact: compiled().journal,
      categoryId: deployed.externals.IJournal!.categoryId, functionName: 'noteCount', args: [id],
      vm: compositionMachine(),
    });
    expect(answered.accepted, answered.objection).toBe(true);
    return answered.value as bigint;
  }

  /** The token's balance node values for each named holder, read back from the chain. */
  async function coinBalances(
    deployed: Deployed, holders: Readonly<Record<string, Uint8Array>>,
  ): Promise<Record<string, readonly string[]>> {
    const deployment = await readFramedDeployment(deployed.network, COIN_CATEGORY, compiled().coin.stateLayout!);
    const nodes = (deployment.nodesByCollection.get('balances') ?? [])
      .map((utxo) => decodeEntryCommitment(hexToBin(utxo.token!.nft!.commitment)));
    return Object.fromEntries(Object.entries(holders).map(([name, holder]) => {
      const slot = bytesToHex(keyToSlotMulti([holder]));
      return [name, nodes.filter((node) => bytesToHex(node.slot) === slot).map((node) => bytesToHex(node.value))];
    }));
  }

  it('take: learns the count, the fee and the deal in execution order, and settles both posts', async () => {
    const worker = splittableWorker();
    const deployed = await deployFanIn(worker);
    const coin = funding(id32('6a'));
    const result = await enterDesk(deployed, 'take', [JOB, worker.signature], {
      lock: worker.lock, funder: new SignatureTemplate(worker.key).unlockP2PKH(), coin,
    });

    // The post's note carries `noteCount`'s result, `pay` carries `feeOf`'s and the last post carries `pay`'s, so
    // the hop plans in execution order (`FRAMED_HOP_TRACE=1`: `stop-plan` three times, `learned=[|1:1]`,
    // `learned=[|4:250]`, then `learned=[|5:0]`). The token fan-in settles inside `pay`, and the second post to one
    // job's notes continues the node the first left, so the entry settles and both notes land.
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(await noteCountOf(deployed, JOB)).toBe(NOTES_BEFORE + 2n);
  });

  it('pay start: learns the fee in execution order, and settles the token fan-in', async () => {
    const worker = splittableWorker();
    const deployed = await deployFanIn(worker);
    const coin = funding(id32('6b'));
    const result = await enterDesk(deployed, 'payStart', [JOB, worker.lock], {
      lock: deployed.creatorLock, funder: deployed.creatorFunder, coin,
    });

    // `pay` takes the fee `feeOf` returned, so the hop stops before it, settles the fee read's frames and plans on
    // from the fee (`learned=[|2:250]`). `transferFrom` reads the allowance the root's `approve` wrote, the escrow
    // pulls the amount, and the root keeps the deal id `pay` returned.
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(await coinBalances(deployed, {
      desk: addressOf(DESK_PROXY_CATEGORY), vault: addressOf(VAULT_CATEGORY),
    })).toStrictEqual({
      desk: [bytesToHex(bigIntToVmNumber(SUPPLY - AMOUNT))], vault: [bytesToHex(bigIntToVmNumber(AMOUNT))],
    });
    const layout = buildProxyArtifact(compiled().desk).stateLayout!;
    const desk = deploymentStateValues(layout, deployed.deskProxyCategoryId,
      await readFramedDeployment(deployed.network, deployed.deskProxyCategoryId, layout));
    expect([desk.state, desk.dealId]).toStrictEqual([1n, 0n]);
  });
});
