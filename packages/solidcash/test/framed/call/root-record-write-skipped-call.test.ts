import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin, utf8ToBin } from '@bitauth/libauth';
import {
  buildPushdataCommitment, bytesToHex, parsePushdataCommitment, sha256, validatorAddress, type RecordEntry,
} from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { readPerCallDeployment } from '../../../src/per-call/deploy/index.js';
import { readComputedDeclaration } from '../../../src/per-call/deploy/declaration.js';
import {
  buildProxyArtifact, callPerCallProxyEntry, deployPerCallProxy, type PerCallProxyCallResult,
} from '../../../src/per-call/proxy/index.js';
import { deploymentStateValues } from '../../../src/per-call/proxy/external-calls.js';
import { readPerCallEntry } from '../../../src/per-call/read/index.js';
import { participant, type CompositionDraft } from '../../../src/per-call/composer/index.js';
import type { Utxo } from '../../../src/interfaces.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * A proxied root that writes a field of its own record and then guards a call on it, on the side that skips the
 * call and on the side that makes it.
 *
 * `Ledger` sits behind a generated proxy and is entered directly, so its entry is the hop's root frame. The guard
 * reads the field the entry writes, or the argument it writes the field from, and a second write after the call
 * reads the field again. A body whose calls vary closes the segment its own calls have reached: the record is
 * declared written in the segment the write lands in, which on the side that skips the call is the last one, closed
 * at the body's end, while on the side that makes the call the record is held kept past it. A read after the guard
 * takes the value the run holds on each side. Each side settles, broadcasts and reads its values back from the chain.
 *
 * The hop decides the guard, and states the call's argument, from the value the write leaves: the compiler publishes
 * a read of a field the entry's own dominating statements write as the value they leave, and a guard over a write it
 * cannot follow is refused by name. The transaction cannot forge the record: where the call is skipped the end's
 * close leaves the record to the epilogue, which closes it against the view the body rebuilds, and where the call
 * is made the end holds the record kept, so the segment past the call cannot rewrite the record the write left.
 */

/** A 32-byte category or txid that is neither one repeated byte nor a palindrome, taken from its label. */
function idOf(label: string): string {
  return bytesToHex(sha256(utf8ToBin(`root record write skipped call ${label}`)));
}

const SINK_CATEGORY = idOf('sink');
const ALICE_LOCK = encodeLockingBytecodeP2pkh(alicePkh);
const ENTRY = 'implementation-master';

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'interface ISink { function take(uint256 amount) external; }',
  'contract Sink {',
  '  uint256 public taken;',
  '  function take(uint256 amount) external { taken = amount; }',
  '}',
  'contract Ledger {',
  '  address public implementation;',
  '  address public sink;',
  '  uint256 public total;',
  '  function initialize(address sink_) public { sink = sink_; }',
  '  function setThenRelayIfHigh(uint256 amount) public {',
  '    total = amount;',
  '    if (total > 10) { ISink(sink).take(total); }',
  '  }',
  '  function setThenRelayIfAmountHigh(uint256 amount) public {',
  '    total = amount;',
  '    if (amount > 10) { ISink(sink).take(total); }',
  '  }',
  '  function setRelayThenBump(uint256 amount) public {',
  '    total = amount;',
  '    if (total > 10) { ISink(sink).take(total); }',
  '    total = total + 1;',
  '  }',
  '  function countThenRelayIfHigh(uint256 times) public {',
  '    for (uint256 i = 0; i < times; i++) { total = total + 1; }',
  '    if (total > 10) { ISink(sink).take(1); }',
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
  composition: 'per-call',
} as const;

const compiled = compileStringMulti(SOURCE, FIXTURE_OPTIONS as never);
const { Sink, Ledger } = compiled as Required<typeof compiled>;
const ledgerProxy = buildProxyArtifact(Ledger!);

/** A per-call contract's address, which its category fixes before anything is deployed. */
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
  /** Enters one ledger entry with a fresh coin of the caller's, handing back the coin beside the hop or its error. */
  readonly enter: (functionName: string, args: readonly FunctionArgument[]) => Promise<Entered>;
}

