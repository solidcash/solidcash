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

const codeOf = (run: () => unknown): string | undefined => {
  try {
    run();
    return undefined;
  } catch (error) {
    return (error as { code?: string }).code;
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

  it('refuses the per-call convention rather than emitting the other one', () => {
    const code = codeOf(() => compileString(STATE_CONTRACT, { composition: 'per-call' }));
    expect(code).toBe('PER_CALL_CODEGEN_UNAVAILABLE');
  });

  it('refuses an unknown convention by name instead of falling back', () => {
    const code = codeOf(() => compileString(STATE_CONTRACT, { composition: 'percall' as 'per-call' }));
    expect(code).toBe('PER_CALL_CODEGEN_UNAVAILABLE');
  });

  it('names the offending value when a convention is unknown', () => {
    let message = '';
    try {
      compileString(STATE_CONTRACT, { composition: 'nope' as 'per-call' });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('nope');
    expect(message).toContain('direct');
  });
});
