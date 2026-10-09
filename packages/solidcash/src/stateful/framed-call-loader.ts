/**
 * Lazy loader for the framed call engine (`../framed/call/handle.js`).
 *
 * `framed/call/handle.js` is the heaviest module on the stateful path: it drags in the whole framed composition
 * engine (~seconds of module evaluation). It is only needed when a caller reaches a framed contract entry
 * synchronously (`createStatefulFunctionCall`), so the module is loaded on demand: async create paths await it
 * (and framed deployments kick it off early so it overlaps their genesis work), the constructor starts a
 * fire-and-forget preload, and the synchronous dispatch path reads the cached module with a clear error when it
 * has not landed yet.
 */

type FramedCallHandleModule = typeof import('../framed/call/handle.js');

let framedCallHandleModule: FramedCallHandleModule | undefined;
let framedCallHandlePromise: Promise<FramedCallHandleModule> | undefined;

/** Resolve once and cache the framed call engine; safe to call any number of times. */
export function loadFramedCallHandle(): Promise<FramedCallHandleModule> {
  framedCallHandlePromise ??= import('../framed/call/handle.js').then((mod) => {
    framedCallHandleModule = mod;
    return mod;
  });
  return framedCallHandlePromise;
}

/** The cached framed call engine, or undefined until {@link loadFramedCallHandle} has resolved. */
export function getFramedCallHandleModule(): FramedCallHandleModule | undefined {
  return framedCallHandleModule;
}
