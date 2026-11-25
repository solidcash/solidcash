/**
 * O8 of the deployer-coins spec (A16.2, B6.0): every arm of a direct stateful master starts from an exact stack.
 *
 * An arm's head is the code it opens with: the positional items its kind takes, then `OP_DEPTH n OP_NUMEQUALVERIFY`
 * with n the number of items the compiler's model holds there. A dispatched entry's selector was taken by the
 * dispatcher, so its head is the check alone. A route route first drops its positional items; under the
 * proxy-forward envelope it keeps the drop's decision across the check and then re-reads the proxy master index
 * where the model holds it. A body that can also run as a frame of the multi-call entry takes its call context and
 * checks only a standalone run. The multi-call entry takes its frames before its check.
 *
 * The generator records each arm's head; `verifyArmHeads` reads the finished code and requires every recorded arm
 * to begin with the head its form gives, so nothing an emitter or a later pass put before the check goes unseen.
 */
import {
  Op, encodeInt, scriptToBytecode, type Script,
} from '@solidcash/utils';

/** What an arm takes before its check. */
export type ArmHeadForm =
  | { readonly kind: 'check' }
  | { readonly kind: 'callContext' }
  | {
    readonly kind: 'route';
    /** The third positional item: dropped at input 0 (root), or on the proxy-forward decision. */
    readonly envelope?: 'root' | { readonly decisionOrdinal: number; readonly reread: number };
  }
  | { readonly kind: 'multiCall'; readonly takes: Uint8Array }
  | { readonly kind: 'refused' };

export interface ArmHeadRecord {
  readonly name: string;
  /** The selector the dispatcher invokes the arm by; undefined for the arm the program runs inline. */
  readonly selector?: string;
  readonly form: ArmHeadForm;
  /** The model's length at the check. */
  readonly depth: number;
}

export class ArmHeadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArmHeadError';
  }
}

const depthCheck = (depth: number): Script => [Op.OP_DEPTH, encodeInt(BigInt(depth)), Op.OP_NUMEQUALVERIFY];
const dropBottom: Script = [Op.OP_DEPTH, Op.OP_1SUB, Op.OP_ROLL, Op.OP_DROP];
const pickAt = (index: number): Script => (index === 0 ? [Op.OP_DUP]
  : index === 1 ? [Op.OP_OVER] : [encodeInt(BigInt(index)), Op.OP_PICK]);

/** The bytes an arm of this form and depth begins with (for a refused arm, its whole body). */
export function armHeadBytes(form: ArmHeadForm, depth: number): Uint8Array {
  switch (form.kind) {
    case 'check':
      return scriptToBytecode(depthCheck(depth));
    case 'callContext':
      return scriptToBytecode([
        Op.OP_FROMALTSTACK, Op.OP_DUP, Op.OP_0, Op.OP_LESSTHAN, Op.OP_IF, ...depthCheck(depth), Op.OP_ENDIF,
      ]);
    case 'multiCall':
      return Uint8Array.from([...form.takes, ...scriptToBytecode(depthCheck(depth))]);
    case 'refused':
      return scriptToBytecode([Op.OP_0, Op.OP_VERIFY]);
    case 'route': {
      const head: Script = [...dropBottom, ...dropBottom];
      if (form.envelope === 'root') {
        head.push(Op.OP_INPUTINDEX, Op.OP_0, Op.OP_NUMEQUAL, Op.OP_IF, ...dropBottom, Op.OP_ENDIF, ...depthCheck(depth));
      } else if (form.envelope !== undefined) {
        const { decisionOrdinal, reread } = form.envelope;
        head.push(
          Op.OP_DEPTH, ...(decisionOrdinal === 1 ? [Op.OP_1SUB] : [encodeInt(BigInt(decisionOrdinal)), Op.OP_SUB]),
          Op.OP_PICK, Op.OP_0, Op.OP_NUMEQUAL, Op.OP_DUP, Op.OP_IF, ...dropBottom, Op.OP_ENDIF,
          ...depthCheck(depth),
          ...pickAt(reread), Op.OP_0, Op.OP_NUMEQUAL, Op.OP_EQUALVERIFY,
        );
      } else {
        head.push(...depthCheck(depth));
      }
      return scriptToBytecode(head);
    }
    default:
      throw new ArmHeadError(`unknown arm head form ${(form as { kind: string }).kind}`);
  }
}

