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

// C3 - the master covenant re-creates only the ACCESSED state NFTs; an attacker who additionally co-spends an
// un-accessed data/entry NFT can destroy it (its sub-covenant self-authorizes given the master's minting NFT
// is present). The fix emits an own-category mutable(0x01)-NFT input==output conservation loop for functions
// that don't co-spend a variable count of own-category mutable NFTs. Its distinctive opcode signature is the
// build of `C ++ 0x01` from the master's `C ++ 0x02` category. (VM-level rejection is covered by the SDK e2e
// test 'C3: rejects co-spending an un-accessed data NFT for destruction'.)
describe('C3: own-category mutable-NFT conservation loop', () => {
  const SIG = 'OP_SPLIT OP_DROP OP_1 OP_CAT';

  it('emits the conservation loop for a plain data-NFT function', () => {
    const bc = compileString('contract C { int n; function inc() external { this.n = this.n + 1; require(true); } }').bytecode;
    expect(bc).toContain(SIG);
  });

  it('emits the conservation loop for a guarded non-state function (blocks the lone-data-NFT destroy vector)', () => {
    const bc = compileString(
      'contract G { int n; function f(pubkey pk, sig s) external { require(checkSig(s, pk)); } }',
    ).bytecode;
    expect(bc).toContain(SIG);
  });

  it('is skipped for entry/mapping functions (variable own-category mutable-NFT count)', () => {
    const bc = compileString(
      'contract M { mapping(int => int) m; function set(int k, int v) external { this.m[k] = v; require(true); } }',
    ).bytecode;
    expect(bc).not.toContain(SIG);
  });
});

// C2 - a mapping read of an OMITTED entry returns the type default (false/0). Script cannot force an existing
// entry UTXO to be co-spent, so a negative guard (require(!m[k]) / require(m[k]==0|false)) is bypassable by
// omission - one-time-write / replay / blacklist maps drain. The compiler warns on the negative-guard idiom.
// See docs/mapping-omission-security.md.
describe('C2: negative mapping-guard diagnostic', () => {
  function countC2Warnings(src: string): number {
    let n = 0;
    const spy = vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => {
      if (a.join(' ').includes('SECURITY-AUDIT C2')) n += 1;
    });
    try {
      compileString(src);
    } finally {
      spy.mockRestore();
    }
    return n;
  }

  it.each([
    ['require(!m[k])', 'contract C { mapping(address=>bool) claimed; function f(address me) external { require(!this.claimed[me]); this.claimed[me]=true; require(true); } }'],
    ['require(m[k]==false)', 'contract C { mapping(address=>bool) v; function f(address u) external { require(this.v[u]==false); require(true); } }'],
    ['require(m[k]==0)', 'contract C { mapping(address=>uint256) nonce; function f(address u) external { require(this.nonce[u]==0); require(true); } }'],
  ])('warns on the negative guard: %s', (_label, src) => {
    expect(countC2Warnings(src)).toBe(1);
  });

  it.each([
    ['positive require(m[k])', 'contract C { mapping(address=>bool) ok; function f(address u) external { require(this.ok[u]); require(true); } }'],
    ['positive require(m[k]>=x)', 'contract C { mapping(address=>uint256) bal; function f(address u, uint256 a) external { require(this.bal[u]>=a); require(true); } }'],
    ['non-mapping require(!b)', 'contract C { int n; function f(bool b) external { require(!b); this.n=1; require(true); } }'],
  ])('does not warn on fail-safe/unrelated guards: %s', (_label, src) => {
    expect(countC2Warnings(src)).toBe(0);
  });
});

// H1 - in a multi-data-NFT layout, sibling data NFTs share one covenant address+category and are addressed
// positionally, so a leading nftIndex tag disambiguates them. Self-reads previously SKIPPED the tag (only
// external/callee reads verified it), letting an attacker reorder co-spent data NFTs to permute fields across
// NFT boundaries. The fix verifies the tag on self-reads too. The tag==3 check (OP_3 OP_EQUALVERIFY) is a clean
// signature: 3 is not a token capability value (0x00/0x01/0x02), so it only appears from the tag verification.
describe('H1: multi-data-NFT self-reads verify the nftIndex tag', () => {
  it('emits a tag-index verify (OP_3 OP_EQUALVERIFY) when self-reading the 4th data NFT', () => {
    const bc = compileString(
      'contract Q { bytes100 a; bytes100 b; bytes100 c; bytes100 d;'
      + ' function f() external { require(this.d == this.d); require(true); } }',
    ).bytecode;
    expect(bc).toContain('OP_3 OP_EQUALVERIFY');
  });

  it('single-data-NFT contracts carry no nftIndex tag verify', () => {
    const bc = compileString(
      'contract S { int n; function f() external { require(this.n == this.n); require(true); } }',
    ).bytecode;
    expect(bc).not.toContain('OP_3 OP_EQUALVERIFY');
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
