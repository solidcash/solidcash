import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2sh32, hash256,
} from '@bitauth/libauth';
import {
  asmToScript, buildEntryNftCovenantScript, computeCollectionHash, encodeIntegerValue, scriptToBytecode,
  type Artifact,
} from '@solidcash/utils';
import { encodeEntryCommitment, keyToSlotMulti } from '../../solidcash/src/stateful/SortedList.js';
import type { FunctionDefinitionNode, Node } from '../src/ast/AST.js';
import { compileString } from '../src/index.js';
import SymbolTableTraversal from '../src/semantic/SymbolTableTraversal.js';

/**
 * ROUTE-SKIP-1 residual. A message-bus handler clone's sorted writes stay on the scalar path because the clone is
 * flagged, not because of its name, so a renamed clone cannot take the batch path's -2 skip. A direct batch writes
 * every row: the inactive-row sentinel -2 is refused on a plain multi-target batch.
 */

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmOutput = VmTransaction['outputs'][number];

const PRAGMA = 'pragma solidcash ^0.14.0;';
const EMPTY = new Uint8Array(0);
const ZERO32 = new Uint8Array(32);
const CATEGORY = Uint8Array.from({ length: 32 }, (_, index) => (0x29 + index * 37) & 0xff);
const FUNDER_LOCK = Uint8Array.from([0x51]);
const VALUE = 20_000n;
const num = (value: bigint): Uint8Array => encodeIntegerValue(value);

/** A 32-byte slot as OP_BIN2NUM reads it: little-endian sign-magnitude. */
function slotNumber(slot: Uint8Array): bigint {
  let magnitude = 0n;
  for (let index = slot.length - 1; index >= 0; index -= 1) {
    magnitude = (magnitude << 8n) | BigInt(index === slot.length - 1 ? slot[index]! & 0x7f : slot[index]!);
  }
  return (slot[slot.length - 1]! & 0x80) === 0 ? magnitude : -magnitude;
}

/**
 * `f` updates `m[1]` (slot 0, input 1) and `m[2]` (slot 1, input 2) in place: the two nodes are adjacent and the
 * higher one ends the list. `skipped` publishes -2 for that row and keeps its node unchanged, the skipped-debit shape.
 */
function pairSpend(artifact: Artifact, skipped?: number): true | string {
  const fn = artifact.abi.find((entry) => entry.name === 'f')!;
  const redeem = scriptToBytecode(asmToScript(artifact.bytecode));
  const lock = encodeLockingBytecodeP2sh32(hash256(redeem));
  const collection = artifact.stateLayout!.collections!.find((entry) => entry.name === 'm')!;
  const entryRedeem = scriptToBytecode(buildEntryNftCovenantScript(
    CATEGORY, computeCollectionHash(collection.signature), lock,
  ));
  const entryLock = encodeLockingBytecodeP2sh32(hash256(entryRedeem));
  const slots = [keyToSlotMulti([num(1n)]), keyToSlotMulti([num(2n)])];
  const low = slotNumber(slots[0]!) < slotNumber(slots[1]!) ? 0 : 1;
  const next = [0, 1].map((target) => (target === low ? slots[1 - target]! : ZERO32));
  const rows = new Uint8Array([...slots[low]!, ...next[low]!, ...slots[1 - low]!, ...next[1 - low]!]);
  const witness = (name: string): Uint8Array => {
    const target = Number(/_(\d+)$/.exec(name)?.[1] ?? -1);
    if (name.startsWith('__internal__vmapBatchSlot_')) return slots[target]!;
    if (name.startsWith('__internal__vmapBatchProof_')) return num(BigInt(1 + target));
    if (name.startsWith('__internal__vmapBatchNext_')) return next[target]!;
    if (name.startsWith('__internal__vmapBatchPredOut_')) return num(target === skipped ? -2n : -1n);
    if (name.startsWith('__internal__vmapBatchRank_')) return num(target === low ? 0n : 1n);
    if (name === '__internal__vmapBatchRows_m') return rows;
    if (name.startsWith('__internal__')) return EMPTY;
    throw new Error(`no witness for '${name}'`);
  };
  const pushes = fn.inputs.map((input) => witness(input.name)).reverse();
  const before = [0, 1].map((target) => encodeEntryCommitment(slots[target]!, next[target]!, num(3n + BigInt(target))));
  const after = [0, 1].map((target) => (target === skipped
    ? before[target]! : encodeEntryCommitment(slots[target]!, next[target]!, num(5n + BigInt(target)))));
  const token = (capability: 'minting' | 'mutable', commitment: Uint8Array): VmOutput['token'] =>
    ({ category: CATEGORY, amount: 0n, nft: { capability, commitment } });
  const outpoint = (index: number): Uint8Array =>
    Uint8Array.from({ length: 32 }, (_, at) => (0x80 + index + at * 7) & 0xff);
  const entryUnlock = new Uint8Array([
    ...encodeDataPush(EMPTY), ...encodeDataPush(num(1n)), ...encodeDataPush(entryRedeem),
  ]);
  const transaction: VmTransaction = {
    version: 2,
    locktime: 0,
    inputs: [
      new Uint8Array([...pushes.flatMap((push) => [...encodeDataPush(push)]), ...encodeDataPush(redeem)]),
      entryUnlock,
      entryUnlock,
      EMPTY,
    ].map((unlockingBytecode, index) => ({
      outpointIndex: 0, outpointTransactionHash: outpoint(index), sequenceNumber: 0xffffffff, unlockingBytecode,
    })),
    outputs: [
      { lockingBytecode: lock, valueSatoshis: VALUE, token: token('minting', EMPTY) },
      { lockingBytecode: entryLock, valueSatoshis: VALUE, token: token('mutable', after[0]!) },
      { lockingBytecode: entryLock, valueSatoshis: VALUE, token: token('mutable', after[1]!) },
      { lockingBytecode: FUNDER_LOCK, valueSatoshis: 90_000n },
    ],
  };
  const sourceOutputs: VmProgram['sourceOutputs'] = [
    { lockingBytecode: lock, valueSatoshis: VALUE, token: token('minting', EMPTY) },
    { lockingBytecode: entryLock, valueSatoshis: VALUE, token: token('mutable', before[0]!) },
    { lockingBytecode: entryLock, valueSatoshis: VALUE, token: token('mutable', before[1]!) },
    { lockingBytecode: FUNDER_LOCK, valueSatoshis: 100_000n },
  ];
  return createVirtualMachineBch2026().verify({ sourceOutputs, transaction });
}

