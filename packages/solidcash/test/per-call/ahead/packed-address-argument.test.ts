import { describe, expect, it, vi } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { decodePushdataValue, validatorAddress, type StateValue } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import * as composer from '../../../src/per-call/composer/index.js';
import * as resolution from '../../../src/per-call/proxy/call-resolution.js';
import {
  PerCallProxyDeployError, buildProxyArtifact, callPerCallProxyEntry, deployPerCallProxy,
  type PerCallProxyCallResult,
} from '../../../src/per-call/proxy/index.js';
import type { PerCallProxyExternal } from '../../../src/per-call/proxy/external-calls.js';
import type { Unlocker, Utxo } from '../../../src/interfaces.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub, bobPkh, bobPriv, carolPkh, carolPriv } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * Walls ahead: an `address` packed with `abi.encodePacked` into a store call's argument, through the shipped hop
 * (`callPerCallProxyEntry`), compiled with the fixture's options (`solidityImportCompat` among them).
 *
 * `refund`, `arbitrate` and `refuseArbitration` pack `job.roles.worker` or `job.roles.arbitrator` into their event,
 * and the compiler publishes that struct field read with no type (`fields: ['']`: it serializes the argument before
 * type checking), while the body packs an `address` as its 20-byte identity (`compileAddressToEvmIdentity`). The
 * SDK's evaluator packed the untyped field as the value it holds, the stored 25-byte lock, so the call's argument
 * digest differed and the hop was refused at the call's line (measured at d8bae0604): #52, #53, #59-#62 and #65
 * (#63 reverts before the call and #64 skips it). The evaluator now reads the field's declared type from the
 * artifact's structs (`stateful/sc-evaluate-external-expression.ts`, `packedFieldType`), so `Desk` (a proxied root)
 * replaying the three spellings on its job array settles and the proxied store `Journal` keeps the 20 bytes. An
 * `address` parameter, an explicit `address(...)` and `msg.sender` (published typed) are the controls.
 *
 * Two walls stand beside it on the same titles, pinned here: the arbitration's amounts come from an earlier call,
 * which the hop settles first and whose own frame refuses the record write it makes, and the refund's whitelist
 * note packs a local array element the compiler publishes as the array's allocation. The file runs only under
 * `PER_CALL_AHEAD=1`.
 */

/** A 32-byte value with varied bytes, `seed` chosen so each name is distinct. */
function category(seed: string): string {
  const base = '8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3';
  return `${seed}${base}${base}`.slice(0, 64);
}

const SPLITTER_CATEGORY = category('0e');
const JOURNAL_IMPL_CATEGORY = category('1a');
const JOURNAL_PROXY_CATEGORY = category('2b');
const DESK_IMPL_CATEGORY = category('3c');
const DESK_PROXY_CATEGORY = category('4d');

/** A per-call contract's address, which its category fixes before anything is deployed. */
const addressOf = (id: string): Uint8Array => validatorAddress(hexToBin(id), VALIDATOR_PROGRAM);

const ALICE_LOCK = encodeLockingBytecodeP2pkh(alicePkh);
const BOB_LOCK = encodeLockingBytecodeP2pkh(bobPkh);
const CAROL_LOCK = encodeLockingBytecodeP2pkh(carolPkh);
const JOB = 0n;
const REASON = Uint8Array.from({ length: 32 }, (_unused, index) => (index * 11 + 3) % 256);

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'struct JobEventData { uint8 type_; bytes address_; bytes data_; uint32 timestamp_; }',
  'interface IJournal { function publishJobEvent(uint256 jobId_, JobEventData memory event_) external; }',
  'interface ISplitter { function split(uint256 amount_) external returns (uint256[5] memory); }',
  'contract Journal {',
  '  address public implementation;',
  '  address public desk;',
  '  mapping(uint256 => JobEventData[]) jobEvents;',
  '  event JobEvent(uint256 indexed jobId, JobEventData eventData);',
  '  modifier onlyDesk() { require(msg.sender == desk, "not desk"); _; }',
  '  function initialize(address desk_) public { desk = desk_; }',
  '  function publishJobEvent(uint256 jobId_, JobEventData memory event_) public onlyDesk {',
  '    event_.timestamp_ = uint32(block.timestamp);',
  '    jobEvents[jobId_].push(event_);',
  '    emit JobEvent(jobId_, event_);',
  '  }',
  '}',
  'contract Splitter {',
  '  uint256 public calls;',
  '  constructor(uint256 calls_) { calls = calls_; }',
  '  function split(uint256 amount_) public returns (uint256[5] memory) {',
  '    calls = calls + 1;',
  '    uint256[5] memory amounts;',
  '    amounts[0] = amount_ * 8 / 10;',
  '    amounts[1] = amount_ * 2 / 10;',
  '    return amounts;',
  '  }',
  '}',
  'contract Desk {',
  '  struct JobRoles { address creator; address arbitrator; address worker; }',
  '  struct JobPost { uint8 state; JobRoles roles; string title; uint256 escrowId; }',
  '  address public implementation;',
  '  address public journal;',
  '  address public splitter;',
  '  JobPost[] public jobs;',
  '  function initialize(address journal_, address splitter_) public { journal = journal_; splitter = splitter_; }',
  '  function publishJobEvent(uint256 jobId_, JobEventData memory event_) internal {',
  '    IJournal(journal).publishJobEvent(jobId_, event_);',
  '  }',
  '  function open(string calldata title_, address arbitrator_) public {',
  '    jobs.push();',
  '    uint256 jobId = jobs.length - 1;',
  '    JobPost storage job = jobs[jobId];',
  '    job.roles.creator = msg.sender;',
  '    job.roles.arbitrator = arbitrator_;',
  '    job.title = title_;',
  '  }',
  '  function take(uint256 jobId_) public {',
  '    jobs[jobId_].roles.worker = msg.sender;',
  '    jobs[jobId_].state = 1;',
  '  }',
  '  function packParam(uint256 jobId_, address who_) public {',
  '    jobs[jobId_].escrowId = jobs[jobId_].escrowId + 1;',
  '    publishJobEvent(jobId_, JobEventData(10, abi.encodePacked(who_), bytes(""), 0));',
  '  }',
  '  function packCast(uint256 jobId_) public {',
  '    jobs[jobId_].escrowId = jobs[jobId_].escrowId + 1;',
  '    publishJobEvent(jobId_,',
  '      JobEventData(10, abi.encodePacked(address(jobs[jobId_].roles.arbitrator)), bytes(""), 0));',
  '  }',
  '  function packSender(uint256 jobId_) public {',
  '    jobs[jobId_].escrowId = jobs[jobId_].escrowId + 1;',
  '    publishJobEvent(jobId_, JobEventData(10, abi.encodePacked(msg.sender), bytes(""), 0));',
  '  }',
  '  function packField(uint256 jobId_) public {',
  '    jobs[jobId_].escrowId = jobs[jobId_].escrowId + 1;',
  '    publishJobEvent(jobId_, JobEventData(10, abi.encodePacked(jobs[jobId_].roles.arbitrator), bytes(""), 0));',
  '  }',
  '  function packLocal(uint256 jobId_) public {',
  '    jobs[jobId_].escrowId = jobs[jobId_].escrowId + 1;',
  '    address[] memory removed = new address[](1);',
  '    removed[0] = jobs[jobId_].roles.worker;',
  '    publishJobEvent(jobId_, JobEventData(15, abi.encodePacked(removed[0]), bytes(""), 0));',
  '  }',
  '  function _refund(uint256 jobId_, bool byWorker) internal {',
  '    JobPost storage job = jobs[jobId_];',
  '    require(job.state == 1, "job in invalid state");',
  '    job.state = 0;',
  '    job.escrowId = 0;',
  '    publishJobEvent(jobId_, JobEventData({',
  '      type_: 10,',
  '      address_: byWorker ? abi.encodePacked(job.roles.worker) : abi.encodePacked(job.roles.arbitrator),',
  '      data_: bytes(""),',
  '      timestamp_: 0',
  '    }));',
  '    job.roles.worker = address(0);',
  '  }',
  '  function refund(uint256 jobId_) public { _refund(jobId_, true); }',
  '  function arbitrate(uint256 jobId_, uint16 buyerShare_, uint16 workerShare_, bytes32 reasonHash_) public {',
  '    JobPost storage job = jobs[jobId_];',
  '    job.escrowId = job.escrowId + 1;',
  '    uint256[5] memory amounts = ISplitter(splitter).split(1000);',
  '    publishJobEvent(jobId_, JobEventData({',
  '      type_: 12,',
  '      address_: bytes(""),',
  '      data_: abi.encodePacked(buyerShare_, amounts[0], workerShare_, amounts[1], reasonHash_, job.roles.worker,',
  '        amounts[4]),',
  '      timestamp_: 0',
  '    }));',
  '  }',
  '  function arbitrateShares(uint256 jobId_, uint16 buyerShare_, uint16 workerShare_, bytes32 reasonHash_) public {',
  '    JobPost storage job = jobs[jobId_];',
  '    job.escrowId = job.escrowId + 1;',
  '    publishJobEvent(jobId_, JobEventData({',
  '      type_: 12,',
  '      address_: bytes(""),',
  '      data_: abi.encodePacked(buyerShare_, workerShare_, reasonHash_, job.roles.worker),',
  '      timestamp_: 0',
  '    }));',
  '  }',
  '  function refuseArbitration(uint256 jobId_) public {',
  '    JobPost storage job = jobs[jobId_];',
  '    require(job.state != 2, "job in invalid state");',
  '    if (job.state == 1) {',
  '      _refund(jobId_, false);',
  '    }',
  '    job.roles.arbitrator = address(0);',
  '  }',
  '}',
].join('\n');