/** The byte length of the instruction at `at`; a push that runs past the end is malformed. */
function instructionLength(code: Uint8Array, at: number): number {
  const opcode = code[at]!;
  let length = 1;
  if (opcode >= 0x01 && opcode <= 0x4b) length = 1 + opcode;
  else if (opcode === Op.OP_PUSHDATA_1) length = 2 + (code[at + 1] ?? 0);
  else if (opcode === Op.OP_PUSHDATA_2) length = 3 + ((code[at + 1] ?? 0) | ((code[at + 2] ?? 0) << 8));
  else if (opcode === Op.OP_PUSHDATA_4) {
    length = 5 + (((code[at + 1] ?? 0) | ((code[at + 2] ?? 0) << 8) | ((code[at + 3] ?? 0) << 16)
      | ((code[at + 4] ?? 0) << 24)) >>> 0);
  }
  if (at + length > code.length) throw new ArmHeadError(`the code holds a malformed push at byte ${at}`);
  return length;
}

/** The data a push instruction at `at` carries, or undefined for any other instruction. */
function pushData(code: Uint8Array, at: number): Uint8Array | undefined {
  const opcode = code[at]!;
  const length = instructionLength(code, at);
  if (opcode === Op.OP_0) return new Uint8Array(0);
  if (opcode >= 0x01 && opcode <= 0x4b) return code.slice(at + 1, at + length);
  if (opcode === Op.OP_PUSHDATA_1) return code.slice(at + 2, at + length);
  if (opcode === Op.OP_PUSHDATA_2) return code.slice(at + 3, at + length);
  if (opcode === Op.OP_PUSHDATA_4) return code.slice(at + 5, at + length);
  return undefined;
}

const isPush = (opcode: number): boolean => opcode <= Op.OP_16 && opcode !== Op.OP_RESERVED;

