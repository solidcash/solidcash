import { describe, it, expect } from 'vitest';
import { compileString } from './direct-compile.js';
import { MissingDataLocationError } from '../src/index.js';

// Solidity 0.5+ requires an explicit data location on reference-type parameters, returns and locals (solc TypeError
// 6651). Enforced for `.sol` source units in either mode; native SolidCash sources keep the implicit location.

const SOL = { evmCompat: true, rootFileId: '/main.sol' };
const compileSol = (source: string): string => compileString(source, SOL).contractName;

const rejects = (source: string, expected: string): void => {
  let error: unknown;
  try {
    compileSol(source);
  } catch (e) {
    error = e;
  }
  expect(error).toBeInstanceOf(MissingDataLocationError);
  expect((error as Error).message).toContain(`Data location must be ${expected}, but none was given`);
};

describe('required data locations in .sol source units', () => {
  it('rejects a public function parameter without a location', () => {
    rejects('contract C { function h(uint[] x) public pure {} }', '"memory" or "calldata" for parameter in function');
  });

  it('rejects an external function return without a location', () => {
    rejects('contract C { function i() external pure returns (uint[]) {} }',
      '"memory" or "calldata" for return parameter in function');
  });

  it('rejects an external function string parameter without a location', () => {
    rejects('contract C { function e(string s) external pure {} }',
      '"memory" or "calldata" for parameter in external function');
  });

  it('rejects an internal function bytes parameter without a location', () => {
    rejects('contract C { function g(bytes b) internal pure {} }',
      '"storage", "memory" or "calldata" for parameter in function');
  });

  it('rejects library struct returns and mapping parameters without a location', () => {
    rejects('library L { struct S { uint x; } function i() internal pure returns (S) {} }',
      '"storage", "memory" or "calldata" for return parameter in function');
    rejects('library L { function jp(mapping(uint => uint)) internal pure {} }',
      '"storage", "memory" or "calldata" for parameter in function');
  });

  it('rejects a constructor struct parameter without a location', () => {
    rejects('contract C { struct S { uint x; } constructor(S s) {} }', '"storage" or "memory" for constructor parameter');
  });

  it('rejects a modifier parameter whose only modifier is transient', () => {
    rejects('contract A { modifier mod2(uint[] transient) { _; } }',
      '"storage", "memory" or "calldata" for parameter in function');
  });

  it('rejects a reference-type local without a location', () => {
    rejects('contract C { uint[] m_y; function f() public view { uint[] y = m_y; require(y.length > 0); } }',
      '"storage", "memory" or "calldata" for variable');
  });

  it('rejects a .sol source unit compiled without evmCompat', () => {
    expect(() => compileString('contract C { function f(uint[] x) public pure returns (uint) { return x.length; } }',
      { rootFileId: '/main.sol' })).toThrow('Data location must be "memory" or "calldata" for parameter in function');
  });

  it('rejects a versioned 0.8 source unit as well', () => {
    rejects('pragma solidity ^0.8.0;\ncontract C { function h(bytes b) public pure {} }',
      '"memory" or "calldata" for parameter in function');
  });

  it('rejects an imported .sol unit that omits a location', () => {
    const lib = 'library L { function g(uint[] a) internal pure returns (uint) { return a.length; } }';
    expect(() => compileString('import "./Lib.sol";\ncontract C { function f() public pure { require(true); } }', {
      evmCompat: true,
      importResolver: (path: string) => (path === './Lib.sol' ? { source: lib, id: '/Lib.sol' } : undefined),
    })).toThrow(/Data location must be "storage", "memory" or "calldata" for parameter in function/);
  });

  it('accepts explicit locations and value-type parameters', () => {
    expect(compileSol(`contract C {
      enum E { A, B }
      function h(uint[] memory x, bytes calldata b, bytes32 k, E e) external pure returns (uint) {
        uint[] memory y = new uint[](x.length);
        require(k != bytes32(0) && e == E.A);
        return y.length + b.length;
      }
    }`)).toBe('C');
  });

  it('accepts an omitted location under a pre-0.5 pragma', () => {
    expect(compileSol('pragma solidity ^0.4.24;\ncontract C { function f(uint[] x) public pure returns (uint) '
      + '{ return x.length; } }')).toBe('C');
  });
});

describe('native SolidCash sources keep the implicit data location', () => {
  it('compiles an unversioned native source that omits locations', () => {
    expect(compileString(`contract C {
      function f(uint[] x, bytes b, string s) public pure {
        string t = "ok";
        require(x.length > 0 && b.length > 0);
      }
    }`, { evmCompat: true }).contractName).toBe('C');
  });

  it('compiles a versioned string source that omits locations', () => {
    expect(compileString('pragma solidity ^0.8.20;\ncontract C { function run(bytes32 h, bytes sig) public pure '
      + '{ require(sig.length == 65 && h != bytes32(0)); } }', { evmCompat: true }).contractName).toBe('C');
  });
});
