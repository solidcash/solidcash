import { describe, it, expect, vi } from 'vitest';
import { AbiFunction, signatureGuardKeyCommitment, signatureGuardKeyProvenance } from '@solidcash/utils';
import { compileString } from './direct-compile.js';

/**
 * X51. The artifact publishes what a signature-guard KEY is pinned to, not only where the key came from.
 *
 * X37 publishes `signatureGuard.key`, and on the standard BCH authorization idiom that answer is
 * `{parameter, pk}`: the caller does hand the key in. What makes the idiom authority is a SEPARATE unconditional
 * `require(hash160(pk) == <committed>)`, which no artifact field described - so the SDK's delegate gate refused
 * the honest shape (round 16's named false negative `hash160-committed-key`) rather than reconstruct the
 * commitment from parameter types, which is the exact reasoning X37 exists to remove.
 *
 * `signatureGuard.keyCommitment` is that fact. It is produced by `parameterCommitmentSource`, which is the SAME
 * ordered statement walk SEC-17's diagnostic decides on - X46's writer strengthening included - so the artifact
 * can never credit a commitment the diagnostic does not, or the reverse.
 *
 * EVERY ROW HERE ASSERTS BOTH. The published field and the compiler warning are read from the same source
 * string, because they are computed at different points in the pipeline: SEC-17 decides during semantic
 * analysis, the artifact is built after codegen, and two passes rewrite function bodies in between. Agreement
 * across all 22 rows is the evidence that those two points do not diverge; a bare field assertion would not be.
 */

const abiOf = (source: string, fn: string): AbiFunction => {
  const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
  try {
    return compileString(source).abi.find((entry) => entry.name === fn)!;
  } finally {
    spy.mockRestore();
  }
};

/** The whole published guard, so a row pins the key AND its commitment together. */
const guardOf = (source: string, fn: string): unknown => abiOf(source, fn).signatureGuard;

// ---------------------------------------------------------------------------
// SEC-12/SEC-17's delegatecall site. Same fixture as `SecurityAudit.test.ts`, so every row here shares its
// parameter list with the warning rows there and a difference is attributable to the COMMITMENT.
// ---------------------------------------------------------------------------

const committed = (decls: string, guard: string): string => `pragma solidcash >=0.8.0;
    contract P(pubkey owner, bytes20 adminPkh) { bigint counter; ${decls}
      function up(bytes input, address impl, pubkey pk, sig s, bytes20 otherPkh) external {
        ${guard} impl.delegatecall(input); require(input.length > 0); } }`;

function callerChosenWarnings(source: string): number {
  let count = 0;
  const spy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    if (args.join(' ').includes('unguarded caller-supplied parameter')) count += 1;
  });
  try {
    compileString(source);
  } finally {
    spy.mockRestore();
  }
  return count;
}

const PK_KEY = { kind: 'parameter', name: 'pk' };

