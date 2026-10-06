import { describe, expect, it, vi } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { decodePushdataValue, validatorAddress, type StateValue } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import * as resolution from '../../../src/framed/proxy/call-resolution.js';
import {
  FramedProxyDeployError, buildProxyArtifact, callFramedProxyEntry, deployFramedProxy,
  type FramedProxyCallResult,
} from '../../../src/framed/proxy/index.js';
import type { FramedProxyExternal } from '../../../src/framed/proxy/external-calls.js';
import type { Unlocker, Utxo } from '../../../src/interfaces.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * Walls ahead: an integer packed with `abi.encodePacked` into a store call's argument, through the shipped hop
 * (`callFramedProxyEntry`), compiled with the fixture's options (`solidityImportCompat` among them).
 *
 * The body packs an integer by its declared type (`emitEvmPackedValue`): its natural width, big-endian. The compiler
 * publishes a parameter, a cast and a one-level struct field typed, but a nested struct field, an element of an
 * array field or of an array literal, and a state variable with no type (`fields: ['']`), and the SDK's evaluator
 * packed an untyped number as 32 bytes little-endian, so the call's argument digest differed and the hop was refused
 * (measured at 8fcb48d4a): `arbitrate`'s `amounts[i]` (#59-#62), an element of an earlier call's `uint256[5]`
 * result, is that shape once the hop can state the result. The evaluator now packs such a read by its declared type
 * (`stateful/sc-evaluate-external-expression.ts`, `packedReadType`), so `Desk` (a proxied root) settles each read
 * into the proxied store `Journal` with the bytes the body packs. The file runs only under `FRAMED_AHEAD=1`.
 */

/** A 32-byte value with varied bytes, `seed` chosen so each name is distinct. */
function category(seed: string): string {
  const base = '5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0';
  return `${seed}${base}${base}`.slice(0, 64);
}

const JOURNAL_IMPL_CATEGORY = category('1a');
const JOURNAL_PROXY_CATEGORY = category('2b');
const DESK_IMPL_CATEGORY = category('3c');
const DESK_PROXY_CATEGORY = category('4d');

/** A framed contract's address, which its category fixes before anything is deployed. */
const addressOf = (id: string): Uint8Array => validatorAddress(hexToBin(id), VALIDATOR_PROGRAM);

const ALICE_LOCK = encodeLockingBytecodeP2pkh(alicePkh);
const JOB = 0n;
const AMOUNT = 1000n;
const MAX_TIME = 86_400n;

/** One root entry that writes the job and packs `value` into the note it sends the store. */
const packEntry = (name: string, value: string, parameters = ''): string[] => [
  `  function ${name}(uint256 jobId_${parameters}) public {`,
  '    JobPost storage job = jobs[jobId_];',
  '    job.escrowId = job.escrowId + 1;',
  `    publishJobEvent(jobId_, JobEventData(12, bytes(""), abi.encodePacked(${value}), 0));`,
  '  }',
];

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'struct JobEventData { uint8 type_; bytes address_; bytes data_; uint32 timestamp_; }',
  'interface IJournal { function publishJobEvent(uint256 jobId_, JobEventData memory event_) external; }',
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
  'contract Desk {',
  '  struct JobTerms { uint256 amount; uint32 maxTime; }',
  '  struct JobPost {',
  '    uint8 state; string title; uint256 escrowId; uint256 amount; uint32 maxTime; JobTerms terms; uint256[5] amounts;',
  '  }',
  '  address public implementation;',
  '  address public journal;',
  '  uint256 public count;',
  '  JobPost[] public jobs;',
  '  function initialize(address journal_) public { journal = journal_; }',
  '  function publishJobEvent(uint256 jobId_, JobEventData memory event_) internal {',
  '    IJournal(journal).publishJobEvent(jobId_, event_);',
  '  }',
  '  function open(string calldata title_, uint256 amount_, uint32 maxTime_) public {',
  '    jobs.push();',
  '    uint256 jobId = jobs.length - 1;',
  '    JobPost storage job = jobs[jobId];',
  '    job.title = title_;',
  '    job.amount = amount_;',
  '    job.maxTime = maxTime_;',
  '    job.terms.amount = amount_ * 3;',
  '    job.terms.maxTime = maxTime_ + 1;',
  '    job.amounts[1] = amount_ * 7;',
  '    count = amount_ + 1;',
  '  }',
  ...packEntry('packParam', 'amount_', ', uint256 amount_'),
  ...packEntry('packCast', 'uint256(job.terms.amount)'),
  ...packEntry('packField', 'job.amount'),
  ...packEntry('packNarrowField', 'job.maxTime'),
  ...packEntry('packNested', 'job.terms.amount'),
  ...packEntry('packNestedNarrow', 'job.terms.maxTime'),
  ...packEntry('packFieldElement', 'job.amounts[1]'),
  ...packEntry('packState', 'count'),
  '  function packLiteralElement(uint256 jobId_, uint256 first_) public {',
  '    jobs[jobId_].escrowId = jobs[jobId_].escrowId + 1;',
  '    uint256[5] memory amounts = [first_, 2, 3, 4, 5];',
  '    publishJobEvent(jobId_, JobEventData(12, bytes(""), abi.encodePacked(amounts[0]), 0));',
  '  }',
  '  function packWrittenElement(uint256 jobId_, uint256 first_) public {',
  '    jobs[jobId_].escrowId = jobs[jobId_].escrowId + 1;',
  '    uint256[5] memory amounts;',
  '    amounts[0] = first_;',
  '    publishJobEvent(jobId_, JobEventData(12, bytes(""), abi.encodePacked(amounts[0]), 0));',
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
  composition: 'framed',
} as const;

