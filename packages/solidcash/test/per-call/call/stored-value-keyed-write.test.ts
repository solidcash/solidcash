import { describe, expect, it } from 'vitest';
import { bigIntToVmNumber, binToHex, encodeLockingBytecodeP2pkh, utf8ToBin } from '@bitauth/libauth';
import { bytesEqual, bytesToHex, sha256, type Artifact } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import type { Unlocker, Utxo } from '../../../src/interfaces.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { decodeEntryCommitment, encodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import type { CompositionDraft } from '../../../src/per-call/composer/index.js';
import { callPerCallEntry } from '../../../src/per-call/call/index.js';
import {
  buildProxyArtifact, callPerCallProxyEntry, deployPerCallProxy, type PerCallProxyCallResult,
} from '../../../src/per-call/proxy/index.js';
import { readPerCallEntry } from '../../../src/per-call/read/index.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub, bobPkh, bobPriv, carolPkh } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A mapping write keyed by a value the body reads out of another mapping.
 *
 * "Credit the party the record names": `owed[deals[id].payee] += deals[id].amount`, in its direct spelling and
 * through a memory copy of the record (`Deal memory d = deals[id]; owed[d.payee] += d.amount`), and the same credit
 * keyed by an address one mapping holds per id (`credits[holders[id]] += amount`). The artifact publishes the key as
 * the read (`field:payee(map:deals(id:id))`, `map:holders(id:id)`); the per-call master derives the write's target
 * slot from the node its frame declares for that read, which the read proves is the node at the key, and the hop and
 * the plain call path plan the written node at the same key from the node the deployment holds for the read. Each
 * write settles and is read back through the views. A plan that credits a party the record does not name is refused
 * by the entry's own frame, and one that declares the record naming another party by the transaction's settlement.
 *
 * `Escrow` sits behind its generated proxy, since the plain call path does not declare the chunk records a struct
 * value may span; `Ledger` is deployed both behind its proxy and plain.
 */

/** A 32-byte category or txid with varied bytes, taken from its label. */
function idOf(label: string): string {
  return bytesToHex(sha256(utf8ToBin(`stored value keyed write ${label}`)));
}

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'contract Escrow {',
  '  struct Deal { address payee; uint256 amount; }',
  '  address public implementation;',
  '  uint256 public opened;',
  '  mapping(uint256 => Deal) private deals;',
  '  mapping(address => uint256) private owed;',
  '  function initialize(uint256 start) public { opened = start; }',
  '  function open(uint256 id, address payee, uint256 amount) external { deals[id] = Deal(payee, amount); }',
  '  function release(uint256 id) external {',
  '    require(deals[id].amount > 0, "empty");',
  '    owed[deals[id].payee] += deals[id].amount;',
  '  }',
  '  function releaseCopy(uint256 id) external {',
  '    Deal memory d = deals[id];',
  '    require(d.amount > 0, "empty");',
  '    owed[d.payee] += d.amount;',
  '  }',
  '  function payeeOf(uint256 id) external view returns (address) { return deals[id].payee; }',
  '  function owedTo(address account) external view returns (uint256) { return owed[account]; }',
  '}',
  'contract Ledger {',
  '  address public implementation;',
  '  uint256 public started;',
  '  mapping(uint256 => address) private holders;',
  '  mapping(address => uint256) private credits;',
  '  function initialize() public { started = 1; }',
  '  function assign(uint256 id, address holder) external { holders[id] = holder; }',
  '  function credit(uint256 id, uint256 amount) external { credits[holders[id]] += amount; }',
  '  function creditOf(address account) external view returns (uint256) { return credits[account]; }',
  '}',
].join('\n');

const artifacts = compileStringMulti(SOURCE, { solidityImportCompat: true, composition: 'per-call' } as never);
const escrow = artifacts.Escrow!;
const ledger = artifacts.Ledger!;

/** The options a per-call project build compiles with, a message-bus route among them, which it then discards. */
const PROJECT_OPTIONS = {
  solidityImportCompat: true, commitmentLimit: 128, maximumInputBytes: 10_000_000, messageBus: true,
  optimizeForCompilationSpeed: true, suppressWarnings: true, ecrecover: 'p2pkh', sortedMappingsAll: false,
  composition: 'per-call',
} as const;

interface Caller { readonly lock: Uint8Array; readonly funder: Unlocker }

