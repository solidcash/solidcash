import { describe, it, expect } from 'vitest';
import { compileString } from '@solidcash/solidc';
import { MockNetworkProvider } from '../../src/network/mock/index.js';
import { getContractFactory } from '../../src/stateful/index.js';

// An evmCompat bounded value array whose packed blob cannot fit a 128-byte commitment (uint256[24]: 793 B) is
// chunk-packed, so it deploys and spends under the real BCH-2026 sizes and keeps fixed-array semantics.
const SRC = `contract C {
  uint256[24] values;
  uint256 count;
  constructor() { values[3] = 42; values[23] = 7; }
  function set(uint256 i, uint256 v) public { values[i] = v; count += 1; }
  function check(uint256 i, uint256 e) public { require(values[i] == e); }
  function checkWhole(uint256 i, uint256 e, uint256 sum) public {
    uint256[24] memory copy = values;
    uint256 total;
    for (uint256 k = 0; k < copy.length; k++) total += copy[k];
    require(values.length == 24 && copy.length == 24 && copy[i] == e && total == sum);
  }
  function replace(uint256 v) public { uint256[24] memory next; next[1] = v; values = next; }
}`;

interface Call { send: () => Promise<unknown> }
type Handle = Record<'set' | 'check' | 'checkWhole' | 'replace', (...args: bigint[]) => Call>;

describe.skipIf(Boolean(process.env.TESTS_USE_REGTEST))('bounded array past the commitment limit', () => {
  it('chunk-packs, deploys and spends under real size limits', async () => {
    const provider = new MockNetworkProvider({
      consensusLimits: { maximumInputBytes: 10000, maximumStackItemBytes: 10000, maximumNftCommitmentBytes: 128 },
    });
    const artifact = compileString(SRC, { evmCompat: true });
    expect(artifact.stateLayout!.variables.find((v) => v.name === 'values')).toMatchObject({ dynamic: true });
    const [signer] = await provider.getSigners(1, { fundingUtxos: 12 });
    const sc = await getContractFactory(artifact, signer).deploy() as unknown as Handle;

    await sc.check(3n, 42n).send();
    await sc.check(23n, 7n).send();
    await sc.check(0n, 0n).send();
    await expect(sc.check(3n, 41n).send()).rejects.toThrow();

    const wide = 2n ** 255n + 1n;
    await sc.set(5n, wide).send();
    await sc.check(5n, wide).send();
    await sc.checkWhole(5n, wide, 42n + 7n + wide).send();

    await expect(sc.check(24n, 0n).send()).rejects.toThrow();
    await expect(sc.set(24n, 1n).send()).rejects.toThrow();

    await sc.replace(9n).send();
    await sc.check(1n, 9n).send();
    await sc.checkWhole(3n, 0n, 9n).send();
  }, 300_000);
});
