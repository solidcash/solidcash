/**
 * The master pool's size: fixed by every entry, changed only by the source's `split(n)` and `merge(n)` (spec R2b).
 *
 * A contract owns N masters at its master lock, each a minting NFT of its category. The head keeps N: an index carries
 * the category's minting NFT on its output exactly when its input carries one, so no entry mints or retires a master.
 *
 * A source that declares `function f(int n, sig s) split(n)` or `merge(n)` gets a lifecycle arm beside the head,
 * selected by a one-byte first push where a frame carries its witness block. The body is `require` statements: one
 * `checkSig(s, K)` with `K` a constant key, the admin's, and bounds on `n` against integer literals.
 *
 * - `<1> <n> <sig>`, split: the master is recreated in place, no master is retired, and exactly `n` outputs at indices
 *   with no master input carry a new master: the master lock, the minting NFT, no commitment, no fungible amount.
 * - `<2> <n> <sig>`, merge: the master is recreated in place, no master is minted, and exactly `n` master inputs at
 *   the master lock are not recreated.
 * - `<3>`, retire: the master's own output holds no master, and another input at the master lock is a master
 *   recreated in place. Only a merge admits a recreation beside a retirement, so the merge's signature covers it,
 *   and a pool always keeps the master that merged.
 *
 * The admin's signature must have base type ALL, as a direct upgrade's must. A lifecycle transaction spends and
 * creates no token of the category but masters, so no record, validator or event is touched.
 */

import { bigIntToVmNumber, encodeDataPush, Opcodes } from '@bitauth/libauth';
import {
  bytecodeToScript, PositionHint, PrimitiveType, type FullLocationData, type LocationI, type LogEntry,
  type RequireStatement, type Script,
} from '@solidcash/utils';
import {
  BinaryOpNode, CastNode, FunctionCallNode, FunctionModifier, HexLiteralNode, IdentifierNode, IntLiteralNode,
  RequireNode, type ContractNode, type ExpressionNode, type FunctionDefinitionNode,
} from '../../ast/AST.js';
import { GlobalFunction } from '../../ast/Globals.js';
import { BinaryOperator } from '../../ast/Operator.js';
import { SolidcDiagnosticError } from '../../Errors.js';

/** The first push of a lifecycle spend: which change the master serves. */
export const LIFECYCLE_MODE = { SPLIT: 1, MERGE: 2, RETIRE: 3 } as const;

/** A comparison the body requires of the count. */
interface CountBound {
  readonly operator: BinaryOperator;
  readonly value: bigint;
}

/** One `split(n)` or `merge(n)` function, reduced to what the arm checks. */
export interface PerCallLifecycleEntry {
  readonly kind: 'split' | 'merge';
  readonly name: string;
  readonly countParameter: string;
  readonly signatureParameter: string;
  readonly inputs: readonly { readonly name: string; readonly type: string }[];
  /** The 33-byte key whose signature authorises the change. */
  readonly admin: Uint8Array;
  readonly bounds: readonly CountBound[];
  readonly location: LocationI;
}

const COMPARISONS: ReadonlyMap<BinaryOperator, number> = new Map([
  [BinaryOperator.LT, Opcodes.OP_LESSTHAN],
  [BinaryOperator.LE, Opcodes.OP_LESSTHANOREQUAL],
  [BinaryOperator.GT, Opcodes.OP_GREATERTHAN],
  [BinaryOperator.GE, Opcodes.OP_GREATERTHANOREQUAL],
  [BinaryOperator.EQ, Opcodes.OP_NUMEQUAL],
  [BinaryOperator.NE, Opcodes.OP_NUMNOTEQUAL],
]);

/** The comparison with its operands swapped: `5 > n` is `n < 5`. */
const MIRRORED: ReadonlyMap<BinaryOperator, BinaryOperator> = new Map([
  [BinaryOperator.LT, BinaryOperator.GT],
  [BinaryOperator.LE, BinaryOperator.GE],
  [BinaryOperator.GT, BinaryOperator.LT],
  [BinaryOperator.GE, BinaryOperator.LE],
  [BinaryOperator.EQ, BinaryOperator.EQ],
  [BinaryOperator.NE, BinaryOperator.NE],
]);

/** The contract's `split(n)` and `merge(n)` functions, at most one of each, or none. */
export function perCallLifecycleFunctions(contract: ContractNode): readonly FunctionDefinitionNode[] {
  return contract.functions.filter((fn) => fn.modifiers.includes(FunctionModifier.SPLIT)
    || fn.modifiers.includes(FunctionModifier.MERGE));
}

