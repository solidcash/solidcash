import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { validatorAddress, type Artifact } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { callFramedEntry, type FramedCallResult } from '../../../src/framed/call/index.js';
import {
  buildProxyArtifact, callFramedProxyEntry, deployFramedProxy, type FramedProxyCallResult,
} from '../../../src/framed/proxy/index.js';
import type { FramedProxyExternal } from '../../../src/framed/proxy/external-calls.js';
import type { Unlocker, Utxo } from '../../../src/interfaces.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * A chain for the walls-ahead replicas of ordinary Solidity shapes: sources compiled the way a project's framed
 * build compiles them (`solidityImportCompat`, the shipped framed convention), deployed through the shipped
 * deployment paths, and entered the way a project's handle enters them: a plain deployment through the plain call
 * path (`callFramedEntry`) and a contract behind its generated proxy through the hop (`callFramedProxyEntry`).
 *
 * Nothing here supplies a coordinate or a record: every plan, frame and verdict is the shipped code's own.
 */

/** The compile options a framed project build uses (the fixture's `solidcash.config.ts`, as its tests set them). */
export const PROJECT_OPTIONS = {
  solidityImportCompat: true,
  commitmentLimit: 128,
  maximumInputBytes: 10_000_000,
  messageBus: true,
  optimizeForCompilationSpeed: true,
  suppressWarnings: true,
  ecrecover: 'p2pkh',
  sortedMappingsAll: false,
  composition: 'framed',
} as const;

export type ArtifactMap = ReturnType<typeof compileStringMulti>;

/** Compiles a unit of Solidity sources as a framed project build does. */
export function compileProject(source: string): ArtifactMap {
  return compileStringMulti(source, PROJECT_OPTIONS as never);
}

/**
 * Compiles a unit with the framed convention and the Solidity compatibility layer only, as the conformance rows
 * do: no message-bus route is generated beside the framed bodies.
 */
export function compileFramed(source: string): ArtifactMap {
  return compileStringMulti(source, { solidityImportCompat: true, composition: 'framed' } as never);
}

/** The deployer's lock, which also enters every call: the root frame's `msg.sender`. */
export const USER_LOCK = encodeLockingBytecodeP2pkh(alicePkh);
const USER_FUNDER: Unlocker = new SignatureTemplate(alicePriv).unlockP2PKH();

/** A framed contract's address, which its category fixes. */
export const addressOfCategory = (categoryId: string): Uint8Array =>
  validatorAddress(hexToBin(categoryId), VALIDATOR_PROGRAM);

/** A 32-byte id, distinct per `serial`, used both as a coin's txid and as the category its genesis mints. */
function idOf(seed: number, serial: number): string {
  return `${seed.toString(16).padStart(2, '0')}${serial.toString(16).padStart(6, '0')}`.padEnd(64, 'c');
}

/** One network, the deployer's wallet and a coin factory. */
export interface World {
  readonly network: MockNetworkProvider;
  readonly changeAddress: string;
  /** A fresh coin at the deployer's wallet (for a genesis) or at the user's lock (for a call). */
  readonly walletCoin: () => Promise<Utxo>;
  readonly userCoin: () => Promise<Utxo>;
  readonly walletFunder: Unlocker;
}

/** A fresh mock network under the composition limits, with the validator facets funded. */
export async function newWorld(seed: number): Promise<World> {
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  await fundShippedFacets(network);
  let serial = 0;
  const coin = async (lock: string): Promise<Utxo> => {
    serial += 1;
    const utxo = { txid: idOf(seed, serial), vout: 0, satoshis: 5_000_000n };
    await network.addUtxo(lock, utxo);
    return utxo;
  };
  return {
    network,
    changeAddress: wallet.address,
    walletCoin: () => coin(wallet.address),
    userCoin: () => coin(binToHex(USER_LOCK)),
    walletFunder: wallet.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
  };
}

/** A plain deployment: its category, and the address its category derives. */
export interface PlainDeployment {
  readonly artifact: Artifact;
  readonly categoryId: string;
  readonly address: Uint8Array;
}

/** Deploys a contract without a proxy, as `deployContract` does for a framed artifact. */
export async function deployPlain(
  world: World, artifact: Artifact, constructorArgs: readonly unknown[] = [],
): Promise<PlainDeployment> {
  const fundingUtxo = await world.walletCoin();
  const deployment = await deployStatefulContract(artifact, constructorArgs as never, {
    provider: world.network, fundingUtxo, changeAddress: world.changeAddress, funder: world.walletFunder,
  });
  return { artifact, categoryId: deployment.categoryId, address: addressOfCategory(deployment.categoryId) };
}

/** A deployment behind its generated proxy. */
export interface ProxiedDeployment {
  readonly artifact: Artifact;
  readonly proxyCategoryId: string;
  readonly implementationCategoryId: string;
  /** The proxy's address: the one every caller and callee names. */
  readonly address: Uint8Array;
  /** The deployment as a hop names a callee behind its proxy. */
  readonly external: FramedProxyExternal;
}

