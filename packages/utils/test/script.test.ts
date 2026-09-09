import { hexToBin, utf8ToBin } from '@bitauth/libauth';
import {
  asmToBytecode,
  asmToScript,
  bytecodeToAsm,
  bytecodeToScript,
  calculateBytesize,
  countOpcodes,
  encodeNullDataScript,
  optimiseBytecode,
  Op,
  PositionHint,
  scriptToAsm,
  scriptToBytecode,
} from '../src/index.js';
import type { FullLocationData } from '../src/index.js';
import { fixtures } from './script.fixture.js';

describe('script utils', () => {
  describe('scriptToAsm()', () => {
    fixtures.forEach(({ name, script, asm }) => {
      it(`should convert script to asm for "${name}"`, () => {
        expect(scriptToAsm(script)).toEqual(asm);
      });
    });
  });

  describe('asmToScript()', () => {
    fixtures.forEach(({ name, script, asm }) => {
      it(`should convert asm to script for "${name}"`, () => {
        expect(asmToScript(asm)).toEqual(script);
      });
    });
  });

  describe('scriptToBytecode()', () => {
    fixtures.forEach(({ name, script, bytecode }) => {
      it(`should convert script to bytecode for "${name}"`, () => {
        expect(scriptToBytecode(script)).toEqual(bytecode);
      });
    });
  });

  describe('bytecodeToScript()', () => {
    fixtures.forEach(({ name, script, bytecode }) => {
      it(`should convert bytecode to script for "${name}"`, () => {
        expect(bytecodeToScript(bytecode)).toEqual(script);
      });
    });
  });

  describe('asmToBytecode()', () => {
    fixtures.forEach(({ name, asm, bytecode }) => {
      it(`should convert asm to bytecode for "${name}"`, () => {
        expect(asmToBytecode(asm)).toEqual(bytecode);
      });
    });
  });

  describe('bytecodeToAsm()', () => {
    fixtures.forEach(({ name, asm, bytecode }) => {
      it(`should convert bytecode to asm for "${name}"`, () => {
        expect(bytecodeToAsm(bytecode)).toEqual(asm);
      });
    });
  });

  describe('countOpcodes()', () => {
    fixtures.forEach(({ name, script, opcount }) => {
      it(`should count opcodes for "${name}"`, () => {
        expect(countOpcodes(script)).toEqual(opcount);
      });
    });
  });

  describe('calculateBytesize()', () => {
    fixtures.forEach(({ name, script, bytesize }) => {
      it(`should count opcodes for "${name}"`, () => {
        expect(calculateBytesize(script)).toEqual(bytesize);
      });
    });
  });

  describe('encodeNullDataScript()', () => {
    it('should encode an SLP genesis', () => {
      const input = [
        hexToBin('534c5000'),
        hexToBin('01'),
        utf8ToBin('GENESIS'),
        utf8ToBin('CSS'),
        utf8ToBin('CashScriptSLP'),
        utf8ToBin('https://cashscript.org/'),
        utf8ToBin(''),
        hexToBin('08'),
        hexToBin('02'),
        hexToBin('0000000000000001'),
      ];

      const output = hexToBin('04534c5000510747454e45534953034353530d43617368536372697074534c501768747470733a2f2f636173687363726970742e6f72672f005852080000000000000001');

      expect(encodeNullDataScript(input)).toEqual(output);
    });
  });

  describe('optimiseBytecode()', () => {
    it('preserves synthetic source locations while merging a mixed-location pattern', () => {
      const concrete = {
        location: { start: { line: 4, column: 2 }, end: { line: 4, column: 9 } },
        positionHint: PositionHint.END,
      };
      const synthetic = { location: undefined, positionHint: PositionHint.START } as unknown as FullLocationData[number];
      const mixed: FullLocationData = [synthetic, concrete];
      const entirelySynthetic: FullLocationData = [synthetic, synthetic];

      const mixedResult = optimiseBytecode([Op.OP_1, Op.OP_ADD], mixed, [], [], 0);
      expect(mixedResult.script).toEqual([Op.OP_1ADD]);
      expect(mixedResult.locationData).toEqual([{ ...concrete, positionHint: PositionHint.END }]);

      const syntheticResult = optimiseBytecode(
        [Op.OP_1, Op.OP_ADD], entirelySynthetic, [], [], 0,
      );
      expect(syntheticResult.script).toEqual([Op.OP_1ADD]);
      expect(syntheticResult.locationData).toEqual([synthetic]);
    });
  });
});
