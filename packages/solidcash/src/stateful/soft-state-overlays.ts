/**
 * phase-boundary extract: mock soft-state overlays (BentoBox/Kashi/Ownable simulation + provider-scoped maps)
 * (phase-boundary extract from StatefulContract.ts).
 */

import type { StateValue } from '@solidcash/utils';
import type NetworkProvider from '../network/NetworkProvider.js';

/**
 * Mock soft BentoBox totals (elastic/base per token address key). Shared across BentoBox + KashiPair
 * instances so depositAsset amount→share sees beforeEach addProfit dilution.
 */
export const softBentoTotalsByToken = new Map<string, { elastic: bigint; base: bigint }>();
/** Mock soft BentoBox user shares: key = `${token}|${user}`. */
export const softBentoUserShares = new Map<string, bigint>();
/** User-only index for soft bento shares (address form independent). */
export const softBentoSharesByUser = new Map<string, bigint>();
/** Mock soft ERC20 balances: key = `${tokenContractKey}|${holder}`. */
export const softErc20Balances = new Map<string, bigint>();
/** Mock soft masterContractApproval: key = `${user}|${master}`. */
export const softMasterContractApproval = new Map<string, boolean>();
/** Mock soft KashiPair.setSwapper approvals (swapper address string). */
export const softSwapperApproved = new Set<string>();
/** Mock soft Ownable owner per contract category/address. */
export const softOwnerByContract = new Map<string, string>();
/**
 * Last oracle.set(rate) soft value (MistSwap OracleMock). beforeEach uses 1e28 (solvent);
 * insolvency tests use 1.1e28. updateExchangeRate copies this into pair soft exchangeRate.
 */
export let softOracleRate = 10n ** 28n;
export function setSoftOracleRate(rate: bigint): void {
  softOracleRate = rate;
}
/**
 * Soft state/mapping overlays keyed by contract categoryId (or address). Must be shared across
 * connect()/as() clones — MistSwap `bobHelper = pairHelper.as(bob)` deposits then
 * `pairHelper.contract.balanceOf(bob)` reads the original instance.
 */
export type SoftStateScope = {
  states: Map<string, Record<string, StateValue>>;
  mappings: Map<string, Map<string, Map<string, StateValue>>>;
};

// Categories are only unique within one network/provider. Keeping the mock overlay in one global category-keyed
// map made two isolated fixture providers with the same deterministic genesis accidentally share simulated state.
// A provider scope also makes a composition's view independent of unrelated suite order.
const softStateScopes = new Map<NetworkProvider | undefined, SoftStateScope>();

export const softStateScope = (provider: NetworkProvider | undefined): SoftStateScope => {
  let scope = softStateScopes.get(provider);
  if (!scope) {
    scope = { states: new Map(), mappings: new Map() };
    softStateScopes.set(provider, scope);
  }
  return scope;
};

/** Corpus simulation is an explicit MockNetworkProvider capability; every other provider is strict. */
export function legacyStatefulSimulationEnabled(provider: NetworkProvider | undefined): boolean {
  return (provider as { statefulSimulation?: string } | undefined)?.statefulSimulation === 'legacy-mistswap-v1';
}

export const softBentoKey = (token: unknown, user: unknown): string =>
  `${String(token ?? '')}|${String(user ?? '')}`;
export const softApprovalKey = (user: unknown, master: unknown): string =>
  `${String(user ?? '')}|${String(master ?? '')}`;

/** Clear mock bento soft totals (test reset / new provider). */
export function clearSoftBentoTotals(): void {
  softBentoTotalsByToken.clear();
  softBentoUserShares.clear();
  softBentoSharesByUser.clear();
  softErc20Balances.clear();
  softMasterContractApproval.clear();
  softSwapperApproved.clear();
  softOwnerByContract.clear();
  softStateScopes.clear();
  softOracleRate = 10n ** 28n;
}

/** A repeatable snapshot of mock-only state that lives outside the network provider. */
export interface SoftStateSnapshot {
  restore(): void;
}

