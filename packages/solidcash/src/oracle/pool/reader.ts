import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  ORACLE_POOL_PARAMETER, POOL_FLAG_SLOT, decodePoolInfoCommitment, oraclePoolBinding, poolInfoReadUnlocking,
  poolSlotReadUnlocking, type AbiFunction, type Artifact,
} from '@solidcash/utils';
import type { LibauthOutput, UnlockableUtxo, Utxo } from '../../interfaces.js';
import type NetworkProvider from '../../network/NetworkProvider.js';
import { checkPoolCategory, poolLocks } from './coins.js';
import { selectPoolInfoCoin } from './select.js';

// A direct reader's side of an oracle pool: the `__oraclePool` constructor input that binds it to a pool, and the
// block-info coin or ring slots of that pool a read co-spends. A read checks a coin's category, capability and flags,
// no lock.

type ConstructorShape = Pick<Artifact, 'constructorInputs' | 'contractName'>;

/** Position of the hidden `__oraclePool` constructor input, or -1 when the artifact takes none. */
export function oraclePoolInputIndex(artifact: Pick<Artifact, 'constructorInputs'>): number {
  return artifact.constructorInputs.findIndex((input) => input.name === ORACLE_POOL_PARAMETER);
}

/** Whether the artifact takes the pool binding. */
export function takesOraclePool(artifact: Pick<Artifact, 'constructorInputs'>): boolean {
  return oraclePoolInputIndex(artifact) >= 0;
}

/**
 * Whether the artifact reads block.* only in bodies a function pointer enters. No entry then takes a coin index or
 * a slot: each read finds the first block-info coin of the pool itself, so every call co-spends one.
 */
export function readsPoolOnlyIndirectly(artifact: Pick<Artifact, 'abi' | 'usesBlockOracle'>): boolean {
  return artifact.usesBlockOracle === true && !artifact.abi.some((fn) => fn.usesBlockOracle === true);
}

/** The pool coin kinds a call of `fn` co-spends for function-pointer targets, which find them without a slot. */
export interface IndirectPoolReads {
  readonly blockInfo: boolean;
  readonly blockhash: boolean;
}

/**
 * The kinds the entry `fn` publishes. An artifact that publishes none for any entry predates the field: there every
 * call co-spends an info coin when the artifact reads block.* only indirectly.
 */
export function indirectPoolReads(
  artifact: Pick<Artifact, 'abi' | 'usesBlockOracle'>, fn: Pick<AbiFunction, 'indirectPoolReads'> | undefined,
): IndirectPoolReads {
  if (artifact.abi.some((entry) => entry.indirectPoolReads !== undefined)) {
    return { blockInfo: fn?.indirectPoolReads?.blockInfo === true, blockhash: fn?.indirectPoolReads?.blockhash === true };
  }
  return { blockInfo: readsPoolOnlyIndirectly(artifact), blockhash: false };
}

/**
 * The constructor arguments with `oraclePoolBinding(category())` appended when the artifact takes the binding last
 * and the caller left it out. Any other count is returned as given, and `category` is not called.
 */
export function withOraclePoolArgument<T>(
  artifact: ConstructorShape, args: readonly T[], category: () => string | undefined,
): (T | Uint8Array)[] {
  const index = oraclePoolInputIndex(artifact);
  if (index < 0 || index !== artifact.constructorInputs.length - 1 || args.length !== index) return [...args];
  const pool = category();
  if (pool === undefined) {
    throw new Error(
      `${artifact.contractName} reads block.* through an oracle pool: pass oraclePool, or use a provider with a `
      + 'default pool',
    );
  }
  return [...args, oraclePoolBinding(hexToBin(checkPoolCategory(pool)))];
}

/** The pool (category, display order) an encoded `__oraclePool` argument names, or undefined. */
export function boundOraclePool(
  artifact: Pick<Artifact, 'constructorInputs'>, encodedArgs: readonly Uint8Array[],
): string | undefined {
  const index = oraclePoolInputIndex(artifact);
  const value = index < 0 ? undefined : encodedArgs[index];
  return value?.length === 32 ? binToHex(value.slice().reverse()) : undefined;
}

