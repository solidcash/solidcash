/**
 * Master and validator selection from pools.
 *
 * Deployment creates a pool of master UTXOs per contract and a pool of validator UTXOs at `addrV(cat)`. A master
 * covers exactly one entry into its contract, so a composition reserves one master per entry. A validator covers
 * every root of its group and is recreated in place, so one reservation covers the whole group; a transaction
 * needs one validator of its first root's category, and may use several when the groups it composes have
 * disjoint masters. Reservations happen while the plan is derived, before anything is built.
 */

import { masterPoolExhausted, rootWithoutValidator } from './refusals.js';

/** The master and validator UTXOs a deployment made available, keyed by contract. */
export interface PoolInventory {
  readonly masters: Readonly<Record<string, readonly string[]>>;
  readonly validators: Readonly<Record<string, readonly string[]>>;
}

/** One contract's master pool. Masters are handed out in the order they were funded. */
export class MasterPool {
  private cursor = 0;

  public constructor(
    public readonly contract: string,
    private readonly masterIds: readonly string[],
  ) {}

  /** How many masters the pool was funded with. */
  public get size(): number {
    return this.masterIds.length;
  }

  /** How many masters are still unused. */
  public get available(): number {
    return this.masterIds.length - this.cursor;
  }

  /** The masters reserved so far, in entry order. */
  public get taken(): readonly string[] {
    return this.masterIds.slice(0, this.cursor);
  }

  /** Reserves one more master for an entry into this contract, refusing when the pool cannot cover it. */
  public takeEntry(): string {
    const needed = this.cursor + 1;
    if (needed > this.masterIds.length) {
      throw masterPoolExhausted(this.contract, needed, this.masterIds.length);
    }
    const master = this.masterIds[this.cursor]!;
    this.cursor += 1;
    return master;
  }
}

/** One contract's validator pool. Validators sit at the contract's address and recreate in place. */
export class ValidatorPool {
  private cursor = 0;

  public constructor(
    public readonly contract: string,
    private readonly validatorIds: readonly string[],
  ) {}

  /** How many validators the pool was funded with. */
  public get size(): number {
    return this.validatorIds.length;
  }

  /** Whether the pool still has a validator to reserve. */
  public get available(): boolean {
    return this.cursor < this.validatorIds.length;
  }

  /** Reserves one validator for a group rooted at this contract, refusing when the pool has none left. */
  public take(): string {
    if (this.cursor >= this.validatorIds.length) throw rootWithoutValidator(this.contract);
    const validator = this.validatorIds[this.cursor]!;
    this.cursor += 1;
    return validator;
  }
}

/** Every contract's pools, as one reservation ledger. */
export class CompositionPools {
  private readonly masterPools = new Map<string, MasterPool>();
  private readonly validatorPools = new Map<string, ValidatorPool>();

  public constructor(inventory: PoolInventory) {
    for (const [contract, ids] of Object.entries(inventory.masters)) {
      this.masterPools.set(contract, new MasterPool(contract, ids));
    }
    for (const [contract, ids] of Object.entries(inventory.validators)) {
      this.validatorPools.set(contract, new ValidatorPool(contract, ids));
    }
  }

  /** A contract's master pool. A contract that was never funded has an empty one. */
  public masterPool(contract: string): MasterPool {
    const existing = this.masterPools.get(contract);
    if (existing !== undefined) return existing;
    const empty = new MasterPool(contract, []);
    this.masterPools.set(contract, empty);
    return empty;
  }

  /** A contract's validator pool. A contract that was never funded has an empty one. */
  public validatorPool(contract: string): ValidatorPool {
    const existing = this.validatorPools.get(contract);
    if (existing !== undefined) return existing;
    const empty = new ValidatorPool(contract, []);
    this.validatorPools.set(contract, empty);
    return empty;
  }

  /** Reserves one more entry into `contract`. */
  public takeMaster(contract: string): string {
    return this.masterPool(contract).takeEntry();
  }

  /** The masters reserved for `contract` so far, in entry order. */
  public mastersTaken(contract: string): readonly string[] {
    return this.masterPool(contract).taken;
  }

  /** Whether `contract` still has a validator to cover a group rooted at it. */
  public hasValidator(contract: string): boolean {
    return this.validatorPool(contract).available;
  }

  /** Reserves one validator for a group rooted at `contract`. */
  public takeValidator(contract: string): string {
    return this.validatorPool(contract).take();
  }
}

/** A master the group's validator covers, and the contract that owns it. */
export interface CoveredMaster {
  readonly contract: string;
  readonly master: string;
}

/** One independent composition: every master reached from the group's roots, covered by one validator. */
export interface CompositionGroup {
  /** The contract of this group's first root. Its validator covers the group. */
  readonly firstRootContract: string;
  /** The masters the validator covers, in derivation order. */
  readonly masters: readonly CoveredMaster[];
}

/** Where a group's validator sits, and what it covers and settles. */
export interface ValidatorPlacement {
  /** The contract whose block hosts the validator input, after that block's master ladder. */
  readonly block: string;
  /** The reserved validator UTXO. */
  readonly validator: string;
  /** Contracts whose masters this validator covers, in first-entry order. */
  readonly covers: readonly string[];
  /** Contracts the validator settles: the covered contracts with more than one master in the group. */
  readonly settles: readonly string[];
}

/**
 * Reserves one validator per group. Groups with disjoint masters may each have their own validator; groups that
 * share a master cannot, because call edges and multi-master contracts never span two validators, so that is an
 * internal plan invariant rather than a pool refusal.
 */
export function selectGroupValidators(
  groups: readonly CompositionGroup[],
  pools: CompositionPools,
): readonly ValidatorPlacement[] {
  assertGroupsDisjoint(groups);
  return groups.map((group) => {
    if (!pools.hasValidator(group.firstRootContract)) throw rootWithoutValidator(group.firstRootContract);
    const mastersPerContract = new Map<string, number>();
    for (const covered of group.masters) {
      mastersPerContract.set(covered.contract, (mastersPerContract.get(covered.contract) ?? 0) + 1);
    }
    return {
      block: group.firstRootContract,
      validator: pools.takeValidator(group.firstRootContract),
      covers: [...mastersPerContract.keys()],
      settles: [...mastersPerContract.entries()]
        .filter(([, count]) => count > 1)
        .map(([contract]) => contract),
    };
  });
}

function assertGroupsDisjoint(groups: readonly CompositionGroup[]): void {
  const owner = new Map<string, number>();
  groups.forEach((group, index) => {
    for (const covered of group.masters) {
      const previous = owner.get(covered.master);
      if (previous !== undefined && previous !== index) {
        throw new Error(
          `composer plan: master "${covered.master}" is in two groups, so they cannot have separate validators`,
        );
      }
      owner.set(covered.master, index);
    }
  });
}
