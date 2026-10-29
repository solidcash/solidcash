import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { validatorAddress, type Artifact } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import Signer from '../../../src/Signer.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { findDeploymentByAddress } from '../../../src/stateful/deployment-registry.js';
import { standUpFramedCreate2Child } from '../../../src/framed/deploy/create2-child.js';
import { callFramedEntry, type FramedCallResult } from '../../../src/framed/call/index.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A callee that calls back into a root which is a CREATE2 child, by the identity the child presents.
 *
 * `Guarded` is stood up as a CREATE2 child, so its frames present the child's EVM identity as `address(this)`, and the hook
 * calls back its own `msg.sender`: that identity. The re-entered frame is a further frame of the root's deployment, on
 * the root's records, so it meets the lock `Guarded.poke` holds and the call is refused by the root's own reason.
 */

const SOURCE = 'pragma solidity ^0.8.0;'
  + ' interface IGuarded { function touch() external; }'
  + ' interface IHook { function onCall() external; }'
  + ' contract Guarded { uint256 private unlocked = 1; uint256 public hits;'
  + '   modifier lock() { require(unlocked == 1, "Guarded: LOCKED"); unlocked = 0; _; unlocked = 1; }'
  + '   function poke(IHook hook) external lock { hook.onCall(); }'
  + '   function touch() external lock { hits += 1; } }'
  + ' contract Hook { uint256 public unit = 1; function onCall() external { IGuarded(msg.sender).touch(); } }';

const IDENTITY = hexToBin('5e'.repeat(20));

interface Deployed {
  readonly provider: MockNetworkProvider;
  readonly artifacts: Readonly<Record<string, Artifact>>;
  readonly categories: ReadonlyMap<string, string>;
  readonly hook: Uint8Array;
  readonly snapshot: SnapshotRestorer;
}

let run: Promise<Deployed> | undefined;

/** The hook, and Guarded stood up as the child at `IDENTITY`; each case rewinds the chain to them first. */
async function deployed(): Promise<Deployed> {
  run ??= (async (): Promise<Deployed> => {
    const compiled = compileStringMulti(SOURCE, { composition: 'framed', evmCompat: true } as never);
    const artifacts = { Guarded: compiled.Guarded!, Hook: compiled.Hook! };
    const { framedValidator } = await import('@solidcash/solidc');
    const validatorProgram = framedValidator.buildValidatorProgram();
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
    await fundShippedFacets(provider);
    const fundingUtxo = { txid: `${'7f'.repeat(31)}c0`, vout: 0, satoshis: 500_000n };
    await provider.addUtxo(funder.address, fundingUtxo);
    const hook = await deployStatefulContract(artifacts.Hook, [], {
      provider, fundingUtxo, changeAddress: funder.address,
      funder: funder.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
    });
    await standUpFramedCreate2Child({
      provider, artifact: artifacts.Guarded, creatorSelf: encodeLockingBytecodeP2pkh(alicePkh), identity: IDENTITY,
      signer: new Signer(alicePriv, provider),
    });
    const child = findDeploymentByAddress(provider, binToHex(IDENTITY))!;
    const categories = new Map([['Hook', hook.categoryId], ['Guarded', child.category!]]);
    return {
      provider, artifacts, categories, hook: validatorAddress(hexToBin(hook.categoryId), validatorProgram),
      snapshot: await provider.takeSnapshot(),
    };
  })();
  const chain = await run;
  await chain.snapshot.restore();
  return chain;
}

/** Enters `Guarded.poke` with the hook as its argument and a fresh coin of the user's. */
async function poke(chain: Deployed): Promise<FramedCallResult> {
  const user = encodeLockingBytecodeP2pkh(alicePkh);
  const callerUtxo = { txid: '81'.repeat(32), vout: 0, satoshis: 300_000n };
  await chain.provider.addUtxo(binToHex(user), callerUtxo);
  const externals = Object.fromEntries([...chain.categories]
    .map(([name, categoryId]) => [name, { artifact: chain.artifacts[name]!, categoryId }]));
  return callFramedEntry({
    provider: chain.provider, artifact: chain.artifacts.Guarded!, categoryId: chain.categories.get('Guarded')!,
    functionName: 'poke', args: [chain.hook], callerUtxo, callerLockingBytecode: user,
    funder: new SignatureTemplate(alicePriv).unlockP2PKH(), vm: compositionMachine(), externals,
  });
}

describe('a callee that calls back into a CREATE2 child root by its identity', () => {
  it('meets the root\'s own lock in the re-entered frame, and the call is refused by its reason', async () => {
    const chain = await deployed();
    const result = await poke(chain);
    expect(result.broadcast).toBeUndefined();
    expect(result.refusal?.innermost?.reason.message).toBe('Guarded: LOCKED');
  });
});
