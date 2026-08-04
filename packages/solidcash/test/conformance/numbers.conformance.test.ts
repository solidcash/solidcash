// EVM number-semantics conformance: solc + @ethereumjs/evm (reference) vs solidc + solidcash SDK.
// This is the number-parity audit from docs/evm-abi-parity.md section 12, run as differential tests.
import { describe, it } from 'vitest';
import { assertConformant, exprCase } from './harness.js';

const MAX_UINT256 = (1n << 256n) - 1n;

describe('EVM number conformance', () => {
  // test/libsolidity/semanticTests/integer/basic.sol
  // The min/max cases below prove the fixture's uint256 and int256 boundary values against the EVM.
  it('checked add (int)', async () => {
    await assertConformant(exprCase({ params: 'int a, int b', retType: 'int', expr: 'a + b', args: [3n, 4n] }));
  });

  it('checked sub (int, negative result)', async () => {
    await assertConformant(exprCase({ params: 'int a, int b', retType: 'int', expr: 'a - b', args: [3n, 10n] }));
  });

  it('checked mul (uint)', async () => {
    await assertConformant(exprCase({ params: 'uint a, uint b', retType: 'uint', expr: 'a * b', args: [6n, 7n] }));
  });

  it('type(int256).max', async () => {
    await assertConformant(exprCase({ params: '', retType: 'int', expr: 'type(int256).max', args: [] }));
  });

  it('type(int256).min', async () => {
    await assertConformant(exprCase({ params: '', retType: 'int', expr: 'type(int256).min', args: [] }));
  });

  it('type(uint256).max (33-byte boundary)', async () => {
    await assertConformant(exprCase({ params: '', retType: 'uint', expr: 'type(uint256).max', args: [] }));
  });

  it('uint256 max round-trips as an argument (33-byte boundary)', async () => {
    await assertConformant(exprCase({ params: 'uint a', retType: 'uint', expr: 'a', args: [MAX_UINT256] }));
  });

  it('signed >> is arithmetic (SAR): (-3) >> 1 == -2, not -1', async () => {
    await assertConformant(exprCase({ params: 'int a', retType: 'int', expr: 'a >> 1', args: [-3n] }));
  });

  it('signed division truncates toward zero: (-7) / 2 == -3', async () => {
    await assertConformant(exprCase({ params: 'int a, int b', retType: 'int', expr: 'a / b', args: [-7n, 2n] }));
  });

  it('signed mod takes dividend sign: (-7) % 2 == -1', async () => {
    await assertConformant(exprCase({ params: 'int a, int b', retType: 'int', expr: 'a % b', args: [-7n, 2n] }));
  });
});
