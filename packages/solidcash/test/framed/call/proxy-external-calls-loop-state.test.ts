import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { binToHex, hexToBin } from '@bitauth/libauth';
import {
  buildChunkCommitment, buildPushdataCommitment, encodePushdataValue, splitValueIntoChunks,
  type Artifact,
} from '@solidcash/utils';
import { framedValidator } from '@solidcash/solidc';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import {
  chunkRecordLockingBytecode, deployMaster, entryRecordLockingBytecode, readFramedDeployment,
  stateRecordLockingBytecode,
} from '../../../src/framed/deploy/index.js';
import {
  deploymentStateValues, planHopExternalCalls,
} from '../../../src/framed/proxy/external-calls.js';
import { buildProxyArtifact } from '../../../src/framed/proxy/index.js';
import { headSentinelCommitment } from '../../../src/stateful/SortedList.js';

/**
 * A call site read from the caller's own facts, against the artifacts the compiler actually shipped.
 *
 * The artifacts are read from the repository's compiled output, and the suite is skipped with a clear message when
 * that directory is absent. Two shapes are solved from the caller's own facts:
 *
 *  - a repeated site the artifact publishes no iteration domain for, whose visits its own argument sources count
 *    from the arrays the caller supplies;
 *  - a site whose target and arguments live in a dynamic state value, whose records carry a byte length and whose
 *    value the hop joins from the field's chunk records the way the contract's own body reads it.
 *
 * The shape that must still be refused, a reach the callee's own master pool cannot serve, is pinned beside them,
 * and so is the entry whose several call sites reach one contract, which now plans with a master of that contract
 * per reach. A loop whose width only an earlier call's result fixes is `proxy-external-calls-published.test.ts`'s.
 */

const ARTIFACTS_DIR = resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../../../../.marketplace/artifacts/solidcash',
);
const VALIDATOR_PROGRAM = framedValidator.buildValidatorProgram();

const FACADE_CATEGORY = '0a'.repeat(31) + 'f5';
const DATA_CATEGORY = '0b'.repeat(31) + 'f4';
const DATA_PROXY_CATEGORY = '0d'.repeat(31) + 'f2';
const TOKEN_CATEGORY = '0c'.repeat(31) + 'f3';

/** One shipped artifact, loaded by file name. */
function loadArtifact(name: string): Artifact {
  return JSON.parse(readFileSync(join(ARTIFACTS_DIR, name), 'utf8')) as Artifact;
}

// The marketplace fixture directory is shared with the direct-composition lane, which compiles the same
// contracts without `composition: 'framed'`. Only a framed compile publishes the placeholder descriptor this
// planner's `deployMaster` fills, so skip the shipped-facts cases when the directory holds direct artifacts.
const hasArtifacts = existsSync(ARTIFACTS_DIR) && ((): boolean => {
  try {
    return loadArtifact('MarketplaceDataV1.json').composition?.convention === 'framed';
  } catch {
    return false;
  }
})();

/**
 * A live deployment of `artifact`'s category: masters, one record per data NFT, and the empty head a genesis mints
 * for every sorted collection, which for a proxy are its implementation's (`collections`).
 */
