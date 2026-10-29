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
 * Calls whose arguments the body computes in a way no published expression states, planned from what a run of the
 * body hashed for them.
 *
 * `A.run` fills a local array from a loop of `Feed.quote` calls, each turn quoting the element the last one wrote,
 * and pays the last element into `Sink.add`; `A.spread` pays every quoted element, one `Sink.add` per turn. An
 * element of a local array is no expression the artifact can publish, so the planner stops before each visit that
 * passes one (every quote turn and every payment), a run of the body up to it hashes the arguments the body computed
 * there, and the visit is planned from them. The site binds its record to that digest, so the amounts the sink adds
 * are the body's own.
 */

const PRICE = 7n;

const SOURCE = 'pragma solidity ^0.8.0;'
  + ' contract Feed { uint256 public price;'
  + `   constructor() { price = ${PRICE}; }`
  + '   function quote(uint256 x) external view returns (uint256) { return x * price; } }'
  + ' contract Sink { uint256 public total;'
  + '   function add(uint256 amount) external { total = total + amount; } }'
  + ' contract A { Feed public feed; Sink public sink;'
  + '   constructor(Feed f, Sink s) { feed = f; sink = s; }'
  + '   function run(uint256 seed) external {'
  + '     uint256[] memory amounts = new uint256[](3);'
  + '     amounts[0] = seed;'
  + '     for (uint256 i = 0; i < 2; i++) { amounts[i + 1] = feed.quote(amounts[i]); }'
  + '     sink.add(amounts[2]); }'
  + '   function spread(uint256 seed) external {'
  + '     uint256[] memory amounts = new uint256[](3);'
  + '     amounts[0] = seed;'
  + '     for (uint256 i = 0; i < 2; i++) { amounts[i + 1] = feed.quote(amounts[i]); }'
  + '     for (uint256 j = 1; j < 3; j++) { sink.add(amounts[j]); } } }';

interface Deployed {
  readonly provider: MockNetworkProvider;
  readonly artifacts: Readonly<Record<string, Artifact>>;
  readonly categories: ReadonlyMap<string, string>;
  readonly snapshot: SnapshotRestorer;
}

let run: Promise<Deployed> | undefined;

/** Feed, Sink and A, A holding the other two; each case rewinds the chain to them first. */
async function deployed(): Promise<Deployed> {
  run ??= (async (): Promise<Deployed> => {
    const compiled = compileStringMulti(SOURCE, { composition: 'framed', evmCompat: true } as never);
    const artifacts = { Feed: compiled.Feed!, Sink: compiled.Sink!, A: compiled.A! };
    const { framedValidator } = await import('@solidcash/solidc');
    const validatorProgram = framedValidator.buildValidatorProgram();
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
    await fundShippedFacets(provider);
    const categories = new Map<string, string>();
    const locks = new Map<string, Uint8Array>();
    for (const [index, [name, args]] of ([['Feed', []], ['Sink', []], ['A', ['Feed', 'Sink']]] as const).entries()) {
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

/** Enters one of A's entries with a fresh coin of the user's. */
async function enter(chain: Deployed, functionName: string, args: readonly bigint[]): Promise<FramedCallResult> {
  coins += 1;
  const user = encodeLockingBytecodeP2pkh(alicePkh);
  const callerUtxo = { txid: `${'74'.repeat(31)}${coins.toString(16).padStart(2, '0')}`, vout: 0, satoshis: 300_000n };
  await chain.provider.addUtxo(binToHex(user), callerUtxo);
  const externals = Object.fromEntries([...chain.categories]
    .map(([name, categoryId]) => [name, { artifact: chain.artifacts[name]!, categoryId }]));
  return callFramedEntry({
    provider: chain.provider, artifact: chain.artifacts.A!, categoryId: chain.categories.get('A')!, functionName,
    args, callerUtxo, callerLockingBytecode: user, funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
    vm: compositionMachine(), externals,
  });
}

/** The sink's total as its own layout decodes it, read back from the chain. */
async function sinkTotal(chain: Deployed): Promise<unknown> {
  const layout = chain.artifacts.Sink!.stateLayout!;
  const set = await readFramedDeployment(chain.provider, chain.categories.get('Sink')!, layout);
  const record = Object.assign({}, ...set.records.slice(0, layout.dataNftCount)
    .map((entry, nftIndex) => parsePushdataCommitment(entry.token!.nft!.commitment, layout, nftIndex)));
  return (record as { total?: unknown }).total;
}

/** True when an expression holds a node no planner evaluates: one the compiler could not, or did not, publish. */
function unevaluable(expression: unknown): boolean {
  if (expression === null || typeof expression !== 'object') return false;
  const kind = (expression as { kind?: unknown }).kind;
  return kind === 'missing' || kind === 'unsupported' || Object.values(expression).some(unevaluable);
}

describe('calls whose arguments the body computes', () => {
  it('publishes the quoted and the paid elements as no expression the planner can evaluate', async () => {
    const chain = await deployed();
    const calls = chain.artifacts.A!.abi.find((entry) => entry.name === 'run')!.externalCalls!;
    for (const name of ['quote', 'add']) {
      expect(unevaluable(calls.find((call) => call.functionName === name)!.argSources?.[0]?.expression)).toBe(true);
    }
  });

  it('pays the amount a loop of earlier calls computed, read from the run that hashed it', async () => {
    const chain = await deployed();
    const result = await enter(chain, 'run', [3n]);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(result.completed.map((frame) => frame.functionName))
      .toStrictEqual(['Feed.quote()', 'Feed.quote()', 'Sink.add()', 'A.run()']);
    expect(await sinkTotal(chain)).toBe(3n * PRICE * PRICE);
  });

  it('pays one computed amount per turn of a loop, each turn planned from its own run', async () => {
    const chain = await deployed();
    const result = await enter(chain, 'spread', [2n]);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(await sinkTotal(chain)).toBe(2n * PRICE + 2n * PRICE * PRICE);
  });
});