const signer = (pkh: Uint8Array, priv: Uint8Array): Caller => ({
  lock: encodeLockingBytecodeP2pkh(pkh), funder: new SignatureTemplate(priv).unlockP2PKH(),
});
const ALICE = signer(alicePkh, alicePriv);
const BOB = signer(bobPkh, bobPriv);
/** A party no call is made from. */
const CAROL_LOCK = encodeLockingBytecodeP2pkh(carolPkh);

/** The slot a node keyed by id `id` sits at. */
const idSlot = (id: bigint): Uint8Array => keyToSlotMulti([bigIntToVmNumber(id)]);
/** The slot a node keyed by `party` sits at. */
const partySlot = (party: Uint8Array): Uint8Array => keyToSlotMulti([party]);

/** A deployment behind its generated proxy. */
interface Proxied { readonly proxy: string; readonly implementation: string }

/** Both proxied deployments, the plain ledger, and the chain as it stood then. */
interface World {
  readonly network: MockNetworkProvider;
  readonly changeAddress: string;
  readonly escrow: Proxied;
  readonly ledger: Proxied;
  readonly plainLedger: string;
  readonly snapshot: SnapshotRestorer;
}

let coins = 0;

/** A fresh coin at `lock`, which a genesis or a call is funded from. */
async function coinAt(network: MockNetworkProvider, lock: string, label: string): Promise<Utxo> {
  coins += 1;
  const coin = { txid: idOf(`${label} ${coins}`), vout: 0, satoshis: 5_000_000n };
  await network.addUtxo(lock, coin);
  return coin;
}

async function deployWorld(): Promise<World> {
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = wallet.unlock.spend(alicePub, new SignatureTemplate(alicePriv));
  await fundShippedFacets(network);
  const proxied = async (artifact: Artifact, args: readonly FunctionArgument[]): Promise<Proxied> => {
    const name = artifact.contractName;
    const deployment = await deployPerCallProxy({
      provider: network,
      implementationArtifact: artifact,
      proxyArtifact: buildProxyArtifact(artifact),
      implementationDeploy: {
        fundingUtxo: await coinAt(network, wallet.address, `${name} implementation`), funder,
        changeAddress: wallet.address,
      },
      proxyDeploy: {
        fundingUtxo: await coinAt(network, wallet.address, `${name} proxy`), funder, changeAddress: wallet.address,
      },
      initialize: { functionName: 'initialize', args: [...args] },
      callerLockingBytecode: ALICE.lock,
      callerFunding: {
        utxo: await coinAt(network, binToHex(ALICE.lock), `${name} initialize`), funder: ALICE.funder,
        changeAddress: wallet.address,
      },
      vm: compositionMachine(),
    });
    expect(deployment.initialize.broadcast).toBeDefined();
    return { proxy: deployment.proxy.categoryId, implementation: deployment.implementation.categoryId };
  };
  const escrowDeployment = await proxied(escrow, [1n]);
  const ledgerDeployment = await proxied(ledger, []);
  const plain = await deployStatefulContract(ledger, [], {
    provider: network, fundingUtxo: await coinAt(network, wallet.address, 'plain ledger'),
    changeAddress: wallet.address, funder,
  });
  return {
    network, changeAddress: wallet.address, escrow: escrowDeployment, ledger: ledgerDeployment,
    plainLedger: plain.categoryId, snapshot: await network.takeSnapshot(),
  };
}

let worldRun: Promise<World> | undefined;

/** One set of deployments serves every case, each rewinding the chain to them first. */
async function deployed(): Promise<World> {
  worldRun ??= deployWorld();
  const world = await worldRun;
  await world.snapshot.restore();
  return world;
}

/** One call through a proxy, from a fresh coin of the caller's; it has to settle. */
async function settleProxied(
  world: World, artifact: Artifact, functionName: string, args: readonly FunctionArgument[], caller: Caller = ALICE,
): Promise<PerCallProxyCallResult> {
  const deployment = artifact === escrow ? world.escrow : world.ledger;
  const result = await callPerCallProxyEntry({
    provider: world.network,
    implementationArtifact: artifact,
    proxyArtifact: buildProxyArtifact(artifact),
    proxyCategoryId: deployment.proxy,
    implementationCategoryId: deployment.implementation,
    functionName,
    args: [...args],
    callerUtxo: await coinAt(world.network, binToHex(caller.lock), functionName),
    callerLockingBytecode: caller.lock,
    funder: caller.funder,
    changeAddress: world.changeAddress,
    vm: compositionMachine(),
  });
  expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
  expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  return result;
}

