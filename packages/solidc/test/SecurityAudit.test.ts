import { describe, it, expect, vi } from 'vitest';
import { binToHex, hexToBin } from '@bitauth/libauth';
import { asmToBytecode, bytecodeToAsm } from '@solidcash/utils';
import { compileString as _csRawSolidc, compileStringSplit } from '../src/index.js';
const compileString = (s: string, o: Record<string, unknown> = {}): ReturnType<typeof _csRawSolidc> => _csRawSolidc(s, o);
import * as Errors from '../src/Errors.js';

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

  it('two distinct struct-field keys remain independently represented', () => {
    const fn = compileString(structTwoKeys).abi.find((entry) => entry.name === 'move');
    expect(fn?.entryAccesses).toHaveLength(2);
    expect(fn?.entryAccesses?.map((entry) => entry.keyParams[0])).toEqual([
      'field:from(id:t)',
      'field:to(id:t)',
    ]);
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

  /**
   * SEC-12. `checkSig(s, pk)` proves only that whoever supplied `pk` also supplied a matching `s`. When the same
   * caller supplies both, the check authorizes NOBODY, so it cannot suppress this warning - measured: this exact
   * shape compiled silently on 690c868c. The three cases below differ from each other in ONE token (the key), so
   * a pass here is attributable to the key's SOURCE and not to the presence of a signature check.
   */
  it('still warns when the checkSig key is a parameter the same caller supplies', () => {
    const src = `contract Proxy { bigint counter;
      function up(bytes input, pubkey pk, sig s) external { require(checkSig(s, pk)); address m = ${proxyImpl};
        m.delegatecall(input); require(input.length > 0); } }`;
    expect(countC1Warnings(src)).toBe(1);
  });

  it('does not warn when the checkSig key is a constructor argument', () => {
    const src = `contract Proxy(pubkey owner) { bigint counter;
      function up(bytes input, pubkey pk, sig s) external { require(checkSig(s, owner)); address m = ${proxyImpl};
        m.delegatecall(input); require(input.length > 0); } }`;
    expect(countC1Warnings(src)).toBe(0);
  });

  it('does not warn when the checkSig key is a state variable', () => {
    const src = `contract Proxy { bigint counter; pubkey owner;
      function up(bytes input, pubkey pk, sig s) external { require(checkSig(s, this.owner)); address m = ${proxyImpl};
        m.delegatecall(input); require(input.length > 0); } }`;
    expect(countC1Warnings(src)).toBe(0);
  });

  it('does not warn for a function with no delegatecall', () => {
    const src = 'contract C { bigint n; function f() external { require(true); this.n = this.n + 1; } }';
    expect(countC1Warnings(src)).toBe(0);
  });
});

