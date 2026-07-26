import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';

const SOURCE = `pragma solidcash >=0.8.0;
contract Analysis() {
  int x;
  mapping(int => int) balances;
  function leaf(int k) internal { this.x = this.x + k; }
  function left(int k) internal { leaf(k); right(k); }
  function right(int k) internal { if (k > 0) left(k - 1); }
  function run(int k) { left(k); require(k >= 0); }
  function readBalance(int k) view { require(balances[k] >= 0); }
  function flat() { this.x = 1; require(this.x == 1); }
}`;

describe('Release 0 shared invocation analysis', () => {
  it('emits deterministic closures, SCCs, and state footprints without changing bytecode', () => {
    const first = compileString(SOURCE, { forceStateful: true });
    const second = compileString(SOURCE, { forceStateful: true });
    expect(first.bytecode).toBe(second.bytecode);
    expect(first.invocationAnalysis).toEqual(second.invocationAnalysis);

    const analysis = first.invocationAnalysis!;
    expect(analysis.version).toBe(1);
    const run = analysis.functions.find((fn) => fn.name === 'run')!;
    const flat = analysis.functions.find((fn) => fn.name === 'flat')!;
    expect(run.recursive).toBe(true);
    expect(run.closure.length).toBeGreaterThan(2);
    expect(run.reads).toContain('state:x');
    expect(run.writes).toContain('state:x');
    expect(analysis.functions.find((fn) => fn.name === 'readBalance')?.reads)
      .toContain('collection:balances:*');
    expect(flat.recursive).toBe(false);
    expect(analysis.components.some((component) => component.recursive
      && component.functions.length === 2)).toBe(true);
  });

  it('emits the complete compiler-resolved graph footprint per callsite', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      interface ITarget {
        public bigint counter;
        function step(bigint n) returns (bigint, bool);
      }
      contract GraphSummary(address target) {
        string note;
        event Seen(bigint value);
        function run(bigint n, bytes recipient) public returns (bigint, bool) {
          bigint value, bool ok = ITarget(target).step(n);
          bigint settled = ITarget(target).outState.counter;
          this.note = "done";
          this.transfer(recipient, n);
          emit Seen(settled);
          require(ok);
          return (value, ok);
        }
      }`, { forceStateful: true });
    const abi = artifact.abi.find((fn) => fn.name === 'run')!;
    const summary = artifact.invocationAnalysis!.functions.find((fn) => fn.name === 'run')!;
    expect(summary.externalCalls).toEqual(abi.externalCalls);
    expect(summary.externalOutStateReads).toEqual(abi.externalOutStateReads);
    expect(summary.emits).toEqual(abi.emits);
    expect(summary.transferCount).toBe(abi.transferCount);
    expect(summary.transfers).toEqual([{
      transferIndex: 0,
      recipient: { kind: 'forward', paramIndex: 1 },
      amount: { kind: 'forward', paramIndex: 0 },
    }]);
    expect(summary.transfers).toEqual(abi.transfers);
    expect(summary.dynamicWrites).toEqual(abi.dynamicWrites);
    expect(summary.blockLayout).toEqual(abi.blockLayout);
    expect(summary.externalCalls?.[0]).toMatchObject({
      callsiteId: 0,
      occurrence: 'once',
      interfaceName: 'ITarget',
      functionName: 'step',
      hasReturnValues: true,
      returnTypes: ['bigint', 'bool'],
      argSources: [{ kind: 'forward', paramIndex: 0 }],
    });
  });

  it('classifies callsite occurrence without treating control-dependent rows as unconditional', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      interface ITarget { function step(bigint n); }
      contract Occurrences() {
        function once(address target, bigint n) public {
          ITarget(target).step(n);
          require(true);
        }
        function maybe(address target, bigint n, bool take) public {
          if (take) { ITarget(target).step(n); }
          require(true);
        }
        function repeated(address target, bigint n, bigint count) public {
          for (bigint i = 0; i < count; i = i + 1) { ITarget(target).step(n); }
          require(count >= 0);
        }
      }`, { forceStateful: true });
    const occurrence = (name: string) => artifact.invocationAnalysis!.functions
      .find((fn) => fn.name === name)!.externalCalls![0].occurrence;
    expect(occurrence('once')).toBe('once');
    expect(occurrence('maybe')).toBe('conditional');
    expect(occurrence('repeated')).toBe('loop');
  });
});
