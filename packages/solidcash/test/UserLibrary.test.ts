import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { binToHex, hexToBin } from '@bitauth/libauth';
import { sidecarLockingBytecode, SHARED_LIBRARY_SALT, resolveLibraryBlob } from '@solidcash/utils';
import { Contract, TransactionBuilder } from '../src/index.js';
import { randomUtxo } from '../src/utils.js';
import { createTestProvider, createFeeFunder } from './test-util.js';

// A user-supplied external library: OP_1ADD callable as inc(int) -> int. Proves the SDK builds and
// co-spends a side-car for ANY library from the artifact descriptor (the blob is embedded as `code`),
// not just the built-in keccak256.
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

async function spendInc(n: bigint, expected: bigint): Promise<string> {
  const provider = createTestProvider();
  const artifact = compileString(SOURCE, { userLibraries: [INC_LIBRARY] });
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

describe('user external library (side-car) e2e', () => {
  it('embeds the user blob so the SDK can resolve it from the artifact', () => {
    const artifact = compileString(SOURCE, { userLibraries: [INC_LIBRARY] });
    expect(resolveLibraryBlob(artifact.externalLibraries![0])).toEqual(incBlob);
  });

  it('co-spends a user-library side-car and computes inc(n)', async () => {
    const txid = await spendInc(5n, 6n);
    expect(txid).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects a wrong expected value', async () => {
    await expect(spendInc(5n, 7n)).rejects.toThrow();
  });
});
