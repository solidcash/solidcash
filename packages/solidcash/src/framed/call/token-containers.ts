/**
 * A framed contract's token containers (spec 4b): fungible tokens of another category at the contract's container
 * lock for it. A frame that pays from one spends one container, recreates it with what its sends do not pay, and lists
 * the sends right after; the master reads both from the container's own index.
 */
import { encodeLockingBytecodeP2pkh } from '@bitauth/libauth/build/lib/address/locking-bytecode.js';
import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  bigIntToVmNumber, vmNumberToBigInt,
} from '@bitauth/libauth/build/lib/vm/instruction-sets/common/instruction-sets-utils.js';
import {
  buildTokenContainerCovenantScript, scriptToBytecode, sha256, type AbiFunction, type Artifact, type StateLayout,
} from '@solidcash/utils';
import { encodeFunctionArgument, type FunctionArgument } from '../../Argument.js';
import type { Utxo } from '../../interfaces.js';
import type NetworkProvider from '../../network/NetworkProvider.js';
import { tokenContainerKeyValue } from '../../stateful/sc-load-create-builder-token-containers.js';
import { StateReader } from '../../stateful/StateReader.js';
import { createUnlockingBytecode, scriptToLockingBytecode } from '../../utils.js';

/** The accounted container of a framed contract that pays tokens: no master lock, the amount the master's to keep. */
function accountedCovenant(categoryId: string, tokenCategory: string): ReturnType<typeof buildTokenContainerCovenantScript> {
  return buildTokenContainerCovenantScript(hexToBin(categoryId), hexToBin(tokenCategory), undefined, { accounted: true });
}

/** The lock of a framed contract's container for `tokenCategory`. */
export function framedTokenContainerLockingBytecode(categoryId: string, tokenCategory: string): Uint8Array {
  return scriptToLockingBytecode(accountedCovenant(categoryId, tokenCategory), 'p2sh32');
}

/** A container's unlocking on its master path: the minting NFT at `masterInputIndex` authorizes the spend. */
export function framedTokenContainerUnlockingBytecode(
  categoryId: string, tokenCategory: string, masterInputIndex: number,
): Uint8Array {
  const bytecode = scriptToBytecode(accountedCovenant(categoryId, tokenCategory));
  const args = [1n, BigInt(masterInputIndex)].map((value) => encodeFunctionArgument(value, 'bigint') as Uint8Array);
  return createUnlockingBytecode('p2sh32', bytecode, args);
}

/** The fungible amount a token send carries until the body's own pin hands back the one it computed. */
const TOKEN_SEND_AMOUNT_SENTINEL = 7_654_321_987_654_321n;

/** A fungible send's lock and amount as a frame's own pin handed them back. */
export interface LearnedTokenSend {
  readonly lock?: Uint8Array;
  readonly amount?: bigint;
}

/** An NFT send's lock, commitment and capability (0 none, 1 mutable, 2 minting) as its pins handed them back. */
export interface LearnedNftSend {
  readonly lock?: Uint8Array;
  readonly commitment?: Uint8Array;
  readonly capability?: number;
}

/** What a run's sends learned: its fungible sends, then its NFT sends, in the order its window lists them. */
export interface LearnedRun {
  readonly sends: readonly LearnedTokenSend[];
  readonly nfts: readonly LearnedNftSend[];
}

/** A run whose sends learned nothing yet. */
export function unlearnedRun(sends: number, nftSends: number): LearnedRun {
  return { sends: Array.from({ length: sends }, () => ({})), nfts: Array.from({ length: nftSends }, () => ({})) };
}

/** The fields each send of a run starts from until the body's own pin hands back what it computed. */
export interface TokenSendSentinels {
  readonly locks: readonly Uint8Array[];
  readonly amounts: readonly bigint[];
  readonly nftLocks: readonly Uint8Array[];
  readonly nftCommitments: readonly Uint8Array[];
}

/**
 * The lock and amount each fungible send of a frame's run starts from, and the lock and commitment each NFT send
 * starts from, until the body's own pin hands back what it computed: distinct per contract, entry, frame and run, so
 * a close names the send it is about. An NFT send starts as an immutable NFT, which its category pin corrects.
 */