// C1/piece-6 - the co-spend covenant pins the delegate input to the address the CALLER supplied. When that
// address is an unguarded function parameter the pin proves nothing about identity: an unrelated spender
// co-spends an implementation THEY wrote and rewrites the proxy state (measured 5 -> 999 on the BCH-2026 VM in
// Layer3DelegateClassesE3). pinsDelegateCoSpend is true for this shape, which is exactly what SUPPRESSED the
// older P2PKH-only warning, so it needs its own diagnostic.
describe('C1/piece-6: an unguarded caller-supplied implementation address warns', () => {
  function callerChosenWarnings(src: string): number {
    let n = 0;
    const spy = vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => {
      if (a.join(' ').includes('unguarded caller-supplied parameter')) n += 1;
    });
    try {
      compileString(src);
    } finally {
      spy.mockRestore();
    }
    return n;
  }

  it('warns when the delegatecall target is a bare parameter', () => {
    expect(callerChosenWarnings(`pragma solidcash >=0.8.0;
      contract Open() { bigint counter;
        function up(bytes input, address impl) external {
          impl.delegatecall(input); require(input.length > 0); } }`)).toBe(1);
  });

  it('warns when the parameter is laundered through a local alias', () => {
    expect(callerChosenWarnings(`pragma solidcash >=0.8.0;
      contract Alias() { bigint counter;
        function up(bytes input, address impl) external {
          address m = impl; m.delegatecall(input); require(input.length > 0); } }`)).toBe(1);
  });

  /**
   * The shapes that must keep compiling silently. A constructor argument is committed by the contract's own
   * p2sh32; a checkSig against a key the CALLER cannot choose really does restrict who may pick `impl`; a
   * require() against stored state is the ordinary upgradeable-proxy shape, and is why this warns rather than
   * rejecting. SEC-12: a checkSig against a key from the SAME caller is not on this list - see below.
   */
  it('stays silent for a constructor-argument implementation', () => {
    expect(callerChosenWarnings(`pragma solidcash >=0.8.0;
      contract Pinned(address impl) { bigint counter;
        function up(bytes input) external {
          impl.delegatecall(input); require(input.length > 0); } }`)).toBe(0);
  });

  it('stays silent for a parameter gated by checkSig against a constructor-argument key', () => {
    expect(callerChosenWarnings(`pragma solidcash >=0.8.0;
      contract Authorized(pubkey owner) { bigint counter;
        function up(bytes input, address impl, sig s) external {
          require(checkSig(s, owner)); impl.delegatecall(input); require(input.length > 0); } }`)).toBe(0);
  });

  it('stays silent for a parameter gated by checkSig against a state-variable key', () => {
    expect(callerChosenWarnings(`pragma solidcash >=0.8.0;
      contract StateAuthorized() { bigint counter; pubkey owner;
        function up(bytes input, address impl, sig s) external {
          require(checkSig(s, this.owner)); impl.delegatecall(input); require(input.length > 0); } }`)).toBe(0);
  });

  /**
   * SEC-12. The same shape one token apart: the key is now a parameter of the SAME entry point, so the caller
   * supplies both `pk` and `s` and the check authorizes nobody. MEASURED on 690c868c: this compiled with no C1
   * diagnostic and a stranger settled 5 -> 999 against the proxy (ReviewA13DelegateE3 A13-2b). The
   * GUARD control is the pair above: the warning is credited to where the KEY comes from, not to the delegatecall
   * target being a parameter (all three share that) nor to the absence of a signature check (all three have one).
   */
  it('SEC-12: warns when the checkSig key is a parameter of the same entry point', () => {
    expect(callerChosenWarnings(`pragma solidcash >=0.8.0;
      contract SelfAuthorized() { bigint counter;
        function up(bytes input, address impl, pubkey pk, sig s) external {
          require(checkSig(s, pk)); impl.delegatecall(input); require(input.length > 0); } }`)).toBe(1);
  });

  it('SEC-12: warns through a local alias of a caller-supplied key', () => {
    expect(callerChosenWarnings(`pragma solidcash >=0.8.0;
      contract AliasAuthorized() { bigint counter;
        function up(bytes input, address impl, pubkey pk, sig s) external {
          pubkey k = pk; require(checkSig(s, k)); impl.delegatecall(input); require(input.length > 0); } }`)).toBe(1);
  });

  it('SEC-12: warns through a cast of caller-supplied key material', () => {
    expect(callerChosenWarnings(`pragma solidcash >=0.8.0;
      contract CastAuthorized(pubkey owner) { bigint counter;
        function up(bytes input, address impl, bytes k, sig s) external {
          require(checkSig(s, pubkey(k))); impl.delegatecall(input); require(input.length > 0); } }`)).toBe(1);
  });

  it('SEC-12: reads the KEY operand of checkDataSig (arg 2), not its caller-supplied message', () => {
    expect(callerChosenWarnings(`pragma solidcash >=0.8.0;
      contract DataSigAuthorized(pubkey owner) { bigint counter;
        function up(bytes input, address impl, datasig s, bytes m) external {
          require(checkDataSig(s, m, owner)); impl.delegatecall(input); require(input.length > 0); } }`)).toBe(0);
    expect(callerChosenWarnings(`pragma solidcash >=0.8.0;
      contract DataSigSelfAuthorized() { bigint counter;
        function up(bytes input, address impl, datasig s, bytes m, pubkey pk) external {
          require(checkDataSig(s, m, pk)); impl.delegatecall(input); require(input.length > 0); } }`)).toBe(1);
  });

  it('SEC-12: checkMultiSig keys are read the same way', () => {
    expect(callerChosenWarnings(`pragma solidcash >=0.8.0;
      contract MultiAuthorized(pubkey a, pubkey b) { bigint counter;
        function up(bytes input, address impl, sig s1, sig s2) external {
          require(checkMultiSig([s1, s2], [a, b])); impl.delegatecall(input); require(input.length > 0); } }`))
      .toBe(0);
    expect(callerChosenWarnings(`pragma solidcash >=0.8.0;
      contract MultiSelfAuthorized() { bigint counter;
        function up(bytes input, address impl, pubkey a, pubkey b, sig s1, sig s2) external {
          require(checkMultiSig([s1, s2], [a, b])); impl.delegatecall(input); require(input.length > 0); } }`))
      .toBe(1);
  });

  /**
   * An array index only SELECTS among stored candidates - the caller picks WHICH committed key, not the key
   * bytes - so the container decides and this stays a real guard. Without this carve-out the fix would start
   * firing on the ordinary multi-owner proxy.
   */
  it('SEC-12: an index into constructor-argument keys is still a guard', () => {
    expect(callerChosenWarnings(`pragma solidcash >=0.8.0;
      contract IndexedAuthorized(pubkey a, pubkey b) { bigint counter;
        function up(bytes input, address impl, int i, sig s) external {
          pubkey[2] keys = [a, b]; require(checkSig(s, keys[i]));
          impl.delegatecall(input); require(input.length > 0); } }`)).toBe(0);
  });

  /**
   * Reading only a local's DECLARATION (findLocalInit) let `pubkey k = owner; k = pk;` launder a caller-supplied
   * key past the check: the declaration says `owner`, the checkSig sees `pk`. Every binding a local can hold is
   * read, so a reassigned key is caller-chosen if ANY of them reaches a parameter - both orderings warn.
   */
  it('SEC-12: a reassigned key alias cannot launder a caller-supplied key', () => {
    expect(callerChosenWarnings(`pragma solidcash >=0.8.0;
      contract ReboundAuthorized(pubkey owner) { bigint counter;
        function up(bytes input, address impl, pubkey pk, sig s) external {
          pubkey k = owner; k = pk; require(checkSig(s, k));
          impl.delegatecall(input); require(input.length > 0); } }`)).toBe(1);
    expect(callerChosenWarnings(`pragma solidcash >=0.8.0;
      contract ReboundAuthorized2(pubkey owner) { bigint counter;
        function up(bytes input, address impl, pubkey pk, sig s) external {
          pubkey k = pk; k = owner; require(checkSig(s, k));
          impl.delegatecall(input); require(input.length > 0); } }`)).toBe(1);
  });

  it('SEC-12: one real guard beside a self-authorizing check is still a guard', () => {
    expect(callerChosenWarnings(`pragma solidcash >=0.8.0;
      contract MixedAuthorized(pubkey owner) { bigint counter;
        function up(bytes input, address impl, pubkey pk, sig s1, sig s2) external {
          require(checkSig(s1, pk)); require(checkSig(s2, owner));
          impl.delegatecall(input); require(input.length > 0); } }`)).toBe(0);
  });

  it('stays silent for a parameter constrained by a require against stored state', () => {
    expect(callerChosenWarnings(`pragma solidcash >=0.8.0;
      contract Upgradeable() { bigint counter; address implementation;
        function up(bytes input, address impl) external {
          require(impl == this.implementation); impl.delegatecall(input); require(input.length > 0); } }`)).toBe(0);
  });

  /**
   * SEC-17. SEC-12 read the key's PROVENANCE and stopped there, so it warned on the standard BCH admin-upgrade
   * idiom: the caller passes the key in and commits it in the same breath with
   * `require(hash160(pk) == this.pkh)`, which means the caller may supply only the one key whose hash is already
   * stored. Measured on the post-SEC-12 tree: 7 spellings of that idiom warned at this site and the same 7 at the
   * selfdestruct site, 14 false positives in all. A diagnostic that fires on the commonest authorization shape
   * trains people to ignore it, losing the genuine SEC-2 instances above that it exists to catch.
   *
   * Every row here shares the parameter list of the warning cases above (a caller `pubkey`, a `sig`, an
   * `address`), so a silence is attributable to the COMMITMENT and not to the shape of the signature.
   */
  const committed = (decls: string, guard: string): string => `pragma solidcash >=0.8.0;
    contract P(pubkey owner, bytes20 adminPkh) { bigint counter; ${decls}
      function up(bytes input, address impl, pubkey pk, sig s, bytes20 otherPkh) external {
        ${guard} impl.delegatecall(input); require(input.length > 0); } }`;

  it('SEC-17: stays silent when hash160(key) is committed to a state variable', () => {
    expect(callerChosenWarnings(committed('bytes20 pkh;',
      'require(hash160(pk) == this.pkh); require(checkSig(s, pk));'))).toBe(0);
  });

  it('SEC-17: stays silent with the operands reversed', () => {
    expect(callerChosenWarnings(committed('bytes20 pkh;',
      'require(this.pkh == hash160(pk)); require(checkSig(s, pk));'))).toBe(0);
  });

  it('SEC-17: stays silent when committed to a constructor argument', () => {
    expect(callerChosenWarnings(committed('',
      'require(hash160(pk) == adminPkh); require(checkSig(s, pk));'))).toBe(0);
  });

  it('SEC-17: stays silent through a bytes20 cast of the hash', () => {
    expect(callerChosenWarnings(committed('bytes20 pkh;',
      'require(bytes20(hash160(pk)) == this.pkh); require(checkSig(s, pk));'))).toBe(0);
  });

  it('SEC-17: stays silent when the commitment is one conjunct of an &&', () => {
    expect(callerChosenWarnings(committed('bytes20 pkh;',
      'require(input.length > 0 && hash160(pk) == this.pkh); require(checkSig(s, pk));'))).toBe(0);
  });

  it('SEC-17: stays silent when the commitment or the check goes through an alias', () => {
    expect(callerChosenWarnings(committed('bytes20 pkh;',
      'pubkey k = pk; require(hash160(k) == this.pkh); require(checkSig(s, pk));'))).toBe(0);
    expect(callerChosenWarnings(committed('bytes20 pkh;',
      'pubkey k = pk; require(hash160(pk) == this.pkh); require(checkSig(s, k));'))).toBe(0);
  });

  // The negative controls. Each has a hash160 call and an equality in a require - everything the silent rows
  // have - and differs only in whether the COMMITTED side is something the caller cannot choose, or in whether
  // the commitment runs on every path. Without these the fix would read as "a hash160 anywhere silences it".
  it('SEC-17: still warns when the hash is committed to another CALLER parameter', () => {
    expect(callerChosenWarnings(committed('bytes20 pkh;',
      'require(hash160(pk) == otherPkh); require(checkSig(s, pk));'))).toBe(1);
    expect(callerChosenWarnings(committed('bytes20 pkh;',
      'bytes20 z = otherPkh; require(hash160(pk) == z); require(checkSig(s, pk));'))).toBe(1);
  });

  it('SEC-17: still warns when the commitment is conditional (an if-arm or an || branch)', () => {
    expect(callerChosenWarnings(committed('bytes20 pkh;',
      'if (input.length > 0) { require(hash160(pk) == this.pkh); } require(checkSig(s, pk));'))).toBe(1);
    expect(callerChosenWarnings(committed('bytes20 pkh;',
      'require(input.length > 0 || hash160(pk) == this.pkh); require(checkSig(s, pk));'))).toBe(1);
  });

  it('SEC-17: still warns when the commitment binds a DIFFERENT key than the one checked', () => {
    expect(callerChosenWarnings(committed('bytes20 pkh;',
      'require(hash160(pk) == this.pkh); require(checkSig(s, pubkey(input)));'))).toBe(1);
  });

  it('SEC-17: still warns on an inequality, and on a self-referential commitment', () => {
    expect(callerChosenWarnings(committed('bytes20 pkh;',
      'require(hash160(pk) != this.pkh); require(checkSig(s, pk));'))).toBe(1);
    expect(callerChosenWarnings(committed('bytes20 pkh;',
      'require(hash160(pk) == hash160(pk)); require(checkSig(s, pk));'))).toBe(1);
  });
});

