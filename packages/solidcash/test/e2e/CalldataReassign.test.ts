import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, randomUtxo, TransactionBuilder } from '../../src/index.js';
import { createTestProvider, gatherUtxos } from '../test-util.js';

// A whole `x = y` rebind of a calldata array is allowed (Solidity pointer rebind); it reduces to a value-copy of
// y into x, so `x[i]` reads y[i]. DATA writes (x[i]=v) stay rejected. Was: CalldataModificationError on `x = y`.
describe('calldata pointer reassignment (x = y)', () => {
  const run = async (src: string, unlock: (c: Contract) => any): Promise<boolean> => {
    const provider = createTestProvider();
    const contract = new Contract(compileString(src, { solidityImportCompat: true }), [], { provider });
    await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
    const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount: 1000n, fee: 20000n });
    try {
      await new TransactionBuilder({ provider })
        .addInputs(utxos, unlock(contract))
        .addOutput({ to: contract.address, amount: 1000n })
        .addOutput({ to: contract.address, amount: changeAmount })
        .send();
      return true;
    } catch { return false; }
  };

  it('x = y makes x[i] read y[i] (distinct arrays, VM-verified)', async () => {
    // x = [1,2], y = [3,4]; after x = y, require(x[0]==3 && x[1]==4). Passes iff the rebind value-copies y.
    const src = 'contract C(){ function f(uint256[] calldata x, uint256[] calldata y) external {'
      + ' x = y; require(x[0] == 3 && x[1] == 4); } }';
    const ok = await run(src, (c) => c.unlock.f([1n, 2n], [3n, 4n]));
    expect(ok).toBe(true);
  });

  it('the rebind does NOT mutate y and reads the new binding, not the old x', async () => {
    // Negative control: after x = y, x[0] must be 3 (y), not 1 (old x). Assert x[0] != 1.
    const src = 'contract C(){ function f(uint256[] calldata x, uint256[] calldata y) external {'
      + ' x = y; require(x[0] != 1); require(y[0] == 3); } }';
    const ok = await run(src, (c) => c.unlock.f([1n, 2n], [3n, 4n]));
    expect(ok).toBe(true);
  });
});
