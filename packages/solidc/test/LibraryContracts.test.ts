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

// 3b step 2: a state-touching library declares the shared state layout it operates on (as state vars); its
// public functions are auto-delegated (Solidity has no `delegate` keyword - public library functions are
// delegatecalled implicitly), and it lowers to a delegate contract (reuses the delegate-impl path).
describe('delegate libraries lower to a delegate contract (3b step 2)', () => {
  // Plain Solidity source - no SolidCash-specific `delegate` keyword.
  const LIB = 'library Counter { bigint count; function inc() public { this.count = this.count + 1; } }';

  it('compiles a state-touching library with a public function to an artifact', () => {
    const lib = compileString(LIB);
    expect(lib.isLibrary).toBe(true);
    expect(lib.contractName).toBe('Counter');
    expect(lib.abi.map((f) => f.name)).toContain('inc');
  });

  it('auto-delegates: lowers to the same bytecode as a hand-written `public delegate` contract', () => {
    const contract = 'contract Counter() { bigint count; function inc() public delegate { this.count = this.count + 1; } }';
    expect(compileString(LIB).bytecode).toBe(compileString(contract).bytecode);
  });

  // 3b `L.f()` sugar, piece 1: the auto-delegate also applies on the import/free-function path, so a consumer
  // importing a state-touching library sees its functions as delegate calls (routed in a later piece).
  it('auto-delegates state-touching library functions on the free-function (import) path', () => {
    const ast = parseCode(
      'library Counter { bigint count; function increment() public { this.count = this.count + 1; } }',
    ) as SourceFileNode;
    const inc = ast.freeFunctions.find((f) => f.name.endsWith('.increment'))!;
    expect(inc.modifiers).toContain('delegate');
  });

  it('does not auto-delegate a pure library function (stays inline)', () => {
    const ast = parseCode(
      'library Math { function add(int a, int b) public returns (int) { return a + b; } }',
    ) as SourceFileNode;
    const add = ast.freeFunctions.find((f) => f.name.endsWith('.add'))!;
    expect(add.modifiers).not.toContain('delegate');
  });

  // 3b `L.f()` sugar, pieces 2-3: a consumer that imports a state-touching library and calls `L.f()` has it
  // desugared to a delegatecall, with a synthesized library-address constructor arg.
  it('desugars L.f() to a delegatecall + synthesizes the library-address ctor arg', () => {
    const COUNTER = 'library Counter { bigint count; function increment() public { this.count = this.count + 1; } }';
    const resolver = (p: string): { source: string; id: string } | undefined =>
      (p.includes('counter') ? { source: COUNTER, id: 'counter' } : undefined);
    const consumer = 'import { Counter } from "./counter.scash"; '
      + 'contract C() { bigint count; function bump() { Counter.increment(); } }';
    const art = compileString(consumer, { importResolver: resolver });

    expect(art.constructorInputs.map((i) => i.name)).toContain('__libAddr_Counter');
    const bump = art.abi.find((f) => f.name === 'bump')!;
    expect(bump.lowLevelCalls).toEqual([{ callMode: 'delegatecall' }]);
    // The target library+function is recorded so the SDK auto-wires the delegatecall co-spend (no manual
    // withDelegatecall). The delegate's selector/args are supplied by the SDK at spend time, not baked in.
    expect(bump.libraryDelegateCalls).toEqual([{ library: 'Counter', functionName: 'increment' }]);
  });

  // 3b layout-compat (compile-time): a consumer of a delegate library must declare a matching state layout,
  // else the library writes the wrong field of the caller's state. Here `count` is at the wrong slot.
  it('rejects a consumer whose state layout does not match the imported library', () => {
    const COUNTER = 'library Counter { bigint count; function increment() public { this.count = this.count + 1; } }';
    const resolver = (p: string): { source: string; id: string } | undefined =>
      (p.includes('counter') ? { source: COUNTER, id: 'counter' } : undefined);
    const consumer = 'import { Counter } from "./counter.scash"; '
      + 'contract C() { bigint other; bigint count; function bump() { Counter.increment(); } }';
    expect(() => compileString(consumer, { importResolver: resolver })).toThrow(/expects the caller/i);
  });
});

// 3b arguments: a consumer may forward its own parameters to a library call; the SDK supplies their values to
// the library unlocker (the delegatecall data is not on-chain). Only parameter forwarding is supported.
describe('delegate library forwarded arguments (3b)', () => {
  const COUNTER = 'library Counter { bigint count; '
    + 'function incrementBy(bigint n) public { this.count = this.count + n; } }';
  const resolver = (p: string): { source: string; id: string } | undefined =>
    (p.includes('counter') ? { source: COUNTER, id: 'counter' } : undefined);

  it('records the forwarded parameter names in libraryDelegateCalls', () => {
    const consumer = 'import { Counter } from "./counter.scash"; '
      + 'contract C() { bigint count; function bumpBy(bigint n) { Counter.incrementBy(n); } }';
    const art = compileString(consumer, { importResolver: resolver });
    const bumpBy = art.abi.find((f) => f.name === 'bumpBy')!;
    expect(bumpBy.libraryDelegateCalls).toEqual(
      [{ library: 'Counter', functionName: 'incrementBy', argParams: ['n'] }],
    );
  });

  it('does not warn that the forwarded parameter is unused (it is forwarded to the library)', () => {
    const consumer = 'import { Counter } from "./counter.scash"; '
      + 'contract C() { bigint count; function bumpBy(bigint n) { Counter.incrementBy(n); } }';
    const warns: string[] = [];
    const orig = console.log;
    console.log = (m?: unknown): void => { warns.push(String(m)); };
    try { compileString(consumer, { importResolver: resolver }); } finally { console.log = orig; }
    expect(warns.some((w) => /unused variable 'n'/.test(w))).toBe(false);
    expect(warns.some((w) => /Low-level \.delegatecall/.test(w))).toBe(false);
  });

  it('rejects a non-parameter argument (literal / computed expression)', () => {
    const consumer = 'import { Counter } from "./counter.scash"; '
      + 'contract C() { bigint count; function bump() { Counter.incrementBy(5); } }';
    expect(() => compileString(consumer, { importResolver: resolver })).toThrow(/forwarding the enclosing/i);
  });

  // A delegate library is co-spent with no synchronous return; using its call as a value must fail clearly,
  // pointing to the shared-state pattern (the library writes state the caller reads) or pure-library precompiles.
  it('rejects using a delegate library call as a value (no synchronous return)', () => {
    const retLib = 'library Counter { bigint count; '
      + 'function getAndInc() public returns (bigint) { this.count = this.count + 1; return this.count; } }';
    const retResolver = (p: string): { source: string; id: string } | undefined =>
      (p.includes('counter') ? { source: retLib, id: 'counter' } : undefined);
    const consumer = 'import { Counter } from "./counter.scash"; '
      + 'contract C() { bigint count; function f() returns (bigint) { bigint x = Counter.getAndInc(); return x; } }';
    expect(() => compileString(consumer, { importResolver: retResolver })).toThrow(/cannot return a value/i);
  });
});
