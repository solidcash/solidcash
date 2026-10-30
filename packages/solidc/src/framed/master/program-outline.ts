/**
 * Sharing the repeated spans of a finished master program.
 *
 * A framed master is emitted straight-line: the head, then the entry's body, with every state access walking the
 * frame's own witness block and every address key normalised where it is used. Those walks are byte-identical from
 * one access to the next, so a master carries the same span tens of times. This pass moves each repeated span into
 * an `OP_DEFINE`d function, defined ahead of the head, and calls it with `<id> OP_INVOKE` where it stood.
 *
 * An invoked body runs on the caller's stack and alternate stack, so a span is relocatable whenever its control flow
 * is balanced and it reads nothing of the script it sits in. The outliner's own rules hold for everything but the
 * alternate stack: no `OP_DEFINE`, no `OP_ACTIVEBYTECODE`, no signature check. The alternate-stack handoffs between
 * the head and the body are only a convention of the emitted code, which nothing reads once the program is finished,
 * so a span may carry either half of one.
 *
 * What a later step does read stays in place. `require` and `console.log` sites keep the pointers a refusal report
 * reads. The reserved slots a deployment fills are located by their exact pushes, and each read of the contract's
 * address from the running script (`OP_ACTIVEBYTECODE <offset> OP_SPLIT ...`) is retargeted to the slot once the
 * program is final, so both stay whole in the program itself.
 */

import {
  decodeInt,
  encodeInt,
  Op,
  outlineSharedSpans,
  scriptToBytecode,
  type FullLocationData,
  type OutlinedFunction,
  type Script,
} from '@solidcash/utils';
import type { MasterProgramParts } from './lifecycle.js';
import { findPlaceholderOffsets } from './master-program.js';
import { frameworkIdentifiers } from '../framework-library.js';

/** A function the pass defined ahead of the program, by the number its identifier encodes. */
export interface FramedOutlinedFunction {
  readonly id: number;
  readonly script: Script;
  readonly locationData: FullLocationData;
}

/** Elements that follow an `OP_ACTIVEBYTECODE` in an address read: `<offset> OP_SPLIT OP_NIP <35> OP_SPLIT OP_DROP`. */
const ADDRESS_READ_TAIL_ELEMENTS = 6;

/**
 * Smallest span considered, in instructions. A span of fewer cannot repay its definition and the two-element call
 * that replaces it often enough to matter, and every call it adds costs two evaluated instructions.
 */
const MINIMUM_SPAN_ELEMENTS = 8;

/**
 * Shares the repeated spans of `parts`, returning the rewritten program and the functions it now defines.
 *
 * `declaresTemplateHash` says whether the program reserves the validator-program-hash slot, which decides the
 * reserved pushes that must stay in place.
 */
export function outlineFramedMasterProgram(
  parts: MasterProgramParts,
  declaresTemplateHash: boolean,
  constantLock = false,
): { parts: MasterProgramParts; functions: FramedOutlinedFunction[] } {
  const ids = new FunctionIdPool(functionIdsInUse(parts.script));
  const anchors = programAnchors(parts, declaresTemplateHash, constantLock);
  const first = outlineSharedSpans(
    [{ script: parts.script, locationData: parts.locationData, anchors }],
    () => ids.allocate(), () => ids.peekPushBytes(), 'savings', MINIMUM_SPAN_ELEMENTS, 12288, undefined, 6,
    undefined, true,
  );
  if (first.functions.length === 0) return { parts, functions: [] };
  // A second pass may move a call of a function that already exists, so a span that merely contains one of the
  // first pass's calls is still shared. Every function here has a stack-only interface.
  const callable = new Set([...ids.inUseNumbers(), ...first.functions.map((fn) => Number(decodeInt(fn.id)))]);
  const firstBody = first.bodies[0]!;
  const nested = outlineSharedSpans(
    [{
      script: firstBody.script,
      locationData: firstBody.locationData,
      anchors: anchors.map((anchor) => firstBody.indexMap[anchor] ?? anchor),
    }, ...first.functions.map((fn) => ({ script: fn.script, locationData: fn.locationData }))],
    () => ids.allocate(), () => ids.peekPushBytes(), 'savings', MINIMUM_SPAN_ELEMENTS, 12288, undefined, 6,
    callable, true,
  );
  const body = nested.bodies[0]!;
  const indexMap = firstBody.indexMap.map((position) => body.indexMap[position] ?? position);
  const functions = [
    ...first.functions.map((fn, index) => ({ ...fn, script: nested.bodies[index + 1]!.script,
      locationData: nested.bodies[index + 1]!.locationData })),
    ...nested.functions,
  ];
  relabelByUse(body.script, functions);

  const definitions: Script = functions.flatMap((fn) => [scriptToBytecode(fn.script), fn.id, Op.OP_DEFINE]);
  const at = parts.locationData[0]!;
  const shift = definitions.length;
  const remap = (ip: number): number => (indexMap[ip] ?? ip) + shift;
  return {
    parts: {
      script: [...definitions, ...body.script],
      locationData: [...definitions.map(() => at), ...body.locationData],
      logs: parts.logs.map((log) => ({
        ...log,
        ip: remap(log.ip),
        data: log.data.map((item) => (typeof item === 'string' ? item : { ...item, ip: remap(item.ip) })),
      })),
      requires: parts.requires.map((entry) => ({ ...entry, ip: remap(entry.ip) })),
    },
    functions: functions.map((fn) => ({
      id: Number(decodeInt(fn.id)), script: fn.script, locationData: fn.locationData,
    })),
  };
}

