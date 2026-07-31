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

    // calldataload(4 + 32*k) reads the k-th arg's word; here k=1 (second param y).
    function readArg(uint256 x, uint256 y, uint256 expected) {
        uint256 a = 0;
        assembly { a := calldataload(36) }
        require(a == expected);
    }

    // calldatasize() = 4 + 32 * argCount; this function has 2 params -> 68.
    function dataSize(uint256 x, uint256 expected) {
        uint256 a = 0;
        assembly { a := calldatasize() }
        require(a == expected);
    }

    // transient store/load within one execution behaves as a function-scoped local.
    function transientRoundtrip(uint256 v, uint256 expected) {
        uint256 a = 0;
        assembly { tstore(3, v) a := tload(3) }
        require(a == expected);
    }

    // memory scratch: mstore a word then mload it back.
    function memRoundtrip(uint256 v, uint256 expected) {
        uint256 a = 0;
        assembly { mstore(0, v) a := mload(0) }
        require(a == expected);
    }
}
`;

const artifact = compileString(SOURCE);

const requireFailure = (line: number, statement: string): string =>
  `YulCheck.scash:${line} Require statement failed at input 0 in contract YulCheck.scash at line ${line}.\n`
  + `Failing statement: require(${statement} == expected);`;

async function spend(fn: string, args: bigint[]): Promise<unknown> {
  const provider: MockNetworkProvider = createTestProvider();
  // Salt per call so each spend targets a fresh address. The regtest provider is a shared singleton, so an
  // unsalted (deterministic) address accumulates UTXOs across calls; gatherUtxos would then pull several inputs,
  // each carrying the full redeem script, inflating the tx past the fixed 5000-sat fee (min relay fee not met).
  const contract = new Contract(artifact, [], { provider, salt: Contract.generateSalt() });
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
    await expect(spend('arith', [5n, 12n, 44n])).rejects.toThrow(requireFailure(12, 'z'));
  });

  it('shr divides by the power of two', async () => {
    await expect(spend('shiftRight', [20n, 5n])).resolves.toBeDefined(); // 20>>2 = 5
    await expect(spend('shiftRight', [20n, 6n])).rejects.toThrow(requireFailure(18, 'z'));
  });

  it('for-loop sums 0..n-1', async () => {
    await expect(spend('loopSum', [5n, 10n])).resolves.toBeDefined(); // 0+1+2+3+4
    await expect(spend('loopSum', [5n, 11n])).rejects.toThrow(requireFailure(26, 'z'));
  });

  it('switch selects the matching case and default', async () => {
    await expect(spend('classify', [1n, 200n])).resolves.toBeDefined();
    await expect(spend('classify', [0n, 100n])).resolves.toBeDefined();
    await expect(spend('classify', [7n, 300n])).resolves.toBeDefined();
    await expect(spend('classify', [7n, 200n])).rejects.toThrow(requireFailure(37, 'z'));
  });

  it('calldataload reads the matching argument word', async () => {
    await expect(spend('readArg', [10n, 99n, 99n])).resolves.toBeDefined(); // arg 1 (y) = 99
    await expect(spend('readArg', [10n, 99n, 98n])).rejects.toThrow(requireFailure(44, 'a'));
  });

  it('calldatasize is 4 + 32 * argCount', async () => {
    await expect(spend('dataSize', [5n, 68n])).resolves.toBeDefined(); // 4 + 32*2
    await expect(spend('dataSize', [5n, 67n])).rejects.toThrow(requireFailure(51, 'a'));
  });

  it('transient tstore/tload round-trips within one execution', async () => {
    await expect(spend('transientRoundtrip', [42n, 42n])).resolves.toBeDefined();
    await expect(spend('transientRoundtrip', [42n, 41n])).rejects.toThrow(requireFailure(58, 'a'));
  });

  it('memory mstore/mload round-trips a word', async () => {
    await expect(spend('memRoundtrip', [77n, 77n])).resolves.toBeDefined();
    await expect(spend('memRoundtrip', [77n, 76n])).rejects.toThrow(requireFailure(65, 'a'));
  });
});
