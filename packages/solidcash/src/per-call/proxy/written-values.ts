/**
 * The bytes a frame's own mapping writes leave a node holding, as its entry's published facts state them.
 *
 * A call a frame routes through a value a mapping holds is planned from that value (`liveMappingValueReader`), and
 * the deployment holds every node as it was before the hop. A write the frame makes before the call, or one an
 * earlier reach of the hop made, leaves the node at another value, and the body reads that one. Each write publishes
 * where its value comes from: a parameter it stores (`valueParam`, or a `valueSource` naming one), a literal or an
 * expression over the entry's own arguments, a deletion, which leaves the type's default, or the one value a run-time
 * loop stores under every key. Those are stated here as the node holds them, the body's own stack item, which is what
 * `mappingValueOf` reads. A value the body computes from anything else (the node's own earlier value, a struct it
 * builds, its state) is left unstated, and so is the key of a write the frame's own facts do not determine: a read of
 * such a node is refused by name rather than planned from bytes the node does not hold.
 */

import { bigIntToVmNumber } from '@bitauth/libauth';
import type { AbiFunction, Artifact, PublishedWriteSegment, StateValue } from '@solidcash/utils';
import { encodeFunctionArgument, type FunctionArgument } from '../../Argument.js';
import { keyToSlotMulti } from '../../stateful/SortedList.js';
import { evalComputedKey } from '../../stateful/route-expression-key.js';
import { accessKeySlot, planCallLoopWrites, type CallLoopWritePlan } from '../call/entry-records.js';

/** One mapping write a frame's own entry makes, with the node it targets and the bytes it leaves there. */
export interface StatedMappingWrite {
  readonly collection: string;
  /** The slot the write's key(s) hash to, or absent when the frame's own facts do not determine them. */
  readonly slot?: Uint8Array;
  /** The bytes the write leaves the node holding, or absent when its body computes them. */
  readonly value?: Uint8Array;
}

/** One write access of an entry, as its ABI publishes it. */
type WriteAccess = NonNullable<AbiFunction['entryAccesses']>[number];

/** The entry's visible inputs, which a parameter name is resolved against. */
function visibleInputs(fn: AbiFunction): AbiFunction['inputs'] {
  return fn.inputs.filter((input) => !input.name.startsWith('__internal__'));
}

/** One parameter's own stack item, which the frame's call data pushes for it, or undefined for none. */
function parameterItem(
  artifact: Artifact, fn: AbiFunction, args: readonly FunctionArgument[], name: string,
): Uint8Array | undefined {
  const visible = visibleInputs(fn);
  const index = visible.findIndex((input) => input.name === name);
  if (index < 0 || index >= args.length) return undefined;
  try {
    const item = encodeFunctionArgument(args[index]!, visible[index]!.type, artifact.structs);
    return item instanceof Uint8Array ? item : undefined;
  } catch {
    return undefined;
  }
}

/** The bytes one write access stores, as its node holds them, or undefined when the body computes them. */
function accessValue(
  artifact: Artifact, fn: AbiFunction, args: readonly FunctionArgument[], access: WriteAccess,
): Uint8Array | undefined {
  const written = access.operations.filter((operation) => operation !== 'read');
  // A per-call body compiles a deletion as a write of the type's default, which a node holds as the empty item.
  if (written.length === 1 && written[0] === 'delete') return new Uint8Array(0);
  if (written.length !== 1 || written[0] !== 'write') return undefined;
  const parameter = access.valueParam ?? access.valueSource?.match(/^id:([A-Za-z_$][\w$]*)$/)?.[1];
  const stored = parameter === undefined ? undefined : parameterItem(artifact, fn, args, parameter);
  if (stored !== undefined || access.valueSource === undefined) return stored;
  try {
    return evalComputedKey(access.valueSource, [...args], visibleInputs(fn), undefined, undefined);
  } catch {
    return undefined;
  }
}

/** The one value a run-time loop stores under every key, as its nodes hold it, or undefined when none is stated. */
function loopValue(
  artifact: Artifact, fn: AbiFunction, args: readonly FunctionArgument[], loop: CallLoopWritePlan,
): Uint8Array | undefined {
  if (loop.op === 'delete') return new Uint8Array(0);
  if (loop.op !== 'set') return undefined;
  if (loop.valueBool !== undefined) return bigIntToVmNumber(loop.valueBool ? 1n : 0n);
  if (loop.valueConst !== undefined) return bigIntToVmNumber(BigInt(loop.valueConst));
  return loop.valueScalarParam === '' ? undefined : parameterItem(artifact, fn, args, loop.valueScalarParam);
}

/**
 * Every mapping write a frame's own entry makes, with the slot each targets and the bytes each leaves, as the entry's
 * published accesses and loops state them from the frame's own arguments, sender and state.
 */
export function statedMappingWrites(
  artifact: Artifact,
  functionName: string,
  args: readonly FunctionArgument[],
  senderAddress: Uint8Array | undefined,
  state: Readonly<Record<string, unknown>>,
): readonly StatedMappingWrite[] {
  const fn = artifact.abi.find((candidate) => candidate.name === functionName);
  if (fn === undefined) return [];
  const request = {
    artifact, functionName, args, callerLockingBytecode: senderAddress ?? new Uint8Array(0),
    state: state as Readonly<Record<string, StateValue>>,
  };
  let loops: readonly CallLoopWritePlan[] = [];
  try {
    loops = planCallLoopWrites(request) ?? [];
  } catch {
    // A loop the call path cannot walk keeps its access, whose key names no node: every read of the mapping refuses.
  }
  const turns = loops.flatMap((loop) => {
    const value = loopValue(artifact, fn, args, loop);
    return loop.turns.map((turn): StatedMappingWrite => ({
      collection: loop.collection, slot: keyToSlotMulti([...turn.keys]), ...(value === undefined ? {} : { value }),
    }));
  });
  const accesses = (fn.entryAccesses ?? [])
    .filter((access) => access.operations.some((operation) => operation !== 'read'))
    .flatMap((access): StatedMappingWrite[] => {
      const slot = accessKeySlot(request, access);
      // A loop's access names its key by the loop's counter, so the loop's turns are its writes.
      if (slot === undefined && loops.some((loop) => loop.collection === access.collection)) return [];
      const value = accessValue(artifact, fn, args, access);
      return [{
        collection: access.collection,
        ...(slot === undefined ? {} : { slot }),
        ...(value === undefined ? {} : { value }),
      }];
    });
  return [...accesses, ...turns];
}

/**
 * True when an entry's write of `collection` can land before its call site `site`, as its published write segments
 * place it: a segment counts the calls before the write, a run-time loop's turn writes past as many of the calls its
 * turn makes from its own site, and a write whose segment the source does not fix may land before any site.
 */
export function writeLandsBefore(
  segments: readonly PublishedWriteSegment[] | undefined, collection: string, site: number,
): boolean {
  const placed = (segments ?? []).filter((write) => (write.turns?.collection ?? write.collection) === collection);
  if (placed.length === 0) return true;
  return placed.some((write) => typeof write.segment === 'number'
    && (write.turns === undefined ? 0 : write.turns.site) + write.segment <= site);
}