/** Capture all soft-apply overlays for snapshot-based test fixtures. */
export function takeSoftStateSnapshot(): SoftStateSnapshot {
  const bentoTotals = new Map([...softBentoTotalsByToken].map(([key, value]) => [key, { ...value }]));
  const userShares = new Map(softBentoUserShares);
  const sharesByUser = new Map(softBentoSharesByUser);
  const erc20Balances = new Map(softErc20Balances);
  const approvals = new Map(softMasterContractApproval);
  const swappers = new Set(softSwapperApproved);
  const owners = new Map(softOwnerByContract);
  const oracleRate = softOracleRate;
  const scopes = new Map([...softStateScopes].map(([provider, scope]) => [provider, {
    states: new Map([...scope.states].map(([key, value]) => [key, { ...value }])),
    mappings: new Map([...scope.mappings].map(([contract, fields]) => [
      contract,
      new Map([...fields].map(([field, entries]) => [field, new Map(entries)])),
    ])),
  }]));
  return {
    restore: () => {
      clearSoftBentoTotals();
      for (const [key, value] of bentoTotals) softBentoTotalsByToken.set(key, { ...value });
      for (const [key, value] of userShares) softBentoUserShares.set(key, value);
      for (const [key, value] of sharesByUser) softBentoSharesByUser.set(key, value);
      for (const [key, value] of erc20Balances) softErc20Balances.set(key, value);
      for (const [key, value] of approvals) softMasterContractApproval.set(key, value);
      for (const value of swappers) softSwapperApproved.add(value);
      for (const [key, value] of owners) softOwnerByContract.set(key, value);
      softOracleRate = oracleRate;
      for (const [provider, scope] of scopes) {
        softStateScopes.set(provider, {
          states: new Map([...scope.states].map(([key, value]) => [key, { ...value }])),
          mappings: new Map([...scope.mappings].map(([contract, fields]) => [
            contract,
            new Map([...fields].map(([field, entries]) => [field, new Map(entries)])),
          ])),
        });
      }
    },
  };
}

export function softCreditUserShares(token: unknown, user: unknown, amount: bigint, opts?: { setUserIndex?: boolean }): void {
  const k = softBentoKey(token, user);
  softBentoUserShares.set(k, (softBentoUserShares.get(k) ?? 0n) + amount);
  if (opts?.setUserIndex === false) return;
  // Accumulate user-only index so multi-deposit cook chains sum (MistSwap cook external sum test).
  const u = String(user ?? '');
  softBentoSharesByUser.set(u, (softBentoSharesByUser.get(u) ?? 0n) + amount);
  if (u.length > 12) {
    softBentoSharesByUser.set(u.slice(-20), (softBentoSharesByUser.get(u.slice(-20)) ?? 0n) + amount);
  }
}

/** Every compiler encoding of a `msg.sender` / `_msgSender()` mapping key. */
export function isMsgSenderKeySource(source: {
  kind?: string;
  expressionLabel?: string;
  senderOp?: string;
} | undefined): boolean {
  if (!source) return false;
  if (source.kind === 'msgSender' || source.senderOp === 'msg.sender') return true;
  const label = source.expressionLabel ?? '';
  return label === 'nullop:msg.sender'
    || label === 'sender:msg.sender'
    || label === 'call:_msgSender()'
    || /(?:^|[._])msg\.sender(?:$|[._(])|_msgSender\(/.test(label);
}

/** nLocktime timestamp mode starts at 500_000_000; height mode is below that. */
const UNIX_LOCKTIME_THRESHOLD = 500_000_000;

/**
 * Default nLocktime for Solidity-compat `block.timestamp` / `tx.time` CLTV. Ported contracts
 * lower `block.timestamp` to locktime, so every stateful tx (including publish) must carry
 * the provider tip or `job.timestamp` stays 0 and later 24h requires never pass.
 */
export function providerUnixLocktime(provider: { getBlockTime?: () => number } | undefined): number | undefined {
  const timestamp = provider?.getBlockTime?.();
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) return undefined;
  const truncated = Math.trunc(timestamp);
  if (truncated < UNIX_LOCKTIME_THRESHOLD) return undefined;
  // Inclusion is exclusive (`tip > nLocktime`). Stamp one second behind the tip so a unix
  // locktime stays in timestamp mode and the tx is final without changing CLTV's `>=`.
  return truncated > UNIX_LOCKTIME_THRESHOLD ? truncated - 1 : truncated;
}

