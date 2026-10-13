import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract, TransactionBuilder } from '../../src/index.js';
import { createTestProvider } from '../test-util.js';
import { aliceAddress } from '../fixture/vars.js';

// `test/libsolidity/semanticTests/array/fixed_arrays_as_return_type.sol`: the callee builds a bounded memory
// vector by element writes (`arr[0] = input; arr[1] = ++input; ..`) and returns it. The deploy-then-call fold has
// to replay exactly that - the element writes, the increment used as a value, and the named-return fall-through -
// and the values it folds must be the ones the callee would have produced. The compiler-side pin is
// packages/solidc/test/DeployFoldArrayResult.test.ts; this runs the emitted script on the mock VM.
describe('deploy-then-call whose callee builds a bounded array result', () => {
  // The callee is pure and stateless, so the fold has no state transition to carry: only the returned vector.
  const source = (checks: string): string => 'contract A {\n'
    + '    function f(uint16 input) public pure returns (uint16[5] memory arr) {\n'
    + '        arr[0] = input;\n'
    + '        arr[1] = ++input;\n'
    + '        arr[2] = ++input;\n'
    + '        arr[3] = ++input;\n'
    + '        arr[4] = ++input;\n'
    + '    }\n'
    + '}\n'
    + 'contract B {\n'
    + '    function check() public {\n'
    + '        A a = new A();\n'
    + '        uint16[5] memory res = a.f(2);\n'
    + checks
    + '        uint16[5] memory res2 = a.f(1000);\n'
    + '        require(res2[0] == 1000 && res2[1] == 1001 && res2[2] == 1002 && res2[3] == 1003 && res2[4] == 1004);\n'
    + '    }\n'
    + '}\n';

  const spend = async (checks: string): Promise<void> => {
    const artifact = compileString(source(checks), { evmCompat: true, enforceFinalRequire: false });
    const provider = createTestProvider();
    const contract = new Contract(artifact, [], { provider });
    const utxo = { txid: 'ac'.repeat(32), vout: 0, satoshis: 100000n };
    await provider.addUtxo(contract.address, utxo);
    await new TransactionBuilder({ provider })
      .addInput(utxo, contract.unlock.check())
      .addOutput({ to: aliceAddress, amount: 90000n })
      .send();
  };

  it('folds the vector the callee builds, element by element', async () => {
    await expect(spend('        require(res[0] == 2 && res[1] == 3 && res[2] == 4 && res[3] == 5 && res[4] == 6);\n'))
      .resolves.toBeUndefined();
  });

  it('fails when an element the callee did not store is required (the fold is not a zero vector)', async () => {
    // res[1] is 3, so requiring 4 must fail: a fold that returned the type default, or that replayed the writes
    // without the increments, would satisfy everything the pass must not.
    await expect(spend('        require(res[1] == 4);\n'))
      .rejects.toThrow(/Require statement failed|Error in transaction at input 0/);
  });

  it('keeps the increment chain: the second call folds from its own argument', async () => {
    await expect(spend('        require(res[4] == 6);\n'))
      .resolves.toBeUndefined();
  });
});
