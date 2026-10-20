/**
 * A framed contract's token containers (spec 4b): fungible tokens of another category at the contract's container
 * lock for it. A frame that pays from one spends one container, recreates it with what its sends do not pay, and lists
 * the sends right after; the master reads both from the container's own index.
 */
import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  buildTokenContainerCovenantScript, scriptToBytecode, type AbiFunction, type StateLayout,
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
