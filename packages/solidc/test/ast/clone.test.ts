import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { BlockNode, BoolLiteralNode, RequireNode } from '../../src/ast/AST.js';
import { cloneNode, cloneNodeGraph } from '../../src/ast/clone.js';
import { compileFileMulti } from '../../src/index.js';

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

  it('compiles a routed type-only dependency diamond without expanding shared import subtrees', () => {
    const fixture = fileURLToPath(new URL(
      '../../../../examples/effectiveacceleration/contracts/MockSablierLockup.sol', import.meta.url,
    ));
    const artifacts = compileFileMulti(fixture, {
      evmCompat: true,
      messageBus: true,
      messageBusKernel: true,
      messageBusGraphContext: true,
      optimizeForCompilationSpeed: true,
      suppressWarnings: true,
      compileDeclarations: ['MockSablierLockup'],
    });
    expect(artifacts.MockSablierLockup.messageBus?.route).toBeDefined();
  });
});
