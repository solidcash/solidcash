import { describe, it, expect } from 'vitest';
import { compileString } from './direct-compile.js';

// A `{value:}` call option is an implicit value transfer, and the enclosing function's block layout reserves one
// `transfer` slot per transfer the body can make. A loop makes that count runtime-variable, so codegen interleaves
// a loop deploy's transfer into each child's deploy group instead (a STATEFUL child's genesis, indexed by the
// runtime deploy counter) and the layout reserves no fixed slot. That interleave only exists for a stateful child.
//
// A deploy of a STATELESS child lowers its `{value:}` through the ordinary single-transfer path, so it needs the
// fixed slot. Withholding it made the layout disagree with the transfer codegen emits
// (`Block slot not found: transfer[0] while compiling 'stack'`). The slot is reserved again whenever the loop
// cannot run the deploy twice; a loop that can (a `for`/`while` count loop) keeps failing closed, because no
// fixed region expresses a runtime-variable number of children.
// `test/libsolidity/semanticTests/functionCall/failed_create.sol` is the admitted shape: the tail-recursion
// lowering turns `stack(depth)`'s self-call into a repeat loop whose only arm with the deploy exits the loop.
describe('{value:} child deploy inside a loop', () => {
  const OPTS = { evmCompat: true };
  type Artifact = ReturnType<typeof compileString>;
  type AbiFunction = Artifact['abi'][number];
  const fn = (artifact: Artifact, name: string): AbiFunction =>
    artifact.abi.find((entry) => entry.name === name)!;
  const slotKinds = (artifact: Artifact, name: string): string[] =>
    (fn(artifact, name).blockLayout?.slots ?? []).map((slot) => slot.kind);

  // The corpus fixture: `stack` recurses through one arm and deploys stateless `D` in the arm that ends the loop.
  const RECURSIVE_STACK = 'contract D { constructor() payable {} }\n'
    + 'contract C {\n'
    + '    uint public x;\n'
    + '    constructor() payable {}\n'
    + '    function f(uint amount) public {\n'
    + '        x++;\n'
    + '        (new D){value: amount, salt: bytes32(x)}();\n'
    + '    }\n'
    + '    function stack(uint depth) public payable {\n'
    + '        if (depth > 0) this.stack(depth - 1);\n'
    + '        else f(0);\n'
    + '    }\n'
    + '}\n';

  it('reserves the transfer slot the size of a straight-line deploy does', () => {
    const artifact = compileString(RECURSIVE_STACK, OPTS);
    // `f` deploys straight-line and `stack` deploys through the lowered repeat loop: the same call option, so the
    // same single conditional transfer, and both layouts must reserve its slot.
    expect(slotKinds(artifact, 'f')).toContain('transfer');
    expect(slotKinds(artifact, 'stack')).toContain('transfer');
    expect(fn(artifact, 'stack').transferCount).toBe(1);
    const transfer = fn(artifact, 'stack').transfers?.[0];
    expect(transfer?.transferIndex).toBe(0);
    expect(transfer?.condition).toBeTruthy();
  });

  it('admits a source loop that reaches the deploy on the arm that leaves it', () => {
    const artifact = compileString('contract D { constructor() payable {} }\n'
      + 'contract C {\n'
      + '    uint public x;\n'
      + '    function once(int n) public {\n'
      + '        bool more = true;\n'
      + '        while (more) {\n'
      + '            more = false;\n'
      + '            if (n > 0) { more = true; }\n'
      + '            else { (new D){value: 100}(); }\n'
      + '        }\n'
      + '    }\n'
      + '}\n', OPTS);
    expect(slotKinds(artifact, 'once')).toContain('transfer');
    expect(fn(artifact, 'once').transferCount).toBe(1);
  });

  it('still refuses a loop that can deploy once per iteration', () => {
    // `many(n)` deploys n children. A fixed transfer slot verifies one output, so accepting this would lower the
    // loop to a single child: the deploy must keep failing closed until a runtime-count region exists for it.
    expect(() => compileString('contract D { constructor() payable {} }\n'
      + 'contract C {\n'
      + '    uint public x;\n'
      + '    function many(int n) public {\n'
      + '        for (int i = 0; i < n; i = i + 1) { (new D){value: 100}(); }\n'
      + '        x = x + 1;\n'
      + '    }\n'
      + '}\n', OPTS)).toThrow(/Block slot not found: transfer\[0\]/);
  });

  it('still refuses a loop that re-arms itself after the deploy', () => {
    // Same bodies, but the flag is written again after the branch, so the deploy arm can run on a later iteration.
    expect(() => compileString('contract D { constructor() payable {} }\n'
      + 'contract C {\n'
      + '    uint public x;\n'
      + '    function twice(int n) public {\n'
      + '        bool more = true;\n'
      + '        while (more) {\n'
      + '            more = false;\n'
      + '            if (n > 0) { (new D){value: 100}(); }\n'
      + '            more = n > 1;\n'
      + '        }\n'
      + '    }\n'
      + '}\n', OPTS)).toThrow(/Block slot not found: transfer\[0\]/);
  });

  it('keeps a stateful child loop deploy in its genesis interleave, with no fixed slot', () => {
    // A stateful child has a genesis to interleave the per-child value transfer into (the runtime deploy counter
    // indexes it), so this shape keeps the conservative classification and must NOT grow a fixed transfer slot.
    const artifact = compileString('contract Child(bytes20 owner) { int counter; }\n'
      + 'contract Factory(bytes20 owner) {\n'
      + '    int childCount;\n'
      + '    function makeN(int n) public {\n'
      + '        for (int i = 0; i < n; i = i + 1) { Child ch = new Child{value: 5000}(owner); }\n'
      + '        this.childCount = this.childCount + n;\n'
      + '    }\n'
      + '}\n', OPTS);
    expect(slotKinds(artifact, 'makeN')).not.toContain('transfer');
    expect(slotKinds(artifact, 'makeN')).toContain('deploy');
  });
});
