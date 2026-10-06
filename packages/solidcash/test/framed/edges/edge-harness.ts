import { expect } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin, utf8ToBin } from '@bitauth/libauth';
import {
  bytesToHex, parsePushdataCommitment, sha256, type Artifact, type StateValue,
} from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { tryParseEventCommitment } from '../../../src/stateful/StateReader.js';
import { deployMaster, eventLockingBytecode, readPerCallDeployment } from '../../../src/per-call/deploy/index.js';
import { readPerCallEntry } from '../../../src/per-call/read/index.js';
import { buildProxyArtifact, deployPerCallProxy } from '../../../src/per-call/proxy/index.js';
import { callPerCallProxyEntry, type PerCallProxyCallResult } from '../../../src/per-call/proxy/deploy.js';
import type { PerCallProxyExternal } from '../../../src/per-call/proxy/external-calls.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * One call edge driven through the shipped cross-contract path: a callee deployed at its own category and a caller
 * behind its generated proxy, whose `initialize(address)` stores the callee's address.
 *
 * A case enters one of the caller's entries through the shipped proxy hop (`callPerCallProxyEntry`), which plans the
 * callee's frame from the caller's published call site, derives every participant, asks the BCH-2026 machine about
 * each and broadcasts. What the edge left is then read back from the chain: the records through the shipped
 * deployment reader, the events from the live outputs at their covenants through the shipped event decoder, and the
 * callee's state through the shipped read path.
 */

/** The user's own lock: every caller coin and every initialize is entered from it. */
export const USER_LOCK = encodeLockingBytecodeP2pkh(alicePkh);

/** A 32-byte category or txid with varied bytes, taken from a replica's scope and a label. */
export function edgeId(scope: string, label: string): string {
  return bytesToHex(sha256(utf8ToBin(`${scope} ${label}`)));
}

/** A coin a genesis or a call is funded from; a genesis's txid becomes the category it mints. */
function funding(txid: string): { txid: string; vout: number; satoshis: bigint } {
  return { txid, vout: 0, satoshis: 500_000n };
}

/** The two contracts of one edge and the interface the caller's sites call the callee through. */
export interface EdgeContracts {
  /** Names the replica's categories and coins, so no two replicas share one. */
  readonly scope: string;
  readonly callee: Artifact;
  readonly caller: Artifact;
  readonly interfaceName: string;
}

/** A deployed edge, and the chain as it stood when the caller's initialize was broadcast. */
export interface EdgeRun {
  readonly scope: string;
  readonly network: MockNetworkProvider;
  readonly callee: Artifact;
  readonly caller: Artifact;
  readonly proxy: Artifact;
  readonly calleeCategoryId: string;
  readonly calleeAddress: Uint8Array;
  readonly proxyCategoryId: string;
  readonly implementationCategoryId: string;
  readonly changeAddress: string;
  readonly externals: Readonly<Record<string, PerCallProxyExternal>>;
  readonly snapshot: SnapshotRestorer;
}

/**
 * Deploys the edge once and returns a getter that rewinds the chain to the deployment before each case, so no case
 * reads another's broadcast.
 */
export function edgeDeployment(contracts: EdgeContracts): () => Promise<EdgeRun> {
  let run: Promise<EdgeRun> | undefined;
  return async (): Promise<EdgeRun> => {
    run ??= deployEdge(contracts);
    const shared = await run;
    await shared.snapshot.restore();
    return shared;
  };
}

