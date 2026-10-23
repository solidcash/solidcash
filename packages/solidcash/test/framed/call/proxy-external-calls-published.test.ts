import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { binToHex, hexToBin, utf8ToBin } from '@bitauth/libauth';
import { bytesToHex, buildPushdataCommitment, sha256, type Artifact } from '@solidcash/utils';
import { framedValidator } from '@solidcash/solidc';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { registerDeployment } from '../../../src/stateful/deployment-registry.js';
import {
  deployMaster, entryRecordLockingBytecode, stateRecordLockingBytecode,
} from '../../../src/framed/deploy/index.js';
import { planHopExternalCalls, type FramedProxyExternal } from '../../../src/framed/proxy/external-calls.js';
import { readPublishedStopSites } from '../../../src/framed/composer/index.js';
import { headSentinelCommitment } from '../../../src/stateful/SortedList.js';
import type { ConstructorArgument } from '../../../src/Argument.js';

/**
 * The planner against the artifacts the compiler actually shipped.
 *
 * The shapes these entries publish are the ones the planner used to refuse: call sites the source guards rather
 * than fixes (a `conditional` occurrence), call sites whose target address the entry's own code computes from a
 * state field or a forwarded parameter rather than naming as a literal, and arguments drawn from the caller's own
 * state. The artifacts are read from the repository's compiled output, and the suite is skipped with a clear
 * message when that directory is absent.
 */

const ARTIFACTS_DIR = resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../../../../.marketplace/artifacts/solidcash',
);
const VALIDATOR_PROGRAM = framedValidator.buildValidatorProgram();

/** One shipped artifact, loaded by file name. */
function loadArtifact(name: string): Artifact {
  return JSON.parse(readFileSync(join(ARTIFACTS_DIR, name), 'utf8')) as Artifact;
}

// The marketplace fixture directory is shared with the direct-composition lane, which compiles the same
// contracts without `composition: 'framed'`. Only a framed compile publishes the placeholder descriptor this
// planner's `deployMaster` fills, so skip the shipped-facts cases when the directory holds direct artifacts.
const hasFramedArtifacts = existsSync(ARTIFACTS_DIR) && ((): boolean => {
  try {
    return loadArtifact('MarketplaceV1.json').composition?.convention === 'framed';
  } catch {
    return false;
  }
})();

/** The interface name a callee artifact is reached through: the Solidity `I` prefix on its own name. */
function calleeInterface(artifact: Artifact): string {
  return `I${artifact.contractName}`;
}

/** The empty head a genesis mints for every sorted collection of `artifact`, at the collection's entry covenant. */
async function seedHeads(network: MockNetworkProvider, artifact: Artifact, categoryId: string): Promise<void> {
  const sorted = (artifact.stateLayout?.collections ?? []).filter((collection) => collection.sorted === true);
  for (const [index, collection] of sorted.entries()) {
    await network.addUtxo(binToHex(entryRecordLockingBytecode(categoryId, collection.signature)), {
      txid: `${categoryId.slice(0, 60)}${(0x80 + index).toString(16).padStart(2, '0')}ee`, vout: index,
      satoshis: 1200n,
      token: {
        category: categoryId, amount: 0n,
        nft: { capability: 'mutable', commitment: binToHex(headSentinelCommitment()) },
      },
    });
  }
}

/**
 * A live framed deployment of `artifact`'s category: its master, one record per data NFT, and the empty head of
 * every sorted collection.
 *
 * The planner only needs a category the provider can enumerate, so the pools are seeded directly rather than
 * derived by a genesis: a minting NFT at the master's own address, a mutable NFT at each data-NFT record's
 * covenant lock carrying a commitment that decodes through the shipped pushdata decoder, and the heads a genesis
 * mints, since a call never creates one.
 */
