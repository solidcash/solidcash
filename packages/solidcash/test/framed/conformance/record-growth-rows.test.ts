import { describe, expect, it } from 'vitest';
import { bigIntToVmNumber, binToHex, encodeLockingBytecodeP2pkh, hexToBin, utf8ToBin } from '@bitauth/libauth';
import {
  bytesToHex, encodeChunkableValueTail, encodeEventCommitment, parsePushdataCommitment, sha256,
} from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { bytesToSlotValue, decodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import { eventLockingBytecode, readFramedDeployment } from '../../../src/framed/deploy/index.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import { buildProxyArtifact, deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { callFramedProxyEntry, type FramedProxyCallResult } from '../../../src/framed/proxy/deploy.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * S0 conformance, spec section 23 row 23: records growing within one transaction and across 30 transactions.
 *
 * Within one transaction: `Journal.initialize` inserts eight tags into an empty `string => string` mapping in one
 * frame, the row's eight-tag seeding (spec 20: a batch's inserts into one gap share their predecessor). The
 * deployment's own proxied initialize settles it, and the list it leaves is the head and eight nodes linked in
 * ascending slot order, each holding its tag's value.
 *
 * Across thirty transactions, the row's thirty events for one id and its registrations: `log` appends to one id's
 * array, whose whole value each append rewrites, and emits an event, and `register` inserts a member's node; each
 * runs once per transaction through the shipped proxy hop. The log's length and its elements read back through the
 * shipped read path, each transaction's event is the payload it emitted, and the member list grows by one linked
 * node per registration. A second registration of a held key is refused with the entry's own reason, and the
 * provider sees no transaction. Six transactions run by default: the log's run grows into its second chunk and the
 * registrations insert into an empty list, before its first node, after its last and between two. The row's thirty
 * run under `FRAMED_FULL=1`.
 */

/** A 32-byte category or txid with varied bytes, taken from its label. */
function idOf(label: string): string {
  return bytesToHex(sha256(utf8ToBin(`record growth rows ${label}`)));
}

const IMPL_CATEGORY = idOf('implementation');
const PROXY_CATEGORY = idOf('proxy');
const USER_LOCK = encodeLockingBytecodeP2pkh(alicePkh);

/** The eight tags one initialize inserts. */
const TAGS: readonly (readonly [string, string])[] = [
  ['AU', 'AUDIO'], ['VI', 'VIDEO'], ['TX', 'TEXT'], ['SW', 'SOFTWARE'],
  ['MAP', 'MAPS_AND_PLACES'], ['GDS', 'PHYSICAL_GOODS'], ['SVC', 'SERVICES_IN_PERSON'], ['OTH', 'OTHER'],
];
/** The transactions the growth runs over, one entry each: the row's thirty at milestones. */
const TRANSACTIONS = process.env.FRAMED_FULL === '1' ? 30 : 6;
/** The id every append writes. */
const LOG_ID = 7n;
/** The members' keys, distinct and spread over the slot space. */
const MEMBERS = Array.from({ length: TRANSACTIONS }, (_unused, index) => BigInt(100 + index * 37));

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Journal {'
  + '   address public implementation;'
  + '   int public logged;'
  + '   mapping(string => string) tags;'
  + '   mapping(int => int[]) logs;'
  + '   mapping(int => int) members;'
  + '   event Logged(int id, int kind);'
  + `   function initialize() { ${TAGS.map(([key, value]) => `this.tags["${key}"] = "${value}";`).join(' ')} }`
  + '   function log(int id, int kind) {'
  + '     this.logs[id].push(kind); this.logged = this.logged + 1; emit Logged(id, kind);'
  + '   }'
  + '   function register(int who) { require(this.members[who] == 0, "already registered"); this.members[who] = 1; }'
  + '   function count(int id) view returns (int) { return this.logs[id].length; }'
  + '   function kindAt(int id, int index) view returns (int) { return this.logs[id][index]; }'
  + ' }';

const journal = compileStringMulti(SOURCE, { composition: 'framed' }).Journal!;
const journalProxy = buildProxyArtifact(journal);
const encoder = new TextEncoder();

/** A coin a genesis or a call is funded from; a genesis's txid becomes the category it mints. */
function funding(txid: string): { txid: string; vout: number; satoshis: bigint } {
  return { txid, vout: 0, satoshis: 5_000_000n };
}

/** The journal behind its proxy, its initialize broadcast, and the chain as it stood once both were done. */
interface Deployed {
  readonly network: MockNetworkProvider;
  readonly proxyCategoryId: string;
  readonly implementationCategoryId: string;
  readonly changeAddress: string;
  readonly initializeAccepted: boolean;
  readonly snapshot: SnapshotRestorer;
}

let deployedRun: Promise<Deployed> | undefined;

/** One deployment serves every case; each rewinds the chain to it first, so none reads another's broadcast. */
async function deployed(): Promise<Deployed> {
  deployedRun ??= (async (): Promise<Deployed> => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const signature = new SignatureTemplate(alicePriv);
    const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
    const funder = wallet.unlock.spend(alicePub, signature);
    await fundShippedFacets(network);
    for (const txid of [IMPL_CATEGORY, PROXY_CATEGORY]) await network.addUtxo(wallet.address, funding(txid));
    const initCoin = funding(idOf('initialize coin'));
    await network.addUtxo(binToHex(USER_LOCK), initCoin);
    const deployment = await deployFramedProxy({
      provider: network,
      implementationArtifact: journal,
      proxyArtifact: journalProxy,
      implementationDeploy: { fundingUtxo: funding(IMPL_CATEGORY), funder, changeAddress: wallet.address },
      proxyDeploy: { fundingUtxo: funding(PROXY_CATEGORY), funder, changeAddress: wallet.address },
      initialize: { functionName: 'initialize', args: [] },
      callerLockingBytecode: USER_LOCK,
      callerFunding: { utxo: initCoin, funder: signature.unlockP2PKH(), changeAddress: wallet.address },
      vm: compositionMachine(),
    });
    expect(deployment.initialize.broadcast).toBeDefined();
    return {
      network,
      proxyCategoryId: deployment.proxy.categoryId,
      implementationCategoryId: deployment.implementation.categoryId,
      changeAddress: wallet.address,
      initializeAccepted: deployment.initialize.accepted,
      snapshot: await network.takeSnapshot(),
    };
  })();
  const shared = await deployedRun;
  await shared.snapshot.restore();
  return shared;
}

