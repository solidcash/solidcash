import { describe, expect, it } from 'vitest';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { publishedRefusals } from '../../../../solidc/test/per-call/master/refused-entry.js';

/**
 * The contract shapes the per-call path refuses by name.
 *
 * Each source is a real `.scash` unit handed to the shipped compiler with the per-call convention, and each
 * assertion is the refusal the shipped code raises: an error code plus the fragment that names the fact. They
 * stand beside the shapes that do compile so the refusal is the named feature and not a syntax error.
 */

/** The message the compiler raises for a per-call shape it will not emit. */
function refusal(source: string, options: Record<string, unknown> = {}): string {
  try {
    const refusals = publishedRefusals(compileStringMulti(source, { composition: 'per-call', ...options }));
    if (refusals.length === 0) return '';
    return `PER_CALL_CODEGEN_UNAVAILABLE: ${refusals.map((refused) => `${refused.functionName}: `
      + `${refused.reason}`).join(' | ')}`;
  } catch (error) {
    return (error as Error).message;
  }
}

describe('a contract whose transfer helper is written in assembly', () => {
  it('is refused by name: inline assembly is not composed per-call', () => {
    // The SafeERC20 shape re-raises a callee's revert from an assembly block, which a per-call master cannot emit.
    const source = 'pragma solidcash ^0.13.0;'
      + ' contract Token {'
      + '   function safeTransfer(address to, int amount) {'
      + '     assembly { OP_DUP OP_ADD 0x01 }'
      + '     require(true);'
      + '   }'
      + ' }';
    const message = refusal(source);
    expect(message).toContain('PER_CALL_CODEGEN_UNAVAILABLE');
    expect(message).toContain('inline assembly is not composed per-call');
  });
});

describe('a value send', () => {
  it('is served: the body pins the lock it computed at the listed output', () => {
    // The recipient lock is a run-time value, so the head leaves the listed output index for the body to pin the
    // lock and the value it computed against. The accept and the mutations are machine cases in
    // `solidc/test/per-call/master/send-output.test.ts`.
    const source = 'pragma solidcash ^0.13.0;'
      + ' contract Sender { function pay(address to) { this.transfer(to, 1000); require(true); } }';
    expect(refusal(source)).toBe('');
  });
});

describe('a low-level call', () => {
  it('is refused by name: the witness call checks are not emitted', () => {
    const source = 'pragma solidcash ^0.13.0;'
      + ' contract Low { function f(address target) { target.call(hex"12345678"); require(true); } }';
    const message = refusal(source);
    expect(message).toContain('PER_CALL_CODEGEN_UNAVAILABLE');
    expect(message).toContain('a low-level call needs the witness `calls[]` checks');
  });
});

describe('composite values at an entry boundary', () => {
  it('refuses an entry that returns an external function pointer', () => {
    // A function pointer is an (address, selector) pair, so it is not one item the frame's `retval` comparison can
    // hold; the entry is refused where it is compiled and the reason is published on the artifact.
    const source = 'pragma solidcash ^0.13.0;'
      + ' contract Returns {'
      + '   function f() returns (function(int) external returns (int)) { revert("no"); }'
      + ' }';
    const message = refusal(source);
    expect(message).toContain('PER_CALL_CODEGEN_UNAVAILABLE');
    expect(message).toContain('returns a function pointer');
  });

  // An entry that returns a fixed-size array or a struct is admitted, not refused: each is one value the language
  // holds already encoded, so the frame records the blob the entry's own `return` built and compares them. The
  // accepts, the dynamic-member cases and the struct that stays refused (a mapping member is state, not a value)
  // are machine cases in `solidc/test/per-call/master/composite-return.test.ts`.
  //
  // A call that passes a struct argument is admitted too, whether the struct is built from run-time values or
  // written as a literal: the caller materializes one blob and the site's digest is the wire's. The accept, the
  // array argument in both spellings, and the one argument type that stays refused (an external function pointer)
  // are cases in `solidc/test/per-call/master/composed-arguments.test.ts`.
});

