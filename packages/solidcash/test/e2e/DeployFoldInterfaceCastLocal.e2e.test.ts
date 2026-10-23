import { describe, it, expect } from 'vitest';
import { compileString } from '@solidcash/solidc';
import { Contract, TransactionBuilder } from '../../src/index.js';
import { createTestProvider } from '../test-util.js';
import { aliceAddress } from '../fixture/vars.js';

// A local bound to a fresh deploy through an interface cast (`I i = I(new A())`) names the same contract as the
// direct `A a = new A()` binding, so a call on it folds into the deploy instead of planning a co-spend of a
// contract this transaction only creates. Shape of the solc semantic tests
// inheritance/inherited_function_calldata_{calldata,memory}_interface.sol (`g() -> 42`).
const OPTIONS = { evmCompat: true, enforceFinalRequire: false };

const CALLDATA = 'function f(uint256[] calldata) external override returns (uint256)';
const MEMORY = 'function f(uint256[] memory) public override returns (uint256)';

const source = (implementation: string, params: string, body: string, extra = ''): string => `${extra}interface I {
    function f(uint256[] calldata a) external returns (uint256);
}
contract A is I {
    ${implementation} { return 42; }
}
contract B {
    function check(${params}) public {
${body}
    }
}
`;

const CAST_LOCAL = '        I i = I(new A());\n        require(i.f(new uint256[](2)) == expected);';

describe('deploy-then-call on a local bound through an interface cast', () => {
  const spend = async (implementation: string, expected: bigint): Promise<void> => {
    const artifact = compileString(source(implementation, 'uint256 expected', CAST_LOCAL), OPTIONS);
    const provider = createTestProvider();
    const contract = new Contract(artifact, [], { provider });
    const utxo = { txid: 'ad'.repeat(32), vout: 0, satoshis: 100000n };
    await provider.addUtxo(contract.address, utxo);
    await new TransactionBuilder({ provider })
      .addInput(utxo, contract.unlock.check(expected))
      .addOutput({ to: aliceAddress, amount: 90000n })
      .send();
  };

  it.each([['calldata', CALLDATA], ['memory', MEMORY]])('folds the %s implementation result', async (_, impl) => {
    await expect(spend(impl, 42n)).resolves.toBeUndefined();
  });

  it('fails when another value is required (the fold is the callee result, not a default)', async () => {
    await expect(spend(CALLDATA, 41n)).rejects.toThrow(/Require statement failed|Error in transaction at input 0/);
  });

  it('refuses a cast whose interface declares other results than the deployed body', () => {
    const wide = 'interface J {\n    function f(uint256[] calldata a) external returns (uint256, uint256);\n}\n';
    const body = '        J j = J(address(new A()));\n'
      + '        (uint256 x, uint256 y) = j.f(new uint256[](2));\n'
      + '        require(x + y == expected);';
    expect(() => compileString(source(CALLDATA, 'uint256 expected', body, wide), OPTIONS))
      .toThrow(/Cannot call 'f\(\)' on 'j' in the transaction that deploys it with 'new A\(\.\.\.\)'/);
  });

  it('unbinds the deploy when the local is reassigned, so the call stays external', () => {
    const body = '        I i = I(new A());\n        i = I(target);\n        require(i.f(new uint256[](2)) == expected);';
    const artifact = compileString(source(CALLDATA, 'address target, uint256 expected', body), OPTIONS);
    expect(artifact.abi.find((fn) => fn.name === 'check')?.externalCalls?.length).toBe(1);
  });
});
