import { describe, expect, it } from 'vitest';
import { parseCode } from '../src/compiler.js';
import { FunctionDefinitionNode, RequireNode, StatementNode } from '../src/ast/AST.js';
import LowerCollectionJournalHelpers from '../src/semantic/LowerCollectionJournalHelpers.js';

const selector = '12345678';
const lower = (extra: string = '', stampGuard = true, resources = ['values']): {
  source: FunctionDefinitionNode; route: FunctionDefinitionNode; guard: StatementNode; writer: FunctionDefinitionNode;
} => {
  const ast = parseCode(`contract Pool() {
    mapping(int => bytes) values;
    mapping(int => bytes) other;
    function source(int key, bytes value) public { this.values[key] = value; require(true); }
    function writer(int key, bytes value) internal { this.values[key] = value; require(true); }
    function reader(int key) internal returns (bytes) { return this.values[key]; }
    function relay(int key) internal returns (bytes) { return reader(key); }
    function route(int key, bytes value) public {
      bigint __message_bus_fixed_chunkable_write_count = 0;
      __message_bus_fixed_chunkable_write_count = __message_bus_fixed_chunkable_write_count + 1;
      require(__message_bus_fixed_chunkable_write_count <= 1);
      writer(key, value);
      ${extra}
      require(true);
    }
  }`);
  const source = ast.contract.functions.find((fn) => fn.name === 'source')!;
  source.messageBusFixedChunkableWriteMaxRows = 1;
  source.messageBusFixedChunkableResources = resources.map((collection) => ({ collection, effectOrdinal: 0 }));
  source.messageBusKernelJournalDispositionSelectorHex = selector;
  const writer = ast.contract.functions.find((fn) => fn.name === 'writer')!;
  writer.forceCollectionJournalPool = true;
  writer.messageBusKernelJournalDispositionSelectorHex = selector;
  const route = ast.contract.functions.find((fn) => fn.name === 'route')!;
  route.messageBusRoute = true;
  const counter = route.body.statements![1];
  const guard = route.body.statements![2];
  expect(guard).toBeInstanceOf(RequireNode);
  if (stampGuard) {
    counter.messageBusFixedChunkableWriteGuard = selector;
    guard.messageBusFixedChunkableWriteGuard = selector;
  }
  ast.accept(new LowerCollectionJournalHelpers(true));
  return { source, route, guard, writer };
};

describe('completed chunkable-write pooling proof', () => {
  it('discharges the stamped bound only after the writer is threaded through the route cache', () => {
    const { source, route, guard, writer } = lower();
    expect(writer.collectionJournal).toBe(true);
    expect(source.messageBusPooledChunkableWrite).toBe(true);
    expect(route.body.statements).not.toContain(guard);
  });

  it.each([
    'require(this.values[key] == value);',
    'bytes actual = reader(key); require(actual == value);',
    'bytes actual = relay(key); require(actual == value);',
  ])('retains the bound when any route access bypasses the pending pool: %s', (extra) => {
    const { source, route, guard, writer } = lower(extra);
    expect(writer.collectionJournal).toBe(true);
    expect(source.messageBusPooledChunkableWrite).toBeUndefined();
    expect(route.body.statements).toContain(guard);
  });

  it('does not discharge a multi-resource descriptor with only partial journal coverage', () => {
    const { source, route, guard } = lower('', true, ['values', 'other']);
    expect(source.messageBusPooledChunkableWrite).toBeUndefined();
    expect(route.body.statements).toContain(guard);
  });

  it('cannot publish pooling authority or remove an unstamped source-level require', () => {
    const { source, route, guard } = lower('', false);
    expect(source.messageBusPooledChunkableWrite).toBeUndefined();
    expect(route.body.statements).toContain(guard);
  });
});
