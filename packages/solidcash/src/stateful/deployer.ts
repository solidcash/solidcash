/**
 * Deployer coins (A14): preps, the `create` unlocking, the proof of birth and the sweep.
 *
 * Deploy<C> is the second program a stateful contract is compiled with (A4). A prep transaction locks C's deployer
 * coin at output 0 and the author coin at output 1; the creation spends both, so the category is the prep's txid.
 * Nothing in this module deploys a contract by itself: `deployStatefulContract` and `deployFrom` compose these
 * helpers, and the SDK checks every candidate transaction in the local VM before it broadcasts.
 */
import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  decodeTransactionUnsafe, encodeTransaction, hashTransactionUiOrder,
} from '@bitauth/libauth/build/lib/message/transaction-encoding.js';
import type { Transaction } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2023/bch-2023-types.js';
import { encodeDataPush } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/push.js';
import { bigIntToVmNumber } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/instruction-sets-utils.js';
import type { AuthenticationProgramStateCommon } from '@bitauth/libauth/build/lib/vm/vm-types.js';
import {
  CALL_RECORD_NO_READER, CALL_RECORD_READER_INPUT, decodePushdataValue, encodePushdataValue, Op, type Artifact,
  type DeployerAbi, type StateValue,
} from '@solidcash/utils';
import {
  encodeFunctionArgument, type FunctionArgument,
} from '../Argument.js';
import { isP2pkhLock } from '../bcmr/identity.js';
import type { Output, TransactionDetails, UnlockableUtxo, Unlocker, Utxo } from '../interfaces.js';
import { createVirtualMachineBch2026ForProvider } from '../network/createVirtualMachine.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import { applyExternalSignatures } from '../external-signing.js';
import {
  addressToLockScript, createUnlockingBytecode, generateLibauthSourceOutputs, tryCashAddressToLockScript,
} from '../utils.js';
import {
  genesisOutpointKey, isReservedGenesisOutpoint, releaseGenesisOutpoint, reserveGenesisOutpoint,
} from './genesis-reservations.js';
import { decodeScriptNumber, extractCommitmentMapFromTrace } from './trace-commitment-helpers.js';
import { extractVerifiedValuesFromTrace } from './trace-verified-value-helpers.js';
import { fillerOutput } from './filler.js';
import { CALL_ARGUMENT_WITNESS, leftCallArgumentWitness } from './call-record.js';
import { getDustThreshold } from '../network/dust-threshold.js';
import { evaluateFaithfulOrDebugTrace } from './faithful-probe-trace.js';
import { assertSpendableCode, assertSpendableContract } from './spendable-code.js';

/** A12: a deployment that asks for more than the deployer produces takes today's genesis instead. */
export type DeployerFallbackCase =
  | 'initial-state' | 'identity-anchors' | 'native-token' | 'block-oracle' | 'extra-outputs-own-category'
  | 'salt' | 'address-type' | 'thread-count' | 'master-amount'
  | 'data-nft-amount' | 'funder-not-p2pkh' | 'metadata-probe' | 'oracle-pool'
  | `unsupported-option:${string}`;

/** The options the A12 fallback table reads. `DeployOptions` satisfies it structurally. */
export interface DeployerPathOptions {
  initialState?: Record<string, unknown>;
  identityAnchors?: readonly unknown[];
  nativeToken?: unknown;
  oraclePool?: unknown;
  extraOutputs?: readonly { token?: { category: string } }[];
  salt?: unknown;
  addressType?: string;
  threadCount?: number;
  masterAmount?: bigint;
  dataNftAmount?: bigint;
  funder?: Unlocker;
  metadataProbe?: true;
  viaDeployer?: boolean;
  fundingUtxo?: Utxo;
}

/** The A12 fallback case a deployment asks for, or undefined when the deployer path can produce it. */
export function deployerFallbackCase(
  artifact: Artifact, options: DeployerPathOptions,
): DeployerFallbackCase | undefined {
  const deployer = artifact.deployer;
  if (deployer === undefined) return undefined;
  if (options.metadataProbe === true) return 'metadata-probe';
  if (options.initialState !== undefined && Object.keys(options.initialState).length > 0) return 'initial-state';
  if ((options.identityAnchors?.length ?? 0) > 0) return 'identity-anchors';
  if (options.nativeToken !== undefined) return 'native-token';
  if (options.salt !== undefined) return 'salt';
  if (options.addressType !== undefined && options.addressType !== 'p2sh32') return 'address-type';
  if (options.threadCount !== undefined && options.threadCount > 1) return 'thread-count';
  if (options.masterAmount !== undefined && options.masterAmount !== 1200n) return 'master-amount';
  if (options.dataNftAmount !== undefined && options.dataNftAmount !== 1200n) return 'data-nft-amount';
  if (options.funder !== undefined && !isP2pkhLock(options.funder.generateLockingBytecode())) {
    return 'funder-not-p2pkh';
  }
  const fundingTxid = options.fundingUtxo?.txid.toLowerCase();
  if (fundingTxid !== undefined && options.extraOutputs?.some(
    (output) => output.token?.category.toLowerCase() === fundingTxid,
  )) return 'extra-outputs-own-category';
  // Every remaining field of `DeployOptions` is either honoured on the deployer path or listed above. The framed
  // composition fields cannot apply to a direct artifact; naming one here keeps the table exhaustive.
  for (const option of [
    'recordCommitments', 'writtenHeadCommitments', 'mintedState', 'headCollections', 'functionSplit',
    'validatorCount', 'childLocks', 'childPool', 'childOutputCount', 'childCollections', 'splitFacets',
  ] as const) {
    if ((options as Record<string, unknown>)[option] !== undefined) return `unsupported-option:${option}`;
  }
  return undefined;
}

/** A12's path selection, without the warning text. */
export type DeployerPathDecision =
  | { readonly path: 'genesis'; readonly warning?: string }
  | { readonly path: 'deployer' }
  | { readonly path: 'error'; readonly message: string };

/**
 * A12's table. An artifact without `deployer` keeps today's genesis. An artifact with one takes its deployer unless
 * the deployment asks for something the deployer does not produce; `viaDeployer` turns the warning case into an
 * error.
 */
export function decideDeployerPath(
  artifact: Artifact, options: DeployerPathOptions,
): DeployerPathDecision {
  const deployer = artifact.deployer;
  const fallback = deployerFallbackCase(artifact, options);
  if (deployer === undefined) {
    if (artifact.constructorWritesCollections === true) {
      return {
        path: 'error',
        message: `Contract '${artifact.contractName}' writes a collection in its constructor (constructorWritesCollections), `
          + "and today's genesis cannot produce it"
          + (artifact.deployerUnsupported === undefined ? '' : `; its deployer was refused (${artifact.deployerUnsupported})`),
      };
    }
    if (artifact.deployerUnsupported !== undefined) {
      return options.viaDeployer === true
        ? { path: 'error', message: `Contract '${artifact.contractName}' has no deployer (${artifact.deployerUnsupported})` }
        : { path: 'genesis', warning: `Contract '${artifact.contractName}' has no deployer (${artifact.deployerUnsupported}); deploying with today's genesis` };
    }
    if (options.viaDeployer === true) {
      return {
        path: 'error',
        message: `Contract '${artifact.contractName}' has no deployer; compile it with deployer: true`,
      };
    }
    return { path: 'genesis' };
  }
  if (options.viaDeployer === false) {
    if (artifact.constructorWritesCollections === true) {
      return {
        path: 'error',
        message: `Contract '${artifact.contractName}' writes a collection in its constructor (constructorWritesCollections), `
          + "and today's genesis cannot produce it",
      };
    }
    return { path: 'genesis' };
  }
  if (fallback !== undefined) {
    // A12: a C whose constructor writes a collection never falls back, whatever the case that would.
    if (artifact.constructorWritesCollections === true) {
      return {
        path: 'error',
        message: `Contract '${artifact.contractName}' writes a collection in its constructor (constructorWritesCollections), `
          + `and today's genesis cannot produce it; the deployer path cannot produce this deployment (${fallback})`,
      };
    }
    if (options.viaDeployer === true) {
      return {
        path: 'error',
        message: `The deployer path cannot produce this deployment of '${artifact.contractName}' (${fallback})`,
      };
    }
    return {
      path: 'genesis',
      warning: `Contract '${artifact.contractName}' deploys through today's genesis: ${fallback}`,
    };
  }
  return { path: 'deployer' };
}

/** The classes A14 names, so a caller can tell which part of the deployer path refused. */
export class DeployerPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeployerPathError';
  }
}

export class DeployerPrepError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeployerPrepError';
  }
}

export class DeployerCalleeError extends Error {
  constructor(callee: string, functionName: string, missing: string) {
    super(`Constructor call to '${callee}.${functionName}' cannot be bound: ${missing}`);
    this.name = 'DeployerCalleeError';
  }
}

/** A constructor's call target (A7): the deployed contract, its function and that function's visible arguments. */
export interface ConstructorCallee {
  contract: {
    readonly inner: {
      readonly artifact: Artifact;
      readonly unlock: Record<string, ((...values: any[]) => Unlocker) | undefined>;
    };
    readonly categoryId: string;
    readonly address: string;
    getFullState(): Promise<{ masterUtxo?: Utxo; dataNftUtxos: Utxo[] }>;
  };
  functionName?: string;
  args?: readonly FunctionArgument[];
  /**
   * The contracts the callee's function itself calls or reads, as its ordinary call takes them (`withExternalCall`):
   * their blocks join the callee's own.
   */
  externalContracts?: readonly unknown[];
}

/** One call slot's call: the callee, the function the constructor names and the visible arguments it passes. */
export interface ConstructorCall {
  slot: number;
  callee: ConstructorCallee;
  functionName: string;
  args: readonly FunctionArgument[];
}

/**
 * A14 item 5: the call each slot of C's constructor makes. A literal or forwarded constructor argument is read from the
 * call site; any other argument comes from `callees`. `args` are `create`'s public arguments by name.
 */
export function resolveConstructorCalls(options: {
  artifact: Artifact;
  deployer: DeployerAbi;
  callees: readonly ConstructorCallee[] | undefined;
  args: Readonly<Record<string, FunctionArgument>>;
}): ConstructorCall[] {
  const { artifact, deployer, args } = options;
  const constructorAbi = artifact.abi.find((entry) => entry.name === '__construct');
  const sites = constructorAbi?.externalCalls ?? [];
  const configured = options.callees ?? [];
  if (sites.length !== deployer.callSlots || configured.length !== sites.length) {
    throw new DeployerCalleeError(artifact.contractName, sites[0]?.functionName ?? '<unknown>',
      `pass ${deployer.callSlots} constructorCallees entries, one per call slot`);
  }
  const visible = constructorAbi?.inputs.filter((input) => !input.name.startsWith('__internal__')) ?? [];
  const slotOf = new Map<string, number>();
  return sites.map((site, slot) => {
    const callee = configured[slot];
    const calleeArtifact = callee.contract.inner.artifact;
    const functionName = callee.functionName ?? site.functionName;
    assertDeployerCallee(calleeArtifact.contractName, calleeArtifact, functionName);
    // `create` requires input m_j to sit at the target the constructor computes (A4.3 step 10); say so before building.
    const target = site.addressParam === undefined ? undefined : args[site.addressParam];
    const targetLock = target instanceof Uint8Array ? target
      : typeof target === 'string' && target.includes(':') ? addressToLockScript(target) : undefined;
    const calleeLock = addressToLockScript(callee.contract.address);
    if (targetLock !== undefined && binToHex(targetLock) !== binToHex(calleeLock)) {
      throw new DeployerCalleeError(calleeArtifact.contractName, functionName,
        `call slot ${slot} calls ${binToHex(targetLock)}, not this callee at ${binToHex(calleeLock)}`);
    }
    // One master runs one arm, so two slots that name one contract cannot both be answered (A7).
    const earlier = slotOf.get(binToHex(calleeLock));
    if (earlier !== undefined) {
      throw new DeployerCalleeError(calleeArtifact.contractName, functionName,
        `call slots ${earlier} and ${slot} both call it, and one master answers one call`);
    }
    slotOf.set(binToHex(calleeLock), slot);
    const callArgs = callee.args ?? (site.argSources ?? []).map((source) => {
      if (source.kind === 'literal') return source.value as FunctionArgument;
      if (source.kind === 'forward' && source.paramIndex !== undefined) {
        const input = visible[source.paramIndex];
        const value = input === undefined ? undefined : args[input.name];
        if (value !== undefined) return value;
      }
      throw new DeployerCalleeError(calleeArtifact.contractName, functionName,
        'its call arguments are not literals or forwarded constructor parameters; pass them in constructorCallees');
    });
    return { slot, callee, functionName, args: callArgs };
  });
}

/** A paired input of a callee block: a coin the callee's run spends, or `undefined` for a slot a wallet coin fills. */
type CalleeBlockInput = { utxo: Utxo; unlocker?: (masterIndex: number) => Unlocker } | undefined;

/**
 * How the callee's own run completes one output of its block (A14 item 5). The run stops at its first unmet check, and
 * the check names what its output must hold, so each round of the settling run learns at least one output.
 */
export type CalleeOutputRule =
  /** A token output whose lock and token are fixed: the run pins its NFT commitment. */
  | { kind: 'commitment' }
  /** An NFT the run pins only where its emit runs (an event under a condition, a wide event's chunk): a filler, which
   * holds no token, until a pin names its commitment. */
  | { kind: 'optional'; make: (commitment: string) => Output }
  /** A satoshi transfer: a filler until the run checks its lock and value. */
  | { kind: 'transfer'; active: boolean }
  /** A transfer of a token container's units: a filler until the run checks its lock, units and category. */
  | { kind: 'tokenTransfer'; active: boolean; category?: string }
  /** The satoshi container, recreated with its coin's value less the active transfers and the miner fee. */
  | { kind: 'satoshiContainer'; satoshis: bigint; lock: Uint8Array; minerFee: bigint }
  /** A token container, recreated with its coin's units less the active transfers of its category. */
  | { kind: 'tokenContainer'; utxo: Utxo; lock: Uint8Array; category: string };

/**
 * A7, A14 item 5: one call slot's callee block. Its inputs and outputs pair index for index from the callee's master
 * on, as the callee's own layout places them, and then its trailing region. The record carrier, unless the record slot
 * is inside the block, and each relinked predecessor of an insert (P') sit after the paired region, at the indexes their
 * witnesses name.
 */
export interface ConstructorCalleeBlock extends ConstructorCall {
  contract: import('../Contract.js').Contract<Artifact>;
  fn: import('@solidcash/utils').AbiFunction;
  categoryId: string;
  masterLock: Uint8Array;
  senderReader: boolean;
  inputs: CalleeBlockInput[];
  outputs: Output[];
  /** How the callee's run completes each output of its block, by offset. */
  rules: Map<number, CalleeOutputRule>;
  carrier: Output;
  /** The carrier's offset in the block, when the record slot is not the block's last. */
  carrierOffset?: number;
  lanes: Array<{ witness: string; output: Output }>;
  /** The sorted-batch witnesses of the callee's mapping writes; `PredOut` of a lane is set where it is placed. */
  witnesses: Record<string, FunctionArgument>;
  /**
   * The inserts a condition guards, each its batch's only target, by block offset: where the run keeps the node the
   * slot spends, the write did not run, and the insert's lane is dropped (PredOut -2).
   */
  guardedInserts: Map<number, { slotIndex: number; witness: string }>;
  /**
   * Witnesses that name an input or output of the transaction, as offsets from the master: each one that names an index
   * (0 or more) is moved to the master's index where the block is placed.
   */
  relocated?: Record<string, bigint>;
  /** The redeem bytes of the contracts the block runs beyond its master (the callee's own callees), for a fee. */
  extraBytes?: number;
}

const vmapWitness = (field: string, slotIndex: number): string => `__internal__vmapBatch${field}_${slotIndex}`;

/**
 * Internal witnesses of an entry's frame that name an input or an output of the transaction, not an offset in its block
 * (the covenant reads them with `OP_PICK` and introspects at that index directly, or, for the reader a call record
 * names, digests the input of the master that makes the call). A frame built with the master at input 0 holds each as
 * an offset from the master.
 */
const TRANSACTION_INDEX_WITNESS = new RegExp('^__internal__(?:returnOutputIdx|externalReturnOutputIdx\\d*'
  + '|externalCallInputBase|extcallMasterIdx\\d+|extcallAnchorIdx\\d+|callEdgeOutputIdx\\d+|blockOracleInputIndex'
  + '|blockhashInputIndex|dynamicChunkInputBase|dynamicChunkOutputBase|valueChunkOutputBase|vmapBatchPredOut_\\d+'
  + '|externalOutStateInputBase|callRecordReader)$');

/** The covenant parameters of a coin's unlocker that name the input of the master it serves, or an output. */
const COVENANT_INDEX_PARAMETER = new Set(['masterInputIndex', 'outputIndex']);

/** The internal witnesses `calleeFrame` sets for a genesis call itself. */
const GENESIS_FRAME_WITNESS = new Set([
  '__internal__genesisCall', '__internal__returnOutputIdx', '__internal__msgSenderCategory', '__internal__rowEntryShift',
  CALL_RECORD_READER_INPUT,
]);

/** The `txid:vout` of a coin, as the shared side-car pools are told apart by. */
const coinKey = (utxo: Pick<Utxo, 'txid' | 'vout'>): string => `${utxo.txid.toLowerCase()}:${utxo.vout}`;

/** A token-less output that holds an index; an unused event slot, chunk or transfer requires no more. */
const plainFiller = (): Output => ({ to: Uint8Array.of(0x51), amount: 1000n });

/** The coin a listing names, without the unlocker a loader attached to it. */
const listedCoin = (utxo: Utxo): Utxo => ({
  txid: utxo.txid, vout: utxo.vout, satoshis: utxo.satoshis, ...(utxo.token === undefined ? {} : { token: utxo.token }),
});

/**
 * A provider view of a shared side-car pool (A14 item 6): coins a creation already spends are not offered again, and no
 * coin is minted on demand, so a missing pool is `DeployerSidecarError`.
 */
function sharedPoolProvider(provider: NetworkProvider, spent: ReadonlySet<string>): NetworkProvider {
  return {
    network: provider.network,
    getUtxosForLockingBytecode: async (lock: Uint8Array): Promise<Utxo[]> => (
      await provider.getUtxosForLockingBytecode(lock)).filter((utxo) => !spent.has(coinKey(utxo))),
  } as unknown as NetworkProvider;
}

/**
 * `provider` as an ordinary build lists a shared side-car pool through it for a creation (A14 item 6): coins in `spent`
 * are left out and none is minted on demand. Every other read is the provider's own.
 */
function sharedPoolView(provider: NetworkProvider, spent: ReadonlySet<string>): NetworkProvider {
  return new Proxy(provider, {
    get(target, property, receiver): unknown {
      if (property === 'addUtxo') return undefined;
      if (property === 'getUtxosForLockingBytecode') {
        return async (lock: Uint8Array): Promise<Utxo[]> => (await target.getUtxosForLockingBytecode(lock))
          .filter((utxo) => !spent.has(coinKey(utxo)));
      }
      return Reflect.get(target, property, receiver);
    },
  });
}

/**
 * One step of an ecrecover side-car group: a shared coin, or `undefined` for a slot that reads nothing: a 2-way
 * recovery's middle slot, or any slot of a recovery whose arguments recover no key.
 */
type SidecarStep = { utxo: Utxo; unlocker: Unlocker; recreate: Output } | undefined;

/**
 * The shared ecrecover side-car groups of a function's recoveries (A14 item 6), A, M and B for each, from the salt-0
 * pool. A 2-way recovery's middle slot reads nothing: a wallet coin fills it. Arguments that recover no key
 * (`ecrecoverRefusal`) have no side-car, so each of their three slots takes a wallet coin: the recovery answers the
 * zero address without reading them (`ecrecoverEvm` and `ecrecoverP2pkh` for a `v` other than 27 or 28, or an `r` or
 * `s` outside [1, n)), or its branch is not run, or it reads them and the creation fails its VM check. For an `r` no
 * curve point has, the first slot takes an A of the pool over the placeholder recovery, whose pad carries the proof
 * an address projection reads; for a key at infinity, the group over the digest shifted by -2^128 r mod n, which
 * recovers 2^128 G. Coins in `spent` are skipped; the coins taken are added to it.
 */
async function sharedEcrecoverSteps(options: {
  calls: ReadonlyArray<readonly [unknown, unknown, unknown, unknown]>;
  provider: NetworkProvider;
  spent: Set<string>;
  refuse: (what: string) => never;
  /** The input the side-cars serve, for a refusal. */
  who: string;
}): Promise<SidecarStep[]> {
  const { calls, provider, spent, refuse, who } = options;
  if (calls.length === 0) return [];
  const salt = new Uint8Array(32);
  const { ecrecoverComputeLockingBytecode } = await import('@solidcash/utils');
  const { computeEcrecoverWitness, ecrecoverRefusal } = await import('../ecrecover/ecrecoverRecovery.js');
  const {
    buildEcrecoverComputeSidecars, buildEcrecoverComputeSidecars3, buildEcrecoverPlaceholderSidecars,
    probeEcrecoverSplit, probeEcrecoverSplit3,
  } = await import('../ecrecover/ecrecoverComputeSidecar.js');
  const pool = async (role: 'A' | 'B2' | 'M' | 'B3'): Promise<Utxo[]> => (
    await provider.getUtxosForLockingBytecode(ecrecoverComputeLockingBytecode(salt, role)))
    .filter((utxo) => utxo.token?.nft?.capability === 'mutable' && !spent.has(coinKey(utxo)));
  const [coinsA, coinsB, coinsM, coinsB3] = await Promise.all([pool('A'), pool('B2'), pool('M'), pool('B3')]);
  const take = (coins: Utxo[]): Utxo => {
    const coin = coins.shift();
    if (coin === undefined) throw new DeployerSidecarError('ecrecover', who);
    spent.add(coinKey(coin));
    return coin;
  };
  const steps: SidecarStep[] = [];
  for (const [hash, v, r, s] of calls) {
    if (!(hash instanceof Uint8Array) || !(r instanceof Uint8Array) || !(s instanceof Uint8Array)
      || (typeof v !== 'bigint' && typeof v !== 'number')) {
      refuse('it recovers a key from values that are not its own arguments; the SDK lays out a recovery from its '
        + 'hash, v, r and s arguments');
    }
    const refusal = ecrecoverRefusal(hash as Uint8Array, Number(v), r as Uint8Array, s as Uint8Array);
    if (refusal?.kind === 'offCurve') {
      const coinA = take(coinsA);
      const carrier = buildEcrecoverPlaceholderSidecars(salt, coinA, coinA, refusal.proof, 'B2');
      steps.push({ utxo: coinA, unlocker: carrier.unlockerA, recreate: carrier.recreateA }, undefined, undefined);
      continue;
    }
    if (refusal?.kind === 'unread') {
      steps.push(undefined, undefined, undefined);
      continue;
    }
    // A key at infinity takes the group over the digest shifted by -2^128 r mod n, whose pair recovers 2^128 G.
    const witness = computeEcrecoverWitness(
      refusal?.kind === 'atInfinity' ? refusal.shiftedHash : hash as Uint8Array, Number(v), r as Uint8Array,
      s as Uint8Array,
    );
    const coinA = take(coinsA);
    let chunkA: number | undefined;
    try {
      chunkA = probeEcrecoverSplit(witness, salt, coinA, coinsB[0] ?? coinA);
    } catch {
      chunkA = undefined;
    }
    if (chunkA === undefined) {
      const coinM = take(coinsM);
      const coinB = take(coinsB3);
      const split = probeEcrecoverSplit3(witness, salt, coinA, coinM, coinB);
      const built = buildEcrecoverComputeSidecars3(witness, split.chunkA, split.chunkM, salt, coinA, coinM, coinB);
      steps.push(
        { utxo: coinA, unlocker: built.unlockerA, recreate: built.recreateA },
        { utxo: coinM, unlocker: built.unlockerM, recreate: built.recreateM },
        { utxo: coinB, unlocker: built.unlockerB, recreate: built.recreateB },
      );
      continue;
    }
    const coinB = take(coinsB);
    const built = buildEcrecoverComputeSidecars(witness, chunkA, salt, coinA, coinB, undefined, 'B2');
    steps.push(
      { utxo: coinA, unlocker: built.unlockerA, recreate: built.recreateA },
      undefined,
      { utxo: coinB, unlocker: built.unlockerB, recreate: built.recreateB },
    );
  }
  return steps;
}

/**
 * `unlocker` made again for a block built with its callee's master at input 0 and placed with that master at input
 * `masterIndex`: a covenant coin's master index (or output index), and a contract frame's transaction indexes, move by
 * `masterIndex`. An unlocker that names no index (a wallet coin, an oracle pool coin, a shared side-car) is kept.
 */
