import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin, utf8ToBin } from '@bitauth/libauth';
import { VALUE_INLINE_LIMIT, bytesToHex, sha256, validatorAddress } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import {
  buildProxyArtifact, callFramedProxyEntry, deployFramedProxy, type FramedProxyCallResult,
} from '../../../src/framed/proxy/index.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import type { Utxo } from '../../../src/interfaces.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * A call a callee routes through a value its own mapping holds: an argument, the condition that picks the call, and
 * the address it calls.
 *
 * The callee sits behind a generated proxy and is reached from a root behind another. Its node holds each value in the
 * form its body stores it: a `string` or `bytes` value as its own bytes, inline or across a run of chunk records, an
 * integer or a `bool` as its script number and an address as its locking bytecode. The hop resolves the call the body
 * will make from that value, so it has to read the value in that form; read as a pushdata encoding, each one here
 * comes out as another value or none (its first byte read as a push length or a small-number opcode), and the call
 * the hop states is not the one the body makes. The same holds for the bytes an earlier call of the hop left a node
 * with, the last of them when two rewrote it, and a key the mapping does not hold reads as its type's default: a
 * `string` one as the empty string.
 *
 * A node an earlier call of the hop created is no deployment's, so the reading call names it by the output that call
 * created it at. A slot is the key's alone, so the sink's node for the same key and the book's node of another
 * mapping sit at the same slot: the created node is the one of the reader's own contract and mapping, and a hop that
 * named another settles nothing.
 */

/** A 32-byte category or txid that is neither one repeated byte nor a palindrome, taken from its label. */
function idOf(label: string): string {
  return bytesToHex(sha256(utf8ToBin(`mapping value routing ${label}`)));
}

