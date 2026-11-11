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
 * A loop whose body calls at two sites makes each turn's calls before the next turn's.
 *
 * `Walker.walk` reads the counter and bumps it by what it read plus one, once per turn: a turn's read sees the bump
 * the turn before made, so the totals run 0, 1, 3. The frames are placed turn by turn, the read of each turn after
 * the bump of the one before, and each record falls where the walker's body binds it.
 */

const SOURCE = 'pragma solidity ^0.8.0;'
  + ' contract Counter { uint256 public total;'
  + '   function bump(uint256 by) external { total = total + by; }'
  + '   function read() external view returns (uint256) { return total; } }'
  + ' contract Walker { uint256 public last;'
  + '   function walk(Counter c, uint256 n) external {'
  + '     for (uint256 i = 0; i < n; i++) { uint256 seen = c.read(); c.bump(seen + 1); } } }';

interface Deployed {
  readonly provider: MockNetworkProvider;
  readonly artifacts: Readonly<Record<string, Artifact>>;
  readonly categories: ReadonlyMap<string, string>;
  readonly locks: ReadonlyMap<string, Uint8Array>;
  readonly snapshot: SnapshotRestorer;
}

let run: Promise<Deployed> | undefined;

/** The counter and the walker; each case rewinds the chain to them first. */
async function deployed(): Promise<Deployed> {
  run ??= (async (): Promise<Deployed> => {
    const compiled = compileStringMulti(SOURCE, { composition: 'framed', evmCompat: true } as never);
    const artifacts = { Counter: compiled.Counter!, Walker: compiled.Walker! };
    const { framedValidator } = await import('@solidcash/solidc');
    const validatorProgram = framedValidator.buildValidatorProgram();
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
    await fundShippedFacets(provider);
    const categories = new Map<string, string>();
    const locks = new Map<string, Uint8Array>();
    for (const [index, name] of (['Counter', 'Walker'] as const).entries()) {
      const fundingUtxo = { txid: `${'72'.repeat(31)}${(0xa0 + index).toString(16)}`, vout: 0, satoshis: 500_000n };
      await provider.addUtxo(funder.address, fundingUtxo);
      const deployment = await deployStatefulContract(artifacts[name], [], {
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

/** Enters `Walker.walk` with a fresh coin of the user's. */
async function walk(chain: Deployed, n: bigint): Promise<FramedCallResult> {
  const user = encodeLockingBytecodeP2pkh(alicePkh);
  const callerUtxo = { txid: '71'.repeat(32), vout: 0, satoshis: 300_000n };
  await chain.provider.addUtxo(binToHex(user), callerUtxo);
  const externals = Object.fromEntries([...chain.categories]
    .map(([name, categoryId]) => [name, { artifact: chain.artifacts[name]!, categoryId }]));
  return callFramedEntry({
    provider: chain.provider, artifact: chain.artifacts.Walker!, categoryId: chain.categories.get('Walker')!,
    functionName: 'walk', args: [chain.locks.get('Counter')!, n], callerUtxo, callerLockingBytecode: user,
    funder: new SignatureTemplate(alicePriv).unlockP2PKH(), vm: compositionMachine(), externals,
  });
}

/** The counter's total as its own layout decodes it, read back from the chain. */
async function total(chain: Deployed): Promise<unknown> {
  const layout = chain.artifacts.Counter!.stateLayout!;
  const set = await readFramedDeployment(chain.provider, chain.categories.get('Counter')!, layout);
  const record = Object.assign({}, ...set.records.slice(0, layout.dataNftCount)
    .map((entry, nftIndex) => parsePushdataCommitment(entry.token!.nft!.commitment, layout, nftIndex)));
  return (record as { total?: unknown }).total;
}

describe('a loop whose body calls at two sites', () => {
  it('makes each turn\'s read and bump before the next turn\'s, each read seeing the bump before it', async () => {
    const chain = await deployed();
    const result = await walk(chain, 2n);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(await total(chain)).toBe(3n);
  });
});