/** Reduces the lifecycle functions to their arm entries, refusing by name any body the arm cannot serve. */
export function extractPerCallLifecycle(contract: ContractNode): readonly PerCallLifecycleEntry[] {
  const entries = perCallLifecycleFunctions(contract).map((fn) => lifecycleEntry(contract, fn));
  for (const kind of ['split', 'merge'] as const) {
    if (entries.filter((entry) => entry.kind === kind).length > 1) {
      refuse(contract, `declares more than one ${kind}(n) function, and a master serves one`);
    }
  }
  return entries;
}

function lifecycleEntry(contract: ContractNode, fn: FunctionDefinitionNode): PerCallLifecycleEntry {
  const kind = fn.modifiers.includes(FunctionModifier.SPLIT) ? 'split' : 'merge';
  if (fn.modifiers.includes(FunctionModifier.SPLIT) && fn.modifiers.includes(FunctionModifier.MERGE)) {
    refuse(contract, `'${fn.name}' is both split and merge`);
  }
  const countParameter = (kind === 'split' ? fn.splitCountParam : fn.mergeCountParam) ?? '';
  const signature = fn.parameters.find((parameter) => parameter.type === PrimitiveType.SIG);
  if (fn.parameters.length !== 2 || signature === undefined
    || !fn.parameters.some((parameter) => parameter.name === countParameter)) {
    refuse(contract, `'${fn.name}' must take its count and one signature, the admin's`);
  }
  let admin: Uint8Array | undefined;
  const bounds: CountBound[] = [];
  for (const statement of fn.body?.statements ?? []) {
    if (!(statement instanceof RequireNode)) {
      refuse(contract, `'${fn.name}' may only hold require statements`);
    }
    const condition = statement.expression;
    if (condition instanceof FunctionCallNode && condition.identifier.name === GlobalFunction.CHECKSIG) {
      const [sig, key] = condition.parameters;
      if (admin !== undefined || !(sig instanceof IdentifierNode) || sig.name !== signature!.name) {
        refuse(contract, `'${fn.name}' must check its signature once, against one key`);
      }
      admin = constantBytes(contract, key, 0);
      if (admin?.length !== 33) refuse(contract, `'${fn.name}' must check its signature against a constant key`);
      continue;
    }
    const found = countBounds(condition, countParameter);
    if (found === undefined) {
      refuse(contract, `'${fn.name}' may only require the admin's signature and bounds on '${countParameter}'`);
    }
    bounds.push(...found);
  }
  if (admin === undefined) refuse(contract, `'${fn.name}' must require the admin's signature`);
  return {
    kind,
    name: fn.name,
    countParameter,
    signatureParameter: signature!.name,
    inputs: fn.parameters.map((parameter) => ({ name: parameter.name, type: parameter.type.toString() })),
    admin: admin!,
    bounds,
    location: fn.location,
  };
}

/** `n <op> literal`, `literal <op> n`, or a conjunction of them, as bounds on `n`. */
function countBounds(condition: ExpressionNode, count: string): CountBound[] | undefined {
  if (!(condition instanceof BinaryOpNode)) return undefined;
  if (condition.operator === BinaryOperator.AND) {
    const left = countBounds(condition.left, count);
    const right = countBounds(condition.right, count);
    return left === undefined || right === undefined ? undefined : [...left, ...right];
  }
  if (!COMPARISONS.has(condition.operator)) return undefined;
  const isCount = (side: ExpressionNode): boolean => side instanceof IdentifierNode && side.name === count;
  if (isCount(condition.left) && condition.right instanceof IntLiteralNode) {
    return [{ operator: condition.operator, value: condition.right.value }];
  }
  if (isCount(condition.right) && condition.left instanceof IntLiteralNode) {
    return [{ operator: MIRRORED.get(condition.operator)!, value: condition.left.value }];
  }
  return undefined;
}

/** The bytes a constant expression names: a hex literal, a cast of one, or a contract constant holding one. */
function constantBytes(
  contract: ContractNode, expression: ExpressionNode | undefined, depth: number,
): Uint8Array | undefined {
  if (depth > 8 || expression === undefined) return undefined;
  if (expression instanceof HexLiteralNode) return expression.value;
  if (expression instanceof CastNode) return constantBytes(contract, expression.expression, depth + 1);
  if (expression instanceof IdentifierNode) {
    const constant = contract.constantDefinitions.find((definition) => definition.name === expression.name);
    return constantBytes(contract, constant?.expression, depth + 1);
  }
  return undefined;
}

