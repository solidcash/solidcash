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

/**
 * The lock and amount each send of a frame's run starts from, until the body's own pin hands back what it computed:
 * distinct per contract, entry, frame and run, so a close names the send it is about.
 */
export function framedTokenSendSentinels(
  contractName: string, entryName: string, master: string, run: number, sends: number,
): { readonly locks: readonly Uint8Array[]; readonly amounts: readonly bigint[] } {
  const positions = Array.from({ length: sends }, (_unused, position) => position);
  return {
    locks: positions.map((position) => encodeLockingBytecodeP2pkh(sha256(new TextEncoder().encode(
      `framed token send lock\u0000${contractName}\u0000${entryName}\u0000${master}\u0000${run}\u0000${position}`,
    )).slice(0, 20))),
    amounts: positions.map((position) => TOKEN_SEND_AMOUNT_SENTINEL
      + BigInt(sha256(new TextEncoder().encode(`${master}\u0000${run}`))[0]!) * 1_000n + BigInt(position)),
  };
}

/**
 * A run's sends with the one a failing close is about learned, or undefined when the close is about none of them.
 * The close leaves the listed output's field, a sentinel, above the value the body computed.
 */
export function learnTokenSend(
  sentinels: { readonly locks: readonly Uint8Array[]; readonly amounts: readonly bigint[] },
  sends: readonly { readonly lock?: Uint8Array; readonly amount?: bigint }[],
  declared: Uint8Array,
  computed: Uint8Array,
): readonly { readonly lock?: Uint8Array; readonly amount?: bigint }[] | undefined {
  const equal = (left: Uint8Array, right: Uint8Array): boolean =>
    left.length === right.length && left.every((byte, at) => byte === right[at]);
  const byLock = sentinels.locks.findIndex((lock) => equal(lock, declared));
  if (byLock >= 0) {
    return sends.map((send, at) => (at === byLock ? { ...send, lock: Uint8Array.from(computed) } : send));
  }
  const byAmount = sentinels.amounts.findIndex((amount) => equal(bigIntToVmNumber(amount), declared));
  const amount = vmNumberToBigInt(computed);
  if (byAmount >= 0 && typeof amount === 'bigint') {
    return sends.map((send, at) => (at === byAmount ? { ...send, amount } : send));
  }
  return undefined;
}

/** One container access of an entry, resolved for a call: its category, lock and the sends the body makes from it. */
export interface FramedTokenAccess {
  /** The category, in the order the key holds it (hex). */
  readonly category: string;
  readonly lockingBytecode: Uint8Array;
  /** The fungible sends the entry's source makes from this container. */
  readonly sends: number;
  /** The contract's containers for the category: fungible only, largest first. */
  readonly containers: readonly Utxo[];
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
    const containers = (await options.provider.getUtxosForLockingBytecode(lockingBytecode))
      .filter((utxo) => utxo.token?.category === category && utxo.token.nft === undefined && utxo.token.amount > 0n)
      .sort((left, right) => (left.token!.amount > right.token!.amount ? -1 : 1));
    const sends = access.transferCount ?? (access.operations.includes('transfer') ? 1 : 0);
    return { category, lockingBytecode, sends, containers };
  }));
}

/**
 * The containers a callee frame's entry pays from, resolved from the callee's own records: a key of its own category
 * or of its state. A key a call argument names is refused by name.
 */
export async function framedCalleeTokenAccesses(options: {
  readonly provider: NetworkProvider;
  readonly artifact: Artifact;
  readonly entry: string;
  readonly categoryId: string;
  readonly records: readonly { readonly commitment: Uint8Array; readonly satoshis: bigint }[];
}): Promise<readonly FramedTokenAccess[]> {
  const abi = options.artifact.abi.find((candidate) => candidate.name === options.entry);
  const paying = (abi?.tokenContainerAccesses ?? []).filter((access) =>
    (access.transferCount ?? (access.operations.includes('transfer') ? 1 : 0)) > 0
    || access.operations.includes('transferNft'));
  if (paying.length === 0) return [];
  const argumentKeyed = paying.find((access) => access.keySource !== 'state' && access.keySource !== 'own');
  if (argumentKeyed !== undefined) {
    throw new Error(`the callee "${options.entry}" pays tokens of the category its argument `
      + `'${argumentKeyed.keyParam}' names, which this call path does not plan for a callee yet`);
  }
  const records = options.records.map((record, at) => ({
    txid: `${at}`.padStart(64, '0'), vout: 0, satoshis: record.satoshis,
    token: {
      category: options.categoryId, amount: 0n,
      nft: { capability: 'mutable' as const, commitment: binToHex(record.commitment) },
    },
  }));
  return framedTokenAccesses({
    provider: options.provider,
    entry: abi === undefined ? undefined : { ...abi, tokenContainerAccesses: paying },
    categoryId: options.categoryId,
    args: [],
    stateLayout: options.artifact.stateLayout!,
    records,
  });
}
