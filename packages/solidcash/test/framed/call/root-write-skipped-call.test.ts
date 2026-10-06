import { describe, expect, it } from 'vitest';
import { bigIntToVmNumber, binToHex, encodeLockingBytecodeP2pkh, hexToBin, utf8ToBin } from '@bitauth/libauth';
import {
  INDEX_NONE, Op, bytesEqual, bytesToHex, sha256, validatorAddress, type RecordEntry,
} from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { decodeEntryCommitment, encodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import { readFramedDeployment } from '../../../src/framed/deploy/index.js';
import { readComputedDeclaration } from '../../../src/framed/deploy/declaration.js';
import {
  buildProxyArtifact, callFramedProxyEntry, deployFramedProxy, type FramedProxyCallResult,
} from '../../../src/framed/proxy/index.js';
import { liveMappingValueReader } from '../../../src/framed/proxy/external-calls.js';
import { declareUnstatedCalls } from '../../../src/framed/proxy/planning-refusal.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import type { CompositionDraft } from '../../../src/framed/composer/index.js';
import type { Utxo } from '../../../src/interfaces.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * A proxied root that writes a mapping node and then guards a call on the node, on the side that skips the call and
 * on the side that makes it.
 *
 * `Ledger` sits behind a generated proxy and is entered directly, so its entry is the hop's root frame. The guard
 * reads a value the entry states (a parameter it writes), one it computes from the node before (learned by settling
 * the entry up to the site), or, with no write of its own, one the deployment holds. A body whose calls vary closes
 * the segment its own calls have reached: the write's records are declared in the segment the write lands in, and
 * when the guard skips the call that segment is the last one, closed at the body's end. Each side settles, broadcasts
 * and reads its values back from the chain.
 *
 * The transaction cannot forge the guard's outcome: a block declaring the call the body skips meets the body's own
 * count of the calls it made, one omitting the call the body makes stops at the site, and a node declared at a value
 * the body did not write meets its write's own close. Past the write's segment the body holds the write's records
 * kept, also where a branch's other arm makes no call, so a later segment cannot rewrite the node the write left.
 */

/** A 32-byte category or txid that is neither one repeated byte nor a palindrome, taken from its label. */
function idOf(label: string): string {
  return bytesToHex(sha256(utf8ToBin(`root write skipped call ${label}`)));
}

const SINK_CATEGORY = idOf('sink');
const ALICE_LOCK = encodeLockingBytecodeP2pkh(alicePkh);
const ENTRY = 'implementation-master';

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'interface ISink { function takeAmount(uint256 k, uint256 amount) external; }',
  'contract Sink {',
  '  mapping(uint256 => uint256) amounts;',
  '  function takeAmount(uint256 k, uint256 amount) external { amounts[k] = amount; }',
  '  function amountOf(uint256 k) external view returns (uint256) { return amounts[k]; }',
  '}',
  'contract Ledger {',
  '  address public implementation;',
  '  address public sink;',
  '  mapping(uint256 => uint256) amounts;',
  '  function initialize(address sink_) public { sink = sink_; }',
  '  function setAmount(uint256 k, uint256 amount) public { amounts[k] = amount; }',
  '  function setThenRelayIfHigh(uint256 k, uint256 amount) public {',
  '    amounts[k] = amount;',
  '    if (amounts[k] > 10) { ISink(sink).takeAmount(k, amounts[k]); }',
  '  }',
  '  function bumpThenRelayIfHigh(uint256 k) public {',
  '    amounts[k] = amounts[k] + 1;',
  '    if (amounts[k] > 10) { ISink(sink).takeAmount(k, amounts[k]); }',
  '  }',
  '  function relayIfHigh(uint256 k) public {',
  '    if (amounts[k] > 10) { ISink(sink).takeAmount(k, amounts[k]); }',
  '  }',
  '  function setThenRelayOrCheck(uint256 k, uint256 amount) public {',
  '    amounts[k] = amount;',
  '    if (amounts[k] > 10) { ISink(sink).takeAmount(k, amounts[k]); } else { require(amount <= 10, "low"); }',
  '  }',
  '}',
].join('\n');

/** Solidity-import compile options, under which a call result crosses the boundary as a Solidity ABI tuple. */
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

const compiled = compileStringMulti(SOURCE, FIXTURE_OPTIONS as never);
const { Sink, Ledger } = compiled as Required<typeof compiled>;

