import { describe, expect, it } from 'vitest';

import { compileStringMulti } from '../../src/compiler.js';

/**
 * FRAMED-CONT-1 (docs/security/security-audit-2026-10-16.md): a framed container is built without a master-lock output
 * pin (the lock must survive an upgrade), so a *standalone* frame is the only place its co-spent containers are
 * accounted for. The master used to run that accounting only when the body handled value, which let any plain
 * setter be spent beside the satoshi container and drain it. The standalone branch now always requires container
 * growth `>= 0` for a body that handles no value.
 *
 * A full adversarial framed spend needs a validator-free composition plan, a re-signed caller and a mutated
 * broadcast; the value harness (`test/framed/call/value-harness.ts`) drives the shipped call path, and this test
 * pins the shipped master script that path executes.
 */
const asmOf = (bytecode: string | { bytecode: string }): string =>
  (typeof bytecode === 'string' ? bytecode : bytecode.bytecode).toLowerCase();

/** `containerGrowthScript`'s last loop step, then the `>= 0` refusal this fix adds. */
const GROWTH_RULE =
  'op_greaterthanorequal op_until op_drop op_nip op_0 op_greaterthanorequal op_verify';

const SOURCE = `
contract Vault(pubkey admin) {
  int count;
  function set(sig s, int v) { require(checkSig(s, admin)); this.count = v; }
}`;

describe('FRAMED-CONT-1: standalone no-value frames account for their containers', () => {
  it('emits the container-growth rule in the master script', () => {
    const artifacts = compileStringMulti(SOURCE, { composition: 'framed', suppressWarnings: true });
    const master = artifacts.Vault!;
    expect(master).toBeDefined();
    expect(asmOf(master.bytecode)).toContain(GROWTH_RULE);
    // The lock derivation itself, so the check is against this contract's own category containers.
    expect(asmOf(master.bytecode)).toContain('op_inputindex op_utxotokencategory 20 op_split op_drop 20 op_swap op_cat');
  });

});
