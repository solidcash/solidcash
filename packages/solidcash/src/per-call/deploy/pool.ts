/**
 * The deployment pools of a per-call contract.
 *
 * A contract owns a pool of master UTXOs at its master lock, each carrying a minting NFT of its category, and a
 * pool of validator UTXOs at its address, each carrying a mutable NFT. Both are created once and then spent and
 * recreated in place by every composition. This module derives their geometry and the address the contract
 * presents; creating the category and broadcasting the genesis transaction is the caller's, because a category is
 * minted from a genesis-eligible UTXO the SDK reserves outside this module.
 */

import { TokenCapability, type Artifact } from '@solidcash/utils';
import { perCallValidator } from 'solidc';
import { FACET_SATOSHIS } from '../composer/draft.js';
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
 * and validator UTXO, plus every validator facet the validator program binds. The records, events and chunks a
 * constructor's frame adds are sized separately; a funding selection adds this floor so the pool's outputs are
 * funded and a larger pool is not quietly truncated.
 */
export function poolGenesisSatoshis(size: MasterPoolSize, outputAmount = 1200n): bigint {
  const facets = BigInt(perCallValidator.buildValidatorFacets().length);
  return BigInt(size.masters + size.validators) * outputAmount + facets * FACET_SATOSHIS;
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

  /** The contract's address, `addrV(category)`: the 35-byte locking bytecode it presents. */
  public getAddress(): Uint8Array {
    return this.material.address;
  }

  /** Where the master UTXOs sit: the P2SH32 of the filled master program. */
  public getMasterLockingBytecode(): Uint8Array {
    return this.material.lockingBytecode;
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
    return [
      {
        lockingBytecode: this.material.lockingBytecode,
        count: this.size.masters,
        category: this.category,
        capability: TokenCapability.MINTING,
        commitment: new Uint8Array(0),
      },
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
