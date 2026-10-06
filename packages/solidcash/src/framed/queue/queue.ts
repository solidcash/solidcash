/**
 * Serializing the sends whose compositions could touch the same resources.
 *
 * A framed send spends masters, validators and state records, and the transaction it builds has to be built
 * against the state its predecessor left: once a send lands, the outpoints it spent are gone and the resources it
 * touched sit at the outputs it created. Two sends whose resource sets intersect therefore have to run one after
 * the other, while two whose sets are disjoint run concurrently.
 *
 * A send names the resources it consumes by the identity of the inputs its plan spends — a master, a validator, a
 * record — or, when it knows them, by the outpoints those inputs sit on. The queue holds the latest send per
 * resource and starts a send once every resource it names is free; the send then resolves its plan and runs its
 * build. Reserving a resource before the send runs is what makes ordering follow arrival: a send enqueued later
 * against a resource an earlier send still holds waits for it.
 *
 * A failing send releases its resources rather than holding them. A broadcast the provider refuses must not wedge
 * the queue, so its successors run too, each built against the state that is actually live; the failure reaches the
 * caller's own promise and no other's.
 *
 * The handle's sends share one queue per provider (`framedSendQueue`) and name what they may spend before their
 * turn (`framedSendResources`): the contract's categories, the caller's coins, and the covenant pools every
 * composition co-spends. A call through a proxy hop joins once the hop's module opts in (`queueProxyHopSends`).
 */

import { binToHex } from '@bitauth/libauth';
import type NetworkProvider from '../../network/NetworkProvider.js';
import type { CompositionDraftPlan } from '../composer/index.js';

/** Raised when a send cannot be queued. */
export class CompositionQueueError extends Error {
  public readonly name = 'CompositionQueueError';

  public constructor(message: string) {
    super(message);
  }
}

/** The resources a send consumes, as the queue names them. */
export type SendResources = readonly string[];

/** One send: the plan to compose, and how to build and broadcast it. */
export interface QueuedSend<Result = unknown> {
  /** The plan to compose, or a function that resolves to one when the send's turn comes. */
  readonly plan: CompositionDraftPlan | (() => CompositionDraftPlan | Promise<CompositionDraftPlan>);
  /**
   * The resources the send consumes, or a function resolving to them.
   *
   * Defaults to the identities of the master, validator and record inputs the plan names. A caller that knows the
   * live outpoints names those instead, so two sends resolved from different plans still serialize on the same coin.
   */
  readonly resources?: SendResources | (() => SendResources);
  /** Builds and broadcasts the send against the resolved plan, once it holds every resource it names. */
  readonly run: (plan: CompositionDraftPlan) => Promise<Result>;
}

/** The resources a plan consumes: the identities of its masters, validators and state records. */
export function resourcesOf(plan: CompositionDraftPlan): SendResources {
  const resources: string[] = [];
  for (const block of plan.blocks) {
    for (const master of block.masters) resources.push(master);
    if (block.validator !== undefined) resources.push(block.validator.id);
    for (const record of block.state) resources.push(record);
  }
  return resources;
}

/** Resolves a send's resources, refusing one whose resources cannot be known before its turn. */
function resolveResources(send: QueuedSend<unknown>): SendResources {
  if (typeof send.resources === 'function') return [...new Set(send.resources())];
  if (send.resources !== undefined) return [...new Set(send.resources)];
  if (typeof send.plan === 'function') {
    throw new CompositionQueueError(
      'a send whose plan is resolved when its turn comes must name the resources it consumes',
    );
  }
  return [...new Set(resourcesOf(send.plan))];
}

/** The plan a send composes, resolving one stated later. */
async function resolvePlan(send: QueuedSend<unknown>): Promise<CompositionDraftPlan> {
  return typeof send.plan === 'function' ? send.plan() : send.plan;
}

/** A resolved promise, the release a resource with no holder starts from. */
const FREE: Promise<void> = Promise.resolve();

