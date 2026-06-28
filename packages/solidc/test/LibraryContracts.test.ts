import { describe, it, expect } from 'vitest';
import { parseCode } from '../src/compiler.js';
import type { SourceFileNode, FunctionDefinitionNode } from '../src/ast/AST.js';

// Library-contract-class feature - docs/library-contracts.md.
// Phase 1: library functions carry their declared visibility, so a library can later be classified into
// inline (internal/private) vs deployable (public/external) functions.
describe('library function visibility (Phase 1)', () => {
  const find = (ast: SourceFileNode, suffix: string): FunctionDefinitionNode =>
    ast.freeFunctions.find((f) => f.name.endsWith(suffix))!;

  it('captures public vs internal visibility on library functions', () => {
    const ast = parseCode(
      'library L { function add(int a, int b) public returns (int) { return a + b; }'
      + ' function helper(int x) internal returns (int) { return x; } }',
    ) as SourceFileNode;
    expect(ast.isLibrary).toBe(true);
    expect(find(ast, '.add').visibility).toBe('public');
    expect(find(ast, '.helper').visibility).toBe('internal');
  });

  it('defaults library function visibility to external when unspecified', () => {
    const ast = parseCode(
      'library L { function f(int x) returns (int) { return x; } }',
    ) as SourceFileNode;
    expect(find(ast, '.f').visibility).toBe('external');
  });

  it('captures private visibility too', () => {
    const ast = parseCode(
      'library L { function g(int x) private returns (int) { return x; } }',
    ) as SourceFileNode;
    expect(find(ast, '.g').visibility).toBe('private');
  });
});
