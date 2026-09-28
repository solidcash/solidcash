/**
 * The receipt half of per-call composition: reading an accepted composition's declared event outputs back into
 * decoded logs, each naming the emitting contract's `addrV(category)` and its fields in declared order.
 */

export * from './receipt.js';
export * from './listeners.js';
