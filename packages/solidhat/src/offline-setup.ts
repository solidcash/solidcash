/**
 * Vitest setup file that makes a ported Hardhat project run hermetically.
 *
 * Add it to a SolidHat preset with `offline: true` (or list `@solidcash/solidhat/offline-setup` in `setupFiles`).
 * It runs after the testing preset's own setup, so the HRE already exists, and then:
 *
 * 1. registers the in-memory IPFS service application code publishes to and reads from,
 * 2. installs the offline network guard, so every other outbound request fails loudly instead of reaching a real
 *    service, and
 * 3. installs the EVM JSON-RPC shims ported deployment scripts expect from a Hardhat node.
 *
 * The installed runtime is available to suites as `globalThis.__solidhatOffline` (and through `offlineRuntime()`),
 * which is what lets a test assert that no request escaped the guard.
 *
 * Environment:
 * - `SOLIDCASH_OFFLINE_MODE=record` records violations instead of throwing (debugging only).
 * - `SOLIDCASH_OFFLINE_ALLOW` comma-separated URLs or `/regex/` patterns allowed to reach the real network.
 * - `SOLIDCASH_MOCK_IPFS_SECRET` requires uploads to present that secret.
 * - `IPFS_UPLOAD_SERVICE_URL` / `IPFS_GATEWAY_URL` relocate the mocked endpoints.
 */
import { getActiveHre } from '@solidcash/testing/hre';
import { createInMemoryIpfs, type InMemoryIpfs } from './offline-ipfs.js';
import { installOfflineNetwork, type OfflineNetworkHandle } from './offline-network.js';
import { installOfflineRpcShims, type OfflineRpcHandle } from './offline-rpc.js';

export interface SolidHatOfflineRuntime {
  ipfs: InMemoryIpfs;
  network: OfflineNetworkHandle;
  rpc: OfflineRpcHandle;
}

declare global {
  // eslint-disable-next-line no-var -- the runtime is intentionally shared across every module in the worker
  var __solidhatOffline: SolidHatOfflineRuntime | undefined;
}

/** Parse `SOLIDCASH_OFFLINE_ALLOW` into exact-URL strings and `/pattern/` regular expressions. */
function parseAllowList(raw: string | undefined): (string | RegExp)[] {
  if (!raw) return [];
  return raw.split(',').map((entry) => entry.trim()).filter((entry) => entry.length > 0).map((entry) => {
    const pattern = /^\/(.*)\/([a-z]*)$/.exec(entry);
    return pattern ? new RegExp(pattern[1], pattern[2] || undefined) : entry;
  });
}

/** The offline runtime installed for this test file. */
export function offlineRuntime(): SolidHatOfflineRuntime {
  if (!globalThis.__solidhatOffline) throw new Error('SolidHat offline setup has not run in this test file');
  return globalThis.__solidhatOffline;
}

/** Fail when any wrapped test let a request escape to the real network. */
export function assertNoNetworkViolations(): void {
  const { violations } = offlineRuntime().network;
  if (violations.length === 0) return;
  const summary = violations.map((violation) => `${violation.method} ${violation.url}`).join('\n  ');
  throw new Error(`SolidHat offline guard blocked ${violations.length} real network request(s):\n  ${summary}`);
}

if (!globalThis.__solidhatOffline) {
  const ipfs = createInMemoryIpfs();
  const network = installOfflineNetwork({
    services: [ipfs],
    allow: parseAllowList(process.env.SOLIDCASH_OFFLINE_ALLOW),
    onUnexpected: process.env.SOLIDCASH_OFFLINE_MODE === 'record' ? 'record' : 'throw',
  });
  const provider = (getActiveHre() as { ethers?: { provider?: { send?(method: string, params?: unknown[]): Promise<unknown> } } })
    .ethers?.provider;
  const rpc = provider && typeof provider.send === 'function'
    ? installOfflineRpcShims(provider as { send(method: string, params?: unknown[]): Promise<unknown> })
    : { rawTransactions: [], calls: [], reset: (): void => {}, restore: (): void => {} };
  globalThis.__solidhatOffline = { ipfs, network, rpc };
}