// C1/piece-5 - the state-covenant skip is per-FUNCTION (!functionHasDelegatecall) while the co-spend pin is
// per-CALLSITE. A callsite the path does not reach therefore left the proxy's state unauthorized (a live
// forgery), and a callsite reached N times collapsed to one edge and one block slot (a silent miscompile).
describe('C1/piece-5: a delegatecall must be reached at most once per path', () => {
  const IMPL_ARG = 'address impl';

  it('refuses a delegatecall inside a loop by name', () => {
    expect(() => compileString(`pragma solidcash >=0.8.0;
      contract Loop(${IMPL_ARG}) { bigint counter;
        function up(bytes input) external {
          for (int i = 0; i < 2; i = i + 1) { impl.delegatecall(input); }
          require(input.length > 0); } }`)).toThrow(/issues delegatecall inside a loop.*settle as one/s);
  });

  it('refuses a delegatecall inside a while loop too', () => {
    expect(() => compileString(`pragma solidcash >=0.8.0;
      contract While(${IMPL_ARG}) { bigint counter;
        function up(bytes input, int n) external {
          while (n > 0) { impl.delegatecall(input); n = n - 1; }
          require(input.length > 0); } }`)).toThrow(/issues delegatecall inside a loop/);
  });

  /**
   * The not-taken-path covenant's own opcode signature: inside the own-category-mutable input loop it compares
   * the output commitment and then the output CATEGORY at the same index. The C3 conservation loop compares
   * categories only and never reads a commitment, so a hit is attributable to this covenant and nothing else.
   */
  const NOT_TAKEN_SIG = 'OP_OUTPUTTOKENCOMMITMENT OP_EQUAL OP_OVER OP_OUTPUTTOKENCATEGORY';

  it('admits a conditional delegatecall and emits the not-taken-path covenant for it', () => {
    const conditional = compileString(`pragma solidcash >=0.8.0;
      contract Cond(${IMPL_ARG}) { bigint counter;
        function up(bytes input, bool flag) external {
          if (flag) { impl.delegatecall(input); }
          require(input.length > 0); } }`);
    expect(conditional.bytecode).toContain(NOT_TAKEN_SIG);
  });

  /**
   * The guard must not spread: a straight-line delegatecall proxy allocates no flag and emits no extra covenant,
   * so every shipped proxy keeps byte-identical bytecode (corroborated by the 656-file .scash corpus hash check,
   * which moved 0 files).
   */
  it('leaves a straight-line delegatecall proxy untouched', () => {
    const straight = compileString(`pragma solidcash >=0.8.0;
      contract Straight(${IMPL_ARG}) { bigint counter;
        function up(bytes input) external {
          impl.delegatecall(input); require(input.length > 0); } }`);
    expect(straight.bytecode).not.toContain(NOT_TAKEN_SIG);
    expect(straight.abi.find((fn) => fn.name === 'up')!.lowLevelCalls)
      .toEqual([{ callMode: 'delegatecall' }]);
  });
});

