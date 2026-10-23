import { hexToBin } from '@bitauth/libauth';
import { describe, expect, it, vi } from 'vitest';
import {
  ArrayType, bytecodeToAsm, BytesType, IntType,
  KERNEL_ENTRY_JOURNAL_MAX_SEGMENTS, KERNEL_ENTRY_JOURNAL_RECORD_SEGMENT_PREFIX,
} from '@solidcash/utils';
import { compileString, parseCode } from '../../src/compiler.js';
import { ParameterNode, type FunctionDefinitionNode, type SourceFileNode } from '../../src/ast/AST.js';
import LowerVMapCounterLoops, {
  KERNEL_JOURNAL_ACCESS_STREAMS, KERNEL_JOURNAL_RECORDS,
} from '../../src/semantic/LowerVMapCounterLoops.js';

const OPTIONS = { messageBus: true as const, forceStateful: true, messageBusKernel: true };

const VOID_SOURCE = `
pragma solidcash ^0.14.0;
contract Acc() {
  int x;
  function add(int n) public {
    this.x = this.x + n;
    require(true);
  }
}
`;

const RETURN_SOURCE = `
pragma solidcash ^0.14.0;
contract Acc() {
  int x;
  function add(int n) public {
    this.x = this.x + n;
    require(true);
  }
  function get() public returns (int) {
    return this.x;
  }
}
`;

const TWO_JOURNAL_HANDLER_SOURCE = `
pragma solidcash ^0.14.0;
contract Store() {
  mapping(int => int) values;
  function write(int n, int value) public {
    for (int i = 0; i < n; i = i + 1) { this.values[i] = value; }
    require(true);
  }
  function erase(int n) public {
    for (int i = 0; i < n; i = i + 1) { delete this.values[i]; }
    require(true);
  }
}
`;

