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
import { Op, type Artifact, type DeployerAbi } from '@solidcash/utils';
import {
  encodeFunctionArgument, type FunctionArgument,
} from '../Argument.js';
import { isP2pkhLock } from '../bcmr/identity.js';
import type { TransactionDetails, Unlocker, Utxo } from '../interfaces.js';
import { createVirtualMachineBch2026ForProvider } from '../network/createVirtualMachine.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import { createUnlockingBytecode } from '../utils.js';
import {
  genesisOutpointKey, isReservedGenesisOutpoint, releaseGenesisOutpoint, reserveGenesisOutpoint,
} from './genesis-reservations.js';
import { decodeScriptNumber } from './trace-commitment-helpers.js';

/** A12: a deployment that asks for more than the deployer produces takes today's genesis instead. */
export type DeployerFallbackCase =
  | 'initial-state' | 'identity-anchors' | 'native-token' | 'block-oracle' | 'extra-outputs-own-category'
  | 'salt' | 'address-type' | 'thread-count' | 'message-bus-verifiers' | 'master-amount'
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
  messageBusVerificationInputCount?: number;
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
  if (options.oraclePool !== undefined || deployer.readsBlockData) return 'block-oracle';
  if (options.salt !== undefined) return 'salt';
  if (options.addressType !== undefined && options.addressType !== 'p2sh32') return 'address-type';
  if (options.threadCount !== undefined && options.threadCount > 1) return 'thread-count';
  if ((options.messageBusVerificationInputCount ?? 0) > 0) return 'message-bus-verifiers';
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
    readonly inner: { readonly artifact: Artifact; readonly unlock: Record<string, ((...values: any[]) => Unlocker) | undefined> };
    readonly categoryId: string;
    readonly address: string;
    getFullState(): Promise<{ masterUtxo?: Utxo; dataNftUtxos: Utxo[] }>;
  };
  functionName?: string;
  args?: readonly FunctionArgument[];
}

/** A7's tag: `X ‖ slot ‖ g_in`, plus `g_out` and the create unlocking's ranges for a sender reader. */
function constructorCallTag(categoryId: string, slot: number, gIn: number, senderReader: boolean,
  gOut: number, aOffset: number, aLength: number, codeOffset: number, codeLength: number): Uint8Array {
  const tag = new Uint8Array([
    ...hexToBin(categoryId).slice().reverse(), slot & 0xff, (slot >> 8) & 0xff, gIn & 0xff, (gIn >> 8) & 0xff,
  ]);
  if (!senderReader) return tag;
  const extra = new Uint8Array(10);
  const write = (at: number, value: number): void => {
    extra[at] = value & 0xff;
    extra[at + 1] = (value >> 8) & 0xff;
  };
  write(0, gOut); write(2, aOffset); write(4, aLength); write(6, codeOffset); write(8, codeLength);
  return new Uint8Array([...tag, ...extra]);
}

/** Encode a callee's full ABI frame with the genesis call's synthetic values. */
function calleeFrame(callee: ConstructorCallee, functionName: string, args: readonly FunctionArgument[],
  tag: Uint8Array, returnIndex: number, senderCategory?: Uint8Array): FunctionArgument[] {
  const fn = callee.contract.inner.artifact.abi.find((entry) => entry.name === functionName);
  if (fn === undefined) throw new DeployerCalleeError(callee.contract.inner.artifact.contractName, functionName,
    'the callee has no such function');
  const visible = fn.inputs.filter((input) => !input.name.startsWith('__internal__'));
  if (args.length !== visible.length) throw new DeployerCalleeError(
    callee.contract.inner.artifact.contractName, functionName,
    `it takes ${visible.length} visible argument${visible.length === 1 ? '' : 's'}, but ${args.length} were given`,
  );
  const values = new Map<string, FunctionArgument>();
  visible.forEach((input, index) => values.set(input.name, args[index]));
  for (const input of fn.inputs) {
    if (!input.name.startsWith('__internal__')) continue;
    if (input.name === '__internal__genesisCall') values.set(input.name, tag);
    else if (input.name === '__internal__returnOutputIdx') values.set(input.name, BigInt(returnIndex));
    else if (input.name === '__internal__msgSenderCategory') values.set(input.name, senderCategory ?? new Uint8Array(32));
    else throw new DeployerCalleeError(callee.contract.inner.artifact.contractName, functionName,
      `the entry needs the internal witness '${input.name}', which a constructor's call cannot fill`);
  }
  return fn.inputs.map((input) => values.get(input.name)!);
}

/** The callee's data record and return record as the create must carry them. */
export interface ConstructorCalleeRun {
  master: Utxo;
  dataNfts: Utxo[];
  dataCommitments: string[];
  returnCommitment: string;
  category: string;
  unlocking: Uint8Array;
  dataUnlocking: Uint8Array;
  returnIndex: number;
}

