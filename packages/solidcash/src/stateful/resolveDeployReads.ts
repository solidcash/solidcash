import { Artifact } from '@solidcash/utils';
import { ConstructorArgument } from '../Argument.js';
import { ContractRunner, StatefulContract } from './StatefulContract.js';

/**
 * Options for {@link resolveDeployReads}.
 * - `runner`: a NetworkProvider (or Signer) used to read each target contract's on-chain state.
 * - `artifacts`: the concrete artifact for each target `contractType` referenced by the deploy reads, so its
 *   state can be decoded. Keyed by the interface/contract type name (e.g. `{ IUniswapV3Pool: poolArtifact }`).
 */
export interface DeployReadResolveOptions {
  runner: ContractRunner;
  artifacts: Record<string, Artifact>;
}

/**
 * Resolve a stateful contract's constructor external reads (`stateLayout.deployReads`, produced by hoisting
 * `token0 = IERC20(pool.token0())` in the constructor - see docs/deploy-external-reads.md) by reading each
 * target contract's state on-chain, and return the FULL positional constructor-argument list ready to deploy.
 *
 * `providedArgs` supplies the non-hoisted inputs by name (e.g. `{ _pool: poolAddress }`); each hoisted input is
 * filled by reading `deployReads[i].read` (a state var / public getter) from the contract of type
 * `deployReads[i].contractType` at the address held by input `deployReads[i].addressInput`. This reads the real
 * value on-chain, so it does not depend on the deployer supplying a correct value by hand.
 */
export async function resolveDeployReads(
  artifact: Artifact,
  providedArgs: Record<string, ConstructorArgument>,
  opts: DeployReadResolveOptions,
): Promise<ConstructorArgument[]> {
  const inputs = artifact.stateLayout?.constructorInputs ?? artifact.constructorInputs;
  const deployReads = artifact.stateLayout?.deployReads ?? [];
  const byName = new Map<string, ConstructorArgument>(Object.entries(providedArgs));

  for (const dr of deployReads) {
    const targetAddress = byName.get(dr.addressInput);
    if (typeof targetAddress !== 'string') {
      throw new Error(`resolveDeployReads: input '${dr.addressInput}' (the address to read '${dr.read}' from for `
        + `'${dr.input}') must be supplied as an address string in providedArgs`);
    }
    const targetArtifact = opts.artifacts[dr.contractType];
    if (!targetArtifact) {
      throw new Error(`resolveDeployReads: no artifact registered for target type '${dr.contractType}'; pass it `
        + `in opts.artifacts to read '${dr.read}' for '${dr.input}'`);
    }
    const target = await StatefulContract.at(targetAddress, targetArtifact, opts.runner);
    const state = await target.getState();
    if (!(dr.read in state)) {
      throw new Error(`resolveDeployReads: target '${dr.contractType}' has no readable state variable '${dr.read}'`);
    }
    byName.set(dr.input, state[dr.read] as ConstructorArgument);
  }

  return inputs.map((inp) => {
    const value = byName.get(inp.name);
    if (value === undefined) {
      throw new Error(`resolveDeployReads: missing value for constructor input '${inp.name}'`);
    }
    return value;
  });
}