const ROUTE_SCALING_FAMILIES = [
  {
    name: 'nested counter-keyed mapping rows',
    source: `
      pragma solidcash ^0.14.0;
      contract NestedStore() {
        mapping(int => mapping(int => int)) values;
        function write(int outer, int count, int value) public {
          for (int cursor = 0; cursor < count; cursor = cursor + 1) {
            this.values[outer][cursor] = value;
          }
          require(true);
        }
      }
    `,
    options: {},
  },
  {
    name: 'typed-call event and result rows',
    source: `
      pragma solidcash ^0.14.0;
      interface Remote { function read(int key) external returns (int); }
      contract Pipeline(Remote remote) {
        event Observed(int value);
        function execute(int key) public returns (int) {
          int value = remote.read(key);
          emit Observed(value);
          return value;
        }
      }
    `,
    options: { messageBusGraphContext: true },
  },
  {
    name: 'rank-dependent associative recurrence rows',
    source: `
      pragma solidcash ^0.14.0;
      contract Product() {
        event Observed(bigint value);
        bigint product;
        uint256 mask;
        function multiply(int limit) public {
          for (int cursor = 1; cursor < limit; cursor = cursor + 2) {
            this.product = this.product * bigint(cursor + 1);
            emit Observed(this.product);
          }
          require(limit >= 1 && limit <= 129);
        }
        function multiplyAffine(int limit, bigint factor) public {
          for (int cursor = 1; cursor < limit; cursor = cursor + 2) {
            factor = factor + 2;
            this.product = this.product * factor;
            emit Observed(this.product);
          }
          require(limit >= 1 && limit <= 129);
        }
        function fold(int limit) public {
          for (int cursor = 1; cursor < limit; cursor = cursor + 2) {
            this.mask = (this.mask ^ uint256(cursor + 1));
            emit Observed(bigint(this.mask));
          }
          require(limit >= 1 && limit <= 129);
        }
      }
    `,
    options: {},
  },
  {
    name: 'source-ordered non-associative recurrence rows',
    source: `
      pragma solidcash ^0.14.0;
      contract Fold() {
        event Number(bigint value);
        event Mask(uint256 value);
        bigint total;
        uint256 mask;
        function divide(int limit) public {
          for (int cursor = 1; cursor < limit; cursor = cursor + 2) {
            this.total = this.total / bigint(cursor + 1);
            emit Number(this.total);
          }
          require(limit >= 1 && limit <= 129);
        }
        function mix(int limit) public {
          for (int cursor = 1; cursor < limit; cursor = cursor + 2) {
            this.mask = (this.mask ^ uint256(cursor + 1));
            this.mask = (this.mask & uint256(cursor + 14));
            this.mask = (this.mask | uint256(cursor));
            emit Mask(this.mask);
          }
          require(limit >= 1 && limit <= 129);
        }
      }
    `,
    options: {},
  },
  {
    name: 'literal-bound source-loop escape rows',
    source: `
      pragma solidcash ^0.14.0;
      contract LiteralDomain() {
        mapping(int => int) values;
        function select(bool skip, bool stop) public {
          int cursor = 0;
          while (cursor < (2 + 3)) {
            if (skip && cursor == 1) { cursor = cursor + 1; continue; }
            this.values[cursor] = cursor + 10;
            if (stop && cursor == 3) break;
            cursor = cursor + 1;
          }
          require(true);
        }
      }
    `,
    options: {},
  },
  {
    name: 'read-only state bounded constructed-key rows',
    source: `
      pragma solidcash ^0.14.0;
      contract StableBound() {
        int limit;
        mapping(int => int) values;
        function fill(int[] memory keys, int base, int stop) internal pure {
          for (int cursor = 0; cursor < stop; cursor = cursor + 1) {
            keys[cursor] = base + cursor;
          }
        }
        function write(int count, int base) public {
          int[] memory keys = new int[](count);
          fill(keys, base, this.limit);
          for (int cursor = 0; cursor < count; cursor = cursor + 1) {
            this.values[keys[cursor]] = cursor;
          }
          require(true);
        }
      }
    `,
    options: {},
  },
  {
    name: 'fixed-array-length bounded constructed-key rows',
    source: `
      pragma solidcash ^0.14.0;
      contract FixedBound() {
        mapping(int => int) values;
        function fill(int[] memory keys, int base, int stop) internal pure {
          for (int cursor = 0; cursor < stop; cursor = cursor + 1) {
            keys[cursor] = base + cursor;
          }
        }
        function write(int count, int base) public {
          int[3] memory domain;
          int[] memory keys = new int[](count);
          fill(keys, base, domain.length);
          for (int cursor = 0; cursor < count; cursor = cursor + 1) {
            this.values[keys[cursor]] = cursor;
          }
          require(true);
        }
      }
    `,
    options: {},
  },
  {
    name: 'exact fixed local key-vector rows',
    source: `
      pragma solidcash ^0.14.0;
      contract FiniteKeys() {
        mapping(int => int) values;
        function write(int count, int base) public {
          int[3] memory keys;
          keys[0] = base;
          keys[1] = base + 2;
          keys[2] = base + 4;
          for (int cursor = 0; cursor < count; cursor = cursor + 1) {
            this.values[keys[cursor]] = cursor;
          }
          require(true);
        }
      }
    `,
    options: {},
  },
  {
    name: 'immutable fixed key-vector alias rows',
    source: `
      pragma solidcash ^0.14.0;
      contract AliasedKeys() {
        mapping(int => int) values;
        function write(int count, int base) public {
          int[3] memory source;
          source[0] = base;
          source[1] = base + 2;
          source[2] = base + 4;
          int[3] memory keys = source;
          for (int cursor = 0; cursor < count; cursor = cursor + 1) {
            this.values[keys[cursor]] = cursor;
          }
          require(true);
        }
      }
    `,
    options: {},
  },
  {
    name: 'pure fixed key-vector producer rows',
    source: `
      pragma solidcash ^0.14.0;
      contract ProducedKeys() {
        mapping(int => int) values;
        function element(int base) internal pure returns (int) { return base + 2; }
        function element(bigint base) internal pure returns (bigint) { return base + 100; }
        function make(int base) internal pure returns (int[3] memory) {
          int[3] memory result;
          result[0] = base;
          result[1] = element(base);
          result[2] = base + 4;
          return result;
        }
        function write(int count, int base) public {
          int[3] memory keys = make(base);
          for (int cursor = 0; cursor < count; cursor = cursor + 1) {
            this.values[keys[cursor]] = cursor;
          }
          require(true);
        }
      }
    `,
    options: {},
  },
  {
    name: 'conditional fixed key-vector rows',
    source: `
      pragma solidcash ^0.14.0;
      contract ConditionalKeys() {
        mapping(int => int) values;
        function write(int count, int base, bool choose) public {
          int[3] memory keys;
          keys[0] = base;
          if (choose) { keys[1] = base + 2; } else { keys[1] = base + 3; }
          keys[2] = base + 4;
          for (int cursor = 0; cursor < count; cursor = cursor + 1) {
            this.values[keys[cursor]] = cursor;
          }
          require(true);
        }
      }
    `,
    options: {},
  },
  {
    name: 'switch fixed key-vector rows',
    source: `
      pragma solidcash ^0.14.0;
      contract SwitchedKeys() {
        mapping(int => int) values;
        function write(int count, int base, int mode) public {
          int[3] memory keys;
          keys[0] = base;
          switch (mode) {
            case 0: keys[1] = base + 2; break;
            case 1: keys[1] = base + 3; break;
            default: keys[1] = base + 5;
          }
          keys[2] = base + 6;
          for (int cursor = 0; cursor < count; cursor = cursor + 1) {
            this.values[keys[cursor]] = cursor;
          }
          require(true);
        }
      }
    `,
    options: {},
  },
  {
    name: 'runtime allocation-length key rows',
    source: `
      pragma solidcash ^0.14.0;
      contract AllocationLengthKeys() {
        mapping(int => int) values;
        function fill(int[] memory keys, int base, int stop) internal pure {
          for (int cursor = 0; cursor < stop; cursor = cursor + 1) {
            keys[cursor] = base + cursor;
          }
        }
        function write(int count, int base, int allocationLength) public {
          int[] memory domain = new int[](allocationLength);
          int[] memory keys = new int[](count);
          fill(keys, base, domain.length);
          for (int cursor = 0; cursor < count; cursor = cursor + 1) {
            this.values[keys[cursor]] = cursor;
          }
          require(true);
        }
      }
    `,
    options: {},
  },
  {
    name: 'straight-line resized allocation-length rows',
    source: `
      pragma solidcash ^0.14.0;
      contract ResizedAllocationLengthKeys() {
        mapping(int => int) values;
        function fill(int[] memory keys, int base, int stop) internal pure {
          for (int cursor = 0; cursor < stop; cursor = cursor + 1) {
            keys[cursor] = base + cursor;
          }
        }
        function write(int count, int base, int allocationLength) public {
          int[] memory domain = new int[](allocationLength);
          domain.push(base + 20);
          domain.push(base + 21);
          domain.pop();
          int[] memory keys = new int[](count);
          fill(keys, base, domain.length);
          for (int cursor = 0; cursor < count; cursor = cursor + 1) {
            this.values[keys[cursor]] = cursor;
          }
          require(true);
        }
      }
    `,
    options: {},
  },
  {
    name: 'exhaustive resize-join allocation-length rows',
    source: `
      pragma solidcash ^0.14.0;
      contract ExhaustiveResizeJoinKeys() {
        mapping(int => int) values;
        function fill(int[] memory keys, int base, int stop) internal pure {
          for (int cursor = 0; cursor < stop; cursor = cursor + 1) {
            keys[cursor] = base + cursor;
          }
        }
        function write(int count, int base, int allocationLength, bool choose) public {
          int[] memory domain = new int[](allocationLength);
          if (choose) {
            domain.push(base + 20);
          } else {
            domain.push(base + 30);
            domain.push(base + 31);
          }
          int[] memory keys = new int[](count);
          fill(keys, base, domain.length);
          for (int cursor = 0; cursor < count; cursor = cursor + 1) {
            this.values[keys[cursor]] = cursor;
          }
          require(true);
        }
      }
    `,
    options: {},
  },
  {
    name: 'exhaustive resize-switch allocation-length rows',
    source: `
      pragma solidcash ^0.14.0;
      contract ExhaustiveResizeSwitchKeys() {
        mapping(int => int) values;
        function fill(int[] memory keys, int base, int stop) internal pure {
          for (int cursor = 0; cursor < stop; cursor = cursor + 1) {
            keys[cursor] = base + cursor;
          }
        }
        function write(int count, int base, int allocationLength, int mode) public {
          int[] memory domain = new int[](allocationLength);
          switch (mode) {
            case 0: domain.push(base + 20); break;
            case 1: domain.push(base + 30); domain.push(base + 31); break;
            default: domain.push(base + 40); domain.push(base + 41); domain.pop();
          }
          int[] memory keys = new int[](count);
          fill(keys, base, domain.length);
          for (int cursor = 0; cursor < count; cursor = cursor + 1) {
            this.values[keys[cursor]] = cursor;
          }
          require(true);
        }
      }
    `,
    options: {},
  },
  {
    name: 'fixed source-loop resized allocation-length rows',
    source: `
      pragma solidcash ^0.14.0;
      contract FixedLoopResizeKeys() {
        mapping(int => int) values;
        function fill(int[] memory keys, int base, int stop) internal pure {
          for (int cursor = 0; cursor < stop; cursor = cursor + 1) {
            keys[cursor] = base + cursor;
          }
        }
        function write(int count, int base, int allocationLength) public {
          int[] memory domain = new int[](allocationLength);
          for (int round = 0; round < 3; round = round + 1) {
            domain.push(base + round);
            domain.push(base + 10 + round);
            domain.pop();
          }
          int[] memory keys = new int[](count);
          fill(keys, base, domain.length);
          for (int cursor = 0; cursor < count; cursor = cursor + 1) {
            this.values[keys[cursor]] = cursor;
          }
          require(true);
        }
      }
    `,
    options: {},
  },
] as const;

