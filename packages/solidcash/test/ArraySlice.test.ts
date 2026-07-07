import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { encodePushdataValue, packFixedWidthArray } from '@solidcash/utils';
import { Contract, TransactionBuilder } from '../src/index.js';
import { randomUtxo } from '../src/utils.js';
import { createTestProvider, verifyTransaction } from './test-util.js';

// VM-verify the fixed-width-element array slice `arr[start:end]`: length + element values of the sliced sub-array,
// including omitted bounds. a = [10, 20, 30, 40]: a[1:3]=[20,30], a[0:2]=[10,20], a[2:]=[30,40], a[:]=all.
const SOURCE = `
contract ArraySlice() {
    function check(uint256[] a) {
        require(a[1:3].length == 2);
        require(a[1:3][0] == 20);
        require(a[1:3][1] == 30);
        require(a[0:2][0] == 10);
        require(a[0:2][1] == 20);
        require(a[2:][0] == 30);
        require(a[2:][1] == 40);
        require(a[:].length == 4);
        require(a[:][3] == 40);
    }
}`;

describe('fixed-width array slice arr[start:end] (VM-verified)', () => {
  it('slices a uint256[] with correct length + element values', async () => {
    const provider = createTestProvider();
    const contract = new Contract(compileString(SOURCE), [], { provider });
    const utxo = randomUtxo();
    await provider.addUtxo(contract.address, utxo);
    // On-stack fixed-width array value: pushdata(count) ++ packed 33-byte elements (what the codegen decodes).
    const elems = [10n, 20n, 30n, 40n];
    const count = encodePushdataValue(BigInt(elems.length), 'bigint');
    const packed = packFixedWidthArray(elems, 'uint256');
    const arg = new Uint8Array([...count, ...packed]);
    const tx = new TransactionBuilder({ provider })
      .addInput(utxo, contract.unlock.check(arg))
      .addOutput({ to: contract.address, amount: 10000n });
    expect(() => verifyTransaction(tx)).not.toThrow();
  });
});
