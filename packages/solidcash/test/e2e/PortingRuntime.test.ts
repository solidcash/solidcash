import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, TransactionBuilder } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, gatherUtxos } from '../test-util.js';

// Runtime (e2e) coverage for recent porting features: ++/-- on element lvalues, the empty-void function
// no-op synthesis, and `transient` state vars (lowered to zero-init locals). Each contract asserts its own
// behavior via require(), so a successful spend proves the feature works end-to-end through the SDK
// (compile -> build -> VM-verify -> send).
async function spend(
  source: string,
  opts: Parameters<typeof compileString>[1],
  unlock: (c: Contract) => ReturnType<Contract['unlock'][string]>,
): Promise<{ txid: string }> {
  const provider = createTestProvider();
  const contract = new Contract(compileString(source, opts), [], { provider });
  await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
  await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
  const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount: 1000n });
  return new TransactionBuilder({ provider })
    .addInputs(utxos, unlock(contract))
    .addOutput({ to: contract.address, amount: 1000n })
    .addOutput({ to: contract.address, amount: changeAmount })
    .send();
}

describe('++ / -- on element lvalues (runtime)', () => {
  it('increments and decrements an array element correctly on chain', async () => {
    const source = `contract C() {
      function f() {
        int[3] a = [10, 20, 30];
        a[0]++;
        a[2]--;
        require(a[0] == 11);
        require(a[2] == 29);
      }
    }`;
    const tx = await spend(source, {}, (c) => c.unlock.f());
    expect(tx.txid).toBeDefined();
  });

  it('rejects when the post-increment value is wrong (the ++ really runs)', async () => {
    const source = `contract C() {
      function f() { int[2] a = [5, 5]; a[0]++; require(a[0] == 5); }
    }`;
    await expect(spend(source, {}, (c) => c.unlock.f())).rejects.toThrow();
  });
});

describe('empty void functions (runtime; Solidity porting)', () => {
  it('spends a synthesized empty payable function', async () => {
    const source = 'pragma solidity ^0.8.0; contract C { function ping() public payable {} }';
    const tx = await spend(source, { solidityImportCompat: true }, (c) => c.unlock.ping());
    expect(tx.txid).toBeDefined();
  });

  it('spends a contract whose only spend path is an empty receive()', async () => {
    const source = 'pragma solidity ^0.8.0; contract C { receive() external payable {} }';
    const tx = await spend(source, { solidityImportCompat: true }, (c) => c.unlock.__receive());
    expect(tx.txid).toBeDefined();
  });
});

describe('transient state variables (runtime; EIP-1153 porting)', () => {
  it('spends a transient zero-init guard (locked starts at 0 each spend)', async () => {
    const source = `pragma solidity ^0.8.24;
      contract C {
        uint256 transient locked;
        function enter() public {
          require(locked == 0);
          locked = 1;
          require(locked == 1);
        }
      }`;
    const tx = await spend(source, { solidityImportCompat: true }, (c) => c.unlock.enter());
    expect(tx.txid).toBeDefined();
  });

  it('always reads 0 - transient does not persist, so code assuming persistence can never spend', async () => {
    const source = `pragma solidity ^0.8.24;
      contract C {
        uint256 transient flag;
        function checkPersisted() public { require(flag == 1); }
      }`;
    await expect(spend(source, { solidityImportCompat: true }, (c) => c.unlock.checkPersisted())).rejects.toThrow();
  });

  it('uses a transient var as scratch within a function', async () => {
    const source = `pragma solidity ^0.8.24;
      contract C {
        uint256 transient acc;
        function add(uint256 a, uint256 b) public {
          acc = a;
          acc = acc + b;
          require(acc == a + b);
        }
      }`;
    const tx = await spend(source, { solidityImportCompat: true }, (c) => c.unlock.add(3n, 4n));
    expect(tx.txid).toBeDefined();
  });
});