function movedUnlocker(unlocker: Unlocker, masterIndex: number): Unlocker {
  type Moved = Partial<import('../interfaces.js').ContractUnlocker>;
  const { contract, abiFunction, params, covenantUnlocker, allowsAlignedOutputReplacement } = unlocker as Moved;
  if (contract === undefined || abiFunction === undefined || params === undefined || masterIndex === 0) return unlocker;
  const shift = BigInt(masterIndex);
  const moved = abiFunction.inputs.map((input, index) => {
    const value = params[index];
    const names = covenantUnlocker === true
      ? COVENANT_INDEX_PARAMETER.has(input.name) : TRANSACTION_INDEX_WITNESS.test(input.name);
    return names && typeof value === 'bigint' && value >= 0n ? value + shift : value;
  });
  const unlock = (contract.unlock as Record<string, ((...values: FunctionArgument[]) => Unlocker) | undefined>)[
    abiFunction.name];
  if (unlock === undefined) {
    throw new DeployerPrepError(`The unlocker of a coin of '${contract.artifact.contractName}' cannot be made again`);
  }
  return Object.assign(unlock(...moved), {
    ...(covenantUnlocker === undefined ? {} : { covenantUnlocker }),
    ...(allowsAlignedOutputReplacement === undefined ? {} : { allowsAlignedOutputReplacement }),
  });
}

type CalleeEntryAccess = NonNullable<import('@solidcash/utils').AbiFunction['entryAccesses']>[number];
type CalleeCollection = NonNullable<NonNullable<Artifact['stateLayout']>['collections']>[number];

/**
 * The slot of the entry a callee's access names: each part of its key is an argument of the call, an expression of
 * them, or `sender` where the part reads `msg.sender`.
 */
async function calleeEntrySlot(
  access: CalleeEntryAccess, collection: CalleeCollection, fn: import('@solidcash/utils').AbiFunction,
  args: readonly FunctionArgument[], sender: Uint8Array, refuse: (what: string) => never,
): Promise<Uint8Array> {
  const { isMsgSenderKeySource } = await import('./soft-state-overlays.js');
  const { evalComputedKey } = await import('./route-expression-key.js');
  const { keyToSlotMulti } = await import('./SortedList.js');
  const visible = fn.inputs.filter((input) => !input.name.startsWith('__internal__'));
  const keys = access.keyParams.map((param, keyIndex) => {
    const source = access.keySources?.[keyIndex];
    if (isMsgSenderKeySource(source)) return sender;
    if (source?.kind === 'expression') {
      const value = evalComputedKey(source.expressionLabel, [...args], fn.inputs);
      if (value !== undefined) return value;
    }
    const index = visible.findIndex((input) => input.name === param);
    const value = index >= 0 ? args[index] : undefined;
    if (value instanceof Uint8Array) return value;
    const lock = tryCashAddressToLockScript(value);
    if (lock !== undefined) return lock;
    if (typeof value === 'bigint' || typeof value === 'number') return bigIntToVmNumber(BigInt(value));
    if (typeof value === 'boolean') return bigIntToVmNumber(value ? 1n : 0n);
    if (typeof value === 'string' && (collection.keyTypes?.[keyIndex] ?? collection.keyType) === 'string') {
      return new TextEncoder().encode(value);
    }
    return refuse(`the key '${param}' of its ${access.collection} access is not a value the SDK can resolve`);
  });
  return keyToSlotMulti(keys, collection);
}

/** How many callee blocks the ordinary build has laid out: each takes pads at a lock of its own. */
let calleeBuilds = 0;

/** What a stand-in sender's category is drawn from: no coin or category of any network is. */
const STAND_IN_SENDER_TAG = new TextEncoder().encode('SolidCash constructor callee sender');

/**
 * The child's master lock `sender` as the caller of an ordinary build of a constructor's call (A7): a coin at `sender`
 * that holds a minting NFT of a category of its own, which each build spends with the edge record that caller pins
 * for the call (F1). With them the build's run resolves `msg.sender` to `sender`, as the creation's genesis step does.
 * Neither is a coin of any network, and neither reaches the creation.
 */
async function standInSender(
  sender: Uint8Array,
): Promise<{ category: string; caller: import('./stb-materialize-caller-edge-outputs.js').StandInCaller }> {
  const { sha256 } = await import('@solidcash/utils');
  const category = binToHex(sha256(Uint8Array.of(...STAND_IN_SENDER_TAG, ...sender)));
  return {
    category,
    caller: {
      identity: {
        txid: binToHex(sha256(hexToBin(category))), vout: 0, satoshis: 1000n,
        token: { category, amount: 0n, nft: { capability: 'minting', commitment: '' } },
        unlocker: { generateLockingBytecode: () => sender, generateUnlockingBytecode: () => new Uint8Array() },
      },
    },
  };
}

/**
 * A callee block laid out by the ordinary call path itself (A14 item 5): the callee's own call of its function with its
 * record emitted (`StatefulFunctionCall.build`), not sent. That build sizes what a fixed layout cannot: a loop's entries,
 * inserts and payments, dynamic state's chunks, the blocks of the calls and reads the callee makes, and the oracle coins
 * its reads co-spend.
 *
 * The build has the master at input 0. Its block moves to where the creation places it: each coin's unlocker that names
 * the master's input (or an output) by index is made again (`movedUnlocker`), each witness of the frame that names a
 * transaction index moves with the master (`relocated`), and each input at the build's pad lock (a pad of an
 * output-only index, or the build's fee input) takes a wallet coin of the creation. The callee's run in the creation
 * pins its NFT outputs again, its call record among them, whose digest covers the genesis call's tag.
 *
 * The creation's `msg.sender` is the child's master lock `sender`, which the genesis step resolves (A7). The build of a
 * function that reads it resolves the same lock, through a stand-in caller at `sender` (`standInSender`), spent and
 * appended after everything the block holds: every key the build derives from the sender, every copy it stores, and the
 * sizes, chunks, digests and commitments that follow from them are the child's. The stand-in's coin and edge record
 * stay out of the block, and the creation's frame takes the genesis call in place of the stand-in's category.
 */
async function planCalleeBlockByCall(
  call: ConstructorCall, sender: Uint8Array, context: { spent: Set<string> }, refuse: (what: string) => never,
): Promise<ConstructorCalleeBlock> {
  const { callee, functionName } = call;
  const stateful = callee.contract as unknown as {
    inner: import('../Contract.js').Contract<Artifact>;
    connect?: (signer: unknown) => { _createBuilder: (...values: unknown[]) => Promise<unknown> };
  };
  const contract = stateful.inner;
  const artifact = contract.artifact;
  const fn = artifact.abi.find((entry) => entry.name === functionName) ?? refuse('the callee has no such function');
  if (typeof stateful.connect !== 'function') {
    refuse('its block is laid out by the ordinary build of its call, which needs the callee as a stateful contract');
  }
  // A call the callee makes with msg.sender is built for the child, its caller below (`withCallerIdentity`), as the
  // callee's run passes it. tx.origin is the creation's first plain P2PKH input, the deploying wallet, where the
  // build's is a pad coin of its own: the call the build lays out with it is not the call the run makes.
  const namesOrigin = (value: unknown): boolean => {
    if (Array.isArray(value)) return value.some(namesOrigin);
    if (value === null || typeof value !== 'object') return false;
    const node = value as { kind?: unknown; senderOp?: unknown };
    return (node.kind === 'msgSender' && node.senderOp === 'tx.origin') || Object.values(value).some(namesOrigin);
  };
  if ([...(fn.externalCalls ?? []), ...(fn.lowLevelCalls ?? [])].some((made) => namesOrigin([
    (made as { argSources?: unknown }).argSources, (made as { rawArgSources?: unknown }).rawArgSources,
  ]))) {
    refuse('it passes tx.origin to a contract it calls, and the ordinary build of its call resolves tx.origin from '
      + 'its own pad coin, not from the deploying wallet the creation spends');
  }
  const provider = contract.provider;
  const categoryId = callee.contract.categoryId;
  const masterLock = addressToLockScript(callee.contract.address);
  const { default: Signer } = await import('../Signer.js');
  const { BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX } = await import('@solidcash/utils');
  // The build's pads and its fee input stand at a lock of their own, each build another, from a list of stand-in coins:
  // the build neither lists nor splits a real wallet's coins, signs nothing, and the creation replaces every input at
  // that lock with one of its wallet coins.
  calleeBuilds += 1;
  const padHash = Uint8Array.from({ length: 20 }, (_, index) => (index < 4 ? (calleeBuilds >>> (8 * index)) & 0xff : 0xcd));
  const padLock = Uint8Array.of(0x76, 0xa9, 0x14, ...padHash, 0x88, 0xac);
  const padCoins: Utxo[] = Array.from({ length: 64 }, (_, index) => ({
    txid: `${binToHex(padHash)}${index.toString(16).padStart(24, '0')}`, vout: 1, satoshis: 1_000_000n,
  }));
  const padder = Signer.external({ wallet: { signTransaction: async () => undefined }, pkh: padHash }, provider);
  Object.defineProperty(padder, 'getUtxos', { value: async (): Promise<Utxo[]> => padCoins.map((coin) => ({ ...coin })) });
  const connected = stateful.connect(padder);
  // Its keccak256 and ecrecover side-cars, in a loop or not, come from the shared pool (salt 0): a side-car under the
  // callee's brand is spendable only beside input 0 of its category, which a callee's master never is in a creation
  // (A14 item 6). The callee's run binds each side-car by its covenant and its arguments, not by its salt. The contracts
  // it calls take theirs from the same pool, through the same view, so no coin the creation spends is taken twice.
  const sidecars = fn.keccakCompute === true || fn.keccakLoopReads === true || fn.keccakChainReads === true
    || fn.ecrecoverCompute === true || (callee.externalContracts ?? []).length > 0;
  const sidecarPool = sidecars ? sharedPoolView(provider, context.spent) : undefined;
  // A function that reads msg.sender is built for the child as its caller.
  const senderReader = fn.inputs.some((input) => input.name === '__internal__msgSenderCategory');
  const standIn = senderReader ? await standInSender(sender) : undefined;
  const calleeCall = { abiFunction: fn, emitReturn: true };
  const { StatefulFunctionCall } = await import('./StatefulContract.js');
  const participant = new StatefulFunctionCall(
    () => connected._createBuilder(functionName, [...call.args], {
      ...calleeCall, signerUtxos: padCoins, ...(sidecarPool === undefined ? {} : { sharedSidecarPool: sidecarPool }),
      ...(standIn === undefined ? {} : {
        callerLockingBytecode: sender, msgSenderCategory: hexToBin(standIn.category).reverse(),
        standInCaller: standIn.caller,
      }),
    }) as never,
    connected as never, functionName, [...call.args], calleeCall,
  );
  // Each build of the call, a call of another contract's among them, keeps the pool and the sender. The sender is
  // named before the calls are resolved: an argument msg.sender gives a call the callee makes resolves to it.
  if (sidecarPool !== undefined) participant._withSharedSidecarPool(sidecarPool);
  if (standIn !== undefined) participant.withCallerIdentity(sender, standIn.category)._withStandInCaller(standIn.caller);
  try {
    for (const external of callee.externalContracts ?? []) participant.withExternalCall(external as never);
  } catch (error) {
    refuse(`its call of another contract cannot be laid out: ${(error as Error).message}`);
  }
  let built: { inputs: UnlockableUtxo[]; outputs: Output[] };
  try {
    built = await participant.build() as unknown as { inputs: UnlockableUtxo[]; outputs: Output[] };
  } catch (error) {
    if (error instanceof DeployerCalleeError) throw error;
    // A shared pool with too few coins: as for a side-car of a fixed layout, nothing is built.
    const message = (error as Error).message;
    if (sidecarPool !== undefined && /keccak256 .*needs .*side-car UTXO|side-car UTXO not found/.test(message)) {
      throw new DeployerSidecarError('keccak', `the callee '${artifact.contractName}.${functionName}'`);
    }
    // A loop of a contract the callee calls (sc-append-create-builder-nested-callee-keccak-loop).
    const nestedLoop = message.match(/^The call of (\S+) cannot be laid out: its keccak256 loop needs \d+ side-car coins/);
    if (sidecarPool !== undefined && nestedLoop !== null) {
      throw new DeployerSidecarError('keccak', `the callee '${artifact.contractName}.${functionName}' (its call of `
        + `${nestedLoop[1]})`);
    }
    if (sidecarPool !== undefined && /ecrecoverPubKey needs .* recovery side-car UTXO/.test(message)) {
      throw new DeployerSidecarError('ecrecover', `the callee '${artifact.contractName}.${functionName}'`);
    }
    return refuse(`the ordinary build of its call, which lays out its block, fails: ${message}`);
  }
  const lockHex = (to: string | Uint8Array): string => binToHex(typeof to === 'string' ? addressToLockScript(to) : to);
  const master = built.inputs[0];
  if (master === undefined || lockHex(master.unlocker.generateLockingBytecode()) !== binToHex(masterLock)) {
    refuse('the ordinary build of its call does not put its master at input 0');
  }
  const frame = master!.unlocker as Partial<import('../interfaces.js').ContractUnlocker>;
  if (frame.abiFunction?.name !== fn.name || frame.params === undefined) {
    refuse('the ordinary build of its call does not run its function at its master');
  }
  // The frame as the build encoded it: the visible arguments, and the internal witnesses that are not the genesis call's.
  const args: FunctionArgument[] = [];
  const witnesses: Record<string, FunctionArgument> = {};
  const relocated: Record<string, bigint> = {};
  let carrierOffset: number | undefined;
  frame.abiFunction!.inputs.forEach((input, index) => {
    const value = frame.params![index] as FunctionArgument;
    if (!input.name.startsWith('__internal__')) {
      args.push(value);
      return;
    }
    if (input.name === '__internal__returnOutputIdx') {
      if (typeof value === 'bigint' && value > 0n) carrierOffset = Number(value);
      return;
    }
    if (GENESIS_FRAME_WITNESS.has(input.name)) return;
    if (TRANSACTION_INDEX_WITNESS.test(input.name) && typeof value === 'bigint') relocated[input.name] = value;
    else witnesses[input.name] = value;
  });
  // The child's constructor checks the record of the call it makes, whose digest names its own arguments: a build that
  // runs the function on others lays out a call the child does not make.
  const { callRecordDigest } = await import('./call-record.js');
  const digestOf = (params: readonly unknown[]): string | undefined => {
    try {
      const digest = callRecordDigest(fn, params as FunctionArgument[], {
        structs: artifact.structs ?? artifact.stateLayout?.structs, enums: artifact.enums,
      });
      return digest === undefined ? undefined : binToHex(digest);
    } catch {
      return undefined;
    }
  };
  const givenArgs = call.args[Symbol.iterator]();
  const given = digestOf(fn.inputs.map((input) => (input.name.startsWith('__internal__') ? undefined : givenArgs.next().value)));
  const ran = digestOf(frame.params!);
  if (given !== undefined && ran !== undefined && given !== ran) {
    refuse('the ordinary build of its call runs it on other arguments than the constructor passes (as when it orders a '
      + 'loop\'s keys by where their inserts chain in the sorted list), and the child\'s constructor refuses the record '
      + 'of another call');
  }
  const carrier = carrierOffset === undefined ? undefined : built.outputs[carrierOffset];
  if (carrier === undefined || lockHex(carrier.to) !== '51' || carrier.token?.category !== categoryId
    || carrier.token.nft?.capability !== 'none') {
    return refuse('the ordinary build of its call publishes no call record in its block');
  }
  // The pad lock stands for the creation's wallet coins, which a frame does not name.
  if (Object.values(witnesses).some((value) => value instanceof Uint8Array && binToHex(value).includes(binToHex(padLock)))) {
    refuse('the ordinary build of its call names its pad lock in its frame, where the creation has a coin of its own');
  }
  // Change the build pays back to its pad lock, and the stand-in sender's coin and edge record, follow the block: none
  // is the callee's, and the creation's change takes the change.
  const standInOutput = (output: Output): boolean => standIn !== undefined && output.token?.category === standIn.category;
  let end = built.outputs.length;
  while (end > 0 && (lockHex(built.outputs[end - 1]!.to) === binToHex(padLock) || standInOutput(built.outputs[end - 1]!))) {
    end -= 1;
  }
  if (built.outputs.slice(0, end).some(standInOutput)) {
    refuse('the ordinary build of its call lays out a token of its stand-in sender inside its block');
  }
  const pads = new Set([binToHex(padLock), BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX.toLowerCase()]);
  const padAt = (index: number): boolean => pads.has(binToHex(built.inputs[index]!.unlocker.generateLockingBytecode()));
  // The stand-in sender's coin follows every coin of the block, and only pads follow it: it leaves no index, and the
  // pads after it take its place, as they would in a build without it.
  const standInAt = standIn === undefined ? -1 : built.inputs.findIndex((input) => (
    input.txid === standIn.caller.identity.txid && input.vout === standIn.caller.identity.vout));
  if (standInAt >= 0 && built.inputs.some((_, index) => index > standInAt && !padAt(index))) {
    refuse('the ordinary build of its call spends a coin of its block after its stand-in sender\'s');
  }
  const inputs: CalleeBlockInput[] = [{ utxo: { ...listedCoin(master!), lockingBytecode: masterLock } }];
  for (const [index, input] of built.inputs.entries()) {
    if (index === 0 || index === standInAt) continue;
    if (padAt(index)) {
      inputs.push(undefined);
      continue;
    }
    const { unlocker } = input;
    const lock = unlocker.generateLockingBytecode();
    inputs.push({ utxo: { ...listedCoin(input), lockingBytecode: lock }, unlocker: (at) => movedUnlocker(unlocker, at) });
    context.spent.add(coinKey(input));
  }
  // A pad coin the build returns at its own index, as a 2-way recovery's middle input, which no covenant reads, is
  // a balanced slot: the creation fills it with a wallet coin and the filler.
  const returnsPad = (output: Output, index: number): boolean => {
    const input = built.inputs[index];
    return input !== undefined && output.token === undefined && input.token === undefined
      && output.amount === input.satoshis && lockHex(input.unlocker.generateLockingBytecode()) === binToHex(padLock);
  };
  if (built.outputs.slice(0, end).some((output, index) => lockHex(output.to) === binToHex(padLock)
    && !returnsPad(output, index))) {
    refuse('the ordinary build of its call pays its pad lock inside its block');
  }
  const outputs: Output[] = built.outputs.slice(0, end).map((output, index) => (returnsPad(output, index)
    ? plainFiller()
    : {
      to: output.to, amount: output.amount,
      ...(output.token === undefined ? {} : {
        token: {
          category: output.token.category, amount: output.token.amount,
          ...(output.token.nft === undefined ? {} : { nft: { ...output.token.nft } }),
        },
      }),
    }));
  // Every index of the block holds an input and an output: an output-only index takes a wallet coin, and an input
  // whose coin the call consumes without an output of its own takes the filler output.
  while (inputs.length < outputs.length) inputs.push(undefined);
  while (outputs.length < inputs.length) outputs.push(plainFiller());
  // The callee's run in the creation pins each NFT of its own category again: its call record's digest covers the tag.
  const rules = new Map<number, CalleeOutputRule>();
  outputs.forEach((output, offset) => {
    const nft = output.token?.nft;
    if (offset === 0 || offset === carrierOffset || output.token?.category !== categoryId || nft === undefined) return;
    if (nft.capability === 'mutable' || nft.capability === 'none') rules.set(offset, { kind: 'commitment' });
  });
  const extraBytes = built.inputs.slice(1).reduce((sum, input) => {
    const nested = input.unlocker as Partial<import('../interfaces.js').ContractUnlocker>;
    return sum + (nested.contract !== undefined && nested.covenantUnlocker !== true ? nested.contract.bytesize : 0);
  }, 0);
  return {
    ...call, args, contract, fn, categoryId, masterLock, senderReader,
    inputs, outputs, rules, carrier: outputs[carrierOffset!]!, carrierOffset, lanes: [], witnesses,
    guardedInserts: new Map(), relocated, extraBytes,
  };
}

/**
 * Lay out one callee's block from its function's block layout and its coins on the network (A7, A14 item 5). The callee
 * runs as an ordinary spend inside the creation, so its block holds what its own call would: its master, the records it
 * reads, each entry it reads or writes (an update of the entry its key names, or an insert after the entry before it),
 * its satoshi and token containers, its transfers and events, and its side-cars and their chain. Keys that read
 * `msg.sender` take `sender`, the child's master lock (A7).
 *
 * A side-car under a brand is spendable only beside input 0 of the brand's category, and a callee's master is never input
 * 0 of a creation, so a callee co-spends the shared pool's side-cars (salt 0), as Deploy<C> does (A14 item 6). `spent`
 * holds the shared coins the creation already spends; the ones this block takes are added to it.
 *
 * A function whose block a run sizes (loops, keccak256 and recovery loops, dynamic state, iterations, its own calls and
 * reads, block reads) or that deletes an entry takes the block of its ordinary call's build instead
 * (`planCalleeBlockByCall`). A function whose own spend needs what a constructor's call cannot carry is refused with
 * `DeployerCalleeError`.
 */
