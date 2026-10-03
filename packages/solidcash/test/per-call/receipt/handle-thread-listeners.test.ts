import { describe, expect, it } from 'vitest';
import { hexToBin, utf8ToBin } from '@bitauth/libauth';
import { sha256 } from '@solidcash/utils';
import { COMPOSITION_LIMITS } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import {
  MockNetworkProvider, Signer, deployProxy, getContractFactory,
  type PerCallArtifact, type PerCallProxyHandle,
} from '../../../src/index.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A message thread kept by a contract behind a generated per-call proxy, followed through the handle's listeners and
 * read back through its views (Solidity-compatible).
 *
 * Each post appends an item to the thread and emits it as an event whose first parameter is indexed. A listener is
 * added on a handle connected to a signer before anything is posted, and fires once its poll finds a post of the
 * kind it waits for: it is handed the indexed id as a bigint and the item with its named fields, and it reads a
 * member's key (one `bytes` field of a long struct value) from inside the callback before it resolves. Removing it
 * through the unconnected handle is a no-op that resolves, as with ethers, whose listeners belong to the instance they
 * were added on. A page of the thread read from an offset returns the items from that offset on.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'struct Item { uint8 kind; bytes who; bytes data; uint32 at; }',
  'struct Member { address account; bytes key; string name; string bio; string pic; uint16 up; uint16 down; }',
  'contract Board {',
  '  event Posted(uint256 indexed id, Item item);',
  '  address public implementation;',
  '  address public owner;',
  '  mapping(address => Member) public members;',
  '  mapping(uint256 => Item[]) public items;',
  '  function initialize() public { owner = msg.sender; }',
  '  function join(bytes calldata key_, string calldata name_) public {',
  '    require(members[msg.sender].key.length == 0, "already joined");',
  '    require(key_.length == 33, "bad key");',
  '    members[msg.sender] = Member(msg.sender, key_, name_, "A bio", "https://example.com/avatar", 0, 0);',
  '  }',
  '  function keyOf(address who_) public view returns (bytes memory) { return members[who_].key; }',
  '  function post(uint256 id_, bytes32 hash_, address to_) public {',
  '    Item memory item = Item({kind: uint8(msg.sender == owner ? 18 : 17), who: abi.encodePacked(msg.sender),',
  '      data: abi.encodePacked(hash_, to_), at: 0});',
  '    item.at = uint32(block.timestamp);',
  '    items[id_].push(item);',
  '    emit Posted(id_, item);',
  '  }',
  '  function count(uint256 id_) public view returns (uint256) { return items[id_].length; }',
  '  function page(uint256 id_, uint256 index_, uint256 limit_) public view returns (Item[] memory) {',
  '    uint256 total = items[id_].length;',
  '    require(index_ < total, "index out of bounds");',
  '    uint256 length = total - index_;',
  '    if (limit_ == 0) { limit_ = length; }',
  '    length = length > limit_ ? limit_ : length;',
  '    Item[] memory result = new Item[](length);',
  '    for (uint256 i = 0; i < length; i++) { result[i] = items[id_][i + index_]; }',
  '    return result;',
  '  }',
  '}',
].join('\n');

