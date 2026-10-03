import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin, utf8ToBin } from '@bitauth/libauth';
import { VALUE_INLINE_LIMIT, bytesToHex, sha256, validatorAddress } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import {
  buildProxyArtifact, callPerCallProxyEntry, deployPerCallProxy, type PerCallProxyCallResult,
} from '../../../src/per-call/proxy/index.js';
import { readPerCallEntry } from '../../../src/per-call/read/index.js';
import type { Utxo } from '../../../src/interfaces.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * A long `string` or `bytes` mapping value the body builds itself, written where the hop has to learn it.
 *
 * Each entry stores `abi.encodePacked` of two of its arguments, so the artifact publishes no value source and the hop
 * plans the write with its run of chunk records unstated: the body's own chunk pin stops on the count it computed,
 * with the value and its digest beside it, and the hop plans the write again from that value. A `string` or `bytes`
 * value is held in its node and chunks as its own bytes, not as a pushdata encoding, so a learned value is checked
 * in that form; checked as a pushdata encoding, it was refused and the pin refused the write again (an OP_VERIFY at
 * the write's line). Each value is written to a key no node holds and then rewritten with a longer one, and read
 * back: through the entry of a proxied contract, through a call into a plain one, and inside a writer whose call leads
 * to a frame reading the value back before the writer settles.
 */

/** A 32-byte category or txid that is neither one repeated byte nor a palindrome, taken from its label. */
function idOf(label: string): string {
  return bytesToHex(sha256(utf8ToBin(`computed long mapping value ${label}`)));
}

const STORE_CATEGORY = idOf('store');
const CHECKER_CATEGORY = idOf('checker');
const ROOT_IMPL_CATEGORY = idOf('root implementation');
const ROOT_PROXY_CATEGORY = idOf('root proxy');
const ROOT_INIT_TXID = idOf('root initialize coin');
const ALICE_LOCK = encodeLockingBytecodeP2pkh(alicePkh);
const KEY = 5n;

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'interface IStore {',
  '  function note(uint256 k, string calldata a, string calldata b) external;',
  '  function blob(uint256 k, bytes calldata a, bytes calldata b) external;',
  '  function noteChecked(uint256 k, string calldata a, string calldata b, uint256 expected) external;',
  '  function noteLength(uint256 k) external view returns (uint256);',
  '}',
  'interface IChecker { function check(uint256 k) external returns (uint256); }',
  'contract Store {',
  '  address public checker;',
  '  mapping(uint256 => string) notes;',
  '  mapping(uint256 => bytes) blobs;',
  '  constructor(address checker_) { checker = checker_; }',
  '  function note(uint256 k, string calldata a, string calldata b) external {',
  '    notes[k] = string(abi.encodePacked(a, " - ", b));',
  '  }',
  '  function blob(uint256 k, bytes calldata a, bytes calldata b) external { blobs[k] = abi.encodePacked(a, b); }',
  '  function noteChecked(uint256 k, string calldata a, string calldata b, uint256 expected) external {',
  '    notes[k] = string(abi.encodePacked(a, " - ", b));',
  '    require(IChecker(checker).check(k) == expected, "seen");',
  '  }',
  '  function noteLength(uint256 k) external view returns (uint256) { return bytes(notes[k]).length; }',
  '  function noteOf(uint256 k) external view returns (string memory) { return notes[k]; }',
  '  function blobOf(uint256 k) external view returns (bytes memory) { return blobs[k]; }',
  '}',
  'contract Checker {',
  '  address public store;',
  '  constructor(address store_) { store = store_; }',
  '  function check(uint256 k) external returns (uint256) { return IStore(store).noteLength(k); }',
  '}',
  'contract Root {',
  '  address public implementation;',
  '  address public store;',
  '  mapping(uint256 => string) notes;',
  '  mapping(uint256 => bytes) blobs;',
  '  function initialize(address store_) public { store = store_; }',
  '  function note(uint256 k, string calldata a, string calldata b) public {',
  '    notes[k] = string(abi.encodePacked(a, " - ", b));',
  '  }',
  '  function blob(uint256 k, bytes calldata a, bytes calldata b) public { blobs[k] = abi.encodePacked(a, b); }',
  '  function relayNote(uint256 k, string calldata a, string calldata b) public { IStore(store).note(k, a, b); }',
  '  function relayBlob(uint256 k, bytes calldata a, bytes calldata b) public { IStore(store).blob(k, a, b); }',
  '  function relayChecked(uint256 k, string calldata a, string calldata b, uint256 expected) public {',
  '    IStore(store).noteChecked(k, a, b, expected);',
  '  }',
  '  function noteOf(uint256 k) public view returns (string memory) { return notes[k]; }',
  '  function blobOf(uint256 k) public view returns (bytes memory) { return blobs[k]; }',
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
const { Store, Checker, Root } = compiled as Required<typeof compiled>;

/**
 * The halves each value is joined from: a first value one chunk long, then a rewrite two chunks long. Neither value
 * starts with a byte a pushdata encoding could start with, so neither reads as one.
 */
const NOTES = [
  ['a note the body joins from two halves', 'and its second half, long enough to chunk'],
  [`a rewritten note ${'x'.repeat(100)}`, 'y'.repeat(60)],
] as const;
const BLOBS = [
  [hexToBin(`c0${'ff'.repeat(40)}`), hexToBin('ee'.repeat(30))],
  [hexToBin('d1'.repeat(90)), hexToBin('e2'.repeat(90))],
] as const;

/** The string a note entry stores. */
const joinedNote = ([a, b]: readonly [string, string]): string => `${a} - ${b}`;
/** The bytes a blob entry stores. */
const joinedBlob = ([a, b]: readonly [Uint8Array, Uint8Array]): string => binToHex(a) + binToHex(b);

/** A per-call contract's address, which its category fixes before anything is deployed. */
const addressOf = (id: string): Uint8Array => validatorAddress(hexToBin(id), VALIDATOR_PROGRAM);

/** A coin a genesis or a hop is funded from; a genesis's txid becomes the category it mints. */
function funding(txid: string): Utxo {
  return { txid, vout: 0, satoshis: 5_000_000n };
}

/** The deployment, the chain as it stood then, and an entry of the root to call on it. */
interface World {
  readonly network: MockNetworkProvider;
  readonly snapshot: SnapshotRestorer;
  readonly rootProxyCategoryId: string;
  readonly enter: (functionName: string, args: readonly FunctionArgument[]) => Promise<PerCallProxyCallResult>;
}

/** The store and the checker plain, and the root behind its generated proxy. */
async function deployWorld(): Promise<World> {
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = wallet.unlock.spend(alicePub, new SignatureTemplate(alicePriv));
  const changeAddress = wallet.address;
  const callerFunder = new SignatureTemplate(alicePriv).unlockP2PKH();
  const plain = [
    [Store, STORE_CATEGORY, [addressOf(CHECKER_CATEGORY)]],
    [Checker, CHECKER_CATEGORY, [addressOf(STORE_CATEGORY)]],
  ] as const;
  for (const [artifact, id, args] of plain) {
    await network.addUtxo(wallet.address, funding(id));
    await deployStatefulContract(artifact!, [...args], {
      fundingUtxo: funding(id), funder, changeAddress, provider: network, threadCount: 4,
    });
  }
  for (const id of [ROOT_IMPL_CATEGORY, ROOT_PROXY_CATEGORY]) await network.addUtxo(wallet.address, funding(id));
  await network.addUtxo(binToHex(ALICE_LOCK), funding(ROOT_INIT_TXID));
  await fundShippedFacets(network);
  const root = await deployPerCallProxy({
    provider: network,
    implementationArtifact: Root!,
    proxyArtifact: buildProxyArtifact(Root!),
    implementationDeploy: { fundingUtxo: funding(ROOT_IMPL_CATEGORY), funder, changeAddress },
    proxyDeploy: { fundingUtxo: funding(ROOT_PROXY_CATEGORY), funder, changeAddress },
    initialize: { functionName: 'initialize', args: [addressOf(STORE_CATEGORY)] },
    callerLockingBytecode: ALICE_LOCK,
    callerFunding: { utxo: funding(ROOT_INIT_TXID), funder: callerFunder, changeAddress },
    vm: compositionMachine(),
  });
  expect(root.initialize.broadcast).toBeDefined();
  let coins = 0;
  const enter = async (functionName: string, args: readonly FunctionArgument[]): Promise<PerCallProxyCallResult> => {
    coins += 1;
    const coin = funding(idOf(`call coin ${coins}`));
    await network.addUtxo(binToHex(ALICE_LOCK), coin);
    return callPerCallProxyEntry({
      provider: network,
      implementationArtifact: Root!,
      proxyArtifact: buildProxyArtifact(Root!),
      proxyCategoryId: root.proxy.categoryId,
      implementationCategoryId: root.implementation.categoryId,
      functionName,
      args,
      externals: {
        IStore: { artifact: Store!, categoryId: STORE_CATEGORY },
        IChecker: { artifact: Checker!, categoryId: CHECKER_CATEGORY },
      },
      callerUtxo: coin,
      callerLockingBytecode: ALICE_LOCK,
      funder: callerFunder,
      changeAddress,
      vm: compositionMachine(),
    });
  };
  return { network, snapshot: await network.takeSnapshot(), rootProxyCategoryId: root.proxy.categoryId, enter };
}

let worldRun: Promise<World> | undefined;

/** One deployment serves every case, each rewinding the chain to it first. */
async function deployed(): Promise<World> {
  worldRun ??= deployWorld();
  const world = await worldRun;
  await world.snapshot.restore();
  return world;
}

/** The hop settled every participant and was broadcast. */
function expectSettled(result: PerCallProxyCallResult): void {
  expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
  expect(result.accepted).toBe(true);
  expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
}

/** One view entry, read from the live records: the root's through its proxy's category, the store's from its own. */
async function readValue(world: World, contract: 'Root' | 'Store', functionName: string): Promise<unknown> {
  const read = await readPerCallEntry({
    provider: world.network,
    artifact: contract === 'Root' ? Root! : Store!,
    categoryId: contract === 'Root' ? world.rootProxyCategoryId : STORE_CATEGORY,
    functionName,
    args: [KEY],
    vm: compositionMachine(),
  });
  expect(read.accepted, read.objection).toBe(true);
  return read.value;
}

/** The value a view entry returned, as the text a note holds or the hex a blob holds. */
const shown = (value: unknown): unknown => (value instanceof Uint8Array ? binToHex(value) : value);

/** Writes each value in turn through `entry` - the first inserts the key, the next rewrites it - and reads it back. */
async function writeEachAndReadBack<T extends FunctionArgument>(
  contract: 'Root' | 'Store', entry: string, view: string,
  values: readonly (readonly [T, T])[], joined: (halves: readonly [T, T]) => string,
): Promise<void> {
  const world = await deployed();
  for (const halves of values) {
    expectSettled(await world.enter(entry, [KEY, ...halves]));
    expect(shown(await readValue(world, contract, view))).toBe(joined(halves));
  }
}

describe('a long string or bytes mapping value the body computes', () => {
  // Every case inserts the key and then rewrites it, so both values have to be past the node's inline limit.
  it('joins values past the inline limit', () => {
    for (const halves of NOTES) expect(utf8ToBin(joinedNote(halves)).length).toBeGreaterThan(VALUE_INLINE_LIMIT);
    for (const halves of BLOBS) expect(joinedBlob(halves).length / 2).toBeGreaterThan(VALUE_INLINE_LIMIT);
  });

  it('settles a string the proxied entry writes, inserted and then rewritten longer', async () => {
    await writeEachAndReadBack('Root', 'note', 'noteOf', NOTES, joinedNote);
  }, 300_000);

  it('settles bytes the proxied entry writes, inserted and then rewritten longer', async () => {
    await writeEachAndReadBack('Root', 'blob', 'blobOf', BLOBS, joinedBlob);
  }, 300_000);

  it('settles a string a callee writes, inserted and then rewritten longer', async () => {
    await writeEachAndReadBack('Store', 'relayNote', 'noteOf', NOTES, joinedNote);
  }, 300_000);

  it('settles bytes a callee writes, inserted and then rewritten longer', async () => {
    await writeEachAndReadBack('Store', 'relayBlob', 'blobOf', BLOBS, joinedBlob);
  }, 300_000);

  it('learns the value before a callee of the writer reads it back, and plans again from it', async () => {
    // The writer rewrites the key and calls the checker, whose own call reads the value's length back from the store:
    // the read runs inside the writer, so the hop learns the value from the writer's pin before the read is judged.
    const world = await deployed();
    expectSettled(await world.enter('relayNote', [KEY, ...NOTES[0]]));
    const length = BigInt(utf8ToBin(joinedNote(NOTES[1])).length);
    expectSettled(await world.enter('relayChecked', [KEY, ...NOTES[1], length]));
    expect(await readValue(world, 'Store', 'noteOf')).toBe(joinedNote(NOTES[1]));
  }, 300_000);
});
