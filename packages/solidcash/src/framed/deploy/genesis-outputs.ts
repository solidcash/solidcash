/**
 * A child's genesis, as the list of outputs a creator's transaction mints for it.
 *
 * A framed deployment builds these outputs for its own genesis transaction (`framed/deploy/stateful.ts` is the
 * oracle this mirrors). A CREATOR mints them inside its own transaction instead, appended after the frames it runs,
 * so the same list has to be available without a transaction around it: the child's master pool at each entry lock,
 * the validator pool at `addrV(category)`, the tokenless facet UTXOs, the state records the constructor's frame
 * computed, the entries and chunks it wrote, the events it emitted, and the authhead at output 0.
 *
 * The creator's own code requires the outputs of the child's category to be exactly this genesis, in this order
 * (docs/framed/CREATE2_IDENTITY.md, "The genesis replay"); this list is what a composer places, and both work from
 * the same artifacts.
 */

import { encodeLockingBytecodeP2sh32 } from '@bitauth/libauth/build/lib/address/locking-bytecode.js';
import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  bytesEqual, computeCollectionHash, hash256, sha256, validatorAddress, type Artifact, type FunctionSplitBundle,
} from '@solidcash/utils';
import { framedValidator } from '@solidcash/solidc/runtime';
import { FACET_SATOSHIS } from '../composer/index.js';
import { satoshisAtLeastDust } from '../composer/dust.js';
import { authheadLockingBytecode } from '../../bcmr/index.js';
import type NetworkProvider from '../../network/NetworkProvider.js';
import type { FunctionArgument } from '../../Argument.js';
import type { Output } from '../../interfaces.js';
import { bindFramedOraclePool, framedOraclePool } from '../call/block-oracle.js';
import { deriveFramedGenesis } from './genesis.js';
import { deployMaster, type DeployedMaster } from './material.js';
import { MasterPoolDeployment } from './pool.js';
import {
  entryRecordLockingBytecode, stateRecordLockingBytecode,
} from './records.js';

/** Raised when a child's genesis cannot be laid out from the artifact and its constructor's arguments. */
export class FramedChildGenesisError extends Error {
  public readonly name = 'FramedChildGenesisError';
  public constructor(message: string) {
    super(message);
  }
}

export interface ChildGenesisOutputsOptions {
  readonly artifact: Artifact;
  /** The category the child's genesis mints: `K`, the outpoint of the transaction's genesis-eligible coin. */
  readonly category: Uint8Array;
  readonly validatorProgram: Uint8Array;
  readonly provider: NetworkProvider;
  /** The constructor's arguments, in parameter order. */
  readonly constructorArgs?: readonly FunctionArgument[];
  /** The lock the constructor reads as `msg.sender`: the creator's own. */
  readonly senderLockingBytecode?: Uint8Array;
  /** The per-entry bundle the child is deployed from, when its contract is published as one. */
  readonly split?: FunctionSplitBundle;
  /** The master pool the genesis funds per entry lock. Defaults to the composing pool size. */
  readonly pool?: { readonly masters: number; readonly validators: number };
  /** The authhead's owner commitment: the lock whose key may move the identity. */
  readonly ownerLock: Uint8Array;
  /**
   * The initializer the creator folds into the child's genesis (`composition.creates[].foldedCall`), with its
   * arguments evaluated over the creating call. Its state is derived after the constructor's.
   */
  readonly initializer?: { readonly functionName: string; readonly args: readonly FunctionArgument[] };
}

export interface ChildGenesisOutputs {
  /** The child's master, whose `address` is `addrV(category)`. */
  readonly master: DeployedMaster;
  /** The outputs the genesis mints, in the order the deployment lays them (the authhead first). */
  readonly outputs: readonly Output[];
}

/** The 20-byte hashes of a child's sorted collections, whose empty heads its genesis mints. */
export function childCollectionHashes(artifact: Artifact): Uint8Array[] {
  return (artifact.stateLayout?.collections ?? [])
    .filter((collection) => collection.sorted === true)
    .map((collection) => computeCollectionHash(collection.signature));
}

/** How many outputs of the child's category its genesis mints: masters, validators, records, authhead and events. */
export function childGenesisOutputCount(options: ChildGenesisOutputsOptions): number {
  const categoryId = binToHex(options.category);
  return childGenesisOutputs(options).outputs.filter(
    (output) => output.token !== undefined && output.token.category === categoryId,
  ).length;
}

/**
 * Binds the pool a child's block.* reads check into its programs, the one bound already or else the provider's, so
 * its masters' locks carry it. Every creation names the same locks, so a creator's constants and its creations must
 * bind the same pool.
 */
export function bindChildOraclePool(
  provider: NetworkProvider, artifact: Artifact, split?: FunctionSplitBundle, pool?: string,
): string | undefined {
  const bound = pool === undefined ? framedOraclePool(provider, artifact) : bindFramedOraclePool(provider, artifact, pool);
  for (const part of [split?.logical, ...split?.shards.map((shard) => shard.artifact) ?? [],
    ...split?.internalCuts.map((cut) => cut.artifact) ?? []]) {
    if (part !== undefined) bindFramedOraclePool(provider, part, bound);
  }
  return bound;
}

