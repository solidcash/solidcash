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
    const refusals = publishedRefusals(compileStringMulti(source, { composition: 'per-call', ...options }) as
      Record<string, { composition?: unknown }>);
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
  it('is refused by name: the recipient lock is a run-time value', () => {
    // `address(this).balance` is read by the SafeERC20 guard; the send it guards has no fixed send list.
    const source = 'pragma solidcash ^0.13.0;'
      + ' contract Sender { function pay(address to) { this.transfer(to, 1000); require(true); } }';
    const message = refusal(source);
    expect(message).toContain('PER_CALL_CODEGEN_UNAVAILABLE');
    expect(message).toContain('a value send is a listed send only when its recipient is a user address');
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
  it('refuses an entry that returns a struct', () => {
    const source = 'pragma solidcash ^0.13.0;'
      + ' struct Pair { int x; int y; }'
      + ' contract Returns { function f() returns (Pair) { return Pair(1, 2); } }';
    const message = refusal(source);
    expect(message).toContain('PER_CALL_CODEGEN_UNAVAILABLE');
    expect(message).toContain("the entry point 'f' returns a struct");
  });

  // An entry that returns a fixed-size array is admitted, not refused: the array is one value the language holds
  // already encoded, so the frame records the words the entry's own `return` built and compares them. The accept
  // and its refusals are machine cases in `solidc/test/per-call/master/composite-return.test.ts`.
  //
  // A call that passes a struct argument is admitted too, whether the struct is built from run-time values or
  // written as a literal: the caller materializes one blob and the site's digest is the wire's. The accept, the
  // array argument in both spellings, and the one argument type that stays refused (an external function pointer)
  // are cases in `solidc/test/per-call/master/composed-arguments.test.ts`.
});

describe('a recovery precompile', () => {
  it('is refused by name: a compute side-car needs co-spent inputs', () => {
    // The row is the invalid-input cases of `ecrecover`; the shape is refused before any of them can run.
    const source = 'pragma solidcash ^0.13.0;'
      + ' contract Rec {'
      + '   function f(bytes32 h, int v, bytes32 r, bytes32 s) returns (address) { return ecrecover(h, v, r, s); }'
      + ' }';
    const message = refusal(source, { ecrecover: 'p2pkh' });
    expect(message).toContain('PER_CALL_CODEGEN_UNAVAILABLE');
    expect(message).toContain('a compute side-car needs co-spent inputs the master head does not locate');
  });
});

describe('a string-keyed string mapping', () => {
  it('is refused by name: its value witness is a hidden parameter the head does not supply', () => {
    const source = 'pragma solidcash ^0.13.0;'
      + ' contract Tags {'
      + '   mapping(string => string) public tags;'
      + '   function put(string k, string v) { this.tags[k] = v; require(true); }'
      + ' }';
    const message = refusal(source);
    expect(message).toContain('PER_CALL_CODEGEN_UNAVAILABLE');
    expect(message).toContain("the hidden parameter '__internal__valueWitness_0'");
  });
});
