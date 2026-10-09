import { describe, expect, it } from 'vitest';
import {
  bigIntToVmNumber, binToHex, decodeTransactionUnsafe, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createTestProvider, expectScriptRejection, setupStatefulUtxos } from '../test-util.js';
import { decodeEntryCommitment, encodeEntryCommitment, keyToSlot } from '../../src/stateful/SortedList.js';

/**
 * A sorted mapping write under a branch arm settles its node at the write site, so on the arm not taken the
 * co-spent node carried no constraint: the master accepted any value for it, and the builder wrote the type default.
 * The direct convention now preserves that node (input == output) on every path that skips the write.
 *
 * Each shape runs on one deployment. The arm-not-taken spend is captured unsent; with the written key's value changed
 * it is refused at the master; sent as built it settles and leaves the value as it was; then the arm-taken spend
 * still settles the new value.
 */

const SOURCE = `contract ConditionalWrites {
  mapping(int => int) m;
  function store(int k, int v) internal { m[k] = v; }
  function set(int k, int v) external { m[k] = v; require(true); }
  function writeInArm(int k, int v) external {
    int current = m[k];
    if (current != 1000000) { require(current >= v); m[k] = current - v; }
    require(true);
  }
  function writeInHelper(int k, int v) external {
    int current = m[k];
    if (current != 1000000) { require(current >= v); store(k, current - v); }
    require(true);
  }
  function addInArm(int k, int amount) external {
    if (amount > 0) { require(amount < 1000); m[k] = m[k] + amount; }
    require(true);
  }
  function addInNestedArm(int k, int a, int b) external {
    if (a > 0) { if (b > 0) { require(b < 100); m[k] = m[k] + b; } }
    require(true);
  }
  function addInElseArm(int k, int amount) external {
    if (amount == 0) { require(true); } else { require(amount < 1000); m[k] = m[k] + amount; }
    require(true);
  }
  function check(int k, int expected) external { require(m[k] == expected); }
}`;

const K = 7n;
const ABSENT = 11n;
/** The arm in writeInArm / writeInHelper is skipped while the stored value is this sentinel. */
const SENTINEL = 1000000n;

interface Shape {
  readonly fn: string;
  /** The value at K before the arm-not-taken spend. */
  readonly stored: bigint;
  readonly notTaken: readonly bigint[];
  /** The value at K before the arm-taken spend, and after it. */
  readonly takenFrom: bigint;
  readonly taken: readonly bigint[];
  readonly takenTo: bigint;
}

const SHAPES: Record<string, Shape> = {
  'a write in an arm holding a require': {
    fn: 'writeInArm', stored: SENTINEL, notTaken: [K, 2n], takenFrom: 5n, taken: [K, 2n], takenTo: 3n,
  },
  'a write through an internal helper': {
    fn: 'writeInHelper', stored: SENTINEL, notTaken: [K, 2n], takenFrom: 5n, taken: [K, 2n], takenTo: 3n,
  },
  'an addition in an arm': {
    fn: 'addInArm', stored: 50n, notTaken: [K, 0n], takenFrom: 50n, taken: [K, 5n], takenTo: 55n,
  },
  'an addition in a nested arm': {
    fn: 'addInNestedArm', stored: 50n, notTaken: [K, 1n, 0n], takenFrom: 50n, taken: [K, 1n, 5n], takenTo: 55n,
  },
  'an addition in an else arm': {
    fn: 'addInElseArm', stored: 50n, notTaken: [K, 0n], takenFrom: 50n, taken: [K, 5n], takenTo: 55n,
  },
};

type Provider = ReturnType<typeof createTestProvider>;
type Tx = ReturnType<typeof decodeTransactionUnsafe>;

async function deploy(): Promise<{ provider: Provider; sc: StatefulContract<any> }> {
  const provider = createTestProvider();
  const artifact = compileString(SOURCE, { forceStateful: true });
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, {}, { saltContract: true },
  );
  return { provider, sc: StatefulContract.withCategory(contract, categoryId) };
}

/** Derive and capture a transaction without broadcasting it, leaving every input unspent. */
async function capture(provider: Provider, run: () => Promise<unknown>): Promise<string> {
  let captured = '';
  const send = provider.sendRawTransaction.bind(provider);
  (provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
    captured = hex;
    throw new Error('capture-only');
  };
  await expect(run()).rejects.toThrow('capture-only');
  (provider as any).sendRawTransaction = send;
  expect(captured).not.toBe('');
  return captured;
}