/** A framed contract's address, which its category fixes before anything is deployed. */
const SINK = validatorAddress(hexToBin(SINK_CATEGORY), VALIDATOR_PROGRAM);

/** A coin a genesis or a hop is funded from; a genesis's txid becomes the category it mints. */
function funding(txid: string): Utxo {
  return { txid, vout: 0, satoshis: 5_000_000n };
}

/** The sink plain, the ledger behind its generated proxy, and the chain as it stood once the ledger initialized. */
interface World {
  readonly network: MockNetworkProvider;
  readonly snapshot: SnapshotRestorer;
  readonly proxyCategoryId: string;
  readonly enter: (functionName: string, args: readonly FunctionArgument[]) => Promise<FramedProxyCallResult>;
}

async function deployWorld(): Promise<World> {
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = wallet.unlock.spend(alicePub, new SignatureTemplate(alicePriv));
  const changeAddress = wallet.address;
  const callerFunder = new SignatureTemplate(alicePriv).unlockP2PKH();
  await network.addUtxo(wallet.address, funding(SINK_CATEGORY));
  await deployStatefulContract(Sink!, [], {
    fundingUtxo: funding(SINK_CATEGORY), funder, changeAddress, provider: network, threadCount: 4,
  });
  await fundShippedFacets(network);
  const externals = { ISink: { artifact: Sink!, categoryId: SINK_CATEGORY } };
  const [implementationId, proxyId, initTxid] = ['implementation', 'proxy', 'initialize coin'].map(idOf);
  for (const id of [implementationId!, proxyId!]) await network.addUtxo(wallet.address, funding(id));
  await network.addUtxo(binToHex(ALICE_LOCK), funding(initTxid!));
  const proxyArtifact = buildProxyArtifact(Ledger!);
  const deployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: Ledger!,
    proxyArtifact,
    implementationDeploy: { fundingUtxo: funding(implementationId!), funder, changeAddress, threadCount: 5 },
    proxyDeploy: { fundingUtxo: funding(proxyId!), funder, changeAddress, threadCount: 5 },
    initialize: { functionName: 'initialize', args: [SINK] },
    callerLockingBytecode: ALICE_LOCK,
    callerFunding: { utxo: funding(initTxid!), funder: callerFunder, changeAddress },
    externals,
    vm: compositionMachine(),
  });
  expect(deployment.initialize.accepted).toBe(true);
  let coins = 0;
  const enter = async (functionName: string, args: readonly FunctionArgument[]): Promise<FramedProxyCallResult> => {
    coins += 1;
    const coin = funding(idOf(`call coin ${coins}`));
    await network.addUtxo(binToHex(ALICE_LOCK), coin);
    return callFramedProxyEntry({
      provider: network,
      implementationArtifact: Ledger!,
      proxyArtifact,
      proxyCategoryId: deployment.proxy.categoryId,
      implementationCategoryId: deployment.implementation.categoryId,
      functionName,
      args,
      externals,
      callerUtxo: coin,
      callerLockingBytecode: ALICE_LOCK,
      funder: callerFunder,
      changeAddress,
      vm: compositionMachine(),
    });
  };
  return { network, snapshot: await network.takeSnapshot(), proxyCategoryId: deployment.proxy.categoryId, enter };
}

let worldRun: Promise<World> | undefined;

/** One deployment serves every case, each rewinding the chain to it first. */
async function deployed(): Promise<World> {
  worldRun ??= deployWorld();
  const world = await worldRun;
  await world.snapshot.restore();
  return world;
}

/** Enters one call and requires it to settle every participant and broadcast; hands back the hop. */
async function settle(
  world: World, functionName: string, args: readonly FunctionArgument[],
): Promise<FramedProxyCallResult> {
  const result = await world.enter(functionName, args);
  expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
  expect(result.accepted).toBe(true);
  expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  return result;
}

/** The sink entries a hop ran, in the order the derivation completed them. */
const sinkFrames = (result: FramedProxyCallResult): readonly string[] => result.completed
  .map((frame) => frame.functionName).filter((name) => name.startsWith(`${Sink!.contractName}.`));

/** What the sink's view reads for `k` from its live records. */
async function sinkAmount(world: World, k: bigint): Promise<unknown> {
  const read = await readFramedEntry({
    provider: world.network, artifact: Sink!, categoryId: SINK_CATEGORY, functionName: 'amountOf', args: [k],
    vm: compositionMachine(),
  });
  expect(read.accepted, read.objection).toBe(true);
  return read.value;
}