export function framedTokenSendSentinels(
  contractName: string, entryName: string, master: string, run: number, sends: number, nftSends = 0,
): TokenSendSentinels {
  const digest = (label: string, position: number): Uint8Array => sha256(new TextEncoder().encode(
    `framed token send ${label}\u0000${contractName}\u0000${entryName}\u0000${master}\u0000${run}\u0000${position}`,
  ));
  const positions = (count: number): number[] => Array.from({ length: count }, (_unused, position) => position);
  return {
    locks: positions(sends).map((position) => encodeLockingBytecodeP2pkh(digest('lock', position).slice(0, 20))),
    amounts: positions(sends).map((position) => TOKEN_SEND_AMOUNT_SENTINEL
      + BigInt(sha256(new TextEncoder().encode(`${master}\u0000${run}`))[0]!) * 1_000n + BigInt(position)),
    nftLocks: positions(nftSends).map((position) => encodeLockingBytecodeP2pkh(digest('nft lock', position).slice(0, 20))),
    nftCommitments: positions(nftSends).map((position) => digest('nft commitment', position).slice(0, 20)),
  };
}

/**
 * A run's learned sends with the one a failing close is about learned, or undefined when the close is about none of
 * them. The close leaves the listed output's field, a sentinel, above the value the body computed. An NFT send's
 * category pin runs before its lock pin, so a category the body computed for `categoryInternal` belongs to the first
 * NFT send whose lock is not learned, and a lock pin reached confirms the capability it was listed with.
 */
export function learnTokenSend(
  sentinels: TokenSendSentinels,
  learned: LearnedRun,
  declared: Uint8Array,
  computed: Uint8Array,
  categoryInternal: Uint8Array,
): LearnedRun | undefined {
  const equal = (left: Uint8Array, right: Uint8Array): boolean =>
    left.length === right.length && left.every((byte, at) => byte === right[at]);
  const byLock = sentinels.locks.findIndex((lock) => equal(lock, declared));
  if (byLock >= 0) {
    return { ...learned, sends: learned.sends.map((send, at) => (at === byLock ? { ...send, lock: computed } : send)) };
  }
  const byAmount = sentinels.amounts.findIndex((amount) => equal(bigIntToVmNumber(amount), declared));
  const amount = vmNumberToBigInt(computed);
  if (byAmount >= 0 && typeof amount === 'bigint') {
    return { ...learned, sends: learned.sends.map((send, at) => (at === byAmount ? { ...send, amount } : send)) };
  }
  const nftLock = sentinels.nftLocks.findIndex((lock) => equal(lock, declared));
  if (nftLock >= 0) {
    return { ...learned, nfts: learned.nfts.map((nft, at) => (at === nftLock
      ? { ...nft, lock: computed, capability: nft.capability ?? 0 } : nft)) };
  }
  const nftCommitment = sentinels.nftCommitments.findIndex((commitment) => equal(commitment, declared));
  if (nftCommitment >= 0) {
    return {
      ...learned, nfts: learned.nfts.map((nft, at) => (at === nftCommitment ? { ...nft, commitment: computed } : nft)),
    };
  }
  const ofCategory = (bytes: Uint8Array): boolean => (bytes.length === 32 || bytes.length === 33)
    && equal(bytes.slice(0, 32), categoryInternal);
  const pending = learned.nfts.findIndex((nft) => nft.lock === undefined);
  if (pending >= 0 && ofCategory(declared) && ofCategory(computed) && !equal(declared, computed)) {
    return { ...learned, nfts: learned.nfts.map((nft, at) => (at === pending
      ? { ...nft, capability: computed.length === 33 ? computed[32]! : 0 } : nft)) };
  }
  return undefined;
}

/** The capability name an NFT send's learned capability stands for. */
export function nftCapabilityName(capability: number | undefined): 'none' | 'mutable' | 'minting' {
  return capability === 2 ? 'minting' : capability === 1 ? 'mutable' : 'none';
}

/** True for a token the VM sees as an NFT: one with a capability, or with a commitment. */
export function visibleNft(token: Utxo['token']): boolean {
  return token?.nft !== undefined && (token.nft.capability !== 'none' || token.nft.commitment.length > 0);
}