// C1/piece-7 - `L.f()` library-call sugar and split-facet forwarders are COMPILER-SYNTHESIZED delegatecalls
// (LowLevelCallStatementNode.synthesizedFromLibraryCall). Every rule above keyed off hasExplicitDelegatecall,
// which excludes exactly those nodes, so pinsDelegateCoSpend was FALSE and the callsite emitted NO covenant at
// all - while the per-function !functionHasDelegatecall gate still skipped the consumer's ENTIRE state covenant.
// Measured live on the BCH-2026 VM in LibraryDelegate.test.ts: 0 -> 999 with a hostile library co-spent, and
// 0 -> 999 with NO delegate co-spent at all.
describe('C1/piece-7: a compiler-synthesized delegatecall pins its co-spend too', () => {
  const ONE_FN_LIB = 'pragma solidcash >=0.8.0; library Counter { bigint count; '
    + 'function increment() public { this.count = this.count + 1; } }';
  const TWO_FN_LIB = 'pragma solidcash >=0.8.0; library Pair { bigint count; '
    + 'function increment() public { this.count = this.count + 1; } '
    + 'function wipe() public { this.count = 0; } }';
  const resolverFor = (source: string, id: string) =>
    (path: string): { source: string; id: string } | undefined =>
      (path.includes(id) ? { source, id } : undefined);
  const consumer = (body: string, lib = 'Counter', id = 'counter'): ReturnType<typeof compileString> =>
    compileString(`pragma solidcash >=0.8.0; import { ${lib} } from "./${id}.scash"; ${body}`,
      { importResolver: resolverFor(lib === 'Counter' ? ONE_FN_LIB : TWO_FN_LIB, id) });

  /**
   * The identity pin's opcode signature: the delegate input index is DERIVED from the reserved block slot
   * (OP_INPUTINDEX + offset), then its UTXO bytecode is compared to the linked library address. An ordinary
   * stateful contract never emits `OP_ADD OP_UTXOBYTECODE OP_EQUALVERIFY`, so a hit is attributable to this pin.
   */
  const IDENTITY_PIN = 'OP_ADD OP_UTXOBYTECODE OP_EQUALVERIFY';
  const SELECTOR_PIN = 'OP_INPUTBYTECODE OP_1 OP_SPLIT OP_NIP OP_OVER OP_SIZE OP_NIP OP_SPLIT OP_DROP OP_EQUALVERIFY';

  it('emits the identity pin for a pure L.f() consumer', () => {
    expect(consumer('contract C() { bigint count; function bump() { Counter.increment(); } }').bytecode)
      .toContain(IDENTITY_PIN);
  });

  it('does not emit it for a stateful contract with no library call', () => {
    const plain = compileString('pragma solidcash >=0.8.0; contract P() { bigint count; '
      + 'function bump() external { this.count = this.count + 1; require(true); } }');
    expect(plain.bytecode).not.toContain(IDENTITY_PIN);
    expect(plain.bytecode).not.toContain(SELECTOR_PIN);
  });

  /**
   * The selector half needs a selector to pin. A one-public-function library compiles to a single-entry-point
   * contract whose unlocking script carries no leading selector - and with one function there is nothing for a
   * caller to choose, so identity alone is the whole property. Two functions: both halves.
   */
  it('adds the selector pin only when the library is selector-dispatched', () => {
    const one = consumer('contract C() { bigint count; function bump() { Counter.increment(); } }');
    const two = consumer('contract C() { bigint count; function bump() { Pair.increment(); } }', 'Pair', 'pair');
    expect(one.bytecode).toContain(IDENTITY_PIN);
    expect(one.bytecode).not.toContain(SELECTOR_PIN);
    expect(two.bytecode).toContain(IDENTITY_PIN);
    expect(two.bytecode).toContain(SELECTOR_PIN);
  });

  /** The pin needs no witness: the index is derived, so the consumer's ABI is unchanged. */
  it('adds no witness parameter to the consumer ABI', () => {
    const art = consumer('contract C() { bigint count; function bump() { Counter.increment(); } }');
    expect(art.abi.find((fn) => fn.name === 'bump')!.inputs).toEqual([]);
    expect(JSON.stringify(art.abi)).not.toContain('__internal__delegateInputIndex');
  });

  /** Sibling rule, previously excluded with the pin: the consumer's own writes are never verified. */
  it('refuses a self state-write alongside a library call', () => {
    expect(() => consumer('contract C() { bigint count; '
      + 'function bump() { Counter.increment(); this.count = 5; } }'))
      .toThrow(/delegatecall and also writes contract state/);
  });

  /**
   * Only a stateful ENTRY POINT reserves a delegate input slot, so a library call from an internal helper has
   * nothing to pin to. On 05412a58 this compiled with `lowLevelCalls` undefined on the entry point - no slot, no
   * pin, and no diagnostic. It now fails closed by name.
   */
  it('refuses a library call from a context with no reserved delegate slot', () => {
    expect(() => consumer('contract C() { bigint count; '
      + 'function helper() internal { Counter.increment(); } '
      + 'function bump() { helper(); require(true); } }'))
      .toThrow(/no reserved delegate input slot/);
  });

  /** Sibling rule: one reserved slot serves every iteration, so N source delegations settle as one. */
  it('refuses a library call inside a loop by name', () => {
    expect(() => consumer('contract C() { bigint count; '
      + 'function bump() { for (int i = 0; i < 2; i = i + 1) { Counter.increment(); } require(true); } }'))
      .toThrow(/issues delegatecall inside a loop.*settle as one/s);
  });

  /** A conditional library call is admitted and picks up the same not-taken-path covenant as piece-5. */
  it('emits the not-taken-path covenant for a conditional library call', () => {
    const conditional = consumer('contract C() { bigint count; '
      + 'function bump(bool flag) { if (flag) { Counter.increment(); } require(true); } }');
    expect(conditional.bytecode).toContain('OP_OUTPUTTOKENCOMMITMENT OP_EQUAL OP_OVER OP_OUTPUTTOKENCATEGORY');
  });

  /**
   * The OTHER synthesized form: a split root's facet forwarder. Its body is fully outlined into OP_DEFINE'd
   * spans that are PUSHED AS DATA, so opcode-name grepping cannot see inside them - search the assembled
   * BYTES instead (`93 c7 88` = OP_ADD OP_UTXOBYTECODE OP_EQUALVERIFY, the derived identity pin).
   */
  it('pins the facet co-spend in a split root forwarder', () => {
    const bundle = compileStringSplit(`pragma solidcash >=0.8.0;
      contract SplitCounter() { int a; int b;
        function bumpA(int n) public { this.a = this.a + n; require(n >= 0); }
        function bumpB(int n) public { this.b = this.b + n; require(n >= 0); } }`, { forceSplit: true });
    const bytes = binToHex(asmToBytecode(bundle.root.bytecode))
      + Object.values(bundle.root.functionBodies ?? {}).join('');
    expect(bytes).toContain('93c788');
  });
});

