import { describe, expect, it } from 'vitest';
import { bigIntToVmNumber, hexToBin } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { getEntryNftAddress } from '../../src/stateful/covenant-helpers.js';
import { keyToSlot, SortedList } from '../../src/stateful/SortedList.js';

/**
 * DS-6: a chained present delete whose key is its node's own, beside an insert, relinks the node at the value
 * type's default. The SDK plans that relink for every statically-known scalar value kind (the previous planner
 * only handled int/bool, whose default tail is empty).
 */

const ZERO32 = new Uint8Array(32);

const SOURCE = (valueType: string): string => `contract C {
  mapping(int => ${valueType}) m;
  function set(int k, ${valueType} v) external { m[k] = v; require(true); }
  function check(int k, ${valueType} expected) external view { require(m[k] == expected); }
  function dropThenSet(int k, int j, ${valueType} v, int sel) external {
    if (sel > 0) { delete m[k]; m[j] = v; }
    require(true);
  }
}`;

type Provider = ReturnType<typeof createTestProvider>;

interface Deployed {
  provider: Provider; sc: StatefulContract<any>; pinned: Contract; cat: string;
}

async function deploy(valueType: string): Promise<Deployed> {
  const provider = createTestProvider();
  const artifact = compileString(SOURCE(valueType), { forceStateful: true });
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, {}, { saltContract: true },
  );
  const pinned = contract.category ? contract : contract.withCategory(hexToBin(categoryId));
  const sc = StatefulContract.withCategory(contract, categoryId);
  const fn = artifact.abi.find((entry) => entry.name === 'dropThenSet')!;
  expect(fn.sortedBatchInfo).toHaveLength(1);
  expect(fn.sortedBatchInfo![0].slotIndices).toHaveLength(2);
  return { provider, sc, pinned, cat: categoryId };
}

const slotOf = (key: bigint): Uint8Array => keyToSlot(bigIntToVmNumber(key));

/** One absent key in the gap `owner`'s node opens. */
async function keyIn(deployed: Deployed, owner: bigint): Promise<bigint> {
  const utxos = await deployed.provider.getUtxos(getEntryNftAddress(deployed.pinned, deployed.cat, 'm'));
  const list = SortedList.fromUtxos(utxos.filter((utxo) => utxo.token?.category === deployed.cat
    && utxo.token.nft?.capability === 'mutable'));
  const spentBy = (key: bigint): string => {
    const node = list.find(slotOf(key)) ?? list.predecessorOf(slotOf(key));
    return `${node.utxo.txid}:${node.utxo.vout}`;
  };
  const ownerSpent = spentBy(owner);
  for (let key = 100n; key < 200_000n; key += 1n) {
    if (!list.has(slotOf(key)) && spentBy(key) === ownerSpent) return key;
  }
  throw new Error(`no key in the gap of ${owner}`);
}

