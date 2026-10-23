import { describe, it, expect } from 'vitest';
import { compileStringMulti } from '@solidcash/solidc';
import { parsePushdataCommitment } from '@solidcash/utils';
import type { ArtifactMap } from '@solidcash/utils';
import { MockNetworkProvider } from '../../src/network/mock/index.js';
import { getContractFactory, DeployFunctionCall } from '../../src/stateful/index.js';
import type { DeployFromResult } from '../../src/stateful/index.js';
import { getTxOutputs } from '../test-util.js';

// A function that creates a stateful child and returns one of its public getters (`(new Child()).stored()`) folds
// the getter into the deploy: the value is the child's constructed state, from a state initializer or a constructor
// write, never its type default. Shapes of the solc semantic tests smoke/alignment.sol,
// functionCall/creation_function_call_no_args.sol and freeFunctions/new_operator.sol, run the way the corpus runner
// runs them: production compile, factory deploy, then a `check` wrapper that calls the deploying function.
// The call carries the deploy modifier, so it runs through `.deploy()` (`.send()` is the plain call without the child
// genesis the deploy covenant verifies).
const OPTIONS = { evmCompat: true, enforceFinalRequire: false, forceStateful: true };
const REAL_SIZE_LIMITS = { maximumInputBytes: 10_000, maximumStackItemBytes: 10_000, maximumNftCommitmentBytes: 128 };

const CHECK = 'function check(uint256 expected) public { require(make() == expected); }';

const SHAPES: Array<[string, string, bigint]> = [
  ['a state initializer', `contract Child { uint256 public stored = 0x20; }
contract Parent {
    function make() public returns (uint256) { return (new Child()).stored(); }
    ${CHECK}
}`, 0x20n],
  ['a constructor write', `contract Child {
    uint public stored;
    constructor() { stored = 2; }
}
contract Parent {
    function make() public returns (uint r) { return new Child().stored(); }
    ${CHECK}
}`, 2n],
  ['a free function', `contract Child { uint public stored = 2; }
function build() returns (uint) { return (new Child()).stored(); }
contract Parent {
    function make() public returns (uint) { return build(); }
    ${CHECK}
}`, 2n],
];

const compiled = new Map<string, ArtifactMap>();
const artifactsOf = (source: string): ArtifactMap => {
  if (!compiled.has(source)) compiled.set(source, compileStringMulti(source, OPTIONS));
  return compiled.get(source)!;
};

// Funded like the corpus runner: unique txids per run, the mock reset hooks fired, vout 0 for the parent's genesis
// and, once the parent is deployed, a second vout-0 coin for the child's. The call is a thenable that deploys when
// awaited, so it is returned boxed.
let run = 0;
const checkCall = async (source: string, expected: bigint): Promise<{ call: DeployFunctionCall }> => {
  const artifacts = artifactsOf(source);
  const provider = new MockNetworkProvider({ consensusLimits: REAL_SIZE_LIMITS });
  provider.reset();
  const signer = provider.getCachedSigner(0);
  const tag = (run += 1).toString(16).padStart(8, '0');
  for (let vout = 0; vout < 8; vout++) {
    await provider.addUtxo(signer.getAddress(), { txid: `${tag}${'d1'.repeat(28)}`, vout, satoshis: 100_000_000n });
  }
  const parent = await getContractFactory(artifacts.Parent, signer).deploy();
  parent.registerArtifacts(artifacts);
  await provider.addUtxo(signer.getAddress(), { txid: `${tag}${'d2'.repeat(28)}`, vout: 0, satoshis: 100_000_000n });
  const call = parent.getFunction('check')(expected);
  if (!(call instanceof DeployFunctionCall)) throw new Error('check does not carry the deploy modifier');
  return { call };
};

const childValue = (source: string, result: DeployFromResult): unknown => {
  const output = getTxOutputs(result.tx).find((candidate) => candidate.token?.category === result.childCategoryId
    && candidate.token?.nft?.capability === 'mutable');
  expect(output).toBeDefined();
  return parsePushdataCommitment(output!.token!.nft!.commitment, artifactsOf(source).Child.stateLayout!, 0).stored;
};

describe('deploy-then-getter on a fresh child returns its constructed state', () => {
  it.each(SHAPES)('folds the getter of a child set by %s', async (_, source, expected) => {
    const result = await (await checkCall(source, expected)).call.deploy();
    expect(childValue(source, result)).toBe(expected);
  });

  it.each(SHAPES)('rejects the type default for a child set by %s', async (_, source) => {
    await expect((await checkCall(source, 0n)).call.deploy())
      .rejects.toThrow(/VERIFY|Require statement failed|Error in transaction/);
  });
});