export async function planConstructorCalleeBlock(
  call: ConstructorCall, sender: Uint8Array, options: { spent?: Set<string> } = {},
): Promise<ConstructorCalleeBlock> {
  const { callee, functionName, args } = call;
  const contract = callee.contract.inner as unknown as import('../Contract.js').Contract<Artifact>;
  const artifact = callee.contract.inner.artifact;
  const refuse = (what: string): never => {
    throw new DeployerCalleeError(artifact.contractName, functionName, what);
  };
  const fn = artifact.abi.find((entry) => entry.name === functionName) ?? refuse('the callee has no such function');
  const {
    createDataNftUnlocker, createEntryNftUnlocker, createSatoshiContainerUnlocker, createTokenContainerUnlocker,
    getAnonymousEventNftAddress, getDataNftAddress, getEntryNftAddress, getEventNftAddress,
  } = await import('./covenant-helpers.js');
  const { eventContinuationLockingBytecode } = await import('./event-chunks.js');
  const { SortedList, bytesToSlotValue, decodeEntryCommitment } = await import('./SortedList.js');
  const { evalComputedKey } = await import('./route-expression-key.js');
  const spent = options.spent ?? new Set<string>();
  const provider = contract.provider;
  const categoryId = callee.contract.categoryId;
  const state = await callee.contract.getFullState() as {
    masterUtxo?: Utxo; dataNftUtxos: Utxo[]; state?: Record<string, unknown>;
  };
  const masterUtxo = state.masterUtxo ?? refuse('the callee has no master coin on the network yet');
  const masterLock = addressToLockScript(callee.contract.address);
  const dataLock = addressToLockScript(getDataNftAddress(contract, categoryId));
  const dataCount = artifact.stateLayout?.dataNftCount ?? 0;
  const required = fn.requiredNftIndices ?? Array.from({ length: dataCount }, (_, index) => index);
  const layout: import('@solidcash/utils').FunctionBlockLayout = fn.blockLayout ?? {
    blockSize: 1 + required.length,
    slots: [
      { kind: 'master', offset: 0 },
      ...required.map((nftIndex, index) => ({ kind: 'dataNft' as const, offset: 1 + index, nftIndex })),
    ],
  };
  const visible = fn.inputs.filter((input) => !input.name.startsWith('__internal__'));
  // A run that loops over collection entries, chunks or payments reads a trailing region the SDK sizes from the run;
  // an entry that creates a contract refuses a genesis call (A7). Name what keeps the call from being laid out.
  if ((fn.deployTargets?.length ?? 0) > 0 || layout.slots.some((slot) => slot.kind === 'deploy')) {
    refuse('it creates a contract, and a creating entry refuses a genesis call (A7): one run could both create a '
      + 'child and answer its constructor');
  }
  // A recovery loop whose triples follow the block (ecrecoverTrailingLoop) is laid out by the ordinary build below,
  // with a recovery a helper makes in the loop among them: the compiler inlines that helper into the loop. Any other
  // recovery in a loop is a helper's that the compiler keeps out of it (one returning from both arms of a branch, or
  // an overload sharing another's arity): every iteration reads the helper's one fixed triple, from arguments that are
  // not the callee's own. An artifact compiled before recovery loops read after the block reads over its records.
  if (fn.ecrecoverLoopReads === true && fn.ecrecoverTrailingLoop !== true) {
    refuse('it recovers keys in a loop through a helper the compiler keeps out of the loop: every iteration reads the '
      + 'helper\'s one fixed recovery slot, from arguments that are not the callee\'s own to lay out');
  }
  // Regions a run sizes (loops, keccak256 and recovery loops, dynamic state, iterations, the callee's own calls and
  // reads, block reads) and deletes are laid out by the ordinary build of the call; the fixed layout below covers the
  // rest.
  const sized: ReadonlyArray<keyof import('@solidcash/utils').AbiFunction> = [
    'sortedUpsertLoopInfo', 'sortedInsertLoopInfo', 'sortedInsertLoops', 'entryLoopWrites', 'runtimeLoopTransfers',
    'runtimeLoopEvents', 'dynamicWrites', 'dynamicReads', 'collectionIterations', 'externalCalls', 'externalReads',
    'lowLevelCalls', 'blockhashReads',
  ];
  const fixedKinds = new Set<string>([
    'master', 'dataNft', 'readOnlyDataNft', 'entry', 'event', 'eventChunk', 'returnEvent', 'satoshiContainer',
    'tokenContainer', 'transfer', 'tcTransfer', 'keccakSideCar', 'ecrecoverSideCar',
  ]);
  if (sized.some((field) => Array.isArray(fn[field]) && (fn[field] as unknown[]).length > 0)
    || fn.keccakLoopReads === true || fn.ecrecoverTrailingLoop === true
    || layout.slots.some((slot) => !fixedKinds.has(slot.kind) || slot.softDelete === true)
    || (fn.entryAccesses ?? []).some((access) => access.operations.includes('delete'))
    // A value of variable width (a struct, bytes or string mapping value) takes the old value as a witness, and the
    // chunks it runs past the inline limit into, which the run sizes from the value it writes.
    || fn.inputs.some((input) => /^__internal__(?:valueWitness|leadingPushValue)_\d+$/.test(input.name))) {
    return planCalleeBlockByCall(call, sender, { spent }, refuse);
  }

  // The values of the function's inputs by position, for helpers that read a key or a category from an input.
  const byPosition = fn.inputs.map((input) => {
    const index = visible.findIndex((candidate) => candidate.name === input.name);
    return index < 0 ? undefined : args[index];
  }) as FunctionArgument[];

  // Containers, as the ordinary call path finds them: the coin each container's address holds.
  let satoshiContainer: { utxo: Utxo; lock: Uint8Array } | undefined;
  if (layout.slots.some((slot) => slot.kind === 'satoshiContainer')) {
    const { loadCreateBuilderSatoshiContainer } = await import('./sc-load-create-builder-satoshi-container.js');
    try {
      const loaded = await loadCreateBuilderSatoshiContainer(
        { categoryId, inner: contract as never }, { abiFunction: fn, overrides: undefined },
      );
      if (loaded.satoshiContainerUtxo !== undefined && loaded.satoshiContainerLockingBytecode !== undefined) {
        satoshiContainer = {
          utxo: listedCoin(loaded.satoshiContainerUtxo), lock: loaded.satoshiContainerLockingBytecode,
        };
      }
    } catch (error) {
      refuse(`its satoshi container holds no coin to pay from (${(error as Error).message})`);
    }
    if (satoshiContainer === undefined) refuse('its satoshi container holds no coin to pay from');
  }
  let tokenContainers: import('./external-call-utxo-group.js').TokenContainerInfo[] = [];
  let tokenContainerLocks = new Map<string, Uint8Array>();
  if (layout.slots.some((slot) => slot.kind === 'tokenContainer' || slot.kind === 'tcTransfer')) {
    const { loadCreateBuilderTokenContainers } = await import('./sc-load-create-builder-token-containers.js');
    try {
      ({ tokenContainers, tokenContainerLockingBytecodes: tokenContainerLocks } = await loadCreateBuilderTokenContainers(
        { categoryId, inner: contract as never },
        { abiFunction: fn, args: byPosition, overrides: undefined, stateValues: state.state },
      ));
    } catch (error) {
      refuse(`its token container cannot be found: ${(error as Error).message}`);
    }
  }

  // Side-cars from the shared pool, and the keccak chain that rides the trailing region.
  const shared = sharedPoolProvider(provider, spent);
  let keccak: Array<{ utxo: Utxo; unlocker: Unlocker; recreate: Output }> = [];
  let chain: { sideCars: Array<Utxo & { unlocker: Unlocker }>; recreates: Output[] } | undefined;
  if (layout.slots.some((slot) => slot.kind === 'keccakSideCar') || fn.keccakChainReads === true) {
    const { resolveKeccakComputeCoSpends } = await import('./sc-resolve-keccak-compute-co-spends.js');
    let resolved: Awaited<ReturnType<typeof resolveKeccakComputeCoSpends>>;
    try {
      resolved = await resolveKeccakComputeCoSpends({
        categoryId,
        sidecarSalt: new Uint8Array(32),
        inner: { bytecode: contract.bytecode, artifact, provider: shared as never },
        extractStatefulKeccakPreimages: async () => refuse(
          'it hashes a keccak256 preimage that is not one of its arguments; the SDK lays out a side-car from the '
          + 'argument it hashes',
        ),
        evalComputedKey: (...values: unknown[]) => (evalComputedKey as (...a: unknown[]) => Uint8Array | undefined)(
          ...values),
      }, fn, [...args]);
    } catch (error) {
      if (error instanceof DeployerCalleeError) throw error;
      if (/side-car UTXO/.test((error as Error).message)) {
        throw new DeployerSidecarError('keccak', `the callee '${artifact.contractName}.${functionName}'`);
      }
      throw error;
    }
    keccak = resolved.coSpends;
    chain = resolved.chain as typeof chain;
    for (const coin of [...keccak.map((entry) => entry.utxo), ...(chain?.sideCars ?? [])]) spent.add(coinKey(coin));
  }
  const ecrecover = await sharedEcrecoverSteps({
    calls: (fn.ecrecoverArgParams ?? []).map((names) => names.map((name) => {
      const index = name === null ? -1 : visible.findIndex((input) => input.name === name);
      return index < 0 ? undefined : args[index];
    }) as unknown as readonly [unknown, unknown, unknown, unknown]),
    provider: shared,
    spent,
    refuse,
    who: `the callee '${artifact.contractName}.${functionName}'`,
  });
  if (ecrecover.length !== layout.slots.filter((slot) => slot.kind === 'ecrecoverSideCar').length) {
    refuse(`its ${layout.slots.filter((slot) => slot.kind === 'ecrecoverSideCar').length} ecrecover side-car slots `
      + `do not match its ${fn.ecrecoverArgParams?.length ?? 0} recoveries`);
  }

  const inputs: CalleeBlockInput[] = [];
  const outputs: Output[] = [];
  const rules = new Map<number, CalleeOutputRule>();
  const witnesses: Record<string, FunctionArgument> = {};
  const carrier: Output = {
    to: Uint8Array.of(0x51), amount: 1000n,
    token: { category: categoryId, amount: 0n, nft: { capability: 'none', commitment: '' } },
  };
  let carrierOffset: number | undefined;
  const inserts: Array<{ slotIndex: number; key: Uint8Array; predecessor: Utxo; lock: Uint8Array;
    predecessorCommitment: Uint8Array; lane: boolean }> = [];
  const guardedInserts = new Map<number, { slotIndex: number; witness: string }>();
  const eventLock = (signature: string): Uint8Array => addressToLockScript(
    artifact.events?.find((event) => event.signature === signature)?.anonymous === true
      ? getAnonymousEventNftAddress(contract, categoryId)
      : getEventNftAddress(contract, categoryId, signature),
  );
  const eventNft = (lock: Uint8Array, commitment: string): Output => ({
    to: lock, amount: RESERVE,
    token: { category: categoryId, amount: 0n, nft: { capability: 'none', commitment } },
  });
  /** A coin of the callee's own; its unlocker names the callee's master wherever the block is placed. */
  const own = (utxo: Utxo, unlocker: (masterIndex: number) => Unlocker): CalleeBlockInput => ({ utxo, unlocker });
  const shared1 = (step: { utxo: Utxo; unlocker: Unlocker }): CalleeBlockInput => ({
    utxo: step.utxo, unlocker: () => step.unlocker,
  });
  let eventIndex = 0;
  for (const slot of [...layout.slots].sort((left, right) => left.offset - right.offset)) {
    if (slot.offset !== inputs.length) refuse(`its block layout leaves offset ${inputs.length} empty`);
    switch (slot.kind) {
      case 'master':
        // The master's unlocker is its frame, which `placeConstructorCalls` builds.
        inputs.push({ utxo: { ...masterUtxo, lockingBytecode: masterLock } });
        outputs.push({
          to: masterLock, amount: masterUtxo.satoshis,
          ...(masterUtxo.token === undefined ? {} : { token: masterUtxo.token }),
        });
        break;
      case 'dataNft':
      case 'readOnlyDataNft': {
        const utxo = state.dataNftUtxos[slot.nftIndex ?? 0] ?? refuse(`its record ${slot.nftIndex ?? 0} is not on the network`);
        inputs.push(own({ ...utxo, lockingBytecode: dataLock },
          (masterIndex) => createDataNftUnlocker(contract, masterIndex, categoryId)));
        outputs.push({
          to: dataLock, amount: utxo.satoshis,
          token: { category: categoryId, amount: 0n,
            nft: { capability: 'mutable', commitment: utxo.token?.nft?.commitment ?? '' } },
        });
        rules.set(slot.offset, { kind: 'commitment' });
        break;
      }
      case 'entry': {
        const slotIndex = slot.slotIndex ?? 0;
        const access = fn.entryAccesses?.find((candidate) => candidate.slotIndex === slotIndex)
          ?? fn.entryAccesses?.[slotIndex];
        const collection = artifact.stateLayout?.collections?.find(
          (candidate) => candidate.name === access?.collection || candidate.signature === access?.collection,
        );
        if (access === undefined || collection === undefined) {
          return refuse(`its entry slot ${slotIndex} names no collection the SDK can read`);
        }
        if (collection.sorted !== true) {
          // This compiler keeps every collection sorted; an unsorted one is an older compiler's, whose absent keys no
          // entry proves.
          refuse(`its entry slot ${slotIndex} is an entry of '${access.collection}', which is not a sorted mapping, `
            + 'so no entry proves a key absent');
        }
        const writes = access.operations.includes('write') || access.operations.includes('delete');
        if (writes && !fn.sortedBatchInfo?.some((batch) => batch.slotIndices.includes(slotIndex))) {
          refuse(`its entry slot ${slotIndex} writes '${access.collection}' outside a sorted batch`);
        }
        if (access.operations.includes('delete')) {
          refuse(`it deletes an entry of '${access.collection}', which a constructor's call does not lay out`);
        }
        const entryAddress = getEntryNftAddress(contract, categoryId, access.collection);
        const entryLock = addressToLockScript(entryAddress);
        const list = SortedList.fromUtxos((await provider.getUtxos(entryAddress))
          .filter((utxo) => utxo.token?.category === categoryId));
        const key = await calleeEntrySlot(access, collection, fn, args, sender, refuse);
        const exact = list.find(key);
        const entryUnlocker = (masterIndex: number): Unlocker => createEntryNftUnlocker(
          contract, masterIndex, categoryId, access.collection,
        );
        const node = (utxo: Utxo, commitment: string): Output => ({
          to: entryLock, amount: utxo.satoshis,
          token: { category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment } },
        });
        if (!writes) {
          // A read: the entry its key names, or the one before the key, which proves it absent. Either is recreated as
          // it is (the read-only preservation of an ordinary call).
          let proof = exact;
          if (proof === undefined) {
            try {
              proof = list.predecessorOf(key);
            } catch (error) {
              return refuse(`its ${access.collection} has no entry to prove the key absent (${(error as Error).message})`);
            }
          }
          inputs.push(own({ ...proof.utxo, lockingBytecode: entryLock }, entryUnlocker));
          outputs.push(node(proof.utxo, proof.utxo.token?.nft?.commitment ?? ''));
          break;
        }
        witnesses[vmapWitness('Slot', slotIndex)] = key;
        witnesses[vmapWitness('Proof', slotIndex)] = BigInt(slot.offset);
        if (exact !== undefined) {
          // An update: the entry itself is spent and recreated at this offset.
          witnesses[vmapWitness('Next', slotIndex)] = exact.nextKey;
          witnesses[vmapWitness('PredOut', slotIndex)] = -1n;
          inputs.push(own({ ...exact.utxo, lockingBytecode: entryLock }, entryUnlocker));
          outputs.push(node(exact.utxo, exact.utxo.token?.nft?.commitment ?? ''));
        } else {
          // An insert: the entry before the key is spent here, the new node takes this offset, and the relinked
          // predecessor (P') is a lane after the paired region.
          let plan: ReturnType<InstanceType<typeof SortedList>['planInsert']>;
          try {
            plan = list.planInsert(key);
          } catch (error) {
            return refuse(`its ${access.collection} has no entry to insert after (${(error as Error).message})`);
          }
          witnesses[vmapWitness('Next', slotIndex)] = decodeEntryCommitment(plan.newNodeCommitment).nextKey;
          witnesses[vmapWitness('PredOut', slotIndex)] = -3n;
          if (slot.conditional === true && fn.sortedBatchInfo?.some((batch) => batch.slotIndices.length === 1
            && batch.slotIndices[0] === slotIndex)) {
            guardedInserts.set(slot.offset, { slotIndex, witness: vmapWitness('PredOut', slotIndex) });
          }
          inserts.push({
            slotIndex, key, predecessor: plan.predecessor.utxo, lock: entryLock,
            predecessorCommitment: plan.predNewCommitment, lane: true,
          });
          inputs.push(own({ ...plan.predecessor.utxo, lockingBytecode: entryLock }, entryUnlocker));
          outputs.push(node(plan.predecessor.utxo, binToHex(plan.newNodeCommitment)));
        }
        rules.set(slot.offset, { kind: 'commitment' });
        break;
      }
      case 'event':
      case 'eventChunk': {
        const emit = fn.emits?.find((candidate) => candidate.emitIndex === slot.slotIndex)
          ?? (slot.kind === 'event' ? fn.emits?.[slot.slotIndex ?? eventIndex] : undefined)
          ?? refuse(`its ${slot.kind} slot ${slot.offset} names no event`);
        if (slot.kind === 'event') eventIndex += 1;
        inputs.push(undefined);
        const lock = slot.kind === 'event' ? eventLock(emit.eventSignature)
          : eventContinuationLockingBytecode(categoryId, emit.eventSignature,
            artifact.events?.find((event) => event.signature === emit.eventSignature)?.anonymous === true);
        if (slot.kind === 'event' && slot.conditional !== true) {
          outputs.push(eventNft(lock, ''));
          rules.set(slot.offset, { kind: 'commitment' });
          break;
        }
        // An emit under a condition, or a chunk its payload may not reach: no token until the run pins one here.
        outputs.push(plainFiller());
        rules.set(slot.offset, { kind: 'optional', make: (commitment) => eventNft(lock, commitment) });
        break;
      }
      case 'returnEvent':
        carrierOffset = slot.offset;
        inputs.push(undefined);
        outputs.push(carrier);
        break;
      case 'satoshiContainer': {
        const { utxo, lock } = satoshiContainer!;
        inputs.push(own({ ...utxo, lockingBytecode: lock },
          (masterIndex) => createSatoshiContainerUnlocker(contract, masterIndex, categoryId)));
        outputs.push({ to: lock, amount: utxo.satoshis });
        rules.set(slot.offset, {
          kind: 'satoshiContainer', satoshis: utxo.satoshis, lock, minerFee: BigInt(layout.minerFee ?? 0),
        });
        break;
      }
      case 'tokenContainer': {
        const container = tokenContainers.find((candidate) => candidate.tokenContainerSlotIndex === (slot.slotIndex ?? 0));
        const category = container?.tokenContainerCategoryId;
        if (container?.utxo === undefined || category === undefined) {
          return refuse(`its token container${category === undefined ? '' : ` for ${category}`} holds no coin to pay from`);
        }
        const utxo = listedCoin(container.utxo);
        const lock = tokenContainerLocks.get(category) ?? container.utxo.unlocker.generateLockingBytecode();
        inputs.push(own({ ...utxo, lockingBytecode: lock },
          (masterIndex) => createTokenContainerUnlocker(contract, masterIndex, categoryId, category)));
        outputs.push({ to: lock, amount: utxo.satoshis, ...(utxo.token === undefined ? {} : { token: { ...utxo.token } }) });
        rules.set(slot.offset, { kind: 'tokenContainer', utxo, lock, category });
        break;
      }
      case 'transfer':
        inputs.push(undefined);
        outputs.push(plainFiller());
        rules.set(slot.offset, { kind: 'transfer', active: false });
        break;
      case 'tcTransfer': {
        const site = fn.tokenContainerTransferSites?.find((candidate) => candidate.transferIndex === slot.slotIndex);
        const container = site === undefined ? (tokenContainers.length === 1 ? tokenContainers[0] : undefined)
          : tokenContainers.find((candidate) => candidate.tokenContainerSlotIndex === site.tokenContainerSlot);
        inputs.push(undefined);
        outputs.push(plainFiller());
        rules.set(slot.offset, {
          kind: 'tokenTransfer', active: false,
          ...(container === undefined ? {} : { category: container.tokenContainerCategoryId }),
        });
        break;
      }
      case 'keccakSideCar': {
        const sidecar = keccak[slot.slotIndex ?? 0] ?? refuse(`its keccak256 side-car slot ${slot.offset} has no side-car`);
        inputs.push(shared1(sidecar));
        outputs.push(sidecar.recreate);
        break;
      }
      case 'ecrecoverSideCar': {
        const step = ecrecover[slot.slotIndex ?? 0];
        if (step === undefined) {
          inputs.push(undefined);
          outputs.push(plainFiller());
          break;
        }
        inputs.push(shared1(step));
        outputs.push(step.recreate);
        break;
      }
      default:
        refuse(`its ${slot.kind} slot is one a constructor's call does not lay out`);
    }
  }
  if (inputs.length !== layout.blockSize) refuse(`its block layout fills ${inputs.length} of ${layout.blockSize} offsets`);
  // A keccak chain rides the trailing region: its side-cars start at the trailing base, where the run reads them.
  if (chain !== undefined) {
    const base = layout.trailingBase ?? layout.blockSize;
    while (inputs.length < base) {
      inputs.push(undefined);
      outputs.push(plainFiller());
    }
    chain.sideCars.forEach((sidecar, step) => {
      const { unlocker, ...utxo } = sidecar;
      inputs.push(shared1({ utxo, unlocker }));
      outputs.push(chain!.recreates[step]!);
    });
  }
  // The record slot that ends the block needs no coin: its carrier goes after the paired region instead.
  if (carrierOffset !== undefined && carrierOffset === inputs.length - 1) {
    inputs.pop();
    outputs.pop();
    carrierOffset = undefined;
  }
  // Two lanes can name one node, an update and the insert it precedes: the later lane proves it at the first lane's
  // input, and its own offset takes a wallet coin.
  const firstAt = new Map<string, number>();
  inputs.forEach((input, offset) => {
    if (input === undefined) return;
    const outpoint = coinKey(input.utxo);
    const first = firstAt.get(outpoint);
    if (first === undefined) {
      firstAt.set(outpoint, offset);
      return;
    }
    for (const [name, value] of Object.entries(witnesses)) {
      if (/^__internal__vmapBatchProof_\d+$/.test(name) && value === BigInt(offset)) witnesses[name] = BigInt(first);
    }
    inputs[offset] = undefined;
  });
  // Inserts that share one proof in a linear batch form one ascending chain: each links to the next key, and only the
  // lowest relinks the predecessor.
  for (const batch of fn.sortedBatchInfo ?? []) {
    if (batch.linear !== true || batch.slotIndices.length < 2) continue;
    const byProof = new Map<bigint, Array<{ slotIndex: number; key: Uint8Array; insert?: (typeof inserts)[number] }>>();
    for (const slotIndex of batch.slotIndices) {
      const proof = witnesses[vmapWitness('Proof', slotIndex)];
      const key = witnesses[vmapWitness('Slot', slotIndex)];
      if (typeof proof !== 'bigint' || !(key instanceof Uint8Array)) continue;
      const rows = byProof.get(proof) ?? [];
      rows.push({ slotIndex, key, insert: inserts.find((insert) => insert.slotIndex === slotIndex) });
      byProof.set(proof, rows);
    }
    for (const rows of byProof.values()) {
      if (rows.length < 2 || !rows.some((row) => row.insert !== undefined)) continue;
      rows.sort((left, right) => (bytesToSlotValue(left.key) < bytesToSlotValue(right.key) ? -1 : 1));
      const repeated = rows.some((row, index) => index > 0
        && bytesToSlotValue(row.key) === bytesToSlotValue(rows[index - 1].key));
      if (repeated) continue;
      if (rows.some((row, index) => row.insert === undefined && index !== 0)) continue;
      rows.forEach((row, index) => {
        const successor = rows[index + 1];
        if (successor !== undefined) witnesses[vmapWitness('Next', row.slotIndex)] = successor.key;
        if (row.insert === undefined || (index === 0 && rows[0].insert !== undefined)) return;
        witnesses[vmapWitness('PredOut', row.slotIndex)] = -1n;
        row.insert.lane = false;
      });
    }
  }
  const lanes = inserts.filter((insert) => insert.lane).map((insert) => ({
    witness: vmapWitness('PredOut', insert.slotIndex),
    output: {
      to: insert.lock, amount: insert.predecessor.satoshis,
      token: { category: categoryId, amount: 0n,
        nft: { capability: 'mutable' as const, commitment: binToHex(insert.predecessorCommitment) } },
    },
  }));
  // A linear batch publishes its rows in key order, each with its rank.
  for (const batch of fn.sortedBatchInfo ?? []) {
    if (batch.linear !== true) continue;
    const rows = batch.slotIndices.map((slotIndex) => ({
      slotIndex, key: witnesses[vmapWitness('Slot', slotIndex)], next: witnesses[vmapWitness('Next', slotIndex)],
    }));
    if (rows.some((row) => !(row.key instanceof Uint8Array) || !(row.next instanceof Uint8Array))) continue;
    rows.sort((left, right) => (
      bytesToSlotValue(left.key as Uint8Array) < bytesToSlotValue(right.key as Uint8Array) ? -1 : 1));
    rows.forEach((row, rank) => { witnesses[vmapWitness('Rank', row.slotIndex)] = BigInt(rank); });
    witnesses[`__internal__vmapBatchRows_${batch.collection}`] = Uint8Array.from(
      rows.flatMap((row) => [...(row.key as Uint8Array), ...(row.next as Uint8Array)]),
    );
  }
  witnesses.__internal__vmapBatchTrailingCount = BigInt(lanes.length);
  const block: ConstructorCalleeBlock = {
    ...call, contract, fn, categoryId, masterLock,
    senderReader: fn.inputs.some((input) => input.name === '__internal__msgSenderCategory'),
    inputs, outputs, rules, carrier, ...(carrierOffset === undefined ? {} : { carrierOffset }), lanes, witnesses,
    guardedInserts,
  };
  recreateCalleeContainers(block, outputs, 0);
  return block;
}

/**
 * Recreate each container of a callee block from the transfers its run made so far: the satoshi container keeps its
 * coin's value less the active transfers and the miner fee, a token container its units less the active transfers of
 * its category. A container left below the dust limit, or with no units and no NFT, leaves the filler its covenant
 * admits. `outputs` holds the block from `base`. Returns whether an output changed.
 */
function recreateCalleeContainers(block: ConstructorCalleeBlock, outputs: Output[], base: number): boolean {
  const transfers = [...block.rules.entries()];
  const lockHex = (to: string | Uint8Array): string => (typeof to === 'string' ? to : binToHex(to));
  let changed = false;
  const set = (index: number, output: Output): void => {
    const have = outputs[index];
    const same = have !== undefined && lockHex(have.to) === lockHex(output.to) && have.amount === output.amount
      && have.token?.category === output.token?.category && have.token?.amount === output.token?.amount
      && have.token?.nft?.commitment === output.token?.nft?.commitment;
    if (same) return;
    outputs[index] = output;
    changed = true;
  };
  for (const [offset, rule] of block.rules) {
    if (rule.kind === 'satoshiContainer') {
      const paid = transfers.reduce((sum, [at, other]) => sum
        + (other.kind === 'transfer' && other.active ? outputs[base + at]!.amount : 0n), 0n);
      const kept = rule.satoshis - paid - rule.minerFee;
      // Under its lock's dust limit the container is drained, and its index keeps the filler.
      set(base + offset, kept >= getDustThreshold({ lockingBytecode: rule.lock })
        ? { to: rule.lock, amount: kept } : fillerOutput());
    } else if (rule.kind === 'tokenContainer') {
      const token = rule.utxo.token;
      const paid = transfers.reduce((sum, [at, other]) => sum
        + (other.kind === 'tokenTransfer' && other.active && outputs[base + at]!.token?.category === rule.category
          ? outputs[base + at]!.token!.amount : 0n), 0n);
      const units = (token?.amount ?? 0n) - paid;
      const sentNft = transfers.some(([at, other]) => other.kind === 'tokenTransfer' && other.active
        && outputs[base + at]!.token?.category === rule.category && outputs[base + at]!.token?.nft !== undefined);
      const nft = token?.nft !== undefined && (!sentNft || token.nft.capability === 'minting') ? token.nft : undefined;
      set(base + offset, units <= 0n && nft === undefined ? fillerOutput() : {
        to: rule.lock, amount: rule.utxo.satoshis,
        token: { category: rule.category, amount: units < 0n ? 0n : units, ...(nft === undefined ? {} : { nft }) },
      });
    }
  }
  return changed;
}