describe('X51: the artifact publishes the key commitment SEC-17 credits', () => {
  it('publishes the state variable a caller-supplied key is pinned to', () => {
    const source = committed('bytes20 pkh;', 'require(hash160(pk) == this.pkh); require(checkSig(s, pk));');
    expect(guardOf(source, 'up')).toEqual({ key: PK_KEY, keyCommitment: { kind: 'stateVar', name: 'pkh' } });
    expect(callerChosenWarnings(source)).toBe(0);
  });

  it('publishes it with the operands reversed', () => {
    const source = committed('bytes20 pkh;', 'require(this.pkh == hash160(pk)); require(checkSig(s, pk));');
    expect(guardOf(source, 'up')).toEqual({ key: PK_KEY, keyCommitment: { kind: 'stateVar', name: 'pkh' } });
    expect(callerChosenWarnings(source)).toBe(0);
  });

  /** The constructor-argument spelling: the strongest published answer, since the p2sh32 commits to it. */
  it('publishes the constructor argument a key is pinned to', () => {
    const source = committed('', 'require(hash160(pk) == adminPkh); require(checkSig(s, pk));');
    expect(guardOf(source, 'up'))
      .toEqual({ key: PK_KEY, keyCommitment: { kind: 'constructorArg', name: 'adminPkh' } });
    expect(callerChosenWarnings(source)).toBe(0);
  });

  it('publishes it through a bytes20 cast of the hash', () => {
    const source = committed('bytes20 pkh;',
      'require(bytes20(hash160(pk)) == this.pkh); require(checkSig(s, pk));');
    expect(guardOf(source, 'up')).toEqual({ key: PK_KEY, keyCommitment: { kind: 'stateVar', name: 'pkh' } });
    expect(callerChosenWarnings(source)).toBe(0);
  });

  it('publishes it when the commitment is one conjunct of an &&', () => {
    const source = committed('bytes20 pkh;',
      'require(input.length > 0 && hash160(pk) == this.pkh); require(checkSig(s, pk));');
    expect(guardOf(source, 'up')).toEqual({ key: PK_KEY, keyCommitment: { kind: 'stateVar', name: 'pkh' } });
    expect(callerChosenWarnings(source)).toBe(0);
  });

  it('publishes it when the commitment or the check goes through an alias', () => {
    const viaCommitment = committed('bytes20 pkh;',
      'pubkey k = pk; require(hash160(k) == this.pkh); require(checkSig(s, pk));');
    expect(guardOf(viaCommitment, 'up'))
      .toEqual({ key: PK_KEY, keyCommitment: { kind: 'stateVar', name: 'pkh' } });
    expect(callerChosenWarnings(viaCommitment)).toBe(0);

    const viaCheck = committed('bytes20 pkh;',
      'pubkey k = pk; require(hash160(pk) == this.pkh); require(checkSig(s, k));');
    expect(guardOf(viaCheck, 'up')).toEqual({ key: PK_KEY, keyCommitment: { kind: 'stateVar', name: 'pkh' } });
    expect(callerChosenWarnings(viaCheck)).toBe(0);
  });

  /**
   * SEC-17's 8 NEGATIVE CONTROLS, republished as artifact assertions. Each has a `hash160` call and an equality
   * inside a require - everything the rows above have - and differs only in whether the committed side is
   * something the caller cannot choose, or in whether the commitment runs on every path. Without these the field
   * would read as "a hash160 anywhere publishes a commitment". All 8 still warn, and none publishes the field.
   */
  const NEGATIVE_CONTROLS: readonly { name: string; decls: string; guard: string }[] = [
    {
      name: 'committed to another CALLER parameter',
      decls: 'bytes20 pkh;',
      guard: 'require(hash160(pk) == otherPkh); require(checkSig(s, pk));',
    },
    {
      name: 'committed to another caller parameter through an alias',
      decls: 'bytes20 pkh;',
      guard: 'bytes20 z = otherPkh; require(hash160(pk) == z); require(checkSig(s, pk));',
    },
    {
      name: 'the commitment sits inside an if-arm',
      decls: 'bytes20 pkh;',
      guard: 'if (input.length > 0) { require(hash160(pk) == this.pkh); } require(checkSig(s, pk));',
    },
    {
      name: 'the commitment is one branch of an ||',
      decls: 'bytes20 pkh;',
      guard: 'require(input.length > 0 || hash160(pk) == this.pkh); require(checkSig(s, pk));',
    },
    {
      name: 'an inequality',
      decls: 'bytes20 pkh;',
      guard: 'require(hash160(pk) != this.pkh); require(checkSig(s, pk));',
    },
    {
      name: 'the self-referential hash160(pk) == hash160(pk)',
      decls: 'bytes20 pkh;',
      guard: 'require(hash160(pk) == hash160(pk)); require(checkSig(s, pk));',
    },
  ];

  for (const control of NEGATIVE_CONTROLS) {
    it(`publishes NO commitment when ${control.name}`, () => {
      const source = committed(control.decls, control.guard);
      expect(guardOf(source, 'up')).toEqual({ key: PK_KEY });
      expect(signatureGuardKeyCommitment(abiOf(source, 'up')).kind).toBe('unknown');
      expect(callerChosenWarnings(source)).toBe(1);
    });
  }

  /**
   * SEC-17's last negative control, separated because its published KEY differs. The commitment binds `pk` and
   * the check reads `input`, and X37 resolves `pubkey(input)` through the cast to the `bytes` parameter itself -
   * so the published key is `{parameter, input}`, a name nothing in this body pins. The commitment is looked up
   * for the key that is CHECKED, never for whichever name a nearby `hash160` happens to mention.
   */
  it('publishes NO commitment when the commitment binds a different key than the one checked', () => {
    const source = committed('bytes20 pkh;',
      'require(hash160(pk) == this.pkh); require(checkSig(s, pubkey(input)));');
    expect(guardOf(source, 'up')).toEqual({ key: { kind: 'parameter', name: 'input' } });
    expect(callerChosenWarnings(source)).toBe(1);
  });

  /**
   * THE MEMOIZATION SUBTLETY, carried into the artifact. The commitment decision is memoized per NAME while the
   * in-flight cycle marker deliberately is not: without the memo, the second occurrence of the same committed
   * key inside one key expression hit the marker and resolved the other way, so `checkMultiSig(ss, [pk, pk])`
   * answered twice for one expression. The published field is read through a key-set fold that visits `pk`
   * twice, so it would show the same split if the memo regressed.
   */
  it('resolves a committed key the same way each time it appears in one key expression', () => {
    const source = 'contract C(pubkey admin) { bytes20 pkh; int n;'
      + ' function kill(sig[2] ss, pubkey pk, address to) external {'
      + ' require(hash160(pk) == this.pkh); require(checkMultiSig(ss, [pk, pk])); selfdestruct(to); } }';
    expect(guardOf(source, 'kill')).toEqual({ key: PK_KEY, keyCommitment: { kind: 'stateVar', name: 'pkh' } });
  });

  /**
   * THE FOLD IS THE WEAKEST, exactly as `key` is. Two checks, one pinned and one not: the body's authority is
   * only as strong as the cheapest guard a spender can satisfy, so the published commitment is dragged to the
   * unpinned key's own provenance rather than reporting the pinned one. A consumer allow-list refuses
   * `parameter`, which is the point - understating the authority in force is a refusal, never an admission.
   */
  it('folds two signature checks to the WEAKEST bound, so one unpinned key drags the commitment down', () => {
    const source = 'pragma solidcash >=0.8.0;\n'
      + 'contract Mixed() { bigint counter; bytes20 pkh;'
      + ' function up(bytes input, address impl, pubkey pk, sig s, pubkey pk2, sig s2) external {'
      + ' require(hash160(pk) == this.pkh); require(checkSig(s, pk)); require(checkSig(s2, pk2));'
      + ' impl.delegatecall(input); require(input.length > 0); } }';
    const guard = abiOf(source, 'up').signatureGuard;
    expect(guard!.key.kind).toBe('parameter');
    expect(guard!.keyCommitment).toEqual({ kind: 'parameter', name: 'pk2' });
  });

  /**
   * WHERE IN THE PIPELINE THIS IS READ, measured rather than assumed. SEC-17 decides during semantic analysis;
   * the artifact is built after code generation, and three passes rewrite function bodies in between - modifier
   * expansion, the synthetic locktime guard (which PREPENDS a top-level require), and the early-return
   * transformation (which nests statements into if-else). Any of them could have moved the commitment out of the
   * top-level statement list the walk reads, and the failure mode would have been silent: no field, no warning,
   * a gate refusal that looks like an honest one. Each shape below carries the same idiom and must publish it.
   */
  it('publishes the commitment through modifier expansion, the locktime guard and early returns', () => {
    const shapes: Record<string, string> = {
      plain: 'contract C(bytes20 pkh) { int n; function f(pubkey pk, sig s) external {'
        + ' require(hash160(pk) == pkh); require(checkSig(s, pk)); this.n = this.n + 1; } }',
      earlyReturn: 'contract C(bytes20 pkh) { int n; function f(pubkey pk, sig s, bool q) external {'
        + ' require(hash160(pk) == pkh); require(checkSig(s, pk)); if (q) { return; } this.n = this.n + 1; } }',
      locktimeGuard: 'contract C(bytes20 pkh) { int n; function f(pubkey pk, sig s) external {'
        + ' require(hash160(pk) == pkh); require(checkSig(s, pk)); require(tx.locktime > 0);'
        + ' this.n = this.n + 1; } }',
      modifier: 'contract C(bytes20 pkh) { int n;'
        + ' modifier onlyAdmin(pubkey pk, sig s) { require(hash160(pk) == pkh); require(checkSig(s, pk)); _; }'
        + ' function f(pubkey pk, sig s) external onlyAdmin(pk, s) { this.n = this.n + 1; } }',
      uncheckedBlock: 'contract C(bytes20 pkh) { int n; function f(pubkey pk, sig s) external {'
        + ' unchecked { require(hash160(pk) == pkh); require(checkSig(s, pk)); } this.n = this.n + 1; } }',
    };
    for (const [name, source] of Object.entries(shapes)) {
      expect(guardOf(source, 'f'), name)
        .toEqual({ key: PK_KEY, keyCommitment: { kind: 'constructorArg', name: 'pkh' } });
    }
  });

  it('publishes no signatureGuard at all for a body with no signature check', () => {
    const source = `pragma solidcash >=0.8.0;
      contract NoGuard(address impl) { bigint counter;
        function up(bytes input) external { impl.delegatecall(input); require(input.length > 0); } }`;
    expect(abiOf(source, 'up').signatureGuard).toBeUndefined();
    expect(signatureGuardKeyProvenance(abiOf(source, 'up')).kind).toBe('unknown');
    expect(signatureGuardKeyCommitment(abiOf(source, 'up')).kind).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
// X46's site. A commitment is only as good as the last WRITER of what it is bound to.
// ---------------------------------------------------------------------------

/**
 * X46 STRENGTHENS THE PUBLISHED FACT, not just the diagnostic. Scalar state is read after write on the BCH-2026
 * VM, so `this.pkh = attackerPkh; require(hash160(pk) == this.pkh)` pins the key to bytes the caller supplied one
 * line earlier - a LIVE theft, settled in `packages/solidcash/test/e2e/X46CommitmentWriter.test.ts`. Publishing
 * a commitment for that shape would hand the SDK gate the same hole in artifact form.
 *
 * The 4 silent controls each CONTAIN a state write, so a published commitment is attributable to WHEN the write
 * happens and to WHAT it writes - including the key-ROTATION idiom, which writes after the commitment and which
 * a cruder rule breaks.
 */
const sd = (decls: string, guard: string): string => 'contract C(pubkey admin, bytes20 adminPkh) {'
  + ` ${decls} int n; function kill(sig s, pubkey pk, address to, bytes20 otherPkh) external {`
  + ` ${guard} selfdestruct(to); } }`;

function selfdestructWarns(source: string): boolean {
  const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
  compileString(source);
  const warned = spy.mock.calls.some((call) =>
    String(call[0]).includes('sends the freed balance to a caller-supplied'));
  spy.mockRestore();
  return warned;
}

describe('X51: a commitment X46 refuses to credit is never published', () => {
  const PINNED_TO_PKH = { key: PK_KEY, keyCommitment: { kind: 'stateVar', name: 'pkh' } };

  const OVERWRITTEN: readonly { name: string; decls: string; guard: string }[] = [
    {
      name: 'the committed state variable is written from a caller parameter first',
      decls: 'bytes20 pkh;',
      guard: 'this.pkh = otherPkh; require(hash160(pk) == this.pkh); require(checkSig(s, pk));',
    },
    {
      name: 'the write is hash160 of the caller key itself',
      decls: 'bytes20 pkh;',
      guard: 'this.pkh = hash160(pk); require(hash160(pk) == this.pkh); require(checkSig(s, pk));',
    },
    {
      name: 'the tainted read reaches the commitment through a local alias',
      decls: 'bytes20 pkh;',
      guard: 'this.pkh = otherPkh; bytes20 z = this.pkh; require(hash160(pk) == z); require(checkSig(s, pk));',
    },
    {
      name: 'the write sits in an if-arm that may run',
      decls: 'bytes20 pkh;',
      guard: 'if (n > 0) { this.pkh = otherPkh; } require(hash160(pk) == this.pkh); require(checkSig(s, pk));',
    },
    {
      name: 'a mapping entry is written from a caller parameter and then committed against',
      decls: 'mapping(int => bytes20) admins;',
      guard: 'this.admins[1] = otherPkh; require(hash160(pk) == this.admins[1]); require(checkSig(s, pk));',
    },
  ];

  for (const row of OVERWRITTEN) {
    it(`publishes NO commitment when ${row.name}`, () => {
      const source = sd(row.decls, row.guard);
      expect(guardOf(source, 'kill')).toEqual({ key: PK_KEY });
      expect(selfdestructWarns(source)).toBe(true);
    });
  }

  it('publishes the commitment for the key-ROTATION idiom, which writes AFTER it', () => {
    const source = sd('bytes20 pkh;',
      'require(hash160(pk) == this.pkh); require(checkSig(s, pk)); this.pkh = otherPkh;');
    expect(guardOf(source, 'kill')).toEqual(PINNED_TO_PKH);
    expect(selfdestructWarns(source)).toBe(false);
  });

  it('publishes it when the preceding write takes its value from a constructor argument', () => {
    const source = sd('bytes20 pkh;',
      'this.pkh = adminPkh; require(hash160(pk) == this.pkh); require(checkSig(s, pk));');
    expect(guardOf(source, 'kill')).toEqual(PINNED_TO_PKH);
    expect(selfdestructWarns(source)).toBe(false);
  });

  it('publishes it when the preceding write is to an unrelated state variable', () => {
    const spare = sd('bytes20 pkh; bytes20 spare;',
      'this.spare = otherPkh; require(hash160(pk) == this.pkh); require(checkSig(s, pk));');
    expect(guardOf(spare, 'kill')).toEqual(PINNED_TO_PKH);
    expect(selfdestructWarns(spare)).toBe(false);

    const counter = sd('bytes20 pkh;',
      'this.n = this.n + 1; require(hash160(pk) == this.pkh); require(checkSig(s, pk));');
    expect(guardOf(counter, 'kill')).toEqual(PINNED_TO_PKH);
    expect(selfdestructWarns(counter)).toBe(false);
  });
});
