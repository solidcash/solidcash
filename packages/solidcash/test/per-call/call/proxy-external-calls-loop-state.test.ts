import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { binToHex, hexToBin } from '@bitauth/libauth';
import {
  buildChunkCommitment, buildPushdataCommitment, encodePushdataValue, splitValueIntoChunks,
  type Artifact,
} from '@solidcash/utils';
import { perCallValidator } from 'solidc';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import {
  chunkRecordLockingBytecode, deployMaster, readPerCallDeployment, stateRecordLockingBytecode,
} from '../../../src/per-call/deploy/index.js';
import {
  deploymentStateValues, planHopExternalCalls,
} from '../../../src/per-call/proxy/external-calls.js';
import { buildProxyArtifact } from '../../../src/per-call/proxy/index.js';

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
 * The shapes that must still be refused — a loop whose width only an earlier call's result fixes, and a reach the
 * callee's own master pool cannot serve — are pinned beside them, and so is the entry whose several call sites
 * reach one contract, which now plans with a master of that contract per reach.
 */

const ARTIFACTS_DIR = resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../../../../.marketplace/artifacts/solidcash',
);
const hasArtifacts = existsSync(ARTIFACTS_DIR);
const VALIDATOR_PROGRAM = perCallValidator.buildValidatorProgram();

const FACADE_CATEGORY = '0a'.repeat(32);
const DATA_CATEGORY = '0b'.repeat(32);
const DATA_PROXY_CATEGORY = '0d'.repeat(32);
const TOKEN_CATEGORY = '0c'.repeat(32);

/** One shipped artifact, loaded by file name. */
function loadArtifact(name: string): Artifact {
  return JSON.parse(readFileSync(join(ARTIFACTS_DIR, name), 'utf8')) as Artifact;
}

/** A live deployment of `artifact`'s category: masters, one record per data NFT, and any chunks given. */
async function seedDeployment(
  network: MockNetworkProvider, artifact: Artifact, categoryId: string,
  state?: Record<string, unknown>, masterCount = 1,
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

const describeShipped: typeof describe = hasArtifacts ? describe : describe.skip;

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

  it("resolves a call whose target and arguments live in a dynamic state value", async () => {
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

    const deployment = await readPerCallDeployment(network, FACADE_CATEGORY, facadeDeployment.layout);
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
    // The entry's ten sites reach the two contracts five times each, so each contract's pool holds five masters.
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

    // The entry that used to be refused now plans: ten reaches, one master each, five of them of each contract.
    expect(plan.calls).toHaveLength(10);
    expect(plan.callees).toHaveLength(10);
    const perContract = new Map<string, number>();
    for (const callee of plan.callees) {
      perContract.set(callee.contract, (perContract.get(callee.contract) ?? 0) + 1);
    }
    expect([...perContract.values()].sort((left, right) => left - right)).toStrictEqual([5, 5]);
    // Every reach names a master of its own: no master serves two reaches.
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
    const proxyDeployment = await seedDeployment(network, dataProxy, DATA_PROXY_CATEGORY, undefined, 5);
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

    // Ten reaches: the five into the proxied callee place a fallback and a delegate frame each, and the five into
    // the direct callee place one master each.
    expect(plan.calls).toHaveLength(10);
    const perContract = new Map<string, number>();
    for (const callee of plan.callees) {
      perContract.set(callee.contract, (perContract.get(callee.contract) ?? 0) + 1);
    }
    expect(perContract.get(dataProxy.contractName)).toBe(5);
    expect(perContract.get(data.contractName)).toBe(5);
    expect(perContract.get(token.contractName)).toBe(5);
    expect(plan.callees).toHaveLength(15);
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

  it("still refuses a loop whose width an earlier call's result fixes", async () => {
    const network = new MockNetworkProvider();
    const data = loadArtifact(DATA);
    const facade = loadArtifact(FACADE);
    await seedDeployment(network, facade, FACADE_CATEGORY);

    // The reader's loop runs as many times as the callee it calls first reports, which no caller-held fact fixes.
    await expect(planHopExternalCalls({
      provider: network,
      artifact: data,
      functionName: 'getJobs',
      args: [0n, 0n],
      externals: { MarketplaceV1: { artifact: facade, categoryId: FACADE_CATEGORY } },
      stateValues: { marketplace: new Uint8Array(35).fill(6) },
      validatorProgram: VALIDATOR_PROGRAM,
    })).rejects.toThrow(/runs a loop whose bound is not fixed by the caller's own arguments/);
  });
});

it.runIf(!hasArtifacts)('skips the shipped-facts loop suite: no compiled artifacts directory', () => {
  expect(hasArtifacts).toBe(false);
});