describe('DS-6 default relink for non-int value kinds', () => {
  it('relinks a bigint node at zero beside an insert', async () => {
    const deployed = await deploy('bigint');
    const { sc } = deployed;
    await sc.getFunction('set')(7n, 70n).send();
    const x = await keyIn(deployed, 7n);
    await sc.getFunction('dropThenSet')(7n, x, 300n, 1n).send();
    await expect(sc.getFunction('check')(7n, 0n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(x, 300n).send()).resolves.toBeDefined();
  }, 300_000);

  it('relinks a bytes32 node at 32 zero bytes beside an insert', async () => {
    const deployed = await deploy('bytes32');
    const { sc } = deployed;
    await sc.getFunction('set')(7n, hexToBin('aa'.repeat(32))).send();
    const x = await keyIn(deployed, 7n);
    await sc.getFunction('dropThenSet')(7n, x, hexToBin('bb'.repeat(32)), 1n).send();
    await expect(sc.getFunction('check')(7n, ZERO32).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(x, hexToBin('bb'.repeat(32))).send()).resolves.toBeDefined();
  }, 300_000);

  it('relinks an unbounded bytes node at empty bytes beside an insert', async () => {
    const deployed = await deploy('bytes');
    const { sc } = deployed;
    await sc.getFunction('set')(7n, hexToBin('deadbeef')).send();
    const x = await keyIn(deployed, 7n);
    await sc.getFunction('dropThenSet')(7n, x, hexToBin('cafe'), 1n).send();
    await expect(sc.getFunction('check')(7n, new Uint8Array()).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(x, hexToBin('cafe')).send()).resolves.toBeDefined();
  }, 300_000);
});

describe('DS-6 default relink for struct/array value kinds', () => {
  const STRUCT_SOURCE = `contract C {
    struct P { int x; int y; }
    mapping(int => P) m;
    function set(int k, int x, int y) external { m[k] = P(x, y); require(true); }
    function check(int k, int x, int y) external view { require(m[k].x == x); require(m[k].y == y); }
    function dropThenSet(int k, int j, int x, int y, int sel) external {
      if (sel > 0) { delete m[k]; m[j] = P(x, y); }
      require(true);
    }
  }`;

  const ARRAY_SOURCE = `contract C {
    mapping(int => int[]) m;
    function set(int k, int[] v) external { m[k] = v; require(true); }
    function checkLen(int k, int expected) external view { require(m[k].length == expected); }
    function dropThenSet(int k, int j, int[] v, int sel) external {
      if (sel > 0) { delete m[k]; m[j] = v; }
      require(true);
    }
  }`;

  const CHUNKED_ARRAY_SOURCE = `contract C {
    mapping(int => int[]) m;
    function set(int k, int[] v) external { m[k] = v; require(true); }
    function checkLen(int k, int expected) external view { require(m[k].length == expected); }
    function dropThenSet(int k, int j, int[] v, int sel) external {
      if (sel > 0) { delete m[k]; m[j] = v; }
      require(true);
    }
  }`;

  async function deploySource(source: string): Promise<Deployed> {
    const provider = createTestProvider();
    const artifact = compileString(source, { forceStateful: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, {}, { saltContract: true },
    );
    const pinned = contract.category ? contract : contract.withCategory(hexToBin(categoryId));
    const sc = StatefulContract.withCategory(contract, categoryId);
    const fn = artifact.abi.find((entry) => entry.name === 'dropThenSet')!;
    expect(fn.sortedBatchInfo).toHaveLength(1);
    expect(fn.sortedBatchInfo![0].slotIndices).toHaveLength(2);
    return { provider, sc, pinned, cat: categoryId };
  }

  it('relinks a struct node at its recursive default beside an insert', async () => {
    const deployed = await deploySource(STRUCT_SOURCE);
    const { sc } = deployed;
    await sc.getFunction('set')(7n, 70n, 71n).send();
    const x = await keyIn(deployed, 7n);
    await sc.getFunction('dropThenSet')(7n, x, 300n, 301n, 1n).send();
    await expect(sc.getFunction('check')(7n, 0n, 0n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(x, 300n, 301n).send()).resolves.toBeDefined();
  }, 300_000);

  it('keeps an inline int[] default relink fail-closed', async () => {
    const deployed = await deploySource(ARRAY_SOURCE);
    const { sc } = deployed;
    await sc.getFunction('set')(7n, [70n]).send();
    const x = await keyIn(deployed, 7n);
    await expect(sc.getFunction('dropThenSet')(7n, x, [300n], 1n).send()).rejects.toThrow(
      /OP_VERIFY/,
    );
  }, 300_000);

  it('keeps a chunked (>60 B) int[] default relink fail-closed', async () => {
    const deployed = await deploySource(CHUNKED_ARRAY_SOURCE);
    const { sc } = deployed;
    await sc.getFunction('set')(7n, [70n, 71n]).send();
    const x = await keyIn(deployed, 7n);
    await expect(sc.getFunction('dropThenSet')(7n, x, [300n, 301n], 1n).send()).rejects.toThrow(
      /OP_VERIFY/,
    );
  }, 300_000);
});