/** The fixture's compile options (`examples/effectiveacceleration/solidcash.config.ts`, as the mock network sets them). */
const FIXTURE_OPTIONS = {
  solidityImportCompat: true,
  commitmentLimit: 128,
  maximumInputBytes: 10_000_000,
  messageBus: true,
  optimizeForCompilationSpeed: true,
  suppressWarnings: true,
  ecrecover: 'p2pkh',
  sortedMappingsAll: false,
  composition: 'per-call',
} as const;

/** The 1-based line of the first source line containing `needle`. */
function lineOf(needle: string): number {
  return SOURCE.split('\n').findIndex((line) => line.includes(needle)) + 1;
}

type ArtifactMap = ReturnType<typeof compileStringMulti>;
let compiledRun: ArtifactMap | undefined;
/** The contracts, compiled once and only when the file runs. */
function compiled(): ArtifactMap {
  compiledRun ??= compileStringMulti(SOURCE, FIXTURE_OPTIONS as never);
  return compiledRun;
}

/** One published expression node, as far as these checks read it. */
interface Published {
  readonly kind?: string;
  readonly args?: readonly Published[];
  readonly fields?: readonly string[];
  readonly ifTrue?: Published;
  readonly ifFalse?: Published;
}

/** The published event of the one store call an entry makes: `JobEventData`'s argument expressions. */
function eventArgs(functionName: string): readonly Published[] {
  const row = compiled().Desk!.abi.find((entry) => entry.name === functionName) as unknown as {
    readonly externalCalls: readonly { readonly argSources: readonly { readonly expression?: Published }[] }[];
  };
  const call = row.externalCalls.at(-1)!;
  return call.argSources[1]!.expression!.args!;
}

