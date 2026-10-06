import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin, utf8ToBin } from '@bitauth/libauth';
import { bytesToHex, sha256, validatorAddress, type StateRecord } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import type { Unlocker, Utxo } from '../../../src/interfaces.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { buildProxyArtifact, deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { callFramedProxyEntry, type FramedProxyCallResult } from '../../../src/framed/proxy/deploy.js';
import type { FramedProxyExternal } from '../../../src/framed/proxy/external-calls.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import { lockingBytecodeToSolidityAddressPayload } from '../../../src/utils.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub, bobPkh, bobPriv } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * A close that rates its helper through a store behind a generated proxy, and the reads that follow
 * (Solidity-compatible).
 *
 * The root, behind its own generated proxy, closes a post and, given a rating, runs its public `rate` inline: it
 * writes the rating, averages it into the store's score for the helper, appends a remark to the helper's remark
 * array, and appends a note for the post; it then credits the helper's profile and appends a closing note. Each is a
 * reach of the one proxied store, so the hop carries five frames of it: an insert into a small struct mapping, an
 * insert into a mapping of struct arrays whose element the store stamps with its clock, two appends to one note
 * array, and an in-place rewrite of a long profile value. The store's getters then read the helper's remark, the
 * page of remarks, its profile and its score. A second rating, a rating by someone else, and a rated close after a
 * plain one are each refused or settled as the source says.
 */

/** A 32-byte category or txid that is neither one repeated byte nor a palindrome, taken from its label. */
function idOf(label: string): string {
  return bytesToHex(sha256(utf8ToBin(`rated close chain ${label}`)));
}

const BOOK_IMPL = idOf('book implementation');
const BOOK_PROXY = idOf('book proxy');
const DESK_IMPL = idOf('desk implementation');
const DESK_PROXY = idOf('desk proxy');
const addressOf = (categoryId: string): Uint8Array => validatorAddress(hexToBin(categoryId), VALIDATOR_PROGRAM);

