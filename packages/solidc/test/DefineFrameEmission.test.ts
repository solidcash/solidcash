import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import { compileString } from '../src/compiler.js';
import {
  clearDefineFrameValidations,
  getDefineFrameValidations,
  validateDefineEmission,
} from '../src/define-frame-validation.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  suppressWarnings: true,
} as const;

describe('DEFINE frame emission (item 3 real path)', () => {
  it('compileString drives validateDefineEmission via GTT emitFunctionDefine', () => {
    clearDefineFrameValidations();
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract Store() {
        mapping(int => int) data;
        function set(int k, int v) public {
          this.data[k] = v;
          require(true);
        }
      }`, KERNEL);
    expect(artifact.messageBus?.available).toBe(true);
    const records = getDefineFrameValidations();
    expect(records.length).toBeGreaterThan(0);
    expect(records.some((record) => record.schema.handlerId.length > 0)).toBe(true);
    // Every DEFINE — user and compiler-internal — validates under kernel.
    expect(records.every((record) => record.result.ok)).toBe(true);
    // DEFINE helper-effect recording: per-arg helper effects recorded inside DEFINE bodies
    // (source `set` lowers to `__message_bus_entry_set` under kernel).
    const entrySet = records.find((record) => record.handlerName === '__message_bus_entry_set');
    expect(entrySet?.effects.some((effect) => effect.helperId.endsWith(':arg:k'))).toBe(true);
    expect(entrySet?.effects.some((effect) => effect.helperId.endsWith(':arg:v'))).toBe(true);
    expect(entrySet?.effects.some((effect) => effect.helperId.includes(':band:'))).toBe(true);
  });

  it('validateDefineEmission fail-closes on injected anonymous live cells', () => {
    const result = validateDefineEmission({
      handlerId: 'h-bad',
      handlerName: 'bad',
      parameters: [{ name: 'x' }],
      anonymousLive: 2,
      altStackDepth: 0,
    });
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.invariantId === 'live-anonymous-at-settlement')).toBe(true);
  });

  it('Kernel fail-closes all DEFINE kinds (void, returning, __ internals)', () => {
    clearDefineFrameValidations();
    compileString(`pragma solidcash >=0.8.0;
      contract Dual() {
        int x;
        function set(int v) public { this.x = v; require(true); }
        function bump() public { this.x = this.x + 1; require(true); }
      }`, KERNEL);
    const dualRecords = getDefineFrameValidations();
    expect(dualRecords.length).toBeGreaterThan(0);
    expect(dualRecords.every((record) => record.result.ok)).toBe(true);
    expect(dualRecords.some((record) => record.handlerName.startsWith('__message_bus_'))).toBe(true);

    clearDefineFrameValidations();
    const returning = compileString(`pragma solidcash >=0.8.0;
      contract View() {
        function read(int value) public pure returns (int) { return value + 7; }
        function twin(int a, int b) public pure returns (int, int) { return (a + 1, b + 2); }
      }`, { ...KERNEL, solidityImportCompat: false });
    expect(returning.messageBus?.route?.blockLayout).toBeDefined();
    const returningRecords = getDefineFrameValidations();
    expect(returningRecords.filter((record) => (
      record.handlerName === 'read' || record.handlerName === 'twin'
    )).every((record) => record.result.ok)).toBe(true);
    expect(returningRecords.filter((record) => record.handlerName.startsWith('__'))
      .every((record) => record.result.ok)).toBe(true);

    const here = dirname(fileURLToPath(import.meta.url));
    const gtt = readFileSync(
      join(here, '../src/generation/GenerateTargetTraversal.ts'),
      'utf8',
    );
    expect(gtt).toContain('returnArity');
    expect(gtt).toContain('Math.max(0, leftover.length - returnArity)');
    expect(gtt).not.toContain('softReturningFalsePositive');
    expect(gtt).not.toContain('isCompilerInternal');
  });

  it('Soft-__ residual is zero across common kernel shapes', () => {
    const sources: Array<[string, string]> = [
      ['scalar', `pragma solidcash >=0.8.0; contract C() { int x; function set(int v) public { this.x = v; require(true); } }`],
      ['view', `pragma solidcash >=0.8.0; contract C() { function read(int v) public pure returns (int) { return v + 1; } }`],
      ['mapping', `pragma solidcash >=0.8.0; contract C() { mapping(int => int) data; function set(int k, int v) public { this.data[k] = v; require(true); } }`],
      ['event', `pragma solidcash >=0.8.0; contract C() { int x; event E(int v); function set(int v) public { this.x = v; emit E(v); require(true); } }`],
      ['bytes', `pragma solidcash >=0.8.0; contract C() { bytes payload; function set(bytes v) public { this.payload = v; require(true); } }`],
      ['counterEmit', `pragma solidcash >=0.8.0; contract Acc() { int counter; event Ping(int v); function initialize() public { this.counter = 0; } function ping(int value) public { emit Ping(value); this.counter = this.counter + 1; require(true); } }`],
    ];
    for (const [, src] of sources) {
      clearDefineFrameValidations();
      compileString(src, { ...KERNEL, solidityImportCompat: false, maximumInputBytes: 1_000_000 });
      const soft = getDefineFrameValidations().filter(
        (record) => record.handlerName.startsWith('__') && !record.result.ok,
      );
      expect(soft).toEqual([]);
    }
  });
});
