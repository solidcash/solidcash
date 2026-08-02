import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract, StatefulContract } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

// Parse-level porting features that let ported Solidity sources compile: no-op pragmas (abicoder/experimental)
// and 2-part / wildcard version pragmas. Each is compiled AND run on the VM.
const PRAGMA_CASES: [string, string][] = [
  ['pragma abicoder v2', 'pragma abicoder v2;\ncontract C() { function f(int e) { require(e == 7); } }'],
  ['pragma experimental ABIEncoderV2', 'pragma experimental ABIEncoderV2;\ncontract C() { function f(int e) { require(e == 7); } }'],
  ['pragma solidity >=0.0', 'pragma solidity >=0.0;\ncontract C() { function f(int e) { require(e == 7); } }'],
  ['pragma solidity *', 'pragma solidity *;\ncontract C() { function f(int e) { require(e == 7); } }'],
];

describe('porting parse features', () => {
  const provider = createTestProvider();
  for (const [label, src] of PRAGMA_CASES) {
    it(`${label} compiles and runs`, async () => {
      const art = compileString(src, { solidityImportCompat: true, forceStateful: true });
      const contract = new Contract(art, [], { provider });
      const { categoryId } = await setupStatefulUtxos(provider, contract, art.stateLayout!, {}, { saltContract: true });
      const sc = StatefulContract.withCategory(contract, categoryId);
      const tx = await sc.f(7n).send();
      expect(tx.txid).toBeDefined();
      await expect(sc.f(8n).send())
        .rejects.toThrow('layer3: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation.');
    });
  }

  // State-var modifiers may appear in any order; `constant public` must produce the exact same contract as the
  // canonical `public constant`. Byte-identical bytecode is the precise proof that order is immaterial.
  it('state-var modifiers in any order compile identically', () => {
    const mk = (order: string): string => `contract C() { uint ${order} X = 7; function f(uint e) { require(X == e); } }`;
    const canonical = compileString(mk('public constant'), { solidityImportCompat: true, forceStateful: true }).bytecode;
    for (const order of ['constant public', 'public constant']) {
      expect(compileString(mk(order), { solidityImportCompat: true, forceStateful: true }).bytecode).toBe(canonical);
    }
  });
});
