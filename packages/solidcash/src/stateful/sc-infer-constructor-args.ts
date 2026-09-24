/**
 * phase-boundary extract: SC class-body extract — auto-infer constructor args from externalContracts specs.
 */

import { hexToBin } from '@bitauth/libauth';
import type { Artifact } from '@solidcash/utils';
import type { ConstructorArgument } from '../Argument.js';
import { Contract } from '../Contract.js';
import {
  getDataNftLockingBytecode,
  getEntryNftLockingBytecode,
} from './covenant-helpers.js';

/** Structural ExternalContractSpec to avoid importing StatefulContract. */
export type InferConstructorExternalSpec = {
  artifact: Artifact;
  categoryId: string;
  constructorArgs?: ConstructorArgument[];
};

/**
 * Walk constructorInputs and resolve each external-address param from the
 * `externalContracts` map (master / dataNft / entryNft locking bytecode).
 */
export function inferConstructorArgs(
  artifact: Artifact,
  allSpecs: Record<string, InferConstructorExternalSpec>,
  provider: unknown,
  visited?: Set<string>,
): ConstructorArgument[] {
  visited = visited ?? new Set();
  if (visited.has(artifact.contractName)) {
    throw new Error(`Circular constructor dependency detected: ${artifact.contractName}`);
  }
  visited.add(artifact.contractName);

  if (artifact.constructorInputs.length === 0) return [];

  // Collect constructor param name -> { interfaceName, kind } from all ABI functions.
  // In the address model each external param carries a locking bytecode: the callee's master
  // address for calls/outState, or the data/entry sub-NFT address for reads.
  const paramRefs = new Map<string, {
    interfaceName: string; kind: 'master' | 'dataNft' | 'entryNft'; collection?: string;
  }>();
  for (const func of artifact.abi) {
    for (const ec of func.externalCalls ?? []) {
      if (ec.addressParam) paramRefs.set(ec.addressParam, { interfaceName: ec.interfaceName, kind: 'master' });
    }
    for (const er of func.externalReads ?? []) {
      if (er.addressParam) {
        paramRefs.set(er.addressParam, {
          interfaceName: er.interfaceName,
          kind: er.kind === 'entry' ? 'entryNft' : 'dataNft',
          collection: er.collectionName ?? er.collectionSignature,
        });
      }
    }
    for (const os of func.externalOutStateReads ?? []) {
      if (os.addressParam) paramRefs.set(os.addressParam, { interfaceName: os.interfaceName, kind: 'master' });
    }
  }

  return artifact.constructorInputs.map((input) => {
    const ref = paramRefs.get(input.name);
    if (!ref) {
      throw new Error(
        `Cannot auto-infer constructor arg '${input.name}' for contract '${artifact.contractName}'. `
        + 'Provide explicit constructorArgs in the ExternalContractSpec.',
      );
    }
    const spec = allSpecs[ref.interfaceName];
    if (!spec) {
      throw new Error(
        `External contract for interface '${ref.interfaceName}' not found in externalContracts map. `
        + `Required by '${artifact.contractName}' constructor param '${input.name}'.`,
      );
    }
    // Build the external contract (self-pinned: category baked) to derive its addresses.
    const extArgs = spec.constructorArgs
      ?? inferConstructorArgs(spec.artifact, allSpecs, provider, new Set(visited));
    const extContract = new Contract(spec.artifact, extArgs as any, {
      provider: provider as any,
      category: hexToBin(spec.categoryId),
    });
    if (ref.kind === 'master') {
      return extContract.lockingBytecode;
    }
    if (ref.kind === 'entryNft') {
      return getEntryNftLockingBytecode(extContract, spec.categoryId, ref.collection!);
    }
    return getDataNftLockingBytecode(spec.categoryId);
  });
}
