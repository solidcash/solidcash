/**
 * phase-boundary extract: SC class-body extract — ethers-style staticCall return-value derivation.
 */

import { binToHex, hexToBin, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import {
  attachDecodedAccessors,
  childStateLayoutDigest,
  decodePushdataValue,
  encodePushdataValue,
  getDefaultStateValue,
  type AbiFunction,
  type Artifact,
  type StateLayout,
  type StateValue,
} from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import type { UnlockableUtxo } from '../interfaces.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import type Signer from '../Signer.js';
import { getNetworkPrefix } from '../utils.js';
import {
  connectedContractMatchesExactAddress,
  findDeploymentByAddress,
  findDeploymentByAddressValue,
  findDeploymentByName,
} from './deployment-registry.js';
import {
  decodeAuthenticatedProducerResultVector,
} from './external-return-encoding.js';
import {
  decodeEvmInvocationResult,
  decodeEvmInvocationResultPrefix,
  encodeEvmInvocationResult,
} from './evm-abi-result.js';
import {
  normalizeJobEventAddresses,
  usesLegacyJobEventCompatibility,
} from './legacy-job-event-wire.js';
import { resolveLogicalIdentityByCategory } from './logical-identity.js';
import { selectMappingEntryByKeys } from './mapping-key-lookup.js';
import { decorateFunctionResult } from './public-result.js';
import {
  selectReturnAbiPlan,
  type ReturnAbiCandidate,
} from './return-abi-plan.js';
import { directMappingReadPlan } from './route-expression-key.js';
import { deriveComposedReturnBlob } from './sc-derive-composed-return.js';
import { legacyStatefulSimulationEnabled } from './soft-state-overlays.js';
import { resolveExternalResultEncoding } from './solidityAbi.js';
import type { ExternalCallInfo } from './stateful-lifecycle-types.js';
import type {
  CallInfo,
  StatefulContract,
  StatefulFunctionCall,
} from './StatefulContract.js';
import type { StatefulTransactionBuilder } from './StatefulTransactionBuilder.js';

type StatefulCall = Extract<CallInfo, { type: 'stateful' }>;

type StateValueType = StateValue;
type LogicalReturnContext = {
  artifact: Artifact;
  call: StatefulCall;
  args: readonly FunctionArgument[];
};

function sameStatePrefixThroughField(
  owner: StateLayout, implementation: StateLayout, nftIndex: number, fieldIndex: number,
): boolean {
  // The commitment codec prefixes every data NFT with an index only in multi-NFT layouts.
  // A 1-to-2 NFT extension therefore changes the wire format even at NFT 0, field 0.
  if ((owner.dataNftCount > 1) !== (implementation.dataNftCount > 1)) return false;
  const wireNftCount = owner.dataNftCount > 1 ? 2 : 1;
  const prefixDigest = (layout: StateLayout): string => childStateLayoutDigest({
    variables: layout.variables.filter((variable) => variable.nftIndex < nftIndex
      || (variable.nftIndex === nftIndex && variable.fieldIndex <= fieldIndex)),
    dataNftCount: wireNftCount,
    commitmentLimit: layout.commitmentLimit,
    structs: layout.structs,
    // Collection entries are separate NFTs and cannot change scalar field offsets.
    collections: [],
  });
  return prefixDigest(owner) === prefixDigest(implementation);
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export interface DeriveReturnValueHost {
  readonly inner: {
    artifact: Artifact;
    provider: NetworkProvider;
    lockingBytecode: Uint8Array;
    address?: string;
    tokenAddress?: string;
    addressType?: string;
  };
  readonly provider: NetworkProvider;
  readonly target: string;
  readonly externalRegistry: ReadonlyMap<string, StatefulContract<Artifact>>;
  lastReturnProbeFailure?: string;
  _deriveSeq?: number;
  addressMappingKeyCandidates(addressValue: unknown): Array<string | Uint8Array>;
  getSoftMapping(collection: string, keys: ReadonlyArray<unknown>): StateValue | undefined;
  resolveCallAbi(functionName: string, args: readonly FunctionArgument[]): AbiFunction | undefined;
  getEntries(collectionNameOrSignature: string): Promise<Array<{
    slot?: Uint8Array;
    key?: bigint | boolean | Uint8Array;
    keys?: Array<bigint | boolean | Uint8Array>;
    value: StateValue;
  }>>;
  createBuilder(functionName: string, args: any[], overrides?: Record<string, unknown>): Promise<StatefulTransactionBuilder>;
  deriveReturnBlob(
    builder: StatefulTransactionBuilder,
    returnOutputIndex: number,
    inputIndex?: number,
  ): Uint8Array | undefined;
  getState(): Promise<Record<string, StateValueType>>;
  getCallerMasterUtxo(caller: StatefulContract<Artifact>): Promise<UnlockableUtxo | undefined>;
  /** The contract being read and the signer its sends would use (the caller of a composed read). */
  readonly contract?: StatefulContract<Artifact>;
  readonly signer?: Signer;
}


/**
 * ethers-style `fn.staticCall(...)` read: run the function's covenant in a read-only VM probe against the
 * current on-chain state + args, extract the encoded return value, and decode it against the ABI output type(s)
 * WITHOUT sending a transaction. A single output returns the decoded value; multiple outputs return an
 * ethers-style array (tuple). Typechain `.toObject()`/`.toArray()` accessors are attached at this boundary.
 */
export async function deriveReturnValue(
  host: DeriveReturnValueHost,
  functionName: string,
  args: FunctionArgument[],
  calls?: CallInfo[],
  exactAbiFunction?: AbiFunction,
  calleeCalls?: ExternalCallInfo[],
  /**
 * Locking bytecode of the contract that calls this callee. The probe materializes the callee frame the final
 * composition reuses - including which entry UTXO each `msg.sender`-keyed mapping slot co-spends - so the
 * caller identity has to reach it here; the signer is only the caller of a top-level EOA call.
 */
  callerLockingBytecode?: Uint8Array,
  /**
 * Category of the contract that calls this callee. The compiler resolves the frame's `msg.sender` address by
 * matching this category against the co-spent inputs, so a probe that leaves it unset makes every
 * `msg.sender`-derived comparison read a sentinel instead of the caller.
 */
  callerCategoryId?: string,
  /**
 * The contract that calls this callee. Its master UTXO is co-spent into the probe so the compiled frame can
 * resolve `msg.sender` exactly as it will in the composed transaction.
 */
  callerContract?: StatefulContract<Artifact>,
): Promise<StateValue> {
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_MSG_SENDER_KEY === '1') {
    // Which caller threaded the identity into this probe: an unthreaded site leaves the probe's caller category
    // at zero and its `msg.sender` comparisons read a sentinel.
    (host as unknown as { _deriveSeq?: number })._deriveSeq =
      ((host as unknown as { _deriveSeq?: number })._deriveSeq ?? 0) + 1;
    console.error('derive-return-value-entry', JSON.stringify({
      seq: (host as unknown as { _deriveSeq?: number })._deriveSeq,
      owner: host.inner.artifact.contractName,
      functionName,
      hasCallerLock: callerLockingBytecode !== undefined,
      callerCategoryId,
      // Whether the caller CONTRACT arrived decides if this probe can co-spend its master; the probe that fails
      // ip 51 has no caller input, so this names the invocation that still needs the extra argument.
      hasCallerContract: callerContract !== undefined,
      // Every frame of the call chain, innermost first, including the frame that logged this line: several
      // closures are named `derive`/`visit`, so a stack that hides its own innermost frame cannot be paired with
      // the enclosing derivation (measured: two nested `transferFrom`/`balanceOf` frames were indistinguishable).
      stack: new Error('drv').stack?.split('\n')
        .filter((line) => line.trim().startsWith('at ')).slice(0, 18)
        .map((line) => line.trim().replace(/\s*\(.*/, '')),
      // Argument digest: pairs a nested derivation with the runtime call its outer probe build triggered.
      args: args.map((argument) => argument instanceof Uint8Array
        ? `b${argument.length}:${binToHex(argument).slice(0, 16)}`
        : typeof argument === 'bigint' ? argument.toString() : String(argument).slice(0, 24)),
    }));
  }
  const directMappingRead = directMappingReadPlan(host.inner.artifact, functionName);
  if (directMappingRead) {
    const keyCandidates = directMappingRead.keyArgumentIndices.reduce<
    Array<Array<string | bigint | boolean | Uint8Array>>
    >(
      (rows, argumentIndex, keyIndex) => rows.flatMap((row) => {
        const argument = args[argumentIndex];
        const candidates = directMappingRead.keyTypes[keyIndex] === 'address'
          ? host.addressMappingKeyCandidates(argument)
          : (typeof argument === 'string' || typeof argument === 'bigint'
            || typeof argument === 'boolean' || argument instanceof Uint8Array)
            ? [argument] : [];
        return candidates.map((key) => [...row, key]);
      }),
      [[]],
    );
    if (legacyStatefulSimulationEnabled(host.provider)) {
      for (const candidate of keyCandidates) {
        const overlay = host.getSoftMapping(directMappingRead.collection, candidate);
        if (overlay !== undefined) return overlay as StateValue;
      }
    }
    const entries = await host.getEntries(directMappingRead.collection);
    for (const candidate of keyCandidates) {
      const collection = host.inner.artifact.stateLayout?.collections?.find((entry) => (
        entry.name === directMappingRead.collection || entry.signature === directMappingRead.collection
      ));
      const match = selectMappingEntryByKeys(entries, candidate, directMappingRead.keyTypes, collection);
      if (match) return decorateFunctionResult(
        match.value, exactAbiFunction ?? host.resolveCallAbi(functionName, args), host.inner.artifact,
      );
    }
    // An absent key reads as its value type's zero value, decorated as a present entry's value is (a struct's
    // carries the decoded accessors a present one does). The declared return type stands in for a collection the
    // layout does not describe.
    const returnFunction = exactAbiFunction ?? host.resolveCallAbi(functionName, args);
    const stateLayout = host.inner.artifact.stateLayout;
    const valueType = stateLayout?.collections?.find((entry) => (
      entry.name === directMappingRead.collection || entry.signature === directMappingRead.collection
    ))?.valueType ?? returnFunction?.outputs?.[0]?.type;
    if (!valueType) throw new Error(`Direct mapping read '${functionName}' has no declared return type`);
    return decorateFunctionResult(
      getDefaultStateValue(valueType, stateLayout?.structs ?? host.inner.artifact.structs),
      returnFunction, host.inner.artifact,
    );
  }
  const abiFunction = exactAbiFunction ?? host.resolveCallAbi(functionName, args);
  // A compiler route is the physical carrier, not the logical result schema: its aggregate `bytes` output and
  // hidden route name cannot decode a selected handler's uint/struct result. Preserve every selected row's
  // stable handler identity and fail closed if one static read would expose multiple logical return values.
  const delegatedReturnCandidates: ReturnAbiCandidate<LogicalReturnContext>[] = (calls ?? [])
    .filter((call): call is StatefulCall => call.type === 'stateful')
    .flatMap((call): ReturnAbiCandidate<LogicalReturnContext>[] => {
      const artifact = call.contract.inner.artifact;
      if (call.compilerRoute) {
        return (call.compilerRoute.rowArguments ?? [])
          .map((row) => ({
            logicalFunction: row.handler,
            physicalFunction: call.compilerRoute!.abiFunction,
            context: { artifact, call, args: row.args },
          }));
      }
      const fn = call.contract._resolveCallAbi(call.functionName, call.args);
      return fn ? [{
        logicalFunction: fn,
        physicalFunction: fn,
        context: { artifact, call, args: call.args },
      }] : [];
    });
  const returnPlan = selectReturnAbiPlan(functionName, abiFunction, delegatedReturnCandidates);
  const directResult = (abiFunction?.outputs?.length ?? 0) > 0;
  const delegatedReturn = returnPlan?.context;
  const resultFunction = returnPlan?.logicalFunction;
  const outputs = resultFunction?.outputs ?? [];
  if (outputs.length === 0) {
    throw new Error(`staticCall: '${functionName}' has no return value to read.`);
  }
  const physicalReturnFunction = returnPlan?.physicalFunction;
  const physicalReturnSlot = physicalReturnFunction?.blockLayout?.slots.find((s) => s.kind === 'returnEvent');
  if (!physicalReturnSlot) {
    throw new Error(`staticCall: '${functionName}' has no returnEvent output slot; its value cannot be derived.`);
  }
  // Only an exact compiler-proven external return has the callee's unchanged return value.
  // Read the authenticated callee directly rather than synthesizing a parent+delegate+callee transaction:
  // inserting the parent's own return channel into that synthetic balanced frame would shift the callee's
  // output coordinates away from its input coordinates. The callee still executes its covenant VM probe.
  const delegatedCall = delegatedReturn?.call;
  const passthrough = resultFunction?.externalCalls?.length === 1
    ? resultFunction.externalCalls[0] : undefined;
  const passthroughOnly = passthrough?.hasReturnValues === true
    && resultFunction?.directExternalReturn !== undefined
    && resultFunction?.directExternalReturn?.callsiteId === passthrough.callsiteId
    && passthrough.addressStateVar !== undefined
    && (passthrough.returnTypes ?? []).length === outputs.length
    && (passthrough.returnTypes ?? []).every((type, index) => type === outputs[index]?.type)
    && (resultFunction?.emits?.length ?? 0) === 0
    && (resultFunction?.transfers?.length ?? 0) === 0
    && (resultFunction?.dynamicWrites?.length ?? 0) === 0
    && !(resultFunction?.entryAccesses ?? []).some((access) => access.operations.some((op) => op !== 'read'));
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env?.SOLIDC_DEBUG_RETURN === '1') {
    console.error('static-return-passthrough', {
      functionName, resultFunction: resultFunction?.name, delegated: delegatedCall?.functionName,
      passthrough: passthrough?.functionName, passthroughOnly,
      delegateRegistry: delegatedCall && [
        ...(delegatedCall.contract as unknown as {
          _externalRegistry: Map<string, StatefulContract>;
        })._externalRegistry.keys(),
      ],
      rootRegistry: [...host.externalRegistry.keys()],
    });
  }
  if (delegatedCall && passthrough && passthroughOnly) {
    const byName = findDeploymentByName(host.inner.provider, passthrough.interfaceName)?.contract
      ?? (/^I[A-Z]/.test(passthrough.interfaceName)
        ? findDeploymentByName(host.inner.provider, passthrough.interfaceName.slice(1))?.contract
        : undefined);
    // The compiler-described stored address is authoritative for this forwarded read. A stale interface
    // binding may only supply the handle if it identifies the same target.
    let byAddress: unknown;
    let storedTarget: string | Uint8Array | undefined;
    const addressStateVar = passthrough.addressStateVar;
    if (addressStateVar !== undefined) {
      try {
        const facadeHost = delegatedCall.contract as StatefulContract & {
          implementation?: StatefulContract;
        };
        const delegateLayout = delegatedCall.contract.inner.artifact.stateLayout;
        const ownerLayout = host.inner.artifact.stateLayout;
        const delegateSlot = delegateLayout?.variables.find((variable) => (
          variable.name === addressStateVar
        ));
        const ownerSlot = ownerLayout?.variables.find((variable) => (
          variable.name === addressStateVar
        ));
        const isDelegatedFacade = (abiFunction?.lowLevelCalls?.length ?? 0) === 1
          && abiFunction?.lowLevelCalls?.[0]?.callMode === 'delegatecall'
          && (calls?.filter((call) => call.type === 'stateful').length ?? 0) === 1;
        // A delegate implementation reads the proxy's state category, not its own unused deployment state.
        // Identical coordinates alone are insufficient: earlier fields with different widths can shift the
        // target's encoded byte offset. Compare the physical prefix through the target before using proxy state.
        const ownerHoldsSlot = isDelegatedFacade && delegateLayout !== undefined
          && ownerLayout !== undefined && delegateSlot !== undefined && ownerSlot !== undefined
          && delegateSlot.nftIndex === ownerSlot.nftIndex
          && delegateSlot.fieldIndex === ownerSlot.fieldIndex
          && delegateSlot.type === ownerSlot.type
          && sameStatePrefixThroughField(
            ownerLayout, delegateLayout, ownerSlot.nftIndex, ownerSlot.fieldIndex,
          );
        const facadeState = isDelegatedFacade
          ? (ownerHoldsSlot ? await host.getState() : undefined)
          : await (facadeHost.implementation ?? facadeHost).getState();
        const stored = facadeState?.[addressStateVar];
        if (typeof stored === 'string' || stored instanceof Uint8Array) {
          storedTarget = stored;
          byAddress = findDeploymentByAddressValue(host.inner.provider, stored)?.contract;
        }
      } catch {
        // Without the authenticated stored target, the passthrough cannot choose a callee by name.
      }
    }
    const delegatedRegistry = (delegatedCall.contract as unknown as {
      _externalRegistry: Map<string, StatefulContract>;
    })._externalRegistry;
    const connectedCandidates = [
      delegatedRegistry.get(passthrough.interfaceName),
      host.externalRegistry.get(passthrough.interfaceName),
      byName,
    ];
    const authenticatedTarget = storedTarget;
    const registered = addressStateVar !== undefined
      ? byAddress ?? (authenticatedTarget === undefined ? undefined : connectedCandidates.find((candidate) => (
        connectedContractMatchesExactAddress(candidate, authenticatedTarget)
      )))
      : connectedCandidates.find((candidate) => candidate !== undefined);
    const facadeDeployment = findDeploymentByAddress(host.inner.provider, host.target);
    const facadeSelfAddress = hexToBin(
      String(facadeDeployment?.lockingBytecode ?? host.inner.lockingBytecode),
    );
    const resolvedArgs = delegatedCall.contract._resolveExternalArgs(
      passthrough.argSources, [...delegatedReturn.args], delegatedCall.contract.inner.artifact,
      undefined, resultFunction!.inputs, undefined, 0, false, facadeSelfAddress,
    );
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_RETURN === '1') {
      console.error('static-return-passthrough-resolve', {
        interfaceName: passthrough.interfaceName,
        functionName: passthrough.functionName,
        addressStateVar: passthrough.addressStateVar,
        hasByName: !!byName,
        hasByAddress: !!byAddress,
        hasRegistered: !!registered,
        hasResolvedArgs: !!resolvedArgs,
        resolvedArgs: resolvedArgs?.map((value) => (
          value instanceof Uint8Array ? `bytes:${value.length}` : String(value)
        )),
      });
    }
    if (registered && resolvedArgs) {
      const callee = registered as StatefulContract & {
        forward?: (name: string, callArgs: FunctionArgument[]) => StatefulFunctionCall;
        call?: Record<string, ((...callArgs: FunctionArgument[]) => StatefulFunctionCall) | undefined>;
        implementation?: StatefulContract & {
          call?: Record<string, ((...callArgs: FunctionArgument[]) => StatefulFunctionCall) | undefined>;
        };
      };
      const callable = callee.call?.[passthrough.functionName]
        ?? callee.implementation?.call?.[passthrough.functionName];
      // Proxy handles expose view/state-getter behavior on their public dispatch surface. That surface can use
      // authenticated proxy state directly (for example, a zero-argument dynamic-array length accessor) while
      // preserving the forwarding boundary for ordinary view functions.
      if ('proxy' in callee) {
        const publicMethod = (callee as unknown as Record<string, unknown>)[passthrough.functionName];
        if (typeof publicMethod === 'function') {
          return (publicMethod as (...values: FunctionArgument[]) => Promise<StateValue>)(...resolvedArgs);
        }
      }
      // A registered proxy handle must execute reads through the same forwarding boundary as writes. Calling
      // its implementation directly reads the implementation's storage category and can produce no authenticated
      // return even though the state-holding proxy has the requested value.
      if (typeof callee.forward === 'function') {
        return callee.forward(passthrough.functionName, resolvedArgs).staticCall();
      }
      if (callable) return callable(...resolvedArgs).staticCall();
    }
  }
  // A top-level read whose calls reach one owner more than once is read from the composition its send would use
  // (deriveComposedReturnBlob). Every other read, and every nested frame, keeps the return probe below.
  let builder: StatefulTransactionBuilder | undefined;
  let blob = host.contract !== undefined && directResult && delegatedReturn === undefined && abiFunction !== undefined
    && (calls?.length ?? 0) === 0 && calleeCalls === undefined && callerContract === undefined
    && callerLockingBytecode === undefined && callerCategoryId === undefined
    ? await deriveComposedReturnBlob(host.contract, host.signer, functionName, args, abiFunction)
    : undefined;
  if (blob === undefined) {
    // emitReturn makes _createBuilder lay out the return-event output; the probe then extracts its commitment.
    // `calls` is the caller's resolved graph (a return-ABI hint); `calleeCalls` are the probed function's OWN
    // published calls, resolved against the frame it is being invoked with. The probe materializes those
    // participants exactly like an ordinary build so its co-spent coordinates name the addresses the callee's
    // identity checks expect instead of the sentinel that points back at the executing input.
    let callerIdentityUtxos: UnlockableUtxo[] | undefined;
    if (callerContract !== undefined) {
      const callerMaster = (await host.getCallerMasterUtxo(callerContract));
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_MSG_SENDER_KEY === '1') {
        // A missing master is why the probe would still have no caller input even though the contract arrived.
        console.error('caller-identity-cospend', JSON.stringify({
          callee: functionName,
          caller: callerContract.inner.artifact.contractName,
          callerCategory: callerContract.categoryId.slice(0, 12),
          masterFound: callerMaster !== undefined,
          outpoint: callerMaster === undefined ? undefined
            : `${String(callerMaster.txid).slice(0, 8)}:${callerMaster.vout}`,
        }));
      }
      if (callerMaster !== undefined) {
        const callerLock = hexToBin(callerContract.inner.lockingBytecode);
        callerIdentityUtxos = [{
          ...callerMaster,
          // Probes execute only input 0, so the lock is all this co-spend has to contribute; a real send of the
          // same frame materializes the caller's own unlocker elsewhere.
          unlocker: {
            generateLockingBytecode: () => callerLock,
            generateUnlockingBytecode: () => new Uint8Array(),
          },
        }];
        // Resolve the caller's immutable identity by category. A handle can expose a
        // physical execution address after a state transition, while msg.sender
        // still uses the logical CREATE identity anchored by this category.
        const callerIdentity = await resolveLogicalIdentityByCategory(
          callerContract.inner.provider, callerContract.categoryId, [callerContract.target],
        );
        if (callerIdentity !== undefined
          && callerIdentity.categoryId.toLowerCase() === callerContract.categoryId.toLowerCase()) {
          callerIdentityUtxos.push({
            ...callerIdentity.anchor,
            unlocker: callerIdentity.unlocker,
          });
        }
      }
    }
    builder = await host.createBuilder(
      functionName, args, {
        emitReturn: true, returnProbeOnly: true, calls, abiFunction, externalCalls: calleeCalls,
        ...(callerIdentityUtxos !== undefined && { callerIdentityUtxos }),
        ...(callerLockingBytecode !== undefined && { callerLockingBytecode }),
        // Wire order, as the compiler's OP_UTXOTOKENCATEGORY exposes it (see the same encoding at the handler
        // build site).
        ...(callerCategoryId !== undefined && callerCategoryId.length > 0
          && { msgSenderCategory: hexToBin(callerCategoryId).reverse() }),
      },
    );
    blob = (builder as any).__derivedReturnBlob as Uint8Array | undefined;
    // A compiler route's physical result coordinate and delegate input belong to the route carrier. Falling back
    // to the logical handler's slot can decode an unrelated output as an authenticated result. Direct and legacy
    // calls retain the established same-function slot fallback.
    if (!blob && !delegatedReturn?.call.compilerRoute) {
      blob = host.deriveReturnBlob(builder, physicalReturnSlot.offset);
    }
    if (!blob) {
      throw new Error(
        `staticCall: could not derive the return value of '${functionName}'. `
        + 'Functions that write state and return a value are not yet supported as reads.'
        // Name the failing probe predicate when one is known: a bare `require` leaves no custom message, so
        // without this the caller sees only "could not derive" and cannot tell which check refused.
        + `${host.lastReturnProbeFailure !== undefined
          ? ` Probe detail: ${host.lastReturnProbeFailure}.` : ''}`,
      );
    }
  }
  const resultArtifact = directResult
    ? host.inner.artifact : delegatedReturn?.artifact ?? host.inner.artifact;
  const resultStructs = resultArtifact.structs ?? resultArtifact.stateLayout?.structs;
  const directArrayReplacements: Array<{ start: number; end: number; encoded: Uint8Array }> = [];
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_RETURN === '1') {
    console.error('static-loop-return-groups', (builder?.getExternalCallUtxoGroups() ?? []).map((group) => ({
      functionName: group.functionName,
      resultArrayOutput: group.loopResultArrayOutput,
      existing: group.loopReturnCommitments?.length,
      resolver: !!group.resolveLoopReturnCommitment,
    })));
  }
  // The parent array's wire format follows the parent result encoding, never the native one: a Solidity-encoded
  // read wraps the array in ABI offset/length words, so the pushdata decoder cannot split the rolled call's
  // array out of the parent blob and the resumed array must be encoded the same way it was decoded.
  const parentResultEncoding = resolveExternalResultEncoding(
    resultFunction?.resultEncoding, resultArtifact, outputs.map((output) => output.type),
    `function '${resultFunction?.name ?? functionName}' result`,
  );
  for (const group of builder?.getExternalCallUtxoGroups() ?? []) {
    const outputIndex = group.loopResultArrayOutput;
    if (outputIndex === undefined || !group.resolveLoopReturnCommitment) continue;
    let offset = 0;
    let targetStart = 0;
    let targetEnd = 0;
    let returnedArray: StateValue | undefined;
    try {
      // A single-output parent is exactly the rolled array, so its decoded prefix is also its blob range.
      const evmPrefix = parentResultEncoding === 'evm-abi-v1' && outputs.length === 1
        ? decodeEvmInvocationResultPrefix(blob, [outputs[0].type], resultStructs, resultArtifact.enums)
        : undefined;
      if (evmPrefix !== undefined) {
        returnedArray = evmPrefix.values[0];
        targetEnd = evmPrefix.bytesConsumed;
      } else {
        for (let index = 0; index <= outputIndex; index++) {
          const output = outputs[index];
          if (!output) break;
          const start = offset;
          const decoded = decodePushdataValue(blob, offset, output.type, resultStructs);
          offset += decoded.bytesConsumed;
          if (index === outputIndex) {
            returnedArray = decoded.value;
            targetStart = start;
            targetEnd = offset;
          }
        }
      }
    } catch {
      continue;
    }
    if (!Array.isArray(returnedArray)) continue;
    const reached = returnedArray.length;
    if (group.loopMaximumOccurrences !== undefined && reached > group.loopMaximumOccurrences) {
      throw new Error(
        `External loop reached ${reached} rows, exceeding the compiler-proven ceiling of `
        + `${group.loopMaximumOccurrences}.`,
      );
    }
    const commitments = group.loopReturnCommitments
      ?? (group.precomputedReturnCommitment ? [group.precomputedReturnCommitment] : []);
    for (let occurrence = commitments.length; occurrence < reached; occurrence++) {
      commitments.push(await group.resolveLoopReturnCommitment(occurrence));
    }
    if (commitments.length > 0) group.loopReturnCommitments = commitments;
    if (commitments.length === reached) {
      const producerArtifact = group.logicalArtifact ?? group.externalContract?.inner?.artifact;
      const producerFunction = group.compilerRoute?.abiFunction
        ?? producerArtifact?.abi.find((candidate: AbiFunction) => (
          candidate.name === (group.logicalFunctionName ?? group.functionName)
        ));
      const producerOutputs = producerFunction?.outputs ?? [];
      if (!producerArtifact || producerOutputs.length !== 1) continue;
      const producerStructs = producerArtifact.structs ?? producerArtifact.stateLayout?.structs;
      const values = commitments.map((commitment) => {
        const decoded = decodeAuthenticatedProducerResultVector(
          commitment,
          [producerOutputs[0].type],
          producerStructs,
          resolveExternalResultEncoding(
            producerFunction.resultEncoding,
            producerArtifact,
            [producerOutputs[0].type],
            `function '${producerFunction.name}' result`,
          ) === 'evm-abi-v1',
          producerArtifact.enums,
        );
        if (!decoded || decoded.length !== 1) {
          throw new Error(
            `Authenticated loop result for '${producerFunction?.name ?? 'external call'}' `
            + 'does not match its declared result schema.',
          );
        }
        return decoded[0] as StateValue;
      });
      directArrayReplacements.push({
        start: targetStart,
        end: targetEnd,
        encoded: parentResultEncoding === 'evm-abi-v1'
          ? encodeEvmInvocationResult([values], [outputs[outputIndex].type], resultStructs, resultArtifact.enums)
          : encodePushdataValue(values, outputs[outputIndex].type, resultStructs),
      });
    }
  }
  if (directArrayReplacements.length > 0) {
    // The compiler marker proves these arrays have no competing writes: each element is exactly the typed return
    // of its corresponding loop occurrence. Compose those individually authenticated values while retaining the
    // provisional parent's authenticated array width and every untouched output byte.
    for (const replacement of directArrayReplacements.sort((left, right) => right.start - left.start)) {
      blob = concatBytes(
        blob.slice(0, replacement.start), replacement.encoded, blob.slice(replacement.end),
      );
    }
  }
  const structs = resultArtifact.stateLayout?.structs ?? resultArtifact.structs;
  if (outputs.length === 1) {
    const returnArtifact = resultArtifact;
    const resultEncoding = resolveExternalResultEncoding(
      resultFunction?.resultEncoding,
      returnArtifact,
      outputs.map((output) => output.type),
      `function '${resultFunction?.name ?? functionName}' result`,
    );
    // A Solidity-encoded result is one complete ABI value of the declared type, which may be an aggregate
    // (dynamic array, fixed array, or struct). Decode it with the full ABI decoder: the scalar-only helper
    // rejects every aggregate, and the native pushdata decoder that would otherwise be used reads the ABI head
    // as a length and silently returns an empty container for a non-empty array.
    const evmDecoded = resultEncoding === 'evm-abi-v1'
      ? decodeEvmInvocationResult(blob, outputs.map((output) => output.type), structs, returnArtifact.enums)?.[0]
      : undefined;
    let decoded: StateValue;
    try {
      const rawDecoded = evmDecoded ?? decodePushdataValue(blob, 0, outputs[0].type, structs).value;
      decoded = (usesLegacyJobEventCompatibility(returnArtifact, outputs[0].type, structs)
        ? normalizeJobEventAddresses(rawDecoded, outputs[0].type, structs)
        : rawDecoded) as StateValue;
    } catch (decodeError) {
      // A failed require can leave an inert/partial return placeholder in the probe. Return decoding is
      // downstream of execution, so it must not replace the contract failure with a codec error. Re-evaluate
      // the already-built transaction through the normal debugger to recover the source-mapped require.
      if ((builder as unknown as { __vmErrored?: boolean } | undefined)?.__vmErrored) {
        const derivationError = (builder as unknown as { __derivationError?: Error }).__derivationError;
        if (derivationError && (globalThis as { process?: { env?: Record<string, string> } }).process?.env
          ?.SOLIDC_DEBUG_RETURN === '1') console.error('static-return-derivation-error', derivationError.message);
        if (derivationError) throw derivationError;
      }
      throw decodeError;
    }
    const addressBytecode = decoded instanceof Uint8Array
      ? decoded
      : typeof decoded === 'string' && decoded.startsWith('0x') ? hexToBin(decoded.slice(2)) : undefined;
    if (outputs[0].type === 'address' && addressBytecode) {
      const cashaddr = lockingBytecodeToCashAddress({
        bytecode: addressBytecode,
        prefix: getNetworkPrefix(host.inner.provider.network),
        tokenSupport: false,
      });
      if (typeof cashaddr !== 'string') return cashaddr.address;
    }
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_RETURN === '1') {
      console.error('static-return-decoded', {
        contract: host.inner.artifact.contractName,
        functionName,
        outputType: outputs[0].type,
        decoded,
      });
    }
    return decorateFunctionResult(decoded, resultFunction, returnArtifact);
  }
  // Multi-value (tuple) returns: the return event carries one encoded component per declared output. Decode the
  // whole vector with the same authenticated-result decoder the external-call path uses, then return an
  // ethers-style Result - an array carrying the named components - so a Solidity `mapping(K => Struct) public m`
  // getter reads exactly like the tuple its interface declares.
  const tupleEncoding = resolveExternalResultEncoding(
    resultFunction?.resultEncoding,
    resultArtifact,
    outputs.map((output) => output.type),
    `function '${resultFunction?.name ?? functionName}' result`,
  );
  const tupleNames = tupleReturnNames(host.inner.artifact, exactAbiFunction ?? resultFunction, outputs.length);
  const tupleDecoded = tupleEncoding === 'evm-abi-v1'
    ? decodeEvmInvocationResult(blob, outputs.map((output) => output.type), structs, resultArtifact.enums)
    : decodeAuthenticatedProducerResultVector(
      blob, outputs.map((output) => output.type), structs, false, resultArtifact.enums,
    );
  if (!tupleDecoded || tupleDecoded.length !== outputs.length) {
    throw new Error(
      `staticCall: '${functionName}' returns ${outputs.length} values but the authenticated return event did `
      + 'not decode as that tuple.',
    );
  }
  // Components keep the representation the artifact's result encoding gives them; an `address` component is the
  // 20-byte account payload the tuple interface declares, never widened into a locking bytecode.
  const tupleValues = tupleDecoded.map((component) => component as StateValue);
  const tuple = [...tupleValues] as StateValue[] & Record<string, StateValue>;
  for (const [index, name] of tupleNames.entries()) {
    Object.defineProperty(tuple, name, {
      value: tupleValues[index], enumerable: true, writable: true, configurable: true,
    });
  }
  Object.defineProperty(tuple, 'toObject', {
    value: (): Record<string, StateValue> => Object.fromEntries(
      tupleNames.map((name, index) => [name, tupleValues[index]]),
    ),
    enumerable: false, writable: true, configurable: true,
  });
  for (const value of tupleValues) attachDecodedAccessors(value);
  return attachDecodedAccessors(tuple as unknown as StateValue);
}

