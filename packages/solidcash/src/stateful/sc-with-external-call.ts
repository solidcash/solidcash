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
  /** The lock of the contract that calls this frame (`withCallerIdentity`): the frame's msg.sender. */
  readonly callerLockingBytecode?: Uint8Array;
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
      parentCallerAddress?: Uint8Array,
    ): FunctionArgument[] | undefined;
  };
  selectedAbiFunction(): (AbiFunction & {
    externalCalls?: Array<{
      interfaceName: string;
      functionName: string;
      argSources: unknown;
      rawSelector?: string;
      rawFunctionName?: string;
      rawArgSources?: unknown;
    }>;
  }) | undefined;
}

/**
 * The function a raw call (`address.call(payload)`) runs on `externalContract`, by the selector or name the compiler
 * decoded from its payload, and the sources of that function's arguments. The payload itself is not an argument of
 * the callee, so the published `argSources` of a raw slot (the payload) never name it.
 */
function rawCallTarget(
  externalContract: unknown,
  ec: { rawSelector?: string; rawFunctionName?: string; rawArgSources?: unknown },
  slotIndex: number,
): { functionName: string; argSources: unknown } {
  const selected = (externalContract as { implementation?: unknown }).implementation ?? externalContract;
  const abi = (selected as { inner?: { artifact?: Artifact } }).inner?.artifact?.abi ?? [];
  const matches = abi.filter((candidate) => (
    (ec.rawFunctionName !== undefined && candidate.name === ec.rawFunctionName)
    || (ec.rawSelector !== undefined && candidate.selector?.toLowerCase() === ec.rawSelector.toLowerCase())));
  if (matches.length !== 1 || ec.rawArgSources === undefined) {
    const named = ec.rawFunctionName ?? (ec.rawSelector === undefined ? undefined : `selector ${ec.rawSelector}`);
    throw new Error(
      `Cannot auto-resolve the low-level call at slot ${slotIndex}: `
      + (named === undefined ? 'its payload names no decoded function. '
        : `the callee has ${matches.length === 0 ? 'no' : 'more than one'} function for its payload's ${named}. `)
      + 'Provide functionName and args explicitly via withExternalCall(contract, functionName, args).',
    );
  }
  return { functionName: matches[0]!.name, argSources: ec.rawArgSources };
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
  const { functionName, argSources } = ec.interfaceName === '__raw__'
    ? rawCallTarget(externalContract, ec, slotIndex)
    : { functionName: ec.functionName, argSources: ec.argSources };
  // An argument msg.sender gives is the frame's caller: the declared one, else the signer.
  const resolvedArgs = parent._resolveExternalArgs(
    argSources, host.functionArgs, parent.inner.artifact,
    undefined, abiFunction?.inputs, undefined, 0, false, parentSelfAddress, host.callerLockingBytecode,
  );
  if (!resolvedArgs) {
    throw new Error(
      `Cannot auto-resolve args for ${ec.interfaceName}.${functionName}. `
      + 'Provide args explicitly via withExternalCall(contract, functionName, args).',
    );
  }
  host.externalCallInfos.push({
    externalContract,
    functionName,
    args: resolvedArgs,
  });
}