/**
 * The byte ranges a sender-reading callee hashes in a `create` unlocking (A4.2, A7): A, the contract parameters, and
 * C's code. The unlocking is read push by push from byte 5: the callee list, Q (the sender category, the value and the
 * constructor parameters), A, then the code.
 */
export function deployerUnlockingRanges(
  deployer: DeployerAbi, contractParameters: number, unlocking: Uint8Array,
): { aOffset: number; aLength: number; codeOffset: number; codeLength: number } {
  const create = deployer.abi.find((entry) => entry.name === 'create');
  const publicCount = create?.inputs.filter((input) => !input.name.startsWith('__internal__')).length ?? 0;
  let at = 5;
  const next = (): { start: number; length: number } => {
    const opcode = unlocking[at];
    if (opcode === undefined) throw new DeployerPrepError('The create unlocking ends before its code push');
    // OP_0, OP_1NEGATE and OP_1 to OP_16 push no data bytes; PUSHDATA1/2/4 state the size little-endian.
    const header = opcode === 0x4c ? 2 : opcode === 0x4d ? 3 : opcode === 0x4e ? 5 : 1;
    const length = opcode >= 0x01 && opcode <= 0x4b ? opcode
      : unlocking.slice(at + 1, at + header).reduceRight((value, byte) => value * 256 + byte, 0);
    const start = at + header;
    at = start + length;
    return { start, length };
  };
  next();
  for (let push = 0; push < publicCount - contractParameters + 2; push += 1) next();
  const aOffset = at;
  for (let push = 0; push < contractParameters; push += 1) next();
  const aLength = at - aOffset;
  const code = next();
  return { aOffset, aLength, codeOffset: code.start, codeLength: code.length };
}

/** A7's genesis call: `X ‖ slot ‖ g_in`, then `g_out` and the create unlocking's ranges for a sender reader. */
function genesisCallTag(categoryId: string, slot: number, gIn: number, sender?: {
  gOut: number; aOffset: number; aLength: number; codeOffset: number; codeLength: number;
}): Uint8Array {
  const two = (value: number): number[] => [value & 0xff, (value >> 8) & 0xff];
  return new Uint8Array([
    ...hexToBin(categoryId).slice().reverse(), ...two(slot), ...two(gIn),
    ...(sender === undefined ? [] : [
      ...two(sender.gOut), ...two(sender.aOffset), ...two(sender.aLength),
      ...two(sender.codeOffset), ...two(sender.codeLength),
    ]),
  ]);
}

/** The callee's full ABI frame for its genesis call: visible arguments, the tag, the record index and the witnesses. */
function calleeFrame(block: ConstructorCalleeBlock, tag: Uint8Array, returnIndex: number): FunctionArgument[] {
  const visible = block.fn.inputs.filter((input) => !input.name.startsWith('__internal__'));
  if (block.args.length !== visible.length) {
    throw new DeployerCalleeError(block.contract.artifact.contractName, block.functionName,
      `it takes ${visible.length} visible argument${visible.length === 1 ? '' : 's'}, but ${block.args.length} were given`);
  }
  const values = new Map<string, FunctionArgument>();
  visible.forEach((input, index) => values.set(input.name, block.args[index]));
  for (const input of block.fn.inputs) {
    if (!input.name.startsWith('__internal__')) continue;
    if (input.name === '__internal__genesisCall') values.set(input.name, tag);
    else if (input.name === '__internal__returnOutputIdx') values.set(input.name, BigInt(returnIndex));
    // The genesis step alone resolves a genesis call's sender (A7); the zero category asks for no caller edge.
    else if (input.name === '__internal__msgSenderCategory') values.set(input.name, new Uint8Array(32));
    // A standalone run of a body the multi-call entry can also run takes no row shift.
    else if (input.name === '__internal__rowEntryShift') values.set(input.name, 0n);
    // A tagged record names its reader by its tag (X is the outpoint only the creating input spends), not this.
    else if (input.name === CALL_RECORD_READER_INPUT) values.set(input.name, CALL_RECORD_NO_READER);
    else if (block.witnesses[input.name] !== undefined) values.set(input.name, block.witnesses[input.name]);
    else {
      throw new DeployerCalleeError(block.contract.artifact.contractName, block.functionName,
        `the entry needs the internal witness '${input.name}', which a constructor's call cannot fill`);
    }
  }
  return block.fn.inputs.map((input) => values.get(input.name)!);
}

/**
 * `create`'s call witnesses before the callee blocks are placed: -1 for an index, empty for a selector. An unlocking with
 * them serves a probe of the creator, which reads `create`'s unlocking only from byte 6 + 2s (A6).
 */
export function unboundCallWitnesses(deployer: DeployerAbi): Record<string, bigint | Uint8Array> {
  const witnesses: Record<string, bigint | Uint8Array> = {};
  for (const input of deployer.abi.find((entry) => entry.name === 'create')?.inputs ?? []) {
    if (!/^__internal__(externalCallInputBase|extcall|callEdgeOutputIdx|externalReturnOutputIdx|externalCallSelector)/
      .test(input.name) && !CALL_ARGUMENT_WITNESS.test(input.name)) continue;
    witnesses[input.name] = input.type.startsWith('bytes') ? new Uint8Array() : -1n;
  }
  return witnesses;
}

/** What a callee's settling run reports to the creation it runs in. */
export interface CalleeSettleHooks {
  /** A round moved an output's satoshis: the caller rebalances its change. */
  amountsChanged?: () => void;
  /**
   * The `tx.time` checks the callee's run reached (A5). Returns true when the caller moved the creation's locktime,
   * so the run is tried again; a conflict throws `DeployerLocktimeConflictError`.
   */
  locktime?: (needs: readonly LocktimeNeed[]) => boolean;
}

/** A14 item 5: the call slots of one creation, placed in its transaction. */
export interface PlacedConstructorCalls {
  /** m_j: each callee's master input index. */
  masters: number[];
  /** o_j: each callee's record carrier. */
  returns: number[];
  /** `create`'s witnesses for its call slots. */
  synthetic(deployer: DeployerAbi): Record<string, bigint | Uint8Array>;
  /** Fill each callee's genesis call from the creation it answers: input g_in creates X, output g_out is C's master. */
  bind(options: {
    categoryId: string; gIn: number; gOut: number; deployer: DeployerAbi; contractParameters: number;
    unlocking: Uint8Array;
  }): void;
  /**
   * Complete each callee's run in the finished transaction: its records, entries, events, transfers, containers and
   * its call record. `amountsChanged` runs after a round that moved an output's satoshis, so the caller can rebalance.
   */
  settle(
    provider: NetworkProvider, build: () => { transaction: Transaction; sourceOutputs: Transaction['outputs'] },
    hooks?: CalleeSettleHooks,
  ): void;
  /** Each callee's master input, its function, and its subject in words, for a check that runs every callee. */
  callees(): Array<{ inputIndex: number; who: string }>;
}

/**
 * Place the callee blocks at the builder's current end, which must be a paired index (as many inputs as outputs), each
 * input beside its output; then the record carriers and the relinked predecessors. A block's unfunded slot takes a
 * coin from `filler`.
 */
export async function placeConstructorCalls(options: {
  builder: import('../TransactionBuilder.js').TransactionBuilder;
  blocks: readonly ConstructorCalleeBlock[];
  filler: () => Promise<{ utxo: Utxo; unlocker: Unlocker }>;
}): Promise<PlacedConstructorCalls> {
  const { builder, blocks, filler } = options;
  if (builder.inputs.length !== builder.outputs.length) {
    throw new DeployerPrepError(
      `The callee blocks need a paired index, but the creation has ${builder.inputs.length} inputs and `
      + `${builder.outputs.length} outputs there`,
    );
  }
  const frames: Array<FunctionArgument[] | undefined> = blocks.map(() => undefined);
  const tags: Array<Uint8Array | undefined> = blocks.map(() => undefined);
  const masters: number[] = [];
  for (const [position, block] of blocks.entries()) {
    const master = builder.inputs.length;
    masters.push(master);
    const unlock = block.contract.unlock[block.functionName];
    if (unlock === undefined) {
      throw new DeployerCalleeError(block.contract.artifact.contractName, block.functionName,
        'the SDK cannot build its unlocking');
    }
    let cached: { frame: FunctionArgument[]; unlocker: Unlocker } | undefined;
    const masterUnlocker: Unlocker = {
      generateLockingBytecode: () => block.masterLock,
      generateUnlockingBytecode: (context) => {
        const frame = frames[position];
        // Until `bind`, a placeholder: the creation's own run checks every callee before anything is broadcast.
        if (frame === undefined) return Uint8Array.of(0x51);
        if (cached?.frame !== frame) cached = { frame, unlocker: unlock(...frame) };
        return cached.unlocker.generateUnlockingBytecode(context);
      },
    };
    // A coin an earlier input of the creation already spends, which the block names by a witness (an oracle pool's info
    // coin two callees read), is spent once: its index here takes a wallet coin and the filler output, and the witness
    // names the earlier input. Any other coin spent twice cannot be laid out.
    const redirected = new Map<number, number>();
    const named = new Set(Object.values(block.relocated ?? {}).map(Number));
    for (const [offset, input] of block.inputs.entries()) {
      const earlier = offset === 0 || input === undefined ? -1 : builder.inputs.findIndex((placed) => (
        placed.vout === input.utxo.vout && placed.txid.toLowerCase() === input.utxo.txid.toLowerCase()));
      if (offset === 0) builder.addInput(input!.utxo, masterUnlocker);
      else if (input === undefined || earlier >= 0) {
        if (earlier >= 0) {
          if (!named.has(offset)) {
            throw new DeployerCalleeError(block.contract.artifact.contractName, block.functionName,
              `its block spends ${input!.utxo.txid}:${input!.utxo.vout}, which input ${earlier} of the creation already `
              + 'spends; one coin is one input');
          }
          redirected.set(offset, earlier);
          block.outputs[offset] = plainFiller();
        }
        const coin = await filler();
        builder.addInput(coin.utxo, coin.unlocker);
      } else builder.addInput(input.utxo, input.unlocker!(master));
      builder.addOutput(block.outputs[offset]);
    }
    for (const [name, offset] of Object.entries(block.relocated ?? {})) {
      block.witnesses[name] = offset < 0n ? offset : BigInt(redirected.get(Number(offset)) ?? master + Number(offset));
    }
  }
  const returns = blocks.map((block, position) => {
    if (block.carrierOffset !== undefined) return masters[position] + block.carrierOffset;
    builder.addOutput(block.carrier);
    return builder.outputs.length - 1;
  });
  const laneIndexes = blocks.map((block) => block.lanes.map((lane) => {
    block.witnesses[lane.witness] = BigInt(builder.outputs.length);
    builder.addOutput(lane.output);
    return builder.outputs.length - 1;
  }));
  return {
    masters,
    returns,
    synthetic(deployer) {
      const create = deployer.abi.find((entry) => entry.name === 'create');
      const has = (name: string): boolean => create?.inputs.some((input) => input.name === name) === true;
      const synthetic: Record<string, bigint | Uint8Array> = {
        __internal__externalCallInputBase: BigInt(masters[0] ?? 0),
      };
      blocks.forEach((block, position) => {
        const slot = block.slot;
        if (has(`__internal__extcallMasterIdx${slot}`)) synthetic[`__internal__extcallMasterIdx${slot}`] = BigInt(masters[position]);
        synthetic[`__internal__extcallAnchorIdx${slot}`] = -1n;
        synthetic[`__internal__callEdgeOutputIdx${slot}`] = -1n;
        synthetic[has(`__internal__externalReturnOutputIdx${slot}`)
          ? `__internal__externalReturnOutputIdx${slot}` : '__internal__externalReturnOutputIdx'] = BigInt(returns[position]);
        const selector = has(`__internal__externalCallSelector${slot}`)
          ? `__internal__externalCallSelector${slot}` : '__internal__externalCallSelector';
        if (has(selector) && block.fn.selector !== undefined) synthetic[selector] = hexToBin(block.fn.selector);
        // An argument the constructor's call leaves to its callee: the callee's, as its record digests it.
        for (const input of create?.inputs ?? []) {
          const witness = CALL_ARGUMENT_WITNESS.exec(input.name);
          if (witness === null || Number(witness[1]) !== slot) continue;
          const value = leftCallArgumentWitness({
            functionName: block.functionName, functionArgs: block.args,
            externalContract: { inner: { artifact: block.contract.artifact } },
          }, Number(witness[2]));
          if (value !== undefined) synthetic[input.name] = value;
        }
      });
      return synthetic;
    },
    bind({ categoryId, gIn, gOut, deployer, contractParameters, unlocking }) {
      const ranges = deployerUnlockingRanges(deployer, contractParameters, unlocking);
      blocks.forEach((block, position) => {
        tags[position] = genesisCallTag(categoryId, block.slot, gIn, block.senderReader ? { gOut, ...ranges } : undefined);
        frames[position] = calleeFrame(block, tags[position]!, returns[position]);
      });
    },
    settle(provider, build, hooks = {}) {
      blocks.forEach((block, position) => {
        const lanes = new Map(block.lanes.map((lane, at) => [lane.witness, laneIndexes[position]![at]!]));
        settleCalleeRun({
          provider, build, master: masters[position], block, outputs: builder.outputs as Output[],
          pinned: [returns[position], ...laneIndexes[position]],
          lanes,
          reframe: () => {
            const tag = tags[position];
            if (tag !== undefined) frames[position] = calleeFrame(block, tag, returns[position]);
          },
          subject: `The call to '${block.contract.artifact.contractName}.${block.functionName}' at slot ${block.slot}`,
          who: `the callee '${block.contract.artifact.contractName}.${block.functionName}' of call slot ${block.slot}`,
          hooks,
        });
      });
    },
    callees() {
      return blocks.map((block, position) => ({
        inputIndex: masters[position]!,
        who: `the callee '${block.contract.artifact.contractName}.${block.functionName}' of call slot ${block.slot}`,
      }));
    },
  };
}

/** One child of a creating call whose `create` co-spends side-cars or calls contracts (A14 item 4 step 6). */
export interface ChildCreationGroup {
  /** Its place in the creator's run order. */
  deployment: number;
  contractName: string;
  artifact: Artifact;
  deployer: DeployerAbi;
  /** Its master lock: the `msg.sender` its callees take (A7). */
  childLockingBytecode: Uint8Array;
  /** `create`'s public arguments by name: C's contract parameters, then its constructor's. */
  args: Readonly<Record<string, FunctionArgument>>;
  callees: readonly ConstructorCallee[] | undefined;
}

/** Where each child's side-cars and callee blocks landed, and what the added coins leave for the change. */
export interface ChildCreationPlacement {
  groups: Array<{ deployment: number; sidecarBase?: number; placed?: PlacedConstructorCalls }>;
  surplus: bigint;
}

/**
 * The shared side-cars (salt 0, A14 item 6) of one `create`, in the order its side-car group reads them: by the offset
 * of its side-car slots. A keccak side-car hashes up to three of `create`'s preimage arguments; an ecrecover group is
 * A, M and B, whose M a wallet coin fills for a 2-way recovery (`undefined`). Coins in `spent` are skipped, and the ones
 * taken are added to it.
 */
async function sharedCreateSidecars(options: {
  deployer: DeployerAbi;
  args: Readonly<Record<string, FunctionArgument>>;
  provider: NetworkProvider;
  spent: Set<string>;
  who: string;
}): Promise<SidecarStep[]> {
  const { deployer, args, provider, spent, who } = options;
  const create = deployer.abi.find((entry) => entry.name === 'create');
  const slots = [...(create?.blockLayout?.slots ?? [])]
    .filter((slot) => slot.kind === 'keccakSideCar' || slot.kind === 'ecrecoverSideCar')
    .sort((left, right) => left.offset - right.offset);
  if (slots.length === 0) return [];
  const refuse = (what: string): never => {
    throw new DeployerPrepError(`${who} cannot co-spend its side-cars: ${what}`);
  };
  const keccakCount = slots.filter((slot) => slot.kind === 'keccakSideCar').length;
  const keccak: SidecarStep[] = [];
  if (keccakCount > 0) {
    const { keccakComputeLockingBytecode } = await import('@solidcash/utils');
    const { buildKeccakComputeSidecar } = await import('../keccak/keccakComputeSidecar.js');
    const salt = new Uint8Array(32);
    const lock = keccakComputeLockingBytecode(salt, true);
    const pool = (await provider.getUtxosForLockingBytecode(lock))
      .filter((utxo) => utxo.token?.nft?.capability === 'mutable' && !spent.has(coinKey(utxo)));
    const preimages = (create?.keccakPreimageParams ?? []).map((name) => {
      const value = name === null ? undefined : args[name];
      return value instanceof Uint8Array ? value : refuse('it hashes a value that is not one of its byte arguments');
    });
    for (let batch = 0; batch < keccakCount; batch += 1) {
      const coin = pool.shift();
      if (coin === undefined) throw new DeployerSidecarError('keccak', who);
      spent.add(coinKey(coin));
      const sidecar = buildKeccakComputeSidecar(preimages.slice(batch * 3, batch * 3 + 3), salt, coin, true);
      keccak.push({ utxo: coin, unlocker: sidecar.unlocker, recreate: sidecar.recreate });
    }
  }
  const ecrecover = await sharedEcrecoverSteps({
    calls: (create?.ecrecoverArgParams ?? []).map((names) => names.map((name) => (name === null ? undefined : args[name])) as
      unknown as readonly [unknown, unknown, unknown, unknown]),
    provider, spent, refuse, who,
  });
  return slots.map((slot) => (slot.kind === 'keccakSideCar' ? keccak : ecrecover)[slot.slotIndex ?? 0]);
}

/**
 * A14 item 4 step 6: the side-car pairs and callee blocks of the children a creating call creates, after every index the
 * creator's layout uses, in run order: each child's side-cars from the shared pool, at the base its `create` names,
 * then its callee blocks with their carriers and lanes. Each group starts at a paired index, which wallet coins from
 * `filler` or `OP_1` filler outputs make.
 *
 * One master runs one arm, so two call slots that name one contract, of one child or of two, cannot both be answered,
 * nor can a callee whose master the creation already spends (the creator's own, or another input it lays out); either
 * is refused with `DeployerCalleeError` before anything is placed. `surplus` is what the added inputs hold beyond the
 * added outputs, less the fee their bytes need at 1 sat/B.
 */
export async function placeChildCreationGroups(options: {
  builder: import('../TransactionBuilder.js').TransactionBuilder;
  provider: NetworkProvider;
  children: readonly ChildCreationGroup[];
  filler: () => Promise<{ utxo: Utxo; unlocker: Unlocker }>;
}): Promise<ChildCreationPlacement> {
  const { builder, provider, filler } = options;
  const lockOf = (input: { unlocker: Unlocker }): string => binToHex(input.unlocker.generateLockingBytecode());
  const taken = new Map<string, string>(builder.inputs.map((input) => [lockOf(input as never), 'the creation\'s own layout']));
  const resolved = options.children.map((child) => {
    const calls = child.deployer.callSlots === 0 ? [] : resolveConstructorCalls({
      artifact: child.artifact, deployer: child.deployer, callees: child.callees, args: child.args,
    });
    for (const call of calls) {
      const lock = binToHex(addressToLockScript(call.callee.contract.address));
      const here = `call slot ${call.slot} of deployment ${child.deployment} ('${child.contractName}')`;
      const earlier = taken.get(lock);
      if (earlier !== undefined) {
        throw new DeployerCalleeError(call.callee.contract.inner.artifact.contractName, call.functionName,
          `${here} calls it, and its master is already an input of ${earlier}; one master runs one arm, so one `
          + 'creation answers one call of a contract: create these children in separate calls');
      }
      taken.set(lock, here);
    }
    return { child, calls };
  });
  const spent = new Set<string>();
  const planned = [];
  for (const { child, calls } of resolved) {
    const who = `deployment ${child.deployment} ('${child.contractName}')`;
    const sidecars = await sharedCreateSidecars({ deployer: child.deployer, args: child.args, provider, spent, who });
    const blocks: ConstructorCalleeBlock[] = [];
    for (const call of calls) blocks.push(await planConstructorCalleeBlock(call, child.childLockingBytecode, { spent }));
    planned.push({ child, sidecars, blocks });
  }
  const firstInput = builder.inputs.length;
  const firstOutput = builder.outputs.length;
  const pair = async (): Promise<void> => {
    while (builder.inputs.length < builder.outputs.length) {
      const coin = await filler();
      builder.addInput(coin.utxo, coin.unlocker);
    }
    while (builder.outputs.length < builder.inputs.length) builder.addOutput(plainFiller());
  };
  const groups: Array<{ deployment: number; sidecarBase?: number; placed?: PlacedConstructorCalls }> = [];
  for (const { child, sidecars, blocks } of planned) {
    const group: { deployment: number; sidecarBase?: number; placed?: PlacedConstructorCalls } = {
      deployment: child.deployment,
    };
    if (sidecars.length > 0) {
      await pair();
      group.sidecarBase = builder.inputs.length;
      for (const step of sidecars) {
        if (step === undefined) {
          const coin = await filler();
          builder.addInput(coin.utxo, coin.unlocker);
          builder.addOutput(plainFiller());
        } else {
          builder.addInput(step.utxo, step.unlocker);
          builder.addOutput(step.recreate);
        }
      }
    }
    if (blocks.length > 0) {
      await pair();
      group.placed = await placeConstructorCalls({ builder, blocks, filler });
    }
    groups.push(group);
  }
  const added = builder.inputs.slice(firstInput).reduce((sum, input) => sum + input.satoshis, 0n);
  const made = builder.outputs.slice(firstOutput).reduce((sum, output) => sum + output.amount, 0n);
  // Each callee master carries its redeem script, and each side-car its covenant of up to about 7.4 KB with its
  // preimages; every other added input carries a covenant of a few hundred bytes.
  const sidecarBytes = planned.reduce((sum, { sidecars }) => sum
    + 8_000 * sidecars.filter((step) => step !== undefined).length, 0);
  const bytes = planned.reduce((sum, { blocks }) => sum + blocks.reduce((total, block) => total
    + block.contract.bytesize + 600 + (block.extraBytes ?? 0), 0), 0) + sidecarBytes
    + 400 * (builder.inputs.length - firstInput) + 200 * (builder.outputs.length - firstOutput);
  return { groups, surplus: added - made - BigInt(bytes) };
}

/**
 * What a run's output checks expect, by output index: `<expected> <index> opcode [OP_REVERSEBYTES] OP_(NUM)EQUALVERIFY`,
 * the expected operand as the run pushed it. Of two checks of one index the first counts; a step on a branch the run
 * did not take does not.
 */
function outputChecks(trace: readonly AuthenticationProgramStateCommon[], opcode: number): Map<number, Uint8Array> {
  const found = new Map<number, Uint8Array>();
  for (const state of trace) {
    const instructions = state.instructions as readonly { opcode: number }[];
    if (instructions[state.ip]?.opcode !== opcode || state.controlStack.some((flag) => flag === false)) continue;
    let next = state.ip + 1;
    if (instructions[next]?.opcode === Op.OP_REVERSEBYTES) next += 1;
    const verify = instructions[next]?.opcode;
    if ((verify !== Op.OP_EQUALVERIFY && verify !== Op.OP_NUMEQUALVERIFY) || state.stack.length < 2) continue;
    let index: number;
    try {
      index = Number(decodeScriptNumber(state.stack[state.stack.length - 1]!));
    } catch {
      continue;
    }
    if (!found.has(index)) found.set(index, Uint8Array.from(state.stack[state.stack.length - 2]!));
  }
  return found;
}

/**
 * Complete one callee's run in the finished creation (A14 item 5). The run stops at its first unmet check, and the
 * check names what its output holds: an NFT commitment, a transfer's lock and value, a token transfer's lock, units
 * and category. Each round patches what it learns, recreates the callee's containers from the transfers its run made,
 * and runs again until the input passes. `pinned` are the absolute indexes outside the block whose commitment the run
 * pins: the record carrier and the relinked predecessors. A round that learns nothing fails with the run's VM error.
 */
