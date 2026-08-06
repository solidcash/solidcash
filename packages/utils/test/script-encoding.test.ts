import { binToHex, encodeDataPush, flattenBinArray } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { normaliseScript, Op, Script, scriptsEqual, scriptToBytecode } from '../src/script.js';

/**
 * `scriptToBytecode` hand-rolls libauth's push encoding to avoid a per-element allocation on the compiler's
 * hottest path. That trade is only sound while the two agree byte for byte, and the ways they can disagree are
 * silent: libauth folds a single byte of 0x01..0x10 into OP_1..OP_16 and 0x81 into OP_1NEGATE, so a naive
 * length-prefixed encoder emits valid-looking but different - and non-minimal - bytecode.
 */
const reference = (script: Script): Uint8Array => flattenBinArray(script.map((element) => (
  typeof element === 'number' ? Uint8Array.of(element) : encodeDataPush(element)
)));

const expectMatchesLibauth = (script: Script): void => {
  expect(binToHex(scriptToBytecode(script))).toBe(binToHex(reference(script)));
};

describe('scriptToBytecode', () => {
  it('matches libauth for every single-byte push, including the OP_N and OP_1NEGATE folds', () => {
    for (let byte = 0; byte <= 255; byte += 1) expectMatchesLibauth([Uint8Array.of(byte)]);
  });

  it('matches libauth at every push-length boundary', () => {
    for (const length of [0, 1, 2, 74, 75, 76, 77, 254, 255, 256, 257, 65534, 65535, 65536, 65537]) {
      const data = new Uint8Array(length);
      for (let i = 0; i < length; i += 1) data[i] = (i * 7 + 3) & 0xff;
      expectMatchesLibauth([data]);
    }
  });

  it('matches libauth for mixed opcode/data scripts', () => {
    let seed = 987654321;
    const next = (bound: number): number => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % bound;
    };
    const lengths = [0, 1, 1, 1, 2, 16, 75, 76, 255, 256, 1000];
    for (let iteration = 0; iteration < 200; iteration += 1) {
      const script: Script = [];
      for (let i = 0; i < 30; i += 1) {
        if (next(3) === 0) {
          script.push(next(256));
          continue;
        }
        const length = lengths[next(lengths.length)];
        const data = new Uint8Array(length);
        for (let j = 0; j < length; j += 1) {
          data[j] = length === 1 ? [0, 1, 5, 16, 17, 129, 200, 255][next(8)] : next(256);
        }
        script.push(data);
      }
      expectMatchesLibauth(script);
    }
  });

  it('folds a one-byte push into its number opcode', () => {
    expect(binToHex(scriptToBytecode([Uint8Array.of(5)]))).toBe(binToHex(Uint8Array.of(Op.OP_5)));
    expect(binToHex(scriptToBytecode([Uint8Array.of(129)]))).toBe(binToHex(Uint8Array.of(Op.OP_1NEGATE)));
    // 0x00 and anything above 0x10 keep an explicit one-byte push.
    expect(binToHex(scriptToBytecode([Uint8Array.of(0)]))).toBe('0100');
    expect(binToHex(scriptToBytecode([Uint8Array.of(17)]))).toBe('0111');
  });
});

describe('normaliseScript', () => {
  it('canonicalises a script to what its bytecode reads back', () => {
    const script: Script = [Uint8Array.of(5), Op.OP_ADD, new Uint8Array(0), Uint8Array.of(0, 1, 2)];
    expect(binToHex(scriptToBytecode(normaliseScript(script)))).toBe(binToHex(scriptToBytecode(script)));
  });
});

describe('scriptsEqual', () => {
  it('compares by serialised bytecode', () => {
    expect(scriptsEqual([Op.OP_1, Op.OP_ADD], [Op.OP_1, Op.OP_ADD])).toBe(true);
    expect(scriptsEqual([Op.OP_1], [Op.OP_2])).toBe(false);
    expect(scriptsEqual([Op.OP_1], [Op.OP_1, Op.OP_ADD])).toBe(false);
    // A one-byte push and its number opcode serialise identically, so they compare equal.
    expect(scriptsEqual([Uint8Array.of(5)], [Op.OP_5])).toBe(true);
  });
});
