import { describe, expect, it } from 'vitest';
import { binToHex, createVirtualMachineBch2026, encodeDataPush } from '@bitauth/libauth';
import { OpcodesBchSpec as Opcodes } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/spec/bch-spec-opcodes.js';
import { eventSection, sendSection, tailWalkBodies, valueSection } from '../../src/framed/master/frame-tail.js';

/**
 * The framework library's counted tail walks (`framework-library.ts`) against the unrolled walks a master that does
 * not define the library emits: on every tail, valid or not, the same verdict and the same main and alternate stacks.
 *
 * A routine takes its count on top of the tail and loops, where the unrolled walk builds the count in; a master
 * invokes it only for a count of at least one. Each walk runs here as a locking script over pushed operands, the
 * routine defined and invoked as a master does.
 */

const vm = createVirtualMachineBch2026();
const CATEGORY = new Uint8Array(32).fill(0xc1);
const OTHER = new Uint8Array(32).fill(0xc2);
const ROUTINE = 7;

const u16 = (value: number): number[] => [value & 0xff, value >> 8];
const u32 = (value: number): number[] => [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, value >>> 24];
const REST = [0xaa, 0xbb, 0xcc];

/** The final stacks of a locking script over `pushes`, the owner's token at input 0 and the outputs' categories. */
function run(pushes: readonly Uint8Array[], locking: readonly number[], outputs: readonly Uint8Array[]): string {
  const unlockingBytecode = Uint8Array.from(pushes.flatMap((push) => [...encodeDataPush(push)]));
  const token = (category: Uint8Array): never => ({ category, amount: 0n, nft: { capability: 'none', commitment: new Uint8Array(0) } }) as never;
  const state = vm.evaluate({
    inputIndex: 0,
    sourceOutputs: [{ lockingBytecode: Uint8Array.from(locking), valueSatoshis: 1_000n, token: token(CATEGORY) }],
    transaction: {
      version: 2, locktime: 0,
      inputs: [{ outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(1), sequenceNumber: 0, unlockingBytecode }],
      outputs: outputs.map((category) => ({ lockingBytecode: Uint8Array.of(0x51), valueSatoshis: 1_000n, token: token(category) })),
    },
  } as never);
  // A walk leaves its region on the stacks, which a locking script's clean-stack rule refuses once it completes.
  if (state.error !== undefined && !/unexpected number of items on the stack/.test(String(state.error))) return 'refused';
  return `main ${state.stack.map(binToHex).join(',')} | alt ${state.alternateStack.map(binToHex).join(',')}`;
}

/** `[..., tail, count]` through the routine, defined then invoked. */
const viaRoutine = (body: Uint8Array, count: number): number[] => [
  ...encodeDataPush(body), ...encodeDataPush(Uint8Array.of(ROUTINE)), Opcodes.OP_DEFINE,
  ...encodeDataPush(Uint8Array.of(count)), ...encodeDataPush(Uint8Array.of(ROUTINE)), Opcodes.OP_INVOKE,
];

const walks = tailWalkBodies();
const OUTPUTS = [CATEGORY, CATEGORY, OTHER, CATEGORY, CATEGORY, CATEGORY];

describe('the library\'s counted tail walks', () => {
  it('walk an event list as the unrolled walk does, its owner below the tail', () => {
    const lists: number[][] = [[], [0], [1], [0, 1], [1, 3], [0, 1, 3], [3, 4, 5], [1, 0], [2], [0, 2], [9], [4, 3, 5]];
    let compared = 0;
    for (const n of [1, 2, 3]) {
      for (const listed of lists) {
        for (const declared of [listed.length, listed.length + 1]) {
          const tail = Uint8Array.from([...u16(declared), ...listed.flatMap(u16), ...REST]);
          // The owner is input 0, parked as the head parks it, directly below the tail.
          const pushes = [new Uint8Array(0), tail];
          const unrolled = run(pushes, eventSection(n, true), OUTPUTS);
          expect(run(pushes, viaRoutine(walks.events, n), OUTPUTS), `n ${n}, declared ${declared}, listed ${listed}`)
            .toBe(unrolled);
          compared += 1;
        }
      }
    }
    expect(compared).toBe(72);
  });

  it('walk a send list as the unrolled walk does', () => {
    for (const n of [1, 2, 4]) {
      for (const listed of [[], [5], [2, 0], [1, 2, 3], [7, 7, 7, 7], [0, 1, 2, 3, 4]]) {
        for (const declared of [listed.length, listed.length + 1]) {
          const tail = Uint8Array.from([...u16(declared), ...listed.flatMap(u16), ...REST]);
          const unrolled = run([tail], sendSection(n), OUTPUTS);
          expect(run([tail], viaRoutine(walks.sends, n), OUTPUTS), `n ${n}, declared ${declared}, listed ${listed}`)
            .toBe(unrolled);
        }
      }
    }
  });

  it('walk a value list as the unrolled walk does', () => {
    const values = [[0x11], [0x22, 0x23], [], [0x44, 0x45, 0x46, 0x47]];
    for (const slots of [1, 2, 3]) {
      for (let count = 0; count <= values.length; count += 1) {
        const listed = values.slice(0, count);
        const tail = Uint8Array.from([...u16(count), ...listed.flatMap((value) => [...u32(value.length), ...value]), ...REST]);
        const unrolled = run([tail], valueSection(slots), OUTPUTS);
        expect(run([tail], viaRoutine(walks.values, slots), OUTPUTS), `slots ${slots}, count ${count}`).toBe(unrolled);
      }
    }
  });

  it('accept a valid list and refuse an oversized one, as the unrolled walks do', () => {
    const tail = (declared: number, listed: number[]): Uint8Array =>
      Uint8Array.from([...u16(declared), ...listed.flatMap(u16), ...REST]);
    expect(run([new Uint8Array(0), tail(2, [0, 1])], viaRoutine(walks.events, 3), OUTPUTS)).not.toBe('refused');
    expect(run([new Uint8Array(0), tail(3, [0, 1, 3])], viaRoutine(walks.events, 2), OUTPUTS)).toBe('refused');
    expect(run([tail(1, [4])], viaRoutine(walks.sends, 1), OUTPUTS)).not.toBe('refused');
    expect(run([tail(2, [4, 5])], viaRoutine(walks.sends, 1), OUTPUTS)).toBe('refused');
  });
});
