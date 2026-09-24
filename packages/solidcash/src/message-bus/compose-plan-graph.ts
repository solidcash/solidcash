/**
 * phase-boundary extract: Compose phase-boundary extract — owner-local route witnesses + compiled graph plan from prepared calls.
 */

import { binToHex } from '@bitauth/libauth';
import { sha256 } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import {
  resolveMessageBusAbiFunction, resolveMessageBusHandler,
} from './message-bus.js';
import {
  participantOf,
} from './compose-participant-helpers.js';
import {
  semanticJson,
  assertPreparedInvocationIdentity,
  type CallDescriptor,
} from './compose-prepared-invocation.js';
import { deriveCompiledGraphPlan, type WorklistParticipant } from './worklist.js';

type CompiledGraphPlan = ReturnType<typeof deriveCompiledGraphPlan>;

export interface DeriveComposeInvocationPlanOptions {
  descriptors: readonly CallDescriptor[];
  descriptorWitnesses: readonly Record<string, FunctionArgument>[];
  rootCaller: Uint8Array;
  upgradeOutputs: ReadonlyMap<string, string>;
  requirePreparedIdentity: boolean;
  hasPreparedCalls: boolean;
}

export interface DeriveComposeInvocationPlanResult {
  plan: CompiledGraphPlan;
  workParticipants: WorklistParticipant[];
  ownerWitnesses: Map<string, Record<string, FunctionArgument>>;
}

function inactiveRouteWitnessFiller(name: string, type: string): FunctionArgument {
  const digest = sha256(new TextEncoder().encode(`SolidCash message-bus inactive key\0${name}`));
  if (type === 'address' || type === 'address payable') {
    return new Uint8Array([0xaa, 0x20, ...digest, 0x87]);
  }
  const bytes = /^bytes(\d+)$/.exec(type);
  if (bytes) return digest.slice(0, Number(bytes[1]));
  if (type === 'bytes') return digest;
  if (type === 'string') return `__solidcash_inactive_${binToHex(digest)}`;
  if (type === 'bool') return (digest[0] & 1) === 1;
  if (/^(u?int\d*|bigint)$/.test(type)) {
    return digest.slice(0, 8).reduce((value, byte, index) =>
      value | (BigInt(byte) << BigInt(index * 8)), 0n);
  }
  throw new Error(`messageBus: cannot derive an inactive route witness of type '${type}'`);
}

/**
 * Aggregate expression-derived route witnesses per owner, fill inactive key slots, then derive the
 * compiled invocation plan by walking prepared descriptors in compiler depth-first order.
 */