type ArtifactMap = ReturnType<typeof compileStringMulti>;
let compiledRun: ArtifactMap | undefined;
/** The contracts, compiled once and only when the file runs. */
function compiled(): ArtifactMap {
  compiledRun ??= compileStringMulti(SOURCE, FIXTURE_OPTIONS as never);
  return compiledRun;
}

/** One published expression node, as far as these checks read it. */
interface Published { readonly kind?: string; readonly args?: readonly Published[]; readonly fields?: readonly string[] }

/** The published `abi.encodePacked(...)` an entry passes as its note's data. */
function packedData(functionName: string): Published {
  const row = compiled().Desk!.abi.find((entry) => entry.name === functionName) as unknown as {
    readonly externalCalls: readonly { readonly argSources: readonly { readonly expression?: Published }[] }[];
  };
  return row.externalCalls[0]!.argSources[1]!.expression!.args![2]!;
}

/** A read of `jobs[id]` through the entry's storage pointer, as the compiler publishes it. */
const JOB_READ = {
  kind: 'stateAccess', name: 'jobs', args: [{ kind: 'source', source: { kind: 'forward', paramIndex: 0 } }], type: 'JobPost',
};
const TERMS_READ = { kind: 'field', name: 'terms', expression: JOB_READ, type: 'JobTerms' };

interface Caller { readonly lock: Uint8Array; readonly funder: Unlocker }

const CREATOR: Caller = { lock: ALICE_LOCK, funder: new SignatureTemplate(alicePriv).unlockP2PKH() };

/** A coin a genesis is funded from; its txid becomes the category it mints. */
function funding(txid: string): Utxo {
  return { txid, vout: 0, satoshis: 5_000_000n };
}

/** One deployment of the store and the root, and the coins its hops are entered with. */
interface World {
  readonly network: MockNetworkProvider;
  readonly desk: { readonly proxy: string; readonly implementation: string };
  readonly journal: { readonly proxy: string; readonly implementation: string };
  readonly externals: Readonly<Record<string, FramedProxyExternal>>;
  readonly changeAddress: string;
  /** Hands out a fresh coin id per hop, distinct from every category. */
  readonly nextCoin: () => Utxo;
}

/** What a hop left: its result or error, and the call arguments its plan stated. */
interface Outcome {
  readonly result?: FramedProxyCallResult;
  readonly error?: Error;
  /** The argument values each planned call states, in parameter order. */
  readonly stated: readonly (readonly FunctionArgument[])[];
  /** Whether the caller's coin is still unspent, i.e. nothing was broadcast from it. */
  readonly coinLive: boolean;
}

