/**
 * Lazy loaders for the two optional planner engines `StatefulTransactionBuilder` reaches synchronously:
 * the kernel entry-journal output layout and the message-bus preflight covenant assertion.
 *
 * Both are only needed when the builder carries kernel journal plans or opts into the strict recursive VM
 * preflight, so they are loaded on demand: the constructor starts a fire-and-forget preload and the async build
 * entry points await them; the sync call sites read the cached module with a clear error when it has not landed.
 */

type KernelEntryJournalModule = typeof import('./KernelEntryJournal.js');
type MessageBusPreflightModule = typeof import('../message-bus/preflight.js');

let kernelEntryJournalModule: KernelEntryJournalModule | undefined;
let kernelEntryJournalPromise: Promise<KernelEntryJournalModule> | undefined;
let messageBusPreflightModule: MessageBusPreflightModule | undefined;
let messageBusPreflightPromise: Promise<MessageBusPreflightModule> | undefined;

export function loadKernelEntryJournal(): Promise<KernelEntryJournalModule> {
  kernelEntryJournalPromise ??= import('./KernelEntryJournal.js').then((mod) => {
    kernelEntryJournalModule = mod;
    return mod;
  });
  return kernelEntryJournalPromise;
}

export function getKernelEntryJournalModule(): KernelEntryJournalModule | undefined {
  return kernelEntryJournalModule;
}

export function loadMessageBusPreflight(): Promise<MessageBusPreflightModule> {
  messageBusPreflightPromise ??= import('../message-bus/preflight.js').then((mod) => {
    messageBusPreflightModule = mod;
    return mod;
  });
  return messageBusPreflightPromise;
}

export function getMessageBusPreflightModule(): MessageBusPreflightModule | undefined {
  return messageBusPreflightModule;
}
