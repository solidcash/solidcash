import { describe, expect, it } from 'vitest';
import {
  buildChunkCommitment,
  buildPushdataCommitment,
  bytesToHex,
  encodeChunkableValueTail,
  encodePushdataValue,
  splitValueIntoChunks,
  validatorAddress,
  type Artifact,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { encodeFunctionArgument } from '../../../src/Argument.js';
import {
  chunkRecordLockingBytecode,
  deployMaster,
  entryRecordLockingBytecode,
  stateRecordLockingBytecode,
} from '../../../src/framed/deploy/index.js';
import { planMappingBatch } from '../../../src/framed/composer/index.js';
import { buildProxyArtifact } from '../../../src/framed/proxy/index.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import { headSentinelCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import {
  REAL_VALIDATOR_PROGRAM, seededCategory,
} from '../../../../solidc/test/framed/master/validator-input.js';

/**
 * Reading a record through a proxied callee's delegate frame.
 *
 * The implementation keeps a struct-valued mapping and a struct-valued dynamic array, and an entry reads one of
 * each. It sits behind a generated proxy, so the caller's call reaches the proxy's fallback and the implementation
 * runs as the delegate frame that follows. Both kinds of record live at the proxy's category, which is where the
 * delegate frame's own planning has to look for them.
 */

const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;

const ROOT_CATEGORY = seededCategory('proxied callee record root');
const IMPL_CATEGORY = seededCategory('proxied callee record impl');
const PROXY_CATEGORY = seededCategory('proxied callee record proxy');
const ROOT_HEX = bytesToHex(ROOT_CATEGORY);
const IMPL_HEX = bytesToHex(IMPL_CATEGORY);
const PROXY_HEX = bytesToHex(PROXY_CATEGORY);
const IMPL_ADDRESS = validatorAddress(IMPL_CATEGORY, VALIDATOR_PROGRAM);
const PROXY_ADDRESS = validatorAddress(PROXY_CATEGORY, VALIDATOR_PROGRAM);

const hex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');
const empty = new Uint8Array(0);

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' struct Job { int id; int price; }'
  + ' interface IJobs {'
  + '   function getPrice(int jobId) view returns (int);'
  + '   function getJob(int jobId) view returns (Job);'
  + ' }'
  + ' contract Jobs {'
  + '   address public implementation;'
  + '   mapping(int => Job) byId;'
  + '   Job[] list;'
  + '   function getPrice(int jobId) view returns (int) { return byId[jobId].price; }'
  + '   function getJob(int jobId) view returns (Job) { return list[jobId]; }'
  + ' }'
  + ' contract Root {'
  + `   function price(int jobId) view returns (int) { return IJobs(0x${hex(PROXY_ADDRESS)}).getPrice(jobId); }`
  + `   function job(int jobId) view returns (Job) { return IJobs(0x${hex(PROXY_ADDRESS)}).getJob(jobId); }`
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const root = artifacts.Root!;
const impl = artifacts.Jobs!;
const proxy = buildProxyArtifact(impl);

const KEY = 1n;
const PRICE = 42n;
const LIST = [{ id: 1n, price: PRICE }, { id: 2n, price: 7n }];

const COLLECTION = impl.stateLayout!.collections!.find((candidate) => candidate.name === 'byId')!;
const NODE_LOCK = entryRecordLockingBytecode(PROXY_HEX, COLLECTION.signature);
const NODE_BATCH = planMappingBatch({
  writes: [{
    keys: [encodeFunctionArgument(KEY, 'int', impl.stateLayout!.structs) as Uint8Array],
    value: encodePushdataValue({ id: KEY, price: PRICE }, 'Job', impl.stateLayout!.structs)!,
  }],
  inventory: [headSentinelCommitment()],
  encodeValue: encodeChunkableValueTail,
  chunkable: (value) => value,
});
const NODE_SLOT = keyToSlotMulti([encodeFunctionArgument(KEY, 'int', impl.stateLayout!.structs) as Uint8Array]);

const LIST_BYTES = encodePushdataValue(LIST, 'Job[]', impl.stateLayout!.structs)!;
const LIST_CHUNKS = splitValueIntoChunks(LIST_BYTES);
const LIST_LOCK = chunkRecordLockingBytecode(PROXY_HEX, 'list', 'Job[]');

interface UtxoShape {
  readonly txid: string;
  readonly vout: number;
  readonly satoshis: bigint;
  readonly token: {
    readonly category: string;
    readonly amount: bigint;
    readonly nft: { readonly capability: 'minting' | 'mutable'; readonly commitment: string };
  };
}