/** One call to the plain ledger through the plain call path; it has to settle. */
async function settlePlain(
  world: World, functionName: string, args: readonly FunctionArgument[], caller: Caller = ALICE,
): Promise<void> {
  const result = await callPerCallEntry({
    provider: world.network,
    artifact: ledger,
    categoryId: world.plainLedger,
    functionName,
    args: [...args],
    callerUtxo: await coinAt(world.network, binToHex(caller.lock), functionName),
    callerLockingBytecode: caller.lock,
    funder: caller.funder,
    changeAddress: world.changeAddress,
    vm: compositionMachine(),
  });
  expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
  expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
}

/** A view's value, read from a deployment's records through the read path. */
async function view(
  world: World, categoryId: string, artifact: Artifact, functionName: string, args: readonly FunctionArgument[] = [],
): Promise<unknown> {
  const read = await readPerCallEntry({
    provider: world.network, artifact, categoryId, functionName, args: [...args], vm: compositionMachine(),
  });
  expect(read.accepted, read.objection).toBe(true);
  return read.value;
}

/** What one view reads for each listed party. */
async function perParty(
  world: World, categoryId: string, artifact: Artifact, functionName: string, parties: readonly Uint8Array[],
): Promise<readonly unknown[]> {
  const values: unknown[] = [];
  for (const party of parties) values.push(await view(world, categoryId, artifact, functionName, [party]));
  return values;
}

/** The participants that refuse the transaction a draft lays out for one master, by id. */
function refusingParticipants(draft: CompositionDraft, master: string): readonly string[] {
  const vm = compositionMachine();
  const { sourceOutputs, transaction } = draft.programFor(master);
  return draft.layout.participants.filter((placed) => vm.stateSuccess(vm.evaluate({
    inputIndex: placed.index, sourceOutputs, transaction,
  })) !== true).map((placed) => placed.id);
}

