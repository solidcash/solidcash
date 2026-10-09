/**
 * phase-boundary extract: SC FunctionCall extract — auto-wire ABI libraryDelegateCalls into callInfos.
 */

import { hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import type { AbiFunction, Artifact, StateLayout } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import { assertDelegateLayoutCompatible } from './sc-with-delegatecall.js';

export type AutoWireCallInfo = {
  type: 'stateful';
  contract: { inner: { artifact: Artifact } };
  functionName: string;
  args: FunctionArgument[];
};

export interface AutoWireLibraryDelegatecallsHost {
  readonly functionName?: string;
  readonly functionArgs?: unknown[];
  readonly callInfos: AutoWireCallInfo[];
  readonly parentStateLayout?: StateLayout;
  selectedAbiFunction(): (AbiFunction & {
    libraryDelegateCalls?: Array<{
      library: string;
      functionName: string;
      args?: Array<
      | { param: string }
      | { kind: 'int' | 'bool' | 'bytes' | 'string'; literal: string }
      >;
    }>;
  }) | undefined;
  getLibrary(name: string): { inner: { artifact: Artifact } } | undefined;
}

/**
 * For each ABI-published libraryDelegateCalls entry not already present in callInfos, resolve
 * forwarded/literal args and append a stateful CallInfo for the registered library instance.
 */
export function autoWireLibraryDelegatecalls(host: AutoWireLibraryDelegatecallsHost): void {
  if (!host.functionName) return;
  const abiFunc = host.selectedAbiFunction();
  const libCalls = abiFunc?.libraryDelegateCalls;
  if (!libCalls || libCalls.length === 0) return;
  for (const lc of libCalls) {
    if (host.callInfos.some((ci) => ci.type === 'stateful' && ci.functionName === lc.functionName)) continue;
    const lib = host.getLibrary(lc.library);
    if (!lib) {
      throw new Error(
        `Library '${lc.library}' is delegate-called by '${host.functionName}' but no instance was registered. `
        + `Call registerLibrary('${lc.library}', <deployed library>) before .send().`,
      );
    }
    assertDelegateLayoutCompatible(
      host.parentStateLayout,
      lib.inner.artifact.stateLayout,
      lib.inner.artifact.contractName,
    );
    // Resolve each positional arg for the library unlocker: a forwarded consumer parameter (by name, from the
    // consumer call) or a compile-time literal (reconstructed by kind).
    const args = (lc.args ?? []).map((a) => {
      if ('param' in a) {
        const idx = abiFunc!.inputs.findIndex((inp) => inp.name === a.param);
        if (idx < 0 || !host.functionArgs || idx >= host.functionArgs.length) {
          throw new Error(
            `Cannot resolve argument '${a.param}' forwarded to library '${lc.library}.${lc.functionName}' `
            + `from the call to '${host.functionName}'.`,
          );
        }
        return host.functionArgs[idx] as FunctionArgument;
      }
      if (a.kind === 'int') return BigInt(a.literal);
      if (a.kind === 'bool') return a.literal === 'true';
      if (a.kind === 'bytes') return hexToBin(a.literal);
      return a.literal; // string
    });
    host.callInfos.push({ type: 'stateful', contract: lib, functionName: lc.functionName, args });
  }
}
