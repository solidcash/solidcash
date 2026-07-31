import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { binToHex, hexToBin } from '@bitauth/libauth';
import { sidecarLockingBytecode, SHARED_LIBRARY_SALT, resolveLibraryBlob } from '@solidcash/utils';
import { Contract, TransactionBuilder } from '../src/index.js';
import { randomUtxo } from '../src/utils.js';
import { createTestProvider, createFeeFunder } from './test-util.js';

// A user-supplied external library: OP_1ADD callable as inc(int) -> int. Proves the SDK handles ANY
// library (not just the built-in keccak256), both inlined into the contract and co-spent as a side-car.
const INC_LIBRARY = {
  name: 'inc',
  code: '8b', // OP_1ADD
  abi: { inputs: [{ name: 'x', type: 'int' }], outputs: [{ type: 'int' }] },
};

const SOURCE = `
contract UserLib() {
    function check(int n, int expected) {
        require(inc(n) == expected);
    }
}`;

const incBlob = hexToBin(INC_LIBRARY.code);
const sidecarLockHex = binToHex(sidecarLockingBytecode(incBlob, SHARED_LIBRARY_SALT));

// Inlined library: the blob is baked into the contract, so no side-car is deployed or co-spent.
async function spendInlined(n: bigint, expected: bigint): Promise<string> {
  const provider = createTestProvider();
  const artifact = compileString(SOURCE, { userLibraries: [INC_LIBRARY] });
  expect(artifact.externalLibraries![0].inline).toBe(true);
  const contract = new Contract(artifact, [], { provider });

  const contractUtxo = await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
  const feeFunder = await createFeeFunder(provider, 20000n);

  const tx = await new TransactionBuilder({ provider })
    .addInput(contractUtxo, contract.unlock.check(n, expected))
    .addInput(feeFunder.utxo, feeFunder.unlocker)
    .addOutput({ to: contract.address, amount: 110000n })
    .send();
  return tx.txid;
}

// Side-car library: forced off inlining, so the SDK co-spends the side-car from the artifact descriptor.
async function spendViaSidecar(n: bigint, expected: bigint): Promise<string> {
  const provider = createTestProvider();
  const artifact = compileString(SOURCE, { userLibraries: [INC_LIBRARY], inlineLibraries: { inc: false } });
  expect(artifact.externalLibraries![0].inline).toBe(false);
  const contract = new Contract(artifact, [], { provider });

  await provider.addUtxo(sidecarLockHex, randomUtxo({ satoshis: 5000n }));
  const contractUtxo = await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
  const feeFunder = await createFeeFunder(provider, 20000n);

  const tx = await new TransactionBuilder({ provider })
    .addInput(contractUtxo, contract.unlock.check(n, expected))
    .addInput(feeFunder.utxo, feeFunder.unlocker)
    .addOutput({ to: contract.address, amount: 110000n })
    // send() auto-co-spends the user-library side-car (last input) + recreates it (last output)
    .send();
  return tx.txid;
}

describe('user external library (inlined) e2e', () => {
  it('embeds the user blob so the SDK can resolve it from the artifact', () => {
    const artifact = compileString(SOURCE, { userLibraries: [INC_LIBRARY] });
    expect(resolveLibraryBlob(artifact.externalLibraries![0])).toEqual(incBlob);
  });

  it('inlines the library and computes inc(n) without a side-car', async () => {
    const txid = await spendInlined(5n, 6n);
    expect(txid).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects a wrong expected value (inlined)', async () => {
    await expect(spendInlined(5n, 7n)).rejects.toThrow(
      /UserLib\.scash:4 Require statement failed at input 0/,
    );
  });
});

describe('user external library (side-car) e2e', () => {
  it('co-spends a user-library side-car and computes inc(n)', async () => {
    const txid = await spendViaSidecar(5n, 6n);
    expect(txid).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects a wrong expected value (side-car)', async () => {
    await expect(spendViaSidecar(5n, 7n)).rejects.toThrow(
      /mandatory-script-verify-flag-failed .*input index 0: Unsuccessful evaluation/,
    );
  });
});