/** Deploys a contract behind its generated proxy and runs `initialize` through the hop, as `deployProxy` does. */
export async function deployProxied(
  world: World, artifact: Artifact, initializeArgs: readonly FunctionArgument[],
): Promise<ProxiedDeployment> {
  const proxyArtifact = buildProxyArtifact(artifact);
  const implementationFunding = await world.walletCoin();
  const proxyFunding = await world.walletCoin();
  const initCoin = await world.userCoin();
  const deployment = await deployFramedProxy({
    provider: world.network,
    implementationArtifact: artifact,
    proxyArtifact,
    implementationDeploy: {
      fundingUtxo: implementationFunding, funder: world.walletFunder, changeAddress: world.changeAddress,
    },
    proxyDeploy: { fundingUtxo: proxyFunding, funder: world.walletFunder, changeAddress: world.changeAddress },
    initialize: { functionName: 'initialize', args: initializeArgs },
    callerLockingBytecode: USER_LOCK,
    callerFunding: { utxo: initCoin, funder: USER_FUNDER, changeAddress: world.changeAddress },
    vm: compositionMachine(),
  });
  if (deployment.initialize.broadcast === undefined) {
    const refused = deployment.initialize.verdicts.filter((verdict) => !verdict.accepted)
      .map((verdict) => `${verdict.id}: ${verdict.objection ?? 'refused'}`).join('; ');
    throw new Error(`the initialize hop of ${artifact.contractName} did not broadcast: ${refused}`);
  }
  return {
    artifact,
    proxyCategoryId: deployment.proxy.categoryId,
    implementationCategoryId: deployment.implementation.categoryId,
    address: deployment.proxy.address,
    external: {
      artifact,
      categoryId: deployment.proxy.categoryId,
      proxyArtifact,
      implementationCategoryId: deployment.implementation.categoryId,
    },
  };
}

/** What one entered call left: its result or its error, and whether the caller's coin was spent. */
export interface Outcome<T> {
  readonly result?: T;
  readonly error?: Error;
  readonly coinSpent: boolean;
}

async function spent(world: World, coin: Utxo): Promise<boolean> {
  const live = await world.network.getUtxosForLockingBytecode(USER_LOCK);
  return !live.some((utxo) => utxo.txid === coin.txid && utxo.vout === coin.vout);
}

/** Enters a proxied deployment's entry through the hop, with the externals its calls reach. */
export async function enterProxied(
  world: World,
  root: ProxiedDeployment,
  functionName: string,
  args: readonly FunctionArgument[],
  externals: Readonly<Record<string, FramedProxyExternal>> = {},
): Promise<Outcome<FramedProxyCallResult>> {
  const coin = await world.userCoin();
  try {
    const result = await callFramedProxyEntry({
      provider: world.network,
      implementationArtifact: root.artifact,
      proxyArtifact: root.external.proxyArtifact!,
      proxyCategoryId: root.proxyCategoryId,
      implementationCategoryId: root.implementationCategoryId,
      functionName,
      args,
      externals,
      callerUtxo: coin,
      callerLockingBytecode: USER_LOCK,
      funder: USER_FUNDER,
      changeAddress: world.changeAddress,
      vm: compositionMachine(),
    });
    return { result, coinSpent: await spent(world, coin) };
  } catch (error) {
    return { error: error as Error, coinSpent: await spent(world, coin) };
  }
}

/** Enters a plain deployment's entry through the plain call path, as a handle on it does. */
export async function enterPlain(
  world: World,
  root: PlainDeployment,
  functionName: string,
  args: readonly FunctionArgument[],
  externals: Readonly<Record<string, { readonly artifact: Artifact; readonly categoryId: string }>> = {},
): Promise<Outcome<FramedCallResult>> {
  const coin = await world.userCoin();
  try {
    const result = await callFramedEntry({
      provider: world.network,
      artifact: root.artifact,
      categoryId: root.categoryId,
      functionName,
      args,
      callerUtxo: coin,
      callerLockingBytecode: USER_LOCK,
      funder: USER_FUNDER,
      changeAddress: world.changeAddress,
      vm: compositionMachine(),
      externals,
    });
    return { result, coinSpent: await spent(world, coin) };
  } catch (error) {
    return { error: error as Error, coinSpent: await spent(world, coin) };
  }
}

/**
 * Records the text a replica met, one line per case, into `$AHEAD_OBSERVE_DIR/met.txt` when that is set: a wall
 * whose wording a replica pins only by its shape is read back exactly from there. Nothing is written otherwise.
 */
export function recordMet(label: string, text: string | undefined): void {
  const dir = process.env.AHEAD_OBSERVE_DIR;
  if (dir === undefined || dir === '') return;
  appendFileSync(join(dir, 'met.txt'), `${label}\t${text ?? '<none>'}\n`);
}

/** A call result's per-participant verdicts, as both call paths report them. */
interface Verdicts {
  readonly verdicts: readonly { readonly id: string; readonly accepted: boolean; readonly objection?: string }[];
}

/** The refused verdicts of a result that did not broadcast, as one line, or undefined for an accepted one. */
export function refusedVerdicts(result: Verdicts): string | undefined {
  const refused = result.verdicts.filter((verdict) => !verdict.accepted);
  return refused.length === 0 ? undefined
    : refused.map((verdict) => `${verdict.id}: ${verdict.objection ?? 'refused'}`).join('; ');
}
