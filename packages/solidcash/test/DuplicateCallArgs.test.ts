import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, TransactionBuilder } from '../src/index.js';
import { randomUtxo } from '../src/utils.js';
import { createTestProvider, verifyTransaction } from './test-util.js';

// The same variable passed more than once to one internal (OP_INVOKE) call: codegen evaluates call args
// in REVERSE order while the final-use analysis marked them left-to-right, so the roll landed on a use
// codegen evaluates first and the later use read a vanished slot ("does not exist on the stack").
// Duplicated arg vars are now PICK-only. Verifies values, positional arg order, and that the var
// survives past the call.
const DUP_SOURCE = `
contract DupArgs {
    function g(int a, int b) private pure returns (int) { return a + b; }
    function h(int a, int b, int c) private pure returns (int) { return a * 100 + b * 10 + c; }
    function f(int v) public {
        require(g(v, v) == v + v);
        int r = h(v, v + 2, 9);
        require(r == v * 100 + (v + 2) * 10 + 9);
        require(v == 5);
    }
}`;

// The UDVT operator-overload form of the same bug (solc's fixed_point_udvt_with_operators.sol):
// `value + value * percentage` desugars to add(value, mul(value, percentage)).
const UDVT_SOURCE = `
type Fixed is int256;
using {add as +, mul as *} for Fixed global;
function add(Fixed a, Fixed b) pure returns (Fixed) {
    return Fixed.wrap(Fixed.unwrap(a) + Fixed.unwrap(b));
}
function mul(Fixed a, Fixed b) pure returns (Fixed) {
    return Fixed.wrap(Fixed.unwrap(a) * Fixed.unwrap(b) / 10);
}
contract UdvtOps {
    function applyInterest(int v, int p, int expected) public {
        Fixed value = Fixed.wrap(v);
        Fixed percentage = Fixed.wrap(p);
        Fixed result = value + value * percentage;
        require(Fixed.unwrap(result) == expected);
        require(Fixed.unwrap(value) == v);
    }
}`;

const run = async (source: string, unlock: (c: Contract) => any): Promise<void> => {
  const provider = createTestProvider();
  const contract = new Contract(compileString(source, { solidityImportCompat: true }), [], { provider });
  const utxo = randomUtxo();
  await provider.addUtxo(contract.address, utxo);
  const tx = new TransactionBuilder({ provider })
    .addInput(utxo, unlock(contract))
    .addOutput({ to: contract.address, amount: 10000n });
  verifyTransaction(tx);
};

describe('duplicate variable across one call argument list (VM-verified)', () => {
  it('g(v, v) and h(v, v+2, 9) compute correct values with correct arg positions', async () => {
    await run(DUP_SOURCE, (c) => c.unlock.f(5n));
  });

  it('UDVT overloaded operators: value + value * percentage', async () => {
    // 50 + (50 * 2) / 10 = 60
    await run(UDVT_SOURCE, (c) => c.unlock.applyInterest(50n, 2n, 60n));
  });

  it('rejects a wrong expected result (guard against vacuous pass)', async () => {
    await expect(run(UDVT_SOURCE, (c) => c.unlock.applyInterest(50n, 2n, 61n))).rejects.toThrow(
      /Transaction verification failed/,
    );
  });
});
