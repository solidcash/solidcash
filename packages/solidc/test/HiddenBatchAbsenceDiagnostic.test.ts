import { describe, expect, it } from 'vitest';
import { compileString } from '../src/compiler.js';

/**
 * X15 - a requested hidden-batch route that is not synthesized must say so.
 *
 * Route synthesis records one stable rejection reason per entry point, but the only channel that published
 * those reasons was `hiddenBatch.handlers`, which is not built when no entry point survives. A contract whose
 * every handler was rejected therefore reached the user as an artifact with `hiddenBatch` absent and NO
 * diagnostic string at all - silence, not a refusal. Worker C hit this building L1 and routed around it.
 *
 * Each case below pairs the silent shape with an honest control that differs in exactly one field.
 */

const DIAGNOSTIC_CODE = 'hidden-batch-route-not-synthesized';

const batchOnly = { forceStateful: true, experimentalHiddenBatch: true };
const graph = {
  ...batchOnly,
  experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
  experimentalMessageBusControllerCategory: '22'.repeat(32),
};

const caller = (body: string): string => `pragma solidcash >=0.8.0;
interface ISink { function ping(int amount) external; }
contract X15Caller(address sink) {
  mapping(address => bigint) balances;
  bigint total;
${body}
}`;

/** Persisted state written IN the called function, plus an external call - the shape X15 names. */
const stateWriteAndCall = caller(`  function push(address who, int amount) public {
    this.balances[who] = this.balances[who] + amount;
    ISink(sink).ping(amount);
    require(true);
  }`);

const absenceDiagnostics = (code: string, options: object): { severity: string; code: string; message: string }[] =>
  (compileString(code, options).diagnostics ?? []).filter((entry) => entry.code === DIAGNOSTIC_CODE);

describe('X15 hidden-batch route absence is stated, not silent', () => {
  it('names the reason for a handler that writes state and makes an external call', () => {
    const artifact = compileString(stateWriteAndCall, batchOnly);
    expect(artifact.hiddenBatch).toBeUndefined();
    const stated = absenceDiagnostics(stateWriteAndCall, batchOnly);
    expect(stated).toHaveLength(1);
    expect(stated[0].severity).toBe('error');
    expect(stated[0].message).toContain("'push': batched-handler-forward-call-not-enabled");
    expect(stated[0].message).toContain('it has no SCB1 entry point and cannot participate in a message bus');
  });

  it('tells the user what to do instead of the refused shape', () => {
    expect(absenceDiagnostics(stateWriteAndCall, batchOnly)[0].message)
      .toContain('supply experimentalMessageBusController with its experimentalMessageBusControllerCategory');
  });

  /**
   * The control differs from the case above in exactly one field - the graph controller option - and the SAME
   * source is admitted. That is what makes the refusal a property of the requested route rather than of the
   * handler shape.
   */
  it('CONTROL: the identical source with a graph controller is admitted and carries no diagnostic', () => {
    const artifact = compileString(stateWriteAndCall, graph);
    expect(artifact.hiddenBatch?.handlers.find((handler) => handler.name === 'push')?.eligible).toBe(true);
    expect(absenceDiagnostics(stateWriteAndCall, graph)).toHaveLength(0);
  });

  it('names the reason for a forwarding handler with no final require', () => {
    const source = caller(`  function push(int amount) public {
    total = total + amount;
    ISink(sink).ping(amount);
  }`);
    expect(compileString(source, graph).hiddenBatch).toBeUndefined();
    expect(absenceDiagnostics(source, graph)[0].message)
      .toContain("'push': batched-handler-forward-call-not-enabled");
  });

  it('names the reason for a forwarding handler that returns a value', () => {
    const source = caller(`  function push(int amount) public returns (int) {
    total = total + amount;
    ISink(sink).ping(amount);
    return total;
  }`);
    expect(compileString(source, graph).hiddenBatch).toBeUndefined();
    expect(absenceDiagnostics(source, graph)[0].message)
      .toContain("'push': batched-handler-forward-call-not-enabled");
  });

  it('states the absence for a contract with no entry point at all', () => {
    const source = `pragma solidcash >=0.8.0;
contract X15NoEntry() {
  bigint total;
  constructor() { total = 1; }
}`;
    expect(absenceDiagnostics(source, graph)[0].message)
      .toContain('The contract declares no entry point for a route to admit');
  });

  it('stays quiet when a route exists', () => {
    const source = caller('  function bump(int amount) public { total = total + amount; require(amount >= 0); }');
    expect(compileString(source, graph).hiddenBatch).toBeDefined();
    expect(absenceDiagnostics(source, graph)).toHaveLength(0);
  });

  it('stays quiet when no hidden batch was requested', () => {
    expect(compileString(stateWriteAndCall, { forceStateful: true }).hiddenBatch).toBeUndefined();
    expect(absenceDiagnostics(stateWriteAndCall, { forceStateful: true })).toHaveLength(0);
  });

  /**
   * A partially rejected route already published its reasons through `hiddenBatch.handlers`; the new
   * diagnostic must not duplicate them, or every mixed contract would carry a false "no route" claim.
   */
  it('does not fire when only some handlers are rejected', () => {
    const source = caller(`  function bump(int amount) public { total = total + amount; require(amount >= 0); }
  function peek(int amount) external { require(amount >= 0); }`);
    const artifact = compileString(source, graph);
    expect(artifact.hiddenBatch?.handlers.find((handler) => handler.name === 'peek'))
      .toMatchObject({ eligible: false, rejectionReason: 'initial-v1-route-requires-public-visibility' });
    expect(absenceDiagnostics(source, graph)).toHaveLength(0);
  });
});