async function seedDeployment(
  network: MockNetworkProvider, artifact: Artifact, categoryId: string,
): Promise<Uint8Array> {
  const category = hexToBin(categoryId);
  const layout = artifact.stateLayout!;
  const master = deployMaster(artifact, category, VALIDATOR_PROGRAM).address;
  await network.addUtxo(binToHex(master), {
    txid: categoryId, vout: 0, satoshis: 500_000n,
    token: { category: categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  for (let nftIndex = 0; nftIndex < layout.dataNftCount; nftIndex += 1) {
    // The outpoint is domain-separated by the category so two seeded deployments sharing a lock still sit at
    // distinct outpoints, which is what the provider keeps apart.
    await network.addUtxo(binToHex(stateRecordLockingBytecode(categoryId)), {
      txid: `${categoryId.slice(0, 62)}${(nftIndex + 1).toString(16).padStart(2, '0')}`,
      vout: nftIndex, satoshis: 1200n,
      token: {
        category: categoryId, amount: 0n,
        nft: { capability: 'mutable', commitment: buildPushdataCommitment(layout, {}, nftIndex) },
      },
    });
  }
  await seedHeads(network, artifact, categoryId);
  return master;
}

const describePublished = hasFramedArtifacts ? describe : describe.skip;

describePublished('the planner against the shipped published facts', () => {
  const FACADE_CATEGORY = '0a'.repeat(31) + 'f5';
  const CLAIM_CATEGORY = '0c'.repeat(31) + 'f3';
  const TOKEN_CATEGORY = '0d'.repeat(31) + 'f2';
  const ARBITRATOR_CATEGORY = '0e'.repeat(31) + 'f1';

  it('resolves an entry whose single call targets a state-held address', async () => {
    const network = new MockNetworkProvider();
    const readerArtifact = loadArtifact('MarketplaceDataV1.json');
    const facadeArtifact = loadArtifact('MarketplaceV1.json');
    const facade = await seedDeployment(network, facadeArtifact, FACADE_CATEGORY);

    const plan = await planHopExternalCalls({
      provider: network,
      artifact: readerArtifact,
      functionName: 'getJob',
      args: [0n],
      externals: { [facadeArtifact.contractName]: { artifact: facadeArtifact, categoryId: FACADE_CATEGORY } },
      stateValues: { marketplace: facade },
      validatorProgram: VALIDATOR_PROGRAM,
    });

    expect(plan.calls).toHaveLength(1);
    expect(bytesToHex(plan.calls[0]!.target)).toBe(bytesToHex(facade));
    expect(plan.callees).toHaveLength(1);
    expect(plan.callees[0]!.entry).toBe('getJob');
    expect(plan.callees[0]!.returns).toBe(true);
  });

  it('resolves a conditional call whose target is a forwarded parameter', async () => {
    const network = new MockNetworkProvider();
    const callerArtifact = loadArtifact('Unicrow.json');
    const tokenArtifact = loadArtifact('FakeToken.json');
    const token = await seedDeployment(network, tokenArtifact, TOKEN_CATEGORY);

    const plan = await planHopExternalCalls({
      provider: network,
      artifact: callerArtifact,
      functionName: 'sendEscrowShare',
      args: [new Uint8Array(35).fill(0x11), 100n, token],
      externals: { IERC20: { artifact: tokenArtifact, categoryId: TOKEN_CATEGORY } },
      validatorProgram: VALIDATOR_PROGRAM,
    });

    // A `conditional` site still fills exactly one record, and it carries the callee's computed address.
    expect(plan.calls).toHaveLength(1);
    expect(bytesToHex(plan.calls[0]!.target)).toBe(bytesToHex(token));
  });

  it('resolves an entry whose guarded call reads its target and arguments from state', async () => {
    const network = new MockNetworkProvider();
    const callerArtifact = loadArtifact('Unicrow.json');
    const arbitratorArtifact = loadArtifact('UnicrowArbitrator.json');
    const tokenArtifact = loadArtifact('FakeToken.json');
    const arbitrator = await seedDeployment(network, arbitratorArtifact, ARBITRATOR_CATEGORY);
    await seedDeployment(network, tokenArtifact, TOKEN_CATEGORY);

    const plan = await planHopExternalCalls({
      provider: network,
      artifact: callerArtifact,
      functionName: 'refund',
      args: [0n],
      externals: {
        [calleeInterface(arbitratorArtifact)]: { artifact: arbitratorArtifact, categoryId: ARBITRATOR_CATEGORY },
        IERC20: { artifact: tokenArtifact, categoryId: TOKEN_CATEGORY },
      },
      stateValues: {
        unicrowArbitrator: arbitrator,
        escrows: [{ currency: new Uint8Array(35).fill(0x22), buyer: new Uint8Array(35).fill(0x33), amount: 250n }],
      },
      validatorProgram: VALIDATOR_PROGRAM,
    });

    // An unguarded call and a guarded one, in source order: two records, one per published call site.
    expect(plan.calls).toHaveLength(2);
    expect(plan.callees.map((callee) => callee.entry)).toStrictEqual(['getArbitratorData', 'transfer']);
  });

  it('resolves the callee from the provider registrations when the caller names none', async () => {
    const network = new MockNetworkProvider();
    const readerArtifact = loadArtifact('MarketplaceDataV1.json');
    const facadeArtifact = loadArtifact('MarketplaceV1.json');
    const facade = await seedDeployment(network, facadeArtifact, FACADE_CATEGORY);
    // The caller names no externals; the live deployment is resolved from the address the entry computes.
    registerDeployment(network, {
      contractName: facadeArtifact.contractName,
      address: binToHex(facade),
      contract: { artifact: facadeArtifact, categoryId: FACADE_CATEGORY },
    });

    const plan = await planHopExternalCalls({
      provider: network,
      artifact: readerArtifact,
      functionName: 'getJob',
      args: [0n],
      externals: {},
      stateValues: { marketplace: facade },
      validatorProgram: VALIDATOR_PROGRAM,
    });

    expect(plan.calls).toHaveLength(1);
    expect(bytesToHex(plan.calls[0]!.target)).toBe(bytesToHex(facade));
  });

  it("recurses into a callee that publishes calls of its own, naming the callee's own unresolved fact", async () => {
    const network = new MockNetworkProvider();
    const callerArtifact = loadArtifact('Unicrow.json');
    const claimArtifact = loadArtifact('UnicrowClaim.json');
    const claim = await seedDeployment(network, claimArtifact, CLAIM_CATEGORY);

    // The claim entry publishes calls of its own, so the planner plans them from the claim's live records; with a
    // default-seeded record its own state-held target is one the chain does not hold, which it names.
    await expect(planHopExternalCalls({
      provider: network,
      artifact: callerArtifact,
      functionName: 'release',
      args: [0n],
      externals: { [calleeInterface(claimArtifact)]: { artifact: claimArtifact, categoryId: CLAIM_CATEGORY } },
      stateValues: { unicrowClaim: claim },
      validatorProgram: VALIDATOR_PROGRAM,
    })).rejects.toThrow(
      /state field "[A-Za-z]+", which the caller's own state does not hold as an address/,
    );
  });

  it('stops before a loop whose width an earlier call returns, with that call placed', async () => {
    const network = new MockNetworkProvider();
    const readerArtifact = loadArtifact('MarketplaceDataV1.json');
    const facadeArtifact = loadArtifact('MarketplaceV1.json');
    const facade = await seedDeployment(network, facadeArtifact, FACADE_CATEGORY);

    // The reader's loop runs as many times as the callee reports, which no caller-held fact fixes: the planner places
    // the call that reports it and stops before the loop, so the hop can settle that call and plan the turns from
    // what it returned.
    const plan = await planHopExternalCalls({
      provider: network,
      artifact: readerArtifact,
      functionName: 'getJobs',
      args: [0n, 0n],
      externals: { [facadeArtifact.contractName]: { artifact: facadeArtifact, categoryId: FACADE_CATEGORY } },
      stateValues: { marketplace: facade },
      validatorProgram: VALIDATOR_PROGRAM,
    });

    expect(plan.blocked?.path).toBe('');
    expect(plan.blocked?.reads).toBe('loop-bound');
    expect(plan.callees.map((callee) => callee.functionName)).toStrictEqual(['MarketplaceV1.jobsLength()']);
    expect(plan.callees[0]!.origin?.callsiteId).toBe(plan.blocked?.producers[0]);
    expect(plan.calls).toHaveLength(1);
  });
});

it.runIf(!hasFramedArtifacts)('skips the shipped published-facts suite: no framed compiled artifacts', () => {
  // A clear signal rather than a silent pass when the repository's compiled output is not framed (or absent).
  expect(hasFramedArtifacts).toBe(false);
});

/** Every shipped contract artifact in the compiled output directory. */
function shippedArtifacts(): readonly Artifact[] {
  return readdirSync(ARTIFACTS_DIR).filter((name) => name.endsWith('.json'))
    .map((name) => loadArtifact(name))
    // An interface's artifact carries no composition at all: it has no bodies to publish facts for. A contract
    // artifact that carries a composition but no stop-site table still reaches `readPublishedStopSites`, which
    // refuses it, so a contract that stops publishing its call table keeps failing this suite.
    .filter((artifact) => artifact.composition !== undefined);
}

/** A non-zero, non-palindromic byte string of `width` bytes, so a byte-order mistake cannot hide. */
function oddBytes(width: number): Uint8Array {
  return Uint8Array.from({ length: width }, (_unused, index) => ((index * 37) + 11) & 0xff);
}

/**
 * True when a published condition reads an earlier call's result.
 *
 * Such a condition is not fixed by the caller's own facts: the hop states none of its visits in a pass that does
 * not hold that result, and only a later pass with the learned results decides it. A single-pass plan therefore
 * leaves these sites out.
 */
function conditionReadsProducerResult(condition: unknown): boolean {
  let found = false;
  const visit = (value: unknown): void => {
    if (found || value === null || typeof value !== 'object') return;
    const kind = (value as { readonly kind?: string }).kind;
    if (kind === 'producerResult' || kind === 'externalCall') { found = true; return; }
    for (const child of Object.values(value as Record<string, unknown>)) {
      if (Array.isArray(child)) child.forEach(visit);
      else visit(child);
    }
  };
  visit(condition);
  return found;
}

/** A value of `type` a call or a state field is given so every published condition can hold. */
function syntheticValue(type: string): ConstructorArgument {
  const array = type.match(/^(.*)\[(?:\d*)\]$/);
  if (array !== null) return [syntheticValue(array[1]!)];
  if (type === 'bool') return true;
  if (type === 'string') return 'text';
  if (type === 'address' || type.startsWith('address')) return oddBytes(35);
  const bytes = type.match(/^bytes(\d+)$/);
  if (bytes !== null) return oddBytes(Number(bytes[1]));
  if (type === 'bytes') return oddBytes(20);
  return 1n;
}

/** The artifact an interface names: by its own contract name, else by the methods a site calls through it. */
function artifactForInterface(
  interfaceName: string, methods: readonly string[], artifacts: readonly Artifact[],
): Artifact {
  const bare = interfaceName.replace(/^I/, '');
  const byName = artifacts.find((candidate) =>
    candidate.contractName === interfaceName || candidate.contractName === bare);
  if (byName !== undefined) return byName;
  const covering = artifacts.filter((candidate) =>
    methods.every((method) => candidate.abi.some((entry) => entry.name === method)));
  const named = covering.find((candidate) => candidate.contractName.toLowerCase() === bare.toLowerCase());
  const chosen = named ?? covering[0];
  if (chosen === undefined) {
    throw new Error(`no shipped artifact publishes the methods reached through ${interfaceName}`);
  }
  return chosen;
}

/** A 32-byte category that is neither constant nor palindromic, taken from its label. */
function categoryOf(label: string): string {
  return bytesToHex(sha256(utf8ToBin(label)));
}

/** A live deployment of `artifact`: `masterCount` masters, one record per data NFT, and its collections' heads. */
async function seedArtifact(
  network: MockNetworkProvider, artifact: Artifact, categoryId: string, masterCount: number,
): Promise<void> {
  const category = hexToBin(categoryId);
  const layout = artifact.stateLayout ?? { variables: [], dataNftCount: 0, commitmentLimit: 0 };
  const master = deployMaster(artifact, category, VALIDATOR_PROGRAM).address;
  for (let slot = 0; slot < masterCount; slot += 1) {
    await network.addUtxo(binToHex(master), {
      txid: `${categoryId.slice(0, 62)}${(0xf0 - slot).toString(16).padStart(2, '0')}`, vout: slot,
      satoshis: 500_000n,
      token: { category: categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
    });
  }
  for (let nftIndex = 0; nftIndex < layout.dataNftCount; nftIndex += 1) {
    await network.addUtxo(binToHex(stateRecordLockingBytecode(categoryId)), {
      txid: `${categoryId.slice(0, 62)}${(nftIndex + 1).toString(16).padStart(2, '0')}`,
      vout: nftIndex, satoshis: 1200n,
      token: { category: categoryId, amount: 0n,
        nft: { capability: 'mutable', commitment: buildPushdataCommitment(layout, {}, nftIndex) } },
    });
  }
  await seedHeads(network, artifact, categoryId);
}

describePublished('the plan against the shipped published call table', () => {
  it('states one call per published site the caller\'s own facts reach', async () => {
    const shipped = shippedArtifacts();
    // The shipped entry with the most published call sites; the artifact whose table states it is the caller.
    const candidates = shipped.flatMap((artifact) => readPublishedStopSites(artifact).entries
      .map((entry) => ({ artifact, entry })));
    const target = candidates.reduce((best, candidate) =>
      candidate.entry.calls.length > best.entry.calls.length ? candidate : best);
    const published = target.entry.calls;
    const functionName = published.length === 0 ? '' : target.entry.functionName
      .slice(target.artifact.contractName.length + 1, -2);
    expect(published.length).toBeGreaterThan(0);

    // One live deployment per shipped artifact, so every callee a site reaches has masters and records to run on.
    const network = new MockNetworkProvider();
    const categoryById = new Map<string, string>();
    const externals: Record<string, FramedProxyExternal> = {};
    for (const artifact of shipped) {
      const categoryId = categoryOf(artifact.contractName);
      categoryById.set(artifact.contractName, categoryId);
      await seedArtifact(network, artifact, categoryId, published.length + 1);
    }
    // The artifacts the published interfaces name, keyed by the interface each site calls through.
    const methodsByInterface = new Map<string, string[]>();
    for (const call of published) {
      methodsByInterface.set(call.interfaceName,
        [...methodsByInterface.get(call.interfaceName) ?? [], call.functionName]);
    }
    for (const [interfaceName, methods] of methodsByInterface) {
      const artifact = artifactForInterface(interfaceName, methods, shipped);
      externals[interfaceName] = { artifact, categoryId: categoryById.get(artifact.contractName)! };
    }

    // Facts that make every published condition hold and every loop visit at least once: a non-zero address, a
    // non-empty array, a non-zero integer. The state an address field holds is a non-zero lock, so a state-held
    // target resolves.
    const row = target.artifact.abi.find((entry) => entry.name === functionName)!;
    const args = row.inputs.map((input) => syntheticValue(input.type));
    const stateValues: Record<string, unknown> = {};
    for (const variable of target.artifact.stateLayout?.variables ?? []) {
      stateValues[variable.name] = syntheticValue(variable.type);
    }

    const plan = await planHopExternalCalls({
      provider: network,
      artifact: target.artifact,
      functionName,
      args,
      externals,
      stateValues,
      selfAddress: oddBytes(35),
      senderAddress: oddBytes(25),
      validatorProgram: VALIDATOR_PROGRAM,
    });

    const calleeOf = (master: string): { readonly contract: string; readonly entry: string } => {
      const callee = plan.callees.find((candidate) => candidate.master === master);
      if (callee === undefined) throw new Error(`the plan states no callee frame for ${master}`);
      return { contract: callee.contract, entry: callee.entry };
    };
    const stated = plan.calls.map((call) => calleeOf(call.callee));

    // A site whose published condition reads an earlier call's result is not fixed by the caller's own facts: this
    // pass states none of its visits, and only a later pass that holds the learned result states them. The plan's
    // calls are otherwise the published calls, one-to-one and in the same interface/method order.
    const routing = row.externalCalls ?? [];
    const gated = published.filter((_call, index) => conditionReadsProducerResult(routing[index]?.condition));
    const fixed = published.filter((_call, index) => !conditionReadsProducerResult(routing[index]?.condition));
    expect(gated.length).toBeGreaterThan(0);

    expect(plan.calls).toHaveLength(fixed.length);
    expect(stated.map((call) => call.entry)).toStrictEqual(fixed.map((call) => call.functionName));
    expect(stated.map((call) => call.contract)).toStrictEqual(fixed.map((call) =>
      externals[call.interfaceName]!.artifact.contractName));
    // Every published site still has a base, `-1` for the ones this pass states no reach for.
    expect(plan.callBases).toHaveLength(published.length);
    published.forEach((_call, index) => {
      expect(plan.callBases[index]! < 0).toBe(conditionReadsProducerResult(routing[index]?.condition));
    });
  });
});