describe('a recovery precompile', () => {
  it('is served: a master locates its recovery side-car pair from the input it runs on', () => {
    // The pair is placed immediately after the master's own input, so the head admits the body and the machine
    // cases in `solidc/test/per-call/master/ecrecover-invalid-input.test.ts` drive a real recovery.
    const source = 'pragma solidcash ^0.13.0;'
      + ' contract Rec {'
      + '   function f(bytes32 h, int v, bytes32 r, bytes32 s) returns (address) { return ecrecover(h, v, r, s); }'
      + ' }';
    expect(refusal(source, { ecrecover: 'p2pkh' })).toBe('');
  });
});

describe('a keccak compute side-car', () => {
  // A straight-line call reads the side-car the composer places after the master; `composer/keccak-side-car`
  // settles it.
  it('serves a straight-line call', () => {
    const source = 'pragma solidcash ^0.13.0;'
      + ' contract Hashes {'
      + '   function f(bytes preimage) returns (bytes32) { return keccak256(preimage); }'
      + ' }';
    expect(refusal(source)).toBe('');
  });

  it('is refused by name inside a loop: the loop reads a run-time number of side-cars', () => {
    const source = 'pragma solidcash ^0.13.0;'
      + ' contract Hashes {'
      + '   bytes32 h;'
      + '   function f(bytes a, int n) { for (int i = 0; i < n; i = i + 1) { this.h = keccak256(a); } require(true); }'
      + ' }';
    const message = refusal(source);
    expect(message).toContain('PER_CALL_CODEGEN_UNAVAILABLE');
    expect(message).toContain('a keccak256 call inside a loop reads one compute side-car per turn');
  });
});

describe('a constructor that runs a keccak compute side-car', () => {
  /**
   * The two spellings differ only in where the hashing body sits, and the master gives the constructor the same
   * block it gives an entry: the artifact publishes the constructor's own `keccakCompute` and a `keccakSideCar`
   * slot in its block beside the entries', and the genesis co-spends the side-car the frame reads the way a call
   * site does for an entry. The settlements are machine cases in `deploy/genesis.test.ts`; what a constructor
   * cannot do is hash inside a loop, whose side-car count the artifact does not fix.
   */
  const sourceOf = (hashingBody: 'entry' | 'constructor' | 'loop'): string => 'pragma solidcash ^0.13.0;'
    + ' contract Hashes { bytes32 h;'
    + (hashingBody === 'constructor'
      ? '   constructor(bytes seed) { this.h = keccak256(seed); }'
        + '   function peek() returns (bytes32) { return this.h; }'
      : hashingBody === 'loop'
        ? '   constructor(bytes seed, int turns) {'
          + '     for (int i = 0; i < turns; i = i + 1) { this.h = keccak256(seed); }'
          + '   }'
          + '   function peek() returns (bytes32) { return this.h; }'
        : '   function f(bytes seed) { this.h = keccak256(seed); require(true); }')
    + ' }';

  it('is served when the hashing body is an entry, which a call lays the side-car for', () => {
    expect(refusal(sourceOf('entry'))).toBe('');
  });

  it('is served as a constructor too, which the genesis lays the side-car for', () => {
    expect(refusal(sourceOf('constructor'))).toBe('');
  });

  it('is emitted even inside a loop, whose count the deployment refuses rather than the compiler', () => {
    // The loop's side-car count is the loop's to decide, which is a witness the genesis cannot lay: it is refused
    // there, by name, rather than at admission.
    expect(refusal(sourceOf('loop'))).toBe('');
  });
});

describe('a string-keyed string mapping', () => {
  it('serves its set: the head supplies the value witness from the frame\'s block', () => {
    // The body reads a long value through a value-witness operand, which the frame's block lists; a short value is
    // inline in the node, so the operand is unread. The frames it settles are cases in `shapes/mapping-values`; the
    // delete is served and settled in `shapes/string-mapping-delete`.
    const source = 'pragma solidcash ^0.13.0;'
      + ' contract Tags {'
      + '   mapping(string => string) public tags;'
      + '   function put(string k, string v) { this.tags[k] = v; require(true); }'
      + ' }';
    expect(refusal(source)).toBe('');
  });
});
