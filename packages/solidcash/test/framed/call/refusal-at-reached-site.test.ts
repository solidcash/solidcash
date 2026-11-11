import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { validatorAddress, type Artifact } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { callFramedEntry, type FramedCallResult } from '../../../src/framed/call/index.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A shape the planner refuses at one of the entry's sites stands only once the execution reaches that site.
 *
 * `A.relay` checks its own argument and then calls `Noisy.spam`, a callee that emits once per turn of a loop, which
 * the plain call path does not plan for a callee. A call that the check stops never reaches the site, so it reports
 * the entry's own reason; one that passes the check reaches the site and meets the planner's refusal.
 */

const SOURCE = 'pragma solidity ^0.8.0;'
  + ' contract Noisy { uint256 public last; event Ping(uint256 i);'
  + '   function spam(uint256 n) external { for (uint256 i = 0; i < n; i++) { emit Ping(i); } last = n; } }'
  + ' contract A { Noisy public noisy; uint256 public relayed;'
  + '   constructor(Noisy n) { noisy = n; }'
  + '   function relay(bool go, uint256 n) external { require(go, "A: stopped"); noisy.spam(n); relayed = n; } }';

interface Deployed {
  readonly provider: MockNetworkProvider;
  readonly artifacts: Readonly<Record<string, Artifact>>;
  readonly categories: ReadonlyMap<string, string>;
  readonly snapshot: SnapshotRestorer;
}

let run: Promise<Deployed> | undefined;

/** Noisy and A, A holding Noisy; each case rewinds the chain to them first. */
async function deployed(): Promise<Deployed> {
  run ??= (async (): Promise<Deployed> => {
    const compiled = compileStringMulti(SOURCE, { composition: 'framed', evmCompat: true } as never);
    const artifacts = { Noisy: compiled.Noisy!, A: compiled.A! };
    const { framedValidator } = await import('@solidcash/solidc');
    const validatorProgram = framedValidator.buildValidatorProgram();
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
    await fundShippedFacets(provider);
    const categories = new Map<string, string>();
    const locks = new Map<string, Uint8Array>();
    for (const [index, [name, args]] of ([['Noisy', []], ['A', ['Noisy']]] as const).entries()) {
      const fundingUtxo = { txid: `${'77'.repeat(31)}${(0xa0 + index).toString(16)}`, vout: 0, satoshis: 500_000n };
      await provider.addUtxo(funder.address, fundingUtxo);
      const deployment = await deployStatefulContract(artifacts[name]!, args.map((arg) => locks.get(arg)!), {
        provider, fundingUtxo, changeAddress: funder.address,
        funder: funder.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      });
      categories.set(name, deployment.categoryId);
      locks.set(name, validatorAddress(hexToBin(deployment.categoryId), validatorProgram));
    }
    return { provider, artifacts, categories, snapshot: await provider.takeSnapshot() };
  })();
  const chain = await run;
  await chain.snapshot.restore();
  return chain;
}

let coins = 0;

/** Enters `A.relay` with a fresh coin of the user's. */
async function relay(chain: Deployed, go: boolean): Promise<FramedCallResult> {
  coins += 1;
  const user = encodeLockingBytecodeP2pkh(alicePkh);
  const callerUtxo = { txid: `${'78'.repeat(31)}${coins.toString(16).padStart(2, '0')}`, vout: 0, satoshis: 300_000n };
  await chain.provider.addUtxo(binToHex(user), callerUtxo);
  const externals = Object.fromEntries([...chain.categories]
    .map(([name, categoryId]) => [name, { artifact: chain.artifacts[name]!, categoryId }]));
  return callFramedEntry({
    provider: chain.provider, artifact: chain.artifacts.A!, categoryId: chain.categories.get('A')!,
    functionName: 'relay', args: [go, 2n], callerUtxo, callerLockingBytecode: user,
    funder: new SignatureTemplate(alicePriv).unlockP2PKH(), vm: compositionMachine(), externals,
  });
}

describe('a planning refusal at a site the execution may not reach', () => {
  it('reports the entry\'s own reason when its check stops the call before the site', async () => {
    const chain = await deployed();
    const result = await relay(chain, false);
    expect(result.broadcast).toBeUndefined();
    expect(result.refusal?.innermost?.reason.message).toBe('A: stopped');
  });

  it('meets the planner\'s refusal when the call reaches the site', async () => {
    const chain = await deployed();
    await expect(relay(chain, true)).rejects.toThrow(/once per turn of a loop/);
  });
});
