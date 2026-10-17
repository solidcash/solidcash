import { describe, expect, it } from 'vitest';
import { compileString } from './direct-compile.js';
import { Contract } from '../src/index.js';
import { StatefulContract } from '../src/stateful/index.js';
import { createTestProvider, setupStatefulUtxos } from './test-util.js';
import { alicePkh } from './fixture/vars.js';

/**
 * VM/SDK correctness for the Kashi `_isSolvent` multi-return state-helper inline. The early-return helper
 * inlines into its entry point as a single ternary expression; this test deploys the shipped inline shape and
 * the DIRECT-expression oracle, seeds the same mapping entry into each, and proves the two settle identically
 * for every boundary case of `b == 0 / b < m / b >= 2*m`.
 */
const INLINE = `pragma solidcash >=0.8.0;
contract Kashi {
  mapping(bytes20 => int) bal;

  function seed(bytes20 a, int value) public { this.bal[a] = value; require(true); }

  function _ok(bytes20 a, int m) internal view returns (bool) {
    int b = bal[a];
    if (b == 0) return false;
    if (b < m) return false;
    return b >= m * 2;
  }

  function check(bytes20 a, int m, bool expected) public view {
    require(_ok(a, m) == expected);
  }
}`;

const DIRECT = `pragma solidcash >=0.8.0;
contract KashiDirect {
  mapping(bytes20 => int) bal;

  function seed(bytes20 a, int value) public { this.bal[a] = value; require(true); }

  function check(bytes20 a, int m, bool expected) public view {
    int b = bal[a];
    require((b == 0 ? false : (b < m ? false : b >= m * 2)) == expected);
  }
}`;

type Sc = StatefulContract & {
  seed: (a: Uint8Array, value: bigint) => { send: () => Promise<unknown> };
  check: (a: Uint8Array, m: bigint, expected: boolean) => { send: () => Promise<unknown> };
};

async function deploy(source: string, initialValue: bigint): Promise<Sc> {
  const provider = createTestProvider();
  const artifact = compileString(source, { forceStateful: true });
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, {}, { saltContract: true },
  );
  const sc = StatefulContract.withCategory(contract, categoryId) as unknown as Sc;
  await sc.seed(alicePkh, initialValue).send();
  return sc;
}

async function settles(sc: Sc, m: bigint, expected: boolean): Promise<boolean> {
  try {
    await sc.check(alicePkh, m, expected).send();
    return true;
  } catch {
    return false;
  }
}

describe('Kashi _isSolvent inlined helper matches the direct-expression oracle on the VM', () => {
  const value = 100n;
  // (m, expected): b == 100, so the oracle is `b < m ? false : b >= 2*m`.
  const cases: Array<[bigint, boolean]> = [
    [0n, true],    // 100 >= 0
    [50n, true],   // 100 >= 100
    [51n, false],  // 100 < 102
    [99n, false],  // 100 < 198
    [100n, false], // 100 < 200
    [101n, false], // 100 < 101 -> b < m
    [10_000n, false],
  ];

  it('settles identically to the direct oracle for every boundary', async () => {
    const inline = await deploy(INLINE, value);
    const direct = await deploy(DIRECT, value);
    for (const [m, expected] of cases) {
      const inlineOk = await settles(inline, m, expected);
      const directOk = await settles(direct, m, expected);
      expect(inlineOk, `inline m=${m}`).toBe(directOk);
      // The direct oracle is authoritative: the correct expectation settles, the inverted one does not.
      expect(directOk, `direct oracle m=${m}`).toBe(true);
    }
  });

  it('both reject the inverted expectation on every boundary', async () => {
    const inline = await deploy(INLINE, value);
    const direct = await deploy(DIRECT, value);
    for (const [m, expected] of cases) {
      expect(await settles(inline, m, !expected), `inline inverted m=${m}`).toBe(false);
      expect(await settles(direct, m, !expected), `direct inverted m=${m}`).toBe(false);
    }
  });

  it('reads zero as insolvent through the inlined helper', async () => {
    const inline = await deploy(INLINE, 0n);
    const direct = await deploy(DIRECT, 0n);
    // b == 0 -> false for every m, including m == 0.
    expect(await settles(inline, 0n, false)).toBe(true);
    expect(await settles(direct, 0n, false)).toBe(true);
    expect(await settles(inline, 1n, false)).toBe(true);
    expect(await settles(direct, 1n, false)).toBe(true);
  });
});