function settleCalleeRun(options: {
  provider: NetworkProvider;
  build: () => { transaction: Transaction; sourceOutputs: Transaction['outputs'] };
  master: number;
  block: ConstructorCalleeBlock;
  outputs: Output[];
  pinned: readonly number[];
  /** Each lane's absolute output index, by its `PredOut` witness. */
  lanes: ReadonlyMap<string, number>;
  /** Rebuild the callee's frame after its witnesses changed. */
  reframe: () => void;
  subject: string;
  /** The callee in words, for a locktime need. */
  who: string;
  hooks: CalleeSettleHooks;
}): void {
  const { master, block, outputs } = options;
  const vm = createVirtualMachineBch2026ForProvider(options.provider);
  const lockHex = (to: string | Uint8Array): string => (typeof to === 'string' ? to : binToHex(to));
  // A call record names its reader's input, so the records of the calls the callee's block makes moved with the block:
  // each master of another category in the block pins its records (an `OP_TRUE` carrier of its category) from its own
  // run there.
  const nestedMasters = block.inputs.flatMap((input, offset) => {
    const token = input?.utxo.token;
    return offset > 0 && token?.nft?.capability === 'minting' && token.category !== block.categoryId
      ? [{ inputIndex: master + offset, category: token.category }] : [];
  });
  const pinNestedRecords = (transaction: Transaction, sourceOutputs: Transaction['outputs']): boolean => {
    let pinned = false;
    for (const { inputIndex, category } of nestedMasters) {
      const trace = evaluateFaithfulOrDebugTrace(options.provider, { transaction, sourceOutputs, inputIndex } as never);
      const expected = extractCommitmentMapFromTrace(trace, { min: 0, max: transaction.outputs.length }, true);
      for (const [index, commitment] of expected) {
        const output = outputs[index];
        const nft = output?.token?.nft;
        if (output === undefined || nft === undefined || nft.capability !== 'none' || output.token?.category !== category
          || lockHex(output.to) !== '51' || nft.commitment === commitment) continue;
        nft.commitment = commitment;
        pinned = true;
      }
    }
    return pinned;
  };
  for (let round = 0; round < 64; round += 1) {
    const { transaction, sourceOutputs } = options.build();
    if (pinNestedRecords(transaction, sourceOutputs)) continue;
    const trace = evaluateFaithfulOrDebugTrace(
      options.provider, { transaction, sourceOutputs, inputIndex: master } as never,
    );
    const final = trace[trace.length - 1];
    // A5: the callee's `tx.time` checks join the creation's one locktime, which the caller may move.
    const moved = options.hooks.locktime?.(locktimeChecks(trace, master, options.who)) === true;
    if (!moved && final !== undefined && vm.stateSuccess(final as never) === true) return;
    const commitments = extractCommitmentMapFromTrace(trace, { min: 0, max: transaction.outputs.length }, true);
    const locks = outputChecks(trace, Op.OP_OUTPUTBYTECODE);
    const values = outputChecks(trace, Op.OP_OUTPUTVALUE);
    const units = outputChecks(trace, Op.OP_OUTPUTTOKENAMOUNT);
    const categories = outputChecks(trace, Op.OP_OUTPUTTOKENCATEGORY);
    let learned = moved;
    let amounts = false;
    const pin = (index: number): void => {
      const expected = commitments.get(index);
      const nft = outputs[index]?.token?.nft;
      if (expected === undefined || nft === undefined || nft.commitment === expected) return;
      nft.commitment = expected;
      learned = true;
    };
    for (const [offset, rule] of block.rules) {
      const index = master + offset;
      const have = outputs[index]!;
      if (rule.kind === 'commitment') {
        pin(index);
      } else if (rule.kind === 'optional') {
        const expected = commitments.get(index);
        if (expected === undefined) continue;
        if (have.token?.nft === undefined) {
          // The emit ran: its NFT replaces the filler.
          outputs[index] = rule.make(expected);
          learned = true;
          amounts = true;
        } else pin(index);
      } else if (rule.kind === 'transfer') {
        const lock = locks.get(index);
        const value = values.get(index);
        if (lock === undefined && value === undefined) continue;
        const next: Output = {
          to: lock ?? have.to, amount: value === undefined ? have.amount : decodeScriptNumber(value),
        };
        if (rule.active && lockHex(next.to) === lockHex(have.to) && next.amount === have.amount) continue;
        rule.active = true;
        outputs[index] = next;
        learned = true;
        amounts = true;
      } else if (rule.kind === 'tokenTransfer') {
        const lock = locks.get(index);
        const amount = units.get(index);
        const category = categories.get(index);
        if (lock === undefined && amount === undefined && category === undefined) continue;
        // The check compares the category as the call's argument holds it, in display order.
        const tokenCategory = category === undefined ? have.token?.category ?? rule.category : binToHex(category);
        const next: Output = {
          to: lock ?? have.to, amount: RESERVE,
          ...(tokenCategory === undefined ? {} : {
            token: {
              category: tokenCategory,
              amount: amount === undefined ? have.token?.amount ?? 0n : decodeScriptNumber(amount),
            },
          }),
        };
        if (rule.active && lockHex(next.to) === lockHex(have.to) && next.token?.category === have.token?.category
          && next.token?.amount === have.token?.amount) continue;
        rule.active = true;
        outputs[index] = next;
        learned = true;
        amounts = true;
      }
    }
    // A guarded insert whose run keeps the node its slot spends did not run: it takes PredOut -2 and its lane, which
    // relinked that node, holds no token (the ordinary call's `dropSkippedConditionalInserts`).
    for (const [offset, guarded] of block.guardedInserts) {
      const kept = sourceOutputs[master + offset]?.token?.nft?.commitment;
      const expected = commitments.get(master + offset);
      const lane = options.lanes.get(guarded.witness);
      if (kept === undefined || expected !== binToHex(kept) || block.witnesses[guarded.witness] === -2n) continue;
      block.witnesses[guarded.witness] = -2n;
      block.witnesses.__internal__vmapBatchTrailingCount = BigInt(new Set(Object.entries(block.witnesses)
        .filter(([name, value]) => /^__internal__vmapBatchPredOut_\d+$/.test(name) && typeof value === 'bigint'
          && value >= 0n).map(([, value]) => value)).size);
      if (lane !== undefined) outputs[lane] = plainFiller();
      options.reframe();
      learned = true;
      amounts = true;
    }
    for (const index of options.pinned) pin(index);
    if (recreateCalleeContainers(block, outputs, master)) {
      learned = true;
      amounts = true;
    }
    if (amounts) options.hooks.amountsChanged?.();
    if (!learned) {
      throw new DeployerPrepError(
        `${options.subject} fails its own run at instruction ${final?.ip}/${final?.instructions.length}: `
        + `${final?.error ?? 'the run did not end true'}`,
      );
    }
  }
  throw new DeployerPrepError(`${options.subject} did not complete after 64 runs`);
}

export class DeployerSidecarError extends Error {
  /** `who` names the input the side-car serves: the deployer, or a callee of its constructor. */
  constructor(kind: 'keccak' | 'ecrecover', who = 'the deployer') {
    super(`No shared ${kind} sidecar coin was found for ${who}; the shared pool (salt 0) must already exist`);
    this.name = 'DeployerSidecarError';
  }
}

/** What one input of a transaction requires of its locktime: a height or a time, at least `value` (A5). */
export interface LocktimeNeed {
  inputIndex: number;
  /** The input, in words: the contract and the source read or check that constrains the locktime. */
  who: string;
  kind: 'height' | 'time';
  value: number;
}

/** A5, A14 item 7: two inputs constrain the one locktime to different kinds, a height and a time. */
export class DeployerLocktimeConflictError extends Error {
  constructor(readonly first: LocktimeNeed, readonly second: LocktimeNeed) {
    super(`Input ${first.inputIndex} (${first.who}) needs a ${first.kind} locktime of at least ${first.value}, and input `
      + `${second.inputIndex} (${second.who}) needs a ${second.kind} locktime of at least ${second.value}; a transaction `
      + 'has one locktime, and no value is both a height and a time');
    this.name = 'DeployerLocktimeConflictError';
  }
}

/** A locktime of 500,000,000 or more is a time; below it, a height. */
const TIME_LOCKTIME = 500_000_000;

/**
 * The `tx.time` checks a run reaches, as needs of input `inputIndex` (A5): each `OP_CHECKLOCKTIMEVERIFY` on a branch the
 * run took needs at least its operand, of its operand's kind. `who` names the input.
 */
export function locktimeChecks(
  trace: readonly AuthenticationProgramStateCommon[], inputIndex: number, who: string,
): LocktimeNeed[] {
  const needs = new Map<number, LocktimeNeed>();
  for (const state of trace) {
    if (state.instructions[state.ip]?.opcode !== Op.OP_CHECKLOCKTIMEVERIFY) continue;
    if (state.controlStack.some((flag) => flag === false)) continue;
    const operand = state.stack[state.stack.length - 1];
    if (operand === undefined) continue;
    let value: number;
    try {
      value = Number(decodeScriptNumber(operand));
    } catch {
      continue;
    }
    if (!Number.isSafeInteger(value) || value < 0 || needs.has(value)) continue;
    needs.set(value, {
      inputIndex, who: `${who}, which checks tx.time >= ${value}`,
      kind: value < TIME_LOCKTIME ? 'height' : 'time', value,
    });
  }
  return [...needs.values()];
}

/**
 * A creation's locktime, kept as its needs arrive (A5, A14 item 7): `preferred` while only `fixed` needs constrain it,
 * else the lowest value that satisfies every need. `add` takes the needs a run shows and returns the locktime they
 * settle, throwing `DeployerLocktimeConflictError` when one input needs a height and another a time.
 */
export function locktimeLedger(fixed: readonly LocktimeNeed[], preferred: number | undefined): {
  needs: LocktimeNeed[];
  locktime: number | undefined;
  add(found: readonly LocktimeNeed[]): number | undefined;
} {
  lowestCommonLocktime(fixed);
  const ledger = {
    needs: [...fixed],
    locktime: preferred,
    add(found: readonly LocktimeNeed[]): number | undefined {
      const fresh = found.filter((need) => !ledger.needs.some((known) => known.inputIndex === need.inputIndex
        && known.kind === need.kind && known.value === need.value));
      if (fresh.length === 0) return ledger.locktime;
      ledger.needs.push(...fresh);
      ledger.locktime = lowestCommonLocktime(ledger.needs);
      return ledger.locktime;
    },
  };
  return ledger;
}

/** The lowest locktime that meets every need: the largest lower bound, when all are of one kind (A5). */
export function lowestCommonLocktime(needs: readonly LocktimeNeed[]): number | undefined {
  const first = needs[0];
  if (first === undefined) return undefined;
  const other = needs.find((need) => need.kind !== first.kind);
  if (other !== undefined) throw new DeployerLocktimeConflictError(first, other);
  return Math.max(...needs.map((need) => need.value));
}

/** One deployment a prep chain creates. */
export interface DeployerChild {
  deployer: DeployerAbi;
  contractName: string;
  /** What output 1 of this prep holds. Defaults to what the child's creation needs. */
  authorValue?: bigint;
}

export interface BuildDeployerPrepsOptions {
  children: readonly DeployerChild[];
  fundingUtxos: readonly Utxo[];
  authorSigner: Unlocker;
  authorLockingBytecode: Uint8Array;
  changeLockingBytecode: Uint8Array;
  provider: NetworkProvider;
  /** A creating call may bind an author coin at the same non-P2PKH lock that funds it. */
  allowAnyAuthorLock?: boolean;
}

/** One signed prep, and the coins its creation and its chain successor spend. */
export interface DeployerPrep {
  contractName: string;
  /** The prep's txid: the child's category, in display order. */
  category: string;
  transactionHex: string;
  /** (category, 0): V_DEPLOY(C) at DEPLOY(C). */
  deployerCoin: Utxo;
  /** (category, 1): the author coin; the creation spends it. */
  authorCoin: Utxo;
  /** (category, 2): the coin the next prep of the chain spends. */
  changeCoin?: Utxo;
  broadcast: boolean;
}

const RESERVE = 1200n;
const DUST = 600n;

/** The fee a creation carries when its caller states none: Deploy<C>'s unlocking dominates the transaction size. */
export function defaultDeployerFee(deployer: DeployerAbi): bigint {
  // Each constructor side-car rides its own input whose unlocking is one or two 9,950-byte pads; the creation's
  // fee must cover those bytes at 1 sat/B.
  const sidecarBytes = deployer.sidecars.keccak * 4_000 + deployer.sidecars.ecrecover * 20_000;
  return BigInt(Math.max(1000, 1500 + hexToBin(deployer.bytecode).length
    + 200 * deployer.genesisOutputs + sidecarBytes));
}

/** What output 1 of a prep needs: RESERVE per genesis output, the identity output, and a create fee allowance. */
export function defaultAuthorValue(deployer: DeployerAbi): bigint {
  const nfts = BigInt(Math.max(1, deployer.genesisOutputs)) + 1n;
  return RESERVE * (nfts + 1n) + estimateCreationBytes(deployer);
}

/**
 * An upper estimate of a creation's size in bytes at top level: the deployer input carries Deploy<C>'s redeem and
 * C's code, the author input is P2PKH, and each output is at most a P2SH32 lock with an NFT of 128 bytes. The fee
 * at 1 sat/B is at most this many satoshis, so an author coin sized with it pays a creation of any code size.
 */
export function estimateCreationBytes(deployer: DeployerAbi): bigint {
  const redeem = deployer.bytecode.length / 2;
  const code = deployer.code.length / 2;
  const unlocking = redeem + code + 600;
  const outputs = Math.max(1, deployer.genesisOutputs) + 3;
  return BigInt(10 + 41 + 5 + unlocking + 148 + outputs * (9 + 36 + 34 + 130));
}

function assertSpendableFunding(utxos: readonly Utxo[], signer: Unlocker, allowAnyAuthorLock = false): void {
  const signerLock = binToHex(signer.generateLockingBytecode());
  if (utxos.length === 0) throw new DeployerPrepError('A deployer prep needs at least one funding UTXO');
  for (const utxo of utxos) {
    if (utxo.token !== undefined) {
      throw new DeployerPrepError(`Deployer prep funding coin ${utxo.txid}:${utxo.vout} carries a token`);
    }
    if (isReservedGenesisOutpoint(genesisOutpointKey(utxo.txid, utxo.vout))) {
      throw new DeployerPrepError(`Deployer prep funding coin ${utxo.txid}:${utxo.vout} is already reserved`);
    }
    if (utxo.lockingBytecode !== undefined && binToHex(utxo.lockingBytecode) !== signerLock) {
      throw new DeployerPrepError(
        `Deployer prep funding coin ${utxo.txid}:${utxo.vout} is not locked by the author signer's P2PKH lock`,
      );
    }
  }
  if (!allowAnyAuthorLock && !isP2pkhLock(signer.generateLockingBytecode())) {
    throw new DeployerPrepError('A deployer prep spends only P2PKH coins');
  }
}

/**
 * Build the chain of A10: prep 1 spends `fundingUtxos`, each later prep spends the previous prep's change, and the
 * last change goes to `changeLockingBytecode`. Every prep is signed and none is broadcast.
 */
export async function buildDeployerPreps(
  options: BuildDeployerPrepsOptions,
): Promise<{ transactions: string[]; preps: DeployerPrep[] }> {
  const { TransactionBuilder } = await import('../TransactionBuilder.js');
  const { children, provider, authorSigner, authorLockingBytecode, changeLockingBytecode } = options;
  if (children.length === 0) throw new DeployerPrepError('A prep chain needs at least one child');
  if (options.fundingUtxos.length === 0) {
    throw new DeployerPrepError('A prep chain needs at least one funding UTXO for its first prep');
  }
  assertSpendableFunding(options.fundingUtxos, authorSigner, options.allowAnyAuthorLock === true);
  for (const child of children) {
    if (!/^[0-9a-fA-F]{70}$/.test(child.deployer.lockingBytecode)) {
      throw new DeployerPrepError(`The deployer of '${child.contractName}' has no P2SH32 locking bytecode`);
    }
    // A deployer coin is spent only to give birth to C, so no prep locks one for a C whose code no input could spend.
    assertSpendableCode(child.contractName, child.deployer.code.length / 2, provider);
  }

  const transactions: string[] = [];
  const preps: DeployerPrep[] = [];
  let inputs: Utxo[] = [...options.fundingUtxos];
  let inputSigner = authorSigner;
  for (const [index, child] of children.entries()) {
    const deployerValue = BigInt(child.deployer.coinValue);
    if (deployerValue < DUST) {
      throw new DeployerPrepError(`The deployer coin of '${child.contractName}' is below the dust limit`);
    }
    const authorValue = child.authorValue ?? defaultAuthorValue(child.deployer);
    if (authorValue < DUST) {
      throw new DeployerPrepError(`The author coin of '${child.contractName}' is below the dust limit`);
    }
    const builder = new TransactionBuilder({ provider });
    builder.addInputs(inputs, inputSigner);
    builder.addOutput({
      to: hexToBin(child.deployer.lockingBytecode),
      amount: deployerValue,
    });
    builder.addOutput({ to: authorLockingBytecode, amount: authorValue });
    const last = index === children.length - 1;
    const outputsBeforeChange = builder.outputs.length;
    builder.addBchChangeOutputIfNeeded({
      to: last ? changeLockingBytecode : authorLockingBytecode,
      feeRate: 1,
    });
    const changeIndex = builder.outputs.length > outputsBeforeChange ? outputsBeforeChange : -1;
    if (!last && changeIndex < 0) {
      throw new DeployerPrepError(
        `The funding coins for '${child.contractName}' leave no change, so the next prep has nothing to spend`,
      );
    }
    // A wallet the SDK holds no key for signs its inputs here: the prep's txid is the child's category, which the
    // creation spends and the child's code names, so nothing can be built on a prep before its signature is final.
    // The placeholder had the signature's size, so the fee the builder set stands.
    const transaction = await applyExternalSignatures(
      builder.inputs.map((input) => input.unlocker),
      decodeTransactionUnsafe(hexToBin(builder.build())),
      generateLibauthSourceOutputs(builder.inputs),
    );
    const transactionHex = binToHex(encodeTransaction(transaction));
    const txid = binToHex(hashTransactionUiOrder(encodeTransaction(transaction)));
    const deployerCoin: Utxo = {
      txid, vout: 0, satoshis: deployerValue, lockingBytecode: hexToBin(child.deployer.lockingBytecode),
    };
    const authorCoin: Utxo = { txid, vout: 1, satoshis: authorValue, lockingBytecode: authorLockingBytecode };
    const change = changeIndex < 0 ? undefined : builder.outputs[changeIndex];
    const changeCoin: Utxo | undefined = change === undefined ? undefined : {
      txid, vout: changeIndex, satoshis: change.amount,
      lockingBytecode: last ? changeLockingBytecode : authorLockingBytecode,
    };
    const prep: DeployerPrep = {
      contractName: child.contractName,
      category: txid,
      transactionHex,
      deployerCoin,
      authorCoin,
      ...(changeCoin === undefined ? {} : { changeCoin }),
      broadcast: false,
    };
    transactions.push(transactionHex);
    preps.push(prep);
    if (index === 0) {
      for (const input of inputs) reserveGenesisOutpoint(genesisOutpointKey(input.txid, input.vout));
    }
    reserveGenesisOutpoint(genesisOutpointKey(authorCoin.txid, authorCoin.vout));
    if (changeCoin !== undefined) reserveGenesisOutpoint(genesisOutpointKey(changeCoin.txid, changeCoin.vout));
    if (changeCoin === undefined) continue;
    inputs = [changeCoin];
    inputSigner = authorSigner;
  }
  return { transactions, preps };
}

/** One child is `buildDeployerPreps` with one entry. */
export async function buildDeployerPrep(
  options: BuildDeployerPrepsOptions,
): Promise<{ transaction: string; prep: DeployerPrep }> {
  if (options.children.length !== 1) {
    throw new DeployerPrepError('buildDeployerPrep takes exactly one child; use buildDeployerPreps for a chain');
  }
  const { transactions, preps } = await buildDeployerPreps(options);
  return { transaction: transactions[0], prep: preps[0] };
}

/**
 * Send a prep chain in order, releasing each prep's input reservations as its transaction is broadcast. A deployment
 * or a creating call handed preps that were already broadcast sends nothing more.
 */
export async function broadcastDeployerPreps(
  preps: DeployerPrep[], provider: NetworkProvider,
): Promise<DeployerPrep[]> {
  for (const prep of preps) {
    if (prep.broadcast) continue;
    await provider.sendRawTransaction(prep.transactionHex);
    const transaction = decodeTransactionUnsafe(hexToBin(prep.transactionHex));
    for (const input of transaction.inputs) {
      releaseGenesisOutpoint(genesisOutpointKey(binToHex(input.outpointTransactionHash), input.outpointIndex));
    }
    prep.broadcast = true;
  }
  return preps;
}

/**
 * Release every reservation a prep chain made: its funding inputs, its author coins and its change coins. A
 * creation that fails before anything is broadcast leaves the wallet's coins as they were.
 */
export function releaseDeployerPrepReservations(preps: readonly DeployerPrep[]): void {
  for (const prep of preps) {
    const transaction = decodeTransactionUnsafe(hexToBin(prep.transactionHex));
    for (const input of transaction.inputs) {
      releaseGenesisOutpoint(genesisOutpointKey(binToHex(input.outpointTransactionHash), input.outpointIndex));
    }
    releaseGenesisOutpoint(genesisOutpointKey(prep.authorCoin.txid, prep.authorCoin.vout));
    if (prep.changeCoin !== undefined) {
      releaseGenesisOutpoint(genesisOutpointKey(prep.changeCoin.txid, prep.changeCoin.vout));
    }
  }
}

/** Release the author reservations a broadcast creation consumed. */
export function releaseDeployerAuthorReservations(preps: readonly DeployerPrep[]): void {
  for (const prep of preps) {
    releaseGenesisOutpoint(genesisOutpointKey(prep.authorCoin.txid, prep.authorCoin.vout));
  }
}

/** A12's `create` parameters that the SDK fills from the deployer's own ABI. */
const CREATE_INTERNAL = new Set([
  '__internal__budgetPad', '__internal__oracleOwner', '__internal__authorIndex', '__internal__identity',
  '__internal__creatorInputIdx', '__internal__creatorList', '__internal__creatorListPos', '__internal__code',
  '__internal__deployValue', '__internal__msgSenderCategory', '__internal__genesisCallees',
]);

export interface DeployerCreatorValues {
  inputIndex: number;
  list: Uint8Array;
  listPos: number;
}

export interface BuildDeployerUnlockingOptions {
  deployer: DeployerAbi;
  /** One input index or undefined per call slot; undefined writes the `ff ff` placeholder. */
  callees?: readonly (number | undefined)[];
  /** Q ‖ A, laid out verbatim (a creating call reads it from the trace). */
  boundBytes?: Uint8Array;
  /** Values for the public contract and constructor parameters, by ABI input name. */
  args?: Record<string, FunctionArgument>;
  value?: bigint;
  senderCategory?: Uint8Array;
  authorIndex: number;
  identity?: boolean | bigint;
  creator?: DeployerCreatorValues;
  oracleOwner?: Uint8Array;
  budgetPad?: Uint8Array;
  /** Synthetic compiler parameters, by ABI input name. */
  synthetic?: Record<string, Uint8Array | bigint>;
  /** Refuse a placeholder callee: the chain is about to be broadcast. */
  forBroadcast?: boolean;
}

/** Encode the callee list: one unsigned 2-byte little-endian input index per call slot. */
export function encodeDeployerCallees(
  deployer: DeployerAbi, callees: readonly (number | undefined)[], forBroadcast = false,
): Uint8Array {
  if (callees.length !== deployer.callSlots) {
    throw new DeployerPrepError(
      `The callee list has ${callees.length} entries but '${deployer.abi.find((fn) => fn.name === 'create')?.inputs.length ?? 0}' `
        + `Deploy<C> has ${deployer.callSlots} call slots`,
    );
  }
  const list = new Uint8Array(deployer.callSlots * 2);
  callees.forEach((callee, slot) => {
    if (callee === undefined) {
      if (forBroadcast) {
        throw new DeployerPrepError(`Call slot ${slot} has no callee; a broadcast creation needs every slot bound`);
      }
      list[2 * slot] = 0xff;
      list[2 * slot + 1] = 0xff;
      return;
    }
    if (!Number.isInteger(callee) || callee < 0 || callee > 0xffff) {
      throw new DeployerPrepError(`Call slot ${slot} names input ${callee}, which is not an unsigned 16-bit index`);
    }
    list[2 * slot] = callee & 0xff;
    list[2 * slot + 1] = (callee >> 8) & 0xff;
  });
  return list;
}

function encodeBigInt(value: bigint): Uint8Array {
  return bigIntToVmNumber(value);
}

function encodedArgument(value: FunctionArgument, type: string, structs?: Artifact['structs']): Uint8Array {
  const encoded = encodeFunctionArgument(value, type, structs);
  if (!(encoded instanceof Uint8Array)) {
    throw new DeployerPrepError(`The deployer create argument of type '${type}' needs a concrete value, not a signature`);
  }
  return encoded;
}

