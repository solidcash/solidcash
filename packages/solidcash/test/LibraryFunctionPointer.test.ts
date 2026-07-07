import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, TransactionBuilder, getContractFactory } from '../src/index.js';
import { randomUtxo } from '../src/utils.js';
import { createTestProvider, verifyTransaction, fundedSigner } from './test-util.js';

// A namespaced library function used as a VALUE (`ptr = L.f`): FieldAccess(L, f) now rewrites to the flat
// registered name so the function-pointer path resolves it (functionId + OP_INVOKE). Mirrors solc's
// internal_library_function_pointer.sol (g() -> 66) and the constructor-stored state fn-pointer variant.
const LOCAL_PTR_SOURCE = `
library L {
    function f() internal returns (uint) {
        return 66;
    }
}
contract C {
    function g() public {
        function() internal returns(uint) ptr;
        ptr = L.f;
        require(ptr() == 66);
    }
    function gWrong() public {
        function() internal returns(uint) ptr;
        ptr = L.f;
        require(ptr() == 67);
    }
}`;

const STATE_PTR_SOURCE = `
library L {
    function x() internal returns (uint256) {
        return 7;
    }
}
contract C {
    function() returns (uint256) internal x;

    constructor() {
        x = L.x;
    }

    function t() public {
        require(x() == 7);
    }
}`;

describe('library function as a function-pointer value (VM-verified)', () => {
  it('ptr = L.f; ptr() returns the library value', async () => {
    const provider = createTestProvider();
    const contract = new Contract(compileString(LOCAL_PTR_SOURCE, { solidityImportCompat: true }), [], { provider });
    await provider.addUtxo(contract.address, randomUtxo());
    const [utxo] = await provider.getUtxos(contract.address);
    const tx = new TransactionBuilder({ provider })
      .addInput(utxo, contract.unlock.g())
      .addOutput({ to: contract.address, amount: 10000n });
    expect(() => verifyTransaction(tx)).not.toThrow();
  });

  it('rejects a wrong expected value (guard against vacuous pass)', async () => {
    const provider = createTestProvider();
    const contract = new Contract(compileString(LOCAL_PTR_SOURCE, { solidityImportCompat: true }), [], { provider });
    await provider.addUtxo(contract.address, randomUtxo());
    const [utxo] = await provider.getUtxos(contract.address);
    const tx = new TransactionBuilder({ provider })
      .addInput(utxo, contract.unlock.gWrong())
      .addOutput({ to: contract.address, amount: 10000n });
    expect(() => verifyTransaction(tx)).toThrow();
  });

  it('constructor-stored state fn-pointer to a library function invokes correctly', async () => {
    const sc = await getContractFactory(
      compileString(STATE_PTR_SOURCE, { solidityImportCompat: true }), await fundedSigner(),
    ).deploy();
    await expect(sc.t()).resolves.toBeDefined();
  });
});
