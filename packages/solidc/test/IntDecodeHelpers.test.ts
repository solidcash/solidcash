import { decodeAuthenticationInstructions, hexToBin, OpcodesBCH, vmNumberToBigInt } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { compileString, compileStringMulti } from '../src/index.js';

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

const invokesHelper = (bytecodeHex: string, helperId: bigint): boolean => {
  const instructions = decodeAuthenticationInstructions(hexToBin(bytecodeHex));
  if (instructions.some((instruction, index) => index > 0
    && instruction.opcode === OpcodesBCH.OP_INVOKE
    && readScriptNumber(instructions[index - 1]) === helperId)) {
    return true;
  }
  // Nested OP_DEFINE bodies store their script as a data push, so a helper invoked only from
  // another helper is invisible at the top-level instruction stream.
  return instructions.some((instruction) => instruction.data !== undefined
    && instruction.data.length > 2
    && invokesHelper(Buffer.from(instruction.data).toString('hex'), helperId));
};

describe('shared integer helpers', () => {
  const source = (delegate: boolean): string => `
      contract Store() {
        uint256 x;
        uint256 y;
        function set(uint256 v) public${delegate ? ' delegate' : ''} {
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
    `;

  const compiledSetBody = (delegate: boolean): string => {
    const artifact = compileString(source(delegate), { messageBus: false });
    const selector = artifact.abi.find((fn) => fn.name === 'set')?.selector;
    expect(selector).toBeDefined();
    const body = artifact.functionBodies?.[selector!];
    expect(body).toBeTypeOf('string');
    expect(body!.length).toBeGreaterThan(0);
    return body!;
  };

  it('invokes the int-decode subroutine from a delegate implementation body', () => {
    const body = compiledSetBody(true);
    // INT_DECODE_SUBROUTINE_ID is -1 (OP_1NEGATE). Encode uses a compact-pool helper id.
    expect(invokesHelper(body, -1n)
      || decodeAuthenticationInstructions(hexToBin(body))
        .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
  });

  it('folds Script-number conversion into the int-decode helper instead of after every invoke', () => {
    const body = compiledSetBody(true);
    const instructions = decodeAuthenticationInstructions(hexToBin(body));
    const epilogueAfterRawInvoke = instructions.some((instruction, index) => index >= 1
      && instruction.opcode === OpcodesBCH.OP_INVOKE
      && readScriptNumber(instructions[index - 1]) === -1n
      && instructions[index + 1]?.opcode === OpcodesBCH.OP_SWAP
      && instructions[index + 2]?.opcode === OpcodesBCH.OP_BIN2NUM
      && instructions[index + 3]?.opcode === OpcodesBCH.OP_SWAP);
    expect(epilogueAfterRawInvoke).toBe(false);
    expect(instructions.some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
  });

  it('still extracts int helpers when the usage probe does not inline the decoder', () => {
    const artifact = compileString(`
      contract Store() {
        bigint x;
        bigint y;
        function set(bigint v) public {
          bigint a = this.x;
          bigint b = this.x;
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
    expect(body!.length).toBeGreaterThan(0);
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(invokesHelper(body!, -1n) || invokesHelper(whole, -1n)).toBe(true);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
  });

  it('keeps speed-hinted outline bodies after restoring altstack barriers', () => {
    const artifact = compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public delegate {
          this.a = v;
          this.b = v;
          require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 });
    const selector = artifact.abi.find((fn) => fn.name === 'set')?.selector;
    expect(selector).toBeDefined();
    expect(artifact.functionBodies?.[selector!]).toBeTypeOf('string');
    expect(artifact.functionBodies![selector!]!.length).toBeGreaterThan(0);
  });

  it('keeps speed-hinted outline bodies with the packed outline engine', () => {
    const artifact = compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public delegate {
          this.a = v;
          this.b = v;
          require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 });
    const selector = artifact.abi.find((fn) => fn.name === 'set')?.selector;
    expect(selector).toBeDefined();
    expect(artifact.functionBodies?.[selector!]).toBeTypeOf('string');
    expect(artifact.functionBodies![selector!]!.length).toBeGreaterThan(0);
  });

  it('keeps speed-hint first-pass outlining when the pass is capped at four rounds', () => {
    const artifact = compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v; this.b = v; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 });
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
  });

  it('still leftover-outlines after dropping full-body diagonal memo tables', () => {
    const artifact = compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v; this.b = v; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 });
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
  });

  it('still speed-hint outlines when leftover rounds reuse interned fingerprints', () => {
    const artifact = compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v; this.b = v; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 });
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
  });

  it('still speed-hint outlines with packed Int32Array body ids', () => {
    const artifact = compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v; this.b = v; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 });
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
  });

  it('still speed-hint outlines when leftover clones only rewritten bodies', () => {
    const artifact = compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v; this.b = v; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 });
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
  });

  it('still speed-hint outlines after sliding window hashes', () => {
    const artifact = compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v; this.b = v; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 });
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
  });

  it('keeps leftover window-4 follow-up outlining when the pass is capped at one round', () => {
    const artifact = compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        uint256 c;
        function set(uint256 v) public {
          this.a = v; this.b = v; this.c = v;
          require(this.a == this.b);
          require(this.b == this.c);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 });
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
  });

  it('speed-hint leftover outlining does not require a pre-cloned script corpus', () => {
    const artifact = compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v; this.b = v; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 });
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
  });

  it('keeps leftover outlining when the follow-up pass is capped at two rounds', () => {
    const artifact = compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        uint256 c;
        uint256 d;
        function set(uint256 v) public {
          this.a = v; this.b = v; this.c = v; this.d = v;
          require(this.a == this.b);
          require(this.c == this.d);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 });
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
  });

  it('keeps function bodies after the speed-hint outline window of 8', () => {
    const artifact = compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public delegate {
          this.a = v;
          this.b = v;
          require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 });
    const selector = artifact.abi.find((fn) => fn.name === 'set')?.selector;
    expect(selector).toBeDefined();
    expect(artifact.functionBodies?.[selector!]).toBeTypeOf('string');
    expect(artifact.functionBodies![selector!]!.length).toBeGreaterThan(0);
  });

  it('keeps production message-bus outlining at the trace-stable window', () => {
    const artifact = compileString(`
pragma solidity ^0.8.0;
interface IHub { function ping() external; }
contract Store {
  IHub hub;
  uint256 public a;
  uint256 public b;
  function set(uint256 v) public {
    this.a = v;
    this.b = v;
    hub.ping();
    require(this.a == this.b);
  }
}
    `, { forceStateful: true, solidityImportCompat: true, messageBus: true });
    const selector = artifact.abi.find((fn) => fn.name === 'set')?.selector;
    expect(selector).toBeDefined();
    expect(artifact.functionBodies?.[selector!]).toBeTypeOf('string');
    expect(artifact.functionBodies![selector!]!.length).toBeGreaterThan(0);
    expect(artifact.compiler.options?.optimizeForCompilationSpeed).not.toBe(true);
    const delegate = artifact.delegateArtifact;
    expect(delegate).toBeDefined();
    const delegateSelector = delegate!.abi.find((fn) => fn.name === 'set')?.selector;
    expect(delegateSelector).toBeDefined();
    expect(delegate!.functionBodies?.[delegateSelector!]).toBeTypeOf('string');
    expect(delegate!.functionBodies![delegateSelector!].length).toBeGreaterThan(0);
  });

  it('reuses the multi-contract probe AST for the primary compile', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public delegate {
          this.a = v;
          this.b = v;
          require(this.a == this.b);
        }
      }
    `, { messageBus: false, compileDeclarations: ['Store'] });
    const artifact = map.Store;
    expect(artifact).toBeDefined();
    const selector = artifact.abi.find((fn) => fn.name === 'set')?.selector;
    expect(selector).toBeDefined();
    expect(artifact.functionBodies?.[selector!]).toBeTypeOf('string');
    expect(artifact.functionBodies![selector!]!.length).toBeGreaterThan(0);
  });

  it('keeps speed-hinted outline bodies without the optimiser compatibility oracle', () => {
    const artifact = compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public delegate {
          this.a = v;
          this.b = v;
          require(this.a == this.b);
        }
        function ping() public {
          require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 });
    const selector = artifact.abi.find((fn) => fn.name === 'set')?.selector;
    expect(selector).toBeDefined();
    expect(artifact.functionBodies?.[selector!]).toBeTypeOf('string');
    expect(artifact.functionBodies![selector!]!.length).toBeGreaterThan(0);
    const ping = artifact.abi.find((fn) => fn.name === 'ping')?.selector;
    expect(ping).toBeDefined();
    expect(artifact.functionBodies?.[ping!]).toBeTypeOf('string');
    expect(artifact.functionBodies![ping!]!.length).toBeGreaterThan(0);
  });

  it('keeps speed-hinted outline bodies after folding one-invoke leftover aliases', () => {
    const artifact = compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public delegate {
          this.a = v;
          this.b = v;
          require(this.a == this.b);
        }
        function ping() public {
          require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 });
    const selector = artifact.abi.find((fn) => fn.name === 'set')?.selector;
    expect(selector).toBeDefined();
    expect(artifact.functionBodies?.[selector!]).toBeTypeOf('string');
    expect(artifact.functionBodies![selector!]!.length).toBeGreaterThan(0);
    const ping = artifact.abi.find((fn) => fn.name === 'ping')?.selector;
    expect(ping).toBeDefined();
    expect(artifact.functionBodies?.[ping!]).toBeTypeOf('string');
    expect(artifact.functionBodies![ping!]!.length).toBeGreaterThan(0);
  });

  it('keeps speed-hinted outline bodies after leftover outlining of first-pass helpers', () => {
    const artifact = compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public delegate {
          this.a = v;
          this.b = v;
          require(this.a == this.b);
        }
        function ping() public {
          require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 });
    const selector = artifact.abi.find((fn) => fn.name === 'set')?.selector;
    expect(selector).toBeDefined();
    expect(artifact.functionBodies?.[selector!]).toBeTypeOf('string');
    expect(artifact.functionBodies![selector!]!.length).toBeGreaterThan(0);
    const ping = artifact.abi.find((fn) => fn.name === 'ping')?.selector;
    expect(ping).toBeDefined();
    expect(artifact.functionBodies?.[ping!]).toBeTypeOf('string');
    expect(artifact.functionBodies![ping!]!.length).toBeGreaterThan(0);
  });

  it('keeps speed-hinted outline bodies after raising leftover outline groups to 8192', () => {
    const artifact = compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public delegate {
          this.a = v;
          this.b = v;
          require(this.a == this.b);
        }
        function ping() public {
          require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 });
    const selector = artifact.abi.find((fn) => fn.name === 'set')?.selector;
    expect(selector).toBeDefined();
    expect(artifact.functionBodies?.[selector!]).toBeTypeOf('string');
    expect(artifact.functionBodies![selector!]!.length).toBeGreaterThan(0);
    const ping = artifact.abi.find((fn) => fn.name === 'ping')?.selector;
    expect(ping).toBeDefined();
    expect(artifact.functionBodies?.[ping!]).toBeTypeOf('string');
    expect(artifact.functionBodies![ping!]!.length).toBeGreaterThan(0);
  });

  it('keeps speed-hinted outline bodies after raising leftover outline groups to 4096', () => {
    const artifact = compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public delegate {
          this.a = v;
          this.b = v;
          require(this.a == this.b);
        }
        function ping() public {
          require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 });
    const selector = artifact.abi.find((fn) => fn.name === 'set')?.selector;
    expect(selector).toBeDefined();
    expect(artifact.functionBodies?.[selector!]).toBeTypeOf('string');
    expect(artifact.functionBodies![selector!]!.length).toBeGreaterThan(0);
    const ping = artifact.abi.find((fn) => fn.name === 'ping')?.selector;
    expect(ping).toBeDefined();
    expect(artifact.functionBodies?.[ping!]).toBeTypeOf('string');
    expect(artifact.functionBodies![ping!]!.length).toBeGreaterThan(0);
  });

  it('keeps speed-hinted outline bodies after preferring two-byte helper identifiers', () => {
    const artifact = compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public delegate {
          this.a = v;
          this.b = v;
          require(this.a == this.b);
        }
        function ping() public {
          require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 });
    const selector = artifact.abi.find((fn) => fn.name === 'set')?.selector;
    expect(selector).toBeDefined();
    expect(artifact.functionBodies?.[selector!]).toBeTypeOf('string');
    expect(artifact.functionBodies![selector!]!.length).toBeGreaterThan(0);
    const ping = artifact.abi.find((fn) => fn.name === 'ping')?.selector;
    expect(ping).toBeDefined();
    expect(artifact.functionBodies?.[ping!]).toBeTypeOf('string');
    expect(artifact.functionBodies![ping!]!.length).toBeGreaterThan(0);
  });

  it('keeps speed-hinted outline bodies after leftover short-window outlining', () => {
    const artifact = compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public delegate {
          this.a = v;
          this.b = v;
          require(this.a == this.b);
        }
        function ping() public {
          require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 });
    const selector = artifact.abi.find((fn) => fn.name === 'set')?.selector;
    expect(selector).toBeDefined();
    expect(artifact.functionBodies?.[selector!]).toBeTypeOf('string');
    expect(artifact.functionBodies![selector!]!.length).toBeGreaterThan(0);
    const ping = artifact.abi.find((fn) => fn.name === 'ping')?.selector;
    expect(ping).toBeDefined();
    expect(artifact.functionBodies?.[ping!]).toBeTypeOf('string');
    expect(artifact.functionBodies![ping!]!.length).toBeGreaterThan(0);
  });

  it('keeps speed-hinted outline bodies with compact identifier costing under altstack barriers', () => {
    const artifact = compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public delegate {
          this.a = v;
          this.b = v;
          require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 });
    const selector = artifact.abi.find((fn) => fn.name === 'set')?.selector;
    expect(selector).toBeDefined();
    expect(artifact.functionBodies?.[selector!]).toBeTypeOf('string');
    expect(artifact.functionBodies![selector!]!.length).toBeGreaterThan(0);
  });

  it('keeps speed-hinted outline bodies with conservative identifier costing', () => {
    const artifact = compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public delegate {
          this.a = v;
          this.b = v;
          require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 });
    const selector = artifact.abi.find((fn) => fn.name === 'set')?.selector;
    expect(selector).toBeDefined();
    expect(artifact.functionBodies?.[selector!]).toBeTypeOf('string');
    expect(artifact.functionBodies![selector!]!.length).toBeGreaterThan(0);
  });

  it('keeps speed-hinted outline bodies at the 12288-group cap', () => {
    const artifact = compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public delegate {
          this.a = v;
          this.b = v;
          require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 });
    const selector = artifact.abi.find((fn) => fn.name === 'set')?.selector;
    expect(selector).toBeDefined();
    expect(artifact.functionBodies?.[selector!]).toBeTypeOf('string');
    expect(artifact.functionBodies![selector!]!.length).toBeGreaterThan(0);
  });

  it('keeps speed-hinted outline bodies after outlining shortest-first', () => {
    const artifact = compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public delegate {
          this.a = v;
          this.b = v;
          require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 });
    const selector = artifact.abi.find((fn) => fn.name === 'set')?.selector;
    expect(selector).toBeDefined();
    expect(artifact.functionBodies?.[selector!]).toBeTypeOf('string');
    expect(artifact.functionBodies![selector!]!.length).toBeGreaterThan(0);
  });

  it('keeps speed-hinted outline bodies after leftover window-4 at 8192 groups', () => {
    const artifact = compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public delegate {
          this.a = v;
          this.b = v;
          require(this.a == this.b);
        }
        function ping() public {
          require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 });
    const selector = artifact.abi.find((fn) => fn.name === 'set')?.selector;
    expect(selector).toBeDefined();
    expect(artifact.functionBodies?.[selector!]).toBeTypeOf('string');
    expect(artifact.functionBodies![selector!]!.length).toBeGreaterThan(0);
    const ping = artifact.abi.find((fn) => fn.name === 'ping')?.selector;
    expect(ping).toBeDefined();
    expect(artifact.functionBodies?.[ping!]).toBeTypeOf('string');
    expect(artifact.functionBodies![ping!]!.length).toBeGreaterThan(0);
  });

  it('keeps speed-hinted outline bodies after a leftover window-4 follow-up pass', () => {
    const artifact = compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public delegate {
          this.a = v;
          this.b = v;
          require(this.a == this.b);
        }
        function ping() public {
          require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 });
    const selector = artifact.abi.find((fn) => fn.name === 'set')?.selector;
    expect(selector).toBeDefined();
    expect(artifact.functionBodies?.[selector!]).toBeTypeOf('string');
    expect(artifact.functionBodies![selector!]!.length).toBeGreaterThan(0);
    const ping = artifact.abi.find((fn) => fn.name === 'ping')?.selector;
    expect(ping).toBeDefined();
    expect(artifact.functionBodies?.[ping!]).toBeTypeOf('string');
    expect(artifact.functionBodies![ping!]!.length).toBeGreaterThan(0);
  });

  it('keeps speed-hinted outline bodies after lowering leftover outline groups to 4096', () => {
    const artifact = compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public delegate {
          this.a = v;
          this.b = v;
          require(this.a == this.b);
        }
        function ping() public {
          require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 });
    const selector = artifact.abi.find((fn) => fn.name === 'set')?.selector;
    expect(selector).toBeDefined();
    expect(artifact.functionBodies?.[selector!]).toBeTypeOf('string');
    expect(artifact.functionBodies![selector!]!.length).toBeGreaterThan(0);
    const ping = artifact.abi.find((fn) => fn.name === 'ping')?.selector;
    expect(ping).toBeDefined();
    expect(artifact.functionBodies?.[ping!]).toBeTypeOf('string');
    expect(artifact.functionBodies![ping!]!.length).toBeGreaterThan(0);
  });

  it('keeps speed-hinted outline bodies at the 8192-group cap', () => {
    const artifact = compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public delegate {
          this.a = v;
          this.b = v;
          require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 });
    const selector = artifact.abi.find((fn) => fn.name === 'set')?.selector;
    expect(selector).toBeDefined();
    expect(artifact.functionBodies?.[selector!]).toBeTypeOf('string');
    expect(artifact.functionBodies![selector!]!.length).toBeGreaterThan(0);
  });

  it('keeps speed-hinted outline bodies at the 4096-group cap', () => {
    const artifact = compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public delegate {
          this.a = v;
          this.b = v;
          require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 });
    const selector = artifact.abi.find((fn) => fn.name === 'set')?.selector;
    expect(selector).toBeDefined();
    expect(artifact.functionBodies?.[selector!]).toBeTypeOf('string');
    expect(artifact.functionBodies![selector!]!.length).toBeGreaterThan(0);
  });

  it('keeps speed-hinted outline bodies at the 2048-group cap', () => {
    const artifact = compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public delegate {
          this.a = v;
          this.b = v;
          require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 });
    const selector = artifact.abi.find((fn) => fn.name === 'set')?.selector;
    expect(selector).toBeDefined();
    expect(artifact.functionBodies?.[selector!]).toBeTypeOf('string');
    expect(artifact.functionBodies![selector!]!.length).toBeGreaterThan(0);
  });

  it('keeps speed-hinted outline bodies at the full 1024-group cap', () => {
    const artifact = compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public delegate {
          this.a = v;
          this.b = v;
          require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 });
    const selector = artifact.abi.find((fn) => fn.name === 'set')?.selector;
    expect(selector).toBeDefined();
    expect(artifact.functionBodies?.[selector!]).toBeTypeOf('string');
    expect(artifact.functionBodies![selector!]!.length).toBeGreaterThan(0);
  });

  it('keeps speed-hinted outline bodies after raising the candidate-group cap', () => {
    const artifact = compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public delegate {
          this.a = v;
          this.b = v;
          require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 });
    const selector = artifact.abi.find((fn) => fn.name === 'set')?.selector;
    expect(selector).toBeDefined();
    expect(artifact.functionBodies?.[selector!]).toBeTypeOf('string');
    expect(artifact.functionBodies![selector!]!.length).toBeGreaterThan(0);
  });

  it('outlines repeated spans on a speed-hinted compile while keeping function bodies', () => {
    const artifact = compileString(`
      contract Store() {
        uint256 x;
        uint256 y;
        function set(uint256 v) public delegate {
          this.x = v;
          this.y = v;
          require(this.x == this.y);
        }
        function ping() public {
          require(this.x == this.y);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 });
    const selector = artifact.abi.find((fn) => fn.name === 'set')?.selector;
    expect(selector).toBeDefined();
    const body = artifact.functionBodies?.[selector!];
    expect(body).toBeTypeOf('string');
    expect(body!.length).toBeGreaterThan(0);
  });

  it('extracts structural helpers when a speed-hinted compile cannot outline', () => {
    const artifact = compileString(`
      contract Store() {
        struct Pair { uint256 a; uint256 b; uint256 c; }
        Pair p;
        Pair q;
        function set(uint256 v) public delegate {
          this.p.a = v;
          this.p.b = v;
          this.p.c = v;
          this.q.a = v;
          this.q.b = v;
          require(this.p.a == this.q.a);
        }
      }
    `, {
      messageBus: false,
      optimizeForCompilationSpeed: true,
      maximumInputBytes: 1_000_000,
    });
    const selector = artifact.abi.find((fn) => fn.name === 'set')?.selector;
    expect(selector).toBeDefined();
    const body = artifact.functionBodies?.[selector!];
    expect(body).toBeTypeOf('string');
    expect(body!.length).toBeGreaterThan(0);
    const whole = artifact.debug?.bytecode ?? '';
    const defines = decodeAuthenticationInstructions(hexToBin(whole))
      .filter((instruction) => instruction.opcode === OpcodesBCH.OP_DEFINE).length;
    // Speed-hinted compiles skip shared-span outlining, so structural field helpers must still
    // be OP_DEFINE'd rather than inlined at every Pair field site.
    expect(defines).toBeGreaterThan(4);
  });

  it('still extracts int helpers when the usage probe does not emit throwaway opcodes', () => {
    const body = compiledSetBody(true);
    expect(body.length).toBeGreaterThan(0);
    expect(invokesHelper(body, -1n)
      || decodeAuthenticationInstructions(hexToBin(body))
        .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
  });

  it('shares the drop-first-32 helper from a delegate abi.decode site', () => {
    const artifact = compileString(`
      contract Store() {
        uint256 public x;
        function set(bytes data) public delegate {
          (uint256 a, uint256 b) = abi.decode(data, (uint256, uint256));
          this.x = a + b;
          require(this.x >= a);
        }
      }
    `, { messageBus: false, solidityImportCompat: true });
    const selector = artifact.abi.find((fn) => fn.name === 'set')?.selector;
    expect(selector).toBeDefined();
    const body = artifact.functionBodies?.[selector!];
    expect(body).toBeTypeOf('string');
    expect(body!.length).toBeGreaterThan(0);
  });

  it('shares the take-first-32 helper from a delegate mapping write', () => {
    const artifact = compileString(`
      contract Store() {
        mapping(bytes32 => int) public scores;
        function set(bytes32 k, int v) public delegate {
          this.scores[k] = v;
          require(this.scores[k] == v);
        }
      }
    `, { messageBus: false });
    const selector = artifact.abi.find((fn) => fn.name === 'set')?.selector;
    expect(selector).toBeDefined();
    const body = artifact.functionBodies?.[selector!];
    expect(body).toBeTypeOf('string');
    expect(body!.length).toBeGreaterThan(0);
  });

  it('shares the EVM ABI uint word encoder from a delegate abi.encode site', () => {
    const artifact = compileString(`
      contract Store() {
        bytes public blob;
        function set(uint256 a, uint256 b) public delegate {
          this.blob = abi.encode(a, b);
          require(this.blob.length > 0);
        }
      }
    `, { messageBus: false, solidityImportCompat: true });
    const selector = artifact.abi.find((fn) => fn.name === 'set')?.selector;
    expect(selector).toBeDefined();
    const body = artifact.functionBodies?.[selector!];
    expect(body).toBeTypeOf('string');
    expect(body!.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(body!))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
  });

  it('uses SIZE NIP 0NOTEQUAL for nonempty-bytes checks', () => {
    const artifact = compileString(`
      contract Store() {
        mapping(bytes20 => int) public balances;
        function set(bytes20 k, int v) public delegate {
          this.balances[k] = v;
          require(this.balances[k] == v);
        }
      }
    `, { messageBus: false });
    const selector = artifact.abi.find((fn) => fn.name === 'set')?.selector;
    expect(selector).toBeDefined();
    const body = artifact.functionBodies?.[selector!];
    expect(body).toBeTypeOf('string');
    expect(body!.length).toBeGreaterThan(0);
  });

  it('shares the nonempty-bytes check from a delegate mapping write', () => {
    const artifact = compileString(`
      contract Store() {
        mapping(bytes20 => int) public balances;
        function set(bytes20 k, int v) public delegate {
          this.balances[k] = v;
          require(this.balances[k] == v);
        }
      }
    `, { messageBus: false });
    const selector = artifact.abi.find((fn) => fn.name === 'set')?.selector;
    expect(selector).toBeDefined();
    const body = artifact.functionBodies?.[selector!];
    expect(body).toBeTypeOf('string');
    expect(body!.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(body!))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
  });

  it('still extracts int-encode when the usage probe does not inline the encoder', () => {
    const artifact = compileString(`
      contract Store() {
        bigint x;
        bigint y;
        bigint z;
        function set(bigint v) public delegate {
          this.x = v;
          this.y = v;
          this.z = v;
          require(this.x == this.y);
        }
      }
    `, { messageBus: false });
    const selector = artifact.abi.find((fn) => fn.name === 'set')?.selector;
    expect(selector).toBeDefined();
    const body = artifact.functionBodies?.[selector!];
    expect(body).toBeTypeOf('string');
    expect(body!.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(body!))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
  });
});
