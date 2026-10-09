/**
 * phase-boundary extract: SC FunctionCall extract — withExternalCall simplified auto-resolve branch.
 */

import { hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import type { Artifact, AbiFunction } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import {
  findDeploymentByAddress,
} from './deployment-registry.js';

export type ExternalCallInfo = {
  externalContract: unknown;
  functionName: string;
  args: FunctionArgument[];
};

export interface WithExternalCallHost {
  readonly externalCallInfos: ExternalCallInfo[];
  readonly functionArgs?: unknown[];
  readonly parentContract?: {
    readonly target: string;
    readonly inner: {
      readonly provider: NetworkProvider;
      readonly lockingBytecode: string;
      readonly artifact: Artifact;
    };
    _resolveExternalArgs(
      argSources: unknown,
      functionArgs: unknown[],
      artifact: Artifact,
      a?: unknown,
      inputs?: unknown,
      b?: unknown,
      c?: number,
      d?: boolean,
      parentSelfAddress?: Uint8Array,
    ): FunctionArgument[] | undefined;
  };
  selectedAbiFunction(): (AbiFunction & {
    externalCalls?: Array<{
      interfaceName: string;
      functionName: string;
      argSources: unknown;
    }>;
  }) | undefined;
}

/**
 * Auto-resolve the next ABI externalCalls[] slot against the parent call args and push an
 * ExternalCallInfo. Used when withExternalCall(contract) is called without explicit name/args.
 */
export function pushAutoResolvedExternalCall(
  host: WithExternalCallHost,
  externalContract: unknown,
): void {
  const slotIndex = host.externalCallInfos.length;
  const abiFunction = host.selectedAbiFunction();
  const ec = abiFunction?.externalCalls?.[slotIndex];
  if (!ec) {
    throw new Error(
      `Cannot auto-resolve external call at slot ${slotIndex}. `
      + 'Provide functionName and args explicitly.',
    );
  }
  const parent = host.parentContract;
  if (!parent || !host.functionArgs) {
    throw new Error(
      `Cannot auto-resolve args for ${ec.interfaceName}.${ec.functionName}. `
      + 'Provide args explicitly via withExternalCall(contract, functionName, args).',
    );
  }
  const parentDeployment = findDeploymentByAddress(parent.inner.provider, parent.target);
  const parentSelfAddress = hexToBin(
    parentDeployment?.lockingBytecode ?? parent.inner.lockingBytecode,
  );
  const resolvedArgs = parent._resolveExternalArgs(
    ec.argSources, host.functionArgs, parent.inner.artifact,
    undefined, abiFunction?.inputs, undefined, 0, false, parentSelfAddress,
  );
  if (!resolvedArgs) {
    throw new Error(
      `Cannot auto-resolve args for ${ec.interfaceName}.${ec.functionName}. `
      + 'Provide args explicitly via withExternalCall(contract, functionName, args).',
    );
  }
  host.externalCallInfos.push({
    externalContract,
    functionName: ec.functionName,
    args: resolvedArgs,
  });
}
