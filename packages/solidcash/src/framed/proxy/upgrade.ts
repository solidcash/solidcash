/**
 * Checking an upgrade behind a framed proxy before it is built (spec 20, plan 4.7).
 *
 * An upgrade changes only the code a proxy's delegate frames run; the records stay. So the new implementation is
 * checked, by name, against the records the proxy holds: `readUpgradeLayoutVerdict` against the implementation the
 * proxy fronts now, the field agreement every call through the proxy checks, a selector an entry of the proxy's own
 * would capture, and a returned value the deployed fallback cannot carry. The compile-time half is the compiler's
 * `upgradesFrom` option. The generated proxy serves no upgrade entry (spec 19.4): an implementation that declares
 * `implementation` itself rewrites it through an entry of its own, which this check guards.
 */

import { readUpgradeLayoutVerdict, type Artifact } from '@solidcash/utils';
import { FramedProxyDeployError } from './errors.js';
import { readLayoutAgreement } from './generate.js';

/** A refusal naming the proxy and the implementation an upgrade was asked for. */
function refuse(proxy: Artifact, next: Artifact, reason: string): never {
  throw new FramedProxyDeployError(
    `cannot upgrade proxy "${proxy.contractName}" to "${next.contractName}": ${reason}`,
  );
}

/** An entry a call through the proxy can name: neither the fallback nor a constructor, which no call reaches. */
function callable(entry: Artifact['abi'][number]): boolean {
  return entry.name !== '__fallback' && entry.name !== '__construct' && entry.selector !== undefined;
}

/**
 * Refuses, by name, an implementation that cannot take over the records a deployed proxy holds.
 *
 * `current` must be the implementation the proxy's records agree with, and `next` must keep those records
 * (`readUpgradeLayoutVerdict`), agree with the proxy field for field, own no selector of the proxy's own entries,
 * and return nothing through a fallback that carries no result.
 */
export function requireFramedUpgrade(proxy: Artifact, current: Artifact, next: Artifact): void {
  if (next.composition?.convention !== 'framed' || next.stateLayout === undefined) {
    refuse(proxy, next, 'the new implementation is not a stateful contract compiled framed');
  }
  const fronted = readLayoutAgreement(current, proxy);
  if (!fronted.ok) {
    refuse(proxy, next, `"${current.contractName}" is not the implementation its records agree with: `
      + fronted.reason);
  }
  const verdict = readUpgradeLayoutVerdict(current.stateLayout!, next.stateLayout!);
  if (!verdict.ok) refuse(proxy, next, verdict.reason);
  const agreement = readLayoutAgreement(next, proxy);
  if (!agreement.ok) refuse(proxy, next, agreement.reason);
  for (const own of proxy.abi.filter(callable)) {
    const clash = next.abi.find((entry) => callable(entry) && entry.selector === own.selector);
    if (clash !== undefined) {
      refuse(proxy, next, `entry "${clash.name}" has the selector of the proxy's own "${own.name}" `
        + `(${own.selector}), so a call meant for it would run the proxy's entry instead`);
    }
  }
  const fallback = proxy.abi.find((entry) => entry.name === '__fallback');
  const returning = next.abi.find((entry) => entry.name !== '__construct' && (entry.outputs ?? []).length > 0);
  if ((fallback?.outputs ?? []).length === 0 && returning !== undefined) {
    refuse(proxy, next, `entry "${returning.name}" returns a value, and the proxy's fallback carries no result`);
  }
}
