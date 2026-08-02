import { describe, it, expect } from 'vitest';
import { compileString } from './direct-compile.js';
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

// A variable shared by BOTH slice bounds: codegen visits the END bound before the START bound, so the
// final-use (roll) analysis must mark the START bound's use as last. Previously the roll landed on the
// END bound and the START bound read a vanished variable ("does not exist on the stack").
const SHARED_BOUNDS_SOURCE = `
contract SliceSharedBounds() {
    function check(bool cond, bytes x) {
        bytes y = x[cond ? 1 : 2 : cond ? 3 : 4];
        if (cond) { require(y == 0x1122); }
        else { require(y == 0x2233); }
        require(x.length == 5);
    }
    function checkArr(uint256[] a, uint256 i) {
        require(a[i : i + 2].length == 2);
        require(a[i : i + 2][0] == 20);
        require(a[i : i + 2][1] == 30);
    }
}`;

describe('slice bounds sharing a variable (VM-verified)', () => {
  const setup = async (): Promise<{ contract: Contract, provider: ReturnType<typeof createTestProvider> }> => {
    const provider = createTestProvider();
    const contract = new Contract(compileString(SHARED_BOUNDS_SOURCE), [], { provider });
    await provider.addUtxo(contract.address, randomUtxo());
    return { contract, provider };
  };

  it.each([[true], [false]])('bytes slice with a ternary of the same var in both bounds (cond=%s)', async (cond) => {
    const { contract, provider } = await setup();
    const [utxo] = await provider.getUtxos(contract.address);
    const tx = new TransactionBuilder({ provider })
      .addInput(utxo, contract.unlock.check(cond, new Uint8Array([0x00, 0x11, 0x22, 0x33, 0x44])))
      .addOutput({ to: contract.address, amount: 10000n });
    expect(() => verifyTransaction(tx)).not.toThrow();
  });

  it('array slice using the same index var in both bounds', async () => {
    const { contract, provider } = await setup();
    const [utxo] = await provider.getUtxos(contract.address);
    const elems = [10n, 20n, 30n, 40n];
    const arg = new Uint8Array([
      ...encodePushdataValue(BigInt(elems.length), 'bigint'),
      ...packFixedWidthArray(elems, 'uint256'),
    ]);
    const tx = new TransactionBuilder({ provider })
      .addInput(utxo, contract.unlock.checkArr(arg, 1n))
      .addOutput({ to: contract.address, amount: 10000n });
    expect(() => verifyTransaction(tx)).not.toThrow();
  });
});

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