/** Run one callee in an isolated probe and learn its post-call data and return record (A14 item 5). */
export async function deriveConstructorCalleeRun(options: {
  callee: ConstructorCallee;
  functionName: string;
  args: readonly FunctionArgument[];
  slot: number;
  categoryId: string;
  provider: NetworkProvider;
  returnIndex: number;
  masterInputIndex: number;
  tag: Uint8Array;
  createUnlocking?: Uint8Array;
  childMasterLock?: Uint8Array;
}): Promise<ConstructorCalleeRun> {
  const { callee, functionName, args, slot, categoryId, provider, returnIndex, masterInputIndex, tag } = options;
  const artifact = callee.contract.inner.artifact;
  assertDeployerCallee(artifact.contractName, artifact, functionName);
  const state = await callee.contract.getFullState();
  if (state.masterUtxo === undefined) throw new DeployerCalleeError(artifact.contractName, functionName,
    'the callee has no master coin on the network yet');
  const { addressToLockScript } = await import('../utils.js');
  const { getDataNftAddress } = await import('./covenant-helpers.js');
  const masterLock = addressToLockScript(callee.contract.address);
  const dataLock = addressToLockScript(getDataNftAddress(
    callee.contract.inner as never, callee.contract.categoryId,
  ));
  const master: Utxo = { ...state.masterUtxo, lockingBytecode: masterLock };
  const dataNfts: Utxo[] = state.dataNftUtxos.map((utxo) => ({ ...utxo, lockingBytecode: dataLock }));
  const senderReader = (artifact.abi.find((entry) => entry.name === functionName)?.inputs ?? [])
    .some((input) => input.name === '__internal__msgSenderCategory');
  const abiValues = calleeFrame(callee, functionName, args, tag, returnIndex,
    senderReader ? hexToBin(categoryId) : undefined);
  const unlocker = callee.contract.inner.unlock[functionName]?.(...abiValues);
  if (unlocker === undefined) throw new DeployerCalleeError(artifact.contractName, functionName,
    'the SDK cannot build its unlocking');
  const calleeUnlocking = unlocker.generateUnlockingBytecode({
    transaction: { version: 2, locktime: 0, inputs: [], outputs: [] }, sourceOutputs: [], inputIndex: 1,
  } as never);
  const { CovenantTransactionBuilder } = await import('./CovenantTransactionBuilder.js');
  const { evaluateProbeTrace } = await import('./faithful-probe-trace.js');
  const { extractCommitmentsFromTrace } = await import('./trace-commitment-helpers.js');
  const genesisLock = options.childMasterLock ?? Uint8Array.of(0x51);
  const dataCount = dataNfts.length;
  const runProbe = (dataCommits: readonly string[], returnCommit: string): any => {
    const builder = new CovenantTransactionBuilder({ provider });
    builder.addInput({ txid: categoryId, vout: 0, satoshis: 1200n, lockingBytecode: genesisLock }, {
      generateLockingBytecode: () => genesisLock,
      generateUnlockingBytecode: () => options.createUnlocking ?? Uint8Array.of(0x51),
    });
    builder.addInput(master, {
      generateLockingBytecode: () => masterLock,
      generateUnlockingBytecode: () => calleeUnlocking,
    });
    dataNfts.forEach((utxo) => builder.addInput(utxo, {
      generateLockingBytecode: () => dataLock,
      generateUnlockingBytecode: () => Uint8Array.of(0x51),
    }));
    builder.addOutput({ to: genesisLock, amount: 1200n });
    builder.addOutput({ to: masterLock, amount: master.satoshis, ...(master.token === undefined ? {} : { token: master.token }) });
    dataNfts.forEach((utxo, index) => builder.addOutput({
      to: dataLock, amount: utxo.satoshis,
      token: { category: callee.contract.categoryId, amount: 0n,
        nft: { capability: 'mutable', commitment: dataCommits[index] ?? '' } },
    }));
    for (let index = 2 + dataCount; index < returnIndex; index += 1) {
      builder.addOutput({ to: Uint8Array.of(0x51), amount: 1000n });
    }
    builder.addOutput({
      to: Uint8Array.of(0x51), amount: 1000n,
      token: { category: callee.contract.categoryId, amount: 0n,
        nft: { capability: 'none', commitment: returnCommit } },
    });
    const { transaction, sourceOutputs } = builder.buildLibauthProgram();
    return evaluateProbeTrace(provider, { inputIndex: 1, sourceOutputs, transaction });
  };
  let dataCommitments = dataNfts.map(() => '');
  let returnCommitment = '';
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const trace = runProbe(dataCommitments, returnCommitment);
    const nextData = extractCommitmentsFromTrace(trace, dataCount, { min: 2, max: 2 + dataCount }) ?? [];
    const nextReturn = extractCommitmentsFromTrace(trace, 1, { min: returnIndex, max: returnIndex + 1 })?.[0];
    let changed = false;
    if (nextData.length >= dataCount && nextData.some((value, index) => value !== dataCommitments[index])) {
      dataCommitments = nextData.slice(0, dataCount); changed = true;
    }
    if (nextReturn !== undefined && nextReturn !== returnCommitment) { returnCommitment = nextReturn; changed = true; }
    if (!changed) break;
  }
  if (dataCommitments.some((value) => value === '') || returnCommitment === '') {
    throw new DeployerCalleeError(artifact.contractName, functionName,
      'the probe could not read the callee\'s records');
  }
  const { createDataNftUnlocker } = await import('./covenant-helpers.js');
  const dataUnlocking = createDataNftUnlocker(
    callee.contract.inner as never, masterInputIndex, callee.contract.categoryId,
  ).generateUnlockingBytecode({
    transaction: { version: 2, locktime: 0, inputs: [], outputs: [] }, sourceOutputs: [], inputIndex: 1,
  } as never);
  return { master, dataNfts, dataCommitments, returnCommitment,
    category: callee.contract.categoryId, unlocking: calleeUnlocking, dataUnlocking, returnIndex };
}

export class DeployerSidecarError extends Error {
  constructor(kind: 'keccak' | 'ecrecover') {
    super(`No shared ${kind} sidecar coin was found for the deployer; the deployer's shared pool must already exist`);
    this.name = 'DeployerSidecarError';
  }
}

