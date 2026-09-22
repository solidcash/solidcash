/**
 * Local mock contracts.
 *
 * A SolidHat gate can either compile a ported project to BCH covenants and evaluate them on the mock network, or
 * replace the contracts with local programs that implement the same observable behaviour. This module provides the
 * second option: a small runtime in which each contract is a plain TypeScript class holding its own state, emitting
 * events into an ethers-shaped receipt, and reverting with the exact reason strings a suite asserts on.
 *
 * The point is test integrity, not chain fidelity: a suite that passes here proves the *application* logic and the
 * test harness agree, without paying compilation or VM cost, and without depending on covenant-level behaviour that
 * the suite is not trying to evaluate.
 */

/** One event emitted during a mock call. */
export interface MockEventEmission {
  event: string;
  args: Record<string, unknown>;
  /** Contract that emitted it (address of the mock deployment). */
  address: string;
}

/** ethers-shaped transaction receipt; `events` are already decoded, which is what the chai `emit` matcher reads. */
export interface MockReceipt {
  txid: string;
  status: number;
  events: MockEventEmission[];
  wait(): Promise<MockReceipt>;
}

/** Reason a mock contract refused a call. */
export class MockRevert extends Error {
  constructor(
    message: string,
    /** Solidity custom-error name, when the revert models one. */
    readonly errorName?: string,
    /** Arguments of the custom error, for `.withArgs` verification. */
    readonly errorArgs: readonly unknown[] = [],
  ) {
    super(message);
    this.name = 'MockRevert';
  }
}

/** Access to the rest of the mock deployment from inside a contract model. */
export interface MockChainView {
  /** Address of the named contract, when it has been deployed. */
  addressOf(name: string): string | undefined;
  /** Model instance of a deployed contract. */
  model<T extends MockContractModel = MockContractModel>(name: string): T;
  /**
   * Invoke another mock contract as an internal call. Emissions are attributed to the callee and merged into the
   * caller's receipt, matching how a composed on-chain transaction reports nested contract events.
   */
  callOn<T = unknown>(name: string, method: string, args?: readonly unknown[], sender?: string): T;
  /** Latest block timestamp in unix seconds, taken from the underlying mock network clock. */
  now(): number;
}

/** Per-call environment handed to a contract model. */
export interface MockCallContext {
  /** Caller (a signer address, or the calling contract's address for internal calls). */
  readonly sender: string;
  /** This contract's address. */
  readonly address: string;
  /** Contract name, useful for diagnostics. */
  readonly contractName: string;
  readonly chain: MockChainView;
  /** Record an event emission on the current receipt. */
  emit(event: string, args: Record<string, unknown>): void;
  /** Refuse the call with a plain reason string. */
  revert(reason: string): never;
  /** Refuse the call with a Solidity-style custom error, which `.revertedWithCustomError` matches by name. */
  revertError(name: string, args?: readonly unknown[]): never;
}

/** Accumulates emissions for the call currently in flight. */
export interface MockEmissionSink {
  push(emission: MockEventEmission): void;
}

/**
 * Base class for a local contract implementation.
 *
 * Subclasses hold their state in ordinary fields, declare which methods are read-only, and describe their events so
 * positional `.withArgs(...)` assertions can resolve parameter names.
 */
export abstract class MockContractModel {
  /** Methods that answer with a value instead of mining a transaction. */
  static readonly viewMethods: readonly string[] = [];
  /** Event name to ordered parameter names. */
  static readonly events: Record<string, readonly string[]> = {};
  /** Custom error name to ordered argument names. */
  static readonly errors: Record<string, readonly string[]> = {};

  /** Set by the runtime before every call; safe because mock calls are synchronous. */
  ctx!: MockCallContext;

  /** Convenience: read-only method check used by the runtime. */
  static isView(method: string): boolean {
    return (this.viewMethods as readonly string[]).includes(method);
  }

  /** Convenience: ordered parameter names for an event, or an empty list when unknown. */
  static eventParameters(event: string): readonly string[] {
    return this.events[event] ?? [];
  }
}

/** Definition registered for one contract name. */
export interface MockContractDefinition<T extends MockContractModel = MockContractModel> {
  /** Fresh model instance created for each deployment. */
  create(): T;
  /**
   * Optional hook run right after deployment. Constructor-like initialisation belongs in an `initialize` method that
   * `upgrades.deployProxy` calls; this hook is for wiring that does not correspond to a contract call.
   */
  setup?(model: T, context: { args: readonly unknown[]; address: string; chain: MockChainView }): void;
}