interface Entered {
  readonly coin: { txid: string; vout: number; satoshis: bigint };
  readonly call: Promise<FramedProxyCallResult>;
}

/** Funds a coin of the user's and runs one journal entry through the shipped proxy hop. */
async function enter(run: Deployed, functionName: string, args: readonly bigint[], label: string): Promise<Entered> {
  const coin = funding(idOf(`${functionName} coin ${label}`));
  await run.network.addUtxo(binToHex(USER_LOCK), coin);
  const call = callFramedProxyEntry({
    provider: run.network,
    implementationArtifact: journal,
    proxyArtifact: journalProxy,
    proxyCategoryId: run.proxyCategoryId,
    implementationCategoryId: run.implementationCategoryId,
    functionName,
    args: [...args],
    callerUtxo: coin,
    callerLockingBytecode: USER_LOCK,
    funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
    changeAddress: run.changeAddress,
    vm: compositionMachine(),
  });
  return { coin, call };
}

/** A read of the journal through the shipped read path, over its proxy's live records. */
async function read(run: Deployed, functionName: string, args: readonly bigint[]): Promise<unknown> {
  const answered = await readFramedEntry({
    provider: run.network, artifact: journal, categoryId: run.proxyCategoryId, functionName, args: [...args],
    vm: compositionMachine(),
  });
  expect(answered.accepted, answered.objection).toBe(true);
  return answered.value;
}

/** One collection's nodes as the deployment holds them, decoded, in the order their links walk from the head. */
async function linkedNodes(run: Deployed, collection: string): Promise<{
  readonly walked: readonly { readonly slot: string; readonly value: string }[];
  readonly held: number;
}> {
  const pools = await readFramedDeployment(run.network, run.proxyCategoryId, journal.stateLayout!);
  const nodes = (pools.nodesByCollection.get(collection) ?? [])
    .map((utxo) => decodeEntryCommitment(hexToBin(utxo.token!.nft!.commitment)));
  const bySlot = new Map(nodes.map((node) => [bytesToHex(node.slot), node]));
  const walked: { slot: string; value: string }[] = [];
  let next = bySlot.get(bytesToHex(new Uint8Array(32)))?.nextKey;
  while (next !== undefined && bytesToSlotValue(next) !== 0n && walked.length <= nodes.length) {
    const node = bySlot.get(bytesToHex(next));
    if (node === undefined) break;
    walked.push({ slot: bytesToHex(node.slot), value: bytesToHex(node.value) });
    next = node.nextKey;
  }
  return { walked, held: nodes.length };
}

/** True when each slot sits above the one before it, as the list's own links must order them. */
function ascending(slots: readonly string[]): boolean {
  return slots.every((slot, index) =>
    index === 0 || bytesToSlotValue(hexToBin(slot)) > bytesToSlotValue(hexToBin(slots[index - 1]!)));
}