// X16 - the SCB1 route / graph-handler exclusion in C1/piece-5. Those routes loop by design and derive a
// delegate index per ROW, so extending the reachability rules into them broke five of their tests; they were
// excluded. This block pins WHY that exclusion is safe for an ordinary entry point in the same contract,
// because "excluded" on its own reads like "unprotected".
//
// It also pins a MEASUREMENT TRAP that made this look like a live gap on first inspection: a message-bus
// artifact publishes the dispatcher in `bytecode` and each function body as HEX in `functionBodies`, so
// grepping ASM in `bytecode` finds no covenant for ANY function and says nothing at all.
describe('X16: the graph-mode exclusion does not disarm an ordinary entry point', () => {
  const graphOptions = {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
    experimentalMessageBusControllerCategory: '22'.repeat(32),
  };
  const CONDITIONAL = `pragma solidcash >=0.8.0;
    contract GraphDelegateProxy(address impl) { bigint counter;
      function run(bytes input, bool flag) public {
        if (flag) { impl.delegatecall(input); } require(input.length > 0); } }`;
  const STRAIGHT = `pragma solidcash >=0.8.0;
    contract GraphDelegateProxy(address impl) { bigint counter;
      function run(bytes input) public { impl.delegatecall(input); require(input.length > 0); } }`;
  const NOT_TAKEN_SIG = 'OP_OUTPUTTOKENCOMMITMENT OP_EQUAL OP_OVER OP_OUTPUTTOKENCATEGORY';

  const bodyAsm = (artifact: ReturnType<typeof compileString>, selector: string): string =>
    bytecodeToAsm(hexToBin(artifact.functionBodies![selector]!));
  const selectorOf = (artifact: ReturnType<typeof compileString>, name: string): string =>
    artifact.abi.find((fn) => fn.name === name)!.selector!;

  it('keeps the not-taken-path covenant on the source entry point under graph options', () => {
    const graph = compileString(CONDITIONAL, graphOptions);
    // The trap: the dispatcher carries no covenant opcodes at all, for any function.
    expect(graph.bytecode).not.toContain(NOT_TAKEN_SIG);
    // The body does.
    expect(bodyAsm(graph, selectorOf(graph, 'run'))).toContain(NOT_TAKEN_SIG);
  });

  it('emits no not-taken covenant for the straight-line shape, in either mode', () => {
    const graph = compileString(STRAIGHT, graphOptions);
    expect(bodyAsm(graph, selectorOf(graph, 'run'))).not.toContain(NOT_TAKEN_SIG);
    expect(bodyAsm(graph, selectorOf(graph, 'run'))).toContain('OP_UTXOBYTECODE OP_EQUALVERIFY');
    expect(compileString(STRAIGHT).bytecode).not.toContain(NOT_TAKEN_SIG);
  });

  /**
   * The route itself issues no delegatecall (it OP_INVOKEs handlers), so `functionHasDelegatecall` is false for
   * it and it never skips its own state covenant - which is the exact precondition the piece-5 forgery needed.
   * A state-WRITING batch contract with a delegate row does not compile at all: the route inlines the row
   * bodies, so it has both a delegatecall and a state write and rule B rejects it. Same on 05412a58.
   */
  it('rejects a delegate row in a state-writing batch contract by name', () => {
    expect(() => compileString(`pragma solidcash >=0.8.0;
      contract BatchCounter(address impl) { int counter;
        function add(int n) public { this.counter = this.counter + n; require(n >= 0); }
        function run(bytes input) public { impl.delegatecall(input); require(input.length > 0); }
        function signed(sig s, pubkey pk) public { require(checkSig(s, pk)); } }`, graphOptions))
      .toThrow(/__scb1.*delegatecall and also writes contract state/s);
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
  ])('does not warn on authenticated C2 negative guard: %s', (_label, src) => {
    expect(countC2Warnings(src)).toBe(0);
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
    const artifact = compileString(
      'contract Q { bytes100 a; bytes100 b; bytes100 c; bytes100 d;'
      + ' function f() external { require(this.d == this.d); require(true); } }',
    );
    // Repeated reads may move this check into an opaque pushed OP_DEFINE body. Assert either the top-level ASM
    // spelling or its raw OP_3 (0x53), OP_EQUALVERIFY (0x88) byte sequence inside the compiled helper body.
    expect(
      artifact.bytecode.includes('OP_3 OP_EQUALVERIFY') || artifact.debug.bytecode.includes('5388'),
    ).toBe(true);
  });

  it('single-data-NFT contracts carry no nftIndex tag verify', () => {
    const bc = compileString(
      'contract S { int n; function f() external { require(this.n == this.n); require(true); } }',
    ).bytecode;
    expect(bc).not.toContain('OP_3 OP_EQUALVERIFY');
  });
});

