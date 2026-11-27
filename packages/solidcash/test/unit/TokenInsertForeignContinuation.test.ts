import { describe, expect, it } from 'vitest';
import type { TransactionBuilder } from '../../src/TransactionBuilder.js';
import { reassertTokenInsertNewLocks, type TokenInsertNewLocksHost } from '../../src/stateful/stb-token-insert-new-locks.js';

/**
 * A sorted INSERT's lock restore offers every other entry offset of the writer's block as a candidate, and each
 * collection has its own entry covenant lock. An offset whose output still continues its own input under another
 * collection's lock is that collection's update (a transferFrom's allowance beside the inserted balance): the
 * restore leaves it. An entry of the inserting collection whose output another collection's lock overwrote is
 * still restored.
 */

const CATEGORY = '13fa0247846c2b5bf144b08522ed8d5743cd1259951fa0c5d09eac93ad6bdca8';
const MASTER = 2;
const lockOf = (byte: number): Uint8Array => Uint8Array.from([0xaa, 0x20, ...new Array<number>(32).fill(byte), 0x87]);
const ALLOWANCE_LOCK = lockOf(0x11);
const BALANCES_LOCK = lockOf(0x22);
const OTHER_LOCK = lockOf(0x33);
/** A sorted entry node: key slot, next slot and value. */
const node = (key: string, next: string, value: string): string => `${key.repeat(32)}${next.repeat(32)}${value}`;

type Output = TransactionBuilder['outputs'][number];
const entryOutput = (lock: Uint8Array, commitment: string): Output => ({
  to: lock,
  amount: 1000n,
  token: { amount: 0n, category: CATEGORY, nft: { capability: 'mutable', commitment } },
}) as Output;
const entryInput = (lock: Uint8Array, commitment: string): unknown => ({
  txid: '00'.repeat(32),
  vout: 0,
  satoshis: 1000n,
  token: { amount: 0n, category: CATEGORY, nft: { capability: 'mutable', commitment } },
  unlocker: { generateLockingBytecode: (): Uint8Array => lock },
});

const ALLOWANCE_IN = node('a1', '00', '64');
const ALLOWANCE_OUT = node('a1', '00', '3c');
const OWNER_IN = node('79', '00', '64');
const OWNER_OUT = node('79', '00', '3c');

/** transferFrom's block: allowance update at 1, owner balance update at 2, the recipient's insert at 3. */
function restore(ownerOutputLock: Uint8Array): Output[] {
  const layout = {
    slots: [
      { kind: 'entry', offset: 1, slotIndex: 0 },
      { kind: 'entry', offset: 2, slotIndex: 1 },
      { kind: 'entry', offset: 3, slotIndex: 2 },
    ],
  };
  const group = {
    categoryId: CATEGORY,
    functionName: 'transferFrom',
    logicalArtifact: {
      abi: [{
        name: 'transferFrom',
        inputs: [],
        blockLayout: layout,
        entryAccesses: [
          { collection: 'allowance', operations: ['read', 'write'] },
          { collection: 'balanceOf', operations: ['read', 'write'] },
          { collection: 'balanceOf', operations: ['write'] },
        ],
      }],
    },
    blockLayout: layout,
    plannedEntryInserts: [{ blockSlot: 3, outputBlockSlot: 5, newCommitment: node('67', '79', '0a') }],
    internalArgs: { __internal__vmapBatchPredOut_2: 7n },
  };
  const outputs: Output[] = [
    { to: OTHER_LOCK, amount: 1000n } as Output,
    { to: OTHER_LOCK, amount: 1000n } as Output,
    { to: OTHER_LOCK, amount: 1000n } as Output,
    entryOutput(ALLOWANCE_LOCK, ALLOWANCE_OUT),
    entryOutput(ownerOutputLock, OWNER_OUT),
    entryOutput(BALANCES_LOCK, node('00', '67', '')),
  ];
  const host = {
    allInputs: [
      {}, {}, {},
      entryInput(ALLOWANCE_LOCK, ALLOWANCE_IN),
      entryInput(BALANCES_LOCK, OWNER_IN),
      entryInput(BALANCES_LOCK, node('00', '79', '')),
    ],
    externalCallUtxoGroups: [group],
    lowLevelCallUtxoGroups: [],
    entryRawCommitments: new Map(),
    externalCallEntryOutputs: new Map([[CATEGORY, new Map([[1, ALLOWANCE_OUT], [2, OWNER_OUT]])]]),
    findMintingInputIndex: (categoryId: string): number => (categoryId === CATEGORY ? MASTER : -1),
  } as unknown as TokenInsertNewLocksHost;
  reassertTokenInsertNewLocks(host, { outputs } as unknown as TransactionBuilder);
  return outputs;
}

describe('token insert lock restore beside another collection', () => {
  it('leaves an allowance output that continues its own input under the allowance lock', () => {
    const allowance = restore(BALANCES_LOCK)[MASTER + 1]!;
    expect(allowance.to).toEqual(ALLOWANCE_LOCK);
    expect(allowance.token?.nft?.commitment).toBe(ALLOWANCE_OUT);
  });

  it('still restores the balance lock over an owner output another collection overwrote', () => {
    const owner = restore(OTHER_LOCK)[MASTER + 2]!;
    expect(owner.to).toEqual(BALANCES_LOCK);
    expect(owner.token?.nft?.commitment).toBe(OWNER_OUT);
  });
});
