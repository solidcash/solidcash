import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract, randomUtxo, TransactionBuilder } from '../../src/index.js';
import { createTestProvider, gatherUtxos } from '../test-util.js';

// `c[s:e]` on a CALldata array whose element is a struct. The slice path keys on an element stored as a TIGHT row
// of `getFixedWidth(element)` bytes; `isFixedWidthType` (the code generator's) excludes structs because struct
// *indexing* scans fields, but a struct element is still the concatenation of its fields with no frame around it,
// so its rows sit at that stride and the slice is a byte-range of the row blob. Was: `UnsupportedTypeError: Tried
// to call member 'slice' on unsupported type 'S[]'` (`semanticTests/array/slices/array_slice_calldata_to_calldata.sol`).
describe('calldata struct-array slice c[s:e]', () => {
  const run = async (src: string, unlock: (contract: Contract) => unknown): Promise<boolean> => {
    const provider = createTestProvider();
    const contract = new Contract(compileString(src, { evmCompat: true }), [], { provider });
    await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
    const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount: 1000n, fee: 20000n });
    try {
      await new TransactionBuilder({ provider })
        .addInputs(utxos, unlock(contract) as never)
        .addOutput({ to: contract.address, amount: 1000n })
        .addOutput({ to: contract.address, amount: changeAmount })
        .send();
      return true;
    } catch { return false; }
  };

  // Rows {55,[1,2,3],66} {66,[2,3,4],77} {77,[3,4,5],88}: a row is 16 + 3*32 + 4 = 116 bytes, so slicing [1:3)
  // must keep rows 1 and 2 exactly - not a byte-shifted window, and not the whole array.
  type Row = { p1: bigint; a: bigint[]; p2: bigint };
  const ROWS = (): Row[] => [
    { p1: 55n, a: [1n, 2n, 3n], p2: 66n },
    { p1: 66n, a: [2n, 3n, 4n], p2: 77n },
    { p1: 77n, a: [3n, 4n, 5n], p2: 88n },
  ];
  const contract = (body: string): string => 'contract C {\n'
    + '    struct S { uint128 p1; uint256[3] a; uint32 p2; }\n'
    + '    function f(S[] calldata c, uint256 s, uint256 e) external {\n'
    + '        S[] memory sl = c[s:e];\n'
    + body
    + '    }\n'
    + '}\n';

  it('retains exactly the rows in [s,e) and reads their fields through the slice', async () => {
    const src = contract('        require(sl.length == e - s);\n'
      + '        require(sl[0].p1 == 66);\n'
      + '        require(sl[0].a[2] == 4);\n'
      + '        require(sl[1].p1 == 77 && sl[1].a[0] == 3 && sl[1].p2 == 88);\n');
    expect(await run(src, (c) => c.unlock.f(ROWS(), 1n, 3n))).toBe(true);
  });

  it('the checked window really moved: a value from the dropped row fails the spend', async () => {
    // Row 0's p1 is 55. If the slice left the window at zero (or were a no-op), this contract would pass; it must
    // FAIL because sl[0] is row 1.
    const src = contract('        require(sl[0].p1 == 55);\n');
    expect(await run(src, (c) => c.unlock.f(ROWS(), 1n, 3n))).toBe(false);
  });

  it('slices the tail and a single row', async () => {
    const tail = contract('        require(sl.length == 1 && sl[0].p2 == 88);\n');
    expect(await run(tail, (c) => c.unlock.f(ROWS(), 2n, 3n))).toBe(true);
    const single = contract('        require(sl.length == 1 && sl[0].p1 == 66 && sl[0].a[1] == 3);\n');
    expect(await run(single, (c) => c.unlock.f(ROWS(), 1n, 2n))).toBe(true);
    const whole = contract('        require(sl.length == 3 && sl[2].p1 == 77);\n');
    expect(await run(whole, (c) => c.unlock.f(ROWS(), 0n, 3n))).toBe(true);
    const empty = contract('        require(sl.length == 0);\n');
    expect(await run(empty, (c) => c.unlock.f(ROWS(), 1n, 1n))).toBe(true);
  });
});
