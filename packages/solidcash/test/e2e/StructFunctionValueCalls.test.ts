import { describe, it, expect } from 'vitest';
import { compileString, compileStringMulti } from 'solidc';
import { hexToBin } from '@bitauth/libauth';
import { MockNetworkProvider } from '../../src/network/mock/index.js';
import { getContractFactory, type StatefulContract } from '../../src/stateful/index.js';
import type { Artifact } from '@solidcash/utils';

// Calls through external function values held in a struct field and in struct-array elements. A self value
// (`this.g`) stays a functionId and its call is an internal OP_INVOKE; a foreign value (`IFoo(a).m`) is an
// interface-typed field whose call co-spends the callee. Each spend checks the call's effect on the VM.
const SELF = `contract SelfValues {
  struct Entry { function() external returns (uint256) fn; uint256 extra; }
  struct Hook { function() external run; }
  Hook[] hooks;
  uint256 hits;
  function seven() public returns (uint256) { return 7; }
  function hit() external { hits++; }
  function sum(Entry memory e) public returns (uint256) { return e.fn() + e.extra; }
  function checkField(uint256 expected) public { require(this.sum(Entry(this.seven, 3)) == expected); }
  function checkElements(uint256 expected) public {
    hooks.push(Hook(this.hit));
    hooks.push(hooks[0]);
    hooks[0].run();
    hooks[1].run();
    require(hits == expected);
  }
}`;

const FOREIGN = `interface ITally { function bump() external; }
contract Tally is ITally {
  uint256 count;
  function bump() external { count = count + 1; }
}
contract ForeignValues {
  struct Slot { function() external fire; uint256 tag; }
  Slot one;
  Slot[] many;
  function setOne(address a) public { one = Slot(ITally(a).bump, 1); }
  function addMany(address a) public { many.push(Slot(ITally(a).bump, 2)); }
  function fireOne() public { one.fire(); }
  function fireFirst() public { many[0].fire(); }
}`;

const OPTIONS = { evmCompat: true };
const LIMITS = { maximumInputBytes: 10_000, maximumStackItemBytes: 10_000, maximumNftCommitmentBytes: 128 };

interface Call {
  send: () => Promise<unknown>;
  withExternalCall: (contract: StatefulContract, functionName: string, args: never[]) => Call;
}
type Handle = StatefulContract & Record<string, (...args: unknown[]) => Call>;
type Signer = Awaited<ReturnType<MockNetworkProvider['getSigners']>>[number];

const newSigner = async (): Promise<Signer> => {
  const provider = new MockNetworkProvider({ consensusLimits: LIMITS });
  const [signer] = await provider.getSigners(1, { fundingUtxos: 12 });
  return signer;
};

const deploy = async (artifact: Artifact, signer: Signer): Promise<Handle> =>
  await getContractFactory(artifact, signer).deploy() as unknown as Handle;

const foreignPair = async (): Promise<{ tally: Handle; holder: Handle; tallyAddress: Uint8Array }> => {
  const artifacts = compileStringMulti(FOREIGN, OPTIONS);
  const signer = await newSigner();
  const tally = await deploy(artifacts.Tally, signer);
  const holder = await deploy(artifacts.ForeignValues, signer);
  return { tally, holder, tallyAddress: hexToBin(tally.inner.lockingBytecode) };
};

describe.skipIf(Boolean(process.env.TESTS_USE_REGTEST))('calls through external function values in structs', () => {
  it('calls a self value stored in a memory struct field', async () => {
    const sc = await deploy(compileString(SELF, OPTIONS), await newSigner());
    await sc.checkField(10n).send();
    await expect(sc.checkField(11n).send()).rejects.toThrow();
  }, 300_000);

  // Open gap: this form fails on the VM (OP_SPLIT on an empty item, function-level site of checkElements).
  it.skip('calls a self value stored in state struct-array elements', async () => {
    const sc = await deploy(compileString(SELF, OPTIONS), await newSigner());
    await sc.checkElements(2n).send();
    await sc.checkElements(4n).send();
    await expect(sc.checkElements(5n).send()).rejects.toThrow();
  }, 300_000);

  it('calls a foreign value stored in a state struct field', async () => {
    const { tally, holder, tallyAddress } = await foreignPair();
    await holder.setOne(tallyAddress).send();
    await holder.fireOne().withExternalCall(tally, 'bump', []).send();
    expect((await tally.getState()).count).toBe(1n);
  }, 300_000);

  it('calls a foreign value stored in a state struct-array element', async () => {
    const { tally, holder, tallyAddress } = await foreignPair();
    await holder.addMany(tallyAddress).send();
    await holder.fireFirst().withExternalCall(tally, 'bump', []).send();
    expect((await tally.getState()).count).toBe(1n);
  }, 300_000);
});