/**
 * The unlocking of A4.2: selector, callee list, Q ‖ A, the code, the synthetic parameters, the sender/identity
 * parameters and the redeem script. Two readers find things here by position: the creator reads from byte 6 + 2s and
 * a callee reads the callee list at byte 5, so nothing else may move.
 */
export function buildDeployerUnlocking(options: BuildDeployerUnlockingOptions): Uint8Array {
  const { deployer } = options;
  const create = deployer.abi.find((fn) => fn.name === 'create');
  if (create === undefined) throw new DeployerPrepError(`Deployer '${deployer.lockingBytecode}' has no create arm`);
  if (create.selector === undefined) throw new DeployerPrepError('The deployer create arm has no selector');
  const callees = encodeDeployerCallees(deployer, options.callees ?? [], options.forBroadcast === true);
  const creator = options.creator ?? { inputIndex: 0, list: new Uint8Array(), listPos: 0 };
  const senderCategory = options.senderCategory ?? new Uint8Array(32);
  if (senderCategory.length !== 32) {
    throw new DeployerPrepError('__internal__msgSenderCategory must be 32 bytes');
  }
  const identity = options.identity === true ? 1n : options.identity === false ? 0n : options.identity ?? 0n;

  const values = new Map<string, Uint8Array>();
  values.set('__internal__budgetPad', options.budgetPad ?? new Uint8Array());
  if (options.oracleOwner !== undefined) values.set('__internal__oracleOwner', options.oracleOwner);
  values.set('__internal__authorIndex', encodeBigInt(BigInt(options.authorIndex)));
  values.set('__internal__identity', encodeBigInt(identity));
  values.set('__internal__creatorInputIdx', encodeBigInt(BigInt(creator.inputIndex)));
  values.set('__internal__creatorList', creator.list);
  values.set('__internal__creatorListPos', encodeBigInt(BigInt(creator.listPos)));
  values.set('__internal__code', hexToBin(deployer.code));
  values.set('__internal__deployValue', encodeBigInt(options.value ?? 0n));
  values.set('__internal__msgSenderCategory', senderCategory);
  values.set('__internal__genesisCallees', callees);
  for (const [name, value] of Object.entries(options.synthetic ?? {})) {
    values.set(name, value instanceof Uint8Array ? value : encodeBigInt(value));
  }

  // A constructor mapping write reaches the ordinary vmap batch path. At birth every entry is absent, so the
  // absent-entry witness is the slot-independent default: no predecessor, no next node, proof -1.
  for (const input of create.inputs) {
    if (!input.name.startsWith('__internal__vmapBatch')) continue;
    if (values.has(input.name)) continue;
    if (/^__internal__vmapBatchSlot_\d+$/.test(input.name)
      || /^__internal__vmapBatchNext_\d+$/.test(input.name)) values.set(input.name, new Uint8Array(32));
    else if (/^__internal__vmapBatchProof_\d+$/.test(input.name)) values.set(input.name, encodeBigInt(-1n));
    else if (/^__internal__vmapBatchPredOut_\d+$/.test(input.name)) values.set(input.name, encodeBigInt(-2n));
    else if (/^__internal__vmapBatchRank_\d+$/.test(input.name)) values.set(input.name, encodeBigInt(0n));
    else if (input.name.startsWith('__internal__vmapBatchRows_')) values.set(input.name, new Uint8Array());
    else if (input.name === '__internal__vmapBatchTrailingCount') values.set(input.name, encodeBigInt(0n));
  }

  const encoded: Uint8Array[] = [];
  for (const input of options.boundBytes === undefined ? create.inputs : []) {
    const known = values.get(input.name);
    if (known !== undefined) {
      encoded.push(known);
      continue;
    }
    if (input.name.startsWith('__internal__')) {
      throw new DeployerPrepError(`The deployer create input '${input.name}' has no value`);
    }
    const argument = options.args?.[input.name];
    if (argument === undefined) {
      throw new DeployerPrepError(`The deployer create input '${input.name}' has no value`);
    }
    encoded.push(encodedArgument(argument, input.type));
  }

  let unlocking: Uint8Array;
  if (options.boundBytes !== undefined) {
    // Q and A are already pushes in the creator's trace. The callee list stays first after the selector; the code,
    // then the synthetic and sender/identity parameters (in reverse ABI order), then the redeem follow verbatim.
    const synthetic: Uint8Array[] = [];
    const creatorValues: Uint8Array[] = [];
    for (const input of create.inputs) {
      if (!input.name.startsWith('__internal__')) continue;
      if (CREATE_INTERNAL.has(input.name)) continue;
      const value = values.get(input.name);
      if (value === undefined) throw new DeployerPrepError(`The deployer create input '${input.name}' has no value`);
      synthetic.push(value);
    }
    for (const name of ['__internal__creatorListPos', '__internal__creatorList', '__internal__creatorInputIdx']) {
      // A child whose constructor does not read msg.sender has no such input; pushing the defaults would leave
      // create's exact-stack check three items too deep.
      if (!create.inputs.some((input) => input.name === name)) continue;
      const value = values.get(name);
      if (value !== undefined) creatorValues.push(value);
    }
    const tail = [
      ...synthetic.reverse(),
      ...creatorValues,
      values.get('__internal__identity')!,
      values.get('__internal__authorIndex')!,
      ...(values.get('__internal__oracleOwner') === undefined ? [] : [values.get('__internal__oracleOwner')!]),
      values.get('__internal__budgetPad')!,
    ];
    unlocking = new Uint8Array([
      ...encodeDataPush(hexToBin(create.selector)), ...encodeDataPush(callees),
      ...options.boundBytes,
      ...encodeDataPush(hexToBin(deployer.code)),
      ...tail.flatMap((value) => [...encodeDataPush(value)]),
      ...encodeDataPush(hexToBin(deployer.bytecode)),
    ]);
  } else {
    unlocking = createUnlockingBytecode(
      'p2sh32', hexToBin(deployer.bytecode), encoded, hexToBin(create.selector),
    );
  }
  if (unlocking.length > 10_000) {
    throw new DeployerPrepError(`The create unlocking is ${unlocking.length} bytes, over the 10,000-byte limit`);
  }
  return unlocking;
}

/**
 * A14 item 5: a constructor may call only a record-sound contract, and the function must itself publish a call record.
 * The check names the option a caller has to compile the callee with.
 */
export function assertDeployerCallee(calleeName: string, callee: Artifact, functionName: string): void {
  const fn = callee.abi.find((entry) => entry.name === functionName);
  if (callee.recordSound !== true) {
    throw new DeployerCalleeError(
      calleeName, functionName,
      'the callee is not record-sound; compile it with genesisCalls and fix any arm that prevents it, '
        + "or with callRecords: 'all' for a function that returns nothing",
    );
  }
  if (fn === undefined) {
    throw new DeployerCalleeError(calleeName, functionName, `'${calleeName}' has no function '${functionName}'`);
  }
  if (fn.callRecord !== true) {
    throw new DeployerCalleeError(
      calleeName, functionName,
      fn.outputs === undefined || fn.outputs.length === 0
        ? "the function returns nothing; compile the callee with callRecords: 'all'"
        : 'the function does not publish a call record',
    );
  }
  if (fn.inputs !== undefined && !fn.inputs.some((input) => input.name === '__internal__genesisCall')) {
    throw new DeployerCalleeError(
      calleeName, functionName,
      "the function does not take a genesis call; compile the callee with genesisCalls (the compiler's default)",
    );
  }
}

/** One input's local VM verdict. */
export interface DeployerInputRun {
  inputIndex: number;
  operationCost: bigint;
  hashDigestIterations?: bigint;
  operationBudget?: bigint;
}


/**
 * A14 item 6: the shared ecrecover side-car group for each constructor call, at salt 0, in slot order A/M/B, for the
 * state-derivation probe. Arguments the precompile refuses lay out as a call's do: a slot the constructor does not read
 * takes a neutral coin, which the probe, never sent, does not need on the network; an `r` no curve point has takes the
 * pool's A over the placeholder recovery, whose pad carries the proof; a key at infinity the group over the digest
 * shifted by -2^128 r mod n.
 */
export async function deployerEcrecoverGroups(options: {
  createFn: { ecrecoverArgParams?: readonly (readonly (string | null)[])[] };
  args: Record<string, FunctionArgument>;
  provider: NetworkProvider;
  count: number;
  /** Shared coins the creation already spends, which the groups do not take. */
  spent?: ReadonlySet<string>;
}): Promise<Array<Array<{ utxo: Utxo; unlocker: Unlocker; recreate: Output }>>> {
  const { createFn, args, provider, count } = options;
  const calls = createFn.ecrecoverArgParams ?? [];
  if (calls.length < count) {
    throw new DeployerPrepError(
      `The deployer needs ${count} ecrecover side-car group(s), but its create names ${calls.length}`,
    );
  }
  const salt = new Uint8Array(32);
  const {
    ecrecoverComputeLockingBytecode, BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX,
  } = await import('@solidcash/utils');
  const { computeEcrecoverWitness, ecrecoverRefusal } = await import('../ecrecover/ecrecoverRecovery.js');
  const {
    buildEcrecoverComputeSidecars, buildEcrecoverComputeSidecars3, buildEcrecoverPlaceholderSidecars,
    probeEcrecoverSplit, probeEcrecoverSplit3,
  } = await import('../ecrecover/ecrecoverComputeSidecar.js');
  const locks = {
    A: ecrecoverComputeLockingBytecode(salt, 'A'),
    B: ecrecoverComputeLockingBytecode(salt, 'B2'),
    M: ecrecoverComputeLockingBytecode(salt, 'M'),
    B3: ecrecoverComputeLockingBytecode(salt, 'B3'),
  };
  const fetchPool = async (lock: Uint8Array): Promise<Utxo[]> => {
    const coins = (await provider.getUtxosForLockingBytecode(lock))
      .filter((utxo) => utxo.token?.nft?.capability === 'mutable' && options.spent?.has(coinKey(utxo)) !== true);
    if (coins.length < count) throw new DeployerSidecarError('ecrecover');
    return coins;
  };
  const [coinsA, coinsB, coinsM, coinsB3] = await Promise.all([
    fetchPool(locks.A), fetchPool(locks.B), fetchPool(locks.M), fetchPool(locks.B3),
  ]);
  const funderLock = hexToBin(BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX);
  const funderUnlocker: Unlocker = {
    generateLockingBytecode: (): Uint8Array => funderLock,
    generateUnlockingBytecode: (): Uint8Array => Uint8Array.of(0x01, 0x51),
  };
  const neutral = (index: number, slot: number): { utxo: Utxo; unlocker: Unlocker; recreate: Output } => ({
    utxo: { txid: (0xe100 + 3 * index + slot).toString(16).padStart(64, '0'), vout: 0, satoshis: 10_000n },
    unlocker: funderUnlocker, recreate: { to: funderLock, amount: 10_000n },
  });
  const groups: Array<Array<{ utxo: Utxo; unlocker: Unlocker; recreate: Output }>> = [];
  for (let index = 0; index < count; index += 1) {
    const [hashName, vName, rName, sName] = calls[index] ?? [];
    const hash = hashName === null || hashName === undefined ? undefined : args[hashName];
    const v = vName === null || vName === undefined ? undefined : args[vName];
    const r = rName === null || rName === undefined ? undefined : args[rName];
    const s = sName === null || sName === undefined ? undefined : args[sName];
    if (!(hash instanceof Uint8Array) || !(r instanceof Uint8Array) || !(s instanceof Uint8Array)
      || v === undefined) {
      throw new DeployerPrepError(
        'A constructor ecrecover needs its hash, v, r and s as byte/int arguments the SDK can resolve',
      );
    }
    const refusal = ecrecoverRefusal(hash, Number(v), r, s);
    if (refusal?.kind === 'unread') {
      groups.push([neutral(index, 0), neutral(index, 1), neutral(index, 2)]);
      continue;
    }
    if (refusal?.kind === 'offCurve') {
      const carrier = buildEcrecoverPlaceholderSidecars(salt, coinsA[index]!, coinsA[index]!, refusal.proof, 'B2');
      groups.push([
        { utxo: coinsA[index]!, unlocker: carrier.unlockerA, recreate: carrier.recreateA },
        neutral(index, 1), neutral(index, 2),
      ]);
      continue;
    }
    const witness = computeEcrecoverWitness(
      refusal?.kind === 'atInfinity' ? refusal.shiftedHash : hash, Number(v), r, s,
    );
    let chunkA: number;
    try {
      chunkA = probeEcrecoverSplit(witness, salt, coinsA[index]!, coinsB[index]!);
    } catch {
      const split = probeEcrecoverSplit3(witness, salt, coinsA[index]!, coinsM[index]!, coinsB3[index]!);
      const built = buildEcrecoverComputeSidecars3(
        witness, split.chunkA, split.chunkM, salt, coinsA[index]!, coinsM[index]!, coinsB3[index]!,
      );
      groups.push([
        { utxo: coinsA[index]!, unlocker: built.unlockerA, recreate: built.recreateA },
        { utxo: coinsM[index]!, unlocker: built.unlockerM, recreate: built.recreateM },
        { utxo: coinsB3[index]!, unlocker: built.unlockerB, recreate: built.recreateB },
      ]);
      continue;
    }
    const built = buildEcrecoverComputeSidecars(
      witness, chunkA, salt, coinsA[index]!, coinsB[index]!, undefined, 'B2',
    );
    const funder: Utxo = {
      txid: (0xe000 + index).toString(16).padStart(64, '0'), vout: 0, satoshis: 10_000n,
    };
    const writable = provider as unknown as {
      addUtxo?: (address: string, utxo: Utxo) => Promise<Utxo>;
      seedUtxo?: (address: string, utxo: Utxo) => Promise<Utxo>;
    };
    if (typeof writable.addUtxo === 'function') await writable.addUtxo(binToHex(funderLock), funder);
    else if (typeof writable.seedUtxo === 'function') await writable.seedUtxo(binToHex(funderLock), funder);
    groups.push([
      { utxo: coinsA[index]!, unlocker: built.unlockerA, recreate: built.recreateA },
      { utxo: funder, unlocker: funderUnlocker, recreate: { to: funderLock, amount: 10_000n } },
      { utxo: coinsB[index]!, unlocker: built.unlockerB, recreate: built.recreateB },
    ]);
  }
  return groups;
}

/**
 * A4.8: the `__internal__budgetPad` to try after a run that ran out of operation budget: twice as long, or as long as
 * the create unlocking, now `unlockingLength` bytes, can grow within its 10,000 bytes; undefined when it cannot grow.
 */
export function nextBudgetPad(pad: Uint8Array, unlockingLength: number): Uint8Array<ArrayBuffer> | undefined {
  const pushLength = (length: number): number => length + (length <= 75 ? 1 : length <= 255 ? 2 : 3);
  const room = 10_000 - (unlockingLength - pushLength(pad.length));
  let next = pad.length === 0 ? 1 : pad.length * 2;
  while (next > pad.length && pushLength(next) > room) next = Math.min(next - 1, room - 1);
  return next > pad.length ? new Uint8Array(next) : undefined;
}

/**
 * Run every input of a candidate transaction through the provider's VM (B9.3). Throws with the input index and the
 * VM error on the first failure; otherwise returns each input's operation cost, from which the caller sizes
 * `__internal__budgetPad`.
 */
export function runDeployerInputsLocal(
  provider: NetworkProvider,
  transaction: Transaction,
  sourceOutputs: Transaction['outputs'],
): DeployerInputRun[] {
  const vm = createVirtualMachineBch2026ForProvider(provider);
  const runs: DeployerInputRun[] = [];
  for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex++) {
    const state = vm.evaluate({ transaction, sourceOutputs, inputIndex }) as AuthenticationProgramStateCommon;
    if (vm.stateSuccess(state) !== true) {
      if ((globalThis as any).process?.env?.DEBUG_DEPLOYER_VM) {
        const insns = (state as any).instructions ?? [];
        const at = (state as any).ip ?? 0;
        console.error('DEPFAIL', inputIndex, (state as any).error, 'ip', at,
          insns.slice(Math.max(0, at - 8), at + 2).map((ins: any, k: number) => `${Math.max(0, at - 8) + k}:${(ins.opcode ?? 0).toString(16)}`).join(' '),
          'stack', ((state as any).stack ?? []).slice(-4).map((x: Uint8Array) => `${x.length}:${binToHex(x).slice(0, 16)}`).join('|'));
      }
      const error = state.error ?? 'the VM rejected the input';
      throw new DeployerPrepError(
        `Input ${inputIndex} failed the local run at instruction ${state.ip}/${state.instructions.length}: ${error}`,
      );
    }
    runs.push({
      inputIndex,
      operationCost: BigInt(state.metrics?.operationCost ?? 0),
      ...(state.metrics?.hashDigestIterations === undefined ? {} : {
        hashDigestIterations: BigInt(state.metrics.hashDigestIterations),
      }),
      ...(state.metrics?.maximumOperationCost === undefined ? {} : {
        operationBudget: BigInt(state.metrics.maximumOperationCost),
      }),
    });
  }
  return runs;
}
/** The outputs a `create` run fills in: commitments of records and events, locks and amounts of transfers. */
export interface CreateRunSlots {
  /** Absolute output indexes whose NFT commitment `create` computes. */
  commitments: readonly number[];
  /** Absolute output indexes of the constructor's satoshi transfers. */
  transfers: readonly number[];
  /** A4.4: each written collection's HEAD and entry rows, laid out from the journal the run holds. */
  journals?: readonly CreateRunJournal[];
}

/** A written collection's rows in a creation, and where `create`'s run holds its journal (A14 item 4 step 5). */
export interface CreateRunJournal {
  collection: string;
  /** The journal's depth from the bottom of `create`'s stack (`DeployerAbi.collectionRows[].journalDepth`). */
  depth: number;
  /** Absolute output index of the collection's HEAD. */
  head: number;
  /** Absolute output indexes of its entry rows, in order. */
  rows: readonly number[];
  /** The collection's entry lock for (M, X). */
  entryLock: string | Uint8Array;
  /** X, display order. */
  category: string;
}

/**
 * A journal's final contents: for each slot, the value of its last record, in increasing slot order (A4.4). A record
 * is a 32-byte slot, the value's size in two bytes, then the value. Undefined when the bytes are not a journal.
 */
