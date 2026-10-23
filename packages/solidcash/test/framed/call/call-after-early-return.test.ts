import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { parsePushdataCommitment, validatorAddress, type Artifact } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { readFramedDeployment } from '../../../src/framed/deploy/index.js';
import { callFramedEntry } from '../../../src/framed/call/index.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * An entry whose call an earlier `return` can skip, on the plain call path.
 *
 * `A.run` returns at once when `skip` is set, and otherwise calls `B.peek` and writes the result to its record. The
 * body binds its call records in the order it makes them, so a run that returns makes none, and the artifact
 * publishes the call as conditional on `!skip`: the plan states one call when `skip` is clear and none when it is
 * set. A plan that states the call although the return is taken - the artifact as it was before the call's
 * condition was published - is refused by the body, which made no call to bind the record to.
 *
 * `A.runCounted` is `run` under a modifier that counts the entry after `_`. The body's return leaves the body alone,
 * so the count is kept on either path, and the call runs in a gate on a flag of the compiler's that the return sets.
 * The artifact publishes the call under the `!skip` that gate stands for, so the plan is the same as `run`'s.
 */

const SOURCE = 'pragma solidity ^0.8.0;'
  + ' contract B { uint256 public marker;'
  + '   function peek(uint256 x) external view returns (uint256) { return x + 1; } }'
  + ' contract A { B public b; uint256 public last; uint256 public runs; constructor(B b_) { b = b_; }'
  + '   modifier counted() { _; runs = runs + 1; }'
  + '   function run(uint256 x, bool skip) external {'
  + '     if (skip) return;'
  + '     last = b.peek(x);'
  + '   }'
  + '   function runCounted(uint256 x, bool skip) external counted {'
  + '     if (skip) return;'
  + '     last = b.peek(x);'
  + '   } }';

type CallResult = Awaited<ReturnType<typeof callFramedEntry>>;

/** The artifact without the call's published condition, as a builder that ignores the return would read it. */
function withoutCondition(artifact: Artifact): Artifact {
  const copy = JSON.parse(JSON.stringify(artifact)) as Artifact;
  for (const entry of copy.abi) {
    for (const row of (entry as { externalCalls?: { condition?: unknown }[] }).externalCalls ?? []) {
      delete row.condition;
    }
  }
  for (const entry of copy.composition?.stopSites?.entries ?? []) {
    for (const site of entry.sites.sites) if (site.kind === 'call') delete site.conditional;
  }
  return copy;
}

/** Deploys B and then A over it once, and enters `A.run` (or `entry`) with a fresh coin per call. */
async function deployed(): Promise<{
  readonly artifact: Artifact;
  readonly enter: (
    skip: boolean, coin: number, options?: { readonly artifact?: Artifact; readonly entry?: string },
  ) => Promise<CallResult>;
  readonly field: (name: string) => Promise<unknown>;
}> {
  const compiled = compileStringMulti(SOURCE, { composition: 'framed', evmCompat: true } as never);
  const artifacts: Readonly<Record<string, Artifact>> = { A: compiled.A!, B: compiled.B! };
  const { framedValidator } = await import('@solidcash/solidc');
  const validatorProgram = framedValidator.buildValidatorProgram();
  const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
  await fundShippedFacets(provider);
  const categories = new Map<string, string>();
  const locks = new Map<string, Uint8Array>();
  for (const [index, [name, args]] of ([['B', []], ['A', ['B']]] as const).entries()) {
    const fundingUtxo = { txid: `${'75'.repeat(31)}${(0xa0 + index).toString(16)}`, vout: 0, satoshis: 500_000n };
    await provider.addUtxo(funder.address, fundingUtxo);
    const deployment = await deployStatefulContract(artifacts[name]!, args.map((arg) => locks.get(arg)!), {
      provider, fundingUtxo, changeAddress: funder.address,
      funder: funder.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
    });
    categories.set(name, deployment.categoryId);
    locks.set(name, validatorAddress(hexToBin(deployment.categoryId), validatorProgram));
  }
  const externals = Object.fromEntries([...categories]
    .map(([name, categoryId]) => [name, { artifact: artifacts[name]!, categoryId }]));
  const user = encodeLockingBytecodeP2pkh(alicePkh);
  return {
    artifact: artifacts.A!,
    enter: async (skip, coin, { artifact = artifacts.A!, entry = 'run' } = {}) => {
      const callerUtxo = { txid: `${'76'.repeat(31)}${coin.toString(16).padStart(2, '0')}`, vout: 0, satoshis: 300_000n };
      await provider.addUtxo(binToHex(user), callerUtxo);
      return callFramedEntry({
        provider, artifact, categoryId: categories.get('A')!, functionName: entry, args: [5n, skip],
        callerUtxo, callerLockingBytecode: user, funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
        vm: compositionMachine(), externals,
      });
    },
    field: async (name) => {
      const layout = artifacts.A!.stateLayout!;
      const set = await readFramedDeployment(provider, categories.get('A')!, layout);
      return parsePushdataCommitment(set.records[0]!.token!.nft!.commitment, layout, 0)[name];
    },
  };
}

describe('an entry whose call an earlier return can skip, on the plain call path', () => {
  it('settles no call when the return is taken and one when it is not', async () => {
    const { enter, field } = await deployed();
    const returned = await enter(true, 1);
    expect(returned.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(returned.draft.blockOf('master').calls).toHaveLength(0);
    expect(await field('last')).toBe(0n);
    const called = await enter(false, 2);
    expect(called.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(called.draft.blockOf('master').calls).toHaveLength(1);
    expect(await field('last')).toBe(6n);
  }, 120_000);

  it('refuses a block that states the call when the return was taken', async () => {
    // Without the published condition the plan states the call whatever `skip` is; the body returned before it,
    // made no call, and refuses the record the block declares.
    const { artifact, enter } = await deployed();
    const stated = await enter(true, 3, { artifact: withoutCondition(artifact) });
    expect(stated.draft.blockOf('master').calls).toHaveLength(1);
    expect(stated.accepted).toBe(false);
    expect(stated.broadcast).toBeUndefined();
  }, 120_000);

  it('settles a modifier-wrapped entry the same way, its modifier counting either path', async () => {
    const { enter, field } = await deployed();
    const returned = await enter(true, 4, { entry: 'runCounted' });
    expect(returned.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(returned.draft.blockOf('master').calls).toHaveLength(0);
    expect([await field('last'), await field('runs')]).toStrictEqual([0n, 1n]);
    const called = await enter(false, 5, { entry: 'runCounted' });
    expect(called.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(called.draft.blockOf('master').calls).toHaveLength(1);
    expect([await field('last'), await field('runs')]).toStrictEqual([6n, 2n]);
  }, 120_000);
});