function utxo(
  txid: string, satoshis: bigint, category: string,
  capability: 'minting' | 'mutable', commitment: Uint8Array,
): UtxoShape {
  return {
    txid, vout: 0, satoshis,
    token: { category, amount: 0n, nft: { capability, commitment: bytesToHex(commitment) } },
  };
}

/** A category's live pools: one master, plus a validator when the root owns one. */
async function fundContract(
  provider: MockNetworkProvider, artifact: Artifact, category: Uint8Array, seed: string,
  options: { readonly withValidator?: boolean; readonly commitment?: Uint8Array } = {},
): Promise<void> {
  const deployed = deployMaster(artifact, category, VALIDATOR_PROGRAM);
  const categoryHex = bytesToHex(category);
  const txid = (suffix: string, pad: string): string => `${seed}${suffix}`.padEnd(64, pad).slice(0, 64);
  await provider.addUtxo(bytesToHex(deployed.lockingBytecode),
    utxo(txid('11', 'a'), 20_000n, categoryHex, 'minting', empty));
  if (options.withValidator === true) {
    await provider.addUtxo(bytesToHex(deployed.address),
      utxo(txid('22', 'b'), 20_000n, categoryHex, 'mutable', empty));
  }
  if (options.commitment !== undefined) {
    await provider.addUtxo(bytesToHex(stateRecordLockingBytecode(categoryHex)),
      utxo(txid('33', 'c'), 20_000n, categoryHex, 'mutable', options.commitment));
  }
}

/** The chain a read runs against: the root, the implementation's master, and the proxy's record, node and chunks. */
async function chain(): Promise<MockNetworkProvider> {
  const provider = new MockNetworkProvider();
  await fundContract(provider, root, ROOT_CATEGORY, 'a', { withValidator: true });
  await fundContract(provider, impl, IMPL_CATEGORY, 'b');
  const record = new Uint8Array(Buffer.from(
    buildPushdataCommitment(proxy.stateLayout!, {
      implementation: IMPL_ADDRESS, ['list$len']: BigInt(LIST_BYTES.length),
    }, 0), 'hex'));
  await fundContract(provider, proxy, PROXY_CATEGORY, 'c', { commitment: record });

  for (const [index, node] of NODE_BATCH.written.entries()) {
    const txid = (0x44 + index).toString(16).padStart(2, '0').repeat(32);
    await provider.addUtxo(bytesToHex(NODE_LOCK), utxo(txid, 1_500n, PROXY_HEX, 'mutable', node.after));
  }
  for (const [index, data] of LIST_CHUNKS.entries()) {
    const commitment = new Uint8Array(Buffer.from(buildChunkCommitment(index, data), 'hex'));
    const txid = (0x66 + index).toString(16).padStart(2, '0').repeat(32);
    await provider.addUtxo(bytesToHex(LIST_LOCK), utxo(txid, 1_500n, PROXY_HEX, 'mutable', commitment));
  }
  return provider;
}

/** The provider's own transaction count, chain and mempool together. */
function transactionCount(provider: MockNetworkProvider): number {
  const snapshot = provider.indexer.storage.snapshot() as unknown as { txIndex: Map<string, unknown> };
  return snapshot.txIndex.size;
}

function read(
  provider: MockNetworkProvider, functionName: string, args: readonly bigint[],
): ReturnType<typeof readFramedEntry> {
  return readFramedEntry({
    provider,
    artifact: root,
    categoryId: ROOT_HEX,
    functionName,
    args,
    externals: {
      IJobs: {
        artifact: impl,
        categoryId: PROXY_HEX,
        proxyArtifact: proxy,
        implementationCategoryId: IMPL_HEX,
      },
    },
    vm: compositionMachine(),
  });
}

const participantIds = (result: Awaited<ReturnType<typeof readFramedEntry>>): readonly string[] =>
  result.draft.layout.participants.map((entry) => entry.id);

describe('a read whose proxied callee reads a mapping node', () => {
  it('declares the node at the proxy\'s category and returns the field the getter read', async () => {
    const provider = await chain();
    const before = transactionCount(provider);
    const result = await read(provider, 'price', [KEY]);

    expect(result.accepted).toBe(true);
    expect(result.value).toBe(PRICE);
    // The node is the proxy's record, kept in place at the proxy's category.
    expect(participantIds(result).some((id) => id.endsWith(`entry-${bytesToHex(NODE_SLOT)}`))).toBe(true);
    expect(transactionCount(provider)).toBe(before);
  });
});