/** A read of `jobs[id].roles.<name>` as the entry's own storage-pointer or index spelling publishes it. */
function roleRead(name: string, spelling: 'stateAccess' | 'arrayAccess'): Published {
  const id = { kind: 'source', source: { kind: 'forward', paramIndex: 0 } };
  const job = spelling === 'stateAccess'
    ? { kind: 'stateAccess', name: 'jobs', args: [id], type: 'JobPost' }
    : { kind: 'arrayAccess', left: { kind: 'state', name: 'jobs' }, right: id };
  const roles = spelling === 'stateAccess'
    ? { kind: 'field', name: 'roles', expression: job, type: 'JobRoles' }
    : { kind: 'field', name: 'roles', expression: job };
  return { kind: 'field', name, expression: roles } as Published;
}

/** `abi.encodePacked(value)` as published with no type for its one value. */
const packedUntyped = (value: Published): Published => ({ kind: 'abiEncodePacked', args: [value], fields: [''] });

interface Caller { readonly lock: Uint8Array; readonly funder: Unlocker }

const CREATOR: Caller = { lock: ALICE_LOCK, funder: new SignatureTemplate(alicePriv).unlockP2PKH() };
const WORKER: Caller = { lock: BOB_LOCK, funder: new SignatureTemplate(bobPriv).unlockP2PKH() };
const ARBITRATOR: Caller = { lock: CAROL_LOCK, funder: new SignatureTemplate(carolPriv).unlockP2PKH() };