/** The options an imported Solidity project compiles with under the per-call composition. */
const OPTIONS = {
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

const artifacts = compileStringMulti(SOURCE, OPTIONS as never);

/** A 32-byte value taken from its label. */
const hashOf = (label: string): Uint8Array => sha256(utf8ToBin(`handle thread ${label}`));

/** A 33-byte member key taken from its label. */
const keyOf = (label: string): Uint8Array => Uint8Array.of(0x02, ...hashOf(`key ${label}`));

/** A value handed back as bytes, or as the hex string of them. */
const bytesOf = (value: unknown): Uint8Array => (typeof value === 'string'
  ? hexToBin(value.replace(/^0x/, '')) : value as Uint8Array);

/** A signer over the network with fresh vout-0 coins: a genesis mints a whole pool, and every hop pays its fee. */
async function fundedSigner(network: MockNetworkProvider, fill: number): Promise<Signer> {
  const signer = new Signer(new Uint8Array(32).fill(fill), network);
  for (let index = 0; index < 12; index += 1) {
    await network.addUtxo(signer.getAddress(), {
      txid: `${fill.toString(16).padStart(2, '0')}${(index + 1).toString(16).padStart(62, '0')}`,
      vout: 0,
      satoshis: 2_000_000n,
    });
  }
  return signer;
}

/** `promise`, or a rejection naming `what` once `ms` pass without it settling. */
function within<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} did not settle within ${ms} ms`)), ms);
  });
  return Promise.race([promise, late]).finally(() => clearTimeout(timer));
}

interface Heard {
  readonly id: unknown;
  readonly item: Readonly<Record<string, unknown>>;
  readonly key: unknown;
}

describe('a thread behind a per-call proxy, followed through the handle', () => {
  it('fires a connected listener with the indexed id and the item, and reads a key and a page', async () => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const owner = await fundedSigner(network, 0x61);
    const helper = await fundedSigner(network, 0x62);
    await fundShippedFacets(network);
    const board: PerCallProxyHandle = await deployProxy(
      getContractFactory(artifacts.Board! as PerCallArtifact, owner), [],
    );
    const call = (signer: Signer): Record<string, (...args: unknown[]) => Promise<unknown>> =>
      board.connect(signer) as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>;
    await call(owner).join!(keyOf('owner'), 'Owner');
    await call(helper).join!(keyOf('helper'), 'Helper');
    expect(bytesOf(await call(owner).keyOf!(helper.getLockingBytecode()))).toStrictEqual(keyOf('helper'));

    // Two listeners, each on its own connected handle, each waiting for one kind of post. The registration is
    // awaited, the hearing is not: it is handed back wrapped, so the caller can post before waiting on it.
    const listen = async (kind: number, reader: Signer, member: Signer): Promise<{ heard: Promise<Heard> }> => {
      const watcher = board.connect(owner);
      watcher.pollingInterval = 200;
      let resolveHeard: (heard: Heard) => void = () => undefined;
      let rejectHeard: (error: unknown) => void = () => undefined;
      const heard = new Promise<Heard>((resolve, reject) => { resolveHeard = resolve; rejectHeard = reject; });
      const listener = async (id: unknown, item: Record<string, unknown>): Promise<void> => {
        if (id !== 0n || Number(item.kind) !== kind) return;
        try {
          const key = await call(reader).keyOf!(member.getLockingBytecode());
          await board.removeListener('Posted', listener);
          // The listener belongs to the connected handle it was added on, so it is still registered there.
          const remaining = await watcher.listenerCount('Posted');
          await watcher.removeAllListeners();
          resolveHeard({ id, item: { ...item, remaining }, key });
        } catch (error) {
          rejectHeard(error);
        }
      };
      await watcher.addListener('Posted', listener);
      return { heard };
    };
    const helperPost = await listen(17, owner, helper);
    const ownerPost = await listen(18, helper, owner);

    await call(helper).post!(0n, hashOf('first'), owner.getLockingBytecode());
    const first = await within(helperPost.heard, 120_000, 'the listener for the helper\'s post');
    expect(typeof first.id).toBe('bigint');
    expect(first.id).toBe(0n);
    expect(bytesOf(first.item.data).slice(0, 32)).toStrictEqual(hashOf('first'));
    expect(bytesOf(first.item.data)).toHaveLength(52);
    expect(bytesOf(first.key)).toStrictEqual(keyOf('helper'));
    expect(first.item.remaining).toBe(1);

    await call(owner).post!(0n, hashOf('second'), helper.getLockingBytecode());
    const second = await within(ownerPost.heard, 120_000, 'the listener for the owner\'s post');
    expect(Number(second.item.kind)).toBe(18);
    expect(bytesOf(second.item.data).slice(0, 32)).toStrictEqual(hashOf('second'));
    expect(bytesOf(second.key)).toStrictEqual(keyOf('owner'));

    await call(helper).post!(0n, hashOf('third'), owner.getLockingBytecode());
    expect(await call(owner).count!(0n)).toBe(3n);
    const fromOne = await call(owner).page!(0n, 1n, 0n) as Array<Record<string, unknown>>;
    expect(fromOne.map((item) => bytesOf(item.data).slice(0, 32)))
      .toStrictEqual([hashOf('second'), hashOf('third')]);
    const one = await call(owner).page!(0n, 2n, 1n) as Array<Record<string, unknown>>;
    expect(one.map((item) => Number(item.kind))).toStrictEqual([17]);
    expect(bytesOf(one[0]!.data).slice(0, 32)).toStrictEqual(hashOf('third'));
  }, 400_000);
});
