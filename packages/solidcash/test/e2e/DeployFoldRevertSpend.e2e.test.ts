import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract, TransactionBuilder } from '../../src/index.js';
import { createTestProvider } from '../test-util.js';
import { aliceAddress } from '../fixture/vars.js';

// A deploy-then-call whose callee cannot complete (`test/libsolidity/semanticTests/errors/
// small_error_optimization.sol`) is lowered to that failure, so the spend must FAIL at run time - not quietly
// succeed with the child deployed. The compiler-side signal is pinned in
// packages/solidc/test/DeployFoldRevertingCallee.test.ts; this runs the emitted script on the mock VM, with the
// foldable callee as the control that the harness itself succeeds.
describe('deploy-then-call whose callee cannot complete', () => {
  // The callee is STATELESS, so the deploy needs no child output and the spend isolates the call's outcome.
  const source = (body: string): string => `contract A { function f() public { ${body} } }\n`
    + 'contract B { function f() public { (new A()).f(); } }';

  const spend = async (callee: string): Promise<void> => {
    const artifact = compileString(source(callee), { evmCompat: true, enforceFinalRequire: false });
    const provider = createTestProvider();
    const contract = new Contract(artifact, [], { provider });
    const utxo = { txid: 'ab'.repeat(32), vout: 0, satoshis: 100000n };
    await provider.addUtxo(contract.address, utxo);
    await new TransactionBuilder({ provider })
      .addInput(utxo, contract.unlock.f())
      .addOutput({ to: aliceAddress, amount: 90000n })
      .send();
  };

  it('fails the spend instead of deploying the child', async () => {
    await expect(spend('revert();')).rejects.toThrow(/Error in transaction at input 0/);
  });

  it('succeeds for the same deploy-then-call when the callee can complete', async () => {
    await expect(spend('')).resolves.toBeUndefined();
  });
});
