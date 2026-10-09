import { describe, it, expect } from 'vitest';
import { computeFunctionSelectorHex } from '@solidcash/utils';
import { compileString } from '../src/index.js';

// D27: the selector scheme follows the compile's mode. A native compile derives the BCH sha256 selectors; an
// evmCompat compile derives the real keccak256 selectors its abi.* family emits, so a contract's dispatch, its
// published ABI `.selector`, and its `abi.encodeCall`/`encodeWithSignature` payload all agree.

// The canonical signature the compiler hashes uses the ABI type spelling (`int` widens to `int256`).
const SIGNATURE = 'transfer(address,int256)';
const SHA256 = computeFunctionSelectorHex(SIGNATURE);
const KECCAK = computeFunctionSelectorHex(SIGNATURE, true);

const selectorOfTransfer = (evmCompat: boolean): string | undefined => {
  const source = 'contract C { function transfer(address to, int amount) public { require(true); } }';
  const artifact = compileString(source, { messageBus: false, enforceFinalRequire: false, evmCompat });
  return artifact.abi.find((entry) => entry.name === 'transfer')?.selector;
};

describe('the function-selector scheme follows the compile mode (D27)', () => {
  it('keeps sha256 for a native compile', () => {
    expect(SHA256).not.toBe(KECCAK);
    expect(selectorOfTransfer(false)).toBe(SHA256);
  });

  it('derives the keccak256 dispatch selector under evmCompat', () => {
    // The ABI `.selector` is the same field codegen dispatches on, so this pins the dispatch scheme.
    expect(selectorOfTransfer(true)).toBe(KECCAK);
  });
});
