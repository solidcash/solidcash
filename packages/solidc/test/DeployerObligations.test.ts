/**
 * The generator's own checks of the spec's obligations (A16.2), each shown to fire.
 *
 * Each check compares what the emitters did with what the arm requires once it is generated; a test hook breaks one
 * emitter's record and the compile must stop with `DeployerInternalError` naming the obligation. Without the hook the
 * same sources compile. O7 is checked against a real source construct: a constructor that reads its own input.
 */
import { describe, expect, it } from 'vitest';
import { compileString, compileStringSplit } from './direct-compile.js';

const P = 'pragma solidcash ^0.50.0;';
const CHILD = 'contract Child { int n; constructor() payable { n = 1; } function f() public payable { n = n + 1; } }';
const creator = (body: string, hook?: string): unknown => compileString(`${P} ${CHILD} contract F { int c; ${body} }`, {
  primaryContractName: 'F', allowUnsafeOperations: true, ...(hook === undefined ? {} : { __deployerTestBox: { obligationHook: hook } }),
} as never);
const journal = (hook?: string): any => compileString(`${P} contract C { mapping(int => int) m; int n;
  constructor() { m[1] = 2; n = m[1]; } function f() public { n = n + 1; } }`, {
  deployer: true, messageBus: false, ...(hook === undefined ? {} : { __deployerTestBox: { obligationHook: hook } }),
} as never);