/** Enters one root entry through its proxy, and returns what it left. */
async function enter(world: World, functionName: string, args: readonly FunctionArgument[]): Promise<Outcome> {
  const artifact = compiled().Desk!;
  const coin = world.nextCoin();
  await world.network.addUtxo(binToHex(CREATOR.lock), coin);
  const resolved = vi.spyOn(resolution, 'resolvePublishedCall');
  let result: FramedProxyCallResult | undefined;
  let error: Error | undefined;
  try {
    result = await callFramedProxyEntry({
      provider: world.network,
      implementationArtifact: artifact,
      proxyArtifact: buildProxyArtifact(artifact),
      proxyCategoryId: world.desk.proxy,
      implementationCategoryId: world.desk.implementation,
      functionName,
      args,
      externals: world.externals,
      callerUtxo: coin,
      callerLockingBytecode: CREATOR.lock,
      funder: CREATOR.funder,
      changeAddress: world.changeAddress,
      vm: compositionMachine(),
    });
  } catch (caught) {
    error = caught as Error;
  }
  const stated = resolved.mock.results.filter((entry) => entry.type === 'return')
    .map((entry) => (entry.value as resolution.ResolvedCall).argumentValues);
  resolved.mockRestore();
  const live = await world.network.getUtxosForLockingBytecode(CREATOR.lock);
  return {
    ...(result === undefined ? {} : { result }),
    ...(error === undefined ? {} : { error }),
    stated,
    coinLive: live.some((utxo) => utxo.txid === coin.txid && utxo.vout === coin.vout),
  };
}

/** The `data_` bytes of the notes the store emitted in a settled hop: its outputs that decode as the event. */
function storedData(world: World, result: FramedProxyCallResult): string[] {
  const journal = compiled().Journal!;
  const [idType, eventType] = journal.events![0]!.parameters.map((parameter) => parameter.type);
  const structs = journal.structs ?? journal.stateLayout?.structs;
  const stored: string[] = [];
  for (const output of result.transaction.outputs) {
    const commitment = output.token?.nft?.commitment;
    if (commitment === undefined || binToHex(output.token!.category) !== world.journal.proxy) continue;
    try {
      const id = decodePushdataValue(commitment, 0, idType!, structs);
      const event = decodePushdataValue(commitment, id.bytesConsumed, eventType!, structs);
      if (id.bytesConsumed + event.bytesConsumed !== commitment.length) continue;
      stored.push(binToHex((event.value as Record<string, StateValue>).data_ as Uint8Array));
    } catch {
      // A record or node of the store's own category, which is not an event payload.
    }
  }
  return stored;
}

/** The note's data bytes the one planned store call states. */
function statedData(outcome: Outcome): string {
  const call = outcome.stated.at(-1)!;
  return binToHex((call[1] as unknown as FunctionArgument[])[2] as Uint8Array);
}

/** An integer at `width` bytes, big-endian: what the body packs. */
const bigEndian = (value: bigint, width: number): string => value.toString(16).padStart(width * 2, '0');