const SINK_CATEGORY = idOf('sink');
const BOOK_IMPL_CATEGORY = idOf('book implementation');
const BOOK_PROXY_CATEGORY = idOf('book proxy');
const BOOK_INIT_TXID = idOf('book initialize coin');
const ROOT_IMPL_CATEGORY = idOf('root implementation');
const ROOT_PROXY_CATEGORY = idOf('root proxy');
const ROOT_INIT_TXID = idOf('root initialize coin');
const ALICE_LOCK = encodeLockingBytecodeP2pkh(alicePkh);

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'interface IBook {',
  '  function setName(uint256 k, string calldata name) external;',
  '  function setBlob(uint256 k, bytes calldata blob) external;',
  '  function relayName(uint256 k) external;',
  '  function relayBlob(uint256 k) external;',
  '  function relayAmount(uint256 k) external;',
  '  function pingTarget(uint256 k) external;',
  '  function pingIfFlagged(uint256 k) external;',
  '}',
  'interface ISink {',
  '  function take(uint256 k, string calldata name) external;',
  '  function takeLong(uint256 k, string calldata name) external;',
  '  function takeBlob(uint256 k, bytes calldata blob) external;',
  '  function takeAmount(uint256 k, uint256 amount) external;',
  '  function ping(uint256 k) external;',
  '}',
  'contract Sink {',
  '  uint256 lastPing;',
  '  mapping(uint256 => string) names;',
  '  mapping(uint256 => string) longNames;',
  '  mapping(uint256 => bytes) blobs;',
  '  mapping(uint256 => uint256) amounts;',
  '  function take(uint256 k, string calldata name) external { names[k] = name; }',
  '  function takeLong(uint256 k, string calldata name) external { longNames[k] = name; }',
  '  function takeBlob(uint256 k, bytes calldata blob) external { blobs[k] = blob; }',
  '  function takeAmount(uint256 k, uint256 amount) external { amounts[k] = amount; }',
  '  function ping(uint256 k) external { lastPing = k; }',
  '  function pinged() external view returns (uint256) { return lastPing; }',
  '  function nameOf(uint256 k) external view returns (string memory) { return names[k]; }',
  '  function longNameOf(uint256 k) external view returns (string memory) { return longNames[k]; }',
  '  function blobOf(uint256 k) external view returns (bytes memory) { return blobs[k]; }',
  '  function amountOf(uint256 k) external view returns (uint256) { return amounts[k]; }',
  '}',
  'contract Book {',
  '  address public implementation;',
  '  address public sink;',
  '  mapping(uint256 => string) names;',
  '  mapping(uint256 => bytes) blobs;',
  '  mapping(uint256 => uint256) amounts;',
  '  mapping(uint256 => address) targets;',
  '  mapping(uint256 => bool) flags;',
  '  function initialize(address sink_) public { sink = sink_; }',
  '  function setName(uint256 k, string calldata name) public { names[k] = name; }',
  '  function setBlob(uint256 k, bytes calldata blob) public { blobs[k] = blob; }',
  '  function setAmount(uint256 k, uint256 amount) public { amounts[k] = amount; }',
  '  function setTarget(uint256 k, address target) public { targets[k] = target; }',
  '  function setFlag(uint256 k, bool flag) public { flags[k] = flag; }',
  '  function relayName(uint256 k) public {',
  '    if (bytes(names[k]).length > 60) { ISink(sink).takeLong(k, names[k]); }',
  '    else { ISink(sink).take(k, names[k]); }',
  '  }',
  '  function relayBlob(uint256 k) public { ISink(sink).takeBlob(k, blobs[k]); }',
  '  function relayAmount(uint256 k) public { ISink(sink).takeAmount(k, amounts[k]); }',
  '  function pingTarget(uint256 k) public { ISink(targets[k]).ping(k); }',
  '  function pingIfFlagged(uint256 k) public { if (flags[k]) { ISink(sink).ping(k); } }',
  '}',
  'contract Root {',
  '  address public implementation;',
  '  address public book;',
  '  function initialize(address book_) public { book = book_; }',
  '  function relayName(uint256 k) public { IBook(book).relayName(k); }',
  '  function nameThenRelay(uint256 k, string calldata name) public {',
  '    IBook(book).setName(k, name);',
  '    IBook(book).relayName(k);',
  '  }',
  '  function nameAndBlobThenRelay(uint256 k, string calldata name, bytes calldata blob) public {',
  '    IBook(book).setName(k, name);',
  '    IBook(book).setBlob(k, blob);',
  '    IBook(book).relayName(k);',
  '  }',
  '  function renameTwiceThenRelay(uint256 k, string calldata first, string calldata second) public {',
  '    IBook(book).setName(k, first);',
  '    IBook(book).setName(k, second);',
  '    IBook(book).relayName(k);',
  '  }',
  '  function relayBlob(uint256 k) public { IBook(book).relayBlob(k); }',
  '  function relayAmount(uint256 k) public { IBook(book).relayAmount(k); }',
  '  function pingTarget(uint256 k) public { IBook(book).pingTarget(k); }',
  '  function pingIfFlagged(uint256 k) public { IBook(book).pingIfFlagged(k); }',
  '}',
].join('\n');

