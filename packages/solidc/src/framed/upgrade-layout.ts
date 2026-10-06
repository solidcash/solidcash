/**
 * The compile-time half of the proxy-upgrade layout rule (spec 20, plan 4.7).
 *
 * `upgradesFrom` gives, per contract, the state layout of the implementation it replaces behind a per-call proxy.
 * The compile refuses a contract whose layout would read those records differently, by the name of the declaration
 * that stops it, so an incompatible upgrade fails where it is written rather than on its first call through the
 * proxy. The rule itself is `readUpgradeLayoutVerdict`, which the SDK checks again before it builds an upgrade.
 */

import { readUpgradeLayoutVerdict, type Artifact, type StateLayout } from '@solidcash/utils';
import { SolidcDiagnosticError } from '../Errors.js';

/** Per contract name, the layout of the implementation the contract replaces. */
export type UpgradesFrom = Readonly<Record<string, StateLayout>>;

/** Refuses, by name, every contract `upgradesFrom` names whose layout does not keep the records it replaces. */
export function requireUpgradeLayouts(
  artifacts: Readonly<Record<string, Artifact>>,
  upgradesFrom: UpgradesFrom | undefined,
): void {
  for (const [contract, reference] of Object.entries(upgradesFrom ?? {})) {
    const artifact = artifacts[contract];
    const refuse = (reason: string, context: Readonly<Record<string, unknown>> = {}): never => {
      throw new SolidcDiagnosticError('PER_CALL_UPGRADE_LAYOUT', `"${contract}" ${reason}`, { contract, ...context });
    };
    if (artifact === undefined) refuse('is named by upgradesFrom, but this compile does not produce it');
    if (artifact!.composition?.convention !== 'per-call') {
      refuse('is not compiled per-call, and upgradesFrom checks the per-call proxy\'s record rule');
    }
    if (artifact!.stateLayout === undefined) refuse('is not stateful, so it has no records to keep');
    const verdict = readUpgradeLayoutVerdict(reference, artifact!.stateLayout!);
    if (!verdict.ok) {
      refuse(`cannot replace the implementation it upgrades: ${verdict.reason}`, { name: verdict.name });
    }
  }
}
