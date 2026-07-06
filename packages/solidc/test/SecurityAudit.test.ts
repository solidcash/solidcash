import { describe, it, expect, vi } from 'vitest';
import { compileString } from '../src/index.js';

// Regression tests for the 2026-07 security audit (see repo-root SECURITY-AUDIT.md). Each block pins the fix
// for one finding so it cannot silently regress. Findings that need a covenant-design change are exercised at
// the SDK/e2e level; the compiler-observable ones live here.

// C4 - distinct mapping keys must NOT collapse into one storage slot. Before the fix, any key whose AST node
// type lacked an explicit canonicalizeExpression case (struct/contract field access, keccak/sha over
// abi.encode, bytes/string concat, method calls) hit an operand-less fallback, so two runtime-distinct writes
// shared one entrySlotIndex - the covenant enforced only one commitment and the other write went unconstrained.
describe('C4: composite mapping keys allocate distinct slots', () => {
  const structTwoKeys = `
    contract Vault {
      mapping(address => uint256) balances;
      struct Transfer { address from; address to; }
      function move(Transfer t, uint256 amt) external {
        this.balances[t.from] = this.balances[t.from] - amt;
        this.balances[t.to] = this.balances[t.to] + amt;
        require(true);
      }
    }`;

  const structOneKey = `
    contract Vault {
      mapping(address => uint256) balances;
      struct Transfer { address from; address to; }
      function move(Transfer t, uint256 amt) external {
        this.balances[t.from] = this.balances[t.from] - amt;
        this.balances[t.from] = this.balances[t.from] + amt;
        require(true);
      }
    }`;

  const paramTwoKeys = `
    contract Vault {
      mapping(address => uint256) balances;
      function move(address from, address to, uint256 amt) external {
        this.balances[from] = this.balances[from] - amt;
        this.balances[to] = this.balances[to] + amt;
        require(true);
      }
    }`;

  it('two distinct struct-field keys yield more covenant code than one repeated key', () => {
    const two = compileString(structTwoKeys).bytecode.length;
    const one = compileString(structOneKey).bytecode.length;
    // A second, independently-constrained entry slot adds a whole entry-commitment verification. If the keys
    // collapsed (C4) the two-key form would equal the one-key form.
    expect(two).toBeGreaterThan(one * 1.15);
  });

  it('struct-field keys allocate the same slot count as plain-param keys', () => {
    const struct = compileString(structTwoKeys).bytecode.length;
    const param = compileString(paramTwoKeys).bytecode.length;
    // Same two-slot covenant; struct-field key loads add only a little code over a bare param load.
    expect(struct / param).toBeGreaterThan(0.9);
    expect(struct / param).toBeLessThan(1.15);
  });
});

// C1 - a delegatecall proxy defers state authorization to a co-spent delegate it cannot pin (delegates serve
// many proxies). Without access control ANY spender co-spends the state NFT with a write flag and rewrites
// proxy state. The compiler cannot pin the delegate permissionlessly, so it warns when a user-written
// delegatecall function lacks a signature guard. See docs/delegatecall-security.md.
describe('C1: delegatecall without access control warns', () => {
  const proxyImpl = 'address(0x76a91489abcdefabbaabbaabbaabbaabbaabbaabbaabba88ac)';

  function countC1Warnings(src: string): number {
    let n = 0;
    const spy = vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => {
      if (a.join(' ').includes('SECURITY-AUDIT C1')) n += 1;
    });
    try {
      compileString(src);
    } finally {
      spy.mockRestore();
    }
    return n;
  }

  it('warns once on an unguarded delegatecall function', () => {
    const src = `contract Proxy { bigint counter;
      function up(bytes input) external { address m = ${proxyImpl}; m.delegatecall(input); require(input.length > 0); } }`;
    expect(countC1Warnings(src)).toBe(1);
  });

  it('does not warn when the delegatecall function is gated by checkSig', () => {
    const src = `contract Proxy { bigint counter;
      function up(bytes input, pubkey pk, sig s) external { require(checkSig(s, pk)); address m = ${proxyImpl};
        m.delegatecall(input); require(input.length > 0); } }`;
    expect(countC1Warnings(src)).toBe(0);
  });

  it('does not warn for a function with no delegatecall', () => {
    const src = 'contract C { bigint n; function f() external { require(true); this.n = this.n + 1; } }';
    expect(countC1Warnings(src)).toBe(0);
  });
});

describe('C4: composite mapping keys (continued)', () => {
  it('keccak256(abi.encode(...)) keys over distinct operands do not collapse', () => {
    const two = compileString(`
      contract M {
        mapping(bytes32 => uint256) m;
        function f(address a, address b, uint256 v) external {
          this.m[keccak256(abi.encode(a))] = v;
          this.m[keccak256(abi.encode(b))] = v;
          require(true);
        }
      }`).bytecode.length;
    const one = compileString(`
      contract M {
        mapping(bytes32 => uint256) m;
        function f(address a, address b, uint256 v) external {
          this.m[keccak256(abi.encode(a))] = v;
          this.m[keccak256(abi.encode(a))] = v;
          require(true);
        }
      }`).bytecode.length;
    expect(two).toBeGreaterThan(one * 1.15);
  });
});
