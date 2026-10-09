/**
 * Lazy loader for the message-bus engine (`../message-bus/message-bus.js`).
 *
 * The message-bus batch encoder is only needed for contracts whose artifact publishes a `messageBus` route, so the
 * module is loaded on demand: async create paths await it for message-bus artifacts, the constructor starts a
 * fire-and-forget preload, and the synchronous `batch()` reads the cached module with a clear error when it has
 * not landed yet.
 */

type MessageBusModule = typeof import('../message-bus/message-bus.js');

let messageBusModule: MessageBusModule | undefined;
let messageBusPromise: Promise<MessageBusModule> | undefined;

/** Resolve once and cache the message-bus engine; safe to call any number of times. */
export function loadMessageBus(): Promise<MessageBusModule> {
  messageBusPromise ??= import('../message-bus/message-bus.js').then((mod) => {
    messageBusModule = mod;
    return mod;
  });
  return messageBusPromise;
}

/** The cached message-bus engine, or undefined until {@link loadMessageBus} has resolved. */
export function getMessageBusModule(): MessageBusModule | undefined {
  return messageBusModule;
}
