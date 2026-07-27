import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';
import { PointerTableBoundError } from '../src/semantic/PointerTableBound.js';

// Message-bus compilation is several seconds per contract; the default 5s budget is not enough under the
// parallel-file load the solidc project runs with.
const COMPILE_TIMEOUT_MS = 60_000;

const busOptions = {
  forceStateful: true,
  experimentalHiddenBatch: true,
  experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
  experimentalMessageBusControllerCategory: '22'.repeat(32),
};

const table = (body: string): string => `pragma solidcash >=0.8.0;
interface IH { function inc(uint value); function dec(uint value); }
contract BoundedTable() {
  function(uint) external[] handlers;
  function registerInc(address target) public { this.handlers.push(IH(target).inc); require(true); }
  function registerDec(address target) public { this.handlers.push(IH(target).dec); require(true); }
${body}
}`;

const runtimeSized = table(`  function fireAll(uint value) public {
    require(handlers.length <= 3);
    for (int i = 0; i < handlers.length; i = i + 1) { handlers[i](value); }
    require(value >= 0);
  }`);

describe('message-bus pointer-table bound', () => {
  it('publishes the proven ceiling as one bounded loop callsite', () => {
    const artifact = compileString(runtimeSized, busOptions);
    const summary = artifact.invocationAnalysis!.functions.find((fn) => fn.name === 'fireAll')!;
    expect(summary.bounded).toBe(true);
    expect(summary.maximumDirectInvocations).toBe(3);
    expect(summary.externalCalls).toHaveLength(1);
    expect(summary.externalCalls![0]).toMatchObject({ occurrence: 'loop', maximumOccurrences: 3 });
  }, COMPILE_TIMEOUT_MS);

  it('proves a bound from a parameter guard as well as from a table-length guard', () => {
    const artifact = compileString(table(`  function fireN(uint value, int n) public {
    require(n <= 2);
    for (int i = 0; i < n; i = i + 1) { handlers[i](value); }
    require(value >= 0);
  }`), busOptions);
    const summary = artifact.invocationAnalysis!.functions.find((fn) => fn.name === 'fireN')!;
    expect(summary.externalCalls![0]).toMatchObject({ occurrence: 'loop', maximumOccurrences: 2 });
  }, COMPILE_TIMEOUT_MS);

  it('keeps a fixed literal trip count exact', () => {
    const artifact = compileString(table(`  function fireAll(uint value) public {
    for (int i = 0; i < 2; i = i + 1) { handlers[i](value); }
    require(value >= 0);
  }`), busOptions);
    const summary = artifact.invocationAnalysis!.functions.find((fn) => fn.name === 'fireAll')!;
    expect(summary.externalCalls![0]).toMatchObject({ occurrence: 'loop', maximumOccurrences: 2 });
  }, COMPILE_TIMEOUT_MS);

  it.each([
    [
      'an unbounded trip count',
      `  function fireAll(uint value) public {
    for (int i = 0; i < handlers.length; i = i + 1) { handlers[i](value); }
    require(value >= 0);
  }`,
      'add a dominating require that bounds the trip count by an integer literal',
    ],
    [
      'a bound the loop body can move',
      `  function fireAll(uint value, address extra) public {
    require(handlers.length <= 3);
    for (int i = 0; i < handlers.length; i = i + 1) {
      handlers[i](value); this.handlers.push(IH(extra).inc);
    }
    require(value >= 0);
  }`,
      "the loop body can change 'handlers', which the bound depends on",
    ],
    [
      'a bound above the expansion maximum',
      `  function fireAll(uint value) public {
    require(handlers.length <= 40);
    for (int i = 0; i < handlers.length; i = i + 1) { handlers[i](value); }
    require(value >= 0);
  }`,
      'the proven bound of 40 reached rows exceeds the maximum of 24',
    ],
    [
      'a control-flow escape',
      `  function fireAll(uint value) public {
    require(handlers.length <= 3);
    for (int i = 0; i < handlers.length; i = i + 1) {
      if (value > 0) { break; } handlers[i](value);
    }
    require(value >= 0);
  }`,
      'the loop body uses break, continue or return',
    ],
    [
      'a non-literal loop initializer',
      `  function fireFrom(uint value, int start) public {
    require(handlers.length <= 3);
    for (int i = start; i < handlers.length; i = i + 1) { handlers[i](value); }
    require(value >= 0);
  }`,
      'the loop initializer is not an integer literal',
    ],
    [
      'two dispatches in one iteration',
      `  function fireAll(uint value) public {
    require(handlers.length <= 3);
    for (int i = 0; i < handlers.length; i = i + 1) { handlers[i](value); handlers[i](value); }
    require(value >= 0);
  }`,
      'the loop body holds 2 pointer dispatches; exactly one is admitted',
    ],
  ])('rejects %s with an exact diagnostic', (_name, body, detail) => {
    let thrown: unknown;
    try {
      compileString(table(body), busOptions);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(PointerTableBoundError);
    expect((thrown as Error).message)
      .toContain(`Message-bus pointer-table loop is not compiler-bounded: ${detail}`);
  }, COMPILE_TIMEOUT_MS);

  it('leaves the ordinary broadcast route untouched outside message-bus mode', () => {
    const source = table(`  function fireAll(uint value) public {
    for (int i = 0; i < handlers.length; i = i + 1) { handlers[i](value); }
    require(value >= 0);
  }`);
    // No controller: the same unbounded source compiles, and keeps ONE whole-table broadcast callsite rather
    // than the message-bus per-element expansion.
    const artifact = compileString(source, { forceStateful: true });
    const fireAll = artifact.abi.find((fn) => fn.name === 'fireAll')!;
    expect(fireAll.externalCalls).toHaveLength(1);
    expect(fireAll.externalCalls![0].loopArrayVar).toBe('handlers');
    expect(fireAll.externalCalls![0].selectorArrayVar).toBe('__fnsel_handlers');
    expect(fireAll.inputs.some((input) => input.name.startsWith('__internal__extcallMasterIdx'))).toBe(false);
  }, COMPILE_TIMEOUT_MS);
});