function refuse(contract: ContractNode, reason: string): never {
  throw new SolidcDiagnosticError(
    'PER_CALL_CODEGEN_UNAVAILABLE',
    `the per-call composition convention does not support this contract: ${reason}`,
    { requested: 'per-call', reason, contract: contract.name },
  );
}

type Op = number | Uint8Array;

/** A script number in its minimal push. */
function num(value: number | bigint): Uint8Array {
  return encodeDataPush(bigIntToVmNumber(BigInt(value)));
}

function bytes(ops: readonly Op[]): Uint8Array {
  const out: number[] = [];
  for (const op of ops) {
    if (typeof op === 'number') out.push(op);
    else out.push(...op);
  }
  return Uint8Array.from(out);
}

const O = Opcodes;

/**
 * Keeps the pool: every index's output carries the pinned minting NFT exactly when its input does.
 *
 * Entry `[.., pin]`, exit `[..]`. Each master recreates itself at its own index, so this is what refuses a master
 * minted beside them, or one an entry left out of its outputs.
 */
export function mastersRecreatedInPlaceScript(): Uint8Array {
  return bytes([
    O.OP_0, // [pin, j]
    O.OP_BEGIN,
    O.OP_DUP, O.OP_TXINPUTCOUNT, O.OP_LESSTHAN,
    O.OP_IF, O.OP_DUP, O.OP_UTXOTOKENCATEGORY, num(2), O.OP_PICK, O.OP_EQUAL, O.OP_ELSE, O.OP_0, O.OP_ENDIF,
    O.OP_OVER, O.OP_TXOUTPUTCOUNT, O.OP_LESSTHAN,
    O.OP_IF, O.OP_OVER, O.OP_OUTPUTTOKENCATEGORY, num(3), O.OP_PICK, O.OP_EQUAL, O.OP_ELSE, O.OP_0, O.OP_ENDIF,
    O.OP_EQUALVERIFY,
    O.OP_1ADD,
    O.OP_DUP, O.OP_TXINPUTCOUNT, O.OP_TXOUTPUTCOUNT, O.OP_MAX, O.OP_GREATERTHANOREQUAL,
    O.OP_UNTIL,
    O.OP_2DROP,
  ]);
}

/**
 * `[.., cat]` with the pin `depth` items below `cat`, to `[.., isPin]`. A token of the pin's category that is not a
 * master (a record, a validator, an event, a fungible amount) fails.
 */
function masterOrForeign(depth: number): Op[] {
  return [
    O.OP_DUP, num(depth + 1), O.OP_PICK, O.OP_EQUAL, O.OP_SWAP,
    O.OP_SIZE, num(32), O.OP_GREATERTHANOREQUAL,
    O.OP_IF,
    num(32), O.OP_SPLIT, O.OP_DROP, num(depth + 1), O.OP_PICK, num(32), O.OP_SPLIT, O.OP_DROP, O.OP_EQUAL,
    O.OP_ELSE, O.OP_DROP, O.OP_0, O.OP_ENDIF,
    O.OP_OVER, O.OP_EQUALVERIFY,
  ];
}

/** `[n, sig, pin, mode]` to the same: the signature has base type ALL and is the admin's; `n` meets the bounds. */
function authorise(entry: PerCallLifecycleEntry): Op[] {
  const ops: Op[] = [
    num(2), O.OP_PICK, O.OP_SIZE, O.OP_1SUB, O.OP_SPLIT, O.OP_NIP,
    encodeDataPush(Uint8Array.of(0x1f)), O.OP_AND, encodeDataPush(Uint8Array.of(0x01)), O.OP_EQUALVERIFY,
    num(2), O.OP_PICK, encodeDataPush(entry.admin), O.OP_CHECKSIGVERIFY,
  ];
  for (const bound of entry.bounds) {
    ops.push(num(3), O.OP_PICK, num(bound.value), COMPARISONS.get(bound.operator)!, O.OP_VERIFY);
  }
  return ops;
}