const OWNER_LOCK = encodeLockingBytecodeP2pkh(alicePkh);
const HELPER_LOCK = encodeLockingBytecodeP2pkh(bobPkh);
const HELPER_KEY = Uint8Array.from({ length: 33 }, (_unused, index) => (index * 7 + 2) % 251);
const REMARK = 'Nice work!';

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'struct Note { uint8 kind; bytes who; bytes data; uint32 at; }',
  'struct Profile { address account; bytes key; string name; string bio; string pic; uint16 up; uint16 down; }',
  'struct Score { uint16 average; uint256 count; }',
  'struct Remark { address author; uint256 ref; uint8 score; string text; uint32 at; }',
  'interface IBook {',
  '  function note(uint256 id_, Note memory n_) external;',
  '  function score(address who_, uint8 s_) external;',
  '  function remark(address target_, address author_, uint256 ref_, uint8 s_, string memory text_) external;',
  '  function credit(address who_) external;',
  '}',
  'contract Book {',
  '  address public implementation;',
  '  address public desk;',
  '  mapping(uint256 => Note[]) public notes;',
  '  mapping(address => Profile) public profiles;',
  '  mapping(address => Score) public scores;',
  '  mapping(address => Remark[]) public remarks;',
  '  modifier onlyDesk() { require(msg.sender == desk, "not desk"); _; }',
  '  function initialize(address desk_) public { desk = desk_; }',
  '  function join(bytes calldata key_, string calldata name_, string calldata bio_, string calldata pic_) public {',
  '    profiles[msg.sender] = Profile(msg.sender, key_, name_, bio_, pic_, 0, 0);',
  '  }',
  '  function note(uint256 id_, Note memory n_) public onlyDesk {',
  '    n_.at = uint32(block.timestamp);',
  '    notes[id_].push(n_);',
  '  }',
  '  function score(address who_, uint8 s_) public onlyDesk {',
  '    require(s_ >= 1 && s_ <= 5, "Invalid score");',
  '    Score storage sc = scores[who_];',
  '    sc.average = uint16((sc.average * sc.count + s_ * 10000) / (sc.count + 1));',
  '    sc.count++;',
  '  }',
  '  function remark(address target_, address author_, uint256 ref_, uint8 s_, string memory text_) public onlyDesk {',
  '    require(s_ >= 1 && s_ <= 5, "Invalid score");',
  '    remarks[target_].push(Remark({author: author_, ref: ref_, score: s_, text: text_,',
  '      at: uint32(block.timestamp)}));',
  '  }',
  '  function credit(address who_) public onlyDesk { profiles[who_].up += 1; }',
  '  function getRemarks(address target_, uint256 index_, uint256 limit_) public view returns (Remark[] memory) {',
  '    uint256 total = remarks[target_].length;',
  '    require(index_ < total, "index out of bounds");',
  '    uint length = total - index_;',
  '    if (limit_ == 0) { limit_ = length; }',
  '    length = length > limit_ ? limit_ : length;',
  '    Remark[] memory result = new Remark[](length);',
  '    for (uint i = 0; i < length; i++) { result[i] = remarks[target_][i + index_]; }',
  '    return result;',
  '  }',
  '}',
  'contract Desk {',
  '  struct Roles { address owner; address helper; }',
  '  struct Post { uint8 state; Roles roles; string title; uint8 rating; }',
  '  address public implementation;',
  '  address public book;',
  '  Post[] public posts;',
  '  modifier onlyOwner(uint256 id_) { require(posts[id_].roles.owner == msg.sender, "not owner"); _; }',
  '  function initialize(address book_) public { book = book_; }',
  '  function publish(uint256 id_, Note memory n_) internal { IBook(book).note(id_, n_); }',
  '  function open(string calldata title_, address helper_) public {',
  '    posts.push();',
  '    uint256 id = posts.length - 1;',
  '    Post storage post = posts[id];',
  '    post.roles.owner = msg.sender;',
  '    post.roles.helper = helper_;',
  '    post.title = title_;',
  '  }',
  '  function finish(uint256 id_, uint8 rating_, string calldata text_) public onlyOwner(id_) {',
  '    Post storage post = posts[id_];',
  '    require(post.state == 0, "bad state");',
  '    post.state = 2;',
  '    if (rating_ > 0) { rate(id_, rating_, text_); }',
  '    IBook(book).credit(post.roles.helper);',
  '    publish(id_, Note({kind: 5, who: bytes(""), data: bytes(""), at: 0}));',
  '  }',
  '  function noteAndFinish(uint256 id_, uint8 rating_, string calldata text_) public onlyOwner(id_) {',
  '    Post storage post = posts[id_];',
  '    require(post.state == 0, "bad state");',
  '    publish(id_, Note({kind: 1, who: bytes(""), data: bytes(""), at: 0}));',
  '    post.state = 2;',
  '    if (rating_ > 0) { rate(id_, rating_, text_); }',
  '    IBook(book).credit(post.roles.helper);',
  '  }',
  '  function rate(uint256 id_, uint8 rating_, string calldata text_) public onlyOwner(id_) {',
  '    require(posts[id_].rating == 0, "already rated");',
  '    require(posts[id_].state == 2, "not closed");',
  '    require(bytes(text_).length <= 100, "text too long");',
  '    posts[id_].rating = rating_;',
  '    IBook(book).score(posts[id_].roles.helper, rating_);',
  '    IBook(book).remark(posts[id_].roles.helper, msg.sender, id_, rating_, text_);',
  '    publish(id_, Note({kind: 9, who: bytes(""),',
  '      data: bytes.concat(abi.encodePacked(rating_), bytes(text_)), at: 0}));',
  '  }',
  '}',
].join('\n');