// H2 - the caller reads an external call's return from a free witness index; nothing pinned it to the output
// the callee constrained, so an attacker could mint a second (category-C, none-cap, FT-0, OP_TRUE) output with
// a forged commitment and point the witness at it. For a single returning call the fix counts outputs matching
// the callee's return-event fingerprint (32-byte none-cap category + OP_TRUE bytecode) and requires exactly 1,
// so no forged twin can co-exist. Regular events carry a P2SH32 covenant bytecode (not OP_TRUE) and are excluded.
describe('H2: external-call return-event uniqueness', () => {
  const CALLER = `pragma solidcash >=0.8.0;
    contract Caller() {
      bigint r;
      function go(address t, bigint a, bigint b, pubkey pk, sig s) {
        require(checkSig(s, pk));
        bigint result = IAdder(t).add(a, b);
        this.r = result;
      }
    }
    interface IAdder { function add(bigint a, bigint b) external returns (bigint); }`;

  it('emits the return-event count loop for a single returning external call', () => {
    // The count loop tests each output's bytecode == OP_TRUE with OP_EQUAL OP_IF (the existing per-slot check
    // uses OP_EQUALVERIFY), then requires the total == 1.
    const bc = compileString(CALLER).bytecode;
    expect(bc).toContain('OP_OUTPUTBYTECODE 51 OP_EQUAL OP_IF');
    expect(bc).toContain('OP_1 OP_NUMEQUALVERIFY');
  });

  it('a contract with no external-call returns has no return-event count loop', () => {
    const bc = compileString(
      'contract C { bigint r; function f(bigint x, pubkey pk, sig s) external { require(checkSig(s, pk)); this.r = x; } }',
    ).bytecode;
    expect(bc).not.toContain('OP_OUTPUTBYTECODE 51 OP_EQUAL OP_IF');
  });
});

// H3 - the new optimiser applied `OP_NOT OP_IF -> OP_NOTIF` before the relational-NOT family, the reverse of
// the old engine's effective order, so `if (!(a < b))` and friends produced semantically-identical but
// different ASM and tripped the exact-compare backwards-compat assertion, failing the compile. The relational-
// NOT rules now precede OP_NOT OP_IF so both engines converge.
describe('H3: relational-NOT + OP_NOT OP_IF compiles (optimiser order)', () => {
  it.each([
    ['if (!(a < b))', 'contract C { function f(int a, int b) { if (!(a < b)) { require(a==a); } require(true); } }'],
    ['if (!(a <= b))', 'contract C { function f(int a, int b) { if (!(a <= b)) { require(a==a); } require(true); } }'],
    ['if (!(a > b))', 'contract C { function f(int a, int b) { if (!(a > b)) { require(a==a); } require(true); } }'],
    ['if (!(a >= b))', 'contract C { function f(int a, int b) { if (!(a >= b)) { require(a==a); } require(true); } }'],
    ['while (!(a < b))', 'contract C { function f(int a, int b) { while (!(a < b)) { a = a + 1; } require(true); } }'],
  ])('compiles %s without a backwards-compat divergence', (_label, src) => {
    expect(() => compileString(src)).not.toThrow();
  });
});

// H5 - expandModifiers iterated only contract.functions, so a guard modifier on a fallback (the DEFAULT
// dispatch branch for any unmatched selector - the transparent-proxy `ifAdmin` pattern) was silently dropped:
// never expanded into its require(), never validated. Fallback/receive now go through expandFunctionModifiers.
describe('H5: fallback modifier is expanded, not dropped', () => {
  it('a guard modifier on a fallback injects its body (bytecode grows)', () => {
    const withMod = compileString(`contract C {
      int active;
      modifier whenActive { require(this.active == 1); _; }
      fallback(bytes input) external whenActive { require(input.length >= 0); }
    }`).bytecode;
    const noMod = compileString(`contract C {
      int active;
      fallback(bytes input) external { require(input.length >= 0); }
    }`).bytecode;
    expect(withMod.length).toBeGreaterThan(noMod.length);
  });

  it('an undefined modifier on a fallback is a hard error (was silently ignored)', () => {
    expect(() => compileString('contract C { fallback() external nope { require(true); } }'))
      .toThrow(Errors.UndefinedModifierError);
  });
});

