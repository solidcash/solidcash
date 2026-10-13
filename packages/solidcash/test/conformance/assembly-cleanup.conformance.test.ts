// Yul `:=` into a narrow typed local writes the raw 32-byte word and Solidity cleans it on use: an intN keeps the
// word's low bits as two's complement, a bytesN its leading bytes, and a bytesN read is left-aligned in the word.
// An integer word is cleaned in both compile modes; native SolidCash keeps its checked conversion for bytesN only.
import { describe, it } from 'vitest';
import { assertConformant, type ConformanceCase } from './harness.js';

const MAX = (1n << 256n) - 1n;
const SPDX = '// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0;\n';

// `yul` assigns `r`, a local of the result type on both sides.
const wordCase = (
  yul: string, params: string, retType: string, args: readonly unknown[], evmCompat = true,
): Promise<void> => {
  const sep = params.length > 0 ? `${params}, ` : '';
  const c: ConformanceCase = {
    solidity: `${SPDX}contract C {\n  function f(${params}) public pure returns (${retType} r) {\n`
      + `    assembly { ${yul} }\n  }\n}\n`,
    scash: `contract Conf() {\n  function f(${sep}${retType} __expected) {\n`
      + `    ${retType} r;\n    assembly { ${yul} }\n    require(r == __expected);\n  }\n}\n`,
    evmFn: 'f',
    bchFn: 'f',
    args,
    evmCompat,
    label: `${retType}: ${yul}`,
  };
  return assertConformant(c);
};

describe('assembly cleanup: a word assigned to an intN keeps its low bits', () => {
  it('uint8 := 0xffff is 0xff', () => wordCase('r := 0xffff', '', 'uint8', []));
  it('uint32 := a five-byte word', () => wordCase('r := a', 'uint a', 'uint32', [0xfffffffffen]));
  it('uint8 := not(0) is 0xff', () => wordCase('r := not(0)', '', 'uint8', []));
  it('int8 := 0xf0 sign-extends to -16', () => wordCase('r := 0xf0', '', 'int8', []));
  it('int8 := 0xfffffff0 is -16', () => wordCase('r := a', 'uint a', 'int8', [0xfffffff0n]));
  it('int256 := MAX is -1', () => wordCase('r := a', 'uint a', 'int', [MAX]));
  it('native: uint8 := 0xffff keeps the low byte too', () => wordCase('r := 0xffff', '', 'uint8', [], false));
});

describe('assembly cleanup: a bytesN keeps the leading bytes of the word', () => {
  const HEAD = `0xab${'cd'.repeat(31)}`;
  it('bytes1 := bytes32 keeps its first byte', () => wordCase('r := a', 'bytes32 a', 'bytes1', [HEAD]));
  it('bytes16 := bytes32 keeps its first 16 bytes', () => wordCase(
    'r := a', 'bytes32 a', 'bytes16', [`0x${'0011223344556677'.repeat(2)}${'ee'.repeat(16)}`],
  ));
  it('bytes1 := sub(0, 1) is 0xff', () => wordCase('r := sub(0, 1)', '', 'bytes1', []));
  it('bytes4 := MAX', () => wordCase('r := a', 'uint a', 'bytes4', [MAX]));
  it('bytes4 := a small word is zero (right-aligned bits are cleaned)', () => wordCase(
    'r := a', 'uint a', 'bytes4', [0x12345678n],
  ));
  it('bytes32 := not(0) (top bit set)', () => wordCase('r := not(0)', '', 'bytes32', []));
  it('bytes2 := a string literal keeps its first bytes', () => wordCase('r := "abc"', '', 'bytes2', []));
});

describe('assembly cleanup: a bytesN read is left-aligned in the word', () => {
  it('bytes32 := bytes1', () => wordCase('r := b', 'bytes1 b', 'bytes32', ['0x31']));
  it('bytes2 := bytes1', () => wordCase('r := b', 'bytes1 b', 'bytes2', ['0x31']));
  it('uint := bytes4', () => wordCase('r := b', 'bytes4 b', 'uint', ['0x12345678']));
  it('uint8 := bytes1 is the low byte of the word (0)', () => wordCase('r := b', 'bytes1 b', 'uint8', ['0x31']));
});