export class DeployerLocktimeConflictError extends Error {
  constructor(first: number, second: number) {
    super(`The transaction needs two different locktimes (${first} and ${second}) and no value satisfies both`);
    this.name = 'DeployerLocktimeConflictError';
  }
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
  return BigInt(Math.max(1000, 1500 + hexToBin(deployer.bytecode).length + 200 * deployer.genesisOutputs));
}

/** What output 1 of a prep needs: RESERVE per genesis output, the identity output, and a create fee allowance. */
export function defaultAuthorValue(deployer: DeployerAbi): bigint {
  const nfts = BigInt(Math.max(1, deployer.genesisOutputs)) + 1n;
  return RESERVE * (nfts + 1n) + defaultDeployerFee(deployer) + 2000n;
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
    const transactionHex = builder.build();
    const transaction = decodeTransactionUnsafe(hexToBin(transactionHex));
    const txid = binToHex(hashTransactionUiOrder(encodeTransaction(transaction)));
    const deployerCoin: Utxo = {
      txid, vout: 0, satoshis: deployerValue, lockingBytecode: hexToBin(child.deployer.lockingBytecode),
    };
    const authorCoin: Utxo = { txid, vout: 1, satoshis: authorValue, lockingBytecode: authorLockingBytecode };
    const change = changeIndex < 0 ? undefined : builder.outputs[changeIndex];
    const changeCoin: Utxo | undefined = change === undefined ? undefined : {
      txid, vout: changeIndex, satoshis: change.amount, lockingBytecode: last ? changeLockingBytecode : authorLockingBytecode,
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
      "the callee is not record-sound; compile it with genesisCalls and fix any arm that prevents it, "
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
}

/** One input's local VM verdict. */
export interface DeployerInputRun {
  inputIndex: number;
  operationCost: bigint;
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
    runs.push({ inputIndex, operationCost: BigInt(state.metrics?.operationCost ?? 0) });
  }
  return runs;
}

/**
 * A14 item 5's fixed point on the shipped creation: a constructor with one call slot and no collection rows,
 * events or transfers. The callee's record is learned in an isolated probe; the create's own trace then supplies
 * the child's data-record commitment, and the one tag candidate whose `X` the compiler checks is kept.
 */
