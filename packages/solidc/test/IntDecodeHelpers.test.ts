import {
  decodeAuthenticationInstructions, hexToBin, OpcodesBCH, vmNumberToBigInt,
} from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';

const readScriptNumber = (instruction: { opcode: number; data?: Uint8Array }): bigint | undefined => {
  if (instruction.opcode === OpcodesBCH.OP_0) return 0n;
  if (instruction.opcode === OpcodesBCH.OP_1NEGATE) return -1n;
  if (instruction.opcode >= OpcodesBCH.OP_1 && instruction.opcode <= OpcodesBCH.OP_16) {
    return BigInt(instruction.opcode - OpcodesBCH.OP_1 + 1);
  }
  if (!instruction.data) return undefined;
  const decoded = vmNumberToBigInt(instruction.data, { requireMinimalEncoding: false });
  return typeof decoded === 'bigint' ? decoded : undefined;
};

describe('shared integer helpers', () => {
  it('invokes a shared decoder from a delegate implementation body', () => {
    const artifact = compileString(`
      contract Store() {
        uint256 x;
        uint256 y;
        function set(uint256 v) public delegate {
          uint256 a = this.x;
          uint256 b = this.x;
          this.x = v;
          this.y = a;
          require(a == b);
        }
        function ping() public {
          require(this.x == this.y);
        }
      }
    `, { messageBus: false });
    const selector = artifact.abi.find((fn) => fn.name === 'set')?.selector;
    expect(selector).toBeDefined();
    const body = artifact.functionBodies?.[selector!];
    expect(body).toBeTypeOf('string');
    expect(decodeAuthenticationInstructions(hexToBin(body!))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
  });

  it('folds Script-number conversion into a shared decoder wrapper', () => {
    const artifact = compileString(`
      contract Store() {
        uint256 x;
        uint256 y;
        function set(uint256 v) public delegate {
          uint256 a = this.x;
          uint256 b = this.y;
          this.x = v;
          this.y = a;
          require(a == b);
        }
      }
    `, { messageBus: false });
    const selector = artifact.abi.find((fn) => fn.name === 'set')!.selector!;
    const instructions = decodeAuthenticationInstructions(hexToBin(artifact.functionBodies![selector]!));
    expect(instructions.some((instruction, index) => index > 0
      && instruction.opcode === OpcodesBCH.OP_INVOKE
      && readScriptNumber(instructions[index - 1]) === -1n
      && instructions[index + 1]?.opcode === OpcodesBCH.OP_SWAP
      && instructions[index + 2]?.opcode === OpcodesBCH.OP_BIN2NUM
      && instructions[index + 3]?.opcode === OpcodesBCH.OP_SWAP)).toBe(false);
  });

  it('shares compiler primitives from delegate ABI encoding', () => {
    const artifact = compileString(`
      contract Store() {
        bytes public blob;
        function set(uint256 a, uint256 b) public delegate {
          this.blob = abi.encode(a, b);
          require(this.blob.length > 0);
        }
      }
    `, { messageBus: false, solidityImportCompat: true });
    const selector = artifact.abi.find((fn) => fn.name === 'set')!.selector!;
    expect(decodeAuthenticationInstructions(hexToBin(artifact.functionBodies![selector]!))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
  });
});