/** `[pin]` to `[]`: this master is not recreated, and a master at its lock beside it is. */
function retire(): Op[] {
  return [
    O.OP_INPUTINDEX, O.OP_TXOUTPUTCOUNT, O.OP_LESSTHAN,
    O.OP_IF, O.OP_INPUTINDEX, O.OP_OUTPUTTOKENCATEGORY, O.OP_OVER, O.OP_EQUAL, O.OP_NOT, O.OP_VERIFY, O.OP_ENDIF,
    O.OP_0, O.OP_0, // [pin, found, j]
    O.OP_BEGIN,
    O.OP_DUP, O.OP_INPUTINDEX, O.OP_NUMNOTEQUAL,
    O.OP_OVER, O.OP_UTXOTOKENCATEGORY, num(4), O.OP_PICK, O.OP_EQUAL, O.OP_BOOLAND,
    O.OP_OVER, O.OP_TXOUTPUTCOUNT, O.OP_LESSTHAN, O.OP_BOOLAND,
    O.OP_IF,
    O.OP_DUP, O.OP_OUTPUTTOKENCATEGORY, num(3), O.OP_PICK, O.OP_EQUAL,
    O.OP_OVER, O.OP_UTXOBYTECODE, O.OP_INPUTINDEX, O.OP_UTXOBYTECODE, O.OP_EQUAL, O.OP_BOOLAND,
    O.OP_ROT, O.OP_BOOLOR, O.OP_SWAP,
    O.OP_ENDIF,
    O.OP_1ADD,
    O.OP_DUP, O.OP_TXINPUTCOUNT, O.OP_GREATERTHANOREQUAL,
    O.OP_UNTIL,
    O.OP_DROP, O.OP_VERIFY, O.OP_DROP,
  ];
}

/**
 * `[n, pin, mode]` to `[]`: the masters a split mints or a merge retires, exactly `n` of them, at the master lock.
 */
function census(): Op[] {
  return [
    O.OP_0, O.OP_0, // [n, pin, mode, count, j]
    O.OP_BEGIN,
    O.OP_DUP, O.OP_TXINPUTCOUNT, O.OP_LESSTHAN,
    O.OP_IF, O.OP_DUP, O.OP_UTXOTOKENCATEGORY, ...masterOrForeign(4), O.OP_ELSE, O.OP_0, O.OP_ENDIF,
    O.OP_OVER, O.OP_TXOUTPUTCOUNT, O.OP_LESSTHAN,
    O.OP_IF, O.OP_OVER, O.OP_OUTPUTTOKENCATEGORY, ...masterOrForeign(5),
    O.OP_DUP, O.OP_IF, num(2), O.OP_PICK, O.OP_OUTPUTTOKENAMOUNT, O.OP_0, O.OP_NUMEQUALVERIFY, O.OP_ENDIF,
    O.OP_ELSE, O.OP_0, O.OP_ENDIF,
    // [n, pin, mode, count, j, inPin, outPin]
    O.OP_2DUP, O.OP_EQUAL,
    O.OP_IF, O.OP_2DROP,
    O.OP_ELSE,
    // A split only mints and a merge only retires.
    O.OP_DROP, num(3), O.OP_PICK, num(LIFECYCLE_MODE.MERGE), O.OP_NUMEQUAL, O.OP_EQUALVERIFY,
    num(2), O.OP_PICK, num(LIFECYCLE_MODE.SPLIT), O.OP_NUMEQUAL,
    O.OP_IF,
    O.OP_DUP, O.OP_OUTPUTBYTECODE, O.OP_INPUTINDEX, O.OP_UTXOBYTECODE, O.OP_EQUALVERIFY,
    O.OP_DUP, O.OP_OUTPUTTOKENCOMMITMENT, O.OP_0, O.OP_EQUALVERIFY,
    O.OP_ELSE,
    O.OP_DUP, O.OP_UTXOBYTECODE, O.OP_INPUTINDEX, O.OP_UTXOBYTECODE, O.OP_EQUALVERIFY,
    O.OP_ENDIF,
    O.OP_SWAP, O.OP_1ADD, O.OP_SWAP,
    O.OP_ENDIF,
    O.OP_1ADD,
    O.OP_DUP, O.OP_TXINPUTCOUNT, O.OP_TXOUTPUTCOUNT, O.OP_MAX, O.OP_GREATERTHANOREQUAL,
    O.OP_UNTIL,
    O.OP_DROP, num(3), O.OP_ROLL, O.OP_NUMEQUALVERIFY, O.OP_2DROP,
  ];
}