/** The instructions no shared span may contain: debug sites, reserved slots and the address reads. */
function programAnchors(parts: MasterProgramParts, declaresTemplateHash: boolean, constantLock: boolean): number[] {
  const anchors = [
    ...parts.requires.map((entry) => entry.ip),
    ...parts.logs.flatMap((log) => [log.ip, ...log.data.flatMap((item) => (typeof item === 'string' ? [] : [item.ip]))]),
  ];
  parts.script.forEach((element, index) => {
    if (element !== Op.OP_ACTIVEBYTECODE) return;
    for (let offset = 0; offset <= ADDRESS_READ_TAIL_ELEMENTS; offset += 1) anchors.push(index + offset);
  });
  // A constant-lock master reserves no slot a deployment writes.
  const offsets = constantLock ? {} : findPlaceholderOffsets(scriptToBytecode(parts.script), declaresTemplateHash);
  const slots = new Set<number>(Object.values(offsets).filter((offset): offset is number => offset !== undefined));
  let byte = 0;
  parts.script.forEach((element, index) => {
    if (slots.has(byte)) anchors.push(index);
    byte += scriptToBytecode([element]).length;
  });
  return anchors;
}

/**
 * The identifiers the program already defines or calls, as hex, and the framework library's: a per-entry master's head
 * defines those at run time, so an outlined function under one would fail that definition (framework-library.ts).
 */
function functionIdsInUse(script: Script): Set<string> {
  const used = new Set<string>(frameworkIdentifiers().map((id) => hexOf(encodeInt(id))));
  for (let index = 1; index < script.length; index += 1) {
    const element = script[index];
    if (element !== Op.OP_DEFINE && element !== Op.OP_INVOKE) continue;
    const operand = pushedBytes(script[index - 1]!);
    if (operand !== undefined) used.add(hexOf(operand));
  }
  return used;
}

/** The bytes an element pushes: a data element, or the small-number opcodes that push one without data. */
function pushedBytes(element: Script[number]): Uint8Array | undefined {
  if (element instanceof Uint8Array) return element;
  if (element === Op.OP_0) return new Uint8Array(0);
  if (element === Op.OP_1NEGATE) return Uint8Array.of(0x81);
  if (element >= Op.OP_1 && element <= Op.OP_16) return Uint8Array.of(element - Op.OP_1 + 1);
  return undefined;
}

/**
 * Identifiers free in the program, cheapest push first: the numbers 1-16 and -1, which encode as one opcode, then
 * the one-byte numbers, then the two-byte ones. Each is a minimal script number, so a debug record can name it.
 */
class FunctionIdPool {
  private readonly order: Uint8Array[] = [];
  private next = 0;

  constructor(private readonly used: ReadonlySet<string>) {
    const numbers = [
      ...Array.from({ length: 16 }, (_unused, index) => index + 1), -1,
      ...Array.from({ length: 111 }, (_unused, index) => index + 17),
      ...Array.from({ length: 126 }, (_unused, index) => -(index + 2)),
      ...Array.from({ length: 32640 }, (_unused, index) => index + 128),
    ];
    for (const value of numbers) {
      const id = encodeInt(BigInt(value));
      if (!used.has(hexOf(id))) this.order.push(id);
    }
  }

  allocate(): Uint8Array {
    const id = this.order[this.next];
    if (id === undefined) throw new Error('the framed master outliner ran out of function identifiers');
    this.next += 1;
    return id;
  }

  /** The encoded width of the next identifier's push. */
  peekPushBytes(): number {
    const id = this.order[this.next];
    return id === undefined ? 4 : scriptToBytecode([id]).length;
  }

  /** The numbers the program's own identifiers encode, where they are script numbers. */
  inUseNumbers(): number[] {
    return [...this.used].flatMap((hex) => {
      try {
        return [Number(decodeInt(hexToBytes(hex)))];
      } catch {
        return [];
      }
    });
  }
}

/**
 * Gives the most-called functions the cheapest identifiers. An identifier is a label and one element wherever it
 * stands, so the permutation moves no instruction and only the encoded width of the calls.
 */
function relabelByUse(body: Script, functions: OutlinedFunction[]): void {
  if (functions.length < 2) return;
  const calls = new Map<string, number>();
  const count = (script: Script): void => {
    for (let index = 1; index < script.length; index += 1) {
      const operand = script[index - 1];
      if (script[index] === Op.OP_INVOKE && operand instanceof Uint8Array) {
        calls.set(hexOf(operand), (calls.get(hexOf(operand)) ?? 0) + 1);
      }
    }
  };
  count(body);
  for (const fn of functions) count(fn.script);
  const width = (id: Uint8Array): number => scriptToBytecode([id]).length;
  const cheapest = functions.map((fn) => fn.id).sort((left, right) => width(left) - width(right));
  const byUse = [...functions].sort((left, right) =>
    (calls.get(hexOf(right.id)) ?? 0) - (calls.get(hexOf(left.id)) ?? 0));
  const relabel = new Map<string, Uint8Array>();
  byUse.forEach((fn, index) => relabel.set(hexOf(fn.id), cheapest[index]!));
  const rewrite = (script: Script): void => {
    for (let index = 1; index < script.length; index += 1) {
      const operand = script[index - 1];
      if (script[index] !== Op.OP_INVOKE || !(operand instanceof Uint8Array)) continue;
      const label = relabel.get(hexOf(operand));
      if (label !== undefined) script[index - 1] = label;
    }
  };
  rewrite(body);
  for (const fn of functions) {
    rewrite(fn.script);
    fn.id = relabel.get(hexOf(fn.id))!;
  }
}

function hexOf(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array {
  return Uint8Array.from(hex.match(/../g) ?? [], (pair) => Number.parseInt(pair, 16));
}