/**
 * Component names for a multi-output getter. A `mapping(K => Struct) public m` getter is published as one scalar
 * output per struct field, in field order (Solidity's auto-getter tuple); the compiler records that struct as the
 * collection's `valueType`, so its field names are the tuple's names. Empty unless the function is exactly a
 * single-collection entry read whose struct value has the same number of scalar fields - never a guess.
 */
function tupleReturnNames(artifact: Artifact, selection: AbiFunction | undefined, outputCount: number): string[] {
  const access = selection?.entryAccesses;
  if (!selection || !access || access.length !== 1 || access[0].operations.length !== 1
    || access[0].operations[0] !== 'read') return [];
  const collection = artifact.stateLayout?.collections?.find(
    (candidate) => candidate.name === access[0].collection,
  );
  const structName = collection?.valueType;
  if (!structName) return [];
  const structs = artifact.stateLayout?.structs ?? artifact.structs;
  const struct = (Array.isArray(structs) ? structs : Object.values(structs ?? {}))
    .find((candidate) => (candidate as { name?: string }).name === structName) as
    { fields: Array<{ name: string; type: string }> } | undefined;
  if (!struct) return [];
  // Mirror the compiler's filter: a getter omits mapping and array members of the struct.
  const kept = struct.fields.filter((field) => !/^mapping\(/.test(field.type) && !/\]$/.test(field.type));
  if (kept.length !== outputCount) return [];
  return kept.map((field) => field.name);
}