function mutate(hex: string, apply: (tx: Tx) => void): string {
  const tx = decodeTransactionUnsafe(hexToBin(hex));
  apply(tx);
  return binToHex(encodeTransaction(tx));
}

const slotOf = (key: bigint): string => binToHex(keyToSlot(bigIntToVmNumber(key)));

/** The output indices of the entry nodes whose slot is `key`'s. */
function nodeOutputsFor(tx: Tx, key: bigint): number[] {
  return tx.outputs.flatMap((output, index) => {
    const commitment = output.token?.nft?.commitment;
    if (commitment === undefined || commitment.length < 64) return [];
    return binToHex(decodeEntryCommitment(commitment).slot) === slotOf(key) ? [index] : [];
  });
}

/** Rewrite `key`'s node value to another of the same length, so the change cannot be refused on size or fee. */
function changeValue(tx: Tx, key: bigint): void {
  const indices = nodeOutputsFor(tx, key);
  expect(indices).toHaveLength(1);
  const output = tx.outputs[indices[0]];
  const { slot, nextKey, value } = decodeEntryCommitment(output.token!.nft!.commitment);
  const changed = value.slice();
  changed[0] ^= 0x01;
  output.token!.nft!.commitment = encodeEntryCommitment(slot, nextKey, changed);
}

async function expectRefusedAtMaster(provider: Provider, hex: string): Promise<void> {
  const outcome = await provider.sendRawTransaction(hex).then(() => 'ACCEPTED').catch((error: Error) => error.message);
  expectScriptRejection(outcome, 0);
}

describe('conditional sorted write: the arm not taken preserves the co-spent node', () => {
  for (const [name, shape] of Object.entries(SHAPES)) {
    it(`${name}: refuses a changed value, then settles both arms`, async () => {
      const { provider, sc } = await deploy();
      await sc.getFunction('set')(K, shape.stored).send();

      // Arm not taken: the node keeps its value, so any other value at K is refused at the master.
      const notTaken = await capture(provider, () => sc.getFunction(shape.fn)(...shape.notTaken).send());
      await expectRefusedAtMaster(provider, mutate(notTaken, (tx) => changeValue(tx, K)));

      // The spend as built settles and leaves K as it was.
      await expect(provider.sendRawTransaction(notTaken)).resolves.toBeTypeOf('string');
      await expect(sc.getFunction('check')(K, shape.stored).send()).resolves.toBeDefined();

      // Arm taken: the write still settles its new value.
      if (shape.takenFrom !== shape.stored) await sc.getFunction('set')(K, shape.takenFrom).send();
      await sc.getFunction(shape.fn)(...shape.taken).send();
      await expect(sc.getFunction('check')(K, shape.takenTo).send()).resolves.toBeDefined();
    }, 300_000);
  }

  it('an absent key on the arm not taken gains no node, and a node added for it is refused', async () => {
    const { provider, sc } = await deploy();
    await sc.getFunction('set')(K, 50n).send();

    const notTaken = await capture(provider, () => sc.getFunction('addInArm')(ABSENT, 0n).send());
    expect(nodeOutputsFor(decodeTransactionUnsafe(hexToBin(notTaken)), ABSENT)).toStrictEqual([]);

    // A node for the absent key appended to the same spend, funded from the change, is refused at the master.
    await expectRefusedAtMaster(provider, mutate(notTaken, (tx) => {
      const source = tx.outputs[nodeOutputsFor(tx, K)[0] ?? tx.outputs.findIndex(
        (output) => (output.token?.nft?.commitment.length ?? 0) >= 64,
      )];
      tx.outputs[tx.outputs.length - 1].valueSatoshis = 1n;
      tx.outputs.push({
        ...source,
        valueSatoshis: 1n,
        lockingBytecode: source.lockingBytecode.slice(),
        token: {
          ...source.token!,
          nft: {
            ...source.token!.nft!,
            commitment: encodeEntryCommitment(keyToSlot(bigIntToVmNumber(ABSENT)), new Uint8Array(32),
              bigIntToVmNumber(77n)),
          },
        },
      });
    }));

    await expect(provider.sendRawTransaction(notTaken)).resolves.toBeTypeOf('string');
    await expect(sc.getFunction('check')(ABSENT, 0n).send()).resolves.toBeDefined();
  }, 300_000);
});
