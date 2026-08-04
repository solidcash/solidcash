import { describe, it, expect } from 'vitest';
import { compileString } from './direct-compile.js';
import { Contract, TransactionBuilder } from '../src/index.js';
import { randomUtxo } from '../src/utils.js';
import { createTestProvider, verifyTransaction } from './test-util.js';

// A return nested under further conditions with fall-through in an internal function (solc's
// branches_with_return/nested_if.sol): the returning path consumed the params off the stack while the
// fall-through path still needed them ("Expected variable 'a' does not exist"). Now desugared to
// flag + gated tail + terminal return. Exercises both the returning and the fall-through paths.
const SOURCE = `
contract C {
    function nested_if(uint256 a, uint256 b) internal pure returns (uint256) {
        if (a < 5) {
            if (b > 1) {
                return 0;
            }
        }
        if (a == 2 && b == 2) {
            return 42;
        }
        else {
            return 1;
        }
    }

    function h(uint256 c, uint256 d) internal pure returns (uint256) {
        uint256 x = 10;
        if (c > 0) {
            if (d > 0) { return 100; }
            x = 20;
        }
        return x + 1;
    }

    function test(uint256 a, uint256 b, uint256 expected) public pure {
        require(nested_if(a, b) == expected);
    }

    function testH(uint256 c, uint256 d, uint256 expected) public pure {
        require(h(c, d) == expected);
    }
}`;

describe('return nested under conditions with fall-through (VM-verified)', () => {
  const setup = async (): Promise<{ contract: Contract, provider: ReturnType<typeof createTestProvider> }> => {
    const provider = createTestProvider();
    const contract = new Contract(compileString(SOURCE, { solidityImportCompat: true }), [], { provider });
    await provider.addUtxo(contract.address, randomUtxo());
    return { contract, provider };
  };

  it.each([
    [1n, 5n, 0n],   // inner return taken
    [7n, 2n, 1n],   // outer if skipped entirely
    [2n, 1n, 1n],   // outer if entered, inner falls through -> else of the second if
    [4n, 0n, 1n],   // fall-through with different values
  ])('nested_if(%s, %s) == %s', async (a, b, expected) => {
    const { contract, provider } = await setup();
    const [utxo] = await provider.getUtxos(contract.address);
    const tx = new TransactionBuilder({ provider })
      .addInput(utxo, contract.unlock.test(a, b, expected))
      .addOutput({ to: contract.address, amount: 10000n });
    expect(() => verifyTransaction(tx)).not.toThrow();
  });

  it.each([
    [1n, 1n, 100n], // nested return taken
    [1n, 0n, 21n],  // arm code after the may-return executes on fall-through
    [0n, 9n, 11n],  // arm skipped
  ])('h(%s, %s) == %s (post-return arm statement)', async (c, d, expected) => {
    const { contract, provider } = await setup();
    const [utxo] = await provider.getUtxos(contract.address);
    const tx = new TransactionBuilder({ provider })
      .addInput(utxo, contract.unlock.testH(c, d, expected))
      .addOutput({ to: contract.address, amount: 10000n });
    expect(() => verifyTransaction(tx)).not.toThrow();
  });

  it('rejects a wrong expected value (guard against vacuous pass)', async () => {
    const { contract, provider } = await setup();
    const [utxo] = await provider.getUtxos(contract.address);
    const tx = new TransactionBuilder({ provider })
      .addInput(utxo, contract.unlock.test(2n, 1n, 42n))
      .addOutput({ to: contract.address, amount: 10000n });
    expect(() => verifyTransaction(tx)).toThrow();
  });
});
