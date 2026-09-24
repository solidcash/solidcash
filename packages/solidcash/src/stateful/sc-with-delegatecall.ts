/**
 * phase-boundary extract: SC FunctionCall extract — withDelegatecall overload validation + CallInfo push.
 */

import type { AbiFunction, Artifact, StateLayout } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';

export type DelegateCallInfo = {
  type: 'stateful';
  contract: { inner: { artifact: Artifact } };
  functionName: string;
  args: FunctionArgument[];
  proxyMasterIndex?: number;
};

export interface WithDelegatecallHost {
  readonly parentStateLayout?: StateLayout;
  readonly callInfos: DelegateCallInfo[];
}

export function assertDelegateLayoutCompatible(
  callerLayout: StateLayout | undefined, implLayout: StateLayout | undefined, implName: string,
): void {
  if (!callerLayout || !implLayout) return;
  for (const iv of implLayout.variables) {
    const cv = callerLayout.variables.find((v) => v.nftIndex === iv.nftIndex && v.fieldIndex === iv.fieldIndex);
    if (!cv || cv.name !== iv.name || cv.type !== iv.type) {
      throw new Error(
        `Delegate layout mismatch: '${implName}' state field '${iv.name}' (${iv.type}) is not at the same `
        + "slot in the caller's state. A delegate library/implementation and its caller must declare a "
        + 'compatible state layout (the same field at the same slot). See docs/library-contracts.md.',
      );
    }
  }
}

/**
 * Validate that the selected impl overload is delegate-eligible and layout-compatible with the
 * proxy, then append a stateful CallInfo for low-level delegatecall materialization.
 */
export function withDelegatecall(
  host: WithDelegatecallHost,
  impl: { inner: { artifact: Artifact } },
  functionName: string,
  args: FunctionArgument[],
  proxyMasterIndex?: number,
): void {
  const implArtifact = impl.inner.artifact;
  // Resolve the overload the unlocker will actually select. Contract.unlock dispatches different-arity
  // overloads on args.length, so validating "some overload with this name is delegate" would wave through a
  // one-arg call that lands on a non-delegate overload. Match visible arity the way the dispatcher does; fall
  // back to all same-name entries when nothing matches, so the dispatcher's own arity error surfaces instead
  // of a misleading delegate-mode message.
  const visibleArity = (f: AbiFunction): number => f.inputs
    .filter((inp) => !inp.name.startsWith('__internal__')).length;
  const sameName = implArtifact.abi.filter((f) => f.name === functionName);
  const arityMatched = sameName.filter((f) => visibleArity(f) === args.length);
  const implOverloads = arityMatched.length > 0 ? arityMatched : sameName;
  // The impl must be the delegate variant: its state writes have to target the co-spent proxy master. A
  // standalone build writes its OWN state, so the proxy's NFTs would go unauthorized. The variant is a
  // different script (different address), so this cannot be corrected here - it must be what was deployed.
  if (!implArtifact.isLibrary && !implArtifact.delegateOnly
    && !implOverloads.some((f) => f.modifiers?.includes('delegate'))) {
    throw new Error(
      `Function '${implArtifact.contractName}.${functionName}' is not available in delegate mode: it would `
      + "use standalone state semantics rather than the proxy's. Build and deploy the implementation with "
      + 'contract.asDelegate(), and select a state-writing function eligible for delegatecall.',
    );
  }
  assertDelegateLayoutCompatible(
    host.parentStateLayout,
    implArtifact.stateLayout,
    implArtifact.contractName,
  );
  host.callInfos.push({
    type: 'stateful',
    contract: impl,
    functionName,
    args,
    proxyMasterIndex,
  });
}
