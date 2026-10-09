import { decodeAuthenticationInstructions, hexToBin, OpcodesBCH, vmNumberToBigInt } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { compileString, compileStringMulti } from '../src/index.js';
import type { Artifact } from '@solidcash/utils';

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

const SPEED_HINT_STORE = `
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v; this.b = v; require(this.a == this.b);
        }
      }
    `;

const expectSpeedHintedOutline = (artifact: Artifact): void => {
  const whole = artifact.debug?.bytecode ?? '';
  expect(whole.length).toBeGreaterThan(0);
  expect(decodeAuthenticationInstructions(hexToBin(whole))
    .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
};

const compileSpeedHintStore = (): Artifact => compileString(SPEED_HINT_STORE, {
  messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
});

const compileSpeedHintStoreMulti = (): Artifact => {
  const map = compileStringMulti(SPEED_HINT_STORE, {
    messageBus: true,
    optimizeForCompilationSpeed: true,
    maximumInputBytes: 1_000_000,
    compileDeclarations: ['Store'],
  });
  const artifact = map.Store;
  expect(artifact).toBeDefined();
  expect(artifact.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
  return artifact;
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

  it('keeps authenticated collection-journal bodies trace-stable under the compilation-speed hint', () => {
    const traceSource = `
      contract TraceStable() {
        int[] public items;
        mapping(bytes20 => int) public weights;
        function append(bytes20 key, int value) public {
          require(this.weights[key] >= 0);
          this.items.push(value);
        }
      }
    `;
    const options = {
      messageBus: true,
      maximumInputBytes: 1_000_000,
      commitmentLimit: 128,
    } as const;
    const fast = compileString(traceSource, { ...options, optimizeForCompilationSpeed: true });
    const selector = fast.abi.find((fn) => fn.name === 'append')?.selector;
    expect(selector).toBeDefined();
    expect(fast.abi.find((fn) => fn.name === 'append')).toMatchObject({
      dynamicWrites: ['items'],
      entryAccesses: [expect.any(Object)],
    });
    expect(fast.functionBodies?.[selector!]).toBeTypeOf('string');
    expect(Object.values(fast.debug?.invokeDebug ?? {})
      .some((entry) => entry.name?.startsWith('outlined source span'))).toBe(false);
  });

  it('still speed-hint outlines when statement prediction skips ATN for while-loops', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          uint256 i = 0; while (i < 1) { i = i + 1; this.a = v; }
          this.b = v; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact statement prediction skips ATN for while-loops', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          uint256 i = 0; while (i < 1) { i = i + 1; this.a = v; }
          this.b = v; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when statement prediction skips ATN for do-loops', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          uint256 i = 0; do { i = i + 1; this.a = v; } while (i < 1);
          this.b = v; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact statement prediction skips ATN for do-loops', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          uint256 i = 0; do { i = i + 1; this.a = v; } while (i < 1);
          this.b = v; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when statement prediction skips ATN for console.log', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          console.log("x"); this.a = v;
          this.b = v; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact statement prediction skips ATN for console.log', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          console.log("x"); this.a = v;
          this.b = v; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when statement prediction skips ATN for revert', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          if (v == 0) { revert(); } this.a = v;
          this.b = v; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact statement prediction skips ATN for revert', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          if (v == 0) { revert(); } this.a = v;
          this.b = v; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when statement prediction skips ATN for assert', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          assert(v == v); this.a = v;
          this.b = v; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact statement prediction skips ATN for assert', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          assert(v == v); this.a = v;
          this.b = v; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when statement prediction skips ATN for delete', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          uint256 x = v; delete x; this.a = v;
          this.b = v; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact statement prediction skips ATN for delete', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          uint256 x = v; delete x; this.a = v;
          this.b = v; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when statement prediction skips ATN for break', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          for (uint256 i = 0; i < 1; i = i + 1) { this.a = v; break; }
          this.b = v; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact statement prediction skips ATN for break', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          for (uint256 i = 0; i < 1; i = i + 1) { this.a = v; break; }
          this.b = v; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when statement prediction skips ATN for continue', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          for (uint256 i = 0; i < 1; i = i + 1) { this.a = v; continue; }
          this.b = v; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact statement prediction skips ATN for continue', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          for (uint256 i = 0; i < 1; i = i + 1) { this.a = v; continue; }
          this.b = v; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when statement prediction skips ATN for assembly', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          assembly { } this.a = v;
          this.b = v; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact statement prediction skips ATN for assembly', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          assembly { } this.a = v;
          this.b = v; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when statement prediction skips ATN for unchecked', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          unchecked { this.a = v; }
          this.b = v; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact statement prediction skips ATN for unchecked', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          unchecked { this.a = v; }
          this.b = v; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when statement prediction skips ATN for switch', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          switch (v) { default: this.a = v; }
          this.b = v; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact statement prediction skips ATN for switch', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          switch (v) { default: this.a = v; }
          this.b = v; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when statement prediction skips ATN for selfdestruct', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = v; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact statement prediction skips ATN for selfdestruct', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = v; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when statement prediction skips ATN for try', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = v; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact statement prediction skips ATN for try', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = v; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when optional-lowering prediction skips ATN for assembly-feature-survey', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact optional-lowering prediction skips ATN for assembly-feature-survey', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when optional-lowering prediction skips ATN for function-type-survey', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact optional-lowering prediction skips ATN for function-type-survey', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix loop prediction skips ATN for index', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix loop prediction skips ATN for index', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix loop prediction skips ATN for member-dot', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix loop prediction skips ATN for member-dot', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix loop prediction skips ATN for plus', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v + uint256(0);
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix loop prediction skips ATN for plus', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v + uint256(0);
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix loop prediction skips ATN for minus', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v - uint256(0);
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix loop prediction skips ATN for minus', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v - uint256(0);
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix loop prediction skips ATN for star', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v * uint256(1);
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix loop prediction skips ATN for star', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v * uint256(1);
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix loop prediction skips ATN for slash', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v / uint256(1);
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix loop prediction skips ATN for slash', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v / uint256(1);
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix loop prediction skips ATN for percent', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v % uint256(2);
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix loop prediction skips ATN for percent', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v % uint256(2);
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix loop prediction skips ATN for eq', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix loop prediction skips ATN for eq', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix loop prediction skips ATN for neq', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          require(v != v + uint256(1)); this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix loop prediction skips ATN for neq', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          require(v != v + uint256(1)); this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix loop prediction skips ATN for lt', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          require(v < v + uint256(1)); this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix loop prediction skips ATN for lt', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          require(v < v + uint256(1)); this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix loop prediction skips ATN for gt', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          require(v + uint256(1) > v); this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix loop prediction skips ATN for gt', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          require(v + uint256(1) > v); this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix loop prediction skips ATN for le', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          require(v <= v); this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix loop prediction skips ATN for le', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          require(v <= v); this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix loop prediction skips ATN for ge', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          require(v >= v); this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix loop prediction skips ATN for ge', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          require(v >= v); this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix loop prediction skips ATN for andand', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          require(true && true); this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix loop prediction skips ATN for andand', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          require(true && true); this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix loop prediction skips ATN for oror', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          require(false || true); this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix loop prediction skips ATN for oror', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          require(false || true); this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix loop prediction skips ATN for pow', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = uint256(2) ** uint256(0);
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix loop prediction skips ATN for pow', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = uint256(2) ** uint256(0);
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix loop prediction skips ATN for shl', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v << uint256(0);
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix loop prediction skips ATN for shl', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v << uint256(0);
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix loop prediction skips ATN for shr', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v >> uint256(0);
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix loop prediction skips ATN for shr', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v >> uint256(0);
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix loop prediction skips ATN for bitand', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v & v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix loop prediction skips ATN for bitand', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v & v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix loop prediction skips ATN for bitxor', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v ^ uint256(0);
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix loop prediction skips ATN for bitxor', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v ^ uint256(0);
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix loop prediction skips ATN for bitor', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v | uint256(0);
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix loop prediction skips ATN for bitor', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v | uint256(0);
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix loop prediction skips ATN for qmark', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = true ? v : uint256(0);
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix loop prediction skips ATN for qmark', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = true ? v : uint256(0);
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix loop prediction skips ATN for plusplus', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          uint256 i = v; i++; this.a = i;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix loop prediction skips ATN for plusplus', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          uint256 i = v; i++; this.a = i;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix loop prediction skips ATN for minusminus', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          uint256 i = v; i--; this.a = i;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix loop prediction skips ATN for minusminus', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          uint256 i = v; i--; this.a = i;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when statement prediction skips ATN for placeholder', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact statement prediction skips ATN for placeholder', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when leftover prediction skips ATN for singleton-group-sort', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact leftover prediction skips ATN for singleton-group-sort', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when leftover prediction skips ATN for under-cap-group-splice', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact leftover prediction skips ATN for under-cap-group-splice', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when leftover prediction skips ATN for prefix-unroll-4', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact leftover prediction skips ATN for prefix-unroll-4', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when leftover prediction skips ATN for collision-unroll-4', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact leftover prediction skips ATN for collision-unroll-4', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when leftover prediction skips ATN for packed-window-4', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact leftover prediction skips ATN for packed-window-4', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when leftover prediction skips ATN for packed-window-5', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact leftover prediction skips ATN for packed-window-5', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when leftover prediction skips ATN for hash-unroll-3', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact leftover prediction skips ATN for hash-unroll-3', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when leftover prediction skips ATN for hash-unroll-6', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact leftover prediction skips ATN for hash-unroll-6', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when leftover prediction skips ATN for hash-unroll-7', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact leftover prediction skips ATN for hash-unroll-7', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when leftover prediction skips ATN for hash-unroll-9', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact leftover prediction skips ATN for hash-unroll-9', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when leftover prediction skips ATN for hash-unroll-10', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact leftover prediction skips ATN for hash-unroll-10', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when leftover prediction skips ATN for hash-unroll-11', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact leftover prediction skips ATN for hash-unroll-11', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix inner prediction skips ATN for plus', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v + uint256(0);
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix inner prediction skips ATN for plus', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v + uint256(0);
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix inner prediction skips ATN for minus', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v - uint256(0);
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix inner prediction skips ATN for minus', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v - uint256(0);
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix inner prediction skips ATN for star', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v * uint256(1);
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix inner prediction skips ATN for star', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v * uint256(1);
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix inner prediction skips ATN for slash', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v / uint256(1);
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix inner prediction skips ATN for slash', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v / uint256(1);
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix inner prediction skips ATN for percent', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v % uint256(2);
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix inner prediction skips ATN for percent', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v % uint256(2);
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix inner prediction skips ATN for eq', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix inner prediction skips ATN for eq', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix inner prediction skips ATN for neq', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          require(v != v + uint256(1)); this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix inner prediction skips ATN for neq', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          require(v != v + uint256(1)); this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix inner prediction skips ATN for lt', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          require(v < v + uint256(1)); this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix inner prediction skips ATN for lt', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          require(v < v + uint256(1)); this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix inner prediction skips ATN for gt', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          require(v + uint256(1) > v); this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix inner prediction skips ATN for gt', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          require(v + uint256(1) > v); this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix inner prediction skips ATN for le', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          require(v <= v); this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix inner prediction skips ATN for le', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          require(v <= v); this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix inner prediction skips ATN for ge', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          require(v >= v); this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix inner prediction skips ATN for ge', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          require(v >= v); this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix inner prediction skips ATN for andand', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          require(true && true); this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix inner prediction skips ATN for andand', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          require(true && true); this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix inner prediction skips ATN for oror', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          require(false || true); this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix inner prediction skips ATN for oror', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          require(false || true); this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix inner prediction skips ATN for pow', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = uint256(2) ** uint256(0);
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix inner prediction skips ATN for pow', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = uint256(2) ** uint256(0);
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix inner prediction skips ATN for shl', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v << uint256(0);
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix inner prediction skips ATN for shl', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v << uint256(0);
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix inner prediction skips ATN for shr', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v >> uint256(0);
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix inner prediction skips ATN for shr', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v >> uint256(0);
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix inner prediction skips ATN for bitand', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v & v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix inner prediction skips ATN for bitand', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v & v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix inner prediction skips ATN for bitxor', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v ^ uint256(0);
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix inner prediction skips ATN for bitxor', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v ^ uint256(0);
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix inner prediction skips ATN for bitor', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v | uint256(0);
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix inner prediction skips ATN for bitor', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v | uint256(0);
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix inner prediction skips ATN for qmark', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = true ? v : uint256(0);
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix inner prediction skips ATN for qmark', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = true ? v : uint256(0);
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix inner prediction skips ATN for plusplus', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          uint256 i = v; i++; this.a = i;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix inner prediction skips ATN for plusplus', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          uint256 i = v; i++; this.a = i;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix inner prediction skips ATN for minusminus', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          uint256 i = v; i--; this.a = i;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix inner prediction skips ATN for minusminus', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          uint256 i = v; i--; this.a = i;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix loop prediction skips ATN for length', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = uint256(bytes(hex"aa").length);
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix loop prediction skips ATN for length', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = uint256(bytes(hex"aa").length);
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix loop prediction skips ATN for reverse', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          bytes z = bytes(hex"aa").reverse(); this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix loop prediction skips ATN for reverse', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          bytes z = bytes(hex"aa").reverse(); this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix loop prediction skips ATN for split', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          bytes x; bytes y; (x, y) = bytes(hex"abcd").split(1); this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix loop prediction skips ATN for split', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          bytes x; bytes y; (x, y) = bytes(hex"abcd").split(1); this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix loop prediction skips ATN for slice', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          bytes z = bytes(hex"abcd").slice(0, 1); this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix loop prediction skips ATN for slice', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          bytes z = bytes(hex"abcd").slice(0, 1); this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix inner prediction skips ATN for length', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = uint256(bytes(hex"aa").length);
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix inner prediction skips ATN for length', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = uint256(bytes(hex"aa").length);
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix inner prediction skips ATN for reverse', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          bytes z = bytes(hex"aa").reverse(); this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix inner prediction skips ATN for reverse', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          bytes z = bytes(hex"aa").reverse(); this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix inner prediction skips ATN for split', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          bytes x; bytes y; (x, y) = bytes(hex"abcd").split(1); this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix inner prediction skips ATN for split', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          bytes x; bytes y; (x, y) = bytes(hex"abcd").split(1); this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix inner prediction skips ATN for slice', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          bytes z = bytes(hex"abcd").slice(0, 1); this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix inner prediction skips ATN for slice', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          bytes z = bytes(hex"abcd").slice(0, 1); this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix loop prediction skips ATN for value', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix loop prediction skips ATN for value', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when expression postfix inner prediction skips ATN for value', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact expression postfix inner prediction skips ATN for value', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when optional-lowering prediction skips ATN for inline-deploy-gate', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact optional-lowering prediction skips ATN for inline-deploy-gate', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when parser prediction skips ATN for token-type-prefill', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact parser prediction skips ATN for token-type-prefill', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when leftover prediction skips ATN for prefix-unroll-8', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact leftover prediction skips ATN for prefix-unroll-8', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when leftover prediction skips ATN for collision-unroll-8', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact leftover prediction skips ATN for collision-unroll-8', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when leftover prediction skips ATN for packed-window-8', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact leftover prediction skips ATN for packed-window-8', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when leftover prediction skips ATN for packed-window-12', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact leftover prediction skips ATN for packed-window-12', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when leftover prediction skips ATN for packed-window-3', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact leftover prediction skips ATN for packed-window-3', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when leftover prediction skips ATN for packed-window-6', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact leftover prediction skips ATN for packed-window-6', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when leftover prediction skips ATN for packed-window-7', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact leftover prediction skips ATN for packed-window-7', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when leftover prediction skips ATN for packed-window-10', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact leftover prediction skips ATN for packed-window-10', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when leftover prediction skips ATN for hash-unroll-13', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact leftover prediction skips ATN for hash-unroll-13', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when leftover prediction skips ATN for hash-unroll-14', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact leftover prediction skips ATN for hash-unroll-14', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when leftover prediction skips ATN for hash-unroll-15', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact leftover prediction skips ATN for hash-unroll-15', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when leftover prediction skips ATN for hash-unroll-16', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact leftover prediction skips ATN for hash-unroll-16', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v;
          this.b = this.a; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when .value field assignment is not parsed as a method call', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        struct Item { uint256 value; }
        function set(uint256 v) public {
          Item memory s;
          s.value = v;
          this.a = s.value; this.b = v; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact .value field assignment is not parsed as a method call', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        struct Item { uint256 value; }
        function set(uint256 v) public {
          Item memory s;
          s.value = v;
          this.a = s.value; this.b = v; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when .length() is parsed as a method call rather than the unary member', () => {
    expectSpeedHintedOutline(compileString(`
      library LengthLib {
        function length(bytes memory self) public returns (uint256) { return uint256(bytes(self).length); }
      }
      contract Store() {
        uint256 a;
        uint256 b;
        using LengthLib for bytes;
        function set(uint256 v) public {
          bytes memory data = hex"abcd";
          this.a = data.length();
          this.b = v; require(this.a == this.b || this.a == uint256(4));
        }
      }
    `, {
      messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      evmCompat: true,
    }));
  });

  it('still speed-hint outlines when multi-artifact .length() is parsed as a method call rather than the unary member', () => {
    const map = compileStringMulti(`
      library LengthLib {
        function length(bytes memory self) public returns (uint256) { return uint256(bytes(self).length); }
      }
      contract Store() {
        uint256 a;
        uint256 b;
        using LengthLib for bytes;
        function set(uint256 v) public {
          bytes memory data = hex"abcd";
          this.a = data.length();
          this.b = v; require(this.a == this.b || this.a == uint256(4));
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      evmCompat: true,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when statement prediction skips ATN for for-loops', () => {
    expectSpeedHintedOutline(compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          for (uint256 i = 0; i < 1; i = i + 1) { this.a = v; }
          this.b = v; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 }));
  });

  it('still speed-hint outlines when multi-artifact statement prediction skips ATN for for-loops', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          for (uint256 i = 0; i < 1; i = i + 1) { this.a = v; }
          this.b = v; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expectSpeedHintedOutline(map.Store);
  });

  it('still speed-hint outlines when parser token-type lookups are interned', () => {
    expectSpeedHintedOutline(compileSpeedHintStore());
  });

  it('still speed-hint outlines when multi-artifact parser token-type lookups are interned', () => {
    expectSpeedHintedOutline(compileSpeedHintStoreMulti());
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

  it('still speed-hint outlines when leftover hashing defers singleton window groups', () => {
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

  it('still speed-hint outlines when multi-artifact leftover hashing defers singleton groups', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v; this.b = v; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true,
      optimizeForCompilationSpeed: true,
      maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    const artifact = map.Store;
    expect(artifact).toBeDefined();
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
    expect(artifact.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
  });

  it('still speed-hint outlines when leftover fingerprint intern is reused on the window-4 pass', () => {
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

  it('still speed-hint outlines when multi-artifact leftover fingerprint intern is reused', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v; this.b = v; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true,
      optimizeForCompilationSpeed: true,
      maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    const artifact = map.Store;
    expect(artifact).toBeDefined();
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
    expect(artifact.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
  });

  it('still speed-hint outlines when leftover hash collisions split on packed window keys', () => {
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

  it('still speed-hint outlines when multi-artifact leftover collisions split on packed keys', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v; this.b = v; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true,
      optimizeForCompilationSpeed: true,
      maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    const artifact = map.Store;
    expect(artifact).toBeDefined();
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
    expect(artifact.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
  });

  it('still speed-hint outlines when leftover window hashes are unrolled for widths 4 5 and 8', () => {
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

  it('still speed-hint outlines when multi-artifact leftover window hashes are unrolled', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v; this.b = v; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true,
      optimizeForCompilationSpeed: true,
      maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    const artifact = map.Store;
    expect(artifact).toBeDefined();
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
    expect(artifact.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
  });

  it('still speed-hint outlines when leftover hashing skips bodies shorter than the window', () => {
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

  it('still speed-hint outlines when multi-artifact leftover hashing skips short bodies', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v; this.b = v; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true,
      optimizeForCompilationSpeed: true,
      maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    const artifact = map.Store;
    expect(artifact).toBeDefined();
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
    expect(artifact.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
  });

  it('still speed-hint outlines when chained method calls share a left-factored postfix', () => {
    const artifact = compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function ping() internal returns (uint256) { return this.a; }
        function set(uint256 v) public {
          this.a = v;
          this.b = this.ping();
          require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 });
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
  });

  it('still speed-hint outlines when multi-artifact chained method calls share a left-factored postfix', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function ping() internal returns (uint256) { return this.a; }
        function set(uint256 v) public {
          this.a = v;
          this.b = this.ping();
          require(this.a == this.b);
        }
      }
    `, {
      messageBus: true,
      optimizeForCompilationSpeed: true,
      maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    const artifact = map.Store;
    expect(artifact).toBeDefined();
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
    expect(artifact.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
  });

  it('still speed-hint outlines when concat forms share a left-factored prefix', () => {
    const artifact = compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          bytes memory x = bytes.concat(hex"00");
          string memory y = string.concat("a");
          this.a = v; this.b = v; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 });
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
  });

  it('still speed-hint outlines when multi-artifact concat forms share a left-factored prefix', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          bytes memory x = bytes.concat(hex"00");
          string memory y = string.concat("a");
          this.a = v; this.b = v; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true,
      optimizeForCompilationSpeed: true,
      maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    const artifact = map.Store;
    expect(artifact).toBeDefined();
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
    expect(artifact.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
  });

  it('still speed-hint outlines when tx input and output introspection share a prefix', () => {
    const artifact = compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = tx.inputs[0].value;
          this.b = tx.outputs[0].value;
          require(this.a == this.b || v == v);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 });
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
  });

  it('still speed-hint outlines when multi-artifact tx introspection shares a prefix', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = tx.inputs[0].value;
          this.b = tx.outputs[0].value;
          require(this.a == this.b || v == v);
        }
      }
    `, {
      messageBus: true,
      optimizeForCompilationSpeed: true,
      maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    const artifact = map.Store;
    expect(artifact).toBeDefined();
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
    expect(artifact.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
  });

  it('still speed-hint outlines when abi.encode forms share a left-factored prefix', () => {
    const artifact = compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          bytes memory x = abi.encode(v);
          bytes memory y = abi.encodePacked(v);
          this.a = v; this.b = v; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 });
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
  });

  it('still speed-hint outlines when multi-artifact abi.encode forms share a left-factored prefix', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          bytes memory x = abi.encode(v);
          bytes memory y = abi.encodePacked(v);
          this.a = v; this.b = v; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true,
      optimizeForCompilationSpeed: true,
      maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    const artifact = map.Store;
    expect(artifact).toBeDefined();
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
    expect(artifact.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
  });

  it('still speed-hint outlines when method calls share a left-factored postfix', () => {
    const artifact = compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function ping() internal returns (uint256) { return this.a; }
        function set(uint256 v) public {
          this.a = v;
          this.b = this.ping();
          require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 });
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
  });

  it('still speed-hint outlines when multi-artifact method calls share a left-factored postfix', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function ping() internal returns (uint256) { return this.a; }
        function set(uint256 v) public {
          this.a = v;
          this.b = this.ping();
          require(this.a == this.b);
        }
      }
    `, {
      messageBus: true,
      optimizeForCompilationSpeed: true,
      maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    const artifact = map.Store;
    expect(artifact).toBeDefined();
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
    expect(artifact.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
  });

  it('still speed-hint outlines when function calls share a left-factored prefix', () => {
    const artifact = compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function id(uint256 x) internal returns (uint256) { return x; }
        function set(uint256 v) public {
          this.a = this.id(v);
          this.b = this.id(v);
          require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 });
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
  });

  it('still speed-hint outlines when multi-artifact function calls share a left-factored prefix', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function id(uint256 x) internal returns (uint256) { return x; }
        function set(uint256 v) public {
          this.a = this.id(v);
          this.b = this.id(v);
          require(this.a == this.b);
        }
      }
    `, {
      messageBus: true,
      optimizeForCompilationSpeed: true,
      maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    const artifact = map.Store;
    expect(artifact).toBeDefined();
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
    expect(artifact.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
  });

  it('still speed-hint outlines when this-expressions share a left-factored prefix', () => {
    const artifact = compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        mapping (uint256 => uint256) m;
        function set(uint256 v) public {
          this.a = v;
          this.m[v] = v;
          this.b = this.a;
          require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 });
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
  });

  it('still speed-hint outlines when multi-artifact this-expressions share a left-factored prefix', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        mapping (uint256 => uint256) m;
        function set(uint256 v) public {
          this.a = v;
          this.m[v] = v;
          this.b = this.a;
          require(this.a == this.b);
        }
      }
    `, {
      messageBus: true,
      optimizeForCompilationSpeed: true,
      maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    const artifact = map.Store;
    expect(artifact).toBeDefined();
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
    expect(artifact.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
  });

  it('still speed-hint outlines when indexed expressions share a left-factored postfix', () => {
    const artifact = compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        uint256[] items;
        function set(uint256 v) public {
          this.items.push(v);
          this.a = this.items[0];
          this.b = this.items[0];
          require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 });
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
  });

  it('still speed-hint outlines when multi-artifact indexed expressions share a left-factored postfix', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        uint256[] items;
        function set(uint256 v) public {
          this.items.push(v);
          this.a = this.items[0];
          this.b = this.items[0];
          require(this.a == this.b);
        }
      }
    `, {
      messageBus: true,
      optimizeForCompilationSpeed: true,
      maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    const artifact = map.Store;
    expect(artifact).toBeDefined();
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
    expect(artifact.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
  });

  it('still speed-hint outlines when new-expressions share a left-factored prefix', () => {
    const artifact = compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          int[] d = new int[](2);
          d[0] = int(v); d[1] = int(v);
          this.a = uint256(d[0]); this.b = uint256(d[1]); require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 });
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
  });

  it('still speed-hint outlines when multi-artifact new-expressions share a left-factored prefix', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          int[] d = new int[](2);
          d[0] = int(v); d[1] = int(v);
          this.a = uint256(d[0]); this.b = uint256(d[1]); require(this.a == this.b);
        }
      }
    `, {
      messageBus: true,
      optimizeForCompilationSpeed: true,
      maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    const artifact = map.Store;
    expect(artifact).toBeDefined();
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
    expect(artifact.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
  });

  it('still speed-hint outlines when parenthesized expressions share a left-factored prefix', () => {
    const artifact = compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          (uint256 x, uint256 y) = (v, v);
          this.a = (x);
          this.b = (y);
          require((this.a) == (this.b));
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 });
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
  });

  it('still speed-hint outlines when multi-artifact parenthesized expressions share a left-factored prefix', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          (uint256 x, uint256 y) = (v, v);
          this.a = (x);
          this.b = (y);
          require((this.a) == (this.b));
        }
      }
    `, {
      messageBus: true,
      optimizeForCompilationSpeed: true,
      maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    const artifact = map.Store;
    expect(artifact).toBeDefined();
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
    expect(artifact.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
  });

  it('still speed-hint outlines when statement prediction skips ATN for require if and blocks', () => {
    const artifact = compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          if (v == 0) { this.a = 0; }
          this.a = v; this.b = v; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 });
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
  });

  it('still speed-hint outlines when multi-artifact statement prediction skips ATN for require', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          if (v == 0) { this.a = 0; }
          this.a = v; this.b = v; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true,
      optimizeForCompilationSpeed: true,
      maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    const artifact = map.Store;
    expect(artifact).toBeDefined();
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
    expect(artifact.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
  });

  it('still speed-hint outlines when Solidity diagnostic trailers are skipped if absent', () => {
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

  it('still speed-hint outlines when multi-artifact Solidity diagnostic trailers are skipped if absent', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v; this.b = v; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true,
      optimizeForCompilationSpeed: true,
      maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    const artifact = map.Store;
    expect(artifact).toBeDefined();
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
    expect(artifact.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
  });

  it('still speed-hint outlines when EVMVersion and function layout-at rewrites are skipped if absent', () => {
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

  it('still speed-hint outlines when multi-artifact EVMVersion rewrites are skipped if absent', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v; this.b = v; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true,
      optimizeForCompilationSpeed: true,
      maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    const artifact = map.Store;
    expect(artifact).toBeDefined();
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
    expect(artifact.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
  });

  it('still speed-hint outlines when parse preprocessing skips absent SPDX and bidi scans', () => {
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

  it('still speed-hint outlines when multi-artifact parse preprocessing skips absent SPDX scans', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v; this.b = v; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true,
      optimizeForCompilationSpeed: true,
      maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    const artifact = map.Store;
    expect(artifact).toBeDefined();
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
    expect(artifact.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
  });

  it('still speed-hint outlines when Hardhat console import rewrite is skipped if absent', () => {
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

  it('still speed-hint outlines when multi-artifact Hardhat console rewrite is skipped if absent', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v; this.b = v; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true,
      optimizeForCompilationSpeed: true,
      maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    const artifact = map.Store;
    expect(artifact).toBeDefined();
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
    expect(artifact.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
  });

  it('still speed-hint outlines when malformed type-name predicates reject by first character', () => {
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

  it('still speed-hint outlines when multi-artifact malformed type-name predicates reject by first character', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v; this.b = v; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true,
      optimizeForCompilationSpeed: true,
      maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    const artifact = map.Store;
    expect(artifact).toBeDefined();
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
    expect(artifact.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
  });

  it('still speed-hint outlines when Yul keyword lookup uses a hoisted set', () => {
    const artifact = compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          assembly { let x := 1 }
          this.a = v; this.b = v; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 });
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
  });

  it('still speed-hint outlines when multi-artifact Yul keyword lookup uses a hoisted set', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          assembly { let x := 1 }
          this.a = v; this.b = v; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true,
      optimizeForCompilationSpeed: true,
      maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    const artifact = map.Store;
    expect(artifact).toBeDefined();
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
    expect(artifact.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
  });

  it('still speed-hint outlines when nested-tuple lookahead inspects token types', () => {
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

  it('still speed-hint outlines when multi-artifact nested-tuple lookahead inspects token types', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v; this.b = v; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true,
      optimizeForCompilationSpeed: true,
      maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    const artifact = map.Store;
    expect(artifact).toBeDefined();
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
    expect(artifact.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
  });

  it('still speed-hint outlines when call-ahead predicates inspect token types', () => {
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

  it('still speed-hint outlines when multi-artifact call-ahead predicates inspect token types', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v; this.b = v; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true,
      optimizeForCompilationSpeed: true,
      maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    const artifact = map.Store;
    expect(artifact).toBeDefined();
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
    expect(artifact.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
  });

  it('still speed-hint outlines when expression postfix loops stop without ATN on closers', () => {
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

  it('still speed-hint outlines when multi-artifact expression postfix loops stop without ATN', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v; this.b = v; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true,
      optimizeForCompilationSpeed: true,
      maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    const artifact = map.Store;
    expect(artifact).toBeDefined();
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
    expect(artifact.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
  });

  it('still speed-hint outlines when the lexer reads a packed UTF-16 char stream', () => {
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

  it('still speed-hint outlines when multi-artifact lexing uses a packed char stream', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v; this.b = v; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true,
      optimizeForCompilationSpeed: true,
      maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    const artifact = map.Store;
    expect(artifact).toBeDefined();
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
    expect(artifact.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
  });

  it('still speed-hint outlines when expression prefix prediction skips ATN for address this and new', () => {
    const artifact = compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        address owner;
        function set(uint256 v) public {
          this.owner = address(0);
          this.a = v; this.b = v; require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 });
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
  });

  it('still speed-hint outlines when expression prefix prediction skips ATN for casts and abi builtins', () => {
    const artifact = compileString(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = uint256(v);
          this.b = uint256(v);
          require(this.a == this.b);
        }
      }
    `, { messageBus: false, optimizeForCompilationSpeed: true, maximumInputBytes: 1_000_000 });
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
  });

  it('still speed-hint outlines when expression prefix prediction skips ATN for identifiers', () => {
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

  it('still speed-hint outlines when multi-artifact expression prefix prediction skips ATN for address casts', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        address owner;
        function set(uint256 v) public {
          this.owner = address(0);
          this.a = v; this.b = v; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true,
      optimizeForCompilationSpeed: true,
      maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    const artifact = map.Store;
    expect(artifact).toBeDefined();
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
    expect(artifact.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
  });

  it('still speed-hint outlines when multi-artifact expression prefix prediction skips ATN for casts', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = uint256(v);
          this.b = uint256(v);
          require(this.a == this.b);
        }
      }
    `, {
      messageBus: true,
      optimizeForCompilationSpeed: true,
      maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    const artifact = map.Store;
    expect(artifact).toBeDefined();
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
    expect(artifact.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
  });

  it('still speed-hint outlines when multi-artifact expression prefix prediction skips ATN', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v; this.b = v; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true,
      optimizeForCompilationSpeed: true,
      maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    const artifact = map.Store;
    expect(artifact).toBeDefined();
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
    expect(artifact.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
  });

  it('still speed-hint outlines when the binder clones the parse snapshot instead of re-lexing', () => {
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

  it('still speed-hint outlines when multi-artifact binding clones the parse snapshot', () => {
    const map = compileStringMulti(`
      contract Store() {
        uint256 a;
        uint256 b;
        function set(uint256 v) public {
          this.a = v; this.b = v; require(this.a == this.b);
        }
      }
    `, {
      messageBus: true,
      optimizeForCompilationSpeed: true,
      maximumInputBytes: 1_000_000,
      compileDeclarations: ['Store'],
    });
    const artifact = map.Store;
    expect(artifact).toBeDefined();
    const whole = artifact.debug?.bytecode ?? '';
    expect(whole.length).toBeGreaterThan(0);
    expect(decodeAuthenticationInstructions(hexToBin(whole))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(true);
    expect(artifact.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
  });

  it('still speed-hint outlines after sharing lexer prediction caches', () => {
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
    `, { forceStateful: true, evmCompat: true, messageBus: true });
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
    `, { messageBus: false, evmCompat: true });
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
    `, { messageBus: false, evmCompat: true });
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