/**
 * A queue that serializes sends on the resources they consume.
 *
 * Every resource holds the tail of the sends that named it, and a send starts once all its resources' tails have
 * settled. A failing send settles its hold as well, so successors proceed; only the failing send's own promise
 * rejects.
 */
export class CompositionQueue {
  private readonly held = new Map<string, Promise<void>>();

  /** Enqueues one send and returns a promise for its result. */
  public enqueue<Result>(send: QueuedSend<Result>): Promise<Result> {
    return this.hold(resolveResources(send), async () => send.run(await resolvePlan(send)));
  }

  /**
   * Runs `task` once every resource named is free, and holds them until it settles. A send that plans inside its
   * own turn, as a handle's call does, names its resources here and states no plan up front.
   */
  public hold<Result>(resources: SendResources, task: () => Promise<Result>): Promise<Result> {
    const names = [...new Set(resources)];
    const prior = names.map((resource) => this.held.get(resource) ?? FREE);
    const started = Promise.all(prior).then(() => task());
    // Reserve each resource for the send's duration before it runs, so a later send that names one waits for it.
    const settled = started.then(() => undefined, () => undefined);
    for (const resource of names) this.held.set(resource, settled);
    // A resource nobody holds any more is forgotten, so a long-lived provider's queue does not grow with every send.
    void settled.then(() => {
      for (const resource of names) if (this.held.get(resource) === settled) this.held.delete(resource);
    });
    return started;
  }

  /** Resolves once every send enqueued so far has settled, whether it succeeded or failed. */
  public async drain(): Promise<void> {
    await Promise.all([...this.held.values()]);
  }
}

/** The provider property a provider's send queue is kept under, one symbol across copies of this module. */
const SEND_QUEUE = Symbol.for('@solidcash/framed-send-queue');

/**
 * The queue every framed send made on `provider` waits its turn in.
 *
 * It is kept on the provider itself, as the deployment registry is, so a wrapper that forwards property reads (the
 * simulation provider an unfunded caller composes over) reaches the queue of the provider it wraps.
 */
export function framedSendQueue(provider: NetworkProvider): CompositionQueue {
  const existing = (provider as unknown as Record<symbol, CompositionQueue | undefined>)[SEND_QUEUE];
  if (existing !== undefined) return existing;
  const queue = new CompositionQueue();
  Object.defineProperty(provider, SEND_QUEUE, { value: queue, enumerable: false, configurable: true });
  return queue;
}

/**
 * The resource every framed send names: the validator facets and compute side-cars sit at locks every contract
 * shares, and each composition through the shipped validator co-spends its facets, so all such sends serialize.
 */
export const SHARED_COVENANT_POOLS = 'shared-covenant-pools';

/**
 * The resources a send names before its turn: the categories whose masters, validators and records it may spend,
 * the caller's coins (it picks one only in its turn), and the shared covenant pools.
 */
export function framedSendResources(options: {
  readonly callerLockingBytecode: Uint8Array;
  readonly categoryIds: readonly string[];
}): SendResources {
  return [
    `caller:${binToHex(options.callerLockingBytecode)}`,
    ...options.categoryIds.map((categoryId) => `category:${categoryId.toLowerCase()}`),
    SHARED_COVENANT_POOLS,
  ];
}

/** Whether a call through a proxy hop takes its turn in the queue; the hop's module opts in. */
let proxyHopSendsQueued = false;

/**
 * Opts calls through a proxy hop into the send queue. The hop's module owns that path, so a handle composes such a
 * call at once until that module calls this; from then on it waits its turn like a direct call.
 */
export function queueProxyHopSends(): void {
  proxyHopSendsQueued = true;
}

/** True once calls through a proxy hop take their turn in the send queue. */
export function proxyHopSendsAreQueued(): boolean {
  return proxyHopSendsQueued;
}