/** A coin a genesis is funded from; its txid becomes the category it mints. */
function funding(txid: string): Utxo {
  return { txid, vout: 0, satoshis: 5_000_000n };
}

/** One deployment of the splitter, the store and the root, and the coins its hops are entered with. */
interface World {
  readonly network: MockNetworkProvider;
  readonly desk: { readonly proxy: string; readonly implementation: string };
  readonly journal: { readonly proxy: string; readonly implementation: string };
  readonly externals: Readonly<Record<string, PerCallProxyExternal>>;
  readonly changeAddress: string;
  /** Hands out a fresh coin id per hop, distinct from every category. */
  readonly nextCoin: () => Utxo;
}

/** What a hop left: its result or error, the stalls the settle caught, and the call arguments its plan stated. */
interface Outcome {
  readonly result?: PerCallProxyCallResult;
  readonly error?: Error;
  readonly stalls: readonly string[];
  /** The argument values each planned call states, in parameter order. */
  readonly stated: readonly (readonly FunctionArgument[])[];
  /** Whether the caller's coin is still unspent, i.e. nothing was broadcast from it. */
  readonly coinLive: boolean;
}

/** Enters one root entry through its proxy, and returns what it left. */
async function enter(
  world: World, functionName: string, args: readonly FunctionArgument[], caller: Caller,
): Promise<Outcome> {
  const artifact = compiled().Desk!;
  const coin = world.nextCoin();
  await world.network.addUtxo(binToHex(caller.lock), coin);
  const derivations = vi.spyOn(composer, 'deriveComposition');
  const resolved = vi.spyOn(resolution, 'resolvePublishedCall');
  let result: PerCallProxyCallResult | undefined;
  let error: Error | undefined;
  try {
    result = await callPerCallProxyEntry({
      provider: world.network,
      implementationArtifact: artifact,
      proxyArtifact: buildProxyArtifact(artifact),
      proxyCategoryId: world.desk.proxy,
      implementationCategoryId: world.desk.implementation,
      functionName,
      args,
      externals: world.externals,
      callerUtxo: coin,
      callerLockingBytecode: caller.lock,
      funder: caller.funder,
      changeAddress: world.changeAddress,
      vm: compositionMachine(),
    });
  } catch (caught) {
    error = caught as Error;
  }
  const stalls = derivations.mock.results.filter((entry) => entry.type === 'throw')
    .map((entry) => String((entry.value as Error).message));
  const stated = resolved.mock.results.filter((entry) => entry.type === 'return')
    .map((entry) => (entry.value as resolution.ResolvedCall).argumentValues);
  derivations.mockRestore();
  resolved.mockRestore();
  const live = await world.network.getUtxosForLockingBytecode(caller.lock);
  return {
    ...(result === undefined ? {} : { result }),
    ...(error === undefined ? {} : { error }),
    stalls,
    stated,
    coinLive: live.some((utxo) => utxo.txid === coin.txid && utxo.vout === coin.vout),
  };
}

/** A stored event: the store's key and the event's `address_` and `data_` bytes, as the store emitted them. */
interface Stored { readonly id: bigint; readonly type: bigint; readonly address: string; readonly data: string }

/** The events the store emitted in a settled hop: its outputs that decode exactly as the event's declared payload. */
function storedEvents(world: World, result: PerCallProxyCallResult): Stored[] {
  const journal = compiled().Journal!;
  const [idType, eventType] = journal.events![0]!.parameters.map((parameter) => parameter.type);
  const structs = journal.structs ?? journal.stateLayout?.structs;
  const stored: Stored[] = [];
  for (const output of result.transaction.outputs) {
    const commitment = output.token?.nft?.commitment;
    if (commitment === undefined || binToHex(output.token!.category) !== world.journal.proxy) continue;
    try {
      const id = decodePushdataValue(commitment, 0, idType!, structs);
      const event = decodePushdataValue(commitment, id.bytesConsumed, eventType!, structs);
      if (id.bytesConsumed + event.bytesConsumed !== commitment.length) continue;
      const fields = event.value as Record<string, StateValue>;
      stored.push({
        id: BigInt(id.value as bigint),
        type: BigInt(fields.type_ as bigint),
        address: binToHex(fields.address_ as Uint8Array),
        data: binToHex(fields.data_ as Uint8Array),
      });
    } catch {
      // A record or node of the store's own category, which is not an event payload.
    }
  }
  return stored;
}