export function journalFinalContents(
  bytes: Uint8Array | undefined,
): Array<{ slot: Uint8Array; value: Uint8Array }> | undefined {
  if (bytes === undefined) return undefined;
  const last = new Map<string, { slot: Uint8Array; value: Uint8Array }>();
  let at = 0;
  while (at < bytes.length) {
    if (at + 34 > bytes.length) return undefined;
    const slot = bytes.slice(at, at + 32);
    const size = bytes[at + 32]! | ((bytes[at + 33]! & 0x7f) << 8);
    if (size > 64 || at + 34 + size > bytes.length) return undefined;
    last.set(binToHex(slot), { slot, value: bytes.slice(at + 34, at + 34 + size) });
    at += 34 + size;
  }
  const asNumber = (slot: Uint8Array): bigint => slot.reduceRight((acc, byte) => (acc << 8n) | BigInt(byte), 0n);
  return [...last.values()].sort((left, right) => {
    const a = asNumber(left.slot);
    const b = asNumber(right.slot);
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

/**
 * A14 items 3 and 4: complete Deploy<C>'s own run as a fixed point. `create` stops at its first unmet pin, and the
 * trace of that run names the value the pin expects: a record's or an event's commitment, a transfer's lock and
 * amount. Each round patches what it learns, at the given indexes of the genesis range only, and runs again, until
 * the deployer input passes. A round that learns nothing fails with the run's VM error. `outputs` are the builder's
 * outputs, patched in place; `amountsChanged` lets the caller rebalance its change when a transfer's amount moves.
 */
export function completeCreateRun(options: {
  provider: NetworkProvider;
  build: () => { transaction: Transaction; sourceOutputs: Transaction['outputs'] };
  deployerInputIndex: number;
  outputs: import('../interfaces.js').Output[];
  range: { min: number; max: number };
  slots: CreateRunSlots;
  amountsChanged?: () => void;
}): void {
  const vm = createVirtualMachineBch2026ForProvider(options.provider);
  const lockHex = (to: string | Uint8Array): string => (typeof to === 'string' ? to : binToHex(to));
  for (let round = 0; round < 64; round += 1) {
    const { transaction, sourceOutputs } = options.build();
    const program = { transaction, sourceOutputs, inputIndex: options.deployerInputIndex };
    const trace = evaluateFaithfulOrDebugTrace(options.provider, program as never);
    const final = trace[trace.length - 1];
    if (final !== undefined && vm.stateSuccess(final as never) === true) return;
    if ((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.DEBUG_CREATE_RUN) {
      const at = final?.ip ?? 0;
      const ops = (final?.instructions ?? []).slice(Math.max(0, at - 14), at + 2)
        .map((instruction, offset) => `${Math.max(0, at - 14) + offset}:${instruction.opcode.toString(16)}`).join(' ');
      // eslint-disable-next-line no-console
      console.error('CREATE-RUN', round, final?.error, 'ip', at, ops, 'stack', (final?.stack ?? []).length,
        (final?.stack ?? []).slice(-6).map((item) => `${item.length}:${binToHex(item).slice(0, 80)}`).join(' | '),
        'journals', (options.slots.journals ?? []).map((journal) => `${journal.depth}=${binToHex(final?.stack[journal.depth] ?? new Uint8Array()).slice(0, 120)}`));
    }
    let learned = false;
    let amounts = false;
    const commitments = extractCommitmentMapFromTrace(trace, options.range, true);
    for (const index of options.slots.commitments) {
      const expected = commitments.get(index);
      const nft = options.outputs[index]?.token?.nft;
      if (expected === undefined || nft === undefined || nft.commitment === expected) continue;
      nft.commitment = expected;
      learned = true;
    }
    for (const index of options.slots.transfers) {
      const output = options.outputs[index];
      if (output === undefined) continue;
      const lock = extractVerifiedValuesFromTrace(trace, Op.OP_OUTPUTBYTECODE, { min: index, max: index + 1 },
        false, false, true)[0];
      if (lock !== undefined && lockHex(output.to) !== binToHex(lock)) {
        output.to = lock;
        learned = true;
      }
      const amount = extractVerifiedValuesFromTrace(trace, Op.OP_OUTPUTVALUE, { min: index, max: index + 1 },
        false, false, true)[0];
      if (amount !== undefined && decodeScriptNumber(amount) !== output.amount) {
        output.amount = decodeScriptNumber(amount);
        learned = true;
        amounts = true;
      }
    }
    // A4.4: the journals the run holds at its last state, which the constructor has finished writing once the run
    // reaches the epilogue. Each lays out its HEAD's link and its entry rows; the rows it does not fill hold no token.
    for (const journal of options.slots.journals ?? []) {
      const entries = journalFinalContents(final?.stack[journal.depth]);
      if (entries === undefined) continue;
      if (entries.length > journal.rows.length) {
        throw new DeployerPrepError(
          `The constructor writes ${entries.length} entries of '${journal.collection}', but its deployer has `
          + `${journal.rows.length} rows for them`,
        );
      }
      const zeros = (length: number): Uint8Array => new Uint8Array(length);
      const head = options.outputs[journal.head]?.token?.nft;
      const headCommitment = binToHex(new Uint8Array([...zeros(32), ...(entries[0]?.slot ?? zeros(32)), ...zeros(64)]));
      if (head !== undefined && head.commitment !== headCommitment) {
        head.commitment = headCommitment;
        learned = true;
      }
      let rowsLearned = false;
      let rowsAmounts = false;
      journal.rows.forEach((index, row) => {
        const entry = entries[row];
        const want: import('../interfaces.js').Output = entry === undefined
          ? { to: Uint8Array.of(0x51), amount: 1000n }
          : {
            to: journal.entryLock,
            amount: RESERVE,
            token: {
              category: journal.category, amount: 0n,
              nft: {
                capability: 'mutable',
                commitment: binToHex(new Uint8Array([
                  ...entry.slot, ...(entries[row + 1]?.slot ?? zeros(32)), ...entry.value,
                ])),
              },
            },
          };
        const have = options.outputs[index];
        const same = have !== undefined && lockHex(have.to) === lockHex(want.to) && have.amount === want.amount
          && (have.token?.nft?.commitment ?? '') === (want.token?.nft?.commitment ?? '')
          && (have.token === undefined) === (want.token === undefined);
        if (same) return;
        if (have === undefined || have.amount !== want.amount) rowsAmounts = true;
        options.outputs[index] = want;
        rowsLearned = true;
      });
      if (rowsAmounts) amounts = true;
      if (rowsLearned) learned = true;
    }
    if (amounts) options.amountsChanged?.();
    if (!learned) {
      throw new DeployerPrepError(
        `The creation's run of create, which runs the constructor, stops at instruction ${final?.ip}/`
        + `${final?.instructions.length} and names no output it expects: ${final?.error ?? 'the run did not end true'}`,
      );
    }
  }
  throw new DeployerPrepError('create did not complete after 64 runs');
}

/** True when output 0 of the category's prep transaction is locked to one of the given deployers (A14 item 8). */
export async function verifyBirth(
  provider: NetworkProvider, categoryId: string, deployers: Iterable<DeployerAbi>,
): Promise<boolean> {
  const expected = new Set([...deployers].map((deployer) => deployer.lockingBytecode.toLowerCase()));
  if (expected.size === 0) return false;
  let raw: string;
  try {
    raw = await provider.getRawTransaction(categoryId.toLowerCase());
  } catch {
    return false;
  }
  let transaction: Transaction;
  try {
    transaction = decodeTransactionUnsafe(hexToBin(raw));
  } catch {
    return false;
  }
  const output = transaction.outputs[0];
  return output !== undefined && expected.has(binToHex(output.lockingBytecode).toLowerCase());
}

export interface DeployerSweepCoin {
  utxo: Utxo;
  deployer: DeployerAbi;
}

export interface DeployerSweepResult {
  transactionHex: string;
  txid: string;
  fee: bigint;
}

/**
 * Build the sweep of A4.6: version 2, every input's sequence at 1,440, one tokenless output, 1 sat/B. The sweep
 * selector and the deployer's redeem script are the whole unlocking.
 */
export function buildDeployerSweep(options: {
  coins: readonly DeployerSweepCoin[];
  toLockingBytecode: Uint8Array;
  provider: NetworkProvider;
}): DeployerSweepResult {
  if (options.coins.length === 0) throw new DeployerPrepError('A deployer sweep needs at least one coin');
  const inputs = options.coins.map(({ utxo, deployer }) => {
    const sweep = deployer.abi.find((fn) => fn.name === 'sweep');
    if (sweep?.selector === undefined) throw new DeployerPrepError('The deployer has no sweep arm');
    return {
      outpointIndex: utxo.vout,
      outpointTransactionHash: hexToBin(utxo.txid),
      sequenceNumber: 1440,
      unlockingBytecode: new Uint8Array([
        ...encodeDataPush(hexToBin(sweep.selector)), ...encodeDataPush(hexToBin(deployer.bytecode)),
      ]),
    };
  });
  const total = options.coins.reduce((sum, coin) => sum + coin.utxo.satoshis, 0n);
  const build = (amount: bigint): Transaction => ({
    version: 2,
    locktime: 0,
    inputs,
    outputs: [{ lockingBytecode: options.toLockingBytecode, valueSatoshis: amount }],
  });
  let amount = total;
  let transaction = build(amount);
  let fee = total - amount;
  for (let iteration = 0; iteration < 4; iteration++) {
    fee = BigInt(encodeTransaction(transaction).byteLength);
    if (fee > total) throw new DeployerPrepError(`The deployer sweep needs ${fee} satoshis in fees but holds ${total}`);
    amount = total - fee;
    transaction = build(amount);
  }
  const bytes = encodeTransaction(transaction);
  return {
    transactionHex: binToHex(bytes),
    txid: binToHex(hashTransactionUiOrder(bytes)),
    fee,
  };
}

/** The bytes `encodeDataPush` spends on a push of `length` bytes. */
function padPushLength(length: number): number {
  return length + (length === 0 ? 1 : length <= 75 ? 1 : length <= 0xff ? 2 : 3);
}

/**
 * A4.2, A14 item 4 step 5: the longest `__internal__budgetPad` that keeps a `create` unlocking within 10,000 bytes,
 * given that unlocking's length with an empty pad.
 */
export function largestCreatePad(emptyPadUnlockingLength: number): number {
  const room = 10_000 - (emptyPadUnlockingLength - padPushLength(0));
  let length = Math.max(0, room - 3);
  while (length > 0 && padPushLength(length) > room) length -= 1;
  return length;
}

/**
 * A14 item 4 step 5: the pad a deployer input needs, from its run with `pad`: every unlocking byte grants operation
 * budget, so the pad keeps what the run spent beyond what the rest of the unlocking funds. Throws when the run with
 * `pad` fails, on its budget or otherwise.
 */
export function fitCreatePad(
  provider: NetworkProvider, program: { transaction: Transaction; sourceOutputs: Transaction['outputs'] },
  inputIndex: number, pad: Uint8Array,
): Uint8Array {
  const vm = createVirtualMachineBch2026ForProvider(provider);
  const state = vm.evaluate({ ...program, inputIndex } as never) as AuthenticationProgramStateCommon & {
    metrics?: { operationCost?: number; maximumOperationCost?: number; densityControlLength?: number };
  };
  if (vm.stateSuccess(state as never) !== true) {
    throw new DeployerPrepError(
      `The create of input ${inputIndex} needs more operations than a 10,000-byte unlocking funds: ${String(state.error)}`,
    );
  }
  const { operationCost, maximumOperationCost, densityControlLength } = state.metrics ?? {};
  if (operationCost === undefined || maximumOperationCost === undefined || densityControlLength === undefined) return pad;
  const perByte = maximumOperationCost / densityControlLength;
  const surplus = densityControlLength - Math.ceil(operationCost / perByte);
  // A shorter push may drop its length bytes too: keep three of the surplus.
  return new Uint8Array(Math.max(0, pad.length - surplus + 3));
}

/** One run of a deployer `new` site (A6 step 3) in a creator's trace. */
export interface DeployerSiteVisit {
  /** The index, in the trace, of the state before the site's OP_INPUTBYTECODE. */
  step: number;
  /** d_in: the input whose unlocking the site binds. */
  inputIndex: number;
  /** Q ‖ A as the creator built it: the one stack item under d_in. */
  bound: Uint8Array;
  /** DEPLOY(C), hex, which the site requires at d_in: its constant pushed inline or by an invoked definition. */
  deployerLock?: string;
  /** The instructions the site runs in, and the positions of its OP_INPUTBYTECODE and of its last check (X ‖ 02). */
  instructions: readonly { opcode: number; data?: Uint8Array }[];
  firstIp: number;
  /** -1 when the X ‖ 02 comparison is not found in the site's instructions. */
  lastIp: number;
}

/** `04 ‖ SELECTOR_CREATE`, the first five bytes of every `create` unlocking (A4.2). */
const CREATE_PREFIX = [0x04, 0xaf, 0x34, 0x14, 0x13];

/**
 * Every run of a deployer `new` site in a creator's trace, in run order (A14 item 4 step 2). A site emits
 * `<Q ‖ A> <d_in> OP_INPUTBYTECODE` and then `<6> OP_SPLIT OP_SWAP <04 ‖ SELECTOR_CREATE ‖ 2s> OP_EQUALVERIFY` (A6 steps
 * 3 and 4), so Q ‖ A is the one item under d_in at that step. The site then compares `OP_UTXOBYTECODE` of d_in with
 * DEPLOY(C), a constant the optimiser may move into a definition, and its checks end at the X ‖ 02 comparison. A site
 * in a branch that does not run is not a visit.
 */
export function readDeployerSiteVisits(trace: readonly AuthenticationProgramStateCommon[]): DeployerSiteVisit[] {
  const visits: DeployerSiteVisit[] = [];
  trace.forEach((state, step) => {
    const instructions = state.instructions as readonly { opcode: number; data?: Uint8Array }[];
    const ip = state.ip;
    if (instructions[ip]?.opcode !== Op.OP_INPUTBYTECODE || state.error !== undefined) return;
    if (state.controlStack.some((frame) => frame === false) || state.stack.length < 2) return;
    const prefix = instructions[ip + 4]?.data;
    if (instructions[ip + 1]?.opcode !== Op.OP_6 || instructions[ip + 2]?.opcode !== Op.OP_SPLIT
      || instructions[ip + 3]?.opcode !== Op.OP_SWAP || instructions[ip + 5]?.opcode !== Op.OP_EQUALVERIFY
      || prefix?.length !== 6 || CREATE_PREFIX.some((byte, index) => prefix[index] !== byte)) return;
    const definitions = (state as { functionTable?: Record<string, Uint8Array> }).functionTable ?? {};
    /** The constant compared by the OP_EQUALVERIFY after instruction `at`: an inline push, or an invoked one. */
    const constantAt = (at: number): Uint8Array | undefined => {
      const instruction = instructions[at];
      if (instruction === undefined) return undefined;
      if (instruction.data !== undefined && instructions[at + 1]?.opcode === Op.OP_EQUALVERIFY) return instruction.data;
      if (instructions[at + 1]?.opcode !== Op.OP_INVOKE || instructions[at + 2]?.opcode !== Op.OP_EQUALVERIFY) {
        return undefined;
      }
      const identifier = instruction.data ?? (instruction.opcode >= Op.OP_1 && instruction.opcode <= Op.OP_16
        ? Uint8Array.of(instruction.opcode - Op.OP_1 + 1) : undefined);
      const body = identifier === undefined ? undefined : definitions[binToHex(identifier)];
      return body !== undefined && body.length === 36 && body[0] === 35 ? body.slice(1) : undefined;
    };
    let deployerLock: string | undefined;
    let lastIp = -1;
    for (let at = ip + 6; at < instructions.length && at < ip + 128 && lastIp < 0; at += 1) {
      const { opcode } = instructions[at]!;
      if (opcode === Op.OP_UTXOBYTECODE && deployerLock === undefined) {
        const lock = constantAt(at + 1);
        if (lock?.length === 35 && lock[0] === 0xaa && lock[1] === 0x20 && lock[34] === 0x87) deployerLock = binToHex(lock);
        continue;
      }
      if (opcode !== Op.OP_OUTPUTTOKENCATEGORY) continue;
      for (let next = at + 1; next < at + 4 && next < instructions.length; next += 1) {
        if (instructions[next]!.opcode === Op.OP_EQUALVERIFY) { lastIp = next; break; }
      }
      break;
    }
    const { stack } = state;
    visits.push({
      step,
      inputIndex: Number(decodeScriptNumber(stack[stack.length - 1]!)),
      bound: stack[stack.length - 2]!,
      ...(deployerLock === undefined ? {} : { deployerLock }),
      instructions,
      firstIp: ip,
      lastIp,
    });
  });
  return visits;
}

/** The first run of a deployer `new` site that binds input `dIn` (A14 item 4 step 2). */
export function extractDeployBindingFromTrace(
  trace: readonly AuthenticationProgramStateCommon[], dIn: number,
): DeployerSiteVisit | undefined {
  return readDeployerSiteVisits(trace).find((visit) => visit.inputIndex === dIn);
}

/** Q ‖ A decoded: what one `new` hands Deploy<C>'s `create` (A6 step 2). */
export interface DeployBinding {
  /** The creator's category in VM order: `__internal__msgSenderCategory`. */
  senderCategory: Uint8Array;
  /** v: `__internal__deployValue`. */
  value: bigint;
  /** c_1 … c_k, in declaration order. */
  constructorArgs: StateValue[];
  /** p_1 … p_n, in declaration order. */
  contractArgs: StateValue[];
}

/** The types of Q ‖ A in byte order: the sender category, v, c_k … c_1, then p_n … p_1. */
function deployBindingTypes(deployer: DeployerAbi, constructorCount: number): {
  constructorTypes: string[]; contractTypes: string[];
} {
  const create = deployer.abi.find((entry) => entry.name === 'create');
  if (create === undefined) throw new DeployerPrepError(`Deployer '${deployer.lockingBytecode}' has no create arm`);
  const visible = create.inputs.filter((input) => !input.name.startsWith('__internal__'));
  const contractCount = visible.length - constructorCount;
  if (contractCount < 0) {
    throw new DeployerPrepError(`The deployer's create takes ${visible.length} arguments, fewer than ${constructorCount}`);
  }
  return {
    contractTypes: visible.slice(0, contractCount).map((input) => input.type),
    constructorTypes: visible.slice(contractCount).map((input) => input.type),
  };
}

/**
 * Decode Q ‖ A (A6 step 2): push(category) ‖ push(v) ‖ encode(c_k) … encode(c_1) ‖ encode(p_n) … encode(p_1), in the
 * encodings the creator's site uses. Each value must encode back to the bytes it came from, and nothing may follow.
 */
export function decodeDeployBinding(
  bound: Uint8Array, deployer: DeployerAbi, constructorCount: number, structs?: Artifact['structs'],
): DeployBinding {
  const { constructorTypes, contractTypes } = deployBindingTypes(deployer, constructorCount);
  const types = ['bytes32', 'bigint', ...[...constructorTypes].reverse(), ...[...contractTypes].reverse()];
  const values: StateValue[] = [];
  let offset = 0;
  for (const type of types) {
    if (offset >= bound.length) {
      throw new DeployerPrepError(`The creator binds ${bound.length} bytes, which end before its ${type} argument`);
    }
    const { value, bytesConsumed } = decodePushdataValue(bound, offset, type, structs);
    const slice = bound.slice(offset, offset + bytesConsumed);
    if (binToHex(encodePushdataValue(value, type, structs)) !== binToHex(slice)) {
      throw new DeployerPrepError(`The creator binds its ${type} argument as ${binToHex(slice)}, which is not canonical`);
    }
    values.push(value);
    offset += bytesConsumed;
  }
  if (offset !== bound.length) {
    throw new DeployerPrepError(`The creator binds ${bound.length - offset} bytes more than create's arguments`);
  }
  const [senderCategory, value, ...rest] = values;
  return {
    senderCategory: senderCategory as Uint8Array,
    value: value as bigint,
    constructorArgs: rest.slice(0, constructorTypes.length).reverse(),
    contractArgs: rest.slice(constructorTypes.length).reverse(),
  };
}

/** Encode a binding as a creator's site does: the inverse of `decodeDeployBinding`. */
export function encodeDeployBinding(
  binding: DeployBinding, deployer: DeployerAbi, constructorCount: number, structs?: Artifact['structs'],
): Uint8Array {
  const { constructorTypes, contractTypes } = deployBindingTypes(deployer, constructorCount);
  if (binding.constructorArgs.length !== constructorTypes.length || binding.contractArgs.length !== contractTypes.length) {
    throw new DeployerPrepError(
      `create takes ${contractTypes.length} contract and ${constructorTypes.length} constructor arguments, not `
      + `${binding.contractArgs.length} and ${binding.constructorArgs.length}`,
    );
  }
  const parts = [
    encodePushdataValue(binding.senderCategory, 'bytes32'),
    encodePushdataValue(binding.value, 'bigint'),
    ...constructorTypes.map((type, index) => encodePushdataValue(binding.constructorArgs[index]!, type, structs)).reverse(),
    ...contractTypes.map((type, index) => encodePushdataValue(binding.contractArgs[index]!, type, structs)).reverse(),
  ];
  return Uint8Array.from(parts.flatMap((part) => [...part]));
}

/**
 * The top-level deployment of A14 item 3. `create` runs C's constructor in genesis mode, and the creation's outputs come
 * from its own run (`completeCreateRun`); a constructor's calls are answered by their callees' blocks (A7, A14 item 5).
 * Every input runs in the local VM before anything is broadcast.
 *
 * Layout. Input 0 is the deployer coin and input 1 the author coin; output 0 is the identity and output 1 the
 * publication, or the change when there is none. When the constructor co-spends side-cars or makes calls, the paired
 * groups follow from index 2, each input beside the output at its index: the side-cars at the side-car base, in the
 * order of `create`'s side-car slots (a wallet coin in a 2-way recovery's middle slot), then each call slot's callee
 * block. Then come the record carriers and the relinked predecessors of the callees' inserts, then the genesis range at
 * OUTBASE, then the inputs nothing pairs with (the prep's change coin, the token-row coins) and the change when output 1
 * does not hold it. Without paired groups the genesis range follows the leading outputs.
 */
export async function deployThroughDeployer<T extends Artifact>(
  artifact: T,
  constructorArgs: readonly FunctionArgument[],
  options: import('./stateful-lifecycle-types.js').DeployOptions,
  prepOption?: DeployerPrep,
): Promise<import('./stateful-lifecycle-types.js').DeployResult<T>> {
  const deployer = artifact.deployer;
  if (deployer === undefined) throw new DeployerPathError(`Contract '${artifact.contractName}' has no deployer`);
  if (artifact.stateLayout === undefined) throw new DeployerPathError(`Contract '${artifact.contractName}' is not stateful`);
  if (artifact.delegateOnly === true) throw new DeployerPathError('A delegate-only facet has no deployer genesis');
  const { Contract } = await import('../Contract.js');
  const { planGenesisIdentity, identityRecord } = await import('../bcmr/identity.js');
  const {
    getDataNftAddress, getEntryNftAddress, getEventNftAddress, getSatoshiContainerAddress, getTokenContainerAddress,
  } = await import('./covenant-helpers.js');
  const { StatefulContract } = await import('./StatefulContract.js');
  const { attachWait } = await import('../wait.js');
  const { TransactionBuilder } = await import('../TransactionBuilder.js');

  const constructorAbi = artifact.abi.find((entry) => entry.name === '__construct');
  // A14 item 5: a callee that cannot answer is refused before anything is built.
  if (deployer.callSlots > 0) {
    const configured = options.constructorCallees ?? [];
    const sites = constructorAbi?.externalCalls ?? [];
    if (configured.length !== deployer.callSlots) {
      throw new DeployerCalleeError(artifact.contractName, sites[0]?.functionName ?? '<unknown>',
        `pass ${deployer.callSlots} constructorCallees entries, one per call slot`);
    }
    configured.forEach((callee, slot) => assertDeployerCallee(
      callee.contract.inner.artifact.contractName, callee.contract.inner.artifact,
      callee.functionName ?? sites[slot]?.functionName ?? '<unknown>',
    ));
  }
  // A14 item 11: a container row holds the deploy value (the constructor must be payable to state one), and an
  // unfunded row would be zero satoshis. Refuse before anything is built, so the caller gets the option to pass.
  const payable = constructorAbi?.modifiers?.includes('payable') === true;
  if (deployer.satoshiContainer === 'optional') {
    if (!payable) {
      throw new DeployerPrepError(
        `'${artifact.contractName}' keeps a satoshi container, but its constructor is not payable: the row's `
        + 'satoshis are the deploy value, which only a payable constructor states (pass a payable constructor '
        + 'and initialBalance)',
      );
    }
  } else if (deployer.satoshiContainer === 'required' && !payable && (options.initialBalance ?? 0n) > 0n) {
    // A4.4: a single container's row opens with RESERVE plus the deploy value, which only a payable constructor
    // states. Without one the row holds RESERVE, so a balance asked for here would be dropped.
    throw new DeployerPrepError(
      `'${artifact.contractName}' keeps its satoshi container single and its constructor is not payable: the row `
      + `opens with ${String(RESERVE)} satoshis and takes no deploy value; omit initialBalance`,
    );
  }
  // A2: a C that reads block data in its live functions reads its oracle pool, whose category is the contract
  // argument `__oraclePool` in A, so the master lock commits to it. The pool exists before the creation.
  if (deployer.readsBlockData && !artifact.constructorInputs.some((input) => input.name === '__oraclePool')) {
    throw new DeployerPathError(
      `Contract '${artifact.contractName}' reads block data but takes no oracle pool binding`,
    );
  }

  const changeLockingBytecode = addressToLockScript(options.changeAddress);
  const funderLock = options.funder.generateLockingBytecode();
  const authorLockingBytecode = options.senderLockingBytecode
    ?? (isP2pkhLock(funderLock) ? funderLock : changeLockingBytecode);
  const sidecarCount = deployer.sidecars.keccak + deployer.sidecars.ecrecover;
  const paired = sidecarCount > 0 || deployer.callSlots > 0;

  let prep = prepOption;
  if (prep === undefined) {
    const built = await buildDeployerPrep({
      children: [{
        deployer,
        contractName: artifact.contractName,
        // The author coin pays the creation's fee (the caller's, or the default) and, when the constructor
        // co-spends shared side-cars or calls contracts, the larger creation those inputs make.
        authorValue: defaultAuthorValue(deployer) + (options.fee ?? 0n) + (options.initialBalance ?? 0n)
          + (paired ? 20_000n : 0n),
      }],
      fundingUtxos: [options.fundingUtxo],
      authorSigner: options.funder,
      authorLockingBytecode,
      changeLockingBytecode,
      provider: options.provider,
    });
    prep = built.prep;
  }
  if (prep.contractName !== artifact.contractName) {
    throw new DeployerPrepError(
      `The deployer prep is for '${prep.contractName}', not '${artifact.contractName}'`,
    );
  }
  const preps = [prep];
  /** The built creation, and what the result reads from it. */
  interface BuiltCreation {
    contract: import('../Contract.js').Contract<T>;
    categoryId: string;
    identity: import('../bcmr/identity.js').GenesisIdentity;
    prepared: { registry?: import('../bcmr/deployment.js').PublishedRegistry };
    stateLayout: NonNullable<Artifact['stateLayout']>;
    constructorEvents: NonNullable<import('@solidcash/utils').AbiFunction['emits']>;
    transaction: Transaction;
    sourceOutputs: Transaction['outputs'];
    creationHex: string;
  }
  let built: BuiltCreation;
  try {
    built = await buildDeployerCreation();
  } catch (error) {
    if (prepOption === undefined) releaseDeployerPrepReservations(preps);
    throw error;
  }

  async function buildDeployerCreation(): Promise<BuiltCreation> {
    const creationPrep = prep!;
    const categoryId = creationPrep.category;
    const contract = new Contract(artifact, constructorArgs as never, {
      provider: options.provider,
      category: hexToBin(categoryId),
    });
    if (contract.lockingBytecode === undefined || !/^[0-9a-fA-F]+$/.test(contract.lockingBytecode)) {
      throw new DeployerPathError(`Contract '${artifact.contractName}' has no master locking bytecode`);
    }
    // C's born redeem script, its arguments and category pin included, before the prep is broadcast.
    assertSpendableContract(contract);
    const masterLock = hexToBin(contract.lockingBytecode);
    const dataNftAddress = getDataNftAddress(contract as never, categoryId);
    const stateLayout = artifact.stateLayout!;
    const { buildInitialStateCommitments } = await import('@solidcash/utils');
    const commitments = buildInitialStateCommitments(
      stateLayout, options.initialState ?? {}, options.provider.consensusLimits?.maximumNftCommitmentBytes,
    );

    // A14 item 3: output 0 is the category's authhead identity, and `create` pins it when `__internal__identity` is
    // set (B7.12's `emitGenesisIdentityPin`).
    const identity = planGenesisIdentity({
      category: categoryId,
      ...(options.identity === undefined ? {} : { identity: options.identity }),
      deployerLock: options.senderLockingBytecode
        ?? (isP2pkhLock(funderLock) ? funderLock : addressToLockScript(options.changeAddress)),
    });
    // A publication is a tokenless data carrier after the identity (A10). A metadata probe is not needed for a
    // contract that does not answer IERC20Metadata; one that does must state its fields in the publication.
    const prepared = options.bcmr === undefined
      ? {}
      : await (await import('../bcmr/deployment.js')).prepareMetadata({
        artifact,
        category: categoryId,
        deploy: options,
        probe: async () => {
          throw new DeployerPathError('this deployment cannot run a metadata probe');
        },
        tokenSatoshis: options.dataNftAmount ?? 1200n,
      });
    const leading: Output[] = options.bcmr === undefined
      ? [identity.output]
      : (await import('../bcmr/deployment.js')).leadingOutputs(identity, prepared);
    const masterAmount = options.masterAmount ?? 1200n;
    const dataNftAmount = options.dataNftAmount ?? 1200n;
    // The create's public parameters: C's contract parameters, then its constructor parameters. The Contract may have
    // appended the `__oraclePool` binding to its own constructor args; use those for the contract band.
    const publicNames = (createInputNames(deployer!) ?? []).filter((name) => !name.startsWith('__internal__'));
    const args: Record<string, FunctionArgument> = {};
    const contractParameters = artifact.constructorInputs.length;
    const boundConstructorArgs = ((contract as unknown as { constructorArgs?: readonly FunctionArgument[] })
      .constructorArgs ?? constructorArgs) as readonly FunctionArgument[];
    publicNames.forEach((name, index) => {
      const value = index < contractParameters
        ? boundConstructorArgs[index] ?? constructorArgs[index]
        : options.initArgs?.[index - contractParameters];
      if (value === undefined) throw new DeployerPrepError(`The deployer create input '${name}' has no value`);
      args[name] = value as FunctionArgument;
    });
    const createLayout = deployer!.abi.find((entry) => entry.name === 'create')?.blockLayout;
    if (createLayout === undefined) {
      throw new DeployerPathError(`Deployer of '${artifact.contractName}' has no create block layout`);
    }
    let deployValue = payable ? (options.initialBalance ?? 0n) : 0n;
    if (deployValue > 0n && deployValue < RESERVE) {
      // A14 item 11: an optional row funded with 1..RESERVE-1 is raised to RESERVE, and the value it holds is the
      // row's amount, so the journal's balance (which the row may not exceed) is raised with it.
      deployValue = RESERVE;
    }
    const creationLocktime = await deployerLocktime(deployer!, options.provider);
    // A7, A14 item 5: each call slot's callee block, from its function's layout and its coins on the network. Keys that
    // read `msg.sender` inside a callee take C's master lock.
    const calls = deployer!.callSlots > 0
      ? resolveConstructorCalls({ artifact, deployer: deployer!, callees: options.constructorCallees, args })
      : [];
    // The shared side-car coins this creation spends: a callee's, then Deploy<C>'s own (A14 item 6).
    const spentShared = new Set<string>();
    const blocks: ConstructorCalleeBlock[] = [];
    for (const call of calls) blocks.push(await planConstructorCalleeBlock(call, masterLock, { spent: spentShared }));

    // A4.4: the genesis range, offsets relative to OUTBASE. Placeholders (the default state, empty events, OP_1
    // transfers and journal rows) that `completeCreateRun` completes from `create`'s own run.
    const genesis: Output[] = [];
    const constructorEvents = constructorAbi?.emits ?? [];
    const tokenRowCoins: Array<{ utxo: Utxo; unlocker: Unlocker }> = [];
    const commitmentOffsets: number[] = [];
    const transferOffsets: number[] = [];
    const journalOffsets = new Map<string, { head: number; rows: number[] }>();
    let dataIndex = 0;
    let eventIndex = 0;
    for (const slot of createLayout.slots) {
      switch (slot.kind) {
        case 'master':
          genesis.push({
            to: masterLock,
            amount: masterAmount,
            token: { category: categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
          });
          break;
        case 'dataNft': {
          const nftIndex = slot.nftIndex ?? dataIndex;
          commitmentOffsets.push(genesis.length);
          genesis.push({
            to: dataNftAddress,
            amount: dataNftAmount,
            token: { category: categoryId, amount: 0n,
              nft: { capability: 'mutable', commitment: commitments[nftIndex] ?? '' } },
          });
          dataIndex += 1;
          break;
        }
        case 'entry':
        case 'head': {
          const collection = slot.collection
            ?? constructorAbi?.entryAccesses?.[slot.slotIndex ?? -1]?.collection;
          if (collection === undefined) {
            throw new DeployerPathError(`A ${slot.kind} slot of '${artifact.contractName}' names no collection`);
          }
          const rows = journalOffsets.get(collection) ?? { head: -1, rows: [] as number[] };
          journalOffsets.set(collection, rows);
          if (slot.kind === 'entry') {
            // A4.4: a journal row, which `create`'s run fills with an entry or leaves without a token.
            rows.rows.push(genesis.length);
            genesis.push({ to: Uint8Array.of(0x51), amount: 1000n });
            break;
          }
          rows.head = genesis.length;
          genesis.push({
            to: getEntryNftAddress(contract as never, categoryId, collection),
            amount: dataNftAmount,
            token: { category: categoryId, amount: 0n,
              nft: { capability: 'mutable', commitment: binToHex(new Uint8Array(128)) } },
          });
          break;
        }
        case 'satoshiContainer':
          if (deployer!.satoshiContainer === 'optional' && deployValue === 0n) {
            // A4.4, A14 item 11: an optional row with nothing required holds no container; the index takes the plain
            // filler output every unused index of the range takes, which `create` requires to carry no token.
            genesis.push({ to: Uint8Array.of(0x51), amount: 1000n });
            break;
          }
          // A required row also holds RESERVE: it is the container's own opening balance (A5).
          genesis.push({
            to: getSatoshiContainerAddress(contract as never, categoryId),
            amount: deployer!.satoshiContainer === 'required' ? RESERVE + deployValue : deployValue,
          });
          break;
        case 'tokenContainer': {
          // A4.4's token rows: each opens C's single token container from a coin of the paying wallet, which this
          // creation spends. The parameter holds the category in display order, as the coin's category reads.
          const tokenRow = slot.slotIndex;
          if (tokenRow === undefined) throw new DeployerPathError('A token container slot names no parameter');
          const name = artifact.constructorInputs[tokenRow]?.name ?? `parameter ${tokenRow}`;
          const raw = constructorArgs[tokenRow];
          const asset = (typeof raw === 'string' ? raw.replace(/^0x/i, '') : raw instanceof Uint8Array ? binToHex(raw) : '')
            .toLowerCase();
          const supplied = options.tokenContainers?.find(({ utxo }) => utxo.token !== undefined
            && utxo.token.category.toLowerCase() === asset);
          if (supplied === undefined) {
            throw new DeployerPrepError(
              `'${artifact.contractName}' keeps its token container '${name}' single; pass a coin of its category `
              + 'in tokenContainers',
            );
          }
          const token = supplied.utxo.token!;
          // `create` requires at least one unit and no mutable or minting NFT; an NFT on the coin would be burned.
          if (token.amount < 1n || token.nft !== undefined) {
            throw new DeployerPrepError(
              `The coin for '${artifact.contractName}''s token container '${name}' must hold fungible units of its `
              + 'category and no NFT',
            );
          }
          if (tokenRowCoins.some(({ utxo }) => utxo.token!.category.toLowerCase() === asset)) {
            throw new DeployerPrepError(
              `'${artifact.contractName}' names one category for two single token containers, which create refuses`,
            );
          }
          tokenRowCoins.push(supplied);
          genesis.push({
            to: getTokenContainerAddress(contract as never, categoryId, token.category),
            // A container row holds at least RESERVE (A4.4); the author coin tops a smaller coin up.
            amount: supplied.utxo.satoshis >= RESERVE ? supplied.utxo.satoshis : RESERVE,
            token: { category: token.category, amount: token.amount },
          });
          break;
        }
        case 'event':
        case 'eventChunk': {
          const emitInfo = constructorEvents[eventIndex];
          if (emitInfo === undefined) {
            throw new DeployerPathError(`'${artifact.contractName}' has an event slot the constructor does not emit`);
          }
          commitmentOffsets.push(genesis.length);
          genesis.push({
            to: getEventNftAddress(contract as never, categoryId, emitInfo.eventSignature),
            amount: dataNftAmount,
            token: { category: categoryId, amount: 0n, nft: { capability: 'none', commitment: '' } },
          });
          if (slot.kind === 'event') eventIndex += 1;
          break;
        }
        case 'keccakSideCar':
        case 'ecrecoverSideCar':
          // The side-car group sits at the side-car base, outside the genesis range (A4.4).
          break;
        case 'transfer':
          // A placeholder that `create`'s run replaces with the send's lock and amount.
          transferOffsets.push(genesis.length);
          genesis.push({ to: Uint8Array.of(0x51), amount: 1000n });
          break;
        default:
          throw new DeployerPathError(
            `The create layout of '${artifact.contractName}' has a slot kind (${slot.kind}) this deployment does `
            + 'not build',
          );
      }
    }
    if (genesis.length !== deployer!.genesisOutputs) {
      throw new DeployerPrepError(
        `The creation of '${artifact.contractName}' laid out ${genesis.length} genesis outputs, but its deployer pins `
        + `${deployer!.genesisOutputs}`,
      );
    }

    // The deployer's unlocking reads the layout's indexes when it is generated.
    let outbase = leading.length;
    let sidecarBase = outbase + deployer!.genesisOutputs;
    let budgetPad = new Uint8Array();
    let placed: PlacedConstructorCalls | undefined;
    const createUnlocking = (): Uint8Array => buildDeployerUnlocking({
      deployer: deployer!,
      callees: placed?.masters ?? [],
      args,
      value: deployValue,
      senderCategory: new Uint8Array(32),
      authorIndex: 1,
      identity: true,
      budgetPad,
      synthetic: {
        __internal__genesisOutputBase: BigInt(outbase),
        __internal__genesisSidecarBase: BigInt(sidecarBase),
        // Genesis block reads use the locktime; the parameter stays present for the arm's shape.
        __internal__blockOracleInputIndex: -1n,
        ...(placed?.synthetic(deployer!) ?? {}),
      },
      forBroadcast: true,
    });
    const deployerUnlocker: Unlocker = {
      generateLockingBytecode: () => hexToBin(deployer!.lockingBytecode),
      generateUnlockingBytecode: () => createUnlocking(),
    };

    const builder = new TransactionBuilder({
      provider: options.provider,
      ...(options.maxFee === undefined ? {} : { maximumFeeSatoshis: options.maxFee }),
      skipAutomaticCoSpends: true,
    });
    builder.addInput(creationPrep.deployerCoin, deployerUnlocker);
    builder.addInput(creationPrep.authorCoin, options.funder);
    for (const output of leading) builder.addOutput(output);
    // Plain wallet coins a slot without an input of its own takes: the prep's change, then the funder's other coins.
    const walletCoins: Utxo[] = [];
    let spareCoins: Utxo[] | undefined;
    const filler = async (): Promise<{ utxo: Utxo; unlocker: Unlocker }> => {
      const changeCoin = creationPrep.changeCoin;
      if (changeCoin !== undefined && !walletCoins.includes(changeCoin)) {
        walletCoins.push(changeCoin);
        return { utxo: changeCoin, unlocker: options.funder };
      }
      const own = new Set([creationPrep.deployerCoin, creationPrep.authorCoin, changeCoin]
        .filter((coin): coin is Utxo => coin !== undefined).map((coin) => genesisOutpointKey(coin.txid, coin.vout)));
      spareCoins ??= (await options.provider.getUtxosForLockingBytecode(funderLock)).filter((coin) => (
        coin.token === undefined && coin.satoshis >= 1000n && !own.has(genesisOutpointKey(coin.txid, coin.vout))
        && !isReservedGenesisOutpoint(genesisOutpointKey(coin.txid, coin.vout))
        && !tokenRowCoins.some(({ utxo }) => utxo.txid === coin.txid && utxo.vout === coin.vout)));
      const coin = spareCoins.shift();
      if (coin === undefined) {
        throw new DeployerPrepError(
          `The creation of '${artifact.contractName}' needs another plain coin at the funder's lock for a slot of its `
          + 'constructor callees that takes a wallet coin',
        );
      }
      walletCoins.push(coin);
      return { utxo: { ...coin, lockingBytecode: funderLock }, unlocker: options.funder };
    };

    let changeIndex = -1;
    if (paired) {
      // A4.4: the paired groups start at the first index past the deployer and author inputs and the leading outputs.
      // The change output takes an index the leading outputs leave free.
      while (builder.inputs.length < builder.outputs.length) {
        const coin = await filler();
        builder.addInput(coin.utxo, coin.unlocker);
      }
      if (builder.outputs.length < builder.inputs.length) {
        changeIndex = builder.outputs.length;
        builder.addOutput({ to: options.changeAddress, amount: 1000n });
      }
      sidecarBase = builder.inputs.length;
      // A14 item 6: the deployer's constructor side-cars come from the shared pool, at salt 0, already on the network,
      // in the order `create` reads them (its side-car slots by offset, A4.4). Each is spent and recreated at one
      // index. A 2-way recovery's middle slot reads nothing: a wallet coin fills it, beside the OP_1 filler. A missing
      // shared coin is refused rather than minted: the pool is one for every deployment.
      const sidecars = await sharedCreateSidecars({
        deployer: deployer!, args, provider: options.provider, spent: spentShared, who: 'the deployer',
      });
      for (const step of sidecars) {
        if (step === undefined) {
          const coin = await filler();
          builder.addInput(coin.utxo, coin.unlocker);
          builder.addOutput(plainFiller());
        } else {
          builder.addInput(step.utxo, step.unlocker);
          builder.addOutput(step.recreate);
        }
      }
      // A7: each call slot's callee block, then the record carriers and the relinked predecessors.
      if (blocks.length > 0) placed = await placeConstructorCalls({ builder, blocks, filler });
      outbase = builder.outputs.length;
    }
    for (const output of genesis) builder.addOutput(output);
    // The inputs nothing pairs with come after every paired index.
    if (paired && creationPrep.changeCoin !== undefined && !walletCoins.includes(creationPrep.changeCoin)) {
      walletCoins.push(creationPrep.changeCoin);
      builder.addInput(creationPrep.changeCoin, options.funder);
    }
    for (const { utxo, unlocker } of tokenRowCoins) builder.addInput(utxo, unlocker);

    // The change takes what the outputs leave of every input but the deployer coin, less the fee.
    const valueOut = (): bigint => builder.outputs.reduce(
      (sum, output, index) => sum + (index === changeIndex ? 0n : output.amount), 0n,
    );
    const valueIn = builder.inputs.reduce((sum, input) => sum + input.satoshis, 0n) - creationPrep.deployerCoin.satoshis;
    const provisionalFee = options.fee ?? estimateCreationBytes(deployer!);
    if (valueIn < valueOut() + (options.fee ?? 0n)) {
      throw new DeployerPrepError(
        `The author coin of '${artifact.contractName}' holds ${creationPrep.authorCoin.satoshis} satoshis, but its `
        + `creation needs ${valueOut() + provisionalFee}`,
      );
    }
    let change = valueIn - valueOut() - provisionalFee;
    if (changeIndex >= 0) {
      if (change < DUST) {
        throw new DeployerPrepError(
          `The author coin of '${artifact.contractName}' leaves ${change} satoshis of change at output ${changeIndex}, `
          + 'below the dust limit; build the prep with a larger authorValue',
        );
      }
      (builder.outputs[changeIndex] as { amount: bigint }).amount = change;
    } else if (change >= DUST) {
      changeIndex = builder.outputs.length;
      builder.addOutput({ to: options.changeAddress, amount: change });
    }
    if (creationLocktime !== undefined) builder.setLocktime(creationLocktime);

    // A7, A14 item 5: each callee answers this creation (input 0 creates X; output OUTBASE is C's master), then its own
    // run completes its outputs and its call record. A5: a callee's `tx.time` checks join the one locktime, beside the
    // constructor's block field; the change takes what the callees' transfers and containers leave.
    if (placed !== undefined) {
      placed.bind({
        categoryId, gIn: 0, gOut: outbase, deployer: deployer!, contractParameters, unlocking: createUnlocking(),
      });
      const field = deployer!.constructorBlockField;
      const ledger = locktimeLedger(field === undefined ? [] : [{
        inputIndex: 0, who: `the creation of '${artifact.contractName}', whose constructor reads block.${field}`,
        kind: field === 'number' ? 'height' : 'time', value: field === 'number' ? 0 : TIME_LOCKTIME,
      }], creationLocktime);
      placed.settle(options.provider, () => builder.buildLibauthProgram(true), {
        amountsChanged: () => {
          change = valueIn - valueOut() - provisionalFee;
          if (changeIndex < 0) return;
          if (change < DUST) {
            throw new DeployerPrepError(
              `The callees of '${artifact.contractName}' leave ${change} satoshis of change; build the prep with a `
              + 'larger authorValue',
            );
          }
          (builder.outputs[changeIndex] as { amount: bigint }).amount = change;
        },
        locktime: (found) => {
          const next = ledger.add(found);
          if (next === undefined || next === builder.locktime) return false;
          builder.setLocktime(next);
          return true;
        },
      });
    }

    // A14 item 3: complete `create`'s own run. A transfer's amount moves the change, which takes what the outputs
    // leave.
    const genesisTotal = (): bigint => builder.outputs.slice(outbase, outbase + deployer!.genesisOutputs)
      .reduce((sum, output) => sum + output.amount, 0n);
    const fixedGenesisTotal = genesisTotal();
    const journals = deployer!.collectionRows.map((row) => {
      const placedRows = journalOffsets.get(row.collection);
      if (placedRows === undefined || placedRows.head < 0 || row.journalDepth === undefined) {
        throw new DeployerPathError(`The journal rows of '${row.collection}' are not laid out`);
      }
      return {
        collection: row.collection,
        depth: row.journalDepth,
        head: outbase + placedRows.head,
        rows: placedRows.rows.map((offset) => outbase + offset),
        entryLock: getEntryNftAddress(contract as never, categoryId, row.collection),
        category: categoryId,
      };
    });
    // The change the callees' runs left, which a constructor's transfers draw on.
    const calleesChange = change;
    for (let attempt = 0; ; attempt += 1) {
      try {
        completeCreateRun({
          provider: options.provider,
          build: () => builder.buildLibauthProgram(true),
          deployerInputIndex: 0,
          outputs: builder.outputs as Output[],
          range: { min: outbase, max: outbase + deployer!.genesisOutputs },
          slots: {
            commitments: commitmentOffsets.map((offset) => outbase + offset),
            transfers: transferOffsets.map((offset) => outbase + offset),
            journals,
          },
          amountsChanged: () => {
            const moved = genesisTotal() - fixedGenesisTotal;
            if (changeIndex < 0 || calleesChange - moved < DUST) {
              throw new DeployerPrepError(
                `The constructor of '${artifact.contractName}' sends ${moved} satoshis more than the author coin's `
                + 'change can cover; build the prep with a larger authorValue',
              );
            }
            (builder.outputs[changeIndex] as { amount: bigint }).amount = calleesChange - moved;
          },
        });
        break;
      } catch (error) {
        // A constructor whose loop costs more than the creation's own bytes fund needs the padding parameter: every
        // unlocking byte grants budget, and step 1 drops the pad before the body. Grow it on a budget failure, up to
        // the 10,000 bytes of the unlocking.
        if (!/operation cost/i.test((error as Error).message) || attempt >= 16) throw error;
        const grown = nextBudgetPad(budgetPad,
          builder.buildLibauthProgram(true).transaction.inputs[0]!.unlockingBytecode.length);
        if (grown === undefined) throw error;
        budgetPad = grown;
      }
    }

    let { transaction, sourceOutputs } = builder.buildLibauthProgram(true);
    const programValueIn = (): bigint => sourceOutputs.reduce((sum, output) => sum + output.valueSatoshis, 0n);
    const programValueOut = (): bigint => transaction.outputs.reduce((sum, output) => sum + output.valueSatoshis, 0n);
    if (options.fee === undefined && changeIndex >= 0) {
      // Pay 1 sat/B of the creation's real size (and two bytes of margin) rather than the upper estimate. The change
      // takes every input the outputs do not, the deployer coin's own value included.
      const size = BigInt(encodeTransaction(transaction).length) + 2n;
      const currentChange = transaction.outputs[changeIndex].valueSatoshis;
      const exactChange = programValueIn() - (programValueOut() - currentChange) - size;
      if (exactChange >= DUST) {
        (builder.outputs[changeIndex] as { amount: bigint }).amount = exactChange;
        ({ transaction, sourceOutputs } = builder.buildLibauthProgram(true));
      }
    }
    // The fee is every input less every output; it must pay 1 sat/B of the creation.
    const paid = programValueIn() - programValueOut();
    const size = BigInt(encodeTransaction(transaction).length);
    if (paid < size) {
      throw new DeployerPrepError(
        `The author coin of '${artifact.contractName}' holds ${creationPrep.authorCoin.satoshis} satoshis, which leaves `
          + `a fee of ${paid} for a creation of ${size} bytes; build the prep with a larger authorValue`,
      );
    }
    const localRuns = runDeployerInputsLocal(options.provider, transaction, sourceOutputs);
    // The whole creation, as a node would judge it apart from its fee policy: every input, the token and value rules
    // and dust. A refusal here broadcasts nothing.
    const verdict = createVirtualMachineBch2026ForProvider(options.provider)
      .verify({ transaction, sourceOutputs } as never);
    if (verdict !== true) {
      throw new DeployerPrepError(`The creation does not pass the VM, so nothing was broadcast: ${String(verdict)}`);
    }
    if ((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.DEBUG_D13) {
      // eslint-disable-next-line no-console
      console.log('D13', JSON.stringify({
        transactionBytes: Number(size),
        operationCosts: localRuns.map((entry) => ({ input: entry.inputIndex, cost: entry.operationCost.toString() })),
        calleeUnlockingBytes: (placed?.masters ?? []).map((master) => transaction.inputs[master].unlockingBytecode.length),
        deployerUnlockingBytes: transaction.inputs[0].unlockingBytecode.length,
        deployerRedeemBytes: hexToBin(deployer!.bytecode).length,
      }));
    }
    return {
      contract, categoryId, identity, prepared, stateLayout, constructorEvents, transaction, sourceOutputs,
      creationHex: binToHex(encodeTransaction(transaction)),
    };
  }

  const sendsPreps = preps.some((entry) => !entry.broadcast);
  await broadcastDeployerPreps(preps, options.provider);
  // A coin the creation spends may move while its preps are sent: an oracle pool's keeper moves each info coin a
  // callee reads with each block. The creation is then built again from the coins the network now lists.
  if (sendsPreps && (await staleCreationInputs(options.provider, built.transaction, built.sourceOutputs,
    preps.map((entry) => entry.category))).length > 0) {
    built = await buildDeployerCreation();
  }
  const { contract, categoryId, identity, prepared, stateLayout, constructorEvents, transaction, creationHex } = built;
  const creationTxid = await options.provider.sendRawTransaction(creationHex);
  releaseDeployerPrepReservations(preps);
  // Decode the constructor's events from the creation's outputs, so a caller sees them like a call receipt.
  const receiptEvents: import('../interfaces.js').ReceiptEvent[] = [];
  if (constructorEvents.length > 0) {
    const { parseEventCommitment } = await import('./StateReader.js');
    const eventDefinitions = artifact.events ?? [];
    const byLock = new Map<string, (typeof eventDefinitions)[number]>();
    for (const emitInfo of constructorEvents) {
      const definition = eventDefinitions.find((candidate) => candidate.signature === emitInfo.eventSignature);
      if (definition === undefined) continue;
      byLock.set(binToHex(addressToLockScript(
        getEventNftAddress(contract as never, categoryId, definition.signature),
      )), definition);
    }
    for (const out of transaction.outputs) {
      const commitment = out.token?.nft?.commitment;
      if (commitment === undefined) continue;
      const definition = byLock.get(binToHex(out.lockingBytecode));
      if (definition === undefined) continue;
      const commitmentHex = typeof commitment === 'string' ? commitment : binToHex(commitment);
      try {
        receiptEvents.push({
          event: definition.name,
          eventSignature: definition.signature,
          args: parseEventCommitment(commitmentHex, definition, stateLayout.structs) as Record<string, unknown>,
        });
      } catch { /* an unparseable event stays undecoded rather than failing the deployment */ }
    }
  }
  const details = attachWait({
    ...transaction, txid: creationTxid, hex: creationHex,
    ...(receiptEvents.length === 0 ? {} : { events: receiptEvents }),
  } as TransactionDetails, options.provider);

  return {
    contract: StatefulContract.withCategory(contract, categoryId) as never,
    tx: details,
    categoryId,
    identity: identityRecord(identity, creationTxid),
    ...(prepared.registry === undefined ? {} : { registry: prepared.registry }),
    prepTransactions: preps.map((entry) => entry.transactionHex),
  };
}

/**
 * The inputs of a built transaction whose coins the provider no longer lists as unspent: a keeper, or another
 * transaction, spent them after the transaction was built. Coins of the transactions in `sent` (the preps just
 * broadcast) are live by construction and not asked about.
 */
export async function staleCreationInputs(
  provider: NetworkProvider, transaction: Transaction, sourceOutputs: Transaction['outputs'],
  sent: readonly string[] = [],
): Promise<number[]> {
  const known = new Set(sent.map((txid) => txid.toLowerCase()));
  const listed = new Map<string, Promise<Utxo[]>>();
  const stale: number[] = [];
  for (const [index, input] of transaction.inputs.entries()) {
    const lock = sourceOutputs[index]?.lockingBytecode;
    if (lock === undefined || known.has(binToHex(input.outpointTransactionHash))) continue;
    const key = binToHex(lock);
    if (!listed.has(key)) listed.set(key, provider.getUtxosForLockingBytecode(lock));
    const txid = binToHex(input.outpointTransactionHash);
    if (!(await listed.get(key)!).some((utxo) => utxo.vout === input.outpointIndex
      && utxo.txid.toLowerCase() === txid)) stale.push(index);
  }
  return stale;
}

function createInputNames(deployer: DeployerAbi): string[] | undefined {
  return deployer.abi.find((entry) => entry.name === 'create')?.inputs.map((input) => input.name);
}

/** A14 item 7: a constructor that reads block data makes the creation's locktime the block it is final in. */
export async function deployerLocktime(
  deployer: DeployerAbi, provider: NetworkProvider,
): Promise<number | undefined> {
  if (deployer.constructorBlockField === undefined) return undefined;
  if (deployer.constructorBlockField === 'number') return provider.getBlockHeight();
  return Math.max(0, (await provider.getMedianTimePast()) - 1);
}

/** A DeployerPrep's transaction as libauth sees it. */
export function decodeDeployerPrep(prep: DeployerPrep): Transaction {
  return decodeTransactionUnsafe(hexToBin(prep.transactionHex));
}

export type { TransactionDetails };
