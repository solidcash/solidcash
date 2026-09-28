/**
 * Delivering a composition's logs to listeners.
 *
 * A caller registers a handler for the address of the contract it cares about, and a composition's decoded logs are
 * delivered to the handler registered for each log's emitting address. A nested frame's event reaches its own
 * contract's handler, because the shipped receipt reports every log with the address of the frame that emitted it,
 * not the address of the root that started the transaction.
 *
 * Handler identity is the bytes of the emitting address, so an address handed in twice names the same contract.
 */

import { bytesToHex, type Artifact } from '@solidcash/utils';
import type { CompositionDraft } from '../composer/index.js';
import {
  compositionEventLogs,
  type CompositionEventLog,
  type CompositionEventLogOptions,
} from './receipt.js';

/** A handler for the logs one emitting contract produced. */
export type CompositionLogHandler = (log: CompositionEventLog) => void;

/** A registered handler, removable in place. */
export interface CompositionLogSubscription {
  /** Stops further delivery to this handler. */
  remove(): void;
}

/** The listener registry a caller registers handlers into and delivers a composition's logs to. */
export class CompositionLogListeners {
  private readonly handlers = new Map<string, Set<CompositionLogHandler>>();

  /** Registers a handler for every log emitted by the contract at `address`. */
  public addListener(
    address: Uint8Array,
    handler: CompositionLogHandler,
  ): CompositionLogSubscription {
    const key = bytesToHex(address);
    let set = this.handlers.get(key);
    if (set === undefined) {
      set = new Set();
      this.handlers.set(key, set);
    }
    set.add(handler);
    return { remove: () => this.removeListener(address, handler) };
  }

  /** Removes a handler registered for `address`; one that is not registered is left alone. */
  public removeListener(address: Uint8Array, handler: CompositionLogHandler): void {
    const key = bytesToHex(address);
    const set = this.handlers.get(key);
    if (set === undefined) return;
    set.delete(handler);
    if (set.size === 0) this.handlers.delete(key);
  }

  /** Delivers each log to the handlers registered for its emitting address, in output order. */
  public deliver(logs: readonly CompositionEventLog[]): void {
    for (const log of logs) {
      const set = this.handlers.get(bytesToHex(log.address));
      if (set === undefined) continue;
      // A handler may remove itself or another while the set is being walked, so walk a copy.
      for (const handler of [...set]) handler(log);
    }
  }

  /**
   * Reads a composition's logs through the shipped receipt and delivers them to the registered handlers.
   *
   * Returns the logs that were read, so a caller can see what was delivered.
   */
  public deliverComposition(
    draft: CompositionDraft,
    artifacts: readonly Artifact[],
    options?: CompositionEventLogOptions,
  ): readonly CompositionEventLog[] {
    const logs = compositionEventLogs(draft, artifacts, options);
    this.deliver(logs);
    return logs;
  }

  /** Removes every registered handler. */
  public removeAllListeners(): void {
    this.handlers.clear();
  }

  /** How many handlers are registered for `address`, or across every address when none is named. */
  public listenerCount(address?: Uint8Array): number {
    if (address === undefined) {
      let total = 0;
      for (const set of this.handlers.values()) total += set.size;
      return total;
    }
    return this.handlers.get(bytesToHex(address))?.size ?? 0;
  }
}

/** A fresh, empty listener registry. */
export function compositionLogListeners(): CompositionLogListeners {
  return new CompositionLogListeners();
}
