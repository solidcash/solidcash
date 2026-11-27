import { describe, expect, it } from 'vitest';
import { BlockNode, BoolLiteralNode, RequireNode } from '../../src/ast/AST.js';
import { cloneNode, cloneNodeGraph } from '../../src/ast/clone.js';

describe('AST clone alias semantics', () => {
  it('preserves graph aliases only for whole-program snapshots', () => {
    const shared = new RequireNode(new BoolLiteralNode(true));
    const root = new BlockNode([shared, shared]);

    const expanded = cloneNode(root);
    expect(expanded.statements?.[0]).not.toBe(expanded.statements?.[1]);

    const snapshot = cloneNodeGraph(root);
    expect(snapshot.statements?.[0]).toBe(snapshot.statements?.[1]);
    expect(snapshot.statements?.[0]).not.toBe(shared);
  });
});