/** One container access of an entry, resolved for a call: its category, lock and the sends the body makes from it. */
export interface FramedTokenAccess {
  /** The category, in the order the key holds it (hex). */
  readonly category: string;
  readonly lockingBytecode: Uint8Array;
  /** The fungible sends the entry's source makes from this container. */
  readonly sends: number;
  /** The NFT sends the entry's source makes from this container. */
  readonly nftSends: number;
  /** True when the entry reads the containers' amount, which sums the containers a transaction spends. */
  readonly reads: boolean;
  /** True when the entry reads the output side of the amount, crediting what reached its containers. */
  readonly readsOutput: boolean;
  /** The contract's containers for the category: fungible only, largest first. */
  readonly containers: readonly Utxo[];
  /** The contract's containers for the category that hold an NFT the VM sees, in outpoint order. */
  readonly nftContainers: readonly Utxo[];
}

/**
 * The containers an entry names, each resolved from a parameter, the contract's own category, or the immutable state
 * variable the artifact publishes as the key, read from the deployment's records.
 */
export async function framedTokenAccesses(options: {
  readonly provider: NetworkProvider;
  readonly entry: AbiFunction | undefined;
  readonly categoryId: string;
  readonly args: readonly FunctionArgument[];
  readonly stateLayout: StateLayout;
  readonly records: readonly Utxo[];
}): Promise<readonly FramedTokenAccess[]> {
  const accesses = options.entry?.tokenContainerAccesses ?? [];
  if (accesses.length === 0) return [];
  const state = accesses.some((access) => access.keySource === 'state')
    ? new StateReader(options.stateLayout).readState([...options.records])
    : undefined;
  return Promise.all(accesses.map(async (access) => {
    const keyIndex = (options.entry?.inputs ?? []).findIndex((input) => input.name === access.keyParam);
    const key = tokenContainerKeyValue(access, options.categoryId, options.args, keyIndex, state);
    if (!(key instanceof Uint8Array) || key.length !== 32) {
      throw new Error(`token container key '${access.keyParam}' does not resolve to a 32-byte category`);
    }
    const category = binToHex(key);
    const lockingBytecode = framedTokenContainerLockingBytecode(options.categoryId, category);
    const held = (await options.provider.getUtxosForLockingBytecode(lockingBytecode))
      .filter((utxo) => utxo.token?.category === category);
    const outpoint = (utxo: Utxo): string => `${utxo.txid}:${utxo.vout}`;
    const containers = held.filter((utxo) => utxo.token!.nft === undefined && utxo.token!.amount > 0n)
      .sort((left, right) => (left.token!.amount === right.token!.amount
        ? outpoint(left).localeCompare(outpoint(right))
        : left.token!.amount > right.token!.amount ? -1 : 1));
    const nftContainers = held.filter((utxo) => visibleNft(utxo.token))
      .sort((left, right) => outpoint(left).localeCompare(outpoint(right)));
    const sends = access.transferCount ?? (access.operations.includes('transfer') ? 1 : 0);
    const nftSends = access.transferNftCount ?? (access.operations.includes('transferNft') ? 1 : 0);
    return {
      category, lockingBytecode, sends, nftSends, reads: access.operations.includes('read'),
      readsOutput: access.readsOutput === true, containers, nftContainers,
    };
  }));
}

/**
 * The containers a callee frame's entry names, resolved as the root's are: a key of its own category, of its state,
 * read from the callee's own records, or of an argument, read from the arguments its call passes.
 */
export async function framedCalleeTokenAccesses(options: {
  readonly provider: NetworkProvider;
  readonly artifact: Artifact;
  readonly entry: string;
  readonly categoryId: string;
  readonly args: readonly FunctionArgument[];
  readonly records: readonly { readonly commitment: Uint8Array; readonly satoshis: bigint }[];
}): Promise<readonly FramedTokenAccess[]> {
  const abi = options.artifact.abi.find((candidate) => candidate.name === options.entry);
  if ((abi?.tokenContainerAccesses ?? []).length === 0) return [];
  const records = options.records.map((record, at) => ({
    txid: `${at}`.padStart(64, '0'), vout: 0, satoshis: record.satoshis,
    token: {
      category: options.categoryId, amount: 0n,
      nft: { capability: 'mutable' as const, commitment: binToHex(record.commitment) },
    },
  }));
  return framedTokenAccesses({
    provider: options.provider,
    entry: abi,
    categoryId: options.categoryId,
    args: options.args,
    stateLayout: options.artifact.stateLayout!,
    records,
  });
}