/** One entered call: the hop it settled or the error it was refused with, and the coin the caller paid with. */
interface Entered {
  readonly result?: PerCallProxyCallResult;
  readonly error?: Error;
  readonly coin: Utxo;
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
  const deployment = await deployPerCallProxy({
    provider: network,
    implementationArtifact: Ledger!,
    proxyArtifact: ledgerProxy,
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
  const enter = async (functionName: string, args: readonly FunctionArgument[]): Promise<Entered> => {
    coins += 1;
    const coin = funding(idOf(`call coin ${coins}`));
    await network.addUtxo(binToHex(ALICE_LOCK), coin);
    try {
      return {
        coin,
        result: await callPerCallProxyEntry({
          provider: network,
          implementationArtifact: Ledger!,
          proxyArtifact: ledgerProxy,
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
        }),
      };
    } catch (error) {
      return { coin, error: error as Error };
    }
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
): Promise<PerCallProxyCallResult> {
  const { result, error } = await world.enter(functionName, args);
  expect(error).toBeUndefined();
  expect(result!.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
  expect(result!.accepted).toBe(true);
  expect(result!.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  return result!;
}

/** The sink entries a hop ran, in the order the derivation completed them. */
const sinkFrames = (result: PerCallProxyCallResult): readonly string[] => result.completed
  .map((frame) => frame.functionName).filter((name) => name.startsWith(`${Sink!.contractName}.`));

/** What the sink's view reads from its live record. */
async function sinkTaken(world: World): Promise<unknown> {
  const read = await readPerCallEntry({
    provider: world.network, artifact: Sink!, categoryId: SINK_CATEGORY, functionName: 'taken', args: [],
    vm: compositionMachine(),
  });
  expect(read.accepted, read.objection).toBe(true);
  return read.value;
}

/** The ledger's own field as its live record holds it. */
async function ledgerTotal(world: World): Promise<unknown> {
  const layout = ledgerProxy.stateLayout!;
  return deploymentStateValues(layout, world.proxyCategoryId,
    await readPerCallDeployment(world.network, world.proxyCategoryId, layout)).total;
}

/** Settles one guarded entry and reads back the ledger's field and the sink's, naming the sink frames the hop ran. */
async function guarded(
  world: World, functionName: string, args: readonly FunctionArgument[],
): Promise<{ readonly frames: readonly string[]; readonly total: unknown; readonly taken: unknown }> {
  const result = await settle(world, functionName, args);
  return { frames: sinkFrames(result), total: await ledgerTotal(world), taken: await sinkTaken(world) };
}

/** The sink frame a hop runs when the guard holds. */
const TAKEN = [`${Sink!.contractName}.take()`];

/** True when the machine accepts the entry's own frame on the draft as it now stands. */
function entryAccepts(draft: CompositionDraft): boolean {
  const vm = compositionMachine();
  return vm.stateSuccess(vm.evaluate(draft.programFor(ENTRY))) === true;
}

/** The ledger record's entry in each segment the entry's block declares. */
function recordEntries(draft: CompositionDraft): RecordEntry[] {
  const field = ledgerProxy.stateLayout!.variables.find((variable) => variable.name === 'total')!;
  const index = participant(draft.layout, `proxy-record-${field.nftIndex}`).index;
  return draft.blockOf(ENTRY).segments.map((segment) => segment.find((entry) => entry.in === index)!);
}

/** A record view with the ledger's field set to `total`, every other field as `view` holds it. */
function withTotal(view: Uint8Array, total: bigint): Uint8Array {
  const layout = ledgerProxy.stateLayout!;
  const field = layout.variables.find((variable) => variable.name === 'total')!;
  const values = parsePushdataCommitment(binToHex(view), layout, field.nftIndex);
  return hexToBin(buildPushdataCommitment(layout, { ...values, total }, field.nftIndex));
}

/** The view the entry's frame declares and the one its code computes at the close it fails on. */
function failedClose(draft: CompositionDraft): readonly [string, string] | undefined {
  const reading = readComputedDeclaration({
    vm: compositionMachine(), program: draft.programFor(ENTRY), maximumCommitmentBytes: 128,
  });
  return reading.ok ? [binToHex(reading.declared), binToHex(reading.computed)] : undefined;
}

describe('a proxied root that writes its own record and then guards a call on it', () => {
  it('settles a guard on the written field on the side that skips the call and on the side that makes it', async () => {
    const world = await deployed();
    expect(await guarded(world, 'setThenRelayIfHigh', [5n])).toStrictEqual({ frames: [], total: 5n, taken: 0n });
    expect(await guarded(world, 'setThenRelayIfHigh', [11n])).toStrictEqual({ frames: TAKEN, total: 11n, taken: 11n });
    // A skip after the call rewrites the record and leaves the sink where the call left it.
    expect(await guarded(world, 'setThenRelayIfHigh', [4n])).toStrictEqual({ frames: [], total: 4n, taken: 11n });
  }, 600_000);

  it('settles a guard on the argument the field is written from, on either side', async () => {
    const world = await deployed();
    expect(await guarded(world, 'setThenRelayIfAmountHigh', [5n]))
      .toStrictEqual({ frames: [], total: 5n, taken: 0n });
    expect(await guarded(world, 'setThenRelayIfAmountHigh', [12n]))
      .toStrictEqual({ frames: TAKEN, total: 12n, taken: 12n });
  }, 600_000);

  it('settles a second write after the call from the value the run holds on either side', async () => {
    const world = await deployed();
    expect(await guarded(world, 'setRelayThenBump', [5n])).toStrictEqual({ frames: [], total: 6n, taken: 0n });
    expect(await guarded(world, 'setRelayThenBump', [11n])).toStrictEqual({ frames: TAKEN, total: 12n, taken: 11n });
  }, 600_000);

  it('refuses by name a guard over a write the compiler cannot follow, and broadcasts nothing', async () => {
    const world = await deployed();
    const { result, error, coin } = await world.enter('countThenRelayIfHigh', [3n]);
    expect(result).toBeUndefined();
    expect(error?.message).toBe('the call to "ISink.take" is guarded by "total", which the entry\'s own body writes '
      + 'before the call in a way its published facts do not state, so the hop cannot decide whether the call is made');
    const live = await world.network.getUtxosForLockingBytecode(ALICE_LOCK);
    expect(live.some((utxo) => utxo.txid === coin.txid)).toBe(true);
    expect(await ledgerTotal(world)).toBe(0n);
  }, 600_000);

  it('refuses a record declared at a value the write did not leave where the call is skipped', async () => {
    const world = await deployed();
    const draft = (await settle(world, 'setThenRelayIfHigh', [6n])).draft;
    const [written] = recordEntries(draft);
    expect(recordEntries(draft)).toHaveLength(1);
    expect(entryAccepts(draft)).toBe(true);
    // The end does not hold the record kept, so the epilogue's close is what meets the forged view.
    const honest = written!.viewOut;
    const forged = withTotal(honest, 11n);
    written!.viewOut = forged;
    expect(entryAccepts(draft)).toBe(false);
    expect(failedClose(draft)).toStrictEqual([binToHex(forged), binToHex(honest)]);
    written!.viewOut = honest;
    expect(entryAccepts(draft)).toBe(true);
  }, 600_000);

  it('holds the record kept past the call where the call is made', async () => {
    const world = await deployed();
    const draft = (await settle(world, 'setThenRelayIfHigh', [13n])).draft;
    const [written, past] = recordEntries(draft);
    expect(binToHex(past!.viewIn)).toBe(binToHex(written!.viewOut));
    expect(binToHex(past!.viewOut)).toBe(binToHex(written!.viewOut));
    expect(entryAccepts(draft)).toBe(true);
    // A view past the call other than the one the segment began with is a rewrite no code of the frame makes there.
    const kept = past!.viewOut;
    const forged = withTotal(kept, 7n);
    past!.viewOut = forged;
    expect(entryAccepts(draft)).toBe(false);
    expect(failedClose(draft)).toStrictEqual([binToHex(forged), binToHex(kept)]);
    past!.viewOut = kept;
    expect(entryAccepts(draft)).toBe(true);
  }, 600_000);
});
