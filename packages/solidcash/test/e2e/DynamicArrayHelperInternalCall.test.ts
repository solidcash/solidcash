import { describe, it, expect } from 'vitest';
import { compileString } from '@solidcash/solidc';
import { MockNetworkProvider } from '../../src/network/mock/index.js';
import { getContractFactory } from '../../src/stateful/index.js';

// Returning public/internal functions that write a chunk-packed state array with a bare `data[i] = v` are called
// internally. Each is inlined into its caller, so the call runs instead of being refused at code generation.
const FIXED = `contract FixedHelpers {
  uint256[4] data;
  function store(uint256 index, uint256 value) public returns (bool) { data[index] = value; return true; }
  function put(uint256 index, uint256 value) internal returns (bool) { data[index] = value; return true; }
  function load(uint256 index) public returns (uint256) { return data[index]; }
  function size() public returns (uint256) { return data.length; }
  function check(uint256 index, uint256 value) public {
    uint256 total = size();
    bool stored = store(index, value);
    uint256 first = load(index);
    bool replaced = put(index, value + 1);
    uint256 second = load(index);
    require(total == 4 && stored && first == value && replaced && second == value + 1);
  }
  function probe(uint256 index, uint256 expected) public { uint256 got = load(index); require(got == expected); }
}`;

const DYNAMIC = `contract DynamicHelpers {
  uint256[] data;
  function enlarge(uint256 amount) public returns (uint256) {
    while (data.length < amount) data.push();
    return data.length;
  }
  function store(uint256 index, uint256 value) public returns (bool) { data[index] = value; return true; }
  function load(uint256 index) public returns (uint256) { return data[index]; }
  function size() public returns (uint256) { return data.length; }
  function check(uint256 amount, uint256 index, uint256 value) public {
    uint256 grown = enlarge(amount);
    uint256 total = size();
    bool stored = store(index, value);
    uint256 got = load(index);
    require(grown == amount && total == amount && stored && got == value);
  }
  function probe(uint256 index, uint256 expected) public { uint256 got = load(index); require(got == expected); }
}`;

interface Call { send: () => Promise<unknown> }
type Handle = Record<'check' | 'probe', (...args: bigint[]) => Call>;

const deploy = async (source: string): Promise<Handle> => {
  const provider = new MockNetworkProvider({
    consensusLimits: { maximumInputBytes: 10000, maximumStackItemBytes: 10000, maximumNftCommitmentBytes: 128 },
  });
  const artifact = compileString(source, { evmCompat: true });
  expect(artifact.stateLayout!.variables.find((v) => v.name === 'data')).toMatchObject({ dynamic: true });
  const [signer] = await provider.getSigners(1, { fundingUtxos: 12 });
  return await getContractFactory(artifact, signer).deploy() as unknown as Handle;
};

describe.skipIf(Boolean(process.env.TESTS_USE_REGTEST))('internal calls to chunk-packed array helpers', () => {
  it('calls store, load and size of a uint256[4] state array', async () => {
    const sc = await deploy(FIXED);
    await sc.check(3n, 4n).send();
    await sc.probe(3n, 5n).send();
    await sc.check(0n, 9n).send();
    await sc.probe(0n, 10n).send();
    await sc.probe(1n, 0n).send();
    await expect(sc.check(4n, 5n).send()).rejects.toThrow();
    await expect(sc.check(400n, 5n).send()).rejects.toThrow();
    await expect(sc.probe(4n, 0n).send()).rejects.toThrow();
  }, 300_000);

  it('calls enlarge, store, load and size of a uint256[] state array', async () => {
    const sc = await deploy(DYNAMIC);
    await expect(sc.probe(3n, 0n).send()).rejects.toThrow();
    await sc.check(4n, 3n, 4n).send();
    await sc.probe(3n, 4n).send();
    await sc.check(4n, 1n, 7n).send();
    await sc.probe(0n, 0n).send();
    await expect(sc.check(4n, 4n, 8n).send()).rejects.toThrow();
    await sc.probe(1n, 7n).send();
  }, 300_000);
});