/** What the ledger's own node for `k` holds on chain, decoded as its body reads it. */
async function ledgerAmount(world: World, k: bigint): Promise<FunctionArgument | undefined> {
  const layout = { ...buildProxyArtifact(Ledger!).stateLayout!, collections: Ledger!.stateLayout!.collections };
  const set = await readFramedDeployment(world.network, world.proxyCategoryId, layout);
  const read = liveMappingValueReader(Ledger!, {
    category: hexToBin(world.proxyCategoryId), recordCommitments: [],
    chunks: [...set.chunks, ...set.collectionNodes], nodesByCollection: set.nodesByCollection,
  }, Ledger!.structs);
  return read('amounts', [k]);
}

/** Settles one guarded entry and reads back the ledger's node and the sink's, naming the sink frames the hop ran. */
async function guarded(
  world: World, functionName: string, args: readonly FunctionArgument[], k: bigint,
): Promise<{ readonly frames: readonly string[]; readonly ledger: unknown; readonly sink: unknown }> {
  const result = await settle(world, functionName, args);
  return { frames: sinkFrames(result), ledger: await ledgerAmount(world, k), sink: await sinkAmount(world, k) };
}

/** The sink frame a hop runs when the guard holds. */
const TAKEN = [`${Sink!.contractName}.takeAmount()`];

/** True when the machine accepts the entry's own frame on the draft as it now stands. */
function entryAccepts(draft: CompositionDraft): boolean {
  const vm = compositionMachine();
  return vm.stateSuccess(vm.evaluate(draft.programFor(ENTRY))) === true;
}

/** The record a segment declares for the node of `k`, at the view it ends with. */
function nodeRecord(segment: readonly RecordEntry[], k: bigint): RecordEntry {
  const slot = keyToSlotMulti([bigIntToVmNumber(k)]);
  return segment.find((record) => record.viewOut.length >= 64
    && bytesEqual(decodeEntryCommitment(record.viewOut).slot, slot))!;
}

