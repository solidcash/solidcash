/**
 * The deployment pools of a framed contract.
 *
 * A contract owns a pool of master UTXOs at its master lock, each carrying a minting NFT of its category, and a
 * pool of validator UTXOs at its address, each carrying a mutable NFT. Both are created once and then spent and
 * recreated in place by every composition. This module derives their geometry and the address the contract
 * presents; creating the category and broadcasting the genesis transaction is the caller's, because a category is
 * minted from a genesis-eligible UTXO the SDK reserves outside this module.
 */

import { TokenCapability, bytesEqual, type Artifact, type FunctionSplitBundle } from '@solidcash/utils';
import { framedValidator } from '@solidcash/solidc/runtime';
import { FACET_SATOSHIS } from '../composer/draft.js';
import { prepareFunctionSplitDeployment } from './entry-pool.js';
import { deployMaster, type DeployedMaster } from './material.js';

/** How many of each pool a deployment creates. */
export interface MasterPoolSize {
  /** Master UTXOs, one per concurrent entry into the contract. */
  readonly masters: number;
  /** Validator UTXOs at the contract's address, one per concurrent composition it roots. */
  readonly validators: number;
}

/**
 * The pool a composing contract is deployed with when the caller states no size.
 *
 * Masters bound how many times one transaction may enter the contract, so the default covers a contract a flow
 * reaches at a dozen sites; validators bound how many compositions it can root at one time. Both are funded at
 * deployment, so a deployment states the whole pool up front rather than growing it later.
 */
export const DEFAULT_MASTER_POOL_SIZE: MasterPoolSize = { masters: 12, validators: 4 };

/**
 * The pool a deployment funds: the caller's override per count, the default for whichever it leaves unstated.
 *
 * A caller that names a count is authoritative for that one; the other falls back independently. A count below one
 * is refused here, so a deployment never silently funds a smaller pool than it was asked for.
 */
export function resolveMasterPoolSize(override: Partial<MasterPoolSize> = {}): MasterPoolSize {
  const size = {
    masters: override.masters ?? DEFAULT_MASTER_POOL_SIZE.masters,
    validators: override.validators ?? DEFAULT_MASTER_POOL_SIZE.validators,
  };
  for (const count of [size.masters, size.validators]) {
    if (!Number.isInteger(count) || count < 1) {
      throw new Error(`a pool holds at least one UTXO: got ${count}`);
    }
  }
  return size;
}

/**
 * The satoshis a genesis spends on the pools alone, at the output amount a deployment mints them with: every master
 * and validator UTXO, plus every validator facet the validator program binds. A function-split genesis mints one
 * master pool per entry, so `entryCount` multiplies the master outputs. The records, events and chunks a
 * constructor's frame adds are sized separately; a funding selection adds this floor so the pool's outputs are
 * funded and a larger pool is not quietly truncated.
 */
export function poolGenesisSatoshis(
  size: MasterPoolSize, outputAmount = 1200n, entryCount = 1,
): bigint {
  const entries = BigInt(entryCount);
  const facets = BigInt(framedValidator.buildValidatorFacets().length);
  return (BigInt(size.masters) * entries + BigInt(size.validators)) * outputAmount + facets * FACET_SATOSHIS;
}

/** What a deployment needs to derive the pools. */
export interface MasterPoolOptions {
  readonly artifact: Artifact;
  readonly category: Uint8Array;
  readonly validatorProgram: Uint8Array;
  readonly size: MasterPoolSize;
}

/** One pool's genesis geometry: where its UTXOs sit and what token each carries. */
export interface GenesisPool {
  readonly lockingBytecode: Uint8Array;
  readonly count: number;
  readonly category: Uint8Array;
  readonly capability: number;
  readonly commitment: Uint8Array;
}

/** A contract's deployment geometry: the filled master, its address, and the two pools to fund. */
export class MasterPoolDeployment {
  private constructor(
    private readonly material: DeployedMaster,
    private readonly category: Uint8Array,
    private readonly size: MasterPoolSize,
    /** One filled master per entry, when this deployment is a `split: 'func'` bundle. */
    private readonly entries?: readonly DeployedMaster[],
  ) {}

