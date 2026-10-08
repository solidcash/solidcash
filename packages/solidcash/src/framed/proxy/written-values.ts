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
 *
 * The hop's own entry is the one frame the hop runs up to a site before it plans that site, so a node its write leaves
 * unstated, at a key its facts determine, is learned rather than refused (`EntryWriteValueAwaited`): the entry is
 * settled on a plan stopped before the site, which closes the node first, and the bytes its settle declares for the
 * node there (`settledWriteValue`) are stated for the write on every later plan of the hop. They only fill the plan:
 * the entry's own close compares the node it rebuilds with the view the transaction declares, and its own call data
 * with the record the site's call carries, so bytes the body does not compute are refused there.
 */

import { bigIntToVmNumber } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/instruction-sets-utils.js';
;
;
;
import {
  VALUE_INLINE_LIMIT, bytesEqual, bytesToHex,
  type AbiFunction, type Artifact, type PublishedWriteSegment, type StateValue,
} from '@solidcash/utils';
import { encodeFunctionArgument, type FunctionArgument } from '../../Argument.js';
import { decodeEntryCommitment, keyToSlotMulti } from '../../stateful/SortedList.js';
import { evalComputedKey } from '../../stateful/route-expression-key.js';
import { accessKeySlot, planCallLoopWrites, type CallLoopWritePlan } from '../call/entry-records.js';
import type { MappingValueReader } from './call-resolution.js';
import { isWholeNodeValue, type HopEntryWrites } from './entry-writes.js';
import { FramedProxyDeployError } from './errors.js';
import { writeRuns } from './write-activation.js';

/** One mapping write a frame's own entry makes, with the node it targets and the bytes it leaves there. */
export interface StatedMappingWrite {
  readonly collection: string;
  /** The slot the write's key(s) hash to, or absent when the frame's own facts do not determine them. */
  readonly slot?: Uint8Array;
  /** The bytes the write leaves the node holding, or absent when its body computes them. */
  readonly value?: Uint8Array;
}

/** The bytes the hop learned the entry's own write leaves a node at, by the node's collection and slot. */
export type LearnedWriteValue = (collection: string, slot: Uint8Array) => Uint8Array | undefined;

/** The key the hop keeps the bytes it learned the entry's own write leaves a node at under. */
export function entryWriteValueKey(collection: string, slot: Uint8Array): string {
  return `entry-write|${collection}|${bytesToHex(slot)}`;
}

/**
 * A site of the hop's own entry reads a node the entry's own write before it leaves at bytes no published fact states,
 * at a key the facts determine: the refusal the hop reports when the entry's settle up to the site learns none.
 */
export class EntryWriteValueAwaited extends FramedProxyDeployError {
  public constructor(
    message: string,
    /** The entry's own site, by its published position. */
    public readonly site: number,
    public readonly collection: string,
    public readonly slot: Uint8Array,
  ) {
    super(message);
  }
}

/** The bytes the entry's own write leaves a node at, learned from the entry's settle up to the site that reads it. */
export class EntryWriteValueLearned extends Error {
  public readonly name = 'EntryWriteValueLearned';

  public constructor(
    public readonly collection: string, public readonly slot: Uint8Array, public readonly value: Uint8Array,
  ) {
    super(`the hop learned the bytes the entry's own write leaves mapping "${collection}" at, before the site that `
      + 'reads them was planned');
  }
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
  // A framed body compiles a deletion as a write of the type's default, which a node holds as the empty item.
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
 * published accesses and loops state them from the frame's own arguments, sender and state, or, for a write they
 * leave unstated at a key they determine, as `learned` holds them. A write a branch guards that those facts, and the
 * mapping values `readMappingValue` reads, decide the body skips is no write: it leaves its node as it found it.
 */
export function statedMappingWrites(
  artifact: Artifact,
  functionName: string,
  args: readonly FunctionArgument[],
  senderAddress: Uint8Array | undefined,
  state: Readonly<Record<string, unknown>>,
  learned?: LearnedWriteValue,
  readMappingValue?: MappingValueReader,
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
    const stated = loopValue(artifact, fn, args, loop);
    return loop.turns.map((turn): StatedMappingWrite => {
      const slot = keyToSlotMulti([...turn.keys]);
      const value = learned?.(loop.collection, slot) ?? stated;
      return { collection: loop.collection, slot, ...(value === undefined ? {} : { value }) };
    });
  });
  const frame = {
    artifact, functionName, args, senderAddress: request.callerLockingBytecode,
    facts: { stateValues: state, ...(readMappingValue === undefined ? {} : { readMappingValue }) },
  };
  const accesses = (fn.entryAccesses ?? [])
    .filter((access) => access.operations.some((operation) => operation !== 'read'))
    .filter((access) => writeRuns(frame, access.activation) !== false)
    .flatMap((access): StatedMappingWrite[] => {
      const slot = accessKeySlot(request, access);
      // A loop's access names its key by the loop's counter, so the loop's turns are its writes.
      if (slot === undefined && loops.some((loop) => loop.collection === access.collection)) return [];
      // The bytes the entry's own close of the node rebuilt are what it holds past the close, whatever one write states.
      const value = (slot === undefined ? undefined : learned?.(access.collection, slot))
        ?? accessValue(artifact, fn, args, access);
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

/**
 * The bytes the entry's own write leaves node (`collection`, `slot`) at, as a settle of the entry has them so far, or
 * undefined while it has none the body computed.
 *
 * A node whose values do not chunk keeps its value as its view's tail, and the plan states a placeholder there, so its
 * bytes are the tail of the view the entry's failing close of the node handed back (`viewOf`, by the node's candidate).
 * A chunking node's are the whole value its write plan states (a value its facts give, or one the entry's chunk pin
 * exposed), or the value its view keeps inline.
 */
export function settledWriteValue(
  artifact: Artifact,
  writes: HopEntryWrites | undefined,
  viewOf: (candidate: Uint8Array) => Uint8Array | undefined,
  collection: string,
  slot: Uint8Array,
): Uint8Array | undefined {
  const declared = artifact.stateLayout?.collections?.find((candidate) => candidate.name === collection);
  const node = writes?.writtenNodes
    .find((candidate) => candidate.collection === collection && bytesEqual(candidate.slot, slot));
  if (writes === undefined || declared === undefined || node === undefined) return undefined;
  const chunking = declared.chunkableValue === true;
  if (chunking && node.value !== undefined) return node.value;
  const at = writes.learningSlotOrder.findIndex((candidate) => bytesEqual(candidate, slot));
  const view = at < 0 ? undefined : viewOf(writes.learningCandidates[at]!);
  if (view === undefined || view.length < 64) return undefined;
  const { slot: viewSlot, value: tail } = decodeEntryCommitment(view);
  if (!bytesEqual(viewSlot, slot)) return undefined;
  if (!chunking) return tail;
  // An inline value is its length's four bytes and the value; a long one keeps its digest and head there instead.
  if (tail.length < 4) return undefined;
  const length = new DataView(tail.buffer, tail.byteOffset, 4).getUint32(0, true);
  if (length > VALUE_INLINE_LIMIT || tail.length !== 4 + length) return undefined;
  const value = tail.slice(4);
  return isWholeNodeValue(declared, value, artifact.structs ?? artifact.stateLayout?.structs) ? value : undefined;
}