/** Solidity-import compile options, under which a call result crosses the boundary as a Solidity ABI tuple. */
const FIXTURE_OPTIONS = {
  evmCompat: true,
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
const { Sink, Book, Root } = compiled as Required<typeof compiled>;

/**
 * The values the callee holds. Each starts with a byte a pushdata decoder reads as something else: `S` as the
 * small-number opcode 3, `#` as a 35-byte push (so the long name would read 35 bytes long, and take the short arm),
 * 0x05 as a 5-byte push, and 85 (0x55) as the small-number opcode 5.
 */
const SHORT_NAME = "Sam's short note";
const LONG_NAME = `# a long note ${'n'.repeat(120)} that spans a run of chunk records`;
const BLOB = hexToBin(`05${'c3'.repeat(99)}`);
const AMOUNT = 85n;

/** A framed contract's address, which its category fixes before anything is deployed. */
const addressOf = (id: string): Uint8Array => validatorAddress(hexToBin(id), VALIDATOR_PROGRAM);

/** A coin a genesis or a hop is funded from; a genesis's txid becomes the category it mints. */
function funding(txid: string): Utxo {
  return { txid, vout: 0, satoshis: 5_000_000n };
}

/** A proxied deployment's two categories, which a hop names it by. */
interface Proxied {
  readonly proxyCategoryId: string;
  readonly implementationCategoryId: string;
}

/** The deployment, the chain as it stood then, and the two proxied entries a case calls. */
interface World {
  readonly network: MockNetworkProvider;
  readonly snapshot: SnapshotRestorer;
  readonly enterBook: (functionName: string, args: readonly FunctionArgument[]) => Promise<FramedProxyCallResult>;
  readonly enterRoot: (functionName: string, args: readonly FunctionArgument[]) => Promise<FramedProxyCallResult>;
}

/** The sink plain, the book behind its generated proxy, and the root behind another. */
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
  for (const id of [BOOK_IMPL_CATEGORY, BOOK_PROXY_CATEGORY, ROOT_IMPL_CATEGORY, ROOT_PROXY_CATEGORY]) {
    await network.addUtxo(wallet.address, funding(id));
  }
  for (const id of [BOOK_INIT_TXID, ROOT_INIT_TXID]) await network.addUtxo(binToHex(ALICE_LOCK), funding(id));
  await fundShippedFacets(network);
  const proxied = async (
    implementationArtifact: NonNullable<typeof Book>, implementationId: string, proxyId: string, initTxid: string,
    initArgs: readonly FunctionArgument[],
  ): Promise<Proxied & { readonly address: Uint8Array }> => {
    const deployment = await deployFramedProxy({
      provider: network,
      implementationArtifact,
      proxyArtifact: buildProxyArtifact(implementationArtifact),
      implementationDeploy: { fundingUtxo: funding(implementationId), funder, changeAddress, threadCount: 5 },
      proxyDeploy: { fundingUtxo: funding(proxyId), funder, changeAddress, threadCount: 5 },
      initialize: { functionName: 'initialize', args: [...initArgs] },
      callerLockingBytecode: ALICE_LOCK,
      callerFunding: { utxo: funding(initTxid), funder: callerFunder, changeAddress },
      vm: compositionMachine(),
    });
    expect(deployment.initialize.accepted).toBe(true);
    return {
      proxyCategoryId: deployment.proxy.categoryId,
      implementationCategoryId: deployment.implementation.categoryId,
      address: deployment.proxy.address,
    };
  };
  const book = await proxied(Book!, BOOK_IMPL_CATEGORY, BOOK_PROXY_CATEGORY, BOOK_INIT_TXID, [addressOf(SINK_CATEGORY)]);
  const root = await proxied(Root!, ROOT_IMPL_CATEGORY, ROOT_PROXY_CATEGORY, ROOT_INIT_TXID, [book.address]);
  const sinkExternal = { artifact: Sink!, categoryId: SINK_CATEGORY };
  const bookExternal = {
    artifact: Book!, categoryId: book.proxyCategoryId,
    proxyArtifact: buildProxyArtifact(Book!), implementationCategoryId: book.implementationCategoryId,
  };
  let coins = 0;
  const entering = (artifact: NonNullable<typeof Book>, deployment: Proxied) => async (
    functionName: string, args: readonly FunctionArgument[],
  ): Promise<FramedProxyCallResult> => {
    coins += 1;
    const coin = funding(idOf(`call coin ${coins}`));
    await network.addUtxo(binToHex(ALICE_LOCK), coin);
    return callFramedProxyEntry({
      provider: network,
      implementationArtifact: artifact,
      proxyArtifact: buildProxyArtifact(artifact),
      proxyCategoryId: deployment.proxyCategoryId,
      implementationCategoryId: deployment.implementationCategoryId,
      functionName,
      args,
      externals: { ISink: sinkExternal, IBook: bookExternal },
      callerUtxo: coin,
      callerLockingBytecode: ALICE_LOCK,
      funder: callerFunder,
      changeAddress,
      vm: compositionMachine(),
    });
  };
  return {
    network,
    snapshot: await network.takeSnapshot(),
    enterBook: entering(Book!, book),
    enterRoot: entering(Root!, root),
  };
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
function expectSettled(result: FramedProxyCallResult): void {
  expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
  expect(result.accepted).toBe(true);
  expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
}

/** The sink entries a hop ran, in the order the derivation completed them. */
const sinkFrames = (result: FramedProxyCallResult): readonly string[] => result.completed
  .map((frame) => frame.functionName).filter((name) => name.startsWith(`${Sink!.contractName}.`));

/** One of the sink's view entries, read from its live records: a returned `bytes` value as hex. */
async function sinkView(world: World, functionName: string, args: readonly FunctionArgument[]): Promise<unknown> {
  const read = await readFramedEntry({
    provider: world.network, artifact: Sink!, categoryId: SINK_CATEGORY, functionName, args: [...args],
    vm: compositionMachine(),
  });
  expect(read.accepted, read.objection).toBe(true);
  return read.value instanceof Uint8Array ? binToHex(read.value) : read.value;
}

describe('a call a callee routes through a value its own mapping holds', () => {
  it('holds the short name inline, and the long name and the bytes past the inline limit', () => {
    expect(utf8ToBin(SHORT_NAME).length).toBeLessThanOrEqual(VALUE_INLINE_LIMIT);
    expect(utf8ToBin(LONG_NAME).length).toBeGreaterThan(2 * VALUE_INLINE_LIMIT);
    expect(BLOB.length).toBeGreaterThan(VALUE_INLINE_LIMIT);
  });

  it('forwards a short string down the arm its length picks', async () => {
    const world = await deployed();
    expectSettled(await world.enterBook('setName', [1n, SHORT_NAME]));
    const relayed = await world.enterRoot('relayName', [1n]);
    expectSettled(relayed);
    expect(sinkFrames(relayed)).toStrictEqual([`${Sink!.contractName}.take()`]);
    expect(await sinkView(world, 'nameOf', [1n])).toBe(SHORT_NAME);
  }, 300_000);

  it('forwards a long string, joined from its chunk records, down the other arm', async () => {
    const world = await deployed();
    expectSettled(await world.enterBook('setName', [2n, LONG_NAME]));
    const relayed = await world.enterRoot('relayName', [2n]);
    expectSettled(relayed);
    expect(sinkFrames(relayed)).toStrictEqual([`${Sink!.contractName}.takeLong()`]);
    expect(await sinkView(world, 'longNameOf', [2n])).toBe(LONG_NAME);
  }, 300_000);

  it('forwards the string an earlier call of the same hop rewrote, not the one the deployment holds', async () => {
    const world = await deployed();
    expectSettled(await world.enterBook('setName', [7n, SHORT_NAME]));
    const relayed = await world.enterRoot('nameThenRelay', [7n, LONG_NAME]);
    expectSettled(relayed);
    expect(sinkFrames(relayed)).toStrictEqual([`${Sink!.contractName}.takeLong()`]);
    expect(await sinkView(world, 'longNameOf', [7n])).toBe(LONG_NAME);
  }, 300_000);

  it('forwards the string the last of two earlier calls of the same hop rewrote', async () => {
    const world = await deployed();
    expectSettled(await world.enterBook('setName', [14n, SHORT_NAME]));
    const relayed = await world.enterRoot('renameTwiceThenRelay', [14n, `${SHORT_NAME} again`, LONG_NAME]);
    expectSettled(relayed);
    expect(sinkFrames(relayed)).toStrictEqual([`${Sink!.contractName}.takeLong()`]);
    expect(await sinkView(world, 'longNameOf', [14n])).toBe(LONG_NAME);
  }, 300_000);

  it('forwards the string an earlier call of the same hop created at a key the mapping did not hold', async () => {
    const world = await deployed();
    // The sink's own node for the key, which its `take` creates later in the hop, sits at the same slot.
    const relayed = await world.enterRoot('nameThenRelay', [11n, SHORT_NAME]);
    expectSettled(relayed);
    expect(sinkFrames(relayed)).toStrictEqual([`${Sink!.contractName}.take()`]);
    expect(await sinkView(world, 'nameOf', [11n])).toBe(SHORT_NAME);
    // A long one is read as the bytes the creating call left: its chunk records are this transaction's own outputs.
    const relayedLong = await world.enterRoot('nameThenRelay', [12n, LONG_NAME]);
    expectSettled(relayedLong);
    expect(sinkFrames(relayedLong)).toStrictEqual([`${Sink!.contractName}.takeLong()`]);
    expect(await sinkView(world, 'longNameOf', [12n])).toBe(LONG_NAME);
  }, 300_000);

  it('forwards the string an earlier call created, not the bytes another created at the same key', async () => {
    const world = await deployed();
    const relayed = await world.enterRoot('nameAndBlobThenRelay', [13n, SHORT_NAME, BLOB]);
    expectSettled(relayed);
    expect(sinkFrames(relayed)).toStrictEqual([`${Sink!.contractName}.take()`]);
    expect(await sinkView(world, 'nameOf', [13n])).toBe(SHORT_NAME);
  }, 300_000);

  it('forwards the empty string a key the mapping does not hold reads as', async () => {
    const world = await deployed();
    const relayed = await world.enterRoot('relayName', [9n]);
    expectSettled(relayed);
    expect(sinkFrames(relayed)).toStrictEqual([`${Sink!.contractName}.take()`]);
    expect(await sinkView(world, 'nameOf', [9n])).toBe('');
  }, 300_000);

  it('forwards bytes, joined from their chunk records', async () => {
    const world = await deployed();
    expectSettled(await world.enterBook('setBlob', [3n, BLOB]));
    const relayed = await world.enterRoot('relayBlob', [3n]);
    expectSettled(relayed);
    expect(await sinkView(world, 'blobOf', [3n])).toBe(binToHex(BLOB));
  }, 300_000);

  it('forwards an integer as the number it holds', async () => {
    const world = await deployed();
    expectSettled(await world.enterBook('setAmount', [4n, AMOUNT]));
    const relayed = await world.enterRoot('relayAmount', [4n]);
    expectSettled(relayed);
    expect(await sinkView(world, 'amountOf', [4n])).toBe(AMOUNT);
  }, 300_000);

  it('calls the address it holds', async () => {
    const world = await deployed();
    expectSettled(await world.enterBook('setTarget', [5n, addressOf(SINK_CATEGORY)]));
    const relayed = await world.enterRoot('pingTarget', [5n]);
    expectSettled(relayed);
    expect(sinkFrames(relayed)).toStrictEqual([`${Sink!.contractName}.ping()`]);
    expect(await sinkView(world, 'pinged', [])).toBe(5n);
  }, 300_000);

  it('makes the call a flag it holds guards only while the flag is set', async () => {
    const world = await deployed();
    expectSettled(await world.enterBook('setFlag', [8n, true]));
    const flagged = await world.enterRoot('pingIfFlagged', [8n]);
    expectSettled(flagged);
    expect(sinkFrames(flagged)).toStrictEqual([`${Sink!.contractName}.ping()`]);
    // A cleared flag is the empty script number its node holds, and a key the mapping does not hold reads as false.
    expectSettled(await world.enterBook('setFlag', [8n, false]));
    for (const key of [8n, 10n]) {
      const unflagged = await world.enterRoot('pingIfFlagged', [key]);
      expectSettled(unflagged);
      expect(sinkFrames(unflagged)).toStrictEqual([]);
    }
    expect(await sinkView(world, 'pinged', [])).toBe(8n);
  }, 300_000);
});
