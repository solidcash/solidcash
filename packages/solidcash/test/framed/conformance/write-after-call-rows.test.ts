import { describe, expect, it } from 'vitest';
import { bigIntToVmNumber, binToHex, encodeLockingBytecodeP2pkh, hexToBin, utf8ToBin } from '@bitauth/libauth';
import {
  bytesToHex, parsePushdataCommitment, sha256, type Artifact, type RecordEntry,
} from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { decodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import { deployMaster, readFramedDeployment } from '../../../src/framed/deploy/index.js';
import { callFramedEntry } from '../../../src/framed/call/index.js';
import { buildProxyArtifact, deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { callFramedProxyEntry, type FramedProxyCallResult } from '../../../src/framed/proxy/deploy.js';
import type { FramedProxyExternal } from '../../../src/framed/proxy/external-calls.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * S0 conformance, spec section 23 row 15: writes after an external call.
 *
 * `Broker.open` counts the opening, calls `Escrow.fund`, and then writes the shapes the row names: an amount owed, the
 * escrow id the call returned, and a mapping entry keyed by the order. The escrow in turn pulls the amount from a
 * coin and only then writes its own storage, `held[id]`. A call closes the segment the code before it runs in (W2),
 * so each frame's writes land on the side of its call the source puts them: the broker's opening count transitions
 * in its first segment and is kept in the second, the writes after the call are kept in the first and transition in
 * the second, the mapping node the broker creates is declared in the second only, and so is the node the escrow
 * creates after its own call. The broadcast leaves every one of them on chain, read back through the shipped
 * decoders. A check after the writes and a revert in the nested coin are each refused with their own reason, and
 * the provider sees no transaction.
 *
 * The escrow that also advances its own counter after its call (`fundNext`, keying its storage by the counter) writes
 * the callee's own data record, and it is served: the record is declared in both segments its call splits the frame
 * into - kept at the commitment the chain holds before the call, written after it - and the value the frame's close
 * computed is the one the transaction carries. The plain call path on the broker implementation's own deployment,
 * whose records hold no escrow, refuses the entry by name.
 */

/** A 32-byte category or txid with varied bytes, taken from its label. */
function idOf(label: string): string {
  return bytesToHex(sha256(utf8ToBin(`write after call rows ${label}`)));
}

const COIN_CATEGORY = idOf('coin');
const ESCROW_CATEGORY = idOf('escrow');
const BROKER_IMPL_CATEGORY = idOf('broker implementation');
const BROKER_PROXY_CATEGORY = idOf('broker proxy');
const USER_LOCK = encodeLockingBytecodeP2pkh(alicePkh);

const ORDER_ID = 4n;
const AMOUNT = 40n;
const ESCROW_BASE = 1000n;
/** A created record's input index: the record has no input, the transaction makes it. */
const CREATED = 0xffff;

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' struct Counter { int value; }'
  + ' interface ICoin { function pull(int amount) returns (bool); }'
  + ' interface IEscrow { function fund(int id, int amount) returns (int); function fundNext(int amount) returns (int); }'
  + ' contract Coin {'
  + '   int public cap;'
  + '   constructor() { this.cap = 500; }'
  + '   function pull(int amount) returns (bool) { require(amount <= this.cap, "over the coin cap"); return true; }'
  + ' }'
  + ' contract Escrow {'
  + '   Counter public ids;'
  + '   int public base;'
  + '   address public coin;'
  + '   mapping(int => int) public held;'
  + `   constructor(address c) { this.base = ${ESCROW_BASE}; this.coin = c; }`
  + '   function fund(int id, int amount) returns (int) {'
  + '     require(amount > 0, "empty escrow");'
  + '     require(ICoin(this.coin).pull(amount), "pull failed");'
  + '     this.held[id] = amount;'
  + '     return this.base + id;'
  + '   }'
  + '   function fundNext(int amount) returns (int) {'
  + '     int id = this.ids.value;'
  + '     require(ICoin(this.coin).pull(amount), "pull failed");'
  + '     this.held[id] = amount;'
  + '     this.ids.value = id + 1;'
  + '     return this.base + id;'
  + '   }'
  + ' }'
  + ' contract Broker {'
  + '   address public implementation;'
  + '   address public escrow;'
  + '   int public opened;'
  + '   int public owed;'
  + '   int public lastEscrow;'
  + '   mapping(int => int) public escrowOf;'
  + '   function initialize(address e) { this.escrow = e; require(true); }'
  + '   function open(int orderId, int amount) {'
  + '     this.opened = this.opened + 1;'
  + '     int escrowId = IEscrow(this.escrow).fund(orderId, amount);'
  + '     this.owed = this.owed + amount;'
  + '     this.lastEscrow = escrowId;'
  + '     this.escrowOf[orderId] = escrowId;'
  + '     require(this.owed <= 100, "owed over the cap");'
  + '   }'
  + '   function openNext(int amount) { this.lastEscrow = IEscrow(this.escrow).fundNext(amount); }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const coin = artifacts.Coin!;
const escrow = artifacts.Escrow!;
const broker = artifacts.Broker!;
const brokerProxy = buildProxyArtifact(broker);

/** A coin a genesis or a call is funded from; a genesis's txid becomes the category it mints. */
function funding(txid: string): { txid: string; vout: number; satoshis: bigint } {
  return { txid, vout: 0, satoshis: 500_000n };
}

/** The coin and the escrow, then the broker behind its proxy, and the chain as it stood when all were done. */
interface Deployed {
  readonly network: MockNetworkProvider;
  readonly proxyCategoryId: string;
  readonly implementationCategoryId: string;
  readonly changeAddress: string;
  readonly externals: Readonly<Record<string, FramedProxyExternal>>;
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
    const addressOf = (artifact: Artifact, categoryId: string): Uint8Array =>
      deployMaster(artifact, hexToBin(categoryId), VALIDATOR_PROGRAM).address;
    const plain: readonly (readonly [Artifact, string, readonly Uint8Array[]])[] = [
      [coin, COIN_CATEGORY, []], [escrow, ESCROW_CATEGORY, [addressOf(coin, COIN_CATEGORY)]],
    ];
    for (const [artifact, categoryId, args] of plain) {
      const genesisCoin = funding(categoryId);
      await network.addUtxo(wallet.address, genesisCoin);
      await deployStatefulContract(artifact, [...args], {
        fundingUtxo: genesisCoin, funder, changeAddress: wallet.address, provider: network,
      });
    }
    for (const txid of [BROKER_IMPL_CATEGORY, BROKER_PROXY_CATEGORY]) {
      await network.addUtxo(wallet.address, funding(txid));
    }
    const initCoin = funding(idOf('initialize coin'));
    await network.addUtxo(binToHex(USER_LOCK), initCoin);
    const deployment = await deployFramedProxy({
      provider: network,
      implementationArtifact: broker,
      proxyArtifact: brokerProxy,
      implementationDeploy: { fundingUtxo: funding(BROKER_IMPL_CATEGORY), funder, changeAddress: wallet.address },
      proxyDeploy: { fundingUtxo: funding(BROKER_PROXY_CATEGORY), funder, changeAddress: wallet.address },
      initialize: { functionName: 'initialize', args: [addressOf(escrow, ESCROW_CATEGORY)] },
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
      externals: {
        IEscrow: { artifact: escrow, categoryId: ESCROW_CATEGORY },
        ICoin: { artifact: coin, categoryId: COIN_CATEGORY },
      },
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

/** Funds a coin of the user's and runs one broker entry through the shipped proxy hop. */
async function enter(run: Deployed, functionName: string, args: readonly bigint[]): Promise<Entered> {
  const callerCoin = funding(idOf(`${functionName} ${args.join(' ')}`));
  await run.network.addUtxo(binToHex(USER_LOCK), callerCoin);
  const call = callFramedProxyEntry({
    provider: run.network,
    implementationArtifact: broker,
    proxyArtifact: brokerProxy,
    proxyCategoryId: run.proxyCategoryId,
    implementationCategoryId: run.implementationCategoryId,
    functionName,
    args: [...args],
    externals: run.externals,
    callerUtxo: callerCoin,
    callerLockingBytecode: USER_LOCK,
    funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
    changeAddress: run.changeAddress,
    vm: compositionMachine(),
  });
  return { coin: callerCoin, call };
}

/** The fields a deployment's data records hold, decoded with the shipped decoder. */
async function recordsOf(
  network: MockNetworkProvider, artifact: Artifact, categoryId: string,
): Promise<Record<string, unknown>> {
  const layout = artifact.stateLayout!;
  const pools = await readFramedDeployment(network, categoryId, layout);
  return Object.assign({}, ...pools.records.map((record, nftIndex) =>
    parsePushdataCommitment(record.token!.nft!.commitment, layout, nftIndex))) as Record<string, unknown>;
}

/** The value tail of the node an int key names in one collection, or undefined while the list holds none. */
async function nodeValue(
  network: MockNetworkProvider, artifact: Artifact, categoryId: string, collection: string, key: bigint,
): Promise<string | undefined> {
  const pools = await readFramedDeployment(network, categoryId, artifact.stateLayout!);
  const slot = bytesToHex(keyToSlotMulti([bigIntToVmNumber(key)]));
  const node = (pools.nodesByCollection.get(collection) ?? []).map((utxo) =>
    decodeEntryCommitment(hexToBin(utxo.token!.nft!.commitment))).find((entry) => bytesToHex(entry.slot) === slot);
  return node === undefined ? undefined : bytesToHex(node.value);
}

/** Every outpoint the deployments hold and the chain's tip, which a refused call leaves exactly as they were. */
async function chainView(run: Deployed): Promise<{ readonly tip: number | undefined; readonly outpoints: string[] }> {
  const held = await Promise.all(
    [COIN_CATEGORY, ESCROW_CATEGORY, run.proxyCategoryId, run.implementationCategoryId]
      .map((categoryId) => run.network.getUtxosByTokenCategory(categoryId)),
  );
  return {
    tip: run.network.indexer.getTip()?.height,
    outpoints: held.flat().map((utxo) => `${utxo.txid}:${utxo.vout}`).sort(),
  };
}

/** True while the coin a call was entered with is unspent. */
async function coinLive(run: Deployed, entered: Entered): Promise<boolean> {
  return (await run.network.getUtxosForLockingBytecode(USER_LOCK))
    .some((utxo) => utxo.txid === entered.coin.txid && utxo.vout === entered.coin.vout);
}

/** Runs an entry the hop must refuse, and checks that nothing was broadcast and no record moved. */
async function expectRefused(run: Deployed, functionName: string, args: readonly bigint[], reason: RegExp):
Promise<void> {
  const before = await chainView(run);
  const entered = await enter(run, functionName, args);
  await expect(entered.call).rejects.toThrow(reason);
  expect(await coinLive(run, entered)).toBe(true);
  expect(await chainView(run)).toStrictEqual(before);
  expect(await recordsOf(run.network, brokerProxy, run.proxyCategoryId))
    .toMatchObject({ opened: 0n, owed: 0n, lastEscrow: 0n });
  expect(await nodeValue(run.network, escrow, ESCROW_CATEGORY, 'held', ORDER_ID)).toBeUndefined();
}

/** How one participant is declared in each segment of a frame: kept, written, created, or not declared. */
function declarations(result: FramedProxyCallResult, master: string, index: number): readonly string[] {
  return result.draft.blockOf(master).segments.map((segment) => {
    const entry = segment.find((candidate: RecordEntry) => candidate.out === index);
    if (entry === undefined) return 'absent';
    if (entry.in === CREATED) return 'created';
    return bytesToHex(entry.viewIn) === bytesToHex(entry.viewOut) ? 'kept' : 'written';
  });
}

describe('spec section 23 row 15: writes after an external call', () => {
  it('lands each write on its own side of the call, and every one is on chain after the broadcast', async () => {
    const run = await deployed();
    const result = await (await enter(run, 'open', [ORDER_ID, AMOUNT])).call;
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(result.completed.map((frame) => frame.functionName)).toStrictEqual([
      'Coin.pull()', 'Escrow.fund()', 'Broker.open()', 'BrokerProxy.__fallback()',
    ]);

    // One call, two segments. The record holding the opening count is written before the call and kept after it;
    // the record holding the amount owed and the escrow id is kept before the call and written after it.
    const { participants } = result.draft.layout;
    const indexOf = (id: string): number => participants.find((placed) => placed.id === id)!.index;
    const recordOf = (field: string): number => indexOf(`proxy-record-${brokerProxy.stateLayout!.variables
      .find((variable) => variable.name === field)!.nftIndex}`);
    expect(recordOf('opened')).not.toBe(recordOf('owed'));
    expect(recordOf('owed')).toBe(recordOf('lastEscrow'));
    expect(declarations(result, 'implementation-master', recordOf('opened'))).toStrictEqual(['written', 'kept']);
    expect(declarations(result, 'implementation-master', recordOf('owed'))).toStrictEqual(['kept', 'written']);
    // The node the broker's mapping write creates, and the one the escrow's write creates after its own call to the
    // coin, are each declared only in the segment after the call.
    const created = (master: string): readonly number[] => result.draft.blockOf(master).segments
      .map((segment) => segment.filter((entry) => entry.in === CREATED).length);
    expect(created('implementation-master')).toStrictEqual([0, 1]);
    expect(created('callee-master-1')).toStrictEqual([0, 1]);
    // Each record's views chain across the call: what one segment leaves is what the next starts from.
    for (const field of ['opened', 'owed']) {
      const [first, second] = result.draft.blockOf('implementation-master').segments
        .map((segment) => segment.find((entry) => entry.out === recordOf(field))!);
      expect(bytesToHex(second!.viewIn)).toBe(bytesToHex(first!.viewOut));
    }

    // The post-state, read back from the chain.
    const escrowId = ESCROW_BASE + ORDER_ID;
    expect(await recordsOf(run.network, brokerProxy, run.proxyCategoryId))
      .toMatchObject({ opened: 1n, owed: AMOUNT, lastEscrow: escrowId });
    // The proxy's records carry the implementation's collections, so its layout is what classifies their nodes.
    expect(await nodeValue(run.network, broker, run.proxyCategoryId, 'escrowOf', ORDER_ID))
      .toBe(bytesToHex(bigIntToVmNumber(escrowId)));
    expect(await nodeValue(run.network, escrow, ESCROW_CATEGORY, 'held', ORDER_ID))
      .toBe(bytesToHex(bigIntToVmNumber(AMOUNT)));
  });

  it('refuses a check after the writes with the entry\'s own reason, and nothing is broadcast', async () => {
    const run = await deployed();
    await expectRefused(run, 'open', [ORDER_ID, 140n],
      /the implementation's "open" entry did not settle through the proxy: .*owed over the cap/);
  });

  it('refuses a revert in the nested coin with its own reason, before the escrow writes anything', async () => {
    const run = await deployed();
    await expectRefused(run, 'open', [ORDER_ID, 600n],
      /the call's callee "Coin\.pull\(\)" did not settle through the proxy: .*over the coin cap/);
  });

  it('settles the escrow advancing its own counter after its call, a callee data-record write', async () => {
    const run = await deployed();
    // The escrow's record leads with the counter, so the value the callee's own close computes is readable here.
    const live = await readFramedDeployment(run.network, ESCROW_CATEGORY, escrow.stateLayout!);
    const state = parsePushdataCommitment(live.records[0]!.token!.nft!.commitment,
      escrow.stateLayout!, 0) as Record<string, unknown>;
    expect(state.ids).toStrictEqual({ value: 0n });

    const result = await (await enter(run, 'openNext', [AMOUNT])).call;
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(result.completed.map((frame) => frame.functionName)).toStrictEqual([
      'Coin.pull()', 'Escrow.fundNext()', 'Broker.openNext()', 'BrokerProxy.__fallback()',
    ]);

    // The callee's own record is declared in both segments its call splits the frame into — kept before the call,
    // written after it — and what the second declaration starts from is what the first one ended at.
    const declared = result.draft.blockOf('callee-master-1').segments;
    const escrowIndex = result.draft.layout.participants.find((placed) => placed.id === 'Escrow-record-0')!.index;
    const segments = declared.map((segment) => segment.find((entry: RecordEntry) => entry.out === escrowIndex)!);
    expect(segments).toHaveLength(2);
    expect(bytesToHex(segments[0]!.viewOut)).toBe(bytesToHex(segments[0]!.viewIn));
    expect(bytesToHex(segments[1]!.viewIn)).toBe(bytesToHex(segments[0]!.viewOut));
    expect(bytesToHex(segments[1]!.viewOut)).not.toBe(bytesToHex(segments[1]!.viewIn));

    // The entry's write is the value its body assigned, which the callee's own return supplied: the record the
    // transaction carries is the one the body computed, and the counter advanced exactly once.
    expect(await recordsOf(run.network, brokerProxy, run.proxyCategoryId))
      .toMatchObject({ opened: 0n, owed: 0n, lastEscrow: ESCROW_BASE });
    expect(await nodeValue(run.network, escrow, ESCROW_CATEGORY, 'held', 0n))
      .toBe(bytesToHex(bigIntToVmNumber(AMOUNT)));
    const after = await readFramedDeployment(run.network, ESCROW_CATEGORY, escrow.stateLayout!);
    expect(parsePushdataCommitment(after.records[0]!.token!.nft!.commitment, escrow.stateLayout!, 0))
      .toMatchObject({ ids: { value: 1n } });
  });

  it('refuses the entry by name on the plain call path, whose implementation records hold no escrow', async () => {
    const run = await deployed();
    const callerCoin = funding(idOf('plain path coin'));
    await run.network.addUtxo(binToHex(USER_LOCK), callerCoin);
    await expect(callFramedEntry({
      provider: run.network, artifact: broker, categoryId: run.implementationCategoryId, functionName: 'open',
      args: [ORDER_ID, AMOUNT], callerUtxo: callerCoin, callerLockingBytecode: USER_LOCK,
      funder: new SignatureTemplate(alicePriv).unlockP2PKH(), vm: compositionMachine(),
    })).rejects.toThrow(
      new RegExp('entry "open" makes 1 external call\\(s\\): the call to "IEscrow\\.fund" targets the state '
        + 'field "escrow", which the caller\'s own state does not hold as an address'),
    );
  });
});