/** The options an imported Solidity project compiles with under the framed composition. */
const OPTIONS = {
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

const artifacts = compileStringMulti(SOURCE, OPTIONS as never);

/** The line of the first source line containing `needle`, 1-based. */
const lineOf = (needle: string): number => SOURCE.split('\n').findIndex((line) => line.includes(needle)) + 1;

interface Caller { readonly lock: Uint8Array; readonly funder: Unlocker }

const OWNER: Caller = { lock: OWNER_LOCK, funder: new SignatureTemplate(alicePriv).unlockP2PKH() };
const HELPER: Caller = { lock: HELPER_LOCK, funder: new SignatureTemplate(bobPriv).unlockP2PKH() };

interface World {
  readonly network: MockNetworkProvider;
  readonly externals: Readonly<Record<string, FramedProxyExternal>>;
  readonly changeAddress: string;
  readonly nextCoin: () => Utxo;
}

async function deployWorld(): Promise<World> {
  const { Book, Desk } = artifacts;
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const genesisFunder = wallet.unlock.spend(alicePub, signature);
  const changeAddress = wallet.address;
  let serial = 0;
  const nextCoin = (): Utxo => {
    serial += 1;
    return { txid: idOf(`coin ${serial}`), vout: 0, satoshis: 5_000_000n };
  };
  const funding = (txid: string): Utxo => ({ txid, vout: 0, satoshis: 5_000_000n });
  for (const id of [BOOK_IMPL, BOOK_PROXY, DESK_IMPL, DESK_PROXY]) await network.addUtxo(wallet.address, funding(id));
  await fundShippedFacets(network);
  const bookInit = nextCoin();
  await network.addUtxo(binToHex(OWNER_LOCK), bookInit);
  const book = await deployFramedProxy({
    provider: network,
    implementationArtifact: Book!,
    proxyArtifact: buildProxyArtifact(Book!),
    implementationDeploy: { fundingUtxo: funding(BOOK_IMPL), funder: genesisFunder, changeAddress },
    proxyDeploy: { fundingUtxo: funding(BOOK_PROXY), funder: genesisFunder, changeAddress },
    initialize: { functionName: 'initialize', args: [addressOf(DESK_PROXY)] },
    callerLockingBytecode: OWNER_LOCK,
    callerFunding: { utxo: bookInit, funder: OWNER.funder, changeAddress },
    vm: compositionMachine(),
  });
  expect(book.initialize.broadcast).toBeDefined();
  const deskInit = nextCoin();
  await network.addUtxo(binToHex(OWNER_LOCK), deskInit);
  const desk = await deployFramedProxy({
    provider: network,
    implementationArtifact: Desk!,
    proxyArtifact: buildProxyArtifact(Desk!),
    implementationDeploy: { fundingUtxo: funding(DESK_IMPL), funder: genesisFunder, changeAddress },
    proxyDeploy: { fundingUtxo: funding(DESK_PROXY), funder: genesisFunder, changeAddress },
    initialize: { functionName: 'initialize', args: [book.proxy.address] },
    callerLockingBytecode: OWNER_LOCK,
    callerFunding: { utxo: deskInit, funder: OWNER.funder, changeAddress },
    vm: compositionMachine(),
  });
  expect(desk.initialize.broadcast).toBeDefined();
  return {
    network,
    externals: {
      IBook: {
        artifact: Book!,
        categoryId: book.proxy.categoryId,
        proxyArtifact: buildProxyArtifact(Book!),
        implementationCategoryId: book.implementation.categoryId,
      },
    },
    changeAddress,
    nextCoin,
  };
}

/** Enters one entry of the desk or the book through its proxy with a fresh coin of the caller's. */
async function enter(
  world: World, contract: 'Desk' | 'Book', functionName: string, args: readonly FunctionArgument[], caller: Caller,
): Promise<{ readonly result?: FramedProxyCallResult; readonly error?: Error }> {
  const coin = world.nextCoin();
  await world.network.addUtxo(binToHex(caller.lock), coin);
  const artifact = artifacts[contract]!;
  try {
    const result = await callFramedProxyEntry({
      provider: world.network,
      implementationArtifact: artifact,
      proxyArtifact: buildProxyArtifact(artifact),
      proxyCategoryId: contract === 'Desk' ? DESK_PROXY : BOOK_PROXY,
      implementationCategoryId: contract === 'Desk' ? DESK_IMPL : BOOK_IMPL,
      functionName,
      args,
      externals: world.externals,
      callerUtxo: coin,
      callerLockingBytecode: caller.lock,
      funder: caller.funder,
      changeAddress: world.changeAddress,
      vm: compositionMachine(),
    });
    return { result };
  } catch (error) {
    return { error: error as Error };
  }
}

/** The hop settled and broadcast. */
function expectSettled(outcome: { readonly result?: FramedProxyCallResult; readonly error?: Error }): void {
  expect(outcome.error?.message).toBeUndefined();
  expect(outcome.result!.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
}

/** The hop was refused with `reason` as a source line of `entry`'s own frame reports it. */
function expectRefused(
  outcome: { readonly result?: FramedProxyCallResult; readonly error?: Error }, entry: string, reason: string,
): void {
  expect(outcome.result).toBeUndefined();
  expect(outcome.error!.message).toMatch(new RegExp(
    `frame "[^"]*" of ${entry.replace(/[.()]/g, (character) => `\\${character}`)} at line ${lineOf(`"${reason}"`)}: `
      + `${reason} \\(`,
  ));
}

/** One getter of the book, read at the proxy's records. */
async function read(world: World, functionName: string, args: readonly FunctionArgument[]): Promise<unknown> {
  const result = await readFramedEntry({
    provider: world.network, artifact: artifacts.Book!, categoryId: BOOK_PROXY, functionName, args,
    vm: compositionMachine(),
  });
  expect(result.accepted).toBe(true);
  return result.value;
}

const plain = (value: unknown): Record<string, unknown> => (value as StateRecord & { toObject: () => StateRecord })
  .toObject() as Record<string, unknown>;

describe('a close that rates its helper through a proxied store', () => {
  it('settles the rated close, and the getters read the remark, the page, the profile and the score', async () => {
    const world = await deployWorld();
    expectSettled(await enter(world, 'Book', 'join',
      [HELPER_KEY, 'Helper', 'A helper', 'https://example.com/avatar'], HELPER));
    expectSettled(await enter(world, 'Desk', 'open', ['A post to close', HELPER_LOCK], OWNER));
    expectSettled(await enter(world, 'Desk', 'finish', [0n, 5n, REMARK], OWNER));

    const remark = plain(await read(world, 'remarks', [HELPER_LOCK, 0n]));
    expect(remark).toMatchObject({
      author: lockingBytecodeToSolidityAddressPayload(OWNER_LOCK), ref: 0n, score: 5n, text: REMARK,
    });
    const page = await read(world, 'getRemarks', [HELPER_LOCK, 0n, 0n]) as unknown[];
    expect(page.map(plain)).toStrictEqual([remark]);
    expect(plain(await read(world, 'profiles', [HELPER_LOCK]))).toMatchObject({ up: 1n, down: 0n, name: 'Helper' });
    expect(plain(await read(world, 'scores', [HELPER_LOCK]))).toStrictEqual({ average: 50000n, count: 1n });

    // A second rating, and one by someone else, stop on the entry's own checks.
    expectRefused(await enter(world, 'Desk', 'rate', [0n, 4n, REMARK], OWNER), 'Desk.rate()', 'already rated');
    expectRefused(await enter(world, 'Desk', 'rate', [0n, 4n, REMARK], HELPER), 'Desk.rate()', 'not owner');
  }, 900_000);

  it('rates after a plain close: the store refuses a score past its range, and the rating settles once', async () => {
    const world = await deployWorld();
    expectSettled(await enter(world, 'Book', 'join',
      [HELPER_KEY, 'Helper', 'A helper', 'https://example.com/avatar'], HELPER));
    expectSettled(await enter(world, 'Desk', 'open', ['A post to close', HELPER_LOCK], OWNER));
    expectSettled(await enter(world, 'Desk', 'finish', [0n, 0n, ''], OWNER));
    expect(plain(await read(world, 'profiles', [HELPER_LOCK]))).toMatchObject({ up: 1n });

    expectRefused(await enter(world, 'Desk', 'rate', [0n, 0n, REMARK], OWNER), 'Book.score()', 'Invalid score');
    expectRefused(await enter(world, 'Desk', 'rate', [0n, 6n, REMARK], OWNER), 'Book.score()', 'Invalid score');
    expectRefused(await enter(world, 'Desk', 'rate', [0n, 5n, 'a'.repeat(150)], OWNER), 'Desk.rate()',
      'text too long');
    expectSettled(await enter(world, 'Desk', 'rate', [0n, 5n, REMARK], OWNER));
    expectRefused(await enter(world, 'Desk', 'rate', [0n, 5n, REMARK], OWNER), 'Desk.rate()', 'already rated');
    expect(plain(await read(world, 'remarks', [HELPER_LOCK, 0n]))).toMatchObject({ score: 5n, text: REMARK });
  }, 900_000);

  it('reports the store\'s refusal, or the entry\'s own check, met after an earlier reach of the store', async () => {
    const world = await deployWorld();
    expectSettled(await enter(world, 'Book', 'join',
      [HELPER_KEY, 'Helper', 'A helper', 'https://example.com/avatar'], HELPER));
    expectSettled(await enter(world, 'Desk', 'open', ['A post to close', HELPER_LOCK], OWNER));
    expectRefused(await enter(world, 'Desk', 'noteAndFinish', [0n, 6n, REMARK], OWNER), 'Book.score()',
      'Invalid score');
    expectRefused(await enter(world, 'Desk', 'noteAndFinish', [0n, 5n, 'a'.repeat(150)], OWNER), 'Desk.noteAndFinish()',
      'text too long');
    expectSettled(await enter(world, 'Desk', 'noteAndFinish', [0n, 5n, REMARK], OWNER));
    expect(plain(await read(world, 'scores', [HELPER_LOCK]))).toStrictEqual({ average: 50000n, count: 1n });
  }, 900_000);
});
