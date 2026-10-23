import { afterEach, describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { parsePushdataCommitment, validatorAddress, type Artifact } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { readFramedDeployment } from '../../../src/framed/deploy/index.js';
import { callFramedEntry, type FramedCallResult } from '../../../src/framed/call/index.js';
import {
  framedComposerCounts, resetFramedComposerCounts, type FramedComposerCounts,
} from '../../../src/framed/composer/counters.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * The plain call path settles its callee frames one frame at a time, as the hop does (`settleCallees`): each callee is
 * judged from the derivation of its own subtree, deepest first, against what the frames below it handed back, and the
 * whole composition is derived again only for the values the entry itself computes - not once for every value a
 * callee hands back, from the root, as before.
 *
 * `A.run` reaches four callee frames on three contracts: `B.add` and `B.note` directly, `C.mark` with what `B.add`
 * returned, and `D.relay`, which enters `B.add` again one frame deeper. B is entered three times, and both of its
 * `add` frames rewrite its record, the deeper one starting from what the first one wrote, as the EVM's second call
 * does. The callees hand back four returns and one event payload. `A.stop` calls `B.add` and then refuses on its own
 * check, which a settle of its callee must not hide.
 */

const SOURCE = 'pragma solidity ^0.8.0;'
  + ' contract B { uint256 public total; event Noted(uint256 x);'
  + '   function add(uint256 amount) external returns (uint256) { total = total + amount; return total; }'
  + '   function note(uint256 x) external { emit Noted(x); } }'
  + ' contract C { uint256 public marks;'
  + '   function mark(uint256 x) external returns (uint256) { marks = marks + x; return x + 1; } }'
  + ' contract D { uint256 public relays;'
  + '   function relay(B b, uint256 amount) external returns (uint256) { relays = relays + 1; return b.add(amount) * 2; } }'
  + ' contract A { B public b; C public c; D public d; uint256 public last;'
  + '   constructor(B b_, C c_, D d_) { b = b_; c = c_; d = d_; }'
  + '   function run(uint256 amount) external returns (uint256) {'
  + '     uint256 x = b.add(amount); b.note(x); uint256 y = c.mark(x); uint256 z = d.relay(b, amount);'
  + '     last = x + y + z; return last; }'
  + '   function stop(uint256 amount) external returns (uint256) {'
  + '     uint256 x = b.add(amount); require(x > 1000, "too small"); return x; } }';

/** The four returns and the one event payload `A.run`'s callee frames hand back. */
const CALLEE_VALUES = 5;

interface Deployed {
  readonly provider: MockNetworkProvider;
  readonly artifacts: Readonly<Record<string, Artifact>>;
  readonly categories: ReadonlyMap<string, string>;
  readonly snapshot: SnapshotRestorer;
}

let run: Promise<Deployed> | undefined;

/** B, C, D and A, A holding the other three; each case rewinds the chain to them first. */
async function deployed(): Promise<Deployed> {
  run ??= (async (): Promise<Deployed> => {
    const compiled = compileStringMulti(SOURCE, { composition: 'framed', evmCompat: true } as never);
    const artifacts = { A: compiled.A!, B: compiled.B!, C: compiled.C!, D: compiled.D! };
    const { framedValidator } = await import('@solidcash/solidc');
    const validatorProgram = framedValidator.buildValidatorProgram();
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
    await fundShippedFacets(provider);
    const categories = new Map<string, string>();
    const locks = new Map<string, Uint8Array>();
    for (const [index, [name, args]] of ([['B', []], ['C', []], ['D', []], ['A', ['B', 'C', 'D']]] as const).entries()) {
      const fundingUtxo = { txid: `${'73'.repeat(31)}${(0xa0 + index).toString(16)}`, vout: 0, satoshis: 500_000n };
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

/** Enters one of A's entries with a fresh coin of the user's, counting the composer's work for that call alone. */
async function enter(
  chain: Deployed, functionName: string, args: readonly bigint[],
): Promise<{ readonly result: FramedCallResult; readonly counts: FramedComposerCounts }> {
  coins += 1;
  const user = encodeLockingBytecodeP2pkh(alicePkh);
  const callerUtxo = { txid: `${'74'.repeat(31)}${coins.toString(16).padStart(2, '0')}`, vout: 0, satoshis: 300_000n };
  await chain.provider.addUtxo(binToHex(user), callerUtxo);
  const externals = Object.fromEntries([...chain.categories]
    .map(([name, categoryId]) => [name, { artifact: chain.artifacts[name]!, categoryId }]));
  process.env.SOLIDC_DEBUG_FRAMED_COUNTS = '1';
  resetFramedComposerCounts();
  const result = await callFramedEntry({
    provider: chain.provider, artifact: chain.artifacts.A!, categoryId: chain.categories.get('A')!, functionName,
    args, callerUtxo, callerLockingBytecode: user, funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
    vm: compositionMachine(), externals,
  });
  return { result, counts: framedComposerCounts() };
}

/** A contract's records as its own layout decodes them, read back from the chain. */
async function recordOf(chain: Deployed, name: string): Promise<Record<string, unknown>> {
  const layout = chain.artifacts[name]!.stateLayout!;
  const set = await readFramedDeployment(chain.provider, chain.categories.get(name)!, layout);
  return Object.assign({}, ...set.records.slice(0, layout.dataNftCount)
    .map((record, nftIndex) => parsePushdataCommitment(record.token!.nft!.commitment, layout, nftIndex)));
}

afterEach(() => {
  delete process.env.SOLIDC_DEBUG_FRAMED_COUNTS;
});

describe('the plain call path settles its callee frames one frame at a time', () => {
  it('settles four callee frames one at a time, B entered twice, and derives the whole call for the root', async () => {
    const chain = await deployed();
    const { result, counts } = await enter(chain, 'run', [5n]);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    // x = 5 (B's total 5), y = 6, z = 2 * 10 (B's total 10 after the deeper add), last = 31.
    expect(result.values).toStrictEqual([31n]);
    expect(await recordOf(chain, 'B')).toMatchObject({ total: 10n });
    expect(await recordOf(chain, 'C')).toMatchObject({ marks: 5n });
    expect(await recordOf(chain, 'D')).toMatchObject({ relays: 1n });
    expect(await recordOf(chain, 'A')).toMatchObject({ last: 31n });
    // Every callee value is learned by its own frame's settle: no derivation from the root stops at a callee frame,
    // and the whole composition is derived fewer times than the callees hand values back.
    expect(counts.hopAttempts).toBeGreaterThanOrEqual(CALLEE_VALUES);
    expect(counts.scopedDerivations).toBe(0);
    expect(counts.derivations).toBeLessThan(CALLEE_VALUES);
  }, 300_000);

  it('reports the entry\'s own reason when it refuses after a call its settle accepted', async () => {
    const chain = await deployed();
    const { result } = await enter(chain, 'stop', [5n]);
    expect(result.accepted).toBe(false);
    expect(result.broadcast).toBeUndefined();
    expect(result.refusal?.innermost?.master).toBe('master');
    expect(result.refusal?.innermost?.reason.message).toBe('too small');
  }, 300_000);
});
