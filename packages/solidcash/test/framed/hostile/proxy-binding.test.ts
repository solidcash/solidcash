import { describe, expect, it } from 'vitest';
import { compileString } from '../../../../solidc/src/compiler.js';
import { refusalOf } from '../../../../solidc/test/framed/master/refused-entry.js';

/**
 * Which proxy shapes compile for framed composition, and which are refused by name.
 *
 * The design binds a proxied call to the proxy's own settled implementation: the proxy's master reads the
 * implementation from its state and names it as the delegate target, forwarding the call data it received. A
 * contract whose *only* body is such a fallback now compiles, and the toy drives the compiled shape; any other
 * fallback is dispatched to for a selector no entry has, as the EVM's is. A delegatecall whose call data is not the
 * entry's own, or whose target the contract does not hold, is refused, since the witness call record it would need
 * is not emitted. Wherever a shape is refused there is no spend to mutate, so the refusal is pinned by name.
 */

/** The compile's thrown diagnostic, or an error when the convention served the source. */
function thrownOf(source: string, options: Record<string, unknown> = {}): { code?: string; message: string } {
  try {
    compileString(source, { composition: 'framed', ...options });
  } catch (error) {
    return { code: (error as { code?: string }).code, message: (error as Error).message };
  }
  throw new Error('the shipped framed compiler served the source, so there is no refusal to record');
}

describe('a proxy does not compile for framed composition', () => {
  it('refuses a fallback that delegates to itself, by name', () => {
    const source = 'pragma solidcash ^0.14.0;'
      + ' contract Proxy {'
      + '   address implementation;'
      + '   fallback(bytes input) external { address(this).delegatecall(input); require(true); }'
      + ' }';
    const refusal = refusalOf(source);
    expect(refusal.code).toBe('FRAMED_CODEGEN_UNAVAILABLE');
    expect(refusal.message).toBe('Proxy.__fallback(): a low-level call needs the witness `calls[]` checks, which '
      + 'are not emitted yet');
  });

  it('serves the fallback that forwards its own call data, which is the proxy the toy drives', () => {
    // The one delegatecall shape the convention emits: the entry's own received call data is forwarded unchanged to
    // an implementation the contract's own state names. Compiling it is the point of this case, so an error is the
    // failure.
    const source = 'pragma solidcash ^0.14.0;'
      + ' contract Proxy {'
      + '   address implementation;'
      + '   fallback(bytes input) external { implementation.delegatecall(input); require(true); }'
      + ' }';
    expect(() => compileString(source, { composition: 'framed' })).not.toThrow();
  });

  it('refuses a delegatecall whose call data is not the entry\'s own, by name', () => {
    // The target here is a caller-supplied parameter and the data is a constant, so the compiler's delegatecall
    // security gate has to be lifted before the framed shape is reached. The framed refusal is the one recorded:
    // a forwarded call carries the entry's own received call data, and this one carries something else.
    const source = 'pragma solidcash ^0.14.0;'
      + ' contract Proxy { function set(address target) { target.delegatecall(hex"aabbccdd"); require(true); } }';
    const refusal = refusalOf(source, undefined, { allowUnsafeOperations: true });
    expect(refusal.code).toBe('FRAMED_CODEGEN_UNAVAILABLE');
    expect(refusal.message).toContain('a low-level call needs the witness `calls[]` checks, which are not emitted yet');
  });

  it('refuses an ordinary entry that forwards its own parameter, which only a fallback may do', () => {
    // The same data operand and the same origin, but reached through an entry a selector names rather than the
    // fallback: the convention serves one shape - the fallback the whole contract is - and refuses the rest.
    const source = 'pragma solidcash ^0.14.0;'
      + ' contract Proxy { address implementation;'
      + '   function set(bytes data) { implementation.delegatecall(data); require(true); } }';
    const refusal = refusalOf(source, undefined, { allowUnsafeOperations: true });
    expect(refusal.code).toBe('FRAMED_CODEGEN_UNAVAILABLE');
    expect(refusal.message).toContain('a low-level call needs the witness `calls[]` checks, which are not emitted yet');
  });

  it('refuses an unbound delegatecall target before the framed shape is reached', () => {
    // The same body without the unsafe opt-out: the delegatecall security gate names the proxy's identity problem.
    const source = 'pragma solidcash ^0.14.0;'
      + ' contract Proxy { function set(address target, bytes data) { target.delegatecall(data); require(true); } }';
    const refusal = thrownOf(source);
    expect(refusal.code).toBeUndefined();
    expect(refusal.message).toContain('whose identity is controlled by the caller');
  });
});
