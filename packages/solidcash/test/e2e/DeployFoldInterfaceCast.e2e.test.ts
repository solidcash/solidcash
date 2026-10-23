import { describe, it, expect } from 'vitest';
import { compileStringMulti } from '@solidcash/solidc';
import { parsePushdataCommitment } from '@solidcash/utils';
import type { ArtifactMap } from '@solidcash/utils';
import { MockNetworkProvider } from '../../src/network/mock/index.js';
import { getContractFactory, DeployFunctionCall } from '../../src/stateful/index.js';
import type { DeployFromResult } from '../../src/stateful/index.js';
import { getTxOutputs } from '../test-util.js';

// A call through an interface cast on a fresh deploy (`I(address(new Child())).m()`) folds into that deploy exactly
// like the local form: the child is created in its post-call state and takes later calls. A `view`/`pure`
// declaration is a STATICCALL in EVM, so a body that writes state reverts there, while a read-only body returns its
// value. Run the way the corpus runner runs a deploying line: factory deploy, then a `check` wrapper via `.deploy()`.
const OPTIONS = { evmCompat: true, enforceFinalRequire: false, forceStateful: true };
const REAL_SIZE_LIMITS = { maximumInputBytes: 10_000, maximumStackItemBytes: 10_000, maximumNftCommitmentBytes: 128 };

const CHILD = `contract Counter {
    uint256 count = 5;
    function bump() public returns (uint256) {
        count = count + 1;
        return count;
    }
    function peek() public view returns (uint256) {
        return count;
    }
}
interface ICounter {
    function bump() external returns (uint256);
}
interface ICounterView {
    function bump() external view returns (uint256);
    function peek() external view returns (uint256);
}`;

const parentCalling = (call: string): string => `${CHILD}
contract Maker {
    function make() public returns (uint256) { return ${call}; }
    function check(uint256 expected) public { require(make() == expected); }
}`;

const BUMP = parentCalling('ICounter(address(new Counter())).bump()');
const BUMP_THROUGH_VIEW = parentCalling('ICounterView(address(new Counter())).bump()');
const PEEK_THROUGH_VIEW = parentCalling('ICounterView(address(new Counter())).peek()');

const compiled = new Map<string, ArtifactMap>();
const artifactsOf = (source: string): ArtifactMap => {
  if (!compiled.has(source)) compiled.set(source, compileStringMulti(source, OPTIONS));
  return compiled.get(source)!;
};

// Unique funding txids per run, vout 0 for the parent's genesis and, once it is deployed, a second vout-0 coin for
// the child's. The call is a thenable that deploys when awaited, so it is returned boxed.
let run = 0;
const checkCall = async (source: string, expected: bigint): Promise<{
  call: DeployFunctionCall; signer: ReturnType<MockNetworkProvider['getCachedSigner']>;
}> => {
  const artifacts = artifactsOf(source);
  const provider = new MockNetworkProvider({ consensusLimits: REAL_SIZE_LIMITS });
  provider.reset();
  const signer = provider.getCachedSigner(0);
  const tag = (run += 1).toString(16).padStart(8, '0');
  for (let vout = 0; vout < 8; vout++) {
    await provider.addUtxo(signer.getAddress(), { txid: `${tag}${'e1'.repeat(28)}`, vout, satoshis: 100_000_000n });
  }
  const parent = await getContractFactory(artifacts.Maker, signer).deploy();
  parent.registerArtifacts(artifacts);
  await provider.addUtxo(signer.getAddress(), { txid: `${tag}${'e2'.repeat(28)}`, vout: 0, satoshis: 100_000_000n });
  const call = parent.getFunction('check')(expected);
  if (!(call instanceof DeployFunctionCall)) throw new Error('check does not carry the deploy modifier');
  return { call, signer };
};

const childCount = (source: string, result: DeployFromResult): unknown => {
  const output = getTxOutputs(result.tx).find((candidate) => candidate.token?.category === result.childCategoryId
    && candidate.token?.nft?.capability === 'mutable');
  expect(output).toBeDefined();
  return parsePushdataCommitment(output!.token!.nft!.commitment, artifactsOf(source).Counter.stateLayout!, 0).count;
};

describe('deploy fold through an interface cast on a fresh deploy', () => {
  it('deploys the child in its post-call state, and the child takes a later call', async () => {
    const { call, signer } = await checkCall(BUMP, 6n);
    const result = await call.deploy();
    expect(childCount(BUMP, result)).toBe(6n);
    const child = result.child.connect(signer);
    await child.getFunction('bump')().send();
    expect((await child.getState()).count).toBe(7n);
  });

  it('reverts a state-writing body called through a view declaration', async () => {
    await expect((await checkCall(BUMP_THROUGH_VIEW, 6n)).call.deploy())
      .rejects.toThrow(/Require statement failed|Error in transaction|VERIFY/);
  });

  it('returns the value of a read-only body called through a view declaration', async () => {
    const result = await (await checkCall(PEEK_THROUGH_VIEW, 5n)).call.deploy();
    expect(childCount(PEEK_THROUGH_VIEW, result)).toBe(5n);
  });
});
