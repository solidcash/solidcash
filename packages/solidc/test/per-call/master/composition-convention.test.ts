import { describe, expect, it } from 'vitest';
import { compileString } from '../../../src/compiler.js';

const STATE_CONTRACT = 'pragma solidcash ^0.13.0;'
  + ' contract Counter(pubkey admin) {'
  + '   int public counter;'
  + '   function increment(sig s) {'
  + '     require(checkSig(s, admin));'
  + '     this.counter = this.counter + 1;'
  + '   }'
  + ' }';

/** Two entry points: one master head, and the dispatcher picks the entry the unlocking selector names. */
const TWO_ENTRY_CONTRACT = 'pragma solidcash ^0.13.0;'
  + ' contract TwoEntry {'
  + '   int public counter;'
  + '   function inc() { this.counter = this.counter + 1; }'
  + '   function dec() { this.counter = this.counter - 1; }'
  + ' }';

/** A returning entry point: the computed value is not yet settled against the witness `retval`. */
const RETURNING_CONTRACT = 'pragma solidcash ^0.13.0;'
  + ' contract Answer {'
  + '   function answer() returns (int) { return 42; }'
  + ' }';

const codeOf = (run: () => unknown): string | undefined => {
  try {
    run();
    return undefined;
  } catch (error) {
    return (error as { code?: string }).code;
  }
};

const messageOf = (run: () => unknown): string => {
  try {
    run();
    return '';
  } catch (error) {
    return (error as Error).message;
  }
};

describe('composition convention selection', () => {
  it('compiles the direct convention when none is requested', () => {
    expect(() => compileString(STATE_CONTRACT)).not.toThrow();
  });

  it('compiles the direct convention when it is requested explicitly, to the same bytecode', () => {
    const implicit = compileString(STATE_CONTRACT);
    const explicit = compileString(STATE_CONTRACT, { composition: 'direct' });
    expect(explicit.bytecode).toBe(implicit.bytecode);
  });

  it('compiles the per-call convention to a master, not to the direct script', () => {
    const direct = compileString(STATE_CONTRACT, { composition: 'direct' });
    const perCall = compileString(STATE_CONTRACT, { composition: 'per-call' });
    expect(perCall.composition?.convention).toBe('per-call');
    expect(perCall.bytecode).not.toBe(direct.bytecode);
  });

  it('compiles a contract with several entry points to one master, dispatched by selector', () => {
    const artifact = compileString(TWO_ENTRY_CONTRACT, { composition: 'per-call' });
    expect(artifact.composition?.convention).toBe('per-call');
    expect(artifact.abi.map((entry) => entry.name).sort()).toEqual(['dec', 'inc']);
  });

  it('refuses a shape a master cannot be emitted for, by name', () => {
    const code = codeOf(() => compileString(RETURNING_CONTRACT, { composition: 'per-call' }));
    expect(code).toBe('PER_CALL_CODEGEN_UNAVAILABLE');
  });

  it('names the shape that was refused', () => {
    expect(messageOf(() => compileString(RETURNING_CONTRACT, { composition: 'per-call' })))
      .toContain('retval');
  });

  it('still compiles a refused shape under the direct convention', () => {
    expect(() => compileString(RETURNING_CONTRACT)).not.toThrow();
  });

  it('refuses an unknown convention by name instead of falling back', () => {
    const code = codeOf(() => compileString(STATE_CONTRACT, { composition: 'percall' as 'per-call' }));
    expect(code).toBe('PER_CALL_CODEGEN_UNAVAILABLE');
  });

  it('names the offending value when a convention is unknown', () => {
    const message = messageOf(() => compileString(STATE_CONTRACT, { composition: 'nope' as 'per-call' }));
    expect(message).toContain('nope');
    expect(message).toContain('direct');
  });
});