describe('O10: every check of a deployer `new` site, and its value in every conservation check', () => {
  it('compiles a creating arm whose site emitted every check', () => {
    expect(() => creator('function make() public payable { new Child{value: 5000}(); c = c + 1; }')).not.toThrow();
  });

  it('stops when a site did not emit its lock check', () => {
    expect(() => creator('function make() { new Child(); c = c + 1; }', 'skip-site-lock'))
      .toThrow(/O10: the deployer new site 0 did not emit lock/);
  });

  it('stops when a site did not bind Q and A', () => {
    expect(() => creator('function make() { new Child(); c = c + 1; }', 'skip-site-bound'))
      .toThrow(/O10: the deployer new site 0 did not emit bound/);
  });

  it('stops when a conservation check of the creator does not count a value', () => {
    expect(() => creator('function make() public payable { new Child{value: 5000}(); c = c + 1; }', 'uncounted-value'))
      .toThrow(/O10: a conservation check of the creator's container does not count/);
  });
});

describe('O9: the journal sites', () => {
  it('compiles a constructor whose appends are the rows its layout reserved', () => {
    expect(journal().deployer?.collectionRows).toEqual([{ collection: 'm', appendSites: 1, journalDepth: expect.any(Number) }]);
  });

  it('stops when the program appends more than the rows its layout reserved', () => {
    expect(() => journal('double-append')).toThrow(/O9: 'm' has 2 journal appends but 1 rows/);
  });

  const fields = (hook?: string): any => compileString(`${P} contract C { struct S { uint64 a; bool c; } mapping(int => S) m;
    uint64 n; constructor() { m[1].a = 2; m[1].c = true; n = m[1].a; } function f() public { n = n + 1; } }`, {
    deployer: true, messageBus: false, ...(hook === undefined ? {} : { __deployerTestBox: { obligationHook: hook } }),
  } as never);

  it('compiles a constructor whose field writes each take the value they change from the journal', () => {
    expect(fields().deployer?.collectionRows).toEqual([{ collection: 'm', appendSites: 2, journalDepth: expect.any(Number) }]);
  });

  it('stops when a field write appends without taking the value it changes from the journal', () => {
    expect(() => fields('skip-field-look'))
      .toThrow(/O9: the program has 2 journal field writes, of which 0 took the value they change from the journal/);
  });

  it('stops when the scans of a journal differ from those its cost bound counted (A4.4 "Bounds")', () => {
    // One look, one row, and step 12's second scan: three scans of m's journal.
    expect(() => journal('uncounted-scan'))
      .toThrow(/O9: '__solidcash_journal_m' is scanned 2 times, and its cost bound counted 3/);
  });
});

describe('O2: every step of create, and V grown only by event pins', () => {
  const events = (hook?: string): any => compileString(`${P} contract C { int n; event E(int v);
    constructor() { n = 1; emit E(7); } function f() public { n = n + 1; } }`, {
    deployer: true, messageBus: false, ...(hook === undefined ? {} : { __deployerTestBox: { obligationHook: hook } }),
  } as never);

  it('compiles a create that emitted every step and pinned every event', () => {
    expect(events().deployer).toBeDefined();
  });

  for (const step of [2, 3, 4, 5, 6, 7, 10, 12, 13, 14, 15]) {
    it(`stops when create did not emit step ${step}`, () => {
      expect(() => events(`skip-step-${step}`)).toThrow(new RegExp(`O2: create did not emit A4\\.3 step ${step}\\b`));
    });
  }

  it('stops when the census counts an event no pin pinned', () => {
    expect(() => events('skip-event-pin')).toThrow(/O2: the census counts 1 event outputs, and the event pins pinned 0/);
  });
});

describe('O7: an OP_INPUTINDEX in genesis mode passes only with a reason from A5\'s list (B7.6, B7.14)', () => {
  const plain = (body: string, hook?: string): any => compileString(`${P} contract C { int n; bytes32 h;
    constructor() { ${body} } function f() public { n = n + 1; } }`, {
    deployer: true, messageBus: false, ...(hook === undefined ? {} : { __deployerTestBox: { obligationHook: hook } }),
  } as never);

  it('keeps the reads A5 lists: the source\'s own input, which at birth is the deployer coin, its lock and code', () => {
    for (const body of ['n = this.activeInputIndex;', 'n = tx.inputs[this.activeInputIndex].value;',
      'h = sha256(tx.inputs[this.activeInputIndex].lockingBytecode);', 'h = sha256(this.activeBytecode);',
      'h = this.category;']) {
      expect(plain(body).deployerUnsupported, body).toBeUndefined();
    }
  });

  it('refuses an OP_INPUTINDEX the emitter passed with no reason (genesis-site)', () => {
    const artifact = plain('n = 1;', 'bare-input-index');
    expect(artifact.deployer).toBeUndefined();
    expect(artifact.deployerUnsupported).toBe('genesis-site');
  });

  it('refuses a genesis body that invokes a body compiled outside genesis mode which reads the running input', () => {
    expect(plain('n = 1;', 'invoke-reading-body').deployerUnsupported).toBe('genesis-site');
  });

  it('stops when the code holds an OP_INPUTINDEX that did not pass the emitter', () => {
    expect(() => plain('n = 1;', 'bypass-input-index')).toThrow(/B7\.14: the code holds \d+ OP_INPUTINDEX and the emitter passed \d+/);
  });

  it('stops when the emitter passed an OP_INPUTINDEX it did not count', () => {
    expect(() => plain('n = 1;', 'uncounted-input-index')).toThrow(/B7\.14: the code holds \d+ OP_INPUTINDEX and the emitter passed \d+/);
  });
});

describe('O8: every arm of a direct stateful master begins with its exact-stack check (B6.0)', () => {
  const direct = (source: string, hook?: string): any => compileString(`${P} ${source}`, {
    ...(hook === undefined ? {} : { __deployerTestBox: { obligationHook: hook } }),
  } as never);
  const DISPATCHED = 'contract C { int n; function a(int x) public { n = n + x; } function b() public { n = n + 1; } }';
  const INLINE = 'contract C { int n; function a(int x) public { n = n + x; } }';

  it('compiles a dispatched master and a master with one arm run inline', () => {
    expect(() => direct(DISPATCHED)).not.toThrow();
    expect(() => direct(INLINE)).not.toThrow();
  });

  it('stops when a dispatched arm runs an op before its check', () => {
    expect(() => direct(DISPATCHED, 'op-before-exact-stack'))
      .toThrow(/O8: '(a|b)' does not begin with its exact-stack check: expected 74..9d \(n = \d+\), found 61/);
  });

  it('stops when the arm the program runs inline runs an op before its check', () => {
    expect(() => direct(INLINE, 'op-before-exact-stack'))
      .toThrow(/O8: 'a' does not begin with its exact-stack check/);
  });

  // A pool read reached only through a function pointer has the program define the pool binding helper ahead of
  // its arms, its body built at run time from `__oraclePool`: the inline arm begins after it.
  const POINTER_CLOCK = `contract PointerClock { int reads;
    function stamp() internal view returns (uint32) { return block.timestamp; }
    function zero() internal view returns (uint32) { return 0; }
    function check(int expected, bool live) {
      function() internal view returns (uint32) read = live ? stamp : zero;
      require(read() == expected);
      this.reads = this.reads + 1;
    } }`;

  it('reads the inline arm after the pool binding helper the program defines at run time', () => {
    expect(direct(POINTER_CLOCK).constructorInputs.map((input: { name: string }) => input.name))
      .toContain('__oraclePool');
    expect(() => direct(POINTER_CLOCK, 'op-before-exact-stack'))
      .toThrow(/O8: 'check' does not begin with its exact-stack check: expected 74..9d \(n = \d+\), found 61/);
  });

  it('stops when the model holds an item the arm\'s declarations do not account for', () => {
    expect(() => direct(DISPATCHED, 'undeclared-stack-item'))
      .toThrow(/O8: '(a|b)' holds \d+ items in the model at its exact-stack check, and its declarations account for \d+/);
  });
});

describe('O3: every arm but __construct of a marked creator checks its stack and its own unlocking (A6)', () => {
  const marked = (hook?: string): any => compileString(`${P} contract Child { address owner;
      constructor() { owner = msg.sender; } function bump() { owner = owner; } }
    contract Parent { int m; function make() { Child c = new Child(); m = 1; } function g() public { m = m + 1; } }`, {
    primaryContractName: 'Parent', ...(hook === undefined ? {} : { __deployerTestBox: { obligationHook: hook } }),
  } as never);

  it('compiles a marked creator whose arms each check both', () => {
    expect(marked().createsSenderReadingChildren).toBe(true);
  });

  it('stops when an arm of a marked creator does not check its own unlocking', () => {
    expect(() => marked('skip-unlocking-check')).toThrow(/O3: '(make|g)' of a marked creator does not check its own unlocking/);
  });

  it('stops when the code tail is changed after it was applied: the reader would find no marker (O4)', () => {
    expect(() => marked('tail-after-marker')).toThrow(/O4: .*a reader takes the flags of no marker from the code, and the compiler meant [1-3]/);
  });
});

describe('O5 and O6: record-sound callees', () => {
  const callee = (hook?: string): unknown => compileString(`${P} contract T { int n;
    function f(int x) external returns (int) { n = x; return n; }
    function g() public { n = n + 1; } }`, {
    messageBus: false, genesisCalls: true,
    ...(hook === undefined ? {} : { __deployerTestBox: { obligationHook: hook } }),
  });

  it('compiles a record-sound callee whose arms count their carriers and check their genesis call', () => {
    expect((callee() as { recordSound?: boolean }).recordSound).toBe(true);
  });

  it('O5: stops when an arm of a record-sound contract does not count its carriers', () => {
    expect(() => callee('skip-carrier-count')).toThrow(/O5: the arm '[fg]' does not count/);
  });

  it('O5: takes an arm that always reverts as settling no carrier, in a whole and in a split compile', () => {
    // The arm never reaches its end, where the count is emitted, so it cannot succeed.
    const reverting = `${P} contract T { int n;
      function f(int x) external returns (int) { n = x; return n; }
      function g() public returns (int) { n = 1; revert(); } }`;
    expect((compileString(reverting, { messageBus: false, genesisCalls: true }) as { recordSound?: boolean })
      .recordSound).toBe(true);
    const bundle = compileStringSplit(
      'contract BrokenRewarder { uint touched;'
      + ' function pending() public returns (uint[] memory amounts) { touched = 1; revert(); }'
      + ' function notify() public { require(true); } }',
      { evmCompat: true, forceSplit: true },
    );
    expect(bundle.manifest.routes.find((route) => route.function === 'pending')?.target).not.toBe('root');
  });

  it('O5: still stops when an arm that ends in a revert may return before it', () => {
    const mayReturn = `${P} contract T { int n;
      function g(int x) public returns (int) { if (x > 0) { n = x; return n; } revert(); } }`;
    expect((compileString(mayReturn, { messageBus: false, genesisCalls: true }) as { recordSound?: boolean })
      .recordSound).toBe(true);
    expect(() => compileString(mayReturn, {
      messageBus: false, genesisCalls: true, __deployerTestBox: { obligationHook: 'skip-carrier-count' },
    } as never)).toThrow(/O5: the arm 'g' does not count/);
  });

  it('O6: stops when a tagged entry does not check that g_in spends (X, 0)', () => {
    expect(() => callee('skip-genesis-x0')).toThrow(/O6: '[fg]' takes a genesis call but did not emit x0/);
  });

  it('O6: stops when a body that also runs as a multi-call frame does not require its genesis call empty there', () => {
    const framed = (hook?: string): unknown => compileString(`${P} contract T { int n;
      function f(int x) external returns (int) { n = x; return n; } }`, {
      messageBus: false, callBatch: true,
      ...(hook === undefined ? {} : { __deployerTestBox: { obligationHook: hook } }),
    } as never);
    expect((framed() as { callBatch?: unknown }).callBatch).toEqual({ selector: '53434442' });
    expect(() => framed('skip-genesis-frame')).toThrow(/O6: 'f' takes a genesis call but did not emit frame/);
  });

  it('O6: stops when a creating entry does not require its genesis call empty', () => {
    const body = 'function make() public returns (int) { new Child(); c = c + 1; return c; }';
    expect((creator(body) as { recordSound?: boolean }).recordSound).toBe(true);
    expect(() => creator(body, 'skip-genesis-empty')).toThrow(/O6: 'make' takes a genesis call but did not emit empty/);
  });
});
