import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { refusalOf } from '../../../../solidc/test/per-call/master/refused-entry.js';

/**
 * A proxy, and the delegatecall it is built from, do not compile for per-call composition.
 *
 * The design binds a proxied call to the proxy's own settled implementation, so the proxy's master reads the
 * implementation from its state and names it as the delegate target. That shape is not emitted yet: a contract
 * whose fallback dispatches is refused because the master head cannot precede a selector-dispatched fallback, and a
 * body that issues a delegatecall is refused because the witness call records it would need are not emitted. There
 * is therefore no spend to mutate, and the refusal is pinned by name here instead.
 */

/** The compile's thrown diagnostic, or an error when the convention served the source. */
function thrownOf(source: string, options: Record<string, unknown> = {}): { code?: string; message: string } {
  try {
    compileString(source, { composition: 'per-call', ...options });
  } catch (error) {
    return { code: (error as { code?: string }).code, message: (error as Error).message };
  }
  throw new Error('the shipped per-call compiler served the source, so there is no refusal to record');
}

describe('a proxy does not compile for per-call composition', () => {
  it('refuses a fallback that dispatches, by name', () => {
    const source = 'pragma solidcash ^0.13.0;'
      + ' contract Proxy {'
      + '   address implementation;'
      + '   fallback(bytes input) external { address(this).delegatecall(input); require(true); }'
      + ' }';
    const refusal = thrownOf(source);
    expect(refusal.code).toBe('PER_CALL_CODEGEN_UNAVAILABLE');
    expect(refusal.message).toContain('fallback and receive make the contract dispatch by selector');
  });

  it('refuses a body that issues a delegatecall, by name', () => {
    // The delegatecall target here is a caller-supplied parameter, so the compiler's delegatecall security gate has
    // to be lifted before the per-call shape is reached. The per-call refusal is the one recorded.
    const source = 'pragma solidcash ^0.13.0;'
      + ' contract Proxy { function set(address target, bytes data) { target.delegatecall(data); require(true); } }';
    const refusal = refusalOf(source, undefined, { allowUnsafeOperations: true });
    expect(refusal.code).toBe('PER_CALL_CODEGEN_UNAVAILABLE');
    expect(refusal.message).toContain('a low-level call needs the witness `calls[]` checks, which are not emitted yet');
  });

  it('refuses an unbound delegatecall target before the per-call shape is reached', () => {
    // The same body without the unsafe opt-out: the delegatecall security gate names the proxy's identity problem.
    const source = 'pragma solidcash ^0.13.0;'
      + ' contract Proxy { function set(address target, bytes data) { target.delegatecall(data); require(true); } }';
    const refusal = thrownOf(source);
    expect(refusal.code).toBeUndefined();
    expect(refusal.message).toContain("whose identity is controlled by the caller");
  });
});