const routeAsm = (artifact: ReturnType<typeof compileString>): string => {
  const body = artifact.functionBodies?.['53434231'];
  expect(body).toBeDefined();
  return bytecodeToAsm(Uint8Array.from(Buffer.from(body!, 'hex')));
};

const selectorPushCount = (asm: string, selectorHex: string): number => {
  const needle = selectorHex.toLowerCase();
  let count = 0;
  let from = 0;
  const haystack = asm.replace(/\s+/g, '').toLowerCase();
  while (from < haystack.length) {
    const at = haystack.indexOf(needle, from);
    if (at < 0) break;
    count += 1;
    from = at + needle.length;
  }
  return count;
};

const contextPropagatedFunctions = (
  source: string, leaves: Record<string, string[]>,
): Map<string, FunctionDefinitionNode> => {
  const ast = parseCode(source) as SourceFileNode;
  for (const [name, parameters] of Object.entries(leaves)) {
    const fn = ast.contract.functions.find((candidate) => candidate.name === name)!;
    for (const parameter of parameters) {
      const type = parameter === KERNEL_JOURNAL_ACCESS_STREAMS || parameter === KERNEL_JOURNAL_RECORDS
        ? new ArrayType(new BytesType()) : new IntType(true, 256);
      fn.parameters.push(new ParameterNode(type, parameter));
    }
  }
  new LowerVMapCounterLoops(true).propagateKernelJournalContext(ast.contract);
  return new Map(ast.contract.functions.map((fn) => [fn.name, fn]));
};

