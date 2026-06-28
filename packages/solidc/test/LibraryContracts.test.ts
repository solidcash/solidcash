import { describe, it, expect } from 'vitest';
import { parseCode, compileString } from '../src/compiler.js';
import * as Errors from '../src/Errors.js';
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

// Phase 2: a library with explicitly public/external functions compiles directly to a stateless contract
// artifact; a library with only inline (internal/unmarked) functions stays non-compilable.
describe('library compiles to a stateless contract artifact (Phase 2)', () => {
  it('compiles a library with a public function to an artifact', () => {
    const artifact = compileString(
      'library Math { function add(int a, int b) public returns (int) { return a + b; } }',
    );
    expect(artifact.contractName).toBe('Math');
    expect(artifact.abi.map((f) => f.name)).toContain('add');
    expect(artifact.bytecode.length).toBeGreaterThan(0);
  });

  it('exposes only public functions in the ABI; internal helpers stay callable but unexposed', () => {
    const artifact = compileString(
      'library Math { function addOne(int a) public returns (int) { return bump(a); }'
      + ' function bump(int x) internal returns (int) { return x + 1; } }',
    );
    expect(artifact.abi.map((f) => f.name)).toEqual(['addOne']);
  });

  it('still rejects a library whose functions are all unmarked (inline-only)', () => {
    expect(() => compileString(
      'library Math { function add(int a, int b) returns (int) { return a + b; } }',
    )).toThrow(Errors.LibraryNotCompilableError);
  });

  it('still rejects an internal-only library', () => {
    expect(() => compileString(
      'library Math { function h(int x) internal returns (int) { return x; } }',
    )).toThrow(Errors.LibraryNotCompilableError);
  });

  it('marks the artifact as a library (isLibrary), and a normal contract is not', () => {
    const lib = compileString(
      'library Math { function add(int a, int b) public returns (int) { return a + b; } }',
    );
    expect(lib.isLibrary).toBe(true);
    const normal = compileString('contract C() { function f() { require(true); } }');
    expect(normal.isLibrary).toBeUndefined();
  });
});
