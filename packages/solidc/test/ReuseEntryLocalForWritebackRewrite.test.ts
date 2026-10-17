import { describe, expect, it } from 'vitest';
import { StructType, IntType } from '@solidcash/utils';
import {
  Node,
  StatementNode,
  ExpressionNode,
  VariableDefinitionNode,
  MappingAccessNode,
  AssignNode,
  MappingFieldAssignNode,
  MappingAssignNode,
  FunctionCallNode,
  FieldAccessNode,
  IdentifierNode,
  IntLiteralNode,
} from '../src/ast/AST.js';
import { rewriteStatements, type WritebackMapping } from '../src/semantic/ReuseEntryLocalForWritebackRewrite.js';

/**
 * The pure correctness invariant of ReuseEntryLocalForWriteback, independent of any tree's byte-size baseline.
 * The exact read-modify-writeback shape (the same one the real Unicrow `refund` uses, and the same one the
 * end-to-end byte-identity test `ReuseEntryLocalForWriteback.test.ts` compiles) is fed to `rewriteStatements`
 * directly:
 *
 *   S e = m[k];  e.x = a;  m[k].x = e.x;  m[k].y = b;
 *
 * The unit must report exactly ONE elided entry re-read and produce the hand-written whole-struct write-back:
 *
 *   S e = m[k];  e.x = a;  m[k] = S(e.x, b, e.z);
 *
 * The end-to-end byte-identity to the compiled hand-written form is asserted separately in
 * ReuseEntryLocalForWriteback.test.ts, so this test pins only the structural invariant, never a byte size.
 */

const UINT = new IntType(false, 256);
const S = new StructType('S', [
  { name: 'x', type: UINT },
  { name: 'y', type: UINT },
  { name: 'z', type: UINT },
]);
const MAPPINGS = new Map<string, WritebackMapping>([['m', { keyCount: 1, struct: S }]]);

const id = (name: string): IdentifierNode => new IdentifierNode(name);
const fa = (base: string, name: string): FieldAccessNode => new FieldAccessNode(id(base), name);
const ctor = (...args: ExpressionNode[]): FunctionCallNode => new FunctionCallNode(id('S'), args);

// `S e = m[k]; e.x = a; m[k].x = e.x; m[k].y = b;` after `e.x = a` desugars to a whole-struct rebuild.
const sugar = (): StatementNode[] => [
  new VariableDefinitionNode(S, [], 'e', new MappingAccessNode('m', [id('k')])),
  new AssignNode(id('e'), ctor(new IntLiteralNode(1n), fa('e', 'y'), fa('e', 'z'))),
  new MappingFieldAssignNode('m', [id('k')], 'x', fa('e', 'x')),
  new MappingFieldAssignNode('m', [id('k')], 'y', id('b')),
];

const hand = (): StatementNode[] => [
  new VariableDefinitionNode(S, [], 'e', new MappingAccessNode('m', [id('k')])),
  new AssignNode(id('e'), ctor(new IntLiteralNode(1n), fa('e', 'y'), fa('e', 'z'))),
  new MappingAssignNode('m', [id('k')], ctor(fa('e', 'x'), id('b'), fa('e', 'z'))),
];

const strip = (node: Node): unknown => {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === 'location' || key === 'type' || key === 'symbolTable' || key === 'definition') continue;
    if (value instanceof Node) out[key] = strip(value);
    else if (Array.isArray(value)) out[key] = value.map((item) => (item instanceof Node ? strip(item) : item));
    else if (typeof value === 'bigint') out[key] = value.toString();
    else out[key] = value;
  }
  return out;
};

describe('ReuseEntryLocalForWritebackRewrite (pure unit)', () => {
  it('elides exactly one entry re-read and is structurally identical to the hand-written write-back', () => {
    const result = rewriteStatements(sugar(), MAPPINGS);
    expect(result.elidedReads).toBe(1);
    expect(JSON.stringify(result.rewritten.map(strip))).toBe(JSON.stringify(hand().map(strip)));
  });

  it('keeps an ineligible shape fail-closed (no elision, statements unchanged)', () => {
    // A whole reassignment of the local (`e = m[1]`) invalidates the snapshot, so the run must not fold.
    const ineligible = (): StatementNode[] => [
      new VariableDefinitionNode(S, [], 'e', new MappingAccessNode('m', [id('k')])),
      new AssignNode(id('e'), new MappingAccessNode('m', [id('1')])),
      new MappingFieldAssignNode('m', [id('k')], 'x', fa('e', 'x')),
      new MappingFieldAssignNode('m', [id('k')], 'y', id('b')),
    ];
    const result = rewriteStatements(ineligible(), MAPPINGS);
    expect(result.elidedReads).toBe(0);
    expect(JSON.stringify(result.rewritten.map(strip))).toBe(JSON.stringify(ineligible().map(strip)));
  });
});