describe('a read whose proxied callee reads a dynamic array element', () => {
  it('declares the array\'s record and chunk run at the proxy\'s category, and returns the element', async () => {
    const provider = await chain();
    const before = transactionCount(provider);
    const result = await read(provider, 'job', [KEY]);

    expect(result.accepted).toBe(true);
    expect(result.value).toStrictEqual(LIST[Number(KEY)]);
    // The array's chunks are the delegate frame's own records, declared in the proxy's block.
    expect(participantIds(result).some((id) => id.includes('chunk-list-'))).toBe(true);
    expect(transactionCount(provider)).toBe(before);
  });
});

/**
 * A root whose whole body is a call whose value it returns, in the Solidity-ABI spelling.
 *
 * The root keeps the callee's address in its own record, so its frame declares that record beside the records of
 * the proxy pair it reaches; both contracts are ported from Solidity, so the entry's returned value is the
 * ABI-encoded blob its own `return` leaves rather than the canonical push of one value. The answer the read
 * reports is the value the callee's own frame computed, carried verbatim up through the proxy's fallback.
 */
const RETURN_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' struct Job { int id; int price; }'
  + ' interface IStore { function priceOf(int id) external view returns (int); }'
  + ' contract Store {'
  + '   address public implementation;'
  + '   mapping(int => Job) byId;'
  + '   function priceOf(int id) view returns (int) { return byId[id].price; }'
  + ' }'
  + ' contract Root {'
  + '   address store;'
  + '   function priceOf(int id) view returns (int) { return IStore(store).priceOf(id); }'
  + ' }';

const returnArtifacts = compileStringMulti(RETURN_SOURCE, { composition: 'framed', evmCompat: true });
const returnRoot = returnArtifacts.Root!;
const returnStore = returnArtifacts.Store!;
const returnProxy = buildProxyArtifact(returnStore);

const RETURN_KEY = 1n;
const RETURN_PRICE = 42n;
const RETURN_COLLECTION = returnStore.stateLayout!.collections!.find((candidate) => candidate.name === 'byId')!;
const RETURN_NODE_LOCK = entryRecordLockingBytecode(PROXY_HEX, RETURN_COLLECTION.signature);
const RETURN_NODE = planMappingBatch({
  writes: [{
    keys: [encodeFunctionArgument(RETURN_KEY, 'int', returnStore.stateLayout!.structs) as Uint8Array],
    value: encodePushdataValue({ id: RETURN_KEY, price: RETURN_PRICE }, 'Job', returnStore.stateLayout!.structs)!,
  }],
  inventory: [headSentinelCommitment()],
  encodeValue: encodeChunkableValueTail,
  chunkable: (value) => value,
});

/** The chain the Solidity-ABI read runs against: the root's own record, plus the proxied callee's node. */
async function returnChain(): Promise<MockNetworkProvider> {
  const provider = new MockNetworkProvider();
  const rootRecord = new Uint8Array(Buffer.from(
    buildPushdataCommitment(returnRoot.stateLayout!, { store: PROXY_ADDRESS }, 0), 'hex'));
  await fundContract(provider, returnRoot, ROOT_CATEGORY, 'a', { withValidator: true, commitment: rootRecord });
  await fundContract(provider, returnStore, IMPL_CATEGORY, 'b');
  const proxyRecord = new Uint8Array(Buffer.from(
    buildPushdataCommitment(returnProxy.stateLayout!, { implementation: IMPL_ADDRESS }, 0), 'hex'));
  await fundContract(provider, returnProxy, PROXY_CATEGORY, 'c', { commitment: proxyRecord, withValidator: true });
  for (const [index, node] of RETURN_NODE.written.entries()) {
    const txid = (0x55 + index).toString(16).padStart(2, '0').repeat(32);
    await provider.addUtxo(bytesToHex(RETURN_NODE_LOCK), utxo(txid, 1_500n, PROXY_HEX, 'mutable', node.after));
  }
  return provider;
}

describe('a read whose root body only returns its callee\'s value', () => {
  it('serves the value the callee frame computed, with nothing broadcast', async () => {
    const provider = await returnChain();
    const before = transactionCount(provider);
    const result = await readFramedEntry({
      provider,
      artifact: returnRoot,
      categoryId: ROOT_HEX,
      functionName: 'priceOf',
      args: [RETURN_KEY],
      externals: {
        IStore: {
          artifact: returnStore,
          categoryId: PROXY_HEX,
          proxyArtifact: returnProxy,
          implementationCategoryId: IMPL_HEX,
        },
      },
      vm: compositionMachine(),
    });

    expect(result.accepted).toBe(true);
    expect(result.value).toBe(RETURN_PRICE);
    expect(transactionCount(provider)).toBe(before);
  });
});