async function deployEdge(contracts: EdgeContracts): Promise<EdgeRun> {
  const { scope, callee, caller } = contracts;
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = wallet.unlock.spend(alicePub, signature);
  await fundShippedFacets({ addUtxo: async (lock, utxo): Promise<void> => { await network.addUtxo(lock, utxo); } });

  const calleeCategoryId = edgeId(scope, 'callee');
  await network.addUtxo(wallet.address, funding(calleeCategoryId));
  await deployStatefulContract(callee, [], {
    fundingUtxo: funding(calleeCategoryId), funder, changeAddress: wallet.address, provider: network,
  });
  const calleeAddress = deployMaster(callee, hexToBin(calleeCategoryId), VALIDATOR_PROGRAM).address;

  const implementationFunding = funding(edgeId(scope, 'caller implementation'));
  const proxyFunding = funding(edgeId(scope, 'caller proxy'));
  const initializeCoin = funding(edgeId(scope, 'initialize coin'));
  for (const coin of [implementationFunding, proxyFunding]) await network.addUtxo(wallet.address, coin);
  await network.addUtxo(binToHex(USER_LOCK), initializeCoin);
  const proxy = buildProxyArtifact(caller);
  const deployment = await deployPerCallProxy({
    provider: network,
    implementationArtifact: caller,
    proxyArtifact: proxy,
    implementationDeploy: { fundingUtxo: implementationFunding, funder, changeAddress: wallet.address },
    proxyDeploy: { fundingUtxo: proxyFunding, funder, changeAddress: wallet.address },
    initialize: { functionName: 'initialize', args: [calleeAddress] },
    callerLockingBytecode: USER_LOCK,
    callerFunding: { utxo: initializeCoin, funder: signature.unlockP2PKH(), changeAddress: wallet.address },
    vm: compositionMachine(),
  });
  expect(deployment.initialize.broadcast).toBeDefined();
  return {
    scope,
    network,
    callee,
    caller,
    proxy,
    calleeCategoryId,
    calleeAddress,
    proxyCategoryId: deployment.proxy.categoryId,
    implementationCategoryId: deployment.implementation.categoryId,
    changeAddress: wallet.address,
    externals: { [contracts.interfaceName]: { artifact: callee, categoryId: calleeCategoryId } },
    snapshot: await network.takeSnapshot(),
  };
}

/** Deploys one more contract on its own beside the edge, at a category named by `label`, and returns that category. */
export async function deployBeside(run: EdgeRun, artifact: Artifact, label: string): Promise<string> {
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: run.network });
  const categoryId = edgeId(run.scope, label);
  await run.network.addUtxo(wallet.address, funding(categoryId));
  await deployStatefulContract(artifact, [], {
    fundingUtxo: funding(categoryId), funder: wallet.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
    changeAddress: wallet.address, provider: run.network,
  });
  return categoryId;
}

/** One entered call: the coin it spends and the shipped hop's outcome. */
export interface Entered {
  readonly coin: { txid: string; vout: number; satoshis: bigint };
  readonly call: Promise<PerCallProxyCallResult>;
}

let entered = 0;

/** Funds a fresh coin of the user's and enters one caller entry through the shipped proxy hop. */
export async function enterEdge(
  run: EdgeRun, functionName: string, args: readonly FunctionArgument[],
): Promise<Entered> {
  entered += 1;
  const coin = funding(edgeId(run.scope, `${functionName} coin ${entered}`));
  await run.network.addUtxo(binToHex(USER_LOCK), coin);
  const call = callPerCallProxyEntry({
    provider: run.network,
    implementationArtifact: run.caller,
    proxyArtifact: run.proxy,
    proxyCategoryId: run.proxyCategoryId,
    implementationCategoryId: run.implementationCategoryId,
    functionName,
    args: [...args],
    externals: run.externals,
    callerUtxo: coin,
    callerLockingBytecode: USER_LOCK,
    funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
    changeAddress: run.changeAddress,
    vm: compositionMachine(),
  });
  return { coin, call };
}

/** Enters one caller entry and requires the hop to settle it, every participant accepted and the result broadcast. */
export async function settleEdge(
  run: EdgeRun, functionName: string, args: readonly FunctionArgument[],
): Promise<PerCallProxyCallResult & { readonly txid: string }> {
  const result = await (await enterEdge(run, functionName, args)).call;
  expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
  expect(result.accepted).toBe(true);
  expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  return { ...result, txid: result.broadcast!.txid };
}