describe('ROUTE-SKIP-1 typed scalar-clone guard', () => {
  it('keeps a flagged clone scalar whatever its name', () => {
    const lone = (name: string): string => `${PRAGMA} contract Lone { mapping(uint => uint) m;`
      + ` function ${name}(uint k, uint v) { this.m[k] = v; require(true); } }`;
    const batched = compileString(lone('direct'), { messageBus: false }).abi.find((fn) => fn.name === 'direct');
    expect(batched?.sortedBatchInfo).toMatchObject([{ collection: 'm', slotIndices: [0] }]);
    expect(batched?.inputs.map((input) => input.name)).toContain('__internal__vmapBatchPredOut_0');

    // A clone renamed out of the `__message_bus_` family: only the flag says the route owns its records.
    const visit = SymbolTableTraversal.prototype.visitFunctionDefinition;
    SymbolTableTraversal.prototype.visitFunctionDefinition = function flagRelabelled(
      this: SymbolTableTraversal, node: FunctionDefinitionNode,
    ): Node {
      if (node.name === 'relabelled') node.ownRecordsScalarOnly = true;
      return visit.call(this, node);
    };
    let scalar: ReturnType<typeof compileString>['abi'][number] | undefined;
    try {
      scalar = compileString(lone('relabelled'), { messageBus: false }).abi.find((fn) => fn.name === 'relabelled');
    } finally {
      SymbolTableTraversal.prototype.visitFunctionDefinition = visit;
    }
    expect(scalar?.entryAccesses).toHaveLength(1);
    expect(scalar?.sortedBatchInfo).toBeUndefined();
    expect(scalar?.inputs.some((input) => input.name.startsWith('__internal__vmapBatch'))).toBe(false);
  });

  it('settles an honest direct two-target batch and refuses a forged -2 on either row', () => {
    const artifact = compileString(`${PRAGMA} contract Pair { mapping(uint => uint) m;`
      + ' function f() { this.m[1] = 5; this.m[2] = 6; require(true); } }', { messageBus: false });
    expect(artifact.abi.find((fn) => fn.name === 'f')?.sortedBatchInfo)
      .toMatchObject([{ collection: 'm', slotIndices: [0, 1] }]);
    expect(pairSpend(artifact), 'honest batch').toBe(true);
    for (const skipped of [0, 1]) {
      expect(pairSpend(artifact, skipped), `forged -2 on row ${skipped}`).not.toBe(true);
    }
  });
});