/** The hop settled and broadcast, the plan stated `data`, and the store kept exactly `data`. */
function expectPacked(world: World, outcome: Outcome, data: string): void {
  expect(outcome.error).toBeUndefined();
  expect(outcome.result!.verdicts.every((verdict) => verdict.accepted)).toBe(true);
  expect(outcome.result!.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  expect(outcome.coinLive).toBe(false);
  expect(statedData(outcome)).toBe(data);
  expect(storedData(world, outcome.result!)).toStrictEqual([data]);
}

/** Deploys the store and the root behind generated proxies; the store gates its writes on the root's address. */
async function deployWorld(): Promise<World> {
  const { Journal, Desk } = compiled();
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = wallet.unlock.spend(alicePub, signature);
  const changeAddress = wallet.address;
  let serial = 0xa0;
  const nextCoin = (): Utxo => {
    serial += 1;
    return funding(category(serial.toString(16)));
  };
  for (const id of [JOURNAL_IMPL_CATEGORY, JOURNAL_PROXY_CATEGORY, DESK_IMPL_CATEGORY, DESK_PROXY_CATEGORY]) {
    await network.addUtxo(wallet.address, funding(id));
  }
  await fundShippedFacets(network);
  const journalInit = nextCoin();
  await network.addUtxo(binToHex(ALICE_LOCK), journalInit);
  const journal = await deployFramedProxy({
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
  const desk = await deployFramedProxy({
    provider: network,
    implementationArtifact: Desk!,
    proxyArtifact: buildProxyArtifact(Desk!),
    implementationDeploy: { fundingUtxo: funding(DESK_IMPL_CATEGORY), funder, changeAddress },
    proxyDeploy: { fundingUtxo: funding(DESK_PROXY_CATEGORY), funder, changeAddress },
    initialize: { functionName: 'initialize', args: [journal.proxy.address] },
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
    },
    changeAddress,
    nextCoin,
  };
}

describe.runIf(process.env.FRAMED_AHEAD === '1')('ahead: an integer packed into a store call\'s argument', () => {
  it('publishes a parameter, a cast and a one-level field typed, and the other reads untyped', () => {
    expect(compiled().Desk!.composition!.refusedEntries ?? []).toStrictEqual([]);
    expect(packedData('packParam')).toStrictEqual({
      kind: 'abiEncodePacked', args: [{ kind: 'source', source: { kind: 'forward', paramIndex: 1 } }], fields: [''],
    });
    expect(packedData('packCast').fields).toStrictEqual(['uint256']);
    expect(packedData('packField').args).toStrictEqual([
      { kind: 'field', name: 'amount', expression: JOB_READ, type: 'uint256' },
    ]);
    expect(packedData('packNarrowField').args![0]).toMatchObject({ kind: 'field', type: 'uint32' });
    // Untyped: a nested field, an element of an array field or of an array literal, a state variable.
    const untyped = (value: object): Published => ({ kind: 'abiEncodePacked', args: [value], fields: [''] });
    expect(packedData('packNested')).toStrictEqual(untyped({ kind: 'field', name: 'amount', expression: TERMS_READ }));
    expect(packedData('packNestedNarrow'))
      .toStrictEqual(untyped({ kind: 'field', name: 'maxTime', expression: TERMS_READ }));
    expect(packedData('packFieldElement')).toStrictEqual(untyped({
      kind: 'arrayAccess',
      left: { kind: 'field', name: 'amounts', expression: JOB_READ, type: 'uint256[5]' },
      right: { kind: 'literal', type: 'bigint', value: '1' },
    }));
    expect(packedData('packState')).toStrictEqual(untyped({ kind: 'state', name: 'count' }));
    expect(packedData('packLiteralElement').args![0]).toMatchObject({ kind: 'arrayAccess', left: { kind: 'array' } });
    // An array written element by element is published as the source the element write left - the parameter that
    // write copied - rather than the bare local identifier it was allocated as.
    expect(packedData('packWrittenElement').args![0]).toStrictEqual({
      kind: 'source', source: { kind: 'forward', paramIndex: 1 },
    });
  });

  let world: World;
  it('setup: the store and the root deploy, and a job is opened', async () => {
    world = await deployWorld();
    const opened = await enter(world, 'open', ['Create a marketplace', AMOUNT, MAX_TIME]);
    expect(opened.error).toBeUndefined();
    expect(opened.coinLive).toBe(false);
  }, 600_000);

  it('a parameter, a cast and a one-level field settle at their natural width, big-endian (controls)', async () => {
    expectPacked(world, await enter(world, 'packParam', [JOB, AMOUNT]), bigEndian(AMOUNT, 32));
    expectPacked(world, await enter(world, 'packCast', [JOB]), bigEndian(AMOUNT * 3n, 32));
    expectPacked(world, await enter(world, 'packField', [JOB]), bigEndian(AMOUNT, 32));
    expectPacked(world, await enter(world, 'packNarrowField', [JOB]), bigEndian(MAX_TIME, 4));
  }, 600_000);

  it('a nested field settles as the body packs it, a `uint32` at four bytes', async () => {
    // Before the evaluator packed by the declared type, the plan stated 32 bytes little-endian and each was refused.
    expectPacked(world, await enter(world, 'packNested', [JOB]), bigEndian(AMOUNT * 3n, 32));
    expectPacked(world, await enter(world, 'packNestedNarrow', [JOB]), bigEndian(MAX_TIME + 1n, 4));
  }, 600_000);

  it('an element of an array field, an array literal\'s element and a state variable settle', async () => {
    // An array field's element is `arbitrate`'s `amounts[i]` shape (59-62), the array there an earlier call's result.
    expectPacked(world, await enter(world, 'packFieldElement', [JOB]), bigEndian(AMOUNT * 7n, 32));
    expectPacked(world, await enter(world, 'packLiteralElement', [JOB, 1234n]), bigEndian(1234n, 32));
    expectPacked(world, await enter(world, 'packState', [JOB]), bigEndian(AMOUNT + 1n, 32));
  }, 600_000);

  it('an element of a local array written element by element settles with the value that write left', async () => {
    const outcome = await enter(world, 'packWrittenElement', [JOB, 1234n]);
    // The compiler follows the local's element write to the source it left - the parameter the write copied - so the
    // hop states that value and the body's own digest is what the argument closes against.
    expectPacked(world, outcome, bigEndian(1234n, 32));
  }, 300_000);
});
