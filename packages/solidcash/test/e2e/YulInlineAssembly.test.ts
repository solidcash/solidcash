import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, MockNetworkProvider, TransactionBuilder } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, gatherUtxos } from '../test-util.js';

// Runtime correctness of lowered Yul inline assembly (Phase 2: value computation + control flow).
// Each function computes a value in `assembly { }` and require()s it equals an expected argument, so the
// VM run proves the lowered ops compute the right thing. See packages/solidc/docs/yul-inline-assembly.md.
const SOURCE = `
contract YulCheck() {
    // shl(3,a)=a*8, and(a,b)=a&b, lt(a,b)=a<b?1:0
    function arith(uint256 a, uint256 b, uint256 expected) {
        uint256 z = 0;
        assembly {
            let s := shl(3, a)
            let m := and(a, b)
            let c := lt(a, b)
            z := add(add(s, m), c)
        }
        require(z == expected);
    }

    function shiftRight(uint256 a, uint256 expected) {
        uint256 z = 0;
        assembly { z := shr(2, a) }
        require(z == expected);
    }

    function loopSum(uint256 n, uint256 expected) {
        uint256 z = 0;
        assembly {
            for { let i := 0 } lt(i, n) { i := add(i, 1) } { z := add(z, i) }
        }
        require(z == expected);
    }

    function classify(uint256 x, uint256 expected) {
        uint256 z = 0;
        assembly {
            switch x
            case 0 { z := 100 }
            case 1 { z := 200 }
            default { z := 300 }
        }
        require(z == expected);
    }
}
`;

const artifact = compileString(SOURCE);

async function spend(fn: string, args: bigint[]): Promise<unknown> {
  const provider: MockNetworkProvider = createTestProvider();
  const contract = new Contract(artifact, [], { provider });
  await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
  const amount = 1000n;
  const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount });
  return new TransactionBuilder({ provider })
    .addInputs(utxos, (contract.unlock as any)[fn](...args))
    .addOutput({ to: contract.address, amount })
    .addOutput({ to: contract.address, amount: changeAmount })
    .send();
}

describe('Yul inline assembly runtime correctness', () => {
  it('arith: shl/and/lt/add compute correctly', async () => {
    // a=5,b=12: 5<<3=40, 5&12=4, (5<12)=1 -> 45
    await expect(spend('arith', [5n, 12n, 45n])).resolves.toBeDefined();
    await expect(spend('arith', [5n, 12n, 44n])).rejects.toThrow();
  });

  it('shr divides by the power of two', async () => {
    await expect(spend('shiftRight', [20n, 5n])).resolves.toBeDefined(); // 20>>2 = 5
    await expect(spend('shiftRight', [20n, 6n])).rejects.toThrow();
  });

  it('for-loop sums 0..n-1', async () => {
    await expect(spend('loopSum', [5n, 10n])).resolves.toBeDefined(); // 0+1+2+3+4
    await expect(spend('loopSum', [5n, 11n])).rejects.toThrow();
  });

  it('switch selects the matching case and default', async () => {
    await expect(spend('classify', [1n, 200n])).resolves.toBeDefined();
    await expect(spend('classify', [0n, 100n])).resolves.toBeDefined();
    await expect(spend('classify', [7n, 300n])).resolves.toBeDefined();
    await expect(spend('classify', [7n, 200n])).rejects.toThrow();
  });
});
