/**
 * B8.0: the facts a creator's compile keeps about each contract a direct `new` names.
 *
 * A deployer child is compiled standalone before the creator's semantic passes run, so the symbol pass, the type
 * pass and code generation all see one `DeployerAbi` (or the reason the child has none) instead of compiling the
 * child again. The map lives on the internal compiler options for the duration of one creator compile.
 */
import type { Artifact, DeployerAbi } from '@solidcash/utils';

export interface DeployerChild {
  readonly name: string;
  /** The child's standalone artifact: the same one a plain compile of the child publishes. */
  readonly artifact: Artifact;
  /** The deployer the standalone compile built; absent when the child has none. */
  readonly abi?: DeployerAbi;
  /** The A4.1 reason the child has no deployer, when it has none. */
  readonly reason?: string;
}

export interface DeployerChildOptions {
  readonly composition?: string;
  readonly messageBus?: boolean;
  readonly __compiledDeployers?: ReadonlyMap<string, DeployerChild>;
}

/** B8.1/B10.1: the target is a child this compile gathered in B8.0; the path is always on. */
export function deployerChildOf(options: DeployerChildOptions, contractName: string): DeployerChild | undefined {
  return options.__compiledDeployers?.get(contractName);
}

/** B8.1: the surrounding contract is compiled in the direct convention. */
export function compilesInDirectConvention(options: DeployerChildOptions): boolean {
  return options.composition !== 'framed' && options.messageBus !== true;
}
