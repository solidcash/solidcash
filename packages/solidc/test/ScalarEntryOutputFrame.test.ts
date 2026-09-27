import { createTestAuthenticationProgramBch, createVirtualMachineBCH } from '@bitauth/libauth';
import { encodeInt, Op, PrimitiveType, scriptToBytecode } from '@solidcash/utils';
import type { Script, SingleLocationData } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import type { FunctionDefinitionNode, MappingAssignNode } from '../src/ast/AST.js';
import GenerateTargetTraversal from '../src/generation/GenerateTargetTraversal.js';

type UpsertTraversal = {
  stack: string[];
  output: Script;
  currentFunction: FunctionDefinitionNode;
  entrySlots: Array<{ collection: string; collectionSignature: string; operations: string[] }>;
  emitSortedKeyHash(): void;
  emitSortedEntryAddress(): void;
  emitSortedValueUpsert(node: MappingAssignNode, value: () => void): void;
  emitEntryOutputIndex(slot: number, loc: SingleLocationData, rawDepth: number): void;
};

describe('scalar mapping update output frame', () => {
  it('does not count the tracked value again when copying the owner below raw proof fields', () => {
    const traversal = new GenerateTargetTraversal({}) as unknown as UpsertTraversal;
    const owner = '__internal__messageBusOwnerInput';
    const dynamicBase = '__internal__dynamicChunkInputBase';
    traversal.stack = [owner, dynamicBase];
    traversal.currentFunction = {
      name: 'handler', parameters: [{ name: owner }, { name: dynamicBase }], modifiers: [],
      blockLayout: { blockSize: 11, slots: [{ kind: 'entry', slotIndex: 0, offset: 10 }] },
    } as unknown as FunctionDefinitionNode;
    traversal.entrySlots = [{ collection: 'flags', collectionSignature: 'flags:mapping(int => bool)',
      operations: ['write'] }];
    const node = {
      entrySlotIndex: 0,
      collection: { name: 'flags', innermostValueType: PrimitiveType.BOOL },
      location: { start: { line: 1, column: 0 }, end: { line: 1, column: 1 } },
    } as unknown as MappingAssignNode;
    // Key/address encoding is independent of the frame boundary under test. Keep both results untracked,
    // exactly as the real encoders do; the upsert itself still performs all proof splitting and value tracking.
    traversal.emitSortedKeyHash = () => { traversal.output.push(new Uint8Array(32)); };
    traversal.emitSortedEntryAddress = () => { traversal.output.push(new Uint8Array(35)); };
    const emitIndex = traversal.emitEntryOutputIndex.bind(traversal);
    let coordinate: Script = [];
    const captured = new Error('captured update coordinate');
    traversal.emitEntryOutputIndex = (slot, loc, rawDepth) => {
      const start = traversal.output.length;
      emitIndex(slot, loc, rawDepth);
      coordinate = traversal.output.slice(start);
      expect(traversal.stack).toEqual(['(value)', owner, dynamicBase]);
      throw captured; // Only the first (UPDATE) coordinate is needed, not the alternate INSERT branch.
    };
    expect(() => traversal.emitSortedValueUpsert(node, () => {
      traversal.output.push(encodeInt(0n));
      traversal.stack.unshift('(value)');
    })).toThrow(captured);

    // Different owner/dynamic coordinates make a one-cell over-count observable: 7 + 10, not 55 + 10.
    const frame = [encodeInt(55n), encodeInt(7n), encodeInt(0n)];
    const proof = [new Uint8Array(32), new Uint8Array(35), new Uint8Array(32), new Uint8Array(32), encodeInt(1n)];
    const input = [...frame, ...proof];
    const checkPreserved = [...input].reverse().flatMap((value) => [value, Op.OP_EQUALVERIFY]);
    const vm = createVirtualMachineBCH(false);
    const evaluated = vm.evaluate(createTestAuthenticationProgramBch({
      unlockingBytecode: scriptToBytecode(input), valueSatoshis: 1000n,
      lockingBytecode: scriptToBytecode([
        ...coordinate, encodeInt(17n), Op.OP_EQUALVERIFY, ...checkPreserved, Op.OP_1,
      ]),
    }));
    expect(evaluated.error).toBeUndefined();
    expect(vm.stateSuccess(evaluated)).toBe(true);
  });
});