describe('a proxied root that writes a mapping node and then guards a call on it', () => {
  it('settles the write its argument states on the side that skips the call and on the side that makes it', async () => {
    const world = await deployed();
    // A node the write creates, then rewrites, below the guard; then one above it.
    expect(await guarded(world, 'setThenRelayIfHigh', [1n, 5n], 1n))
      .toStrictEqual({ frames: [], ledger: 5n, sink: 0n });
    expect(await guarded(world, 'setThenRelayIfHigh', [1n, 7n], 1n))
      .toStrictEqual({ frames: [], ledger: 7n, sink: 0n });
    expect(await guarded(world, 'setThenRelayIfHigh', [2n, 11n], 2n))
      .toStrictEqual({ frames: TAKEN, ledger: 11n, sink: 11n });
    // A skip after the call rewrites the node and leaves the sink where the call left it.
    expect(await guarded(world, 'setThenRelayIfHigh', [2n, 4n], 2n))
      .toStrictEqual({ frames: [], ledger: 4n, sink: 11n });
  }, 600_000);

  it('settles the write it computes from the node before, learned up to the site, on either side', async () => {
    const world = await deployed();
    await settle(world, 'setAmount', [3n, 3n]);
    expect(await guarded(world, 'bumpThenRelayIfHigh', [3n], 3n)).toStrictEqual({ frames: [], ledger: 4n, sink: 0n });
    await settle(world, 'setAmount', [4n, 10n]);
    expect(await guarded(world, 'bumpThenRelayIfHigh', [4n], 4n))
      .toStrictEqual({ frames: TAKEN, ledger: 11n, sink: 11n });
  }, 600_000);

  it('settles a guard on the value the deployment holds, with no write of its own, on either side', async () => {
    const world = await deployed();
    await settle(world, 'setAmount', [5n, 5n]);
    expect(await guarded(world, 'relayIfHigh', [5n], 5n)).toStrictEqual({ frames: [], ledger: 5n, sink: 0n });
    await settle(world, 'setAmount', [6n, 12n]);
    expect(await guarded(world, 'relayIfHigh', [6n], 6n)).toStrictEqual({ frames: TAKEN, ledger: 12n, sink: 12n });
  }, 600_000);

  it('settles both sides when the branch\'s other arm makes no call', async () => {
    const world = await deployed();
    expect(await guarded(world, 'setThenRelayOrCheck', [7n, 6n], 7n))
      .toStrictEqual({ frames: [], ledger: 6n, sink: 0n });
    expect(await guarded(world, 'setThenRelayOrCheck', [8n, 13n], 8n))
      .toStrictEqual({ frames: TAKEN, ledger: 13n, sink: 13n });
  }, 600_000);

  it('refuses a block that declares the guard\'s other side, or a node value the write did not leave', async () => {
    const world = await deployed();
    // The skip side declaring the call: the body makes none, so its count of the calls it made refuses the block.
    const skipped = (await settle(world, 'setThenRelayIfHigh', [9n, 5n])).draft;
    expect(entryAccepts(skipped)).toBe(true);
    const skippedBlock = skipped.blockOf(ENTRY);
    declareUnstatedCalls(skipped, Ledger!, ENTRY);
    expect(skippedBlock.calls).toHaveLength(1);
    const vm = compositionMachine();
    expect(readComputedDeclaration({ vm, program: skipped.programFor(ENTRY), maximumCommitmentBytes: 128 }))
      .toMatchObject({ ok: false, opcode: Op.OP_NUMEQUALVERIFY });
    skippedBlock.calls.pop();
    skippedBlock.segments.pop();
    expect(entryAccepts(skipped)).toBe(true);

    // A node declared at the value the guard would pass: the write's own close hands back the node it rebuilt.
    const written = nodeRecord(skippedBlock.segments[0]!, 9n);
    const honest = written.viewOut;
    const { slot, nextKey } = decodeEntryCommitment(honest);
    const forged = encodeEntryCommitment(slot, nextKey, bigIntToVmNumber(11n));
    written.viewOut = forged;
    const reading = readComputedDeclaration({ vm, program: skipped.programFor(ENTRY), maximumCommitmentBytes: 128 });
    expect(reading.ok).toBe(true);
    if (!reading.ok) return;
    expect([binToHex(reading.declared), binToHex(reading.computed)]).toStrictEqual([binToHex(forged), binToHex(honest)]);
    written.viewOut = honest;

    // The side that makes the call, declaring none: the body reaches the site and finds no record there.
    const taken = (await settle(world, 'setThenRelayIfHigh', [10n, 11n])).draft;
    const takenBlock = taken.blockOf(ENTRY);
    expect(takenBlock.calls).toHaveLength(1);
    const call = takenBlock.calls.pop()!;
    const after = takenBlock.segments.pop()!;
    expect(entryAccepts(taken)).toBe(false);
    takenBlock.calls.push(call);
    takenBlock.segments.push(after);
    expect(entryAccepts(taken)).toBe(true);
  }, 600_000);

  it('holds the write\'s records kept past its segment, also where the other arm makes no call', async () => {
    const world = await deployed();
    for (const [functionName, k] of [['setThenRelayIfHigh', 11n], ['setThenRelayOrCheck', 12n]] as const) {
      const draft = (await settle(world, functionName, [k, 20n])).draft;
      const block = draft.blockOf(ENTRY);
      expect(block.segments).toHaveLength(2);
      expect(entryAccepts(draft)).toBe(true);
      // The node before the written one is relinked in the write's segment and declared again in the next, where
      // nothing writes it: a view it ends with there that the write did not leave is refused.
      const changed = block.segments[0]!.find((record) => record.in !== INDEX_NONE
        && !bytesEqual(record.viewIn, record.viewOut))!;
      const relinked = block.segments[1]!.find((record) => record.in === changed.in)!;
      expect(binToHex(relinked.viewIn)).toBe(binToHex(changed.viewOut));
      const kept = relinked.viewOut;
      const forged = new Uint8Array(kept.length);
      relinked.viewOut = forged;
      expect(entryAccepts(draft), functionName).toBe(false);
      const vm = compositionMachine();
      const reading = readComputedDeclaration({ vm, program: draft.programFor(ENTRY), maximumCommitmentBytes: 128 });
      expect(reading.ok).toBe(true);
      if (!reading.ok) return;
      expect([binToHex(reading.declared), binToHex(reading.computed)]).toStrictEqual([binToHex(forged), binToHex(kept)]);
      relinked.viewOut = kept;
    }
  }, 600_000);
});