async function seedDeployment(
  network: MockNetworkProvider, artifact: Artifact, categoryId: string,
  state?: Record<string, unknown>, masterCount = 1,
  collections = artifact.stateLayout?.collections ?? [],
): Promise<{ readonly master: Uint8Array; readonly layout: NonNullable<Artifact['stateLayout']> }> {
  const category = hexToBin(categoryId);
  const layout = artifact.stateLayout!;
  const master = deployMaster(artifact, category, VALIDATOR_PROGRAM).address;
  for (let slot = 0; slot < masterCount; slot += 1) {
    await network.addUtxo(binToHex(master), {
      txid: `${categoryId.slice(0, 62)}${(0xf0 + slot).toString(16).padStart(2, '0')}`, vout: slot,
      satoshis: 500_000n,
      token: { category: categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
    });
  }
  for (let nftIndex = 0; nftIndex < layout.dataNftCount; nftIndex += 1) {
    await network.addUtxo(binToHex(stateRecordLockingBytecode(categoryId)), {
      txid: `${categoryId.slice(0, 62)}${(nftIndex + 1).toString(16).padStart(2, '0')}`,
      vout: nftIndex, satoshis: 1200n,
      token: {
        category: categoryId, amount: 0n,
        nft: { capability: 'mutable', commitment: buildPushdataCommitment(layout, (state ?? {}) as never, nftIndex) },
      },
    });
  }
  for (const [index, collection] of collections.filter((candidate) => candidate.sorted === true).entries()) {
    await network.addUtxo(binToHex(entryRecordLockingBytecode(categoryId, collection.signature)), {
      txid: `${categoryId.slice(0, 60)}${(0x80 + index).toString(16).padStart(2, '0')}ee`, vout: index,
      satoshis: 1200n,
      token: {
        category: categoryId, amount: 0n,
        nft: { capability: 'mutable', commitment: binToHex(headSentinelCommitment()) },
      },
    });
  }
  return { master, layout };
}

/** One chunk record of `categoryId`'s `variable`, carrying the bytes the data NFT's length accounts for. */
async function seedChunk(
  network: MockNetworkProvider, categoryId: string, variable: string, type: string,
  chunkIndex: number, chunkData: Uint8Array,
): Promise<void> {
  await network.addUtxo(binToHex(chunkRecordLockingBytecode(categoryId, variable, type)), {
    txid: `${categoryId.slice(0, 60)}${(0x40 + chunkIndex).toString(16).padStart(2, '0')}ff`,
    vout: chunkIndex, satoshis: 1200n,
    token: {
      category: categoryId, amount: 0n,
      nft: { capability: 'mutable', commitment: buildChunkCommitment(chunkIndex, chunkData) },
    },
  });
}

const describeShipped = hasArtifacts ? describe : describe.skip;

describeShipped('solving a call site from the caller\'s own facts', () => {
  const FACADE = 'MarketplaceV1.json';
  const DATA = 'MarketplaceDataV1.json';
  const TOKEN = 'FakeToken.json';

  it('states one record per visit for a repeated site whose artifact publishes no iteration domain', async () => {
    const network = new MockNetworkProvider();
    const facade = loadArtifact(FACADE);
    const data = loadArtifact(DATA);
    const dataDeployment = await seedDeployment(network, data, DATA_CATEGORY);

    // The entry's first loop runs over an empty list and its second over a one-element list: the site without a
    // published domain is the one that reaches the callee, so only it places one.
    const plan = await planHopExternalCalls({
      provider: network,
      artifact: facade,
      functionName: 'updateJobWhitelist',
      args: [0n, [], [new Uint8Array(35).fill(1)]],
      externals: { MarketplaceDataV1: { artifact: data, categoryId: DATA_CATEGORY } },
      stateValues: { marketplaceData: dataDeployment.master },
      validatorProgram: VALIDATOR_PROGRAM,
    });

    expect(plan.calls).toHaveLength(1);
    expect(plan.callees.map((callee) => callee.entry)).toStrictEqual(['publishJobEvent']);
    expect(binToHex(plan.calls[0]!.target)).toBe(binToHex(dataDeployment.master));
  });

  it("counts a repeated site's visits by the caller's own arrays", async () => {
    const network = new MockNetworkProvider();
    const facade = loadArtifact(FACADE);
    const data = loadArtifact(DATA);
    const workers = [new Uint8Array(35).fill(2), new Uint8Array(35).fill(3), new Uint8Array(35).fill(4)];
    // Each turn carries its own call data, so each takes a master of the callee: the pool holds one per worker.
    const dataDeployment = await seedDeployment(network, data, DATA_CATEGORY, undefined, workers.length);

    const plan = await planHopExternalCalls({
      provider: network,
      artifact: facade,
      functionName: 'updateJobWhitelist',
      args: [0n, [], workers],
      externals: { MarketplaceDataV1: { artifact: data, categoryId: DATA_CATEGORY } },
      stateValues: { marketplaceData: dataDeployment.master },
      validatorProgram: VALIDATOR_PROGRAM,
    });

    // The repeated site has no published domain, so its three records are the three elements the caller supplied,
    // and the three reaches run on three masters of the one callee contract.
    expect(plan.calls).toHaveLength(workers.length);
    expect(plan.callees).toHaveLength(workers.length);
  });

  it('resolves a call whose target and arguments live in a dynamic state value', async () => {
    const network = new MockNetworkProvider();
    const facade = loadArtifact(FACADE);
    const data = loadArtifact(DATA);
    const token = loadArtifact(TOKEN);
    const dataDeployment = await seedDeployment(network, data, DATA_CATEGORY);
    const tokenDeployment = await seedDeployment(network, token, TOKEN_CATEGORY);

    // The caller's own record declares a value that spans chunks: the data NFT carries its byte length and the
    // value itself sits in the field's chunk records, which is what the contract's own body reads.
    const layout = facade.stateLayout!;
    const creator = new Uint8Array(35).fill(5);
    const job = {
      roles: { creator, arbitrator: new Uint8Array(0), worker: new Uint8Array(0) },
      amount: 700n,
      collateralOwed: 30n,
      token: tokenDeployment.master,
      timestamp: 0n,
    };
    const blob = new Uint8Array([
      ...encodePushdataValue(1n, 'bigint'),
      ...encodePushdataValue(job as never, 'JobPost', layout.structs),
    ]);
    const facadeDeployment = await seedDeployment(network, facade, FACADE_CATEGORY, {
      'jobs$len': BigInt(blob.length),
    });
    await Promise.all(splitValueIntoChunks(blob).map((chunk, chunkIndex) => seedChunk(
      network, FACADE_CATEGORY, 'jobs', 'JobPost[]', chunkIndex, chunk,
    )));

    const deployment = await readFramedDeployment(network, FACADE_CATEGORY, facadeDeployment.layout);
    const state = deploymentStateValues(facadeDeployment.layout, FACADE_CATEGORY, deployment);
    expect((state.jobs as unknown[]).length).toBe(1);

    const plan = await planHopExternalCalls({
      provider: network,
      artifact: facade,
      functionName: 'closeJob',
      args: [0n],
      externals: {
        IERC20: { artifact: token, categoryId: TOKEN_CATEGORY },
        MarketplaceDataV1: { artifact: data, categoryId: DATA_CATEGORY },
      },
      stateValues: { ...state, marketplaceData: dataDeployment.master, __block_timestamp: 86_400n },
      validatorProgram: VALIDATOR_PROGRAM,
    });

    // The entry's two calls: the token transfer, whose target is the job record's own token, and the data manager.
    expect(plan.calls).toHaveLength(2);
    expect(binToHex(plan.calls[0]!.target)).toBe(binToHex(tokenDeployment.master));
    expect(binToHex(plan.calls[1]!.target)).toBe(binToHex(dataDeployment.master));
    expect(plan.callees.map((callee) => callee.entry)).toStrictEqual(['transfer', 'publishJobEvent']);
  });

  it('plans an entry whose several call sites reach one contract, one master per reach', async () => {
    const network = new MockNetworkProvider();
    const facade = loadArtifact(FACADE);
    const data = loadArtifact(DATA);
    const token = loadArtifact(TOKEN);
    // The entry's ten published sites reach the two contracts; two of them are gated on an earlier call's result,
    // which this pass does not hold, so it plans the eight the caller's own facts fix: five of the data manager and
    // three of the token. Each contract's pool holds five masters, enough for the reaches this pass can state.
    const dataDeployment = await seedDeployment(network, data, DATA_CATEGORY, undefined, 5);
    await seedDeployment(network, token, TOKEN_CATEGORY, undefined, 5);

    const plan = await planHopExternalCalls({
      provider: network,
      artifact: facade,
      functionName: 'publishJobPost',
      args: [
        'job', new Uint8Array(32).fill(7), true, ['a'], new Uint8Array(35).fill(8), 100n, 3600n, 'ipfs',
        new Uint8Array(35).fill(9), [new Uint8Array(35).fill(10)],
      ],
      externals: {
        IERC20: { artifact: token, categoryId: TOKEN_CATEGORY },
        MarketplaceDataV1: { artifact: data, categoryId: DATA_CATEGORY },
      },
      stateValues: { marketplaceData: dataDeployment.master, jobs: [0n] },
      selfAddress: new Uint8Array(35).fill(0x21),
      senderAddress: new Uint8Array(25).fill(0x22),
      validatorProgram: VALIDATOR_PROGRAM,
    });

    // Eight reaches, one master each; every reach names a master of its own, so no master serves two reaches.
    expect(plan.calls).toHaveLength(8);
    expect(plan.callees).toHaveLength(8);
    const perContract = new Map<string, number>();
    for (const callee of plan.callees) {
      perContract.set(callee.contract, (perContract.get(callee.contract) ?? 0) + 1);
    }
    expect([...perContract.values()].sort((left, right) => left - right)).toStrictEqual([3, 5]);
    expect(new Set(plan.calls.map((call) => call.callee)).size).toBe(plan.calls.length);
  });

  it('plans an entry whose several sites reach one contract behind its own proxy', async () => {
    const network = new MockNetworkProvider();
    const facade = loadArtifact(FACADE);
    const data = loadArtifact(DATA);
    const token = loadArtifact(TOKEN);
    const dataProxy = buildProxyArtifact(data);
    // The proxied callee is two contracts, so each of its five reaches takes a master of each; the direct callee
    // takes one per reach.
    const proxyDeployment = await seedDeployment(
      network, dataProxy, DATA_PROXY_CATEGORY, undefined, 5, data.stateLayout?.collections,
    );
    await seedDeployment(network, data, DATA_CATEGORY, undefined, 5);
    await seedDeployment(network, token, TOKEN_CATEGORY, undefined, 5);

    const plan = await planHopExternalCalls({
      provider: network,
      artifact: facade,
      functionName: 'publishJobPost',
      args: [
        'job', new Uint8Array(32).fill(7), true, ['a'], new Uint8Array(35).fill(8), 100n, 3600n, 'ipfs',
        new Uint8Array(35).fill(9), [new Uint8Array(35).fill(10)],
      ],
      externals: {
        IERC20: { artifact: token, categoryId: TOKEN_CATEGORY },
        MarketplaceDataV1: {
          artifact: data, categoryId: DATA_PROXY_CATEGORY,
          proxyArtifact: dataProxy, implementationCategoryId: DATA_CATEGORY,
        },
      },
      stateValues: { marketplaceData: proxyDeployment.master, jobs: [0n] },
      selfAddress: new Uint8Array(35).fill(0x21),
      senderAddress: new Uint8Array(25).fill(0x22),
      validatorProgram: VALIDATOR_PROGRAM,
    });

    // Eight reaches: the five into the proxied callee place a fallback and a delegate frame each, and the three the
    // caller's own facts fix into the direct callee place one master each. The two sites gated on an earlier call's
    // result are not stated in a pass that does not hold it.
    expect(plan.calls).toHaveLength(8);
    const perContract = new Map<string, number>();
    for (const callee of plan.callees) {
      perContract.set(callee.contract, (perContract.get(callee.contract) ?? 0) + 1);
    }
    expect(perContract.get(dataProxy.contractName)).toBe(5);
    expect(perContract.get(data.contractName)).toBe(5);
    expect(perContract.get(token.contractName)).toBe(3);
    expect(plan.callees).toHaveLength(13);
    // Every reach names a master of its own, and no two reaches share one.
    expect(new Set(plan.calls.map((call) => call.callee)).size).toBe(plan.calls.length);
  });

  it('refuses a reach the callee\'s own master pool cannot serve, naming the pool', async () => {
    const network = new MockNetworkProvider();
    const facade = loadArtifact(FACADE);
    const data = loadArtifact(DATA);
    const token = loadArtifact(TOKEN);
    // The data manager holds one master, so only one of the five sites that reach it can be served.
    const dataDeployment = await seedDeployment(network, data, DATA_CATEGORY);
    await seedDeployment(network, token, TOKEN_CATEGORY, undefined, 5);

    await expect(planHopExternalCalls({
      provider: network,
      artifact: facade,
      functionName: 'publishJobPost',
      args: [
        'job', new Uint8Array(32).fill(7), true, ['a'], new Uint8Array(35).fill(8), 100n, 3600n, 'ipfs',
        new Uint8Array(35).fill(9), [new Uint8Array(35).fill(10)],
      ],
      externals: {
        IERC20: { artifact: token, categoryId: TOKEN_CATEGORY },
        MarketplaceDataV1: { artifact: data, categoryId: DATA_CATEGORY },
      },
      stateValues: { marketplaceData: dataDeployment.master, jobs: [0n] },
      selfAddress: new Uint8Array(35).fill(0x21),
      senderAddress: new Uint8Array(25).fill(0x22),
      validatorProgram: VALIDATOR_PROGRAM,
    })).rejects.toThrow(
      /which this hop already places; its category \w+ holds 1 master\(s\), so it cannot be entered 2 time\(s\)/,
    );
  });
});

it.runIf(!hasArtifacts)('skips the shipped-facts loop suite: no compiled artifacts directory', () => {
  expect(hasArtifacts).toBe(false);
});