/** The fields one deployment's data records hold, read back from the chain and decoded with the shipped decoder. */
export async function fieldsOf(
  run: EdgeRun, artifact: Artifact, categoryId: string,
): Promise<Record<string, unknown>> {
  const layout = artifact.stateLayout!;
  const pools = await readPerCallDeployment(run.network, categoryId, layout);
  return Object.assign({}, ...pools.records.map((record, nftIndex) =>
    parsePushdataCommitment(record.token!.nft!.commitment, layout, nftIndex))) as Record<string, unknown>;
}

/** The caller's fields, as its proxy's records hold them. */
export async function callerFields(run: EdgeRun): Promise<Record<string, unknown>> {
  return fieldsOf(run, run.proxy, run.proxyCategoryId);
}

/** One event as the chain holds it: the output it sits at, the event's name and its decoded fields. */
export interface ChainEvent {
  readonly vout: number;
  readonly name: string;
  readonly args: Readonly<Record<string, StateValue>>;
}

/**
 * The events one contract emitted in one transaction, read from the live outputs at the covenants its category and
 * each declared event's signature rebuild, and decoded with the shipped event decoder, in output order.
 *
 * A delegate frame emits under the records it runs on, so the caller's events are read at the proxy's category.
 */
export async function eventsOnChain(
  run: EdgeRun, artifact: Artifact, categoryId: string, txid: string,
): Promise<readonly ChainEvent[]> {
  const found: ChainEvent[] = [];
  for (const definition of artifact.events ?? []) {
    const lock = eventLockingBytecode(hexToBin(categoryId), definition.signature, definition.anonymous === true);
    for (const utxo of await run.network.getUtxosForLockingBytecode(lock)) {
      if (utxo.txid !== txid) continue;
      const args = tryParseEventCommitment(utxo.token!.nft!.commitment, definition, artifact.structs);
      expect(args).not.toBeNull();
      found.push({ vout: utxo.vout, name: definition.name, args: args! });
    }
  }
  return found.sort((left, right) => left.vout - right.vout);
}

/** One of the callee's view entries, answered through the shipped read path over its live records. */
export async function readCallee(
  run: EdgeRun, functionName: string, args: readonly FunctionArgument[],
): Promise<readonly StateValue[]> {
  const answered = await readPerCallEntry({
    provider: run.network, artifact: run.callee, categoryId: run.calleeCategoryId, functionName, args: [...args],
    vm: compositionMachine(),
  });
  expect(answered.accepted, answered.objection).toBe(true);
  return answered.values;
}

/** Every outpoint the deployments hold, event outputs included, and the chain's tip. */
async function chainView(run: EdgeRun): Promise<{ readonly tip: number | undefined; readonly outpoints: string[] }> {
  const held = await Promise.all(
    [run.calleeCategoryId, run.proxyCategoryId, run.implementationCategoryId]
      .map((categoryId) => run.network.getUtxosByTokenCategory(categoryId)),
  );
  return {
    tip: run.network.indexer.getTip()?.height,
    outpoints: held.flat().map((utxo) => `${utxo.txid}:${utxo.vout}`).sort(),
  };
}

/**
 * Enters a caller entry the shipped path must refuse, and checks the refusal names `reason`, the user's coin is
 * still unspent, and the chain holds exactly what it held before: nothing was broadcast.
 */
export async function expectRefusedEdge(
  run: EdgeRun, functionName: string, args: readonly FunctionArgument[], reason: RegExp,
): Promise<void> {
  const before = await chainView(run);
  const entry = await enterEdge(run, functionName, args);
  await expect(entry.call).rejects.toThrow(reason);
  expect((await run.network.getUtxosForLockingBytecode(USER_LOCK))
    .some((utxo) => utxo.txid === entry.coin.txid && utxo.vout === entry.coin.vout)).toBe(true);
  expect(await chainView(run)).toStrictEqual(before);
}
