import { createTestAuthenticationProgramBch, createVirtualMachineBCH } from '@bitauth/libauth';
import { encodeInt, Op, PositionHint, scriptToBytecode } from '@solidcash/utils';
import type { Script, SingleLocationData } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import GenerateTargetTraversal from '../src/generation/GenerateTargetTraversal.js';

// Exercise the emitted offset fragment with the same tracked frame and raw predecessor fields as its callers.
// Full-contract integration is covered by KernelMixedEntryInsert; this isolates the two distinct chunk formats.
type PrefixTraversal = {
  stack: string[];
  output: Script;
  currentFunction: { name: string; dynamicWrites: string[]; messageBusRoute: boolean };
  pendingDynamicWrites: Map<string, { valueStackName: string }>;
  valueChunkTrailingCountActive: boolean;
  emitAddDynamicOutputsBeforeEntries(location: SingleLocationData, depth: number, iterations: boolean): void;
};

describe('dynamic output prefix of scalar entry inserts', () => {
  it.each([
    { lengths: [2, 53], depth: 5, route: true },
    { lengths: [0, 60], depth: 0, route: false },
    { lengths: [61, 120], depth: 5, route: false },
    { lengths: [121, 241], depth: 0, route: true },
  ])('counts only dynamic-state chunks at $lengths bytes (depth $depth, route $route)', ({ lengths, depth, route }) => {
    const traversal = new GenerateTargetTraversal({}) as unknown as PrefixTraversal;
    traversal.currentFunction = { name: 'prefix', dynamicWrites: ['first', 'second'], messageBusRoute: route };
    traversal.stack = [
      '__internal__dynwrite_value_first', '__internal__dynwrite_value_second',
      '__internal__valueChunkTrailingCount', '__internal__vmapBatchTrailingCount',
    ];
    traversal.pendingDynamicWrites = new Map([
      ['first', { valueStackName: traversal.stack[0] }],
      ['second', { valueStackName: traversal.stack[1] }],
    ]);
    // Retain the historical continuation-count cell to prove the fragment never consumes it as a prefix.
    // These five identity-located mapping continuations need not precede the entry; two batch predecessors do.
    traversal.valueChunkTrailingCountActive = true;
    const frame = [encodeInt(2n), encodeInt(5n), new Uint8Array(lengths[1]), new Uint8Array(lengths[0])];
    const rawPredecessors = Array.from({ length: depth }, (_, index) => encodeInt(BigInt(index + 11)));
    const base = 37;
    const input = [...frame, ...rawPredecessors, encodeInt(BigInt(base))];
    traversal.emitAddDynamicOutputsBeforeEntries({
      location: { start: { line: 1, column: 0 }, end: { line: 1, column: 1 } },
      positionHint: PositionHint.START,
    }, depth, false);
    const expected = base + 2 + lengths.reduce((sum, length) => sum + Math.ceil(length / 120), 0);
    const checkFrame = [...frame, ...rawPredecessors].reverse().flatMap((value) => [value, Op.OP_EQUALVERIFY]);
    const vm = createVirtualMachineBCH(false);
    const evaluated = vm.evaluate(createTestAuthenticationProgramBch({
      lockingBytecode: scriptToBytecode([
        ...traversal.output, encodeInt(BigInt(expected)), Op.OP_EQUALVERIFY, ...checkFrame, Op.OP_1,
      ]),
      unlockingBytecode: scriptToBytecode(input), valueSatoshis: 1000n,
    }));
    expect(evaluated.error).toBeUndefined();
    expect(vm.stateSuccess(evaluated)).toBe(true);
  });
});
