import { hexToBin } from '@bitauth/libauth';
import { bytecodeToAsm, bytecodeToScript, decodeInt, Op, sourceMapToLocationData } from '@solidcash/utils';
import { compileString } from './direct-compile.js';

// These tests inspect the physical route's helper allocation and byte budget.
// Message-bus route synthesis has its own cost and structure regression suite.
const DIRECT_ROUTE = { forceStateful: true, messageBus: false } as const;

// Dynamically allocated helper ids render either as a hex push or, when the id came from the single-byte pool
// (script numbers 1..16 and -1, which push as one opcode), as OP_1..OP_16 / OP_1NEGATE. Both are the same kind
// of definition; only the encoding differs.
const compactHelperDefinitions = (asm: string): string[] => (
  [...asm.matchAll(
    /(?:^| )((?:8[c-f]|[9a-f][0-9a-f]|[0-9a-f]{4,6})|OP_1[0-6]|OP_[1-9]|OP_1NEGATE) OP_DEFINE(?: |$)/g,
  )].map((match) => match[1])
);

describe('general vmap bytecode sharing', () => {
  it('keeps depth-sensitive sorted-output authentication inline', () => {
    const artifact = compileString(
      'contract C { mapping(int=>bool) m; function f(int k) external { m[k]=true; require(true); } }',
      DIRECT_ROUTE,
    );
    const asm = bytecodeToAsm(hexToBin(artifact.debug.bytecode));
    expect(asm).not.toContain('8a OP_DEFINE');
    // Budget raised by the single-write collection-address output cardinality proof (+28 real bytes), then
    // again to 1990 when a SINGLE fixed sorted write moved onto the batch path (SymbolTableTraversal). That is
    // a correctness change, not drift: the old `> 1` gate left a lone vmap insert - ERC20Mock's constructor
    // `_balances[msg.sender] = supply` - on the scalar path, which carries no batch witnesses and fails
    // constructor derivation with OP_EQUALVERIFY against an empty key. Verified by reverting the gate to `> 1`,
    // The trace-stable write path keeps the authenticated output proof in the entry body. Preserve substantial
    // headroom below BCH's 10KB consensus ceiling while still catching accidental framework-scale growth.
    // Raised again (4122.5 measured) by the October covenant hardening: every direct function now binds entry
    // addresses to the master lock and runs the container, foreign-token and mutable-output scans.
    // 4335 measured after the trailing batch-width binding landed on the direct convention.
    expect(artifact.bytecode.length / 2).toBeLessThan(4350);
  });

  it('shares a collection-specific entry address across reads and writes', () => {
    const artifact = compileString(
      'contract C { mapping(int=>bool) m; function f(int k) external {'
      + ' require(!m[k]); m[k]=true; require(true); } }',
      DIRECT_ROUTE,
    );
    const asm = bytecodeToAsm(hexToBin(artifact.debug.bytecode));
    // Sharing means one definition reached from both the read and the write, so assert an id that is invoked
    // more than once rather than a total helper count: outlining the contract-level script adds its own
    // definitions, and counting all of them stopped saying anything about this collection's entry address.
    const shared = compactHelperDefinitions(asm)
      .filter((id) => [...asm.matchAll(new RegExp(`(?:^| )${id} OP_INVOKE(?: |$)`, 'g'))].length >= 2);
    expect(shared.length).toBeGreaterThanOrEqual(1);
    // 4415.5 measured after the October covenant hardening (master-lock entry addresses, per-function scans).
    // 4630.5 measured after the trailing batch-width binding landed on the direct convention.
    expect(artifact.bytecode.length / 2).toBeLessThan(4650);
  });

  it('shares the authenticated-absence bracket after three reads', () => {
    const artifact = compileString(
      'contract C { mapping(int=>bool) m; function f(int a,int b,int c) external {'
      + ' require(!m[a] && !m[b] && !m[c]); require(true); } }',
      DIRECT_ROUTE,
    );
    const asm = bytecodeToAsm(hexToBin(artifact.debug.bytecode));
    const shared = compactHelperDefinitions(asm)
      .filter((id) => [...asm.matchAll(new RegExp(`(?:^| )${id} OP_INVOKE(?: |$)`, 'g'))].length >= 3);
    expect(shared.length).toBeGreaterThanOrEqual(1);
  });

  it('shares repeated composite state traversal by structural type', () => {
    const artifact = compileString(
      'struct S { int a; int b; string c; address d; int e; } contract C { S[] x;'
      + ' function f(int i) external { require(x[i].a>=0); x[i].b=2; x[i].e=3; require(true); } }',
      DIRECT_ROUTE,
    );
    const asm = bytecodeToAsm(hexToBin(artifact.debug.bytecode));
    expect(compactHelperDefinitions(asm).length).toBeGreaterThanOrEqual(1);
    expect(artifact.bytecode.length / 2).toBeLessThan(9300);
  });

  it('allocates collision-free structural and field-prefix helpers across entry points', () => {
    const artifact = compileString(
      'struct S { int a; string b; int c; } struct T { address a; bytes b; bool c; }'
      + ' contract C { S[] x; T[] y;'
      + ' function f(int i) external { require(x[i].c>=0); }'
      + ' function g(int i) external { require(x[i].c>=0); }'
      + ' function h(int i) external { require(x[i].c>=0 && y[i].c); }'
      + ' function j(int i) external { require(y[i].c); }'
      + ' function k(int i) external { require(y[i].c); } }',
      DIRECT_ROUTE,
    );
    const asm = bytecodeToAsm(hexToBin(artifact.debug.bytecode));
    const helperIds = compactHelperDefinitions(asm);
    expect(helperIds.length).toBeGreaterThanOrEqual(4);
    expect(new Set(helperIds).size).toBe(helperIds.length);
    const invokeDebug = (artifact.debug as typeof artifact.debug & {
      invokeDebug?: Record<string, { bytecode: string; name?: string; sourceMap: string }>;
    }).invokeDebug ?? {};
    const helperDebug = Object.values(invokeDebug)
      .filter((debug) => debug.name?.startsWith('compiler helper') || debug.name?.startsWith('outlined source span'));
    expect(helperDebug.length).toBeGreaterThanOrEqual(1);
    for (const debug of helperDebug) {
      expect(sourceMapToLocationData(debug.sourceMap)).toHaveLength(bytecodeToScript(hexToBin(debug.bytecode)).length);
    }
    expect(artifact.bytecode.length / 2).toBeLessThan(3800);
  });

  it('chains cumulative struct-field prefixes through the nearest smaller helper', () => {
    const artifact = compileString(
      'struct S { string a; string b; string c; string d; string e; } contract C { S[] x;'
      + ' function f(int i) external {'
      + ' require(x[i].c.length>=0 && x[i].c.length>=0 && x[i].c.length>=0'
      + ' && x[i].e.length>=0 && x[i].e.length>=0 && x[i].e.length>=0); } }',
      DIRECT_ROUTE,
    );
    const asm = bytecodeToAsm(hexToBin(artifact.debug.bytecode));
    const helperIds = compactHelperDefinitions(asm);
    expect(helperIds.length).toBeGreaterThanOrEqual(3);
    expect(helperIds.some((id) => asm.includes(`${id} OP_INVOKE`))).toBe(true);
  });

  it('shares repeated variable-width array element extraction', () => {
    const artifact = compileString(
      'struct S { int a; string b; int c; } contract C { S[] x;'
      + ' function f(int i) external { S[] a=x;'
      + ' require(a[i].c>=0 && a[i].c>=0 && a[i].c>=0); } }',
      DIRECT_ROUTE,
    );
    const asm = bytecodeToAsm(hexToBin(artifact.debug.bytecode));
    const helperIds = compactHelperDefinitions(asm);
    expect(helperIds.length).toBeGreaterThanOrEqual(1);
    expect(helperIds.some((id) => asm.includes(`${id} OP_INVOKE`))).toBe(true);
    // 4346.5 measured after the October covenant hardening: every direct function now runs the container,
    // foreign-token, unwritten-chunk and mutable-output scans. 4592.5 once those scans list the slots they act
    // on in one classifying pass per side, and the mutable-output check tries the minted locks first.
    expect(artifact.bytecode.length / 2).toBeLessThan(4750);
  });

  it('nests only compiler helpers and other outlined spans, acyclically, while sharing composite array traversal', () => {
    const artifact = compileString(
      'struct Row { int a; string label; int b; bytes payload; int c; } contract CompositeRows { Row[] rows;'
      + ' function updateA(int i) external { require(rows[i].a>=0); rows[i].b=1; rows[i].c=2; require(true); }'
      + ' function updateB(int i) external { require(rows[i].a>=0); rows[i].b=3; rows[i].c=4; require(true); }'
      + ' function updateC(int i) external { require(rows[i].a>=0); rows[i].b=5; rows[i].c=6; require(true); } }',
      { ...DIRECT_ROUTE, maximumInputBytes: 1_000_000 },
    );
    const invokeDebug = (artifact.debug as typeof artifact.debug & {
      invokeDebug?: Record<string, { bytecode: string; name?: string; sourceMap: string }>;
    }).invokeDebug ?? {};
    const idsNamed = (prefix: string): Set<number> => new Set(Object.entries(invokeDebug)
      .filter(([, debug]) => debug.name?.startsWith(prefix)).map(([id]) => Number(id)));
    const compilerHelperIds = idsNamed('compiler helper');
    const outlinedSpanIds = idsNamed('outlined source span');
    // A single-byte-pool id pushes as OP_1..OP_16 or OP_1NEGATE, any other as data.
    const invokedId = (operand: unknown): number => (operand instanceof Uint8Array ? Number(decodeInt(operand))
      : operand === Op.OP_1NEGATE ? -1 : Number(operand) - Op.OP_1 + 1);
    const nestedOutlinedBodies = Object.entries(invokeDebug)
      .filter(([, debug]) => debug.name?.startsWith('outlined source span'))
      .map(([id, debug]) => ({ id: Number(id), debug, script: bytecodeToScript(hexToBin(debug.bytecode)) }))
      .filter(({ script }) => script.includes(Op.OP_INVOKE));

    expect(nestedOutlinedBodies.length).toBeGreaterThanOrEqual(1);
    const calls = new Map<number, number[]>();
    for (const { id, debug, script } of nestedOutlinedBodies) {
      expect(sourceMapToLocationData(debug.sourceMap)).toHaveLength(script.length);
      for (let index = 1; index < script.length; index += 1) {
        if (script[index] !== Op.OP_INVOKE) continue;
        const target = invokedId(script[index - 1]);
        expect(compilerHelperIds.has(target) || outlinedSpanIds.has(target)).toBe(true);
        calls.set(id, [...(calls.get(id) ?? []), target]);
      }
    }
    // A later tail may call a span outlined before it, but nothing calls back into it: the nesting is acyclic.
    const done = new Set<number>();
    const acyclic = (id: number, path: Set<number>): boolean => {
      if (done.has(id)) return true;
      if (path.has(id)) return false;
      const ok = (calls.get(id) ?? []).every((target) => acyclic(target, new Set([...path, id])));
      done.add(id);
      return ok;
    };
    for (const id of calls.keys()) expect(acyclic(id, new Set())).toBe(true);
  });
});
