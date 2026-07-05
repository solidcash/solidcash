import { describe, it, expect } from 'vitest';
import { compileString } from '../src/index.js';

// try/catch: the catch is dead code on BCH (a failed co-spent call/deploy aborts the whole tx, and warns).

// A catch clause's error param (`catch Error(string memory reason)` / `catch (bytes memory reason)`) must be
// in scope for the catch block's statements (`emit Log(reason)`); it was registered after the block visited.
describe('try/catch clause parameter scope', () => {
  it('scopes the catch error param in the catch block', () => {
    const a = compileString(
      'interface I { function g() external returns (uint256); }'
      + ' contract A { event L(string m); event LB(bytes d);'
      + ' function f(I i) public { try i.g() returns (uint256 v) { require(v > 0); }'
      + ' catch Error(string memory reason) { emit L(reason); }'
      + ' catch (bytes memory reason) { emit LB(reason); } } }',
      { solidityImportCompat: true },
    );
    expect(a.contractName).toBe('A');
  });
});

// try/catch is supported (the catch is dead code on BCH - a failed co-spent call/deploy aborts the whole tx -
// and warns). But `emit` INSIDE a try block failed: the emit-slot allocator did not recurse into a TryCatchNode
// (only into if/loop blocks), so the event slot was never allocated ("Block slot not found: event[0]").
describe('emit inside a try block (allocate its event slot)', () => {
  const IFACE = 'interface I { function g() external returns (uint256); }';
  it('compiles emit inside try/catch on an external call', () => {
    const a = compileString(`${IFACE} contract C { event L(uint256 v); uint256 n;`
      + ' function f(I i) external { try i.g() returns (uint256 v) { emit L(v); this.n = 1; }'
      + ' catch { emit L(0); this.n = 2; } } }', { solidityImportCompat: true });
    expect(a.contractName).toBe('C');
  });
  it('compiles emit inside try/catch on a contract creation (try new Foo(...) returns (...))', () => {
    const a = compileString('contract Foo { address o; constructor(address _o) { o = _o; } }'
      + ' contract C { event L(address a); uint256 n; function f(address o) external {'
      + ' try new Foo(o) returns (Foo foo) { emit L(address(foo)); this.n = 1; } catch { this.n = 2; } } }',
    { solidityImportCompat: true });
    expect(a.contractName).toBe('C');
  });
});