// H6 - entry parameters are raw attacker-controlled VM numbers and all VM compares are signed, yet bounded
// ints (uintN/intN), enums and fixed-point params got NO >=min/<=max guard. A `uint256 amount` could carry a
// negative value and defeat accounting guards. enforceFunctionParameterType now range-checks these (the option
// defaults on), so an out-of-range param fails an OP_VERIFY.
describe('H6: bounded int / enum params are range-validated', () => {
  it('a uint256 param gets a range check (more code than an unbounded bigint param)', () => {
    const bounded = compileString(
      'contract C { uint256 x; function f(uint256 amount) external { this.x = amount; require(true); } }',
    ).bytecode.length;
    const unbounded = compileString(
      'contract C { bigint x; function f(bigint amount) external { this.x = amount; require(true); } }',
    ).bytecode.length;
    expect(bounded).toBeGreaterThan(unbounded);
  });

  it('an enum param gets a range check', () => {
    const withEnum = compileString(
      'contract C { enum E { A, B, C } int x; function f(E e) external { this.x = 1; require(true); } }',
    ).bytecode.length;
    const plain = compileString(
      'contract C { int x; function f(bigint e) external { this.x = 1; require(true); } }',
    ).bytecode.length;
    expect(withEnum).toBeGreaterThan(plain);
  });

  it('the range check is suppressed under enforceFunctionParameterTypes: false', () => {
    const on = compileString(
      'contract C { uint256 x; function f(uint256 amount) external { this.x = amount; require(true); } }',
    ).bytecode.length;
    const off = compileString(
      'contract C { uint256 x; function f(uint256 amount) external { this.x = amount; require(true); } }',
      { enforceFunctionParameterTypes: false },
    ).bytecode.length;
    expect(off).toBeLessThan(on);
  });
});

// H8 - the inline passes look a callee up by name and disambiguate only by argument count, so two same-name
// same-arity overloads collapsed to a last-wins map entry: inlining one could splice the WRONG body and drop
// its require guard. The passes now refuse to inline an ambiguous (name, arity) and error.
describe('H8: refuse to inline same-name same-arity overloads', () => {
  const ambiguous = `contract C() {
    mapping(uint=>uint) m;
    function put(mapping(uint=>uint) storage a, uint256 v) internal { require(v >= 5); a[0] = v; }
    function put(mapping(uint=>uint) storage a, int256 v) internal { a[0] = uint(v); }
    function f(uint256 v) external { mapping(uint=>uint) storage p = m; put(p, v); require(m[0] >= 0); }
  }`;
  const single = `contract C() {
    mapping(uint=>uint) m;
    function put(mapping(uint=>uint) storage a, uint256 v) internal { require(v >= 5); a[0] = v; }
    function f(uint256 v) external { mapping(uint=>uint) storage p = m; put(p, v); require(m[0] >= 0); }
  }`;

  it('errors instead of silently inlining the wrong overload body', () => {
    expect(() => compileString(ambiguous, { solidityImportCompat: true }))
      .toThrow(Errors.AmbiguousInlineOverloadError);
  });

  it('a single (non-overloaded) inlined storage-pointer helper still compiles', () => {
    expect(compileString(single, { solidityImportCompat: true }).contractName).toBe('C');
  });
});

// MD1 - for a regular call to a callee with >1 function, the covenant compared the co-spent method's selector
// to a spender-provided WITNESS param, so an attacker could co-spend a different method of the callee. The
// target of a regular call is fixed at compile time, so its selector is now baked as a constant.
describe('MD1: external-call selector is a compile-time constant', () => {
  it('bakes the called method selector as a constant', () => {
    // add(bigint,bigint) selector is 3653d938; it must appear as a pushed constant in the covenant.
    const bc = compileString(`contract C {
      bigint r;
      function go(address t, bigint a, bigint b, pubkey pk, sig s) external {
        require(checkSig(s, pk)); this.r = IMath(t).add(a, b);
      }
    }
    interface IMath {
      function add(bigint a, bigint b) external returns (bigint);
      function sub(bigint a, bigint b) external returns (bigint);
    }`).bytecode;
    expect(bc).toContain('3653d938');
  });
});

// MD3 - InjectLocktimeGuardTraversal relied on the base visitContract, which visits the constructor + regular
// functions but not fallbackDef/receiveDef, so a fallback (the default dispatch branch) or receive reading
// tx.locktime got no synthetic require(tx.time >= tx.locktime) - a time-lock bypass. Now routed through the guard.
describe('MD3: fallback/receive get the locktime guard', () => {
  it('a fallback reading tx.locktime is guarded (more code than one that does not)', () => {
    const withLt = compileString(
      'contract C { fallback(bytes input) external { int t = tx.locktime; require(t >= 100); require(input.length >= 0); } }',
    ).bytecode.length;
    const noLt = compileString(
      'contract C { fallback(bytes input) external { int t = 5; require(t >= 100); require(input.length >= 0); } }',
    ).bytecode.length;
    expect(withLt).toBeGreaterThan(noLt);
  });

  it('a receive reading tx.locktime is guarded', () => {
    const withLt = compileString(
      'contract C { receive() external payable { int t = tx.locktime; require(t >= 100); } }',
    ).bytecode.length;
    const noLt = compileString(
      'contract C { receive() external payable { int t = 5; require(t >= 100); } }',
    ).bytecode.length;
    expect(withLt).toBeGreaterThan(noLt);
  });
});

// MD4 - a parent constructor body was inlined ONLY when the child explicitly invoked it (is Parent(args)).
// Plain `contract Child is Parent` merged the parent's state vars but dropped its constructor init, so
// guard-relevant state (owner = ...) silently stayed at the zero default. A parameterless parent ctor is now
// inlined implicitly (Solidity's implicit base-constructor call).
describe('MD4: implicit base-constructor init is not dropped', () => {
  it('inlines an un-invoked parameterless parent constructor (matches explicit init)', () => {
    const inherited = compileString(`contract Parent() {
        int owner;
        constructor() { this.owner = 42; }
      }
      contract Child is Parent {
        function f(pubkey pk, sig s) external { require(checkSig(s, pk)); require(this.owner == 42); }
      }`).bytecode;
    const standalone = compileString(`contract C() {
        int owner;
        constructor() { this.owner = 42; }
        function f(pubkey pk, sig s) external { require(checkSig(s, pk)); require(this.owner == 42); }
      }`).bytecode;
    expect(inherited).toBe(standalone);
  });
});

