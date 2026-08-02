import { describe, expect, it } from 'vitest';
import type { FunctionBlockLayout } from '@solidcash/utils';
import {
  deriveBalancedAssemblyFromInputs, preflightBalancedBlockAssembly,
} from '../src/index.js';

const layout = (blockSize: number): FunctionBlockLayout => ({
  blockSize,
  slots: Array.from({ length: blockSize }, (_unused, offset) => ({
    kind: offset === 0 ? 'master' : 'data', offset,
  })),
});

const master = (blockLayout: FunctionBlockLayout): {
  unlocker: { abiFunction: { blockLayout: FunctionBlockLayout } };
} => ({ unlocker: { abiFunction: { blockLayout } } });
const ordinary = {};

describe('controllerless balanced participant assembly', () => {
  it('derives complete contiguous participants followed by exactly one fee/change slot', () => {
    const assembly = deriveBalancedAssemblyFromInputs([
      master(layout(2)), ordinary, master(layout(1)), ordinary,
    ], 4);
    expect(assembly).toEqual({
      blocks: [
        { participant: 0, base: 0, blockLayout: layout(2) },
        { participant: 1, base: 2, blockLayout: layout(1) },
      ],
      feeInput: 3,
      changeOutput: 3,
      totalSlots: 4,
    });
    expect(() => preflightBalancedBlockAssembly({
      inputs: Array.from({ length: 4 }, () => ({ satoshis: 1_000n })),
      outputs: Array.from({ length: 4 }, () => ({ amount: 1_000n })),
    }, assembly!)).not.toThrow();
  });

  it('refuses gaps and obsolete projection/controller or padding tails', () => {
    expect(() => deriveBalancedAssemblyFromInputs([
      master(layout(1)), ordinary, ordinary,
    ], 3)).toThrow(/permit no auxiliary or padding slots/);
    expect(() => deriveBalancedAssemblyFromInputs([
      master(layout(1)), ordinary, ordinary, ordinary,
    ], 4)).toThrow(/permit no auxiliary or padding slots/);
  });

  it('refuses a participant master hidden inside another participant block', () => {
    expect(() => deriveBalancedAssemblyFromInputs([
      master(layout(2)), master(layout(1)), ordinary,
    ], 3)).toThrow(/inside another block's span/);
  });

  it('requires the declared fee and change indices to be the terminal slot', () => {
    expect(() => preflightBalancedBlockAssembly({
      inputs: [{ satoshis: 1_000n }, { satoshis: 1_000n }],
      outputs: [{ amount: 1_000n }, { amount: 1_000n }],
    }, {
      blocks: [{ participant: 0, base: 0, blockLayout: layout(1) }],
      feeInput: 0,
      changeOutput: 1,
      totalSlots: 2,
    })).toThrow(/must immediately follow participant region/);
  });
});