/** The hop settled and broadcast, and the store emitted exactly `expected`. */
function expectStored(world: World, outcome: Outcome, expected: Stored): void {
  expect(outcome.error).toBeUndefined();
  expect(outcome.result!.verdicts.every((verdict) => verdict.accepted)).toBe(true);
  expect(outcome.result!.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  expect(outcome.coinLive).toBe(false);
  expect(storedEvents(world, outcome.result!)).toStrictEqual([expected]);
}

/** The hop settled and broadcast, with nothing of the store's asserted. */
function expectSettled(outcome: Outcome): void {
  expect(outcome.error).toBeUndefined();
  expect(outcome.result!.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  expect(outcome.coinLive).toBe(false);
}

/** The event bytes the one planned store call states for `field` (`address_` or `data_`). */
function statedEvent(outcome: Outcome, field: 'address_' | 'data_'): string {
  const call = outcome.stated.at(-1)!;
  return binToHex((call[1] as unknown as FunctionArgument[])[field === 'address_' ? 1 : 2] as Uint8Array);
}

/** A stored refund-shaped event: kind 10 carrying one packed 20-byte identity and no data. */
const refunded = (who: Uint8Array): Stored => ({ id: JOB, type: 10n, address: binToHex(who), data: '' });

/** Deploys the plain splitter, then the store and the root behind generated proxies; the store gates on the root. */
async function deployWorld(): Promise<World> {
  const { Journal, Desk, Splitter } = compiled();
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = wallet.unlock.spend(alicePub, signature);
  const changeAddress = wallet.address;
  let serial = 0x90;
  const nextCoin = (): Utxo => {
    serial += 1;
    return funding(category(serial.toString(16)));
  };
  await network.addUtxo(wallet.address, funding(SPLITTER_CATEGORY));
  await deployStatefulContract(Splitter!, [0n], {
    fundingUtxo: funding(SPLITTER_CATEGORY), funder, changeAddress, provider: network,
  });
  for (const id of [JOURNAL_IMPL_CATEGORY, JOURNAL_PROXY_CATEGORY, DESK_IMPL_CATEGORY, DESK_PROXY_CATEGORY]) {
    await network.addUtxo(wallet.address, funding(id));
  }
  await fundShippedFacets(network);
  const journalInit = nextCoin();
  await network.addUtxo(binToHex(ALICE_LOCK), journalInit);
  const journal = await deployPerCallProxy({
    provider: network,
    implementationArtifact: Journal!,
    proxyArtifact: buildProxyArtifact(Journal!),
    implementationDeploy: { fundingUtxo: funding(JOURNAL_IMPL_CATEGORY), funder, changeAddress },
    proxyDeploy: { fundingUtxo: funding(JOURNAL_PROXY_CATEGORY), funder, changeAddress },
    initialize: { functionName: 'initialize', args: [addressOf(DESK_PROXY_CATEGORY)] },
    callerLockingBytecode: ALICE_LOCK,
    callerFunding: { utxo: journalInit, funder: CREATOR.funder, changeAddress },
    vm: compositionMachine(),
  });
  expect(journal.initialize.broadcast).toBeDefined();
  const deskInit = nextCoin();
  await network.addUtxo(binToHex(ALICE_LOCK), deskInit);
  const desk = await deployPerCallProxy({
    provider: network,
    implementationArtifact: Desk!,
    proxyArtifact: buildProxyArtifact(Desk!),
    implementationDeploy: { fundingUtxo: funding(DESK_IMPL_CATEGORY), funder, changeAddress },
    proxyDeploy: { fundingUtxo: funding(DESK_PROXY_CATEGORY), funder, changeAddress },
    initialize: { functionName: 'initialize', args: [journal.proxy.address, addressOf(SPLITTER_CATEGORY)] },
    callerLockingBytecode: ALICE_LOCK,
    callerFunding: { utxo: deskInit, funder: CREATOR.funder, changeAddress },
    vm: compositionMachine(),
  });
  expect(desk.initialize.broadcast).toBeDefined();
  return {
    network,
    desk: { proxy: desk.proxy.categoryId, implementation: desk.implementation.categoryId },
    journal: { proxy: journal.proxy.categoryId, implementation: journal.implementation.categoryId },
    externals: {
      IJournal: {
        artifact: Journal!,
        categoryId: journal.proxy.categoryId,
        proxyArtifact: buildProxyArtifact(Journal!),
        implementationCategoryId: journal.implementation.categoryId,
      },
      ISplitter: { artifact: Splitter!, categoryId: SPLITTER_CATEGORY },
    },
    changeAddress,
    nextCoin,
  };
}

describe.runIf(process.env.PER_CALL_AHEAD === '1')('ahead: an address packed into a store call\'s argument', () => {
  it('publishes the fixture\'s struct field reads untyped and the controls typed', () => {
    expect(compiled().Desk!.composition!.refusedEntries ?? []).toStrictEqual([]);
    // `refund` and `arbitrate` read through the storage pointer, `refuseArbitration` through its inlined index read,
    // exactly as the fixture's MarketplaceV1 publishes them: no type on the address field, none on the packed value.
    expect(eventArgs('packField')[1]).toStrictEqual(packedUntyped(roleRead('arbitrator', 'stateAccess')));
    expect(eventArgs('refund')[1]).toStrictEqual({
      kind: 'ternary', condition: { kind: 'literal', type: 'bool', value: true },
      ifTrue: packedUntyped(roleRead('worker', 'stateAccess')),
      ifFalse: packedUntyped(roleRead('arbitrator', 'stateAccess')),
    });
    expect(eventArgs('refuseArbitration')[1]).toStrictEqual({
      kind: 'ternary', condition: { kind: 'literal', type: 'bool', value: false },
      ifTrue: packedUntyped(roleRead('worker', 'arrayAccess')),
      ifFalse: packedUntyped(roleRead('arbitrator', 'arrayAccess')),
    });
    const arbitration = eventArgs('arbitrate')[2]!;
    expect(arbitration.fields).toStrictEqual(['', '', '', '', '', '', '']);
    expect(arbitration.args![5]).toStrictEqual(roleRead('worker', 'stateAccess'));
    expect(arbitration.args![1]).toMatchObject({ kind: 'arrayAccess', left: { kind: 'producerResult' } });
    // The local array element is published as the array's allocation, before the element was written.
    expect(eventArgs('packLocal')[1]).toStrictEqual(packedUntyped({
      kind: 'arrayAccess',
      left: { kind: 'newArray', type: 'address', args: [{ kind: 'literal', type: 'bigint', value: '1' }] },
      right: { kind: 'literal', type: 'bigint', value: '0' },
    } as Published));
    // The controls carry their type: the cast in `fields`, `msg.sender` on its source, the parameter in the ABI.
    expect(eventArgs('packCast')[1]!.fields).toStrictEqual(['address']);
    expect(eventArgs('packSender')[1]!.args).toStrictEqual([
      { kind: 'source', source: { kind: 'msgSender' }, type: 'address' },
    ]);
    expect(eventArgs('packParam')[1]!.args).toStrictEqual([
      { kind: 'source', source: { kind: 'forward', paramIndex: 1 } },
    ]);
  });

  let world: World;
  it('setup: the splitter, the store and the root deploy, and a job is opened and taken', async () => {
    world = await deployWorld();
    expectSettled(await enter(world, 'open', ['Create a marketplace', CAROL_LOCK], CREATOR));
    expectSettled(await enter(world, 'take', [JOB], WORKER));
  }, 600_000);

  it('an `address` parameter, an explicit `address(...)` and `msg.sender` settle with 20 bytes (controls)', async () => {
    expectStored(world, await enter(world, 'packParam', [JOB, CAROL_LOCK], CREATOR), refunded(carolPkh));
    expectStored(world, await enter(world, 'packCast', [JOB], CREATOR), refunded(carolPkh));
    expectStored(world, await enter(world, 'packSender', [JOB], CREATOR), refunded(alicePkh));
  }, 600_000);

  it('a struct field address settles with its 20-byte identity, the value the plan states', async () => {
    const outcome = await enter(world, 'packField', [JOB], CREATOR);
    // Before the evaluator read the declared type, the plan stated the stored lock (`76a914..88ac`) and the entry was
    // refused at the call's line.
    expectStored(world, outcome, refunded(carolPkh));
    expect(statedEvent(outcome, 'address_')).toBe(binToHex(carolPkh));
  }, 300_000);

  it('a local array element written after its allocation is refused: the plan states the allocation', async () => {
    const outcome = await enter(world, 'packLocal', [JOB], CREATOR);
    // The refund's whitelist note (52, 53) has this shape. The body packs the worker's 20 bytes. Owner: the
    // compiler publishes the local's initializer and drops the element write that follows it
    // (`SymbolTableTraversal.serializeExpression`, a local resolved through `resolveInitializer`), so the hop states
    // an empty `address_` and the call's argument digest refuses it.
    expect(outcome.error).toBeInstanceOf(PerCallProxyDeployError);
    expect(outcome.error!.message).toContain('the implementation\'s "packLocal" entry did not settle through the proxy: '
      + `frame "implementation-master" of Desk.packLocal() at line ${lineOf('IJournal(journal).publishJobEvent')}: `
      + 'no source message (Program failed an OP_VERIFY operation.)');
    expect(outcome.stalls).toStrictEqual(['PER_CALL_DERIVATION_STALLED: master "implementation-master" of '
      + 'Desk.packLocal() filled no witness at site 1 (close of segment 0)']);
    expect(statedEvent(outcome, 'address_')).toBe('');
    expect(outcome.coinLive).toBe(true);
  }, 300_000);

  it('the arbitration\'s data without its amounts (59-62) settles with the shares, the reason and the worker', async () => {
    const outcome = await enter(world, 'arbitrateShares', [JOB, 8000n, 2000n, REASON], ARBITRATOR);
    // Imported Solidity packs a `uint16` at its natural width, big-endian, and the worker as its 20 bytes.
    const data = `1f4007d0${binToHex(REASON)}${binToHex(bobPkh)}`;
    expectStored(world, outcome, { id: JOB, type: 12n, address: '', data });
    expect(statedEvent(outcome, 'data_')).toBe(data);
  }, 300_000);

  it('the arbitration with its amounts (59-62) settles the split first, which refuses its own record write', async () => {
    const outcome = await enter(world, 'arbitrate', [JOB, 8000n, 2000n, REASON], ARBITRATOR);
    // The event's data carries `split`'s amounts, so the hop plans in execution order: it stops before the store
    // call, settles `split`'s frame alone to learn them, and that frame refuses: `split` writes its own record
    // (`calls = calls + 1`), which the hop declares kept. The store call is never planned (`stated` holds `split`'s
    // argument only). Owner: the SDK hop, a callee's own record write (`proxy/deploy.ts`, the callee frames
    // `buildHopPlan` declares kept; DESIGN_REACHED_STATE_PLANNING.md, stage 3). Behind it, the evaluator packs an
    // untyped `uint256` element little-endian (`asBytes`) where the body packs it big-endian.
    expect(outcome.error).toBeInstanceOf(PerCallProxyDeployError);
    expect(outcome.error!.message).toBe('the call\'s callee "Splitter.split()" did not settle through the proxy: '
      + `frame "callee-master-1" of Splitter.split() at line ${lineOf('function split(uint256 amount_) public')}: `
      + 'no source message (Program failed an OP_VERIFY operation.)');
    expect(outcome.stalls).toStrictEqual([]);
    expect(outcome.stated).toStrictEqual([[1000n]]);
    expect(outcome.coinLive).toBe(true);
  }, 300_000);

  it('the refund\'s note (52, 53) settles with the worker\'s 20 bytes', async () => {
    const outcome = await enter(world, 'refund', [JOB], WORKER);
    expectStored(world, outcome, refunded(bobPkh));
    expect(statedEvent(outcome, 'address_')).toBe(binToHex(bobPkh));
  }, 300_000);

  it('the arbitration refusal of a taken job (65) settles with the arbitrator\'s 20 bytes', async () => {
    expectSettled(await enter(world, 'take', [JOB], WORKER));
    const outcome = await enter(world, 'refuseArbitration', [JOB], ARBITRATOR);
    expectStored(world, outcome, refunded(carolPkh));
    expect(statedEvent(outcome, 'address_')).toBe(binToHex(carolPkh));
  }, 600_000);
});