/** The outputs a creator mints for the child its `create2` names. */
export function childGenesisOutputs(options: ChildGenesisOutputsOptions): ChildGenesisOutputs {
  const { artifact, category, validatorProgram, provider } = options;
  const categoryId = binToHex(category);
  // A master of a contract another contract creates carries its pool in its pool slots, so its lock, and every lock
  // below, is the same for each category the child is created as.
  bindChildOraclePool(provider, artifact, options.split);
  if (artifact.stateLayout === undefined) {
    throw new FramedChildGenesisError(`Contract ${artifact.contractName} is not a stateful contract`);
  }

  // Every sorted collection an entry can write needs its empty head minted here, as a deployment mints it: a head
  // exists only at genesis, so a child whose creator leaves it out cannot insert beside it later.
  const headCollections = (artifact.stateLayout.collections ?? [])
    .filter((collection) => collection.sorted === true)
    .map((collection) => ({ name: collection.name, signature: collection.signature }));
  const genesis = deriveFramedGenesis({
    artifact,
    category,
    validatorProgram,
    provider,
    constructorArgs: options.constructorArgs ?? [],
    ...(headCollections.length === 0 ? {} : { headCollections }),

    ...(options.initializer === undefined ? {} : { initializer: options.initializer }),
    ...(options.senderLockingBytecode === undefined
      ? {} : { senderLockingBytecode: options.senderLockingBytecode }),
    ...(provider.consensusLimits?.maximumNftCommitmentBytes === undefined ? {} : {
      maximumCommitmentBytes: provider.consensusLimits.maximumNftCommitmentBytes,
    }),
  } as never);
  const master = genesis?.master ?? deployMaster(artifact, category, validatorProgram);
  const size = options.pool ?? { masters: 1, validators: 1 };
  const entryLocks = options.split === undefined
    ? [master.lockingBytecode]
    : MasterPoolDeployment.createFunctionSplit({
      bundle: options.split, category, validatorProgram, size,
    }).getEntryLocks();
  if (!bytesEqual(master.address, validatorAddress(category, validatorProgram))) {
    throw new FramedChildGenesisError('the child\'s master does not present the validator address its category derives');
  }

  const masterAmount = 1200n;
  const dataNftAmount = 1200n;
  const outputs: Output[] = [];
  // Output 0 is the category's authhead, never a master: every call spends a master, as every deployment's genesis
  // does (bcmr/DESIGN.md 4.2).
  const owner = options.ownerLock;
  outputs.push({
    to: authheadLockingBytecode(categoryId),
    amount: dataNftAmount,
    token: { category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment: binToHex(owner) } },
  });
  for (const lock of entryLocks) {
    for (let index = 0; index < size.masters; index += 1) {
      outputs.push({
        to: lock,
        amount: masterAmount,
        token: { category: categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
      });
    }
  }
  for (let index = 0; index < size.validators; index += 1) {
    outputs.push({
      to: master.address,
      amount: dataNftAmount,
      token: { category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment: '' } },
    });
  }
  // The validator's facets: tokenless UTXOs at each facet's own lock, so any composition can spend any UTXO of its
  // code. They carry no category, so a creator's check of the child's category does not name them.
  for (const code of framedValidator.buildValidatorFacets()) {
    outputs.push({ to: encodeLockingBytecodeP2sh32(hash256(code)), amount: FACET_SATOSHIS });
  }
  for (const event of genesis?.events ?? []) {
    outputs.push({
      to: event.lockingBytecode,
      amount: dataNftAmount,
      token: {
        category: categoryId, amount: 0n,
        nft: { capability: 'none', commitment: binToHex(event.commitment) },
      },
    });
  }
  const recordLock = stateRecordLockingBytecode(categoryId);
  for (const commitment of genesis?.commitments ?? []) {
    outputs.push({
      to: recordLock,
      amount: satoshisAtLeastDust(dataNftAmount, {
        to: recordLock,
        token: { category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment } },
      }),
      token: { category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment } },
    });
  }
  for (const entry of genesis?.entries ?? []) {
    const signature = entry.signature
      ?? artifact.stateLayout?.collections?.find((candidate) => candidate.name === entry.collection)?.signature;
    if (signature === undefined) {
      throw new FramedChildGenesisError(
        `the child's constructor minted a node for collection "${entry.collection}", which the artifact does not publish`,
      );
    }
    outputs.push({
      to: entryRecordLockingBytecode(categoryId, signature),
      amount: dataNftAmount,
      token: { category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment: entry.commitment } },
    });
  }
  for (const chunk of genesis?.chunks ?? []) {
    outputs.push({
      to: chunk.lockingBytecode,
      amount: dataNftAmount,
      token: { category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment: chunk.commitment } },
    });
  }
  // The folded state's digest: a tokenless OP_RETURN over the category outputs' locks and commitments, in the order
  // the transaction lays them out. The creator's replay no longer reads it: it computes the genesis it requires.
  if (genesis !== undefined) {
    const carried = outputs.filter((output) => output.token !== undefined && output.token.category === categoryId);
    const parts = carried.map((output) => sha256(Uint8Array.from([...(output.to as Uint8Array),
      ...hexToBin(String(output.token?.nft?.commitment ?? ''))])));
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const joined = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) { joined.set(part, offset); offset += part.length; }
    // Framed keeps this OP_RETURN until it retires after TRE (the user, 2026-11-03).
    outputs.push({ to: Uint8Array.from([0x6a, 0x20, ...sha256(joined)]), amount: 0n });
  }
  return { master, outputs };
}