/** Whether a coin passes a read's check for pool `category`: a mutable NFT of it whose flags byte is 0x00. */
export function isPoolInfoInput(utxo: Pick<Utxo, 'token'>, category: string): boolean {
  const { token } = utxo;
  return token?.nft?.capability === 'mutable' && token.category.toLowerCase() === category.toLowerCase()
    && token.nft.commitment.slice(0, 2) === '00';
}

/** `isPoolInfoInput` over a spent output, as an unlocker sees it. */
export function isPoolInfoOutput(output: LibauthOutput, category: string): boolean {
  const { token } = output;
  return token?.nft?.capability === 'mutable' && binToHex(token.category) === category.toLowerCase()
    && token.nft.commitment[0] === 0;
}

/** An info coin of pool `category`, unlocked by its read path, which recreates it at its own index. */
export function poolInfoUnlockable(utxo: Utxo, category: string): UnlockableUtxo {
  const locks = poolLocks(category);
  const unlocking = poolInfoReadUnlocking(locks.category);
  return {
    ...utxo,
    lockingBytecode: locks.info,
    unlocker: { generateLockingBytecode: () => locks.info, generateUnlockingBytecode: () => unlocking },
  };
}

/** Whether a coin passes a blockhash read's check for pool `category`: a mutable NFT of it whose flags byte is 0x80. */
export function isPoolSlotInput(utxo: Pick<Utxo, 'token'>, category: string): boolean {
  const { token } = utxo;
  return token?.nft?.capability === 'mutable' && token.category.toLowerCase() === category.toLowerCase()
    && token.nft.commitment.slice(0, 2) === POOL_FLAG_SLOT.toString(16);
}

/** `isPoolSlotInput` over a spent output, as an unlocker sees it. */
export function isPoolSlotOutput(output: LibauthOutput, category: string): boolean {
  const { token } = output;
  return token?.nft?.capability === 'mutable' && binToHex(token.category) === category.toLowerCase()
    && token.nft.commitment[0] === POOL_FLAG_SLOT;
}

/** A ring slot of pool `category`, unlocked by its read path, which recreates it at its own index. */
export function poolSlotUnlockable(utxo: Utxo, category: string): UnlockableUtxo {
  const locks = poolLocks(category);
  const unlocking = poolSlotReadUnlocking(locks.category);
  return {
    ...utxo,
    lockingBytecode: locks.slot,
    unlocker: { generateLockingBytecode: () => locks.slot, generateUnlockingBytecode: () => unlocking },
  };
}

/** The coin each pool's readers last co-spent, per provider, so the readers of one build share one coin. */
const chosenInfoCoins = new WeakMap<object, Map<string, Utxo>>();

async function chooseInfoCoin(provider: NetworkProvider, category: string): Promise<Utxo> {
  const key = checkPoolCategory(category);
  let chosen = chosenInfoCoins.get(provider);
  if (chosen === undefined) {
    chosen = new Map();
    chosenInfoCoins.set(provider, chosen);
  }
  const coin = await selectPoolInfoCoin(provider, key, chosen.get(key));
  if (coin === undefined) throw new Error(`oracle pool ${key} has no live block-info coin`);
  chosen.set(key, coin.utxo);
  return coin.utxo;
}

/**
 * A live info coin of pool `category` for a read to co-spend, chosen by `selectPoolInfoCoin`. The coin chosen last
 * stays chosen while it is live, so every reader of a transaction, and each probe of it, spends the same one.
 */
export async function poolInfoCoSpend(provider: NetworkProvider, category: string): Promise<UnlockableUtxo> {
  return poolInfoUnlockable(await chooseInfoCoin(provider, category), category);
}

/** The timestamp a read of pool `category` slices: that of the coin `poolInfoCoSpend` co-spends. */
export async function readPoolTimestamp(provider: NetworkProvider, category: string): Promise<bigint> {
  const coin = await chooseInfoCoin(provider, category);
  return decodePoolInfoCommitment(hexToBin(coin.token!.nft!.commitment)).timestamp;
}

/** The pool each artifact was last bound to, for a recipe that runs in an implementation's context. */
const poolsByArtifact = new WeakMap<object, string>();

export function bindArtifactOraclePool(artifact: object, category: string): void {
  poolsByArtifact.set(artifact, category);
}

export function artifactOraclePool(artifact: object): string | undefined {
  return poolsByArtifact.get(artifact);
}