// LOW - a bounded integer literal that does not fit its declared type (uint8 x = 1000; uint8 x = -5) used to
// compile silently (types agree, value out of range). Now rejected at compile time.
describe('LOW: bounded int literals are range-checked', () => {
  it.each([
    'contract C { function f() external { uint8 x = 1000; require(x >= 0); } }',
    'contract C { function f() external { uint8 x = -5; require(x >= 0); } }',
    'contract C { function f() external { int8 x = 200; require(x >= 0); } }',
  ])('rejects an out-of-range literal: %s', (src) => {
    expect(() => compileString(src)).toThrow(Errors.IntLiteralOutOfRangeError);
  });

  it('accepts an in-range literal', () => {
    expect(compileString('contract C { function f() external { uint8 x = 200; require(x >= 0); } }').contractName)
      .toBe('C');
  });
});

// LOW - the odd-length hex-literal warning claimed the last nibble was "dropped" but hexToBin zero-extends it.
describe('LOW: odd-length hex literal warning is accurate', () => {
  it('warns that the nibble is zero-extended (not dropped)', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    compileString('contract C { function f() external { bytes b = 0xabc; require(b.length >= 0); } }');
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('zero-extended'));
    expect(spy).not.toHaveBeenCalledWith(expect.stringContaining('dropped'));
    spy.mockRestore();
  });
});

// C1/B - a delegatecall function skips its own state-covenant authorization and defers all writes to the
// co-spent delegate, so any self state-write in it would be unauthorized. Reject it (the delegate owns writes).
describe('C1/B: a delegatecall function may not self-mutate', () => {
  const IMPL = 'address(0x76a91489abcdefabbaabbaabbaabbaabbaabbaabbaabba88ac)';

  it('errors when a delegatecall function writes contract state', () => {
    const src = `contract P { bigint counter;
      function up(bytes i, pubkey pk, sig s) external {
        require(checkSig(s, pk)); this.counter = 1; address m = ${IMPL}; m.delegatecall(i); require(i.length > 0);
      } }`;
    expect(() => compileString(src)).toThrow(Errors.DelegatecallSelfMutationError);
  });

  it('allows a pure-forwarding delegatecall function', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const src = `contract P { bigint counter;
      function up(bytes i, pubkey pk, sig s) external {
        require(checkSig(s, pk)); address m = ${IMPL}; m.delegatecall(i); require(i.length > 0);
      } }`;
    expect(compileString(src).contractName).toBe('P');
    spy.mockRestore();
  });
});

// C1 full-state authority - the co-spent delegate only pins the proxy data NFTs it accesses, so the own-category
// mutable-NFT conservation loop (the same one VM-proven for C3) is now also emitted on the delegatecall path, so
// an un-touched proxy data NFT can't be destroyed/count-tampered while the proxy forwards.
describe('C1: proxy-state conservation runs on the delegatecall path', () => {
  it('emits the own-category conservation loop for a delegatecall proxy', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const IMPL = 'address(0x76a91489abcdefabbaabbaabbaabbaabbaabbaabbaabba88ac)';
    const bc = compileString(
      `contract P { bigint counter;
        function up(bytes i, pubkey pk, sig s) external { require(checkSig(s, pk)); address m = ${IMPL};
          m.delegatecall(i); require(i.length > 0); } }`,
    ).bytecode;
    spy.mockRestore();
    expect(bc).toContain('OP_SPLIT OP_DROP OP_1 OP_CAT');
  });
});

// C1/piece-3 - the delegatecall now FORCES + PINS the delegate co-spend: the input at
// __internal__delegateInputIndex must have locking bytecode == impl, so a real delegate is required (closing the
// "no delegate at all" core C1). Emitted only when impl is a covenant address (a P2PKH placeholder keeps the
// warning path, since a P2PKH UTXO authorizes nothing).
describe('C1: delegatecall pins the delegate co-spend', () => {
  it('emits the pin + delegate-index witness for a covenant (non-P2PKH) impl', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const a = compileString(
      'contract P { bigint counter;'
      + ' function up(bytes i, address impl, pubkey pk, sig s) external {'
      + ' require(checkSig(s, pk)); impl.delegatecall(i); require(i.length > 0); } }',
    );
    spy.mockRestore();
    expect(JSON.stringify(a.abi)).toContain('__internal__delegateInputIndex');
    // master self-preservation UTXOBYTECODE + the delegate identity pin = 2 (a P2PKH-impl proxy has only 1).
    expect((a.bytecode.match(/OP_UTXOBYTECODE/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('keeps the warning path (no pin) for a P2PKH-placeholder impl', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const a = compileString(
      'contract P { bigint counter;'
      + ' function up(bytes i, pubkey pk, sig s) external { require(checkSig(s, pk));'
      + ' address m = address(0x76a91489abcdefabbaabbaabbaabbaabbaabbaabbaabba88ac);'
      + ' m.delegatecall(i); require(i.length > 0); } }',
    );
    spy.mockRestore();
    expect(JSON.stringify(a.abi)).not.toContain('__internal__delegateInputIndex');
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
      }`).abi.find((entry) => entry.name === 'f');
    const one = compileString(`
      contract M {
        mapping(bytes32 => uint256) m;
        function f(address a, address b, uint256 v) external {
          this.m[keccak256(abi.encode(a))] = v;
          this.m[keccak256(abi.encode(a))] = v;
          require(true);
        }
      }`).abi.find((entry) => entry.name === 'f');
    expect(two?.entryAccesses).toHaveLength(2);
    expect(one?.entryAccesses).toHaveLength(1);
  });
});
