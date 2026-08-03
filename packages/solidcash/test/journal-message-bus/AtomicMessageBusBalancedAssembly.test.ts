import { describe, expect, it } from 'vitest';
import type { FunctionBlockLayout } from '@solidcash/utils';
import {
  deriveBalancedAssemblyFromInputs, preflightBalancedBlockAssembly,
} from '../../src/index.js';

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

describe('self-preserved-verifier balanced participant assembly', () => {
  it('derives complete contiguous participants, one verifier each, and one fee/change slot', () => {
    const assembly = deriveBalancedAssemblyFromInputs([
      master(layout(2)), ordinary, master(layout(1)), ordinary, ordinary, ordinary,
    ], 6);
    expect(assembly).toEqual({
      blocks: [
        { participant: 0, base: 0, blockLayout: layout(2) },
        { participant: 1, base: 2, blockLayout: layout(1) },
      ],
      verifierInputs: [3, 4],
      verifierInput: 4,
      feeInput: 5,
      changeOutput: 5,
      totalSlots: 6,
    });
    expect(() => preflightBalancedBlockAssembly({
      inputs: Array.from({ length: 6 }, () => ({ satoshis: 1_000n })),
      outputs: Array.from({ length: 6 }, () => ({ amount: 1_000n })),
    }, assembly!)).not.toThrow();
  });

  it('refuses gaps and obsolete projection/controller or padding tails', () => {
    expect(() => deriveBalancedAssemblyFromInputs([
      master(layout(1)), ordinary, ordinary, ordinary,
    ], 4)).toThrow(/permit no auxiliary or padding slots/);
    expect(() => deriveBalancedAssemblyFromInputs([
      master(layout(1)), ordinary, ordinary, ordinary, ordinary,
    ], 5)).toThrow(/permit no auxiliary or padding slots/);
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
      verifierInputs: [1],
      verifierInput: 1,
      feeInput: 0,
      changeOutput: 1,
      totalSlots: 2,
    })).toThrow(/must follow participant region/);
  });
});
