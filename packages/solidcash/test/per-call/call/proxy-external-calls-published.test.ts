import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { binToHex, hexToBin, utf8ToBin } from '@bitauth/libauth';
import { bytesToHex, buildPushdataCommitment, sha256, type Artifact } from '@solidcash/utils';
import { perCallValidator } from 'solidc';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { registerDeployment } from '../../../src/stateful/deployment-registry.js';
import { deployMaster, stateRecordLockingBytecode } from '../../../src/per-call/deploy/index.js';
import { planHopExternalCalls, type PerCallProxyExternal } from '../../../src/per-call/proxy/external-calls.js';
import { readPublishedStopSites } from '../../../src/per-call/composer/index.js';
import type { FunctionArgument } from '../../../src/Argument.js';

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
const hasArtifacts = existsSync(ARTIFACTS_DIR);
const VALIDATOR_PROGRAM = perCallValidator.buildValidatorProgram();

/** One shipped artifact, loaded by file name. */
function loadArtifact(name: string): Artifact {
  return JSON.parse(readFileSync(join(ARTIFACTS_DIR, name), 'utf8')) as Artifact;
}

/** The interface name a callee artifact is reached through: the Solidity `I` prefix on its own name. */
function calleeInterface(artifact: Artifact): string {
  return `I${artifact.contractName}`;
}

/**
 * A live per-call deployment of `artifact`'s category: its master and one record per data NFT.
 *
 * The planner only needs a category the provider can enumerate, so the pools are seeded directly rather than
 * derived by a genesis: a minting NFT at the master's own address, and a mutable NFT at each data-NFT record's
 * covenant lock carrying a commitment that decodes through the shipped pushdata decoder.
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
  return master;
}

const describePublished: typeof describe = hasArtifacts ? describe : describe.skip;

describePublished('the planner against the shipped published facts', () => {
  const FACADE_CATEGORY = '0a'.repeat(32);
  const CLAIM_CATEGORY = '0c'.repeat(32);
  const TOKEN_CATEGORY = '0d'.repeat(32);
  const ARBITRATOR_CATEGORY = '0e'.repeat(32);

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

  it('refuses a loop whose width the caller arguments do not fix, naming the width', async () => {
    const network = new MockNetworkProvider();
    const readerArtifact = loadArtifact('MarketplaceDataV1.json');
    const facadeArtifact = loadArtifact('MarketplaceV1.json');

    // The reader's loop runs as many times as the callee reports, which no caller-held fact fixes.
    await expect(planHopExternalCalls({
      provider: network,
      artifact: readerArtifact,
      functionName: 'getJobs',
      args: [0n, 0n],
      externals: { [facadeArtifact.contractName]: { artifact: facadeArtifact, categoryId: FACADE_CATEGORY } },
      stateValues: { marketplace: new Uint8Array(35).fill(0x44) },
      validatorProgram: VALIDATOR_PROGRAM,
    })).rejects.toThrow(/runs a loop whose bound is not fixed by the caller's own arguments/);
  });
});

it.runIf(!hasArtifacts)('skips the shipped published-facts suite: no compiled artifacts directory', () => {
  // A clear signal rather than a silent pass when the repository's compiled output is not present.
  expect(hasArtifacts).toBe(false);
});

/** Every shipped artifact in the compiled output directory. */
function shippedArtifacts(): readonly Artifact[] {
  return readdirSync(ARTIFACTS_DIR).filter((name) => name.endsWith('.json'))
    .map((name) => loadArtifact(name));
}

/** A non-zero, non-palindromic byte string of `width` bytes, so a byte-order mistake cannot hide. */
function oddBytes(width: number): Uint8Array {
  return Uint8Array.from({ length: width }, (_unused, index) => ((index * 37) + 11) & 0xff);
}

/** A value of `type` a call or a state field is given so every published condition can hold. */
function syntheticValue(type: string): FunctionArgument {
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

/** A live deployment of `artifact`: `masterCount` masters and one record per data NFT. */
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
    const externals: Record<string, PerCallProxyExternal> = {};
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

    // The plan's calls are the published calls, one-to-one and in the same interface/method order.
    expect(plan.calls).toHaveLength(published.length);
    expect(stated.map((call) => call.entry)).toStrictEqual(published.map((call) => call.functionName));
    expect(stated.map((call) => call.contract)).toStrictEqual(published.map((call) =>
      externals[call.interfaceName]!.artifact.contractName));
    expect(plan.callBases).toHaveLength(published.length);
  });
});