export function deriveComposeInvocationPlan(
  options: DeriveComposeInvocationPlanOptions,
): DeriveComposeInvocationPlanResult {
  const {
    descriptors, descriptorWitnesses, rootCaller, upgradeOutputs,
    requirePreparedIdentity, hasPreparedCalls,
  } = options;

  // `planCompiledGraph` interns one participant per locking bytecode and then batches that owner's rows in
  // global invocation order. Aggregate each prepared invocation's derived values into that same owner-local
  // row numbering before planning, so a route input named `_rN` receives the Nth invocation's proven key.
  const ownerWitnesses = new Map<string, Record<string, FunctionArgument>>();
  const ownerRows = new Map<string, number>();
  const ownerActiveRouteKeys = new Map<string, Set<string>>();
  descriptors.forEach((descriptor, index) => {
    const owner = descriptor.contract.inner.lockingBytecode.toLowerCase();
    const row = ownerRows.get(owner) ?? 0;
    ownerRows.set(owner, row + 1);
    const aggregate = ownerWitnesses.get(owner) ?? {};
    const abi = resolveMessageBusAbiFunction(
      descriptor.artifact, descriptor.functionName, descriptor.selector,
    );
    const handler = resolveMessageBusHandler(descriptor.artifact, descriptor.functionName, abi?.selector);
    const activeRouteKeys = ownerActiveRouteKeys.get(owner) ?? new Set<string>();
    for (const binding of handler?.batchKeyWitnesses ?? []) {
      activeRouteKeys.add(binding.perRow ? `${binding.routeInput}_r${row}` : binding.routeInput);
      if (binding.alternateRouteInput) activeRouteKeys.add(binding.alternateRouteInput);
    }
    ownerActiveRouteKeys.set(owner, activeRouteKeys);
    for (const binding of handler?.batchKeyWitnesses?.filter((candidate) =>
      candidate.source === 'expression') ?? []) {
      const value = descriptorWitnesses[index][binding.routeInput];
      if (value === undefined) continue;
      const name = binding.perRow ? `${binding.routeInput}_r${row}` : binding.routeInput;
      const prior = aggregate[name];
      if (prior !== undefined && semanticJson(prior) !== semanticJson(value)) {
        throw new Error(`messageBus: derived route witness '${name}' disagrees across prepared calls`);
      }
      aggregate[name] = value;
    }
    ownerWitnesses.set(owner, aggregate);
  });
  // A route publishes the union of every admitted handler's key positions. The selected rows may leave both
  // global keys (an entirely inactive sibling handler) and row-local keys (unused capacity) unbound, but the
  // balanced physical route still needs a typed, collision-free absent-key probe for each slot. These values
  // are compiler-inactive: encodeMessageBatch derives and overrides every active binding, and the route gates
  // inactive entry slots off. Keep strict encodeMessageBatch callers explicit; only the compiler-DAG composer
  // derives these deterministic fillers.
  for (const descriptor of descriptors) {
    const owner = descriptor.contract.inner.lockingBytecode.toLowerCase();
    const aggregate = ownerWitnesses.get(owner) ?? {};
    const activeRouteKeys = ownerActiveRouteKeys.get(owner) ?? new Set<string>();
    for (const input of descriptor.artifact.messageBus?.route.inputs ?? []) {
      if (!input.name.startsWith('__message_bus_key_') || aggregate[input.name] !== undefined) continue;
      // Direct-argument and msg.sender bindings are derived by encodeMessageBatch from the authenticated
      // invocation row. Supplying an inactive filler for one of these active positions creates an artificial
      // conflict with the real key and can never identify a physical entry.
      if (activeRouteKeys.has(input.name)) continue;
      // An unrolled route's collection journal initializes every bounded row cache before dispatch. Reuse an
      // actually bound value from the same row-parameter family for unused capacity: those inactive caches then
      // alias one real logical entry and can share its proof safely. A distinct filler per row creates distinct
      // absent targets which often require the same predecessor UTXO, an impossible duplicate transaction input.
      // Entirely inactive handler families retain a deterministic typed filler.
      const family = input.name.replace(/_r\d+$/, '');
      const activeFamilyValue = Object.entries(aggregate).find(([name]) =>
        name.replace(/_r\d+$/, '') === family)?.[1];
      aggregate[input.name] = activeFamilyValue
        ?? inactiveRouteWitnessFiller(`${owner}:${input.name}`, input.type);
    }
    ownerWitnesses.set(owner, aggregate);
  }
  // Diagnostic (`SOLIDC_DEBUG_WITNESS_SIZES=min,max`): the route witness entries whose byte length falls in a
  // window, with their names. A value the program compares as two covenant-sized pieces has to be found by
  // length first: the parameter name then says where the composer filled it.
  if ((globalThis as { process?: { env?: Record<string, string> } }).process
    ?.env?.SOLIDC_DEBUG_WITNESS_SIZES !== undefined) {
    const [minBytes, maxBytes] = String(
      (globalThis as { process?: { env?: Record<string, string> } }).process
        ?.env?.SOLIDC_DEBUG_WITNESS_SIZES,
    ).split(',').map((part) => Number(part));
    for (const [owner, aggregate] of ownerWitnesses) {
      const hits = Object.entries(aggregate).flatMap(([name, value]) => (
        value instanceof Uint8Array && value.length >= (minBytes || 200) && value.length <= (maxBytes || 900)
          ? [{ name, bytes: value.length, hex: binToHex(value).slice(0, 64) }] : []
      ));
      if (hits.length > 0) console.error('route-witness-sizes', { owner, hits });
    }
  }
  const workParticipants = descriptors.map((descriptor) => participantOf(
    descriptor,
    Object.freeze(ownerWitnesses.get(descriptor.contract.inner.lockingBytecode.toLowerCase()) ?? {}),
    upgradeOutputs.get(descriptor.contract.inner.lockingBytecode.toLowerCase()),
  ));

  let next = 1;
  const plan = deriveCompiledGraphPlan({
    root: workParticipants[0],
    function: descriptors[0].functionName,
    ...(descriptors[0].selector !== undefined && { selector: descriptors[0].selector }),
    args: descriptors[0].args,
    rootCaller,
    targets: {},
    target: ({ callsiteId, batchLogicalIndex, occurrence }) => {
      const descriptor = descriptors[next];
      if (!descriptor) return undefined;
      if (descriptor.callsiteId !== undefined && descriptor.callsiteId !== callsiteId) return undefined;
      const descriptorLogical = descriptor.sourceLogicalIndex ?? descriptor.batchLogicalIndex;
      const descriptorOccurrence = descriptor.occurrenceIndex ?? descriptor.batchOccurrenceIndex;
      if (batchLogicalIndex !== undefined
        && descriptorLogical !== undefined
        && descriptorLogical !== batchLogicalIndex) return undefined;
      if (batchLogicalIndex !== undefined
        && descriptorOccurrence !== undefined
        && descriptorOccurrence !== occurrence) return undefined;
      next += 1;
      return {
        participant: workParticipants[next - 1],
        ...(descriptor.selector !== undefined && { selector: descriptor.selector }),
        ...(descriptor.targetLockingBytecode !== undefined && {
          targetLockingBytecode: descriptor.targetLockingBytecode,
        }),
      };
    },
    batchOccurrences: ({ callsiteId, batchLogicalIndex }) => {
      const reached: number[] = [];
      for (let cursor = next; cursor < descriptors.length; cursor += 1) {
        const descriptor = descriptors[cursor];
        const descriptorLogical = descriptor.sourceLogicalIndex ?? descriptor.batchLogicalIndex;
        const descriptorOccurrence = descriptor.occurrenceIndex ?? descriptor.batchOccurrenceIndex;
        if (descriptor.callsiteId !== callsiteId
          || descriptorLogical !== batchLogicalIndex) break;
        if (descriptorOccurrence === undefined) {
          // Transparent promotion always stamps occurrence; positional fallback is legacy `calls:` only.
          if (requirePreparedIdentity) {
            throw new Error(
              `messageBus: prepared batched callsite ${callsiteId} row ${batchLogicalIndex} `
              + 'omits its source occurrence',
            );
          }
          reached.push(reached.length);
          continue;
        }
        reached.push(descriptorOccurrence);
      }
      return reached.length > 0 || hasPreparedCalls ? reached : undefined;
    },
    occurrence: ({ participant, function: ownerFunction, selector, callsiteId, kind }) => {
      const abiFunction = resolveMessageBusAbiFunction(participant.artifact, ownerFunction, selector);
      const callsite = abiFunction?.externalCalls?.find((candidate) => candidate.callsiteId === callsiteId);
      if (!callsite) {
        throw new Error(`messageBus: compiler omitted occurrence metadata for callsite ${callsiteId}`);
      }
      const maximum = callsite.maximumOccurrences ?? (kind === 'conditional' ? 1 : 0);
      // Compiler-authored raw edges retain `functionName: __raw__` and publish the decoded concrete selector
      // separately. Prepared calls use that concrete function name, so occurrence matching must do the same.
      let count = 0;
      while (count < maximum) {
        const reached = descriptors[next + count];
        if (!reached) break;
        // Several conditional branches may call the same target method. Method/selector matching alone makes
        // an untaken sibling indistinguishable from the reached branch. Transparent promotion preserves the
        // compiler's parent-local identity, so it is authoritative when present; manually composed calls retain
        // the legacy structural matching below.
        if (reached.callsiteId !== undefined && reached.callsiteId !== callsiteId) break;
        const matches = callsite.rawFunctionName
          ? reached.functionName === callsite.rawFunctionName
          : callsite.rawSelector
            ? resolveMessageBusAbiFunction(
              reached.artifact, reached.functionName, reached.selector,
            )?.selector?.toLowerCase() === callsite.rawSelector.toLowerCase()
            : reached.functionName === callsite.functionName;
        if (!matches) break;
        count += 1;
      }
      return count;
    },
    expressionArgument: ({ callsiteId, argument }) => {
      const reached = descriptors[next - 1];
      const value = reached?.args[argument];
      if (value === undefined) {
        throw new Error(
          `messageBus: prepared call omits derived argument ${argument} for callsite ${callsiteId}`,
        );
      }
      return value;
    },
    dynamicCall: ({ callsiteId, kind }) => {
      if (kind !== 'low-level') {
        throw new Error(`messageBus: atomic composer does not yet resolve ${kind} calls`);
      }
      const descriptor = descriptors[next];
      if (!descriptor) throw new Error('messageBus: prepared calls omit a low-level target');
      if (descriptor.callsiteId !== undefined && descriptor.callsiteId !== callsiteId) {
        throw new Error(
          `messageBus: prepared low-level callsite ${descriptor.callsiteId} cannot satisfy callsite ${callsiteId}`,
        );
      }
      next += 1;
      return {
        participant: workParticipants[next - 1],
        function: descriptor.functionName,
        ...(descriptor.selector !== undefined && { selector: descriptor.selector }),
        args: descriptor.args,
        ...(descriptor.targetLockingBytecode !== undefined && {
          targetLockingBytecode: descriptor.targetLockingBytecode,
        }),
      };
    },
  });
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_ATOMIC_PROMOTION === '1') {
    console.error('atomic-prepared-plan', JSON.stringify({
      descriptors: descriptors.map((descriptor) => ({
        functionName: descriptor.functionName,
        callsiteId: descriptor.callsiteId,
        batchLogicalIndex: descriptor.batchLogicalIndex,
        batchOccurrenceIndex: descriptor.batchOccurrenceIndex,
      })),
      invocations: plan.invocations.map((invocation) => ({
        functionName: invocation.function,
        parent: invocation.parent,
        callsiteId: invocation.consumerCallsiteId,
        argsHex: invocation.argsHex,
      })),
    }));
  }
  if (plan.invocations.length !== descriptors.length) {
    throw new Error(
      `messageBus: prepared ${descriptors.length} call(s), but the compiled graph reaches `
      + `${plan.invocations.length}`,
    );
  }
  if (requirePreparedIdentity) {
    // The SDK transport tags every descriptor it builds, starting with the root (`__preparedAtomicCalls` sets
    // `producerPath` unconditionally), while a hand-written prepared call - the public
    // `messageBus.compose({ preparedCalls })` API - carries no compiler identity at all and has nothing to
    // agree with. Keying on the whole set rather than per descriptor keeps a transported descriptor that lost
    // its path a refusal here instead of a silent skip.
    const transported = descriptors.some((descriptor) => descriptor.producerPath !== undefined);
    if (transported) {
      plan.invocations.forEach((invocation, index) => {
        assertPreparedInvocationIdentity(descriptors[index], invocation, index);
      });
    }
  }
  return { plan, workParticipants, ownerWitnesses };
}