async function deployThroughCallSlot<T extends Artifact>(options: {
  artifact: T;
  constructorArgs: readonly FunctionArgument[];
  options: import('./stateful-lifecycle-types.js').DeployOptions;
  prep: DeployerPrep;
  contract: import('../Contract.js').Contract<T>;
  deployer: DeployerAbi;
  categoryId: string;
  masterLock: Uint8Array;
  dataNftAddress: string;
  leading: import('../interfaces.js').Output[];
  outbase: number;
  args: Record<string, FunctionArgument>;
  deployValue: bigint;
  masterAmount: bigint;
  dataNftAmount: bigint;
  stateLayout: NonNullable<Artifact['stateLayout']>;
  constructorAbi: NonNullable<Artifact['abi'][number]> | undefined;
}): Promise<import('./stateful-lifecycle-types.js').DeployResult<T>> {
  const {
    artifact, constructorArgs, prep, contract, deployer, categoryId, masterLock, dataNftAddress, leading, outbase,
    args, deployValue, masterAmount, dataNftAmount, stateLayout, constructorAbi,
  } = options;
  const callSite = constructorAbi?.externalCalls?.[0];
  const configured = options.options.constructorCallees?.[0];
  if (callSite === undefined || configured === undefined) {
    throw new DeployerCalleeError(artifact.contractName, callSite?.functionName ?? '<unknown>',
      'pass one constructorCallees entry for the call slot');
  }
  const functionName = configured.functionName ?? callSite.functionName;
  const visible = constructorAbi?.inputs.filter((input) => !input.name.startsWith('__internal__')) ?? [];
  const calleeArgs = configured.args ?? (callSite.argSources ?? []).map((source) => {
    if (source.kind === 'literal') return source.value as FunctionArgument;
    if (source.kind === 'forward' && source.paramIndex !== undefined) {
      const input = visible[source.paramIndex];
      const value = input === undefined ? undefined : args[input.name];
      if (value !== undefined) return value;
    }
    throw new DeployerCalleeError(configured.contract.inner.artifact.contractName, functionName,
      'its call arguments are not literals or forwarded constructor parameters; pass them in constructorCallees');
  });
  const createFn = deployer.abi.find((entry) => entry.name === 'create');
  if (createFn === undefined) throw new DeployerPrepError(`Deployer of '${artifact.contractName}' has no create arm`);
  const dataCount = stateLayout.dataNftCount;
  const calleeBase = outbase + deployer.genesisOutputs;
  const calleeDataCount = configured.contract.inner.artifact.stateLayout?.dataNftCount ?? 0;
  const returnIndex = calleeBase + 1 + calleeDataCount;
  const senderReader = (configured.contract.inner.artifact.abi.find((entry) => entry.name === functionName)?.inputs ?? [])
    .some((input) => input.name === '__internal__msgSenderCategory');
  const pushLength = (value: FunctionArgument | undefined, type: string): number => {
    if (value === undefined) return 0;
    const raw = encodeFunctionArgument(value, type, artifact.structs);
    return raw instanceof Uint8Array ? encodeDataPush(raw).length : 0;
  };
  let qLength = encodeDataPush(new Uint8Array(32)).length + encodeDataPush(bigIntToVmNumber(0n)).length;
  let aLength = 0;
  createFn.inputs.filter((input) => !input.name.startsWith('__internal__')).forEach((input, index) => {
    const length = pushLength(args[input.name], input.type);
    if (index < artifact.constructorInputs.length) aLength += length;
    else qLength += length;
  });
  const codeLength = hexToBin(deployer.code).length;
  const codeHeader = codeLength < 0x4c ? 1 : codeLength <= 0xff ? 2 : codeLength <= 0xffff ? 3 : 5;
  const aOffset = 6 + 2 * deployer.callSlots + qLength;
  const codeOffset = aOffset + aLength + codeHeader;
  const callSynthetics = {
    __internal__externalCallInputBase: BigInt(calleeBase),
    __internal__extcallMasterIdx0: BigInt(calleeBase),
    __internal__extcallAnchorIdx0: -1n,
    __internal__returnOutputIdx: BigInt(returnIndex),
    __internal__callEdgeOutputIdx0: -1n,
  };
  const unlockingFor = (tag: Uint8Array): Uint8Array => buildDeployerUnlocking({
    deployer,
    callees: [calleeBase],
    args,
    value: deployValue,
    senderCategory: new Uint8Array(32),
    authorIndex: 1,
    identity: true,
    budgetPad: new Uint8Array(),
    synthetic: {
      __internal__genesisOutputBase: BigInt(outbase),
      __internal__genesisSidecarBase: BigInt(outbase + deployer.genesisOutputs),
      ...callSynthetics,
      __internal__externalReturnOutputIdx: BigInt(returnIndex),
    },
  });
  const { TransactionBuilder } = await import('../TransactionBuilder.js');
  const { evaluateProbeTrace } = await import('./faithful-probe-trace.js');
  const { extractCommitmentsFromTrace } = await import('./trace-commitment-helpers.js');
  const fee = options.options.fee ?? defaultDeployerFee(deployer);
  let failure = '';
  for (const reverseTag of [true, false]) {
    const tag = reverseTag
      ? constructorCallTag(categoryId, 0, 0, senderReader, outbase, aOffset, aLength, codeOffset, codeLength)
      : new Uint8Array([
        ...hexToBin(categoryId), 0, 0, 0, 0,
        ...(senderReader ? [
          outbase & 0xff, (outbase >> 8) & 0xff,
          aOffset & 0xff, (aOffset >> 8) & 0xff, aLength & 0xff, (aLength >> 8) & 0xff,
          codeOffset & 0xff, (codeOffset >> 8) & 0xff, codeLength & 0xff, (codeLength >> 8) & 0xff,
        ] : []),
      ]);
    const prototype = unlockingFor(tag);
    const run = await deriveConstructorCalleeRun({
      callee: configured, functionName, args: calleeArgs, slot: 0, categoryId,
      provider: options.options.provider, returnIndex, tag, masterInputIndex: calleeBase,
      createUnlocking: prototype, childMasterLock: masterLock,
    });
    let dataCommitments = Array.from({ length: dataCount }, () => '');
    for (let iteration = 0; iteration < 4; iteration += 1) {
      const outputs: import('../interfaces.js').Output[] = [...leading];
      for (let index = 0; index < dataCount; index += 1) {
        outputs.push({
          to: dataNftAddress, amount: dataNftAmount,
          token: { category: categoryId, amount: 0n,
            nft: { capability: 'mutable', commitment: dataCommitments[index] ?? '' } },
        });
      }
      outputs.push({
        to: masterLock, amount: masterAmount,
        token: { category: categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
      });
      // The layout puts the master before its data records.
      outputs.splice(outbase, 0, outputs.pop()!);
      outputs.push({
        to: run.master.lockingBytecode ?? new Uint8Array(), amount: run.master.satoshis,
        ...(run.master.token === undefined ? {} : { token: run.master.token }),
      });
      run.dataNfts.forEach((utxo, index) => outputs.push({
        to: utxo.lockingBytecode ?? new Uint8Array(), amount: utxo.satoshis,
        token: { category: run.category, amount: 0n,
          nft: { capability: 'mutable', commitment: run.dataCommitments[index] ?? '' } },
      }));
      outputs.push({
        to: Uint8Array.of(0x51), amount: 1000n,
        token: { category: run.category, amount: 0n,
          nft: { capability: 'none', commitment: run.returnCommitment } },
      });
      const deployerUnlocker: Unlocker = {
        generateLockingBytecode: () => hexToBin(deployer.lockingBytecode),
        generateUnlockingBytecode: () => unlockingFor(tag),
      };
      const builder = new TransactionBuilder({
        provider: options.options.provider,
        ...(options.options.maxFee === undefined ? {} : { maximumFeeSatoshis: options.options.maxFee }),
        skipAutomaticCoSpends: true,
      });
      builder.addInput(prep.deployerCoin, deployerUnlocker);
      builder.addInput(prep.authorCoin, options.options.funder);
      let fillerTotal = 0n;
      while (builder.inputs.length < calleeBase) {
        if (prep.changeCoin === undefined || builder.inputs.some(
          (input) => input.txid === prep.changeCoin!.txid && input.vout === prep.changeCoin!.vout,
        )) {
          throw new DeployerPrepError(
            `'${artifact.contractName}' needs a filler input at index ${builder.inputs.length} for its constructor `
            + 'call slot, but the prep left no unused change coin',
          );
        }
        builder.addInput(prep.changeCoin, options.options.funder);
        fillerTotal += prep.changeCoin.satoshis;
      }
      builder.addInput(run.master, {
        generateLockingBytecode: () => run.master.lockingBytecode ?? new Uint8Array(),
        generateUnlockingBytecode: () => run.unlocking,
      });
      run.dataNfts.forEach((utxo) => builder.addInput(utxo, {
        generateLockingBytecode: () => utxo.lockingBytecode ?? new Uint8Array(),
        generateUnlockingBytecode: () => run.dataUnlocking,
      }));
      const outputTotal = outputs.reduce((sum, output) => sum + output.amount, 0n);
      if (prep.authorCoin.satoshis + fillerTotal < outputTotal + fee) {
        throw new DeployerPrepError(
          `The author coin of '${artifact.contractName}' holds ${prep.authorCoin.satoshis} satoshis, but its `
          + `creation needs ${outputTotal + fee}`,
        );
      }
      outputs.forEach((output) => builder.addOutput(output));
      const change = prep.authorCoin.satoshis + fillerTotal - outputTotal - fee;
      if (change >= DUST) builder.addOutput({ to: options.options.changeAddress, amount: change });
      const program = builder.buildLibauthProgram(true);
      const trace = evaluateProbeTrace(options.options.provider, {
        inputIndex: 0, sourceOutputs: program.sourceOutputs, transaction: program.transaction,
      });
      const last = trace[trace.length - 1] as { error?: string } | undefined;
      const next = extractCommitmentsFromTrace(
        trace, dataCount, { min: outbase + 1, max: outbase + 1 + dataCount },
      ) ?? [];
      const changed = next.length === dataCount
        && next.some((commitment, index) => commitment !== dataCommitments[index]);
      if (changed) { dataCommitments = next; continue; }
      if (last?.error === undefined) {
        // The deployer input passes; every callee input must too, then the creation is sent.
        const runs = runDeployerInputsLocal(options.options.provider, program.transaction, program.sourceOutputs);
        const creationHex = binToHex(encodeTransaction(program.transaction));
        if ((globalThis as any).process?.env?.DEBUG_D13) {
          const redeemLength = (() => {
            const instructions = (globalThis as any).__decode?.(run.unlocking) ?? [];
            return instructions.length === 0 ? undefined : instructions[instructions.length - 1].data?.length;
          })();
          console.log('D13', JSON.stringify({
            transactionBytes: creationHex.length / 2,
            operationCosts: runs.map((entry) => ({ input: entry.inputIndex, cost: entry.operationCost.toString() })),
            calleeUnlockingBytes: run.unlocking.length,
            deployerUnlockingBytes: program.transaction.inputs[0].unlockingBytecode.length,
            deployerRedeemBytes: hexToBin(deployer.bytecode).length,
            calleeRedeemBytes: redeemLength,
          }));
        }
        await broadcastDeployerPreps([prep], options.options.provider);
        const creationTxid = await options.options.provider.sendRawTransaction(creationHex);
        releaseDeployerAuthorReservations([prep]);
        return {
          contract: (await import('./StatefulContract.js')).StatefulContract.withCategory(
            contract, categoryId,
          ) as never,
          tx: (await import('../wait.js')).attachWait({
            ...program.transaction, txid: creationTxid, hex: creationHex,
          } as never, options.options.provider),
          categoryId,
          identity: (await import('../bcmr/identity.js')).identityRecord(
            (await import('../bcmr/identity.js')).planGenesisIdentity({
              category: categoryId,
              deployerLock: options.options.senderLockingBytecode
                ?? options.options.funder.generateLockingBytecode(),
            }), creationTxid,
          ),
          prepTransactions: [prep.transactionHex],
        };
      }
      failure = last.error;
      break;
    }
  }
  throw new DeployerPrepError(
    `The creation of '${artifact.contractName}' did not pass its own run: ${failure || 'no tag candidate matched'}`,
  );
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

/**
 * Read the Q ‖ A a creator bound at one deployment (A14 item 4 step 2). The creator's fixed site emits
 * `<Q> <A> <d_in> OP_INPUTBYTECODE`; at that step the two items below the index are exactly Q and A.
 */
export function extractDeployBindingFromTrace(
  trace: readonly AuthenticationProgramStateCommon[], dIn: number,
): { q: Uint8Array; a: Uint8Array; bound: Uint8Array } | undefined {
  for (const state of trace) {
    if (state.instructions[state.ip]?.opcode !== Op.OP_INPUTBYTECODE) continue;
    const stack = state.stack;
    if (stack.length < 3) continue;
    const index = stack[stack.length - 1];
    if (Number(decodeScriptNumber(index)) !== dIn) continue;
    const a = stack[stack.length - 2];
    const q = stack[stack.length - 3];
    return { q, a, bound: new Uint8Array([...q, ...a]) };
  }
  return undefined;
}

/**
 * The top-level deployment of A14 item 3, for the artifact shapes the compiler's deployer produces today: the
 * constructor's scalar state, its transfers and its events. The creation's outputs are derived by the same constructor
 * probe today's genesis uses, then `create` itself runs in the local VM before anything is broadcast.
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
  const { deriveDeployCommitments } = await import('./sc-derive-deploy-commitments.js');
  const { getDataNftAddress, getSatoshiContainerAddress, getTokenContainerAddress } = await import('./covenant-helpers.js');
  const { addressToLockScript } = await import('../utils.js');
  const { StatefulContract } = await import('./StatefulContract.js');
  const { attachWait } = await import('../wait.js');
  const { TransactionBuilder } = await import('../TransactionBuilder.js');

  const changeLockingBytecode = addressToLockScript(options.changeAddress);
  const funderLock = options.funder.generateLockingBytecode();
  const authorLockingBytecode = options.senderLockingBytecode
    ?? (isP2pkhLock(funderLock) ? funderLock : changeLockingBytecode);

  let prep = prepOption;
  if (prep === undefined) {
    const built = await buildDeployerPrep({
      children: [{
        deployer,
        contractName: artifact.contractName,
        // The author coin pays the creation's fee (the caller's, or the default) and, when the constructor
        // co-spends shared side-cars, the change that covers their recreations' fees.
        authorValue: defaultAuthorValue(deployer) + (options.fee ?? 0n)
          + (deployer.sidecars.keccak + deployer.sidecars.ecrecover > 0 ? 20_000n : 0n),
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
  const categoryId = prep.category;
  const contract = new Contract(artifact, constructorArgs as never, {
    provider: options.provider,
    category: hexToBin(categoryId),
  });
  if (contract.lockingBytecode === undefined || !/^[0-9a-fA-F]+$/.test(contract.lockingBytecode)) {
    throw new DeployerPathError(`Contract '${artifact.contractName}' has no master locking bytecode`);
  }
  const masterLock = hexToBin(contract.lockingBytecode);
  const dataNftAddress = getDataNftAddress(contract as never, categoryId);

  const stateLayout = artifact.stateLayout;
  const constructorAbi = artifact.abi.find((entry) => entry.name === '__construct');
  // A14 item 11 runs after the derive below, but its funding facts are needed by the probe: a container row holds
  // the deploy value (the constructor must be payable to state one), and an unfunded row would be zero satoshis.
  // Refuse here so the caller gets the option to pass, not a probe failure.
  if (deployer.satoshiContainer !== 'none') {
    const constructorPayable = constructorAbi?.modifiers?.includes('payable') === true;
    if (!constructorPayable) {
      throw new DeployerPrepError(
        `'${artifact.contractName}' keeps a satoshi container, but its constructor is not payable: the row's `
        + 'satoshis are the deploy value, which only a payable constructor states (pass a payable constructor '
        + 'and initialBalance)',
      );
    }
    if ((options.initialBalance ?? 0n) === 0n) {
      throw new DeployerPrepError(
        `'${artifact.contractName}' has a payable constructor, so its satoshi-container row holds the deploy `
        + 'value; pass initialBalance of at least ' + String(RESERVE),
      );
    }
  }
  const callSlotPath = deployer.callSlots === 1
    && (constructorAbi?.entryAccesses?.length ?? 0) === 0
    && (constructorAbi?.emits?.length ?? 0) === 0
    && (constructorAbi?.transferCount ?? 0) === 0;
  const derived = callSlotPath
    ? {
      stateCommitments: [], entryCommitments: [], trailingEntryCommitments: [], eventCommitments: [],
      dynamicChunkCommitments: {}, valueChunkOutputs: [], transferOutputs: [],
    }
    : await deriveDeployCommitments(
      contract as never, artifact, stateLayout, categoryId, dataNftAddress, 1200n, 1200n, options,
    );
  const commitments = derived.stateCommitments;

  // A14 item 3: output 0 is the category's authhead identity, and `create` pins it when
  // `__internal__identity` is set (B7.12's `emitGenesisIdentityPin`). The genesis range starts after it.
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
  const leading: import('../interfaces.js').Output[] = options.bcmr === undefined
    ? [identity.output]
    : (await import('../bcmr/deployment.js')).leadingOutputs(identity, prepared);
  const outbase = leading.length;
  const masterAmount = options.masterAmount ?? 1200n;
  const dataNftAmount = options.dataNftAmount ?? 1200n;

  // A14 item 5/7: the callee list and the sender parameters. The compiler cannot yet run a constructor with a call
  // slot in the VM (B7.11), and a container row or a collection write is not in its genesis layout yet (B7.9).
  if (deployer.callSlots > 1 || (deployer.callSlots === 1 && !callSlotPath)) {
    throw new DeployerPathError(
      `Contract '${artifact.contractName}' has ${deployer.callSlots} constructor call slots together with `
      + 'collection rows, events or transfers, which the SDK creation probe does not derive yet',
    );
  }
  if (deployer.readsBlockData || deployer.constructorBlockField !== undefined) {
    throw new DeployerPathError(
      `Contract '${artifact.contractName}' needs a constructor block-field probe the compiler's deployer `
      + 'does not build yet',
    );
  }

  const outputs: import('../interfaces.js').Output[] = [...leading];
  const createLayout = deployer.abi.find((entry) => entry.name === 'create')?.blockLayout;
  if (createLayout === undefined) {
    throw new DeployerPathError(`Deployer of '${artifact.contractName}' has no create block layout`);
  }
  const payable = constructorAbi?.modifiers?.includes('payable') === true;
  let deployValue = payable ? (options.initialBalance ?? 0n) : 0n;
  if (deployValue > 0n && deployValue < RESERVE) {
    // A14 item 11: an optional row funded with 1..RESERVE-1 is raised to RESERVE, and the value it holds is the
    // row's amount, so the journal's balance (which the row may not exceed) is raised with it.
    deployValue = RESERVE;
  }
  const constructorEvents = constructorAbi?.emits ?? [];
  const entryCommitments = [...(derived.entryCommitments ?? []), ...(derived.trailingEntryCommitments ?? [])];
  const headCommitment = new Uint8Array(128);
  let entryIndex = 0;
  let dataIndex = 0;
  let eventIndex = 0;
  let transferIndex = 0;
  for (const slot of createLayout.slots) {
    switch (slot.kind) {
      case 'master':
        outputs.push({
          to: masterLock,
          amount: masterAmount,
          token: { category: categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
        });
        break;
      case 'dataNft': {
        const nftIndex = slot.nftIndex ?? dataIndex;
        outputs.push({
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
        const { getEntryNftAddress } = await import('./covenant-helpers.js');
        const commitment = slot.kind === 'head'
          ? headCommitment
          : entryCommitments[entryIndex];
        if (slot.kind === 'entry') entryIndex += 1;
        if (commitment === undefined) {
          throw new DeployerPrepError(
            `The constructor's write to '${collection}' has no derived entry commitment`,
          );
        }
        outputs.push({
          to: getEntryNftAddress(contract as never, categoryId, collection),
          amount: dataNftAmount,
          token: { category: categoryId, amount: 0n,
            nft: { capability: 'mutable',
              commitment: typeof commitment === 'string' ? commitment : binToHex(commitment) } },
        });
        break;
      }
      case 'satoshiContainer':
        // A required row also holds RESERVE: it is the container's own opening balance (A5).
        outputs.push({
          to: getSatoshiContainerAddress(contract as never, categoryId),
          amount: deployer.satoshiContainer === 'required' ? RESERVE + deployValue : deployValue,
        });
        break;
      case 'tokenContainer': {
        const tokenRow = slot.slotIndex;
        if (tokenRow === undefined) throw new DeployerPathError('A token container slot names no parameter');
        const name = artifact.constructorInputs[tokenRow]?.name ?? `parameter ${tokenRow}`;
        const supplied = options.tokenContainers?.find(({ utxo }) => utxo.token !== undefined
          && utxo.token.category.toLowerCase() === String(constructorArgs[tokenRow] ?? '').toLowerCase());
        if (supplied === undefined) {
          throw new DeployerPrepError(
            `'${artifact.contractName}' keeps its token container '${name}' single; pass a coin of its category `
            + 'in tokenContainers',
          );
        }
        outputs.push({
          to: getTokenContainerAddress(contract as never, categoryId, supplied.utxo.token!.category),
          amount: supplied.utxo.satoshis,
          token: { category: supplied.utxo.token!.category, amount: supplied.utxo.token!.amount },
        });
        break;
      }
      case 'event':
      case 'eventChunk': {
        const emitInfo = constructorEvents[eventIndex];
        if (emitInfo === undefined) {
          throw new DeployerPathError(`'${artifact.contractName}' has an event slot the constructor does not emit`);
        }
        const { getEventNftAddress } = await import('./covenant-helpers.js');
        outputs.push({
          to: getEventNftAddress(contract as never, categoryId, emitInfo.eventSignature),
          amount: dataNftAmount,
          token: { category: categoryId, amount: 0n,
            nft: { capability: 'none', commitment: derived.eventCommitments?.[eventIndex] ?? '' } },
        });
        if (slot.kind === 'event') eventIndex += 1;
        break;
      }
      case 'keccakSideCar':
      case 'ecrecoverSideCar':
        // A4.4 places the side-car group at the side-car base, after the genesis range; the side-car block below
        // appends both its inputs and its recreated outputs.
        break;
      case 'transfer':
      case 'tcTransfer': {
        const transfer = derived.transferOutputs?.[transferIndex];
        if (transfer === undefined) {
          throw new DeployerPathError(`'${artifact.contractName}' has a transfer slot the constructor does not send`);
        }
        outputs.push({ to: transfer.lockingBytecode, amount: transfer.amount });
        transferIndex += 1;
        break;
      }
      default:
        throw new DeployerPathError(
          `The create layout of '${artifact.contractName}' has a slot kind (${slot.kind}) this deployment does `
          + 'not build',
        );
    }
  }
  if (outputs.length !== leading.length + deployer.genesisOutputs) {
    throw new DeployerPrepError(
      `The creation of '${artifact.contractName}' laid out ${outputs.length - leading.length} genesis outputs, but `
      + `its deployer pins ${deployer.genesisOutputs}`,
    );
  }

  // The create's public parameters: C's contract parameters, then its constructor parameters.
  const publicNames = (createInputNames(deployer) ?? []).filter((name) => !name.startsWith('__internal__'));
  const args: Record<string, FunctionArgument> = {};
  const contractParameters = artifact.constructorInputs.length;
  publicNames.forEach((name, index) => {
    const value = index < contractParameters ? constructorArgs[index] : options.initArgs?.[index - contractParameters];
    if (value === undefined) throw new DeployerPrepError(`The deployer create input '${name}' has no value`);
    args[name] = value as FunctionArgument;
  });

  if (callSlotPath) {
    return deployThroughCallSlot({
      artifact, constructorArgs, options, prep, contract, deployer, categoryId, masterLock, dataNftAddress,
      leading, outbase, args, deployValue, masterAmount, dataNftAmount, stateLayout, constructorAbi,
    });
  }

  const calleeRuns: Array<ConstructorCalleeRun & { inputIndex: number }> = [];
  let callSynthetics: Record<string, bigint> = {};
  let calleeList: Array<number | undefined> = Array.from({ length: deployer.callSlots }, () => undefined);

  const deployerUnlocker: Unlocker = {
    generateLockingBytecode: () => hexToBin(deployer.lockingBytecode),
    generateUnlockingBytecode: () => buildDeployerUnlocking({
      deployer,
      callees: calleeList,
      args,
      value: deployValue,
      senderCategory: new Uint8Array(32),
      authorIndex: 1,
      identity: true,
      budgetPad: new Uint8Array(),
      synthetic: {
        __internal__genesisOutputBase: BigInt(outbase),
        __internal__genesisSidecarBase: BigInt(outbase + deployer.genesisOutputs),
        ...callSynthetics,
      },
      forBroadcast: true,
    }),
  };

  const builder = new TransactionBuilder({
    provider: options.provider,
    ...(options.maxFee === undefined ? {} : { maximumFeeSatoshis: options.maxFee }),
    skipAutomaticCoSpends: true,
  });
  builder.addInput(prep.deployerCoin, deployerUnlocker);
  builder.addInput(prep.authorCoin, options.funder);
  for (const run of calleeRuns) {
    if (builder.inputs.length !== run.inputIndex) {
      throw new DeployerPrepError(
        `'${artifact.contractName}' cannot place its callee at input ${run.inputIndex}`,
      );
    }
    builder.addInput(run.master, {
      generateLockingBytecode: () => run.master.lockingBytecode ?? new Uint8Array(),
      generateUnlockingBytecode: () => run.unlocking,
    });
    run.dataNfts.forEach((utxo) => builder.addInput(utxo, {
      generateLockingBytecode: () => utxo.lockingBytecode ?? new Uint8Array(),
      generateUnlockingBytecode: () => Uint8Array.of(0x51),
    }));
  }
  // A4.4 aligns the sidecar group at the same input and output index. The identity output shifts the outputs but
  // has no input, so a sidecar-bearing creation spends the prep's own change coin as the neutral filler. It is a
  // real wallet coin at the change lock, and its value returns in the change output.
  const fillers: Utxo[] = [];
  if (deployer.sidecars.keccak + deployer.sidecars.ecrecover > 0 && outbase > 0) {
    if (prep.changeCoin === undefined) {
      throw new DeployerPrepError(
        `'${artifact.contractName}' has constructor side-cars and a leading identity output, which needs a filler `
        + 'input; the prep left no change coin to use as one',
      );
    }
    fillers.push(prep.changeCoin);
    builder.addInput(prep.changeCoin, options.funder);
  }
  const outputTotal = outputs.reduce((sum, output) => sum + output.amount, 0n);
  // The creation carries Deploy<C>'s whole unlocking, so its fee must cover that size at 1 sat/B even when the
  // caller states no fee. A caller's own fee still wins.
  const provisionalFee = options.fee ?? defaultDeployerFee(deployer);
  if (prep.authorCoin.satoshis < outputTotal + provisionalFee) {
    throw new DeployerPrepError(
      `The author coin of '${artifact.contractName}' holds ${prep.authorCoin.satoshis} satoshis, but its creation `
        + `needs ${outputTotal + provisionalFee}`,
    );
  }
  for (const output of outputs) builder.addOutput(output);

  // A14 item 6: the deployer's constructor side-cars come from the shared pool, at salt 0, already on the network.
  // Each is spent and recreated at the same index after the genesis range (A4.4), so the deployer's create can read
  // it. A missing shared coin is refused rather than minted: the pool is one for every deployment.
  if (deployer.sidecars.ecrecover > 0) {
    throw new DeployerSidecarError('ecrecover');
  }
  if (deployer.sidecars.keccak > 0) {
    const { keccakComputeLockingBytecode } = await import('@solidcash/utils');
    const { buildKeccakComputeSidecar } = await import('../keccak/keccakComputeSidecar.js');
    const zeroSalt = new Uint8Array(32);
    const sharedLock = keccakComputeLockingBytecode(zeroSalt, true);
    const pool = (await options.provider.getUtxosForLockingBytecode(sharedLock))
      .filter((utxo) => utxo.token?.nft?.capability === 'mutable');
    const params = constructorAbi?.keccakPreimageParams ?? [];
    const visible = constructorAbi?.inputs.filter((input) => !input.name.startsWith('__internal__')) ?? [];
    const visibleArgs = [...constructorArgs, ...(options.initArgs ?? [])];
    const preimages = params.map((name) => {
      const index = name === undefined ? -1 : visible.findIndex((input) => input.name === name);
      const value = index >= 0 ? visibleArgs[index] : undefined;
      return value instanceof Uint8Array ? value : null;
    });
    if (preimages.some((preimage) => preimage === null)) {
      throw new DeployerPrepError(
        `'${artifact.contractName}' hashes a constructor value the SDK cannot replay; pass it as a byte argument`,
      );
    }
    const batches = Math.ceil(preimages.length / 3);
    if (pool.length < batches) throw new DeployerSidecarError('keccak');
    for (let batch = 0; batch < batches; batch += 1) {
      const sidecar = buildKeccakComputeSidecar(
        preimages.slice(batch * 3, batch * 3 + 3) as Uint8Array[], zeroSalt, pool[batch], true,
      );
      builder.addInput(pool[batch], sidecar.unlocker);
      builder.addOutput(sidecar.recreate);
    }
  }

  const fillerTotal = fillers.reduce((sum, filler) => sum + filler.satoshis, 0n);
  const change = prep.authorCoin.satoshis + fillerTotal - outputTotal - provisionalFee;
  if (change >= DUST) builder.addOutput({ to: options.changeAddress, amount: change });
  const locktime = await deployerLocktime(deployer, options.provider);
  if (locktime !== undefined) builder.setLocktime(locktime);

  const { transaction, sourceOutputs } = builder.buildLibauthProgram(true);
  runDeployerInputsLocal(options.provider, transaction, sourceOutputs);
  const creationHex = binToHex(encodeTransaction(transaction));

  const preps = [prep];
  await broadcastDeployerPreps(preps, options.provider);
  const creationTxid = await options.provider.sendRawTransaction(creationHex);
  releaseDeployerAuthorReservations(preps);
  // Decode the constructor's events from the creation's outputs, so a caller sees them like a call receipt.
  const receiptEvents: import('../interfaces.js').ReceiptEvent[] = [];
  if (constructorEvents.length > 0) {
    const { getEventNftAddress } = await import('./covenant-helpers.js');
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