/** The arm: entry `[mode, n, sig]` or `[mode]`, exit `[1]`. */
export function buildLifecycleArmScript(entries: readonly PerCallLifecycleEntry[]): Uint8Array {
  const split = entries.find((entry) => entry.kind === 'split');
  const merge = entries.find((entry) => entry.kind === 'merge');
  const splitOrMerge: Op[] = split !== undefined && merge !== undefined
    ? [O.OP_DUP, num(LIFECYCLE_MODE.SPLIT), O.OP_NUMEQUAL,
      O.OP_IF, ...authorise(split),
      O.OP_ELSE, O.OP_DUP, num(LIFECYCLE_MODE.MERGE), O.OP_NUMEQUALVERIFY, ...authorise(merge), O.OP_ENDIF]
    : [O.OP_DUP, num(split !== undefined ? LIFECYCLE_MODE.SPLIT : LIFECYCLE_MODE.MERGE), O.OP_NUMEQUALVERIFY,
      ...authorise((split ?? merge)!)];
  return bytes([
    O.OP_DEPTH, O.OP_1SUB, O.OP_ROLL,
    O.OP_INPUTINDEX, O.OP_UTXOTOKENCATEGORY,
    O.OP_DUP, O.OP_SIZE, O.OP_NIP, num(33), O.OP_NUMEQUALVERIFY,
    O.OP_DUP, num(32), O.OP_SPLIT, O.OP_NIP, encodeDataPush(Uint8Array.of(0x02)), O.OP_EQUALVERIFY,
    O.OP_SWAP,
    O.OP_DUP, num(LIFECYCLE_MODE.RETIRE), O.OP_NUMEQUAL,
    O.OP_IF,
    O.OP_DEPTH, num(2), O.OP_NUMEQUALVERIFY, O.OP_DROP, ...retire(),
    O.OP_ELSE,
    O.OP_DEPTH, num(4), O.OP_NUMEQUALVERIFY,
    ...splitOrMerge,
    num(3), O.OP_PICK, O.OP_1, O.OP_GREATERTHANOREQUAL, O.OP_VERIFY,
    // The master is recreated in place, as the head's prologue requires of every entry.
    O.OP_INPUTINDEX, O.OP_OUTPUTBYTECODE, O.OP_INPUTINDEX, O.OP_UTXOBYTECODE, O.OP_EQUALVERIFY,
    O.OP_INPUTINDEX, O.OP_OUTPUTTOKENCATEGORY, num(2), O.OP_PICK, O.OP_EQUALVERIFY,
    O.OP_INPUTINDEX, O.OP_OUTPUTTOKENCOMMITMENT, O.OP_0, O.OP_EQUALVERIFY,
    O.OP_INPUTINDEX, O.OP_OUTPUTVALUE, O.OP_INPUTINDEX, O.OP_UTXOVALUE, O.OP_GREATERTHANOREQUAL, O.OP_VERIFY,
    num(2), O.OP_ROLL, O.OP_DROP, // the signature
    ...census(),
    O.OP_ENDIF,
    O.OP_1,
  ]);
}

/** True for a first push that selects the arm: one byte, where a frame's witness block is longer. */
const ARM_SELECTOR: readonly Op[] = [
  O.OP_DEPTH, O.OP_1SUB, O.OP_PICK, O.OP_SIZE, O.OP_NIP, O.OP_1, O.OP_NUMEQUAL,
];

/** A finished master program and the debug records aligned with its instructions. */
export interface MasterProgramParts {
  script: Script;
  locationData: FullLocationData;
  logs: LogEntry[];
  requires: RequireStatement[];
}

/**
 * Wraps a finished master as `<selector> OP_NOTIF <master> OP_ELSE <arm> OP_ENDIF`.
 *
 * The master's instructions move by the selector's length, so its debug records move with them. Nothing in the master
 * holds a byte offset but the census address read, which the caller retargets afterwards.
 */
export function wrapLifecycleArm(
  parts: MasterProgramParts,
  entries: readonly PerCallLifecycleEntry[],
  location: LocationI,
): MasterProgramParts {
  const head = [...bytecodeToScript(bytes(ARM_SELECTOR)), O.OP_NOTIF];
  const tail = [O.OP_ELSE, ...bytecodeToScript(buildLifecycleArmScript(entries)), O.OP_ENDIF];
  const at = (positionHint: PositionHint): FullLocationData[number] => ({ location, positionHint });
  const shift = head.length;
  return {
    script: [...head, ...parts.script, ...tail],
    locationData: [
      ...head.map(() => at(PositionHint.START)), ...parts.locationData, ...tail.map(() => at(PositionHint.END)),
    ],
    logs: parts.logs.map((log) => ({ ...log, ip: log.ip + shift })),
    requires: parts.requires.map((require) => ({ ...require, ip: require.ip + shift })),
  };
}

/** What a master serves outside its head, as the artifact publishes it. */
export function publishLifecycle(entries: readonly PerCallLifecycleEntry[]): {
  split?: { name: string; inputs: { name: string; type: string }[]; countParameter: string };
  merge?: { name: string; inputs: { name: string; type: string }[]; countParameter: string };
} {
  const published: ReturnType<typeof publishLifecycle> = {};
  for (const entry of entries) {
    published[entry.kind] = {
      name: entry.name, inputs: entry.inputs.map((input) => ({ ...input })), countParameter: entry.countParameter,
    };
  }
  return published;
}