/** A top-level `<body> <id> OP_DEFINE` at `at`: its length, body and id, or undefined. */
function definitionAt(
  code: Uint8Array, at: number,
): { length: number; body: Uint8Array; id: string } | undefined {
  if (at >= code.length) return undefined;
  const body = pushData(code, at);
  if (body === undefined || code[at] === Op.OP_0) return undefined;
  const idAt = at + instructionLength(code, at);
  if (idAt >= code.length || !isPush(code[idAt]!)) return undefined;
  const defineAt = idAt + instructionLength(code, idAt);
  if (code[defineAt] !== Op.OP_DEFINE) return undefined;
  const id = pushData(code, idAt);
  const idHex = id === undefined ? `op${code[idAt]!.toString(16)}`
    : Array.from(id, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return { length: defineAt + 1 - at, body, id: idHex };
}

/**
 * The pool binding helper a program defines from its `__oraclePool` parameter before the arms, its body built at run
 * time as the push of that parameter: `<20> <pick> OP_CAT <id> OP_DEFINE`, the pick `OP_OVER` once optimised. Its
 * length, or 0.
 */
function poolBindingDefinitionAt(code: Uint8Array, at: number): number {
  if (code[at] !== 0x01 || code[at + 1] !== 0x20) return 0;
  let cursor = at + 2;
  if (code[cursor] === Op.OP_OVER) {
    cursor += 1;
  } else {
    if (cursor >= code.length || !isPush(code[cursor]!)) return 0;
    cursor += instructionLength(code, cursor);
    if (code[cursor] !== Op.OP_PICK) return 0;
    cursor += 1;
  }
  if (code[cursor] !== Op.OP_CAT) return 0;
  cursor += 1;
  if (cursor >= code.length || !isPush(code[cursor]!)) return 0;
  cursor += instructionLength(code, cursor);
  return code[cursor] === Op.OP_DEFINE ? cursor + 1 - at : 0;
}

/**
 * The block that computes `__internal__redeemPushSize` before the arms: it opens with
 * `OP_INPUTINDEX OP_UTXOBYTECODE` and ends where its first conditional closes. Its length, or 0.
 */
function redeemLengthBlockAt(code: Uint8Array, at: number): number {
  if (code[at] !== Op.OP_INPUTINDEX || code[at + 1] !== Op.OP_UTXOBYTECODE) return 0;
  let depth = 0;
  let opened = false;
  for (let cursor = at; cursor < code.length;) {
    const opcode = code[cursor]!;
    cursor += instructionLength(code, cursor);
    if (opcode === Op.OP_IF || opcode === Op.OP_NOTIF) {
      depth += 1;
      opened = true;
    } else if (opcode === Op.OP_ENDIF) {
      depth -= 1;
      if (opened && depth === 0) return cursor - at;
    }
  }
  return 0;
}

const startsWith = (code: Uint8Array, at: number, prefix: Uint8Array): boolean => (
  at + prefix.length <= code.length && prefix.every((byte, index) => code[at + index] === byte)
);

const hex = (bytes: Uint8Array): string => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

/**
 * O8 on finished code: every recorded arm begins with its head. A dispatched arm is the body its selector defines;
 * the arm a program runs inline begins after what the program runs ahead of every arm: the definitions, the
 * redeem-length block (`redeemLengthBlock`) and the pool binding helper it defines at run time (`poolBinding`).
 */
export function verifyArmHeads(
  code: Uint8Array, arms: readonly ArmHeadRecord[],
  options: { readonly redeemLengthBlock: boolean; readonly poolBinding: boolean },
): void {
  const inline = arms.some((arm) => arm.selector === undefined);
  const skipsRedeemLength = inline && options.redeemLengthBlock;
  const skipsPoolBinding = inline && options.poolBinding;
  const bodies = new Map<string, Uint8Array[]>();
  let inlineAt: number | undefined;
  let sawRedeemLength = false;
  let sawPoolBinding = false;
  for (let at = 0; at < code.length;) {
    const definition = definitionAt(code, at);
    if (definition !== undefined) {
      bodies.set(definition.id, [...(bodies.get(definition.id) ?? []), definition.body]);
      at += definition.length;
      continue;
    }
    if (inlineAt === undefined && skipsRedeemLength && !sawRedeemLength) {
      const length = redeemLengthBlockAt(code, at);
      if (length > 0) {
        sawRedeemLength = true;
        at += length;
        continue;
      }
    }
    if (inlineAt === undefined && skipsPoolBinding && !sawPoolBinding) {
      const length = poolBindingDefinitionAt(code, at);
      if (length > 0) {
        sawPoolBinding = true;
        at += length;
        continue;
      }
    }
    inlineAt ??= at;
    at += instructionLength(code, at);
  }
  if (skipsRedeemLength && !sawRedeemLength) {
    throw new ArmHeadError('the code does not compute the redeem length its inline arm reads');
  }
  if (skipsPoolBinding && !sawPoolBinding) {
    throw new ArmHeadError('the code does not define the pool binding helper before its inline arm');
  }
  for (const arm of arms) {
    const expected = armHeadBytes(arm.form, arm.depth);
    let body: Uint8Array;
    if (arm.selector === undefined) {
      if (inlineAt === undefined) throw new ArmHeadError(`'${arm.name}' runs inline, and the code holds no arm`);
      body = code.slice(inlineAt);
    } else {
      const defined = bodies.get(arm.selector) ?? [];
      if (defined.length !== 1) {
        throw new ArmHeadError(`'${arm.name}' (selector ${arm.selector}) is defined ${defined.length} times`);
      }
      body = defined[0]!;
    }
    const matches = arm.form.kind === 'refused' && arm.selector !== undefined
      ? body.length === expected.length && startsWith(body, 0, expected)
      : startsWith(body, 0, expected);
    if (!matches) {
      throw new ArmHeadError(`'${arm.name}' does not begin with its exact-stack check: expected `
        + `${hex(expected)} (n = ${arm.depth}), found ${hex(body.slice(0, expected.length + 8))}`);
    }
  }
}