const journalContextNames = (fn: FunctionDefinitionNode): string[] => fn.parameters
  .map((parameter) => parameter.name)
  .filter((name) => name.startsWith('__internal__vmap')
    || name === KERNEL_JOURNAL_ACCESS_STREAMS || name === KERNEL_JOURNAL_RECORDS);

describe('message-bus kernel loop route', () => {
  it('copies the typed value rather than the enclosing carrier into an inline chunkable entry tail', () => {
    const artifact = compileString(`
      pragma solidcash ^0.14.0;
      contract Store() {
        struct Pair { int left; int right; }
        mapping(int => Pair) values;
        function set(int key, int left, int right) public {
          this.values[key] = Pair(left, right);
          require(true);
        }
        function control() public { require(true); }
      }
    `, { ...OPTIONS, maximumInputBytes: 100_000 });
    const helperBodies = Object.values(artifact.debug?.invokeDebug ?? {})
      .map(({ bytecode }) => bytecodeToAsm(hexToBin(bytecode)));
    // At OP_ELSE the condition has been consumed, leaving [value, length, length4]. The value is depth two;
    // depth three would copy the handler's next-lower item (the kernel journal carrier) into the stored tail.
    expect(helperBodies).toContain(
      'OP_SIZE OP_DUP OP_4 OP_NUM2BIN OP_OVER 3c OP_GREATERTHAN OP_IF OP_2 OP_PICK OP_SHA256 '
      + 'OP_3 OP_PICK 1c OP_SPLIT OP_DROP OP_CAT OP_ELSE OP_2 OP_PICK OP_ENDIF OP_CAT OP_NIP OP_SWAP OP_DROP',
    );
  });

  it('dispatches a void handler from one row loop rather than unrolled rowCount bands', () => {
    const artifact = compileString(VOID_SOURCE, OPTIONS);
    expect(artifact.messageBus).toBeDefined();
    expect(artifact.compiler.options?.messageBusKernel).toBe(true);
    expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(artifact.messageBus?.available).toBe(true);
    expect(artifact.messageBus?.maximumRows).toBeGreaterThanOrEqual(2);
    const add = artifact.messageBus?.handlers.find((handler) => handler.name === 'add');
    expect(add?.eligible).toBe(true);
    expect(add?.selector).toMatch(/^[0-9a-f]{8}$/);
    const asm = routeAsm(artifact);
    expect(asm).toMatch(/OP_UNTIL|OP_BEGIN/);
    expect(selectorPushCount(asm, add!.selector)).toBe(1);
    expect(artifact.debug.bytecode.length / 2).toBeLessThan(8_000);
  });

  it('captures returning scalar results inside the same runtime loop', () => {
    const artifact = compileString(RETURN_SOURCE, OPTIONS);
    expect(artifact.messageBus).toBeDefined();
    const get = artifact.messageBus?.handlers.find((handler) => handler.name === 'get');
    const add = artifact.messageBus?.handlers.find((handler) => handler.name === 'add');
    expect(get?.eligible).toBe(true);
    expect(add?.eligible).toBe(true);
    expect(get?.outputs?.some((output) => output.type.includes('int'))).toBe(true);
    const asm = routeAsm(artifact);
    expect(asm).toMatch(/OP_UNTIL|OP_BEGIN/);
    expect(selectorPushCount(asm, get!.selector)).toBe(1);
    expect(selectorPushCount(asm, add!.selector)).toBe(1);
    expect(artifact.debug.bytecode.length / 2).toBeLessThan(12_000);
  });

  it('keeps the unknown-selector revert on the loop route', () => {
    const artifact = compileString(RETURN_SOURCE, OPTIONS);
    const asm = routeAsm(artifact);
    // `revert("unknown batch selector")` lowers to a failing OP_0 OP_VERIFY on the dispatch else arm.
    expect(asm.toLowerCase()).toMatch(/op_else op_0 op_verify/);
  });

  it('publishes maximumRows as a runtime bound, not an AST copy count', () => {
    const artifact = compileString(RETURN_SOURCE, OPTIONS);
    expect(artifact.messageBus?.maximumRows).toBeGreaterThanOrEqual(2);
    expect(artifact.messageBus?.route.inputs.some((input) => input.name === 'batchBlob')).toBe(true);
    expect(artifact.messageBus?.route.inputs.some((input) => /_r\d+$/.test(input.name))).toBe(false);
  });

  it('keeps kernel route size independent of the configured row ceiling', () => {
    const compileAt = (messageBusKernel: boolean, maximumRows: number): ReturnType<typeof compileString> =>
      compileString(RETURN_SOURCE, {
        ...OPTIONS,
        messageBusKernel,
        __messageBusMaximumRows: maximumRows,
      } as Parameters<typeof compileString>[1]);
    const kernelTwo = compileAt(true, 2);
    const kernelEight = compileAt(true, 8);
    const legacyTwo = compileAt(false, 2);
    const legacyEight = compileAt(false, 8);

    for (const [artifact, maximumRows] of [
      [kernelTwo, 2], [kernelEight, 8], [legacyTwo, 2], [legacyEight, 8],
    ] as const) {
      expect(artifact.messageBus?.maximumRows).toBe(maximumRows);
    }
    expect(kernelTwo.messageBus?.convention).toBe('kernel-row-loop');
    expect(kernelEight.messageBus?.convention).toBe('kernel-row-loop');
    expect(legacyTwo.messageBus?.convention).toBe('legacy-unroll');
    expect(legacyEight.messageBus?.convention).toBe('legacy-unroll');
    const routeBytes = (artifact: ReturnType<typeof compileString>): number =>
      artifact.functionBodies!['53434231'].length / 2;
    const kernelGrowth = Math.abs(routeBytes(kernelEight) - routeBytes(kernelTwo));
    const legacyGrowth = routeBytes(legacyEight) - routeBytes(legacyTwo);
    // The kernel checks one runtime bound and executes one row body. The legacy route emits another physical
    // dispatch band for every admitted row, so this neutral scalar handler provides the direct control.
    expect(kernelGrowth).toBeLessThan(64);
    expect(legacyGrowth).toBeGreaterThan(400);
  });

  // Three kernel compiles per family (ceilings 2, 4, 8). The slowest, the source-ordered non-associative rows,
  // measured 69 s alone (about 23 s a compile), past the 60 s default; 150 s leaves about 2x for suite load.
  it.each(ROUTE_SCALING_FAMILIES)(
    'keeps $name proportional to row logic rather than the configured row ceiling',
    ({ source, options }) => {
      const compileAt = (messageBusKernel: boolean, maximumRows: number): ReturnType<typeof compileString> =>
        compileString(source, {
          ...OPTIONS,
          ...options,
          messageBusKernel,
          __messageBusMaximumRows: maximumRows,
          maximumInputBytes: 1_000_000,
          suppressWarnings: true,
        } as Parameters<typeof compileString>[1]);
      const ceilings = [2, 4, 8] as const;
      const kernel = ceilings.map((maximumRows) => compileAt(true, maximumRows));
      const routeBytes = (artifact: ReturnType<typeof compileString>): number =>
        artifact.functionBodies!['53434231'].length / 2;

      expect(kernel.map((artifact) => artifact.messageBus?.maximumRows)).toEqual(ceilings);
      expect(kernel.every((artifact) => artifact.messageBus?.convention === 'kernel-row-loop')).toBe(true);
      expect(kernel.every((artifact) => artifact.messageBus?.handlers.some((handler) => handler.eligible))).toBe(true);

      const kernelSizes = kernel.map(routeBytes);
      // Graph-result/effect helpers can cross a small outlining threshold when the encoded ceiling changes, but
      // the row body is still emitted once. Keep the allowance far below the hundreds of bytes per legacy row.
      expect(Math.max(...kernelSizes) - Math.min(...kernelSizes)).toBeLessThan(128);

      // Full artifact size is intentionally not the route-scaling oracle: outlined handler logic is published
      // once outside the SCB1 dispatcher. Assert only that it remains deterministic for each compiled ceiling.
      expect(kernel.map((artifact) => artifact.debug.bytecode.length / 2).every(Number.isSafeInteger)).toBe(true);
    },
    150_000,
  );

  it('dispatches event-emitting handlers from the runtime row loop without a new clone family', () => {
    const artifact = compileString(`
pragma solidcash ^0.14.0;
contract Acc() {
  event Ping(int n);
  int x;
  function ping(int n) public {
    emit Ping(n);
    require(true);
  }
}
`, OPTIONS);
    const ping = artifact.messageBus?.handlers.find((handler) => handler.name === 'ping');
    expect(ping?.eligible).toBe(true);
    expect(artifact.abi.some((fn) => /^__message_bus_(graph|array|resource)_/.test(fn.name))).toBe(false);
    expect(artifact.invocationAnalysis?.functions.some((fn) =>
      /^__message_bus_(graph|array|resource)_/.test(fn.name))).toBe(false);
    const asm = routeAsm(artifact);
    expect(asm).toMatch(/OP_UNTIL|OP_BEGIN/);
    expect(selectorPushCount(asm, ping!.selector)).toBe(1);
    expect(artifact.messageBus?.route.inputs.some((input) => /_r\d+$/.test(input.name))).toBe(false);
  });

  it('journals a reusable scalar helper as one OP_INVOKE body on the kernel route', () => {
    const artifact = compileString(`
pragma solidcash ^0.14.0;
contract Acc() {
  int x;
  function bump(int n) internal { this.x = ((this.x + n) * 3 - n) / 2; }
  function add(int a, int b, int c) public {
    bump(a);
    bump(b);
    bump(c);
    require(a >= 0);
  }
}
`, OPTIONS);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'add')?.eligible).toBe(true);
    expect(artifact.abi.some((fn) => /^__message_bus_(graph|array|resource)_/.test(fn.name))).toBe(false);
    expect(artifact.invocationAnalysis?.functions.some((fn) =>
      /^__message_bus_(graph|array|resource)_/.test(fn.name))).toBe(false);
    const bump = artifact.invocationAnalysis?.functions.find((fn) => fn.name === 'bump');
    expect(bump).toBeDefined();
    expect(artifact.invocationAnalysis?.functions.find((fn) => fn.name === 'add')?.calls)
      .toContain(bump?.id);
    const asm = routeAsm(artifact);
    expect(asm).toMatch(/OP_UNTIL|OP_BEGIN/);
    const add = artifact.messageBus?.handlers.find((handler) => handler.name === 'add');
    expect(selectorPushCount(asm, add!.selector)).toBe(1);
    const addAsm = bytecodeToAsm(hexToBin(artifact.functionBodies![add!.selector]));
    // bump is function id 0 (first declared). Three call sites share one defined body.
    expect([...addAsm.replace(/\s+/g, ' ').matchAll(/OP_0 OP_INVOKE/g)]).toHaveLength(3);
  });

  it('keeps a reference-typed graph handler behind one body-independent OP_INVOKE boundary', () => {
    const source = (arithmeticSteps: number): string => `
      interface Remote {
        function read(int key) external returns (int);
        function write(int value) external;
      }
      contract Pipeline(Remote remote) {
        int total;
        function process(int[] memory keys) public {
          for (int cursor = 0; cursor < keys.length; cursor = cursor + 1) {
            int value = remote.read(keys[cursor]);
            ${Array.from({ length: arithmeticSteps }, (_, index) =>
    `value = (value + ${index + 1}) * 2 - ${index + 1};`).join('\n')}
            remote.write(value);
            this.total = value;
          }
          require(true);
        }
      }
    `;
    const compile = (steps: number): ReturnType<typeof compileString> => compileString(source(steps), {
      ...OPTIONS,
      messageBusGraphContext: true,
      maximumInputBytes: 1_000_000,
      suppressWarnings: true,
    });
    const small = compile(4);
    const large = compile(64);

    for (const artifact of [small, large]) {
      expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'process'))
        .toMatchObject({ eligible: true });
      const functions = artifact.invocationAnalysis?.functions ?? [];
      const route = functions.find((fn) => fn.name === '__message_bus1');
      const handler = functions.find((fn) => fn.name === '__message_bus_handler_process');
      expect(handler).toBeDefined();
      expect(route?.calls).toContain(handler!.id);
      expect(route?.calls.filter((id) => id === handler!.id)).toHaveLength(1);
    }

    const smallRouteBytes = small.functionBodies!['53434231'].length / 2;
    const largeRouteBytes = large.functionBodies!['53434231'].length / 2;
    const routeGrowth = Math.abs(largeRouteBytes - smallRouteBytes);
    const emittedGrowth = large.debug.bytecode.length / 2 - small.debug.bytecode.length / 2;
    // Optimizer thresholds may slightly reshape the dispatcher, but sixty additional typed arithmetic steps
    // belong to the handler body and must not scale the route. This catches any transform which substitutes the
    // compiler-owned handler body into its row-loop call site while tolerating ordinary outline decisions.
    expect(emittedGrowth).toBeGreaterThan(400);
    expect(routeGrowth).toBeLessThan(128);
  });

  it('threads one route-owned record carrier through each direct journal-aware handler', () => {
    const artifact = compileString(TWO_JOURNAL_HANDLER_SOURCE, OPTIONS);
    const write = artifact.messageBus?.handlers.find((handler) => handler.name === 'write');
    const erase = artifact.messageBus?.handlers.find((handler) => handler.name === 'erase');
    expect(write).toMatchObject({ eligible: true });
    expect(erase).toMatchObject({ eligible: true });

    const records = artifact.messageBus?.route.inputs.filter(
      (input) => input.name.startsWith(KERNEL_ENTRY_JOURNAL_RECORD_SEGMENT_PREFIX),
    );
    expect(records).toHaveLength(KERNEL_ENTRY_JOURNAL_MAX_SEGMENTS);
    expect(records?.map((input) => input.name)).toEqual(Array.from(
      { length: KERNEL_ENTRY_JOURNAL_MAX_SEGMENTS },
      (_unused, index) => `${KERNEL_ENTRY_JOURNAL_RECORD_SEGMENT_PREFIX}${index}`,
    ));
    expect(records?.every((input) => input.type === 'bytes')).toBe(true);
    const routeByteLength = artifact.bytecode.length / 2;
    // Retain at least 300 bytes below the 10,000-byte limit as journal helpers evolve.
    expect(routeByteLength, `segmented route bytecode is ${routeByteLength} bytes`).toBeLessThan(9_700);

    // The route retains the unchanged per-row path, while a changed carrier enters the covenant-verified final
    // commitment flush and an exact address-cardinality scan.
    const asm = routeAsm(artifact);
    expect(asm).toContain('OP_OUTPUTTOKENCOMMITMENT');
    expect(asm).toContain('OP_TXOUTPUTCOUNT');
    expect(selectorPushCount(asm, write!.selector)).toBe(1);
    expect(selectorPushCount(asm, erase!.selector)).toBe(1);
  });

  it('publishes one transaction-wide final flush for general scalar set and add rows', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const artifact = compileString(`
      pragma solidcash ^0.14.0;
      contract Store() {
        mapping(int => int) values;
        function setRows(int[] keys, int value) public {
          for (int i = 0; i < keys.length; i = i + 1) { this.values[keys[i]] = value; }
          require(true);
        }
        function addRows(int[] keys, int value) public {
          for (int i = 0; i < keys.length; i = i + 1) {
            this.values[keys[i]] = this.values[keys[i]] + value;
          }
          require(true);
        }
      }
    `, OPTIONS);
    expect(warn.mock.calls.flat().join(' ')).not.toContain('input-script limit');
    warn.mockRestore();
    expect(artifact.diagnostics?.some((diagnostic) => diagnostic.code === 'contract-size-limit')).not.toBe(true);
    expect(artifact.messageBus?.handlers.filter((handler) =>
      handler.name === 'setRows' || handler.name === 'addRows'))
      .toEqual([expect.objectContaining({ eligible: true }), expect.objectContaining({ eligible: true })]);
    expect(artifact.messageBus?.route.inputs.filter((input) =>
      input.name.startsWith(KERNEL_ENTRY_JOURNAL_RECORD_SEGMENT_PREFIX)))
      .toHaveLength(KERNEL_ENTRY_JOURNAL_MAX_SEGMENTS);
    const asm = routeAsm(artifact);
    expect(asm).toContain('OP_OUTPUTTOKENCOMMITMENT');
    expect(asm).toContain('OP_TXOUTPUTCOUNT');
  });

  it('keeps first-touch record ordinals separate from dense materialized output ordinals', () => {
    const artifact = compileString(`
      pragma solidcash ^0.14.0;
      contract Store() {
        mapping(int => int) source;
        mapping(int => int) destination;
        function copy(int n) public {
          for (int i = 0; i < n; i = i + 1) { this.destination[i] = this.source[i]; }
          require(true);
        }
        function write(int n, int value) public {
          for (int i = 0; i < n; i = i + 1) { this.destination[i] = value; }
          require(true);
        }
      }
    `, { ...OPTIONS, maximumInputBytes: 1_000_000 });
    // The authenticated carrier route keeps first-touch record identity separate from dense output rank.
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'copy'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write')?.eligible).toBe(true);

    const asm = routeAsm(artifact);
    // Clean authenticated, dirty authenticated, and dirty synthetic records materialize.
    // Clean synthetic absence consumes a first-touch record ordinal but skips the output and dense cursor increment.
    // The optimizer may outline the first clean-header comparison, so inspect all emitted bodies for that marker.
    const emittedAsm = [asm, ...Object.values(artifact.debug?.invokeDebug ?? {})
      .map(({ bytecode }) => bytecodeToAsm(hexToBin(bytecode)))].join(' ');
    expect(emittedAsm).toContain('0501');
    expect(asm).toContain(
      'OP_OVER 0503 OP_EQUAL OP_BOOLOR OP_OVER 050a OP_EQUAL OP_BOOLOR '
      + 'OP_OVER 0511 OP_EQUAL OP_BOOLOR OP_IF',
    );
    expect(asm).toMatch(
      /OP_2DROP OP_2DROP OP_TOALTSTACK OP_1ADD OP_FROMALTSTACK OP_ELSE 050c OP_EQUALVERIFY OP_DROP OP_ENDIF/,
    );
  });

  it('propagates the journal context through direct and one-level internal calls', () => {
    const functions = contextPropagatedFunctions(`
      pragma solidcash ^0.14.0;
      contract Store() {
        mapping(int => int) values;
        function leaf(int n) internal {
          for (int i = 0; i < n; i = i + 1) { this.values[i] = n; }
          require(true);
        }
        function outer(int n) public { leaf(n); require(true); }
      }
    `, { leaf: [
      '__internal__vmapRuntimeInputCount_values', '__internal__vmapRuntimeOutputCount_values',
      KERNEL_JOURNAL_ACCESS_STREAMS, KERNEL_JOURNAL_RECORDS,
    ] });
    const leaf = journalContextNames(functions.get('leaf')!);
    const outer = journalContextNames(functions.get('outer')!);
    expect(leaf).toContain(KERNEL_JOURNAL_RECORDS);
    expect(outer).toEqual(leaf);
  });

  it('reaches a fixed point through two returning helper levels', () => {
    const source = `
      pragma solidcash ^0.14.0;
      contract Store() {
        mapping(int => int) values;
        function leaf(int n) internal returns (int) {
          for (int i = 0; i < n; i = i + 1) { this.values[i] = n; }
          return n + 1;
        }
        function middle(int n) internal returns (int) { return leaf(n); }
        function outer(int n) public { int result = middle(n); require(result > n); }
      }
    `;
    const functions = contextPropagatedFunctions(source, { leaf: [
      '__internal__vmapRuntimeInputCount_values', '__internal__vmapRuntimeOutputCount_values',
      KERNEL_JOURNAL_ACCESS_STREAMS, KERNEL_JOURNAL_RECORDS,
    ] });
    const leaf = journalContextNames(functions.get('leaf')!);
    expect(journalContextNames(functions.get('middle')!)).toEqual(leaf);
    expect(journalContextNames(functions.get('outer')!)).toEqual(leaf);

    const attemptFailureBox = { failures: [] };
    const artifact = compileString(source, {
      ...OPTIONS, maximumInputBytes: 100_000, __artifactCache: false, __attemptFailureBox: attemptFailureBox,
    } as Parameters<typeof compileString>[1]);
    expect(attemptFailureBox.failures).toEqual([]);
    expect(artifact.messageBus).toBeDefined();
    expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'outer'))
      .toMatchObject({ eligible: true });
    expect(routeAsm(artifact)).toContain('OP_INVOKE');
    expect(artifact.abi.find((entry) => entry.name === 'outer')?.inputs.map((input) => input.name))
      .toEqual(['n']);
  });

  it('unions mixed collection cardinalities while keeping one record carrier', () => {
    const functions = contextPropagatedFunctions(`
      pragma solidcash ^0.14.0;
      contract Store() {
        mapping(int => int) left;
        mapping(int => int) right;
        function writeLeft(int n) internal {
          for (int i = 0; i < n; i = i + 1) { this.left[i] = n; }
          require(true);
        }
        function writeRight(int n) internal {
          for (int i = 0; i < n; i = i + 1) { this.right[i] = n; }
          require(true);
        }
        function outer(int n) public { writeLeft(n); writeRight(n); require(true); }
      }
    `, {
      writeLeft: [
        '__internal__vmapRuntimeInputCount_left', '__internal__vmapRuntimeOutputCount_left',
        KERNEL_JOURNAL_ACCESS_STREAMS, KERNEL_JOURNAL_RECORDS,
      ],
      writeRight: [
        '__internal__vmapRuntimeInputCount_right', '__internal__vmapRuntimeOutputCount_right',
        KERNEL_JOURNAL_ACCESS_STREAMS, KERNEL_JOURNAL_RECORDS,
      ],
    });
    const outer = journalContextNames(functions.get('outer')!);
    expect(outer.filter((name) => name === KERNEL_JOURNAL_RECORDS)).toHaveLength(1);
    expect(outer.filter((name) => name === KERNEL_JOURNAL_ACCESS_STREAMS)).toHaveLength(1);
    expect(outer).toEqual(expect.arrayContaining([
      '__internal__vmapRuntimeInputCount_left', '__internal__vmapRuntimeOutputCount_left',
      '__internal__vmapRuntimeInputCount_right', '__internal__vmapRuntimeOutputCount_right',
    ]));
  });

  it('fails closed when an unresolved function pointer could enter the journal context ABI', () => {
    const artifact = compileString(`
      pragma solidcash ^0.14.0;
      contract Store() {
        mapping(int => int) values;
        function leaf(int n) internal {
          for (int i = 0; i < n; i = i + 1) { this.values[i] = n; }
          require(true);
        }
        function indirect(int n) public {
          function(int) internal target = leaf;
          target(n);
          require(true);
        }
        function control() public { require(true); }
      }
    `, { ...OPTIONS, maximumInputBytes: 100_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'indirect'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
  });
});