describe('a mapping write keyed by a value read from another mapping', () => {
  it('publishes each key as the read the body makes, in both spellings, and refuses no entry', () => {
    const labels = (artifact: Artifact, entry: string): readonly (string | undefined)[] => (artifact.abi
      .find((candidate) => candidate.name === entry)?.entryAccesses ?? [])
      .filter((access) => access.operations.some((operation) => operation !== 'read'))
      .map((access) => access.keySources?.[0]?.expressionLabel ?? access.keyParams[0]);
    for (const unit of [artifacts, compileStringMulti(SOURCE, PROJECT_OPTIONS as never)]) {
      expect(unit.Escrow!.composition?.refusedEntries ?? []).toStrictEqual([]);
      expect(unit.Ledger!.composition?.refusedEntries ?? []).toStrictEqual([]);
      expect(labels(unit.Escrow!, 'release')).toStrictEqual(['field:payee(map:deals(id:id))']);
      expect(labels(unit.Escrow!, 'releaseCopy')).toStrictEqual(['field:payee(map:deals(id:id))']);
      expect(labels(unit.Ledger!, 'credit')).toStrictEqual(['map:holders(id:id)']);
    }
  }, 300_000);

  it('credits the payee each deal names through the proxy, in both spellings, each read back', async () => {
    const world = await deployed();
    await settleProxied(world, escrow, 'open', [1n, BOB.lock, 50n]);
    await settleProxied(world, escrow, 'open', [2n, CAROL_LOCK, 30n]);
    await settleProxied(world, escrow, 'open', [3n, BOB.lock, 5n]);
    expect(binToHex(await view(world, world.escrow.proxy, escrow, 'payeeOf', [1n]) as Uint8Array))
      .toBe(binToHex(bobPkh));
    const parties = [BOB.lock, CAROL_LOCK, ALICE.lock];
    // Alice releases the deals: each credit goes to the payee the deal names, not to the caller.
    await settleProxied(world, escrow, 'release', [1n]);
    expect(await perParty(world, world.escrow.proxy, escrow, 'owedTo', parties)).toStrictEqual([50n, 0n, 0n]);
    await settleProxied(world, escrow, 'releaseCopy', [2n]);
    expect(await perParty(world, world.escrow.proxy, escrow, 'owedTo', parties)).toStrictEqual([50n, 30n, 0n]);
    // A later deal for the same payee rewrites the node the first one created, whoever releases it.
    await settleProxied(world, escrow, 'releaseCopy', [3n], BOB);
    expect(await perParty(world, world.escrow.proxy, escrow, 'owedTo', parties)).toStrictEqual([55n, 30n, 0n]);
  }, 600_000);

  it('credits the holder an id names, through the proxy and on the plain call path, each read back', async () => {
    const world = await deployed();
    const parties = [BOB.lock, CAROL_LOCK, ALICE.lock];
    await settleProxied(world, ledger, 'assign', [7n, BOB.lock]);
    await settleProxied(world, ledger, 'assign', [8n, CAROL_LOCK]);
    await settleProxied(world, ledger, 'credit', [7n, 4n]);
    await settleProxied(world, ledger, 'credit', [8n, 6n], BOB);
    await settleProxied(world, ledger, 'credit', [7n, 1n]);
    expect(await perParty(world, world.ledger.proxy, ledger, 'creditOf', parties)).toStrictEqual([5n, 6n, 0n]);
    await settlePlain(world, 'assign', [7n, CAROL_LOCK]);
    await settlePlain(world, 'credit', [7n, 9n]);
    await settlePlain(world, 'credit', [7n, 2n], BOB);
    expect(await perParty(world, world.plainLedger, ledger, 'creditOf', parties)).toStrictEqual([0n, 11n, 0n]);
    // An id no holder is assigned to reads as the default address, and the credit is keyed by it as the body keys it.
    await settlePlain(world, 'credit', [9n, 3n]);
    expect(await view(world, world.plainLedger, ledger, 'creditOf', [new Uint8Array(0)])).toBe(3n);
  }, 600_000);

  it('refuses a plan that credits a party the deal does not name, or declares the deal naming it', async () => {
    const world = await deployed();
    await settleProxied(world, escrow, 'open', [1n, BOB.lock, 50n]);
    const result = await settleProxied(world, escrow, 'release', [1n]);
    const draft = result.draft;
    const entry = draft.runs.find((run) => run.functionName === `${escrow.contractName}.release()`)!.master;
    const records = draft.blockOf(entry).segments.flat();
    const deal = records.find((record) => record.viewIn.length >= 64
      && bytesEqual(decodeEntryCommitment(record.viewIn).slot, idSlot(1n)))!;
    const credited = records.find((record) => record.viewOut.length >= 64
      && bytesEqual(decodeEntryCommitment(record.viewOut).slot, partySlot(BOB.lock)))!;
    const relinked = records.find((record) => record.viewOut.length >= 64
      && bytesEqual(decodeEntryCommitment(record.viewOut).nextKey, partySlot(BOB.lock)))!;
    expect(refusingParticipants(draft, entry)).toStrictEqual([]);

    // The credit moved to Carol, consistently: the deal still names Bob, so the frame's own derivation refuses it.
    const credit = decodeEntryCommitment(credited.viewOut);
    credited.viewOut = encodeEntryCommitment(partySlot(CAROL_LOCK), credit.nextKey, credit.value);
    const head = decodeEntryCommitment(relinked.viewOut);
    relinked.viewOut = encodeEntryCommitment(head.slot, partySlot(CAROL_LOCK), head.value);
    expect(refusingParticipants(draft, entry)).toContain(entry);

    // And the deal declared naming Carol as well: the frame derives her slot from the view it is handed, which the
    // validator holds to the deal's own node, and that node's spend holds its output to the deal it carries.
    const held = decodeEntryCommitment(deal.viewIn);
    const bob = BOB.lock;
    const at = held.value.findIndex((_byte, index) => bytesEqual(held.value.slice(index, index + bob.length), bob));
    expect(at).toBeGreaterThanOrEqual(0);
    const forged = held.value.slice();
    forged.set(CAROL_LOCK, at);
    deal.viewIn = encodeEntryCommitment(held.slot, held.nextKey, forged);
    deal.viewOut = deal.viewIn;
    const refusing = refusingParticipants(draft, entry);
    expect(refusing).not.toContain(entry);
    expect(refusing).toContain('validator');
    expect(refusing).toContain(`mapping-read-deals-${bytesToHex(idSlot(1n))}`);
  }, 600_000);
});
