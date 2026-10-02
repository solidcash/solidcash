import { describe, expect, it } from 'vitest';
import {
  bigIntToVmNumber, binToHex, decodeTransactionUnsafe, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { Contract, StatefulContract } from '../../src/index.js';
import { createTestProvider, expectScriptRejection, setupStatefulUtxos } from '../test-util.js';
import { decodeEntryCommitment, encodeEntryCommitment, keyToSlot } from '../../src/stateful/SortedList.js';

/**
 * Two sorted-mapping writes under one branch arm form a multi-slot batch (OZ's `_update` behind transfer). Its
 * topology verifier pins slot/next on every path, but only the inline upserts pin values, and the arm not taken skips
 * them: the master accepted any value for both co-spent nodes there. The direct convention now preserves every batch
 * node (input == output) where the batch did not run. The per-slot "write ran" flag cannot cover this: a relinked
 * predecessor has no upsert of its own.
 *
 * As in ConditionalSortedWritePreservation: the arm-not-taken spend is captured unsent; with a co-spent node's value
 * changed it is refused at the master; sent as built it settles and leaves both values; the arm-taken spend settles.
 */
const SOURCE = `contract Cond {
  mapping(int => int) bal;
  function set(int k, int v) external { bal[k] = v; require(true); }
  function moveInArm(int a, int b, int v, bool go) external {
    if (go) { require(bal[a] >= v); bal[a] = bal[a] - v; bal[b] = bal[b] + v; }
    require(true);
  }
  function moveInElse(int a, int b, int v, bool skip) external {
    if (skip) { require(true); } else { require(bal[a] >= v); bal[a] = bal[a] - v; bal[b] = bal[b] + v; }
    require(true);
  }
  function check(int k, int e) external { require(bal[k] == e); }
}`;

const A = 7n;
const B = 9n;
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

const slotOf = (key: bigint): string => binToHex(keyToSlot(bigIntToVmNumber(key)));

/** The output index of the entry node whose slot is `key`'s. */
function nodeOutputFor(tx: Tx, key: bigint): number {
  const indices = tx.outputs.flatMap((output, index) => {
    const commitment = output.token?.nft?.commitment;
    if (commitment === undefined || commitment.length < 64) return [];
    return binToHex(decodeEntryCommitment(commitment).slot) === slotOf(key) ? [index] : [];
  });
  expect(indices).toHaveLength(1);
  return indices[0];
}

/** Rewrite `key`'s node value to another of the same length, so the change cannot be refused on size or fee. */
function changeValue(tx: Tx, key: bigint): void {
  const output = tx.outputs[nodeOutputFor(tx, key)];
  const { slot, nextKey, value } = decodeEntryCommitment(output.token!.nft!.commitment);
  const changed = value.slice();
  changed[0] ^= 0x01;
  output.token!.nft!.commitment = encodeEntryCommitment(slot, nextKey, changed);
}

function mutate(hex: string, apply: (tx: Tx) => void): string {
  const tx = decodeTransactionUnsafe(hexToBin(hex));
  apply(tx);
  return binToHex(encodeTransaction(tx));
}

async function expectRefusedAtMaster(provider: Provider, hex: string): Promise<void> {
  const outcome = await provider.sendRawTransaction(hex).then(() => 'ACCEPTED').catch((error: Error) => error.message);
  expectScriptRejection(outcome, 0);
}

describe('conditional sorted batch: the arm not taken preserves both co-spent nodes', () => {
  for (const [name, fn, notTaken, taken] of [
    ['an if arm', 'moveInArm', [A, B, 10n, false], [A, B, 10n, true]],
    ['an else arm', 'moveInElse', [A, B, 10n, true], [A, B, 10n, false]],
  ] as const) {
    it(`${name}: refuses a changed debit or credit node, then settles the move`, async () => {
      const { provider, sc } = await deploy();
      await sc.getFunction('set')(A, 50n).send();
      await sc.getFunction('set')(B, 20n).send();

      const skip = await capture(provider, () => sc.getFunction(fn)(...notTaken).send());
      await expectRefusedAtMaster(provider, mutate(skip, (tx) => changeValue(tx, A)));
      await expectRefusedAtMaster(provider, mutate(skip, (tx) => changeValue(tx, B)));

      await expect(provider.sendRawTransaction(skip)).resolves.toBeTypeOf('string');
      await expect(sc.getFunction('check')(A, 50n).send()).resolves.toBeDefined();
      await expect(sc.getFunction('check')(B, 20n).send()).resolves.toBeDefined();

      await sc.getFunction(fn)(...taken).send();
      await expect(sc.getFunction('check')(A, 40n).send()).resolves.toBeDefined();
      await expect(sc.getFunction('check')(B, 30n).send()).resolves.toBeDefined();
    }, 300_000);
  }
});