  /** Derives the pools from an artifact, a category and the validator program. */
  public static create(options: MasterPoolOptions): MasterPoolDeployment {
    for (const count of [options.size.masters, options.size.validators]) {
      if (!Number.isInteger(count) || count < 1) {
        throw new Error(`a pool holds at least one UTXO: got ${count}`);
      }
    }
    const material = deployMaster(options.artifact, options.category, options.validatorProgram);
    return new MasterPoolDeployment(material, Uint8Array.from(options.category), options.size);
  }

  /**
   * The pools of a `split: 'func'` bundle.
   *
   * Genesis mints `size.masters` minting NFTs at each entry's filled lock, commitment empty, and one validator
   * pool at the single `addrV(category)` every shard presents. The locks differ per entry.
   * `deployFramedStatefulContract` broadcasts that transaction when its options carry this bundle.
   */
  public static createFunctionSplit(options: {
    readonly bundle: FunctionSplitBundle;
    readonly category: Uint8Array;
    readonly validatorProgram: Uint8Array;
    readonly size: MasterPoolSize;
  }): MasterPoolDeployment {
    for (const count of [options.size.masters, options.size.validators]) {
      if (!Number.isInteger(count) || count < 1) {
        throw new Error(`a pool holds at least one UTXO: got ${count}`);
      }
    }
    if (options.bundle.shards.length === 0) {
      throw new Error(`split 'func' on '${options.bundle.logicalContractName}' has no entry to fund`);
    }
    const prepared = prepareFunctionSplitDeployment(
      options.bundle, options.category, options.validatorProgram,
    );
    const entries = options.bundle.shards.map((shard) => {
      const artifact = prepared.shardArtifacts.get(shard.selector.toLowerCase()) ?? shard.artifact;
      return deployMaster(artifact, options.category, options.validatorProgram);
    });
    if (options.bundle.internalCuts.length > 0) {
      for (const cut of options.bundle.internalCuts) {
        const artifact = prepared.cutArtifacts.get(cut.name);
        if (artifact === undefined) {
          throw new Error(`function split did not deploy helper "${cut.name}"`);
        }
        entries.push(deployMaster(artifact, options.category, options.validatorProgram));
      }
    }
    const address = entries[0]!.address;
    for (const entry of entries) {
      if (!bytesEqual(entry.address, address)) {
        throw new Error('function split shards do not share one addrV');
      }
    }
    return new MasterPoolDeployment(entries[0]!, Uint8Array.from(options.category), options.size, entries);
  }

  /** The contract's address, `addrV(category)`: the 35-byte locking bytecode it presents. */
  public getAddress(): Uint8Array {
    return this.material.address;
  }

  /** Where the master UTXOs sit: the P2SH32 of the filled master program. */
  public getMasterLockingBytecode(): Uint8Array {
    return this.material.lockingBytecode;
  }

  /**
   * The filled lock of each entry, in shard order, then each internal helper when the bundle cut any.
   *
   * A monolith deployment has one. A function-split deployment has one per ABI entry, and every entry's
   * address is {@link getAddress}. Helper locks are extra minting outputs; they are not ABI entries.
   */
  public getEntryLocks(): readonly Uint8Array[] {
    return (this.entries ?? [this.material]).map((entry) => entry.lockingBytecode);
  }

  /** The filled master program the master lock commits to. */
  public getMasterProgram(): Uint8Array {
    return this.material.script;
  }

  /** How many master UTXOs the deployment creates. */
  public getMasterCount(): number {
    return this.size.masters;
  }

  /** How many validator UTXOs the deployment creates. */
  public getValidatorCount(): number {
    return this.size.validators;
  }

  /**
   * The two pools a genesis transaction must fund: `masters` outputs at the master lock carrying minting NFTs, and
   * `validators` outputs at the address carrying mutable NFTs. Both carry the state category and an empty
   * commitment. The transaction that mints the category and broadcasts these outputs is not built here.
   */
  public getGenesisPools(): readonly GenesisPool[] {
    const masters = this.entries ?? [this.material];
    return [
      ...masters.map((material) => ({
        lockingBytecode: material.lockingBytecode,
        count: this.size.masters,
        category: this.category,
        capability: TokenCapability.MINTING,
        commitment: new Uint8Array(0),
      })),
      {
        lockingBytecode: this.material.address,
        count: this.size.validators,
        category: this.category,
        capability: TokenCapability.MUTABLE,
        commitment: new Uint8Array(0),
      },
    ];
  }
}
