import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { parsePushdataCommitment, validatorAddress, type Artifact } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { readFramedDeployment } from '../../../src/framed/deploy/index.js';
import { callFramedEntry, type FramedCallResult } from '../../../src/framed/call/index.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A callee that calls back into a plain root: a further frame of the root's deployment, on the root's records.
 *
 * `Guarded.poke` holds a lock while it calls the hook, whose `onCall` calls `Guarded.touch` back, so the re-entered
 * frame meets the lock and the call is refused by the root's own reason. `Guarded.ping` holds none, and the hook's
 * `onPing` calls `Guarded.note` back, which counts a hit on the root's record the root frame then keeps.
 */

const SOURCE = 'pragma solidity ^0.8.0;'
  + ' interface IHook { function onCall() external; function onPing() external; }'
  + ' contract Guarded { uint256 private unlocked = 1; uint256 public hits;'
  + '   modifier lock() { require(unlocked == 1, "Guarded: LOCKED"); unlocked = 0; _; unlocked = 1; }'
  + '   function poke(IHook hook) external lock { hook.onCall(); }'
  + '   function touch() external lock { hits += 1; }'
  + '   function ping(IHook hook) external { hook.onPing(); }'
  + '   function note() external { hits += 1; } }'
  + ' contract Hook { Guarded public g;'
  + '   constructor(Guarded x) { g = x; }'
  + '   function onCall() external { g.touch(); }'
  + '   function onPing() external { g.note(); } }';

interface Deployed {
  readonly provider: MockNetworkProvider;
  readonly artifacts: Readonly<Record<string, Artifact>>;
  readonly categories: ReadonlyMap<string, string>;
  readonly locks: ReadonlyMap<string, Uint8Array>;
  readonly snapshot: SnapshotRestorer;
}

let run: Promise<Deployed> | undefined;

/** Guarded, and the hook that holds it; each case rewinds the chain to them first. */
async function deployed(): Promise<Deployed> {
  run ??= (async (): Promise<Deployed> => {
    const compiled = compileStringMulti(SOURCE, { composition: 'framed', evmCompat: true } as never);
    const artifacts = { Guarded: compiled.Guarded!, Hook: compiled.Hook! };
    const { framedValidator } = await import('@solidcash/solidc');
    const validatorProgram = framedValidator.buildValidatorProgram();
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
    await fundShippedFacets(provider);
    const categories = new Map<string, string>();
    const locks = new Map<string, Uint8Array>();
    for (const [index, [name, args]] of ([['Guarded', []], ['Hook', ['Guarded']]] as const).entries()) {
      const fundingUtxo = { txid: `${'7f'.repeat(31)}${(0xa0 + index).toString(16)}`, vout: 0, satoshis: 500_000n };
      await provider.addUtxo(funder.address, fundingUtxo);
      const deployment = await deployStatefulContract(artifacts[name]!, args.map((arg) => locks.get(arg)!), {
        provider, fundingUtxo, changeAddress: funder.address,
        funder: funder.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      });
      categories.set(name, deployment.categoryId);
      locks.set(name, validatorAddress(hexToBin(deployment.categoryId), validatorProgram));
    }
    return { provider, artifacts, categories, locks, snapshot: await provider.takeSnapshot() };
  })();
  const chain = await run;
  await chain.snapshot.restore();
  return chain;
}

let coins = 0;

/** Enters one of Guarded's entries with the hook as its argument and a fresh coin of the user's. */
async function enter(chain: Deployed, functionName: string): Promise<FramedCallResult> {
  coins += 1;
  const user = encodeLockingBytecodeP2pkh(alicePkh);
  const callerUtxo = { txid: `${'80'.repeat(31)}${coins.toString(16).padStart(2, '0')}`, vout: 0, satoshis: 300_000n };
  await chain.provider.addUtxo(binToHex(user), callerUtxo);
  const externals = Object.fromEntries([...chain.categories]
    .map(([name, categoryId]) => [name, { artifact: chain.artifacts[name]!, categoryId }]));
  return callFramedEntry({
    provider: chain.provider, artifact: chain.artifacts.Guarded!, categoryId: chain.categories.get('Guarded')!,
    functionName, args: [chain.locks.get('Hook')!], callerUtxo, callerLockingBytecode: user,
    funder: new SignatureTemplate(alicePriv).unlockP2PKH(), vm: compositionMachine(), externals,
  });
}

/** Guarded's hit count as its own layout decodes it, read back from the chain. */
async function hits(chain: Deployed): Promise<unknown> {
  const layout = chain.artifacts.Guarded!.stateLayout!;
  const set = await readFramedDeployment(chain.provider, chain.categories.get('Guarded')!, layout);
  const record = Object.assign({}, ...set.records.slice(0, layout.dataNftCount)
    .map((entry, nftIndex) => parsePushdataCommitment(entry.token!.nft!.commitment, layout, nftIndex)));
  return (record as { hits?: unknown }).hits;
}

describe('a callee that calls back into a plain root', () => {
  it('meets the root\'s own lock in the re-entered frame, and the call is refused by its reason', async () => {
    const chain = await deployed();
    const result = await enter(chain, 'poke');
    expect(result.broadcast).toBeUndefined();
    expect(result.refusal?.innermost?.reason.message).toBe('Guarded: LOCKED');
  });

  it('counts the hit the re-entered frame writes on the root\'s record', async () => {
    const chain = await deployed();
    const result = await enter(chain, 'ping');
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(await hits(chain)).toBe(1n);
  });
});
