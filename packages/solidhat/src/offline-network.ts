/**
 * Offline network guard for SolidHat gates.
 *
 * Hardhat-era suites talk to services the EVM toolchain took for granted: IPFS upload endpoints, metadata
 * gateways, RPC relays. A SolidCash gate that mocks the chain but silently keeps those services live is not a
 * reproducible test; a gate that lets them fail with `ECONNREFUSED` is not deterministic either (a developer with
 * a local daemon gets a different result than CI).
 *
 * This module replaces `globalThis.fetch` with a dispatcher over in-process services and records every call. Any
 * request no service claims is a *violation*: by default it throws, which fails the test that made it and proves
 * the suite cannot reach the real network.
 */

export interface OfflineRequestRecord {
  method: string;
  url: string;
  /** Service name that answered, or `undefined` for a pass-through/denied request. */
  service?: string;
  /** `true` when a service produced the response. */
  handled: boolean;
  /** `true` when the request was blocked or let through by the allow list. */
  escaped: boolean;
}

export interface OfflineService {
  /** Short identifier surfaced in call records and violation messages. */
  readonly name: string;
  /** Whether this service owns the request. */
  matches(url: URL, method: string): boolean;
  /** Produce the response for a matched request. */
  handle(request: Request, url: URL): Promise<Response> | Response;
}

export interface OfflineNetworkOptions {
  services?: readonly OfflineService[];
  /**
   * Requests allowed to reach the real network. A string matches the exact URL or any URL it prefixes (so an origin
   * allows its whole subtree); a RegExp is tested directly. Empty by default: the guard is hermetic, which is what
   * makes "no real calls escape" a testable property.
   */
  allow?: readonly (string | RegExp)[];
  /** What to do with a request that no service claims and no allow rule covers. Defaults to `throw`. */
  onUnexpected?: 'throw' | 'record';
}

export interface OfflineNetworkHandle {
  readonly services: readonly OfflineService[];
  readonly calls: readonly OfflineRequestRecord[];
  readonly violations: readonly OfflineRequestRecord[];
  /** Requests handled by a service, in order. */
  readonly handled: readonly OfflineRequestRecord[];
  reset(): void;
  restore(): void;
}

type FetchLike = typeof globalThis.fetch;

const normalize = (input: RequestInfo | URL, init?: RequestInit): { url: URL; method: string } => {
  if (input instanceof Request) return { url: new URL(input.url), method: input.method };
  const raw = input instanceof URL ? input.href : String(input);
  return { url: new URL(raw), method: (init?.method ?? 'GET').toUpperCase() };
};

/** Build a `Request` for a service without consuming the caller's body twice. */
const toRequest = (input: RequestInfo | URL, init?: RequestInit): Request =>
  (input instanceof Request && init === undefined ? input : new Request(input as RequestInfo, init));

/**
 * Install the guard. The previous `fetch` is restored by `handle.restore()`, so a suite can scope interception to
 * its own lifetime.
 */
export function installOfflineNetwork(options: OfflineNetworkOptions = {}): OfflineNetworkHandle {
  const services = [...(options.services ?? [])];
  const allow = options.allow ?? [];
  const onUnexpected = options.onUnexpected ?? 'throw';
  const calls: OfflineRequestRecord[] = [];
  const violations: OfflineRequestRecord[] = [];
  const handled: OfflineRequestRecord[] = [];
  const restoreTarget: FetchLike = globalThis.fetch;
  const previous: FetchLike = restoreTarget.bind(globalThis) as FetchLike;
  const isAllowed = (url: string): boolean => allow.some(
    (rule) => (typeof rule === 'string' ? url === rule || url.startsWith(rule) : rule.test(url)),
  );

  const patched = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const { url, method } = normalize(input, init);
    const service = services.find((candidate) => candidate.matches(url, method));
    if (service) {
      const request = toRequest(input, init);
      const record: OfflineRequestRecord = { method, url: url.href, service: service.name, handled: true, escaped: false };
      calls.push(record);
      handled.push(record);
      return service.handle(request, url);
    }
    if (isAllowed(url.href)) {
      calls.push({ method, url: url.href, handled: false, escaped: true });
      return previous(input as RequestInfo, init);
    }
    const record: OfflineRequestRecord = { method, url: url.href, handled: false, escaped: true };
    calls.push(record);
    violations.push(record);
    const message = `[solidhat-offline] blocked real network request ${method} ${url.href}`
      + ` (registered services: ${services.map((candidate) => candidate.name).join(', ') || 'none'})`;
    if (onUnexpected === 'throw') throw new Error(message);
    // eslint-disable-next-line no-console -- the recorded violation is the point: surface it where a human looks
    console.warn(message);
    return new Response('offline', { status: 599, statusText: 'SolidHat offline guard' });
  }) as FetchLike;

  globalThis.fetch = patched;

  return {
    services,
    calls,
    violations,
    handled,
    reset: (): void => {
      calls.length = 0;
      violations.length = 0;
      handled.length = 0;
    },
    restore: (): void => {
      if (globalThis.fetch === patched) globalThis.fetch = restoreTarget;
    },
  };
}