describe('spec section 23 row 23: records growing within one transaction and across 30 transactions', () => {
  it('inserts eight tags in one initialize frame, the list linked in slot order with each tag\'s value', async () => {
    const run = await deployed();
    expect(run.initializeAccepted).toBe(true);
    const { walked, held } = await linkedNodes(run, 'tags');
    // The head and one node per tag, every node reached from the head.
    expect(held).toBe(TAGS.length + 1);
    expect(walked).toHaveLength(TAGS.length);
    expect(ascending(walked.map((node) => node.slot))).toBe(true);
    const valueOf = new Map(walked.map((node) => [node.slot, node.value]));
    for (const [key, value] of TAGS) {
      const slot = bytesToHex(keyToSlotMulti([encoder.encode(key)]));
      expect(valueOf.get(slot)).toBe(bytesToHex(encodeChunkableValueTail(encoder.encode(value))));
    }
  });

  it(`appends to one log across ${TRANSACTIONS} transactions, each emitting its own event`, async () => {
    const run = await deployed();
    const event = journal.events!.find((definition) => definition.name === 'Logged')!;
    // A delegate frame emits under the contract it runs on: the proxy's category names the event's covenant.
    const eventLock = bytesToHex(eventLockingBytecode(hexToBin(run.proxyCategoryId), event.signature, false));
    for (let turn = 1; turn <= TRANSACTIONS; turn += 1) {
      const result = await (await enter(run, 'log', [LOG_ID, BigInt(turn)], `${turn}`)).call;
      expect(result.accepted).toBe(true);
      expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
      const payload = encodeEventCommitment(event.parameters, [LOG_ID, BigInt(turn)]);
      expect(result.writtenEventCommitments.map(bytesToHex)).toStrictEqual([bytesToHex(payload)]);
      expect(result.transaction.outputs.filter((output) => output.token?.nft?.commitment !== undefined
        && bytesToHex(output.token.nft.commitment) === bytesToHex(payload))
        .map((output) => bytesToHex(output.lockingBytecode))).toStrictEqual([eventLock]);
    }
    expect((await readFramedDeployment(run.network, run.proxyCategoryId, journalProxy.stateLayout!)).records
      .map((record, nftIndex) => parsePushdataCommitment(record.token!.nft!.commitment, journalProxy.stateLayout!,
        nftIndex)).find((fields) => 'logged' in fields)?.logged).toBe(BigInt(TRANSACTIONS));
    // The whole array, as the last append left it: its length and its first, middle and last elements.
    expect(await read(run, 'count', [LOG_ID])).toBe(BigInt(TRANSACTIONS));
    for (const index of [0, TRANSACTIONS / 2, TRANSACTIONS - 1]) {
      expect(await read(run, 'kindAt', [LOG_ID, BigInt(index)])).toBe(BigInt(index + 1));
    }
  }, 120_000);

  it(`registers ${TRANSACTIONS} members across as many transactions, one linked node each`, async () => {
    const run = await deployed();
    for (const [index, member] of MEMBERS.entries()) {
      const result = await (await enter(run, 'register', [member], `${index}`)).call;
      expect(result.accepted).toBe(true);
      expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    }
    const { walked, held } = await linkedNodes(run, 'members');
    expect(held).toBe(TRANSACTIONS + 1);
    expect(walked).toHaveLength(TRANSACTIONS);
    expect(ascending(walked.map((node) => node.slot))).toBe(true);
    expect(new Set(walked.map((node) => node.slot))).toStrictEqual(
      new Set(MEMBERS.map((member) => bytesToHex(keyToSlotMulti([bigIntToVmNumber(member)])))),
    );
    expect(new Set(walked.map((node) => node.value))).toStrictEqual(new Set([bytesToHex(bigIntToVmNumber(1n))]));

    // A second registration of a held key reverts with the entry's own reason, and nothing is broadcast.
    const tip = run.network.indexer.getTip()?.height;
    const again = await enter(run, 'register', [MEMBERS[0]!], 'again');
    await expect(again.call).rejects.toThrow(
      /the implementation's "register" entry did not settle through the proxy: .*already registered/,
    );
    expect(run.network.indexer.getTip()?.height).toBe(tip);
    expect((await run.network.getUtxosForLockingBytecode(USER_LOCK))
      .some((utxo) => utxo.txid === again.coin.txid && utxo.vout === again.coin.vout)).toBe(true);
    expect((await linkedNodes(run, 'members')).held).toBe(TRANSACTIONS + 1);
  }, 120_000);
});
